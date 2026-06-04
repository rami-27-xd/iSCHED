import { NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiResponse, apiError } from "@/lib/api-helpers"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json(apiError("Unauthorized"), { status: 401 })

    const { id } = await params
    const room = await db.room.findUnique({
      where: { id },
      include: { building: true, _count: { select: { scheduleEntries: true } } },
    })

    if (!room) return NextResponse.json(apiError("Room not found"), { status: 404 })
    return NextResponse.json(apiResponse(room))
  } catch (error) {
    console.error("GET /api/rooms/[id] error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json(apiError("Unauthorized"), { status: 401 })

    const { id } = await params
    const body = await req.json()
    const { name, code, buildingId, type, capacity, equipment, isActive } = body

    const room = await db.room.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(code !== undefined ? { code } : {}),
        ...(buildingId !== undefined ? { buildingId } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(capacity !== undefined ? { capacity: Number(capacity) } : {}),
        ...(equipment !== undefined ? { equipment } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      include: { building: true },
    })

    return NextResponse.json(apiResponse(room))
  } catch (error: any) {
    if (error?.code === "P2025") return NextResponse.json(apiError("Room not found"), { status: 404 })
    console.error("PATCH /api/rooms/[id] error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json(apiError("Unauthorized"), { status: 401 })

    const { id } = await params
    await db.room.delete({ where: { id } })
    return NextResponse.json(apiResponse({ deleted: true }))
  } catch (error: any) {
    if (error?.code === "P2025") return NextResponse.json(apiError("Room not found"), { status: 404 })
    console.error("DELETE /api/rooms/[id] error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}
