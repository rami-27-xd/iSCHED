import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { apiResponse, apiError, handleApiError } from '@/lib/api-helpers'
import { createNotification } from '@/lib/notifications'

// PATCH /api/users/[id] — Update user (approve, change role, deactivate)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireRole('SUPER_ADMIN')
    const { id } = await params
    const body = await request.json()

    const { role, isApproved, isActive, departmentId, programId } = body

    // Validate role if provided
    const validRoles = ['SUPER_ADMIN', 'ADMIN', 'FACULTY']
    if (role !== undefined && !validRoles.includes(role)) {
      return NextResponse.json(apiError('Invalid role'), { status: 400 })
    }

    // Prevent self-demotion
    if (id === currentUser.id && role && role !== currentUser.role) {
      return NextResponse.json(apiError('Cannot change your own role'), { status: 400 })
    }

    // Prevent self-deactivation
    if (id === currentUser.id && isActive === false) {
      return NextResponse.json(apiError('Cannot deactivate your own account'), { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (role !== undefined) updateData.role = role
    if (isApproved !== undefined) updateData.isApproved = isApproved
    if (isActive !== undefined) updateData.isActive = isActive
    // Set departmentId directly on User for all roles
    if (departmentId !== undefined) updateData.departmentId = departmentId || null

    const user = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isApproved: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        department: { select: { id: true, name: true, abbreviation: true } },
      },
    })

    // Also sync role-specific relations when department is assigned
    if (departmentId !== undefined && departmentId) {
      const targetRole = role ?? user.role

      if (targetRole === 'SUPER_ADMIN') {
        const existing = await db.departmentChair.findUnique({ where: { userId: id } })
        if (existing) {
          await db.departmentChair.update({ where: { userId: id }, data: { departmentId } })
        } else {
          await db.departmentChair.create({ data: { userId: id, departmentId } })
        }
      } else if (targetRole === 'FACULTY') {
        const existing = await db.faculty.findUnique({ where: { userId: id } })
        if (existing) {
          await db.faculty.update({ where: { userId: id }, data: { departmentId } })
        } else {
          await db.faculty.create({ data: { userId: id, departmentId, employeeId: `FAC-${Date.now()}` } })
        }
      } else if (targetRole === 'ADMIN') {
        // Program Chair is also a faculty member in their own department
        const existing = await db.faculty.findUnique({ where: { userId: id } })
        if (existing) {
          await db.faculty.update({ where: { userId: id }, data: { departmentId } })
        } else {
          await db.faculty.create({ data: { userId: id, departmentId, employeeId: `FAC-${Date.now()}` } })
        }
      }
    }

    // ADMIN (Program Chair): sync programHead relation when programId is provided
    if (programId !== undefined) {
      const targetRole = role ?? user.role
      if (targetRole === 'ADMIN') {
        if (programId) {
          const existing = await db.programHead.findUnique({ where: { userId: id } })
          if (existing) {
            await db.programHead.update({ where: { userId: id }, data: { programId } })
          } else {
            await db.programHead.create({ data: { userId: id, programId } })
          }
        } else {
          // Remove programHead if programId is cleared
          await db.programHead.deleteMany({ where: { userId: id } })
        }
      }
    }

    if (body.isApproved === true) {
      await createNotification({
        userId: user.id,
        title: "Account Approved",
        message: "Your account has been approved. You can now access the system.",
        type: "user_approved",
        link: "/dashboard",
      })

      // If the approved user is a Program Chair (ADMIN) with a department,
      // ensure they also have a faculty record
      const approvedUser = await db.user.findUnique({
        where: { id },
        select: { role: true, departmentId: true },
      })
      if (approvedUser?.role === 'ADMIN' && approvedUser.departmentId) {
        const existingFaculty = await db.faculty.findUnique({ where: { userId: id } })
        if (!existingFaculty) {
          await db.faculty.create({
            data: {
              userId: id,
              departmentId: approvedUser.departmentId,
              employeeId: `FAC-${Date.now()}`,
            },
          })
        }
      }
    }

    return NextResponse.json(apiResponse(user))
  } catch (error) {
    const err = handleApiError(error)
    const status = err.error === 'Unauthorized' ? 403 : 500
    return NextResponse.json(err, { status })
  }
}
