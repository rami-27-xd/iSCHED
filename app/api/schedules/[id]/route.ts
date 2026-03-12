import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { apiResponse, apiError } from "@/lib/api-helpers"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(apiError("Unauthorized"), { status: 401 })
    }

    const { id } = await params

    const schedule = await db.schedule.findUnique({
      where: { id },
      include: {
        semester: { include: { academicYear: true } },
        entries: {
          include: {
            subject: true,
            faculty: { include: { user: true } },
            room: true,
            section: true,
          },
        },
        conflicts: true,
      },
    })

    if (!schedule) {
      return NextResponse.json(apiError("Schedule not found"), { status: 404 })
    }

    return NextResponse.json(apiResponse(schedule))
  } catch (error) {
    console.error("GET /api/schedules/[id] error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(apiError("Unauthorized"), { status: 401 })
    }

    const { id } = await params
    const body = await req.json()

    const schedule = await db.schedule.update({
      where: { id },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.status === "PUBLISHED" ? { publishedAt: new Date() } : {}),
      },
    })

    return NextResponse.json(apiResponse(schedule))
  } catch (error) {
    console.error("PATCH /api/schedules/[id] error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(apiError("Unauthorized"), { status: 401 })
    }

    const { id } = await params

    await db.schedule.delete({ where: { id } })

    return NextResponse.json(apiResponse({ deleted: true }))
  } catch (error) {
    console.error("DELETE /api/schedules/[id] error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}
