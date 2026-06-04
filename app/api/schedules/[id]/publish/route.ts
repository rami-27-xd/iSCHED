import { NextResponse } from "next/server"
import { getAuthenticatedUser, getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { detectConflicts } from "@/lib/services/conflicts"
import { apiResponse, apiError } from "@/lib/api-helpers"
import { notifyAllSuperAdmins } from "@/lib/notifications"

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
    if (!dbUser || !["SUPER_ADMIN", "ADMIN"].includes(dbUser.role)) {
      return NextResponse.json(apiError("Only Department Chairs and Program Chairs can publish schedules"), { status: 403 })
    }

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
            section: true,
          },
        },
      },
    })

    if (!schedule) {
      return NextResponse.json(apiError("Schedule not found"), { status: 404 })
    }

    // ADMIN (Program Chair) can only notify on an already-PUBLISHED schedule
    // SUPER_ADMIN (Dept Chair) can publish from DRAFT or PENDING_APPROVAL
    if (dbUser.role === "ADMIN") {
      if (schedule.status !== "PUBLISHED") {
        return NextResponse.json(apiError("Program Chairs can only notify faculty on published schedules"), { status: 400 })
      }
    } else {
      if (schedule.status !== "DRAFT" && schedule.status !== "PENDING_APPROVAL") {
        return NextResponse.json(apiError("Schedule must be in DRAFT or PENDING_APPROVAL status"), { status: 400 })
      }
    }

    if (schedule.entries.length === 0) {
      return NextResponse.json(apiError("Cannot publish a schedule with no entries"), { status: 400 })
    }

    // Block publish if any entry has an inactive faculty
    const inactiveEntries = schedule.entries.filter((e: any) =>
      e.faculty?.isActive === false || e.faculty?.user?.isActive === false
    )
    if (inactiveEntries.length > 0) {
      const names = inactiveEntries.map((e: any) =>
        `${e.faculty?.user?.firstName ?? ""} ${e.faculty?.user?.lastName ?? ""}`.trim()
      )
      const unique = [...new Set(names)].join(", ")
      return NextResponse.json(
        apiError(`Cannot publish: inactive faculty assigned to entries — ${unique}. Remove or replace these entries first.`),
        { status: 422 }
      )
    }

    // ADMIN (Program Chair): skip conflict detection, just notify faculty of their added entries
    if (dbUser.role === "ADMIN") {
      // Notify faculty who have entries created by this program chair
      const affectedFacultyIds = new Set(
        schedule.entries
          .filter((e: any) => e.createdBy === dbUser.id)
          .map((e: any) => e.facultyId)
      )
      for (const facultyId of affectedFacultyIds) {
        const facultyRecord = await db.faculty.findUnique({
          where: { id: facultyId },
          select: { userId: true },
        })
        if (facultyRecord?.userId) {
          await db.notification.create({
            data: {
              userId: facultyRecord.userId,
              title: "Schedule Updated",
              message: `Your schedule for ${schedule.semester?.type === "FIRST" ? "1st" : schedule.semester?.type === "SECOND" ? "2nd" : "Summer"} Semester ${schedule.semester?.academicYear?.label ?? ""} has been updated by the Program Chair.`,
              type: "schedule_published",
              link: "/dashboard/my-schedule",
            },
          })
        }
      }
      return NextResponse.json(apiResponse({ published: true, notified: affectedFacultyIds.size }))
    }

    // Run conflict detection
    const conflictEntries = schedule.entries.map((e: any) => ({
      id: e.id,
      day: e.day,
      startTime: e.startTime,
      endTime: e.endTime,
      subjectId: e.subjectId,
      subjectCode: e.subject.code,
      subjectType: e.subject.type,
      subjectUnits: e.subject.units,
      facultyId: e.facultyId,
      facultyName: `${e.faculty.user.firstName} ${e.faculty.user.lastName}`,
      facultyMaxUnits: e.faculty.maxUnitsPerWeek,
      roomId: e.roomId,
      roomCode: e.room.code,
      sectionId: e.sectionId,
      sectionName: e.section.name,
      sectionCapacity: e.section.capacity,
    }))

    const conflicts = detectConflicts(conflictEntries)

    const errorConflicts = conflicts.filter((c: any) => c.severity === 'ERROR')
    const warningConflicts = conflicts.filter((c: any) => c.severity === 'WARNING')

    // Block publish if there are ERROR-level conflicts
    if (errorConflicts.length > 0) {
      await db.conflictLog.deleteMany({ where: { scheduleId: id } })
      await db.conflictLog.createMany({
        data: conflicts.map((c: any) => ({
          scheduleId: id,
          type: c.type,
          description: c.description,
          entityIds: c.entityIds ?? [],
        })),
      })

      return NextResponse.json(
        apiResponse({
          published: false,
          errors: errorConflicts,
          warnings: warningConflicts,
        }),
        { status: 422 }
      )
    }

    // Publish the schedule
    const updated = await db.schedule.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    })

    // Notify all super admins in same department
    await notifyAllSuperAdmins(
      "Schedule Published",
      `A schedule for ${schedule.semester?.type === "FIRST" ? "1st" : "2nd"} Semester ${schedule.semester?.academicYear?.label ?? ""} has been published.`,
      "schedule_published",
      "/dashboard/schedules"
    )

    // Notify all Program Chairs in the same department
    if (schedule.departmentId) {
      // Find all programs in this department
      const programs = await db.program.findMany({
        where: { departmentId: schedule.departmentId },
        include: { head: { include: { user: true } } },
      })

      // Notify each Program Chair
      for (const program of programs) {
        if (program.head?.userId) {
          await db.notification.create({
            data: {
              userId: program.head.userId,
              title: "Schedule Published — Ready for Review",
              message: `The Department Chair has published the ${schedule.semester?.type === "FIRST" ? "1st" : "2nd"} Semester ${schedule.semester?.academicYear?.label ?? ""} schedule for ${schedule.department?.name ?? "your department"}. You can now view and edit it.`,
              type: "schedule_published",
              link: "/dashboard/schedules",
            },
          })
        }
      }
    }

    // Clear old conflicts and save warnings
    await db.conflictLog.deleteMany({ where: { scheduleId: id } })
    if (warningConflicts.length > 0) {
      await db.conflictLog.createMany({
        data: warningConflicts.map((c: any) => ({
          scheduleId: id,
          type: c.type,
          description: c.description,
          entityIds: c.entityIds ?? [],
        })),
      })
    }

    return NextResponse.json(
      apiResponse({
        published: true,
        schedule: updated,
        warnings: warningConflicts,
      })
    )
  } catch (error) {
    console.error("POST /api/schedules/[id]/publish error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}
