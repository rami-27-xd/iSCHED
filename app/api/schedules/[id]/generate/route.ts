import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { SchedulingEngine } from "@/lib/services/scheduler"
import { apiResponse, apiError } from "@/lib/api-helpers"

export async function POST(
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
      include: { semester: true },
    })

    if (!schedule) {
      return NextResponse.json(apiError("Schedule not found"), { status: 404 })
    }

    // Fetch all required data
    const [subjects, faculty, rooms, sections] = await Promise.all([
      db.subject.findMany({ include: { department: true } }),
      db.faculty.findMany({
        where: { isActive: true },
        include: {
          user: true,
          availability: {
            where: { semesterId: schedule.semesterId },
          },
        },
      }),
      db.room.findMany({ where: { isActive: true } }),
      db.section.findMany(),
    ])

    // Transform data for engine
    const subjectInputs = subjects.map((s: any) => ({
      id: s.id,
      code: s.code,
      hoursPerWeek: s.hoursPerWeek,
      type: s.type as "LECTURE" | "LABORATORY" | "HYBRID",
      requiredRoomType: s.requiredRoomType.map(String),
      units: s.units,
    }))

    const facultyInputs = faculty.map((f: any) => ({
      id: f.id,
      name: `${f.user.firstName} ${f.user.lastName}`,
      specializations: f.specializations,
      maxUnitsPerWeek: f.maxUnitsPerWeek,
      availability: f.availability.map((a: any) => ({
        day: a.day as any,
        startTime: a.startTime,
        endTime: a.endTime,
      })),
    }))

    const roomInputs = rooms.map((r: any) => ({
      id: r.id,
      code: r.code,
      type: r.type,
      capacity: r.capacity,
    }))

    const sectionInputs = sections.map((s: any) => ({
      id: s.id,
      name: s.name,
      capacity: s.capacity,
    }))

    // Run the scheduling engine
    const engine = new SchedulingEngine(
      subjectInputs,
      facultyInputs,
      roomInputs,
      sectionInputs
    )

    const assignments = await engine.generate()

    // Clear existing entries and save new ones
    await db.scheduleEntry.deleteMany({ where: { scheduleId: id } })
    await db.conflictLog.deleteMany({ where: { scheduleId: id } })

    // Bulk insert new assignments
    await db.scheduleEntry.createMany({
      data: assignments.map((a: any) => ({
        scheduleId: id,
        subjectId: a.subjectId,
        facultyId: a.facultyId,
        roomId: a.roomId,
        sectionId: a.sectionId,
        day: a.day as any,
        startTime: a.startTime,
        endTime: a.endTime,
      })),
    })

    // Update schedule status
    await db.schedule.update({
      where: { id },
      data: {
        generatedAt: new Date(),
        status: "DRAFT",
      },
    })

    return NextResponse.json(
      apiResponse({
        entriesGenerated: assignments.length,
        generatedAt: new Date().toISOString(),
      })
    )
  } catch (error: any) {
    console.error("POST /api/schedules/[id]/generate error:", error)

    if (error.name === "SchedulingError") {
      return NextResponse.json(
        apiError(error.message),
        { status: 422 }
      )
    }

    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}
