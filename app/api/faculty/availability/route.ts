import { NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiResponse, apiError } from "@/lib/api-helpers"

// GET - List faculty availability (optionally filtered by facultyId, semesterId)
export async function GET(req: Request) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json(apiError("Unauthorized"), { status: 401 })

    const { searchParams } = new URL(req.url)
    const facultyId = searchParams.get("facultyId")
    const semesterId = searchParams.get("semesterId")

    const where: any = {}
    if (facultyId) where.facultyId = facultyId
    if (semesterId) where.semesterId = semesterId

    const availability = await db.facultyAvailability.findMany({
      where,
      include: {
        faculty: {
          include: { user: { select: { firstName: true, lastName: true, email: true } } },
        },
        semester: { include: { academicYear: true } },
      },
      orderBy: [{ faculty: { user: { lastName: "asc" } } }, { day: "asc" }, { startTime: "asc" }],
    })

    return NextResponse.json(apiResponse(availability))
  } catch (error) {
    console.error("GET /api/faculty/availability error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}

// POST - Create/update faculty availability
export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json(apiError("Unauthorized"), { status: 401 })

    const body = await req.json()
    const { facultyId, semesterId, slots } = body

    if (!facultyId || !semesterId || !Array.isArray(slots)) {
      return NextResponse.json(apiError("facultyId, semesterId, and slots[] are required"), { status: 400 })
    }

    // Delete existing availability for this faculty+semester
    await db.facultyAvailability.deleteMany({
      where: { facultyId, semesterId },
    })

    // Create new slots
    if (slots.length > 0) {
      await db.facultyAvailability.createMany({
        data: slots.map((slot: any) => ({
          facultyId,
          semesterId,
          day: slot.day,
          startTime: slot.startTime,
          endTime: slot.endTime,
        })),
      })
    }

    const updated = await db.facultyAvailability.findMany({
      where: { facultyId, semesterId },
      orderBy: [{ day: "asc" }, { startTime: "asc" }],
    })

    return NextResponse.json(apiResponse(updated), { status: 201 })
  } catch (error) {
    console.error("POST /api/faculty/availability error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}
