import { NextResponse } from "next/server"
import { getAuthenticatedUser, getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { SchedulingEngine, SchedulingError } from "@/lib/services/scheduler"
import { apiResponse, apiError } from "@/lib/api-helpers"
import { createNotification } from "@/lib/notifications"

// Allow up to 60 seconds for schedule generation
export const maxDuration = 60

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
    if (!dbUser || dbUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        apiError("Only Department Chairpersons can generate schedules"),
        { status: 403 }
      )
    }

    const { id } = await params

    const schedule = await db.schedule.findUnique({
      where: { id },
      include: { semester: true },
    })

    if (!schedule) {
      return NextResponse.json(apiError("Schedule not found"), { status: 404 })
    }

    if (schedule.status !== "DRAFT") {
      return NextResponse.json(
        apiError("Can only generate for DRAFT schedules"),
        { status: 400 }
      )
    }

    const deptId = schedule.departmentId

    // ── Workflow State Lock ────────────────────────────────────────────────
    // The backtracking algorithm may only run after the Program Chairperson
    // has officially submitted the department's data for the semester.
    // This prevents the Department Chair from processing incomplete data sets.
    if (deptId) {
      const workflowState = await db.departmentWorkflowState.findUnique({
        where: {
          departmentId_semesterId: {
            departmentId: deptId,
            semesterId: schedule.semesterId,
          },
        },
        include: { department: true },
      })

      if (!workflowState || workflowState.status === "DRAFT") {
        return NextResponse.json(
          {
            success: false,
            error: "Schedule generation is locked",
            details: [
              `The Program Chairperson for "${workflowState?.department?.name ?? deptId}" has not yet submitted their semester data.`,
              "The Program Chair must set the department workflow status to SUBMITTED_TO_CHAIR before the algorithm can be executed.",
              "Go to: Department Settings → Workflow → Submit for Review",
            ],
            workflowStatus: workflowState?.status ?? "DRAFT",
          },
          { status: 403 }
        )
      }

      if (workflowState.status === "REJECTED") {
        return NextResponse.json(
          {
            success: false,
            error: "Department submission was rejected",
            details: [
              "The previous submission was rejected and sent back for revision.",
              workflowState.reviewNote
                ? `Rejection reason: ${workflowState.reviewNote}`
                : "No reason provided.",
              "The Program Chair must revise and resubmit before generation can proceed.",
            ],
            workflowStatus: "REJECTED",
          },
          { status: 403 }
        )
      }

      if (workflowState.status === "APPROVED") {
        return NextResponse.json(
          {
            success: false,
            error: "Schedule already approved",
            details: [
              "This department's schedule has already been approved for this semester.",
              "Archive the current schedule or create a new one to regenerate.",
            ],
            workflowStatus: "APPROVED",
          },
          { status: 409 }
        )
      }

      // Mark as UNDER_REVIEW the moment generation is triggered
      if (workflowState.status === "SUBMITTED_TO_CHAIR") {
        await db.departmentWorkflowState.update({
          where: { id: workflowState.id },
          data: {
            status: "UNDER_REVIEW",
            reviewedBy: dbUser.id,
            reviewedAt: new Date(),
          },
        })
      }
    }
    // ── End Workflow State Lock ────────────────────────────────────────────

    const [subjects, faculty, rooms, sections] = await Promise.all([
      db.subject.findMany({
        where: deptId ? { departmentId: deptId } : {},
        include: { department: true },
      }),
      db.faculty.findMany({
        where: {
          isActive: true,
          ...(deptId ? { departmentId: deptId } : {}),
        },
        include: {
          user: true,
          availability: { where: { semesterId: schedule.semesterId } },
          buildingAvailability: { where: { semesterId: schedule.semesterId } },
        },
      }),
      db.room.findMany({
        where: { isActive: true },
        include: { building: true },
      }),
      db.section.findMany({
        where: deptId
          ? { yearLevel: { program: { departmentId: deptId } } }
          : {},
        include: { yearLevel: { include: { program: true } } },
      }),
    ])

    // Transform data for the scheduling engine
    const subjectInputs = subjects.map((s: any) => ({
      id: s.id,
      code: s.code,
      title: s.title,
      hoursPerWeek: s.hoursPerWeek,
      type: s.type as "LECTURE" | "LABORATORY",
      requiredRoomType: s.requiredRoomType.map(String),
      units: s.units,
      departmentCode: s.department?.abbreviation,
      year: s.year ?? 1,
      requiredLabSpecialization: s.requiredLabSpecialization ?? null,
    }))

    const facultyInputs = faculty.map((f: any) => ({
      id: f.id,
      name: `${f.user.firstName} ${f.user.lastName}`,
      specializations: f.specializations,
      sectionCounts: (f.sectionCounts as Record<string, number>) ?? {},
      maxUnitsPerWeek: f.maxUnitsPerWeek,
      availability: f.availability.map((a: any) => ({
        day: a.day as any,
        startTime: a.startTime,
        endTime: a.endTime,
      })),
      // Collect the distinct building IDs this faculty can teach in this semester
      allowedBuildingIds: f.buildingAvailability.map((b: any) => b.buildingId),
    }))

    const roomInputs = rooms.map((r: any) => ({
      id: r.id,
      code: r.code,
      type: r.type,
      buildingId: r.building?.id ?? r.buildingId,
      buildingCode: r.building?.code,
      labSpecialization: r.labSpecialization ?? null,
    }))

    const sectionInputs = sections.map((s: any) => ({
      id: s.id,
      name: s.name,
      yearLevel: s.yearLevel?.level ?? 1,
    }))

    const facultyWithAvailability = facultyInputs.filter((f: any) => f.availability.length > 0)
    if (facultyWithAvailability.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No faculty have availability configured for this semester",
          details: [
            "Go to Faculty Availability and set available days/times for at least one faculty member",
            `Semester: ${schedule.semester?.type ?? "Unknown"}`,
            `Total faculty: ${facultyInputs.length} (none have availability set)`,
          ],
        },
        { status: 422 }
      )
    }

    const engine = new SchedulingEngine(
      subjectInputs,
      facultyInputs,
      roomInputs,
      sectionInputs
    )

    console.log(
      `[generate] Starting scheduler: ${subjectInputs.length} subjects, ` +
      `${facultyInputs.length} faculty (${facultyWithAvailability.length} with availability), ` +
      `${roomInputs.length} rooms, ${sectionInputs.length} sections`
    )

    let assignments: any[]
    try {
      assignments = await engine.generate()
    } catch (engineError: any) {
      if (engineError.name === "SchedulingError") throw engineError
      console.error("[generate] Unexpected engine error:", engineError)
      throw new SchedulingError("Scheduler encountered an unexpected error", [
        engineError.message ?? "Unknown error",
      ])
    }

    console.log(`[generate] Scheduler completed: ${assignments.length} entries generated`)

    // Persist results
    await db.scheduleEntry.deleteMany({ where: { scheduleId: id } })
    await db.conflictLog.deleteMany({ where: { scheduleId: id } })

    await db.scheduleEntry.createMany({
      data: assignments.map((a: any) => ({
        scheduleId: id,
        subjectId: a.subjectId,
        facultyId: a.facultyId,
        roomId: a.roomId,
        sectionId: a.sectionId,
        day: a.day as any,
        startTime: a.startTime,
        endTime: a.endTime,
        createdBy: dbUser.id,
      })),
    })

    await db.schedule.update({
      where: { id },
      data: { generatedAt: new Date(), status: "DRAFT" },
    })

    await createNotification({
      userId: dbUser.id,
      title: "Schedule Generated",
      message: `Backtracking algorithm completed. ${assignments.length} entries generated successfully.`,
      type: "schedule_generated",
      link: "/dashboard/schedules",
    })

    return NextResponse.json(
      apiResponse({
        entriesGenerated: assignments.length,
        generatedAt: new Date().toISOString(),
      })
    )
  } catch (error: any) {
    console.error("POST /api/schedules/[id]/generate error:", error)

    if (error.name === "SchedulingError") {
      let details = error.details ?? []
      if (details.length > 10) {
        const specIssues = details.filter((d: string) =>
          d.includes("No faculty specializations match")
        )
        const roomIssues = details.filter((d: string) =>
          d.includes("No rooms match required type") || d.includes("No rooms with lab specialization")
        )
        const buildingIssues = details.filter((d: string) =>
          d.includes("building availability")
        )
        const otherIssues = details.filter(
          (d: string) =>
            !d.includes("No faculty specializations match") &&
            !d.includes("No rooms match required type") &&
            !d.includes("No rooms with lab specialization") &&
            !d.includes("building availability")
        )
        const summary: string[] = []
        if (specIssues.length > 0) {
          summary.push(
            `${specIssues.length} subjects have no faculty with matching specializations. Update faculty specializations in the Faculty page.`
          )
        }
        if (roomIssues.length > 0) {
          summary.push(
            `${roomIssues.length} subjects have no compatible rooms. Check room types and lab specializations in Buildings / Rooms.`
          )
        }
        if (buildingIssues.length > 0) {
          summary.push(
            `${buildingIssues.length} subjects could not be placed due to building availability restrictions. Ensure faculty have buildings marked as available.`
          )
        }
        summary.push(...otherIssues)
        details = summary
      }
      return NextResponse.json(
        { success: false, error: error.message, details },
        { status: 422 }
      )
    }

    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}
