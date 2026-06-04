import { NextResponse } from "next/server"
import { getAuthenticatedUser, getCurrentUser, getUserDepartmentId } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiResponse, apiError } from "@/lib/api-helpers"

// GEC/shared education subject prefixes
const GEC_PREFIXES = ["GEC", "GEL", "PATHFIT", "PATHFit", "NST"]

export async function GET(req: Request) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json(apiError("Unauthorized"), { status: 401 })
    }

    const dbUser = await getCurrentUser()
    const userDeptId = getUserDepartmentId(dbUser)
    const isSuperAdmin = dbUser?.role === "SUPER_ADMIN"

    // No semester filter — the curriculum map in the frontend handles
    // placing subjects at the correct year/semester per program.

    // Fetch ALL GEC/GEL/PATHFit/NST subjects (shared education subjects)
    const gecSubjects = await db.subject.findMany({
      where: {
        OR: GEC_PREFIXES.map(p => ({ code: { startsWith: p } })),
      },
      include: { yearLevel: true },
      orderBy: [{ year: "asc" }, { code: "asc" }],
    })

    if (isSuperAdmin) {
      // SUPER_ADMIN = Department Chair
      // - Own department (CAS): sees ALL subjects (GEC + CAS majors)
      // - Departments with subjects (CIT): sees their major subjects + GEC
      // - Departments without subjects: sees only GEC/PATHFit/NST
      const colleges = await db.college.findMany({
        include: {
          departments: {
            include: {
              programs: {
                include: {
                  yearLevels: {
                    include: { sections: true },
                    orderBy: { level: "asc" },
                  },
                },
                orderBy: { name: "asc" },
              },
              subjects: {
                include: { yearLevel: true },
                orderBy: [{ year: "asc" }, { code: "asc" }],
              },
            },
          },
        },
        orderBy: { abbreviation: "asc" },
      })

      // Department Chair: only show colleges/departments that have subjects or programs
      // Don't inject GEC subjects into other departments — they have no subjects of their own
      const filtered = colleges
        .map((college) => ({
          ...college,
          departments: college.departments.map((dept) => {
            // Own department: show all subjects as-is
            if (dept.id === userDeptId) return dept
            // Other departments: only show if they have their own subjects
            return { ...dept, subjects: dept.subjects }
          }).filter((dept) => dept.subjects.length > 0 || dept.programs.some((p: any) => p.yearLevels.length > 0)),
        }))
        .filter((college) => college.departments.length > 0)

      return NextResponse.json(apiResponse(filtered))
    } else {
      // ADMIN = Program Chairperson
      // Sees their own department's major subjects + GEC subjects for curriculum map display
      const colleges = await db.college.findMany({
        include: {
          departments: {
            ...(userDeptId ? { where: { id: userDeptId } } : {}),
            include: {
              programs: {
                include: {
                  yearLevels: {
                    include: { sections: true },
                    orderBy: { level: "asc" },
                  },
                },
                orderBy: { name: "asc" },
              },
              subjects: {
                include: { yearLevel: true },
                orderBy: [{ year: "asc" }, { code: "asc" }],
              },
            },
          },
        },
        orderBy: { abbreviation: "asc" },
      })

      const CAS_DEPT_ID = 'cmmzovtv10009qkvur7tude03'

      // CAS ADMIN: dept.subjects already has everything — no need to merge GEC
      // Other ADMIN: merge their major subjects with GEC subjects
      const filtered = colleges
        .filter((c) => c.departments.length > 0)
        .map((c) => ({
          ...c,
          departments: c.departments.map((dept) => ({
            ...dept,
            subjects: dept.id === CAS_DEPT_ID
              ? dept.subjects  // CAS already has all subjects
              : [...dept.subjects, ...gecSubjects.filter(g => !dept.subjects.some((s: any) => s.code === g.code))],
          })),
        }))

      return NextResponse.json(apiResponse(filtered))
    }
  } catch (error) {
    console.error("GET /api/colleges error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}
