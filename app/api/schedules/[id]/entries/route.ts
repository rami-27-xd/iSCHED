import { NextResponse } from "next/server"
import { getAuthenticatedUser, getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiResponse, apiError } from "@/lib/api-helpers"
import { validateEntry } from "@/lib/services/entry-validation"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json(apiError("Unauthorized"), { status: 401 })
    }

    const dbUser = await getCurrentUser()
    if (!dbUser) {
      return NextResponse.json(apiError("User not found"), { status: 404 })
    }

    const { id } = await params
    const body = await req.json()

    const schedule = await db.schedule.findUnique({ where: { id } })
    if (!schedule) {
      return NextResponse.json(apiError("Schedule not found"), { status: 404 })
    }

    // Only DRAFT schedules can be modified by Dept Chair
    // Program Chairs (ADMIN) can add entries to PUBLISHED schedules
    const canAdd =
      (dbUser.role === "SUPER_ADMIN" && schedule.status === "DRAFT") ||
      (dbUser.role === "ADMIN" && schedule.status === "PUBLISHED")

    if (!canAdd) {
      return NextResponse.json(apiError("You don't have permission to add entries to this schedule"), { status: 403 })
    }

    // Validate constraints before creating
    const validationError = await validateEntry(id, {
      subjectId: body.subjectId,
      facultyId: body.facultyId,
      roomId: body.roomId,
      sectionId: body.sectionId,
      day: body.day,
      startTime: body.startTime,
      endTime: body.endTime,
      set: body.set ?? null,
    })
    if (validationError) {
      return NextResponse.json(apiError(validationError), { status: 409 })
    }

    const entry = await db.scheduleEntry.create({
      data: {
        scheduleId: id,
        subjectId: body.subjectId,
        facultyId: body.facultyId,
        roomId: body.roomId,
        sectionId: body.sectionId,
        day: body.day,
        startTime: body.startTime,
        endTime: body.endTime,
        set: body.set ?? null,
        createdBy: dbUser.id,
      },
      include: {
        subject: true,
        faculty: { include: { user: true } },
        room: true,
        section: true,
      },
    })

    return NextResponse.json(apiResponse(entry), { status: 201 })
  } catch (error) {
    console.error("POST /api/schedules/[id]/entries error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}
