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
        departments: {
          include: {
            department: {
              select: { id: true, name: true, abbreviation: true },
            },
          },
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
    const { name, code, restrictedDepartmentIds } = body

    if (!name) {
      return NextResponse.json(apiError("Building name is required"), { status: 400 })
    }

    const created = await db.building.create({
      data: {
        name,
        code: code ?? name.toUpperCase().replace(/\s+/g, "-").slice(0, 10),
      },
    })

    // Associate department restrictions if provided
    if (Array.isArray(restrictedDepartmentIds) && restrictedDepartmentIds.length > 0) {
      await db.departmentBuilding.createMany({
        data: (restrictedDepartmentIds as string[]).map((departmentId) => ({
          departmentId,
          buildingId: created.id,
        })),
        skipDuplicates: true,
      })
    }

    const building = await db.building.findUnique({
      where: { id: created.id },
      include: {
        rooms: { orderBy: { code: "asc" } },
        departments: {
          include: {
            department: { select: { id: true, name: true, abbreviation: true } },
          },
        },
        _count: { select: { rooms: true } },
      },
    })

    return NextResponse.json(apiResponse(building), { status: 201 })
  } catch (error) {
    console.error("POST /api/buildings error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json(apiError("Unauthorized"), { status: 401 })

    const dbUser = await getCurrentUser()
    if (!dbUser || !["SUPER_ADMIN", "ADMIN"].includes(dbUser.role)) {
      return NextResponse.json(apiError("Forbidden — insufficient permissions"), { status: 403 })
    }

    const body = await req.json()
    const { id, name, code, isActive, restrictedDepartmentIds } = body

    if (!id) return NextResponse.json(apiError("Building id is required"), { status: 400 })

    await db.building.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(code !== undefined ? { code } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    })

    // Sync department restrictions only when explicitly provided
    if (Array.isArray(restrictedDepartmentIds)) {
      await db.departmentBuilding.deleteMany({ where: { buildingId: id } })
      if ((restrictedDepartmentIds as string[]).length > 0) {
        await db.departmentBuilding.createMany({
          data: (restrictedDepartmentIds as string[]).map((departmentId) => ({
            departmentId,
            buildingId: id,
          })),
          skipDuplicates: true,
        })
      }
    }

    const building = await db.building.findUnique({
      where: { id },
      include: {
        rooms: { orderBy: { code: "asc" } },
        departments: {
          include: {
            department: { select: { id: true, name: true, abbreviation: true } },
          },
        },
        _count: { select: { rooms: true } },
      },
    })

    return NextResponse.json(apiResponse(building))
  } catch (error) {
    console.error("PATCH /api/buildings error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}
