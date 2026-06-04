import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { notifyAllSuperAdmins } from '@/lib/notifications'

type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'FACULTY'

export async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getCurrentUser() {
  const user = await getAuthenticatedUser()
  if (!user) return null

  return db.user.findUnique({
    where: { supabaseId: user.id },
    include: {
      department: true,
      faculty: { include: { department: true } },
      departmentChair: { include: { department: true } },
      programHead: { include: { program: { include: { department: true } } } },
    },
  })
}

/** Get the department ID for the current user based on their role */
export function getUserDepartmentId(dbUser: any): string | null {
  if (!dbUser) return null
  // Direct departmentId on User model (set by SUPER_ADMIN assignment)
  if (dbUser.departmentId) {
    return dbUser.departmentId
  }
  // SUPER_ADMIN (Department Chair) — from departmentChair relation
  if (dbUser.role === 'SUPER_ADMIN' && dbUser.departmentChair?.departmentId) {
    return dbUser.departmentChair.departmentId
  }
  // ADMIN (Program Chair) — from programHead → program → departmentId
  if (dbUser.role === 'ADMIN' && dbUser.programHead?.program?.departmentId) {
    return dbUser.programHead.program.departmentId
  }
  // FACULTY — from faculty relation
  if (dbUser.faculty?.departmentId) {
    return dbUser.faculty.departmentId
  }
  return null
}

export async function ensureDbUser(supabaseUser: SupabaseUser) {
  const existing = await db.user.findUnique({
    where: { supabaseId: supabaseUser.id },
    include: {
      department: true,
      faculty: { include: { department: true } },
      departmentChair: { include: { department: true } },
      programHead: { include: { program: { include: { department: true } } } },
    },
  })

  if (existing) {
    // If user is not yet approved, check if they should be auto-approved or role-updated
    const requestedRole = supabaseUser.user_metadata?.requested_role as UserRole | undefined
    const allowedRoles: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'FACULTY']
    const needsRoleUpdate = requestedRole && allowedRoles.includes(requestedRole) && !existing.isApproved && existing.role !== requestedRole

    // Auto-approve: if no approved SUPER_ADMIN exists and this user is SUPER_ADMIN (or requesting it)
    let shouldAutoApprove = false
    const effectiveRole = needsRoleUpdate ? requestedRole! : existing.role as UserRole
    if (!existing.isApproved && effectiveRole === 'SUPER_ADMIN') {
      const existingSuperAdmins = await db.user.count({
        where: { role: 'SUPER_ADMIN', isApproved: true },
      })
      if (existingSuperAdmins === 0) {
        shouldAutoApprove = true
      }
    }

    if (needsRoleUpdate || shouldAutoApprove) {
      return db.user.update({
        where: { supabaseId: supabaseUser.id },
        data: {
          ...(needsRoleUpdate ? { role: requestedRole } : {}),
          ...(shouldAutoApprove ? { isApproved: true } : {}),
        },
        include: {
          faculty: { include: { department: true } },
          departmentChair: { include: { department: true } },
          programHead: { include: { program: { include: { department: true } } } },
        },
      })
    }
    return existing
  }

  // New users default to requested role (or FACULTY) and require approval
  const requestedRole = supabaseUser.user_metadata?.requested_role as UserRole | undefined
  const allowedSelfRoles: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'FACULTY']
  const role = requestedRole && allowedSelfRoles.includes(requestedRole) ? requestedRole : 'FACULTY'

  const firstName = supabaseUser.user_metadata?.first_name ?? supabaseUser.user_metadata?.full_name?.split(' ')[0] ?? ''
  const lastName = supabaseUser.user_metadata?.last_name ?? supabaseUser.user_metadata?.full_name?.split(' ').slice(1).join(' ') ?? ''

  // Auto-approve: if there are NO approved SUPER_ADMINs yet and this user is registering as SUPER_ADMIN,
  // they become the first Department Chair and are auto-approved
  let autoApprove = false
  if (role === 'SUPER_ADMIN') {
    const existingSuperAdmins = await db.user.count({
      where: { role: 'SUPER_ADMIN', isApproved: true },
    })
    if (existingSuperAdmins === 0) {
      autoApprove = true
    }
  }

  const departmentId = supabaseUser.user_metadata?.department_id as string | undefined

  const newUser = await db.user.create({
    data: {
      supabaseId: supabaseUser.id,
      email: supabaseUser.email ?? '',
      firstName,
      lastName,
      role,
      isApproved: autoApprove,
      ...(departmentId ? { departmentId } : {}),
    },
    include: {
      department: true,
      faculty: { include: { department: true } },
      departmentChair: { include: { department: true } },
      programHead: { include: { program: { include: { department: true } } } },
    },
  })

  // Auto-link FACULTY to their department by creating a faculty record
  if (role === 'FACULTY' && departmentId) {
    const deptExists = await db.department.findUnique({ where: { id: departmentId } })
    if (deptExists) {
      const existingFaculty = await db.faculty.findUnique({ where: { userId: newUser.id } })
      if (!existingFaculty) {
        await db.faculty.create({
          data: {
            userId: newUser.id,
            departmentId,
            employeeId: `FAC-${Date.now()}`,
          },
        })
      }
    }
  }

  // Auto-link ADMIN (Program Chair) to their department as faculty too
  if (role === 'ADMIN' && departmentId) {
    const deptExists = await db.department.findUnique({ where: { id: departmentId } })
    if (deptExists) {
      const existingFaculty = await db.faculty.findUnique({ where: { userId: newUser.id } })
      if (!existingFaculty) {
        await db.faculty.create({
          data: {
            userId: newUser.id,
            departmentId,
            employeeId: `FAC-${Date.now()}`,
          },
        })
      }
    }
  }

  // Notify all super admins about the new registration
  const deptName = departmentId
    ? (await db.department.findUnique({ where: { id: departmentId } }))?.name ?? ''
    : ''
  const roleLabel = role === 'ADMIN' ? 'Program Chair' : role === 'SUPER_ADMIN' ? 'Department Chair' : 'Faculty'
  await notifyAllSuperAdmins(
    "New User Registration",
    `${firstName} ${lastName} (${supabaseUser.email}) registered as ${roleLabel}${deptName ? ` in ${deptName}` : ''} and is pending approval.`,
    "user_registered",
    "/dashboard/users"
  ).catch(() => {}) // Don't block sign-in if notification fails

  // Re-fetch with updated relations
  return db.user.findUnique({
    where: { id: newUser.id },
    include: {
      department: true,
      faculty: { include: { department: true } },
      departmentChair: { include: { department: true } },
      programHead: { include: { program: { include: { department: true } } } },
    },
  })
}

export async function requireRole(...roles: UserRole[]) {
  const user = await getCurrentUser()
  if (!user || !roles.includes(user.role as UserRole)) {
    throw new Error('UNAUTHORIZED')
  }
  return user
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>

export const ROLE_PERMISSIONS = {
  SUPER_ADMIN: ['*'], // Department Chair — full access
  ADMIN: [            // Program Chair — manage major subjects, view schedules/rooms
    'schedule:read', 'schedule:create',
    'faculty:read',
    'room:read', 'subject:read', 'subject:manage',
    'section:read', 'section:manage',
    'analytics:read',
  ],
  FACULTY: [          // End users — view own schedule only
    'schedule:read:own',
    'availability:write:own',
  ],
} as const

export function hasPermission(role: UserRole, permission: string): boolean {
  const perms: readonly string[] = ROLE_PERMISSIONS[role]
  return perms.includes('*') || perms.includes(permission)
}
