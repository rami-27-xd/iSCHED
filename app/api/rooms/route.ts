import { NextResponse } from "next/server"
import { getAuthenticatedUser, getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiResponse, apiError } from "@/lib/api-helpers"

export async function GET(req: Request) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
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
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json(apiError("Unauthorized"), { status: 401 })
    }

    // Only SUPER_ADMIN and ADMIN can create rooms
    const dbUser = await getCurrentUser()
    if (!dbUser || !["SUPER_ADMIN", "ADMIN"].includes(dbUser.role)) {
      return NextResponse.json(apiError("Forbidden — insufficient permissions"), { status: 403 })
    }

    const body = await req.json()
    const { name, code, buildingId, type, equipment } = body

    const room = await db.room.create({
      data: {
        name,
        code,
        buildingId,
        type,
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
