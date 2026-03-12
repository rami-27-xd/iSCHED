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
    const type = searchParams.get("type")
    const buildingId = searchParams.get("buildingId")

    const rooms = await db.room.findMany({
      where: {
        ...(type ? { type: type as any } : {}),
        ...(buildingId ? { buildingId } : {}),
      },
      include: {
        building: true,
        _count: { select: { scheduleEntries: true } },
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json(apiResponse(rooms))
  } catch (error) {
    console.error("GET /api/rooms error:", error)
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
    const { name, code, buildingId, type, capacity, equipment } = body

    const room = await db.room.create({
      data: {
        name,
        code,
        buildingId,
        type,
        capacity: capacity ?? 40,
        equipment: equipment ?? [],
      },
      include: { building: true },
    })

    return NextResponse.json(apiResponse(room), { status: 201 })
  } catch (error) {
    console.error("POST /api/rooms error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}
