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
    const semesterId = searchParams.get("semesterId")
    const status = searchParams.get("status")

    const schedules = await db.schedule.findMany({
      where: {
        ...(semesterId ? { semesterId } : {}),
        ...(status ? { status: status as any } : {}),
      },
      include: {
        semester: {
          include: { academicYear: true },
        },
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
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(apiError("Unauthorized"), { status: 401 })
    }

    const body = await req.json()
    const { semesterId } = body

    if (!semesterId) {
      return NextResponse.json(apiError("semesterId is required"), { status: 400 })
    }

    const schedule = await db.schedule.create({
      data: {
        semesterId,
        status: "DRAFT",
        createdBy: userId,
      },
    })

    return NextResponse.json(apiResponse(schedule), { status: 201 })
  } catch (error) {
    console.error("POST /api/schedules error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}
