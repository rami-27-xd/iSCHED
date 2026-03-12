import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { apiResponse, apiError } from "@/lib/api-helpers"

export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(apiError("Unauthorized"), { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const departmentId = searchParams.get("departmentId")

    const faculty = await db.faculty.findMany({
      where: {
        ...(departmentId ? { departmentId } : {}),
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
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(apiError("Unauthorized"), { status: 401 })
    }

    const body = await req.json()
    const { userId: facultyUserId, departmentId, employeeId, specializations, maxUnitsPerWeek } = body

    const faculty = await db.faculty.create({
      data: {
        userId: facultyUserId,
        departmentId,
        employeeId,
        specializations: specializations ?? [],
        maxUnitsPerWeek: maxUnitsPerWeek ?? 21,
      },
      include: { user: true, department: true },
    })

    return NextResponse.json(apiResponse(faculty), { status: 201 })
  } catch (error) {
    console.error("POST /api/faculty error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}
