import { NextResponse } from "next/server"
import { getAuthenticatedUser, getCurrentUser, getUserDepartmentId } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiResponse, apiError } from "@/lib/api-helpers"

export async function GET(_req: Request) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json(apiError("Unauthorized"), { status: 401 })

    const dbUser = await getCurrentUser()
    const departmentId = getUserDepartmentId(dbUser)
    const role = dbUser?.role ?? "FACULTY"

    // Build schedule filters: role-based
    const scheduleWhere: any = { isArchived: false }
    if (role === "ADMIN") {
      // Program Chair: see PUBLISHED schedules from any department
      // (CAS Dept Chair adds GEC entries for all programs)
      scheduleWhere.status = "PUBLISHED"
    } else {
      // SUPER_ADMIN / FACULTY: scope to own department
      if (departmentId) scheduleWhere.departmentId = departmentId
    }

    const [
      scheduleCount,
      facultyCount,
      roomCount,
      conflictCount,
      recentSchedules,
    ] = await Promise.all([
      db.schedule.count({ where: scheduleWhere }),
      db.faculty.count({ where: { isActive: true, ...(departmentId ? { departmentId } : {}) } }),
      db.room.count({ where: { isActive: true } }),
      db.conflictLog.count({ where: { resolved: false } }),
      db.schedule.findMany({
        where: scheduleWhere,
        include: {
          semester: { include: { academicYear: true } },
          _count: { select: { entries: true, conflicts: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
    ])

    return NextResponse.json(apiResponse({
      stats: {
        activeSchedules: scheduleCount,
        totalFaculty: facultyCount,
        availableRooms: roomCount,
        conflictsDetected: conflictCount,
      },
      recentSchedules,
      userRole: role,
    }))
  } catch (error) {
    console.error("GET /api/analytics/dashboard error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}
