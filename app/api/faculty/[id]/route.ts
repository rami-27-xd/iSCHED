import { NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiResponse, apiError } from "@/lib/api-helpers"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json(apiError("Unauthorized"), { status: 401 })

    const { id } = await params
    const faculty = await db.faculty.findUnique({
      where: { id },
      include: {
        user: true,
        department: true,
        availability: true,
        _count: { select: { scheduleEntries: true, teachingLoads: true } },
      },
    })

    if (!faculty) return NextResponse.json(apiError("Faculty not found"), { status: 404 })
    return NextResponse.json(apiResponse(faculty))
  } catch (error) {
    console.error("GET /api/faculty/[id] error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json(apiError("Unauthorized"), { status: 401 })

    const { id } = await params
    const body = await req.json()
    const { employeeId, departmentId, specializations, sectionCounts, maxUnitsPerWeek, isActive, firstName, lastName } = body

    const faculty = await db.faculty.update({
      where: { id },
      data: {
        ...(employeeId !== undefined ? { employeeId } : {}),
        ...(departmentId !== undefined ? { departmentId } : {}),
        ...(specializations !== undefined ? { specializations } : {}),
        ...(sectionCounts !== undefined ? { sectionCounts } : {}),
        ...(maxUnitsPerWeek !== undefined ? { maxUnitsPerWeek: Number(maxUnitsPerWeek) } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      include: { user: true, department: true },
    })

    // Update the linked User record if firstName or lastName provided
    if ((firstName !== undefined || lastName !== undefined) && faculty.userId) {
      await db.user.update({
        where: { id: faculty.userId },
        data: {
          ...(firstName !== undefined ? { firstName } : {}),
          ...(lastName !== undefined ? { lastName } : {}),
        },
      })
    }

    // Re-fetch with updated user data
    const updated = await db.faculty.findUnique({
      where: { id },
      include: { user: true, department: true },
    })

    return NextResponse.json(apiResponse(updated))
  } catch (error: any) {
    if (error?.code === "P2025") return NextResponse.json(apiError("Faculty not found"), { status: 404 })
    console.error("PATCH /api/faculty/[id] error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json(apiError("Unauthorized"), { status: 401 })

    const { id } = await params
    await db.faculty.delete({ where: { id } })
    return NextResponse.json(apiResponse({ deleted: true }))
  } catch (error: any) {
    if (error?.code === "P2025") return NextResponse.json(apiError("Faculty not found"), { status: 404 })
    console.error("DELETE /api/faculty/[id] error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}
