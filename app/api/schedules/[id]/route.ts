import { NextResponse } from "next/server"
import { getAuthenticatedUser, getCurrentUser, getUserDepartmentId } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiResponse, apiError } from "@/lib/api-helpers"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json(apiError("Unauthorized"), { status: 401 })
    }

    const dbUser = await getCurrentUser()
    const { id } = await params

    const schedule = await db.schedule.findUnique({
      where: { id },
      include: {
        semester: { include: { academicYear: true } },
        department: true,
        entries: {
          include: {
            subject: true,
            faculty: { include: { user: true } },
            room: true,
            section: {
              include: {
                yearLevel: { include: { program: true } },
              },
            },
          },
        },
        conflicts: true,
      },
    })

    if (!schedule) {
      return NextResponse.json(apiError("Schedule not found"), { status: 404 })
    }

    // ADMIN (Program Chair): only see entries for sections in their department
    // e.g. CIT Program Chair sees all CIT sections (BSIT-Garm, BSInfoTech, etc.)
    // but NOT entries for CAS or CTE sections
    if (dbUser?.role === "ADMIN") {
      const adminDeptId = getUserDepartmentId(dbUser)

      if (adminDeptId) {
        schedule.entries = schedule.entries.filter((entry: any) => {
          const sectionDeptId = entry.section?.yearLevel?.program?.departmentId
          return sectionDeptId === adminDeptId
        })
      }
    }

    return NextResponse.json(apiResponse(schedule))
  } catch (error) {
    console.error("GET /api/schedules/[id] error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json(apiError("Unauthorized"), { status: 401 })
    }

    const dbUser = await getCurrentUser()
    if (!dbUser || dbUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(apiError("Only Department Chairs can modify schedules"), { status: 403 })
    }

    const { id } = await params
    const body = await req.json()

    // Handle archive/unarchive actions
    if (body.action === "archive") {
      const schedule = await db.schedule.update({
        where: { id },
        data: { isArchived: true, status: "ARCHIVED" },
      })
      return NextResponse.json(apiResponse(schedule))
    }

    if (body.action === "unarchive") {
      const schedule = await db.schedule.update({
        where: { id },
        data: { isArchived: false, status: "DRAFT" },
      })
      return NextResponse.json(apiResponse(schedule))
    }

    if (body.action === "unpublish") {
      const schedule = await db.schedule.findUnique({ where: { id } })
      if (!schedule || schedule.status !== "PUBLISHED") {
        return NextResponse.json(apiError("Schedule is not published"), { status: 400 })
      }
      const updated = await db.schedule.update({
        where: { id },
        data: { status: "DRAFT", publishedAt: null },
      })
      return NextResponse.json(apiResponse(updated))
    }

    // Handle status update
    const schedule = await db.schedule.update({
      where: { id },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.status === "PUBLISHED" ? { publishedAt: new Date() } : {}),
      },
    })

    return NextResponse.json(apiResponse(schedule))
  } catch (error) {
    console.error("PATCH /api/schedules/[id] error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json(apiError("Unauthorized"), { status: 401 })
    }

    const dbUser = await getCurrentUser()
    if (!dbUser || dbUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(apiError("Only Department Chairs can delete schedules"), { status: 403 })
    }

    const { id } = await params

    await db.schedule.delete({ where: { id } })

    return NextResponse.json(apiResponse({ deleted: true }))
  } catch (error) {
    console.error("DELETE /api/schedules/[id] error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}
