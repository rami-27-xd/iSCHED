import { NextResponse } from "next/server"
import { getAuthenticatedUser, getCurrentUser, getUserDepartmentId } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiResponse, apiError } from "@/lib/api-helpers"

export async function GET(req: Request) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json(apiError("Unauthorized"), { status: 401 })
    }

    const dbUser = await getCurrentUser()
    const departmentId = getUserDepartmentId(dbUser)

    const { searchParams } = new URL(req.url)
    const semesterId = searchParams.get("semesterId")
    const status = searchParams.get("status")
    const isArchived = searchParams.get("isArchived") === "true"

    // Build where clause
    const where: any = {
      isArchived,
      ...(semesterId ? { semesterId } : {}),
      ...(status ? { status: status as any } : {}),
    }

    if (dbUser?.role === "ADMIN") {
      // ADMIN (Program Chair): sees PUBLISHED schedules from ANY department
      // because the Dept Chair (e.g. CAS) adds GEC entries for sections across all departments.
      // Entry-level filtering in GET /api/schedules/[id] scopes entries to their program.
      where.status = "PUBLISHED"
    } else {
      // SUPER_ADMIN / FACULTY: scope to own department
      if (departmentId) {
        where.departmentId = departmentId
      }
    }

    const schedules = await db.schedule.findMany({
      where,
      include: {
        semester: {
          include: { academicYear: true },
        },
        department: true,
        _count: {
          select: { entries: true, conflicts: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(apiResponse(schedules))
  } catch (error) {
    console.error("GET /api/schedules error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json(apiError("Unauthorized"), { status: 401 })
    }

    const dbUser = await getCurrentUser()
    if (!dbUser) {
      return NextResponse.json(apiError("User not found"), { status: 404 })
    }

    // Only SUPER_ADMIN (Department Chair) can create schedules
    if (dbUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(apiError("Only Department Chairs can create schedules"), { status: 403 })
    }

    const departmentId = getUserDepartmentId(dbUser)
    if (!departmentId) {
      return NextResponse.json(apiError("You must be assigned to a department to create schedules"), { status: 400 })
    }

    const body = await req.json()
    const { semesterType, schoolYear, startDate: startDateStr, endDate: endDateStr } = body

    if (!semesterType || !schoolYear) {
      return NextResponse.json(apiError("Semester type and school year are required"), { status: 400 })
    }

    // Parse school year
    const [startYear, endYear] = schoolYear.split("-").map(Number)
    if (!startYear || !endYear) {
      return NextResponse.json(apiError("Invalid school year format. Use YYYY-YYYY"), { status: 400 })
    }

    // Find or create academic year
    let academicYear = await db.academicYear.findUnique({
      where: { label: schoolYear },
    })
    if (!academicYear) {
      academicYear = await db.academicYear.create({
        data: { label: schoolYear, startYear, endYear, isCurrent: false },
      })
    }

    // Find or create semester
    let semester = await db.semester.findUnique({
      where: { type_academicYearId: { type: semesterType, academicYearId: academicYear.id } },
    })
    if (!semester) {
      const startDate = startDateStr
        ? new Date(startDateStr)
        : semesterType === "FIRST" ? new Date(`${startYear}-08-01`) : new Date(`${endYear}-01-06`)
      const endDate = endDateStr
        ? new Date(endDateStr)
        : semesterType === "FIRST" ? new Date(`${startYear}-12-15`) : new Date(`${endYear}-05-15`)
      semester = await db.semester.create({
        data: {
          type: semesterType,
          academicYearId: academicYear.id,
          startDate,
          endDate,
          isActive: false,
        },
      })
    } else if (startDateStr && endDateStr) {
      semester = await db.semester.update({
        where: { id: semester.id },
        data: {
          startDate: new Date(startDateStr),
          endDate: new Date(endDateStr),
        },
      })
    }

    const schedule = await db.schedule.create({
      data: {
        semesterId: semester.id,
        departmentId,
        createdBy: dbUser.id,
      },
      include: {
        semester: { include: { academicYear: true } },
        department: true,
        _count: { select: { entries: true } },
      },
    })

    return NextResponse.json(apiResponse(schedule), { status: 201 })
  } catch (error) {
    console.error("POST /api/schedules error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}
