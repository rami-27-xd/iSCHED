import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

type UserRole = 'SUPER_ADMIN' | 'DEPARTMENT_CHAIR' | 'PROGRAM_HEAD' | 'FACULTY' | 'STUDENT'

export async function getCurrentUser() {
  const { userId } = await auth()
  if (!userId) return null

  return db.user.findUnique({
    where: { clerkId: userId },
    include: {
      faculty: { include: { department: true } },
      departmentChair: { include: { department: true } },
      programHead: { include: { program: true } },
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
  SUPER_ADMIN: ['*'],
  DEPARTMENT_CHAIR: [
    'schedule:read', 'schedule:create', 'schedule:publish',
    'faculty:read', 'faculty:assign',
    'room:read', 'subject:read',
    'analytics:read',
  ],
  PROGRAM_HEAD: [
    'schedule:read', 'schedule:create',
    'faculty:read', 'room:read', 'subject:read',
  ],
  FACULTY: ['schedule:read:own', 'availability:write:own'],
  STUDENT: ['schedule:read:public'],
} as const

export function hasPermission(role: UserRole, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role]
  return perms.includes('*' as any) || perms.includes(permission as any)
}
