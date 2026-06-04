import { NextResponse } from "next/server"
import { getAuthenticatedUser, getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiResponse, apiError } from "@/lib/api-helpers"

export async function GET(_req: Request) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json(apiError("Unauthorized"), { status: 401 })

    const buildings = await db.building.findMany({
      include: {
        rooms: {
          orderBy: { code: "asc" },
        },
        _count: { select: { rooms: true } },
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json(apiResponse(buildings))
  } catch (error) {
    console.error("GET /api/buildings error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json(apiError("Unauthorized"), { status: 401 })

    // Only SUPER_ADMIN and ADMIN can create buildings
    const dbUser = await getCurrentUser()
    if (!dbUser || !["SUPER_ADMIN", "ADMIN"].includes(dbUser.role)) {
      return NextResponse.json(apiError("Forbidden — insufficient permissions"), { status: 403 })
    }

    const body = await req.json()
    const { name, code } = body

    if (!name) {
      return NextResponse.json(apiError("Building name is required"), { status: 400 })
    }

    const building = await db.building.create({
      data: {
        name,
        code: code ?? name.toUpperCase().replace(/\s+/g, "-").slice(0, 10),
      },
      include: {
        rooms: true,
        _count: { select: { rooms: true } },
      },
    })

    return NextResponse.json(apiResponse(building), { status: 201 })
  } catch (error) {
    console.error("POST /api/buildings error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}
