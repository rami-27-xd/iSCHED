import { NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiResponse, apiError } from "@/lib/api-helpers"

export async function GET() {
  try {
    const supabaseUser = await getAuthenticatedUser()
    if (!supabaseUser) return NextResponse.json(apiError("Unauthorized"), { status: 401 })

    // Find the db user and their faculty record
    const user = await db.user.findUnique({
      where: { supabaseId: supabaseUser.id },
      include: { faculty: true },
    })

    if (!user?.faculty) {
      return NextResponse.json(apiResponse([]))
    }

    // Determine which schedule statuses this user can see:
    // - SUPER_ADMIN / ADMIN: can see DRAFT + PUBLISHED (they manage schedules)
    // - FACULTY: can only see PUBLISHED
    const isAdmin = user.role === "SUPER_ADMIN" || user.role === "ADMIN"

    // Get entries from non-archived schedules for this faculty
    const entries = await db.scheduleEntry.findMany({
      where: {
        facultyId: user.faculty.id,
        schedule: {
          status: isAdmin ? { in: ["DRAFT", "PUBLISHED"] } : "PUBLISHED",
          isArchived: false,
        },
      },
      include: {
        subject: true,
        room: { include: { building: true } },
        section: { include: { yearLevel: { include: { program: true } } } },
        schedule: { include: { semester: { include: { academicYear: true } }, department: true } },
      },
      orderBy: [{ day: "asc" }, { startTime: "asc" }],
    })

    return NextResponse.json(apiResponse(entries))
  } catch (error) {
    console.error("GET /api/faculty/my-schedule error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}
