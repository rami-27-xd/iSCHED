import { NextResponse } from "next/server"
import { getAuthenticatedUser, getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiResponse, apiError } from "@/lib/api-helpers"
import { validateEntry } from "@/lib/services/entry-validation"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> }
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

    const { id, entryId } = await params
    const body = await req.json()

    const schedule = await db.schedule.findUnique({ where: { id } })
    if (!schedule) {
      return NextResponse.json(apiError("Schedule not found"), { status: 400 })
    }

    const entry = await db.scheduleEntry.findUnique({ where: { id: entryId } })
    if (!entry) {
      return NextResponse.json(apiError("Entry not found"), { status: 404 })
    }

    // Only DRAFT schedules can be modified by Dept Chair
    // Program Chairs can edit their own entries on PUBLISHED schedules
    if (dbUser.role === "SUPER_ADMIN" && schedule.status === "DRAFT") {
      // OK — full access
    } else if (dbUser.role === "ADMIN" && schedule.status === "PUBLISHED") {
      // Program Chair can only edit entries they personally created
      // If createdBy is null or belongs to someone else, block it
      if (!entry.createdBy || entry.createdBy !== dbUser.id) {
        return NextResponse.json(
          apiError("You can only modify entries you created. Department Chair entries are read-only."),
          { status: 403 }
        )
      }
    } else {
      return NextResponse.json(apiError("You don't have permission to modify this schedule"), { status: 403 })
    }

    // Merge current entry data with updates for validation
    const merged = {
      subjectId: body.subjectId ?? entry.subjectId,
      facultyId: body.facultyId ?? entry.facultyId,
      roomId: body.roomId ?? entry.roomId,
      sectionId: body.sectionId ?? entry.sectionId,
      day: body.day ?? entry.day,
      startTime: body.startTime ?? entry.startTime,
      endTime: body.endTime ?? entry.endTime,
      set: body.set !== undefined ? body.set : entry.set,
    }

    const validationError = await validateEntry(id, merged, entryId)
    if (validationError) {
      return NextResponse.json(apiError(validationError), { status: 409 })
    }

    const updated = await db.scheduleEntry.update({
      where: { id: entryId, scheduleId: id },
      data: {
        ...(body.day !== undefined ? { day: body.day } : {}),
        ...(body.startTime !== undefined ? { startTime: body.startTime } : {}),
        ...(body.endTime !== undefined ? { endTime: body.endTime } : {}),
        ...(body.roomId !== undefined ? { roomId: body.roomId } : {}),
        ...(body.facultyId !== undefined ? { facultyId: body.facultyId } : {}),
        ...(body.sectionId !== undefined ? { sectionId: body.sectionId } : {}),
        ...(body.subjectId !== undefined ? { subjectId: body.subjectId } : {}),
        ...(body.set !== undefined ? { set: body.set } : {}),
      },
      include: {
        subject: true,
        faculty: { include: { user: true } },
        room: true,
        section: true,
      },
    })

    return NextResponse.json(apiResponse(updated))
  } catch (error) {
    console.error("PATCH /api/schedules/[id]/entries/[entryId] error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> }
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

    const { id, entryId } = await params

    const schedule = await db.schedule.findUnique({ where: { id } })
    if (!schedule) {
      return NextResponse.json(apiError("Schedule not found"), { status: 400 })
    }

    const entry = await db.scheduleEntry.findUnique({ where: { id: entryId } })
    if (!entry) {
      return NextResponse.json(apiError("Entry not found"), { status: 404 })
    }

    // Only DRAFT schedules can be modified by Dept Chair
    // Program Chairs can delete their own entries on PUBLISHED schedules
    if (dbUser.role === "SUPER_ADMIN" && schedule.status === "DRAFT") {
      // OK
    } else if (dbUser.role === "ADMIN" && schedule.status === "PUBLISHED") {
      // Program Chair can only delete entries they personally created
      if (!entry.createdBy || entry.createdBy !== dbUser.id) {
        return NextResponse.json(
          apiError("You can only delete entries you created. Department Chair entries are read-only."),
          { status: 403 }
        )
      }
    } else {
      return NextResponse.json(apiError("You don't have permission to modify this schedule"), { status: 403 })
    }

    await db.scheduleEntry.delete({ where: { id: entryId, scheduleId: id } })

    return NextResponse.json(apiResponse({ deleted: true }))
  } catch (error) {
    console.error("DELETE /api/schedules/[id]/entries/[entryId] error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}
