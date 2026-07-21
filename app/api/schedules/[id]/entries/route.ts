import { NextResponse } from "next/server"
import { getAuthenticatedUser, getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiResponse, apiError } from "@/lib/api-helpers"
import { validateEntry } from "@/lib/services/entry-validation"
import { syncFacultySpecializations } from "@/lib/services/sync-specializations"
import { checkSubjectEditPermission } from "@/lib/services/subject-permissions"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json(apiError("Unauthorized"), { status: 401 })

    const dbUser = await getCurrentUser()
    if (!dbUser) return NextResponse.json(apiError("User not found"), { status: 404 })

    const { id } = await params
    const body = await req.json()

    const schedule = await db.schedule.findUnique({
      where: { id },
      include: { department: true },
    })
    if (!schedule) return NextResponse.json(apiError("Schedule not found"), { status: 404 })

    // SUPER_ADMIN (Dept Chair): can add entries at DRAFT, PENDING_APPROVAL, or PUBLISHED.
    //   DRAFT            — initial data entry before Program Chairs submit
    //   PENDING_APPROVAL — adding GEC/PATHFIT on top of Program Chairs' submitted entries
    //   PUBLISHED        — adding GEC/PATHFIT after the schedule is already live
    // ADMIN (Program Chair): can add entries on DRAFT only (their window is before submission).
    const canAdd =
      (dbUser.role === "SUPER_ADMIN" && ["DRAFT", "PENDING_APPROVAL", "PUBLISHED"].includes(schedule.status as string)) ||
      (dbUser.role === "ADMIN" && schedule.status === "DRAFT")

    if (!canAdd) {
      return NextResponse.json(
        apiError("You don't have permission to add entries to this schedule"),
        { status: 403 }
      )
    }

    // ── Subject ownership check ────────────────────────────────────────────
    // CAS cluster chairs may only place their own cluster's GEC codes/majors;
    // Program Chairs may only place their own program's subjects — never GEC.
    if (body.subjectId) {
      const permError = await checkSubjectEditPermission(dbUser, body.subjectId)
      if (permError) {
        return NextResponse.json(apiError(permError), { status: 403 })
      }
    }

    // ── Building restriction check ─────────────────────────────────────────
    // Verify the chosen room is in a building assigned to the schedule's department.
    if (body.roomId && schedule.departmentId) {
      const room = await db.room.findUnique({
        where: { id: body.roomId },
        select: { buildingId: true, name: true, code: true },
      })
      if (room) {
        const mapping = await db.departmentBuilding.findFirst({
          where: {
            departmentId: schedule.departmentId,
            buildingId: room.buildingId,
          },
        })
        // Only enforce if the department has any building mappings
        const deptHasMappings = await db.departmentBuilding.count({
          where: { departmentId: schedule.departmentId },
        })
        if (deptHasMappings > 0 && !mapping) {
          return NextResponse.json(
            apiError(`Room "${room.code}" is in a building not assigned to this department. Choose a room from an approved building.`),
            { status: 409 }
          )
        }
      }
    }

    // ── Validate scheduling constraints (conflicts) ────────────────────────
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

    // ── Persist ────────────────────────────────────────────────────────────
    const entry = await db.scheduleEntry.create({
      data: {
        scheduleId: id,
        subjectId: body.subjectId,
        facultyId: body.facultyId,
        // Store the free-text faculty name override when provided
        facultyName: body.facultyName?.trim() || null,
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
        room: { include: { building: true } },
        section: true,
      },
    })

    // Auto-clear any unassigned queue entry for this subject+section pair
    await db.unassignedEntry.deleteMany({
      where: { scheduleId: id, subjectId: body.subjectId, sectionId: body.sectionId },
    })

    // Keep faculty specializations in sync with their actual assignments
    if (body.facultyId) {
      await syncFacultySpecializations(body.facultyId).catch(() => {})
    }

    return NextResponse.json(apiResponse(entry), { status: 201 })
  } catch (error) {
    console.error("POST /api/schedules/[id]/entries error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}
