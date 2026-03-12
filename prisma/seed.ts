import { PrismaClient } from "./generated/prisma/client/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const db = new PrismaClient({ adapter })

async function main() {
  console.log("Seeding iSched database...")

  // 1. College
  const college = await db.college.upsert({
    where: { abbreviation: "SLSU" },
    update: {},
    create: { name: "Southern Luzon State University — Lucban Campus", abbreviation: "SLSU" },
  })
  console.log("  College created:", college.abbreviation)

  // 2. Departments
  const ccs = await db.department.upsert({
    where: { abbreviation_collegeId: { abbreviation: "CCS", collegeId: college.id } },
    update: {},
    create: { name: "College of Computing Studies", abbreviation: "CCS", collegeId: college.id },
  })
  const coed = await db.department.upsert({
    where: { abbreviation_collegeId: { abbreviation: "COED", collegeId: college.id } },
    update: {},
    create: { name: "College of Education", abbreviation: "COED", collegeId: college.id },
  })
  const cas = await db.department.upsert({
    where: { abbreviation_collegeId: { abbreviation: "CAS", collegeId: college.id } },
    update: {},
    create: { name: "College of Arts and Sciences", abbreviation: "CAS", collegeId: college.id },
  })
  console.log("  Departments created: CCS, COED, CAS")

  // 3. Programs
  const bsit = await db.program.create({
    data: { name: "Bachelor of Science in Information Technology", abbreviation: "BSIT", departmentId: ccs.id },
  })
  const bscs = await db.program.create({
    data: { name: "Bachelor of Science in Computer Science", abbreviation: "BSCS", departmentId: ccs.id },
  })
  const bsed = await db.program.create({
    data: { name: "Bachelor of Secondary Education", abbreviation: "BSED", departmentId: coed.id },
  })
  console.log("  Programs created: BSIT, BSCS, BSED")

  // 4. Year Levels + Sections
  for (const program of [bsit, bscs, bsed]) {
    for (let level = 1; level <= 4; level++) {
      const yl = await db.yearLevel.create({
        data: { level, programId: program.id },
      })
      const sectionName = `${program.abbreviation} ${level}-A`
      await db.section.create({
        data: { name: sectionName, yearLevelId: yl.id, capacity: 40 },
      })
    }
  }
  console.log("  Year levels & sections created")

  // 5. Buildings + Rooms
  const ccsBldg = await db.building.create({
    data: { name: "CCS Building", code: "CCS-BLDG" },
  })
  const coedBldg = await db.building.create({
    data: { name: "COED Building", code: "COED-BLDG" },
  })

  const roomsData = [
    { name: "Room 101", code: "CCS-101", buildingId: ccsBldg.id, type: "LECTURE_ROOM" as const, capacity: 40, equipment: ["Projector", "Whiteboard", "AC"] },
    { name: "Room 102", code: "CCS-102", buildingId: ccsBldg.id, type: "LECTURE_ROOM" as const, capacity: 45, equipment: ["Projector", "Whiteboard"] },
    { name: "Room 103", code: "CCS-103", buildingId: ccsBldg.id, type: "LECTURE_ROOM" as const, capacity: 40, equipment: ["Projector", "Whiteboard", "AC"] },
    { name: "Lab 201", code: "CCS-LAB-201", buildingId: ccsBldg.id, type: "COMPUTER_LAB" as const, capacity: 35, equipment: ["Computers", "Projector", "AC"] },
    { name: "Lab 202", code: "CCS-LAB-202", buildingId: ccsBldg.id, type: "COMPUTER_LAB" as const, capacity: 30, equipment: ["Computers", "AC"] },
    { name: "Lab 301", code: "CCS-LAB-301", buildingId: ccsBldg.id, type: "LABORATORY" as const, capacity: 30, equipment: ["Lab Equipment", "Projector"] },
    { name: "Room 201", code: "COED-201", buildingId: coedBldg.id, type: "LECTURE_ROOM" as const, capacity: 50, equipment: ["Projector", "Whiteboard", "AC"] },
    { name: "Room 202", code: "COED-202", buildingId: coedBldg.id, type: "LECTURE_ROOM" as const, capacity: 45, equipment: ["Projector", "Whiteboard"] },
  ]

  for (const r of roomsData) {
    await db.room.create({ data: r })
  }
  console.log("  Buildings & rooms created")

  // 6. Academic Year + Semester
  const ay = await db.academicYear.create({
    data: { label: "2025-2026", startYear: 2025, endYear: 2026, isCurrent: true },
  })
  await db.semester.create({
    data: {
      type: "FIRST",
      academicYearId: ay.id,
      startDate: new Date("2025-08-01"),
      endDate: new Date("2025-12-15"),
      isActive: true,
    },
  })
  await db.semester.create({
    data: {
      type: "SECOND",
      academicYearId: ay.id,
      startDate: new Date("2026-01-06"),
      endDate: new Date("2026-05-15"),
      isActive: false,
    },
  })
  console.log("  Academic year & semesters created")

  // 7. Subjects
  const subjectsData = [
    { code: "IT 101", title: "Introduction to Computing", units: 3, hoursPerWeek: 3, type: "LECTURE" as const, departmentId: ccs.id, requiredRoomType: ["LECTURE_ROOM" as const] },
    { code: "IT 102", title: "Computer Programming 1", units: 3, hoursPerWeek: 3, type: "LABORATORY" as const, departmentId: ccs.id, requiredRoomType: ["COMPUTER_LAB" as const] },
    { code: "IT 201", title: "Data Structures & Algorithms", units: 3, hoursPerWeek: 3, type: "LECTURE" as const, departmentId: ccs.id, requiredRoomType: ["LECTURE_ROOM" as const] },
    { code: "IT 202", title: "Object-Oriented Programming", units: 3, hoursPerWeek: 3, type: "LABORATORY" as const, departmentId: ccs.id, requiredRoomType: ["COMPUTER_LAB" as const] },
    { code: "IT 301", title: "Web Development", units: 3, hoursPerWeek: 3, type: "HYBRID" as const, departmentId: ccs.id, requiredRoomType: ["LECTURE_ROOM" as const, "COMPUTER_LAB" as const] },
    { code: "IT 302", title: "Database Management Systems", units: 3, hoursPerWeek: 3, type: "LECTURE" as const, departmentId: ccs.id, requiredRoomType: ["LECTURE_ROOM" as const] },
    { code: "GE 101", title: "Understanding the Self", units: 3, hoursPerWeek: 3, type: "LECTURE" as const, departmentId: cas.id, requiredRoomType: ["LECTURE_ROOM" as const] },
    { code: "GE 102", title: "Readings in Philippine History", units: 3, hoursPerWeek: 3, type: "LECTURE" as const, departmentId: cas.id, requiredRoomType: ["LECTURE_ROOM" as const] },
    { code: "ED 101", title: "Foundations of Education", units: 3, hoursPerWeek: 3, type: "LECTURE" as const, departmentId: coed.id, requiredRoomType: ["LECTURE_ROOM" as const] },
    { code: "ED 102", title: "Principles of Teaching", units: 3, hoursPerWeek: 3, type: "LECTURE" as const, departmentId: coed.id, requiredRoomType: ["LECTURE_ROOM" as const] },
  ]

  for (const s of subjectsData) {
    await db.subject.create({ data: s })
  }
  console.log("  Subjects created")

  console.log("\nSeed complete!")
}

main()
  .catch((e) => {
    console.error("Seed error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
