import { NextResponse } from "next/server"
import { getAuthenticatedUser, getCurrentUser, getUserDepartmentId } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiResponse, apiError } from "@/lib/api-helpers"
import { notifyAllSuperAdmins } from "@/lib/notifications"

export async function GET(req: Request) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json(apiError("Unauthorized"), { status: 401 })
    }

    const dbUser = await getCurrentUser()
    const userDeptId = getUserDepartmentId(dbUser)

    const { searchParams } = new URL(req.url)
    const departmentId = searchParams.get("departmentId")

    // Determine which department to filter by:
    // 1. Explicit query param takes priority
    // 2. Otherwise, auto-filter by user's department (department isolation)
    const effectiveDeptId = departmentId || userDeptId

    const faculty = await db.faculty.findMany({
      where: {
        isActive: true, // only active faculty
        user: { isActive: true }, // also check user account is active
        ...(effectiveDeptId ? { departmentId: effectiveDeptId } : {}),
      },
      include: {
        user: true,
        department: true,
        _count: { select: { scheduleEntries: true, teachingLoads: true } },
      },
      orderBy: { user: { lastName: "asc" } },
    })

    return NextResponse.json(apiResponse(faculty))
  } catch (error) {
    console.error("GET /api/faculty error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json(apiError("Unauthorized"), { status: 401 })
    }

    // Only SUPER_ADMIN and ADMIN can add faculty
    const dbUser = await getCurrentUser()
    if (!dbUser || !["SUPER_ADMIN", "ADMIN"].includes(dbUser.role)) {
      return NextResponse.json(apiError("Forbidden — insufficient permissions"), { status: 403 })
    }

    const body = await req.json()
    const { userId, firstName, lastName, employeeId: providedEmployeeId, departmentId, specializations, sectionCounts, maxUnitsPerWeek } = body

    if (!departmentId) {
      return NextResponse.json(apiError("Department is required"), { status: 400 })
    }

    // Auto-generate employeeId if not provided
    const employeeId = providedEmployeeId || `FAC-${Date.now()}`

    // Check for duplicate employeeId only if explicitly provided
    if (providedEmployeeId) {
      const existingFaculty = await db.faculty.findUnique({ where: { employeeId } })
      if (existingFaculty) {
        return NextResponse.json(apiError("A faculty member with this Employee ID already exists"), { status: 409 })
      }
    }

    let targetUserId: string

    if (userId) {
      // Link to an existing user
      const existingUser = await db.user.findUnique({ where: { id: userId } })
      if (!existingUser) {
        return NextResponse.json(apiError("User not found"), { status: 404 })
      }
      // Check if user is already linked to a faculty record
      const existingFacultyForUser = await db.faculty.findUnique({ where: { userId } })
      if (existingFacultyForUser) {
        return NextResponse.json(apiError("This user is already a faculty member"), { status: 409 })
      }
      // Do NOT change the user's role — a Department Chair or Program Chair
      // can also be assigned as faculty without losing their admin role
      targetUserId = userId
    } else if (firstName && lastName) {
      // Legacy: create a new user record for manually added faculty
      const newUser = await db.user.create({
        data: {
          supabaseId: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          email: `${employeeId.toLowerCase().replace(/[^a-z0-9]/g, '')}@faculty.slsu.edu.ph`,
          firstName,
          lastName,
          role: "FACULTY",
          isApproved: true,
        },
      })
      targetUserId = newUser.id
    } else {
      return NextResponse.json(apiError("Either userId or firstName/lastName are required"), { status: 400 })
    }

    const faculty = await db.faculty.create({
      data: {
        userId: targetUserId,
        departmentId,
        employeeId,
        specializations: specializations ?? [],
        sectionCounts: sectionCounts ?? {},
        maxUnitsPerWeek: maxUnitsPerWeek ?? 21,
      },
      include: { user: true, department: true },
    })

    const facName = `${faculty.user?.firstName ?? ""} ${faculty.user?.lastName ?? ""}`

    // Notify all super admins about new faculty
    await notifyAllSuperAdmins(
      "Faculty Added",
      `${facName} (${employeeId}) has been added as faculty in ${faculty.department?.abbreviation ?? "a department"}.`,
      "faculty_added",
      "/dashboard/faculty"
    )

    return NextResponse.json(apiResponse(faculty), { status: 201 })
  } catch (error) {
    console.error("POST /api/faculty error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}
