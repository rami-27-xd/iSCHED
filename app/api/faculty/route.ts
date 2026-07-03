import { NextResponse } from "next/server"
import { getAuthenticatedUser, getCurrentUser, getUserDepartmentId } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiResponse, apiError } from "@/lib/api-helpers"
import { notifyAllSuperAdmins } from "@/lib/notifications"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(req: Request) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json(apiError("Unauthorized"), { status: 401 })
    }

    const dbUser = await getCurrentUser()
    const userDeptId = getUserDepartmentId(dbUser)

    const { searchParams } = new URL(req.url)
    const departmentId = searchParams.get("departmentId")
    const collegeId = searchParams.get("collegeId")

    // Scoping rules:
    //   ADMIN (Program Chair) — always scoped to their own department.
    //     If they have no department configured yet, return empty rather than leaking data.
    //     Any explicit departmentId or collegeId param is ignored — server enforces isolation.
    //   SUPER_ADMIN (Dept Chair) — explicit departmentId param → dept scope;
    //     their own deptId if set; collegeId param → college-wide; no filter → all.
    if (dbUser?.role === "ADMIN") {
      if (!userDeptId) {
        return NextResponse.json(apiResponse([]))
      }
      const faculty = await db.faculty.findMany({
        where: { isActive: true, user: { isActive: true }, departmentId: userDeptId },
        include: {
          user: true,
          department: true,
          _count: { select: { scheduleEntries: true, teachingLoads: true } },
        },
        orderBy: { user: { lastName: "asc" } },
      })
      return NextResponse.json(apiResponse(faculty))
    }

    const effectiveDeptId = departmentId || userDeptId

    const faculty = await db.faculty.findMany({
      where: {
        isActive: true,
        user: { isActive: true },
        ...(effectiveDeptId
          ? { departmentId: effectiveDeptId }
          : collegeId
          ? { department: { collegeId } }
          : {}),
      },
      include: {
        user: true,
        department: true,
        _count: { select: { scheduleEntries: true, teachingLoads: true } },
      },
      orderBy: { user: { lastName: "asc" } },
    })

    return NextResponse.json(apiResponse(faculty))
  } catch (error) {
    console.error("GET /api/faculty error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json(apiError("Unauthorized"), { status: 401 })
    }

    // Only SUPER_ADMIN and ADMIN can add faculty
    const dbUser = await getCurrentUser()
    if (!dbUser || !["SUPER_ADMIN", "ADMIN"].includes(dbUser.role)) {
      return NextResponse.json(apiError("Forbidden — insufficient permissions"), { status: 403 })
    }

    const body = await req.json()
    const { userId, firstName, lastName, email, employeeId: providedEmployeeId, departmentId, specializations, sectionCounts, maxUnitsPerWeek } = body

    if (!departmentId) {
      return NextResponse.json(apiError("Department is required"), { status: 400 })
    }

    // Auto-generate employeeId if not provided
    const employeeId = providedEmployeeId || `FAC-${Date.now()}`

    // Check for duplicate employeeId only if explicitly provided
    if (providedEmployeeId) {
      const existingFaculty = await db.faculty.findUnique({ where: { employeeId } })
      if (existingFaculty) {
        return NextResponse.json(apiError("A faculty member with this Employee ID already exists"), { status: 409 })
      }
    }

    let targetUserId: string

    if (userId) {
      // Link to an existing user
      const existingUser = await db.user.findUnique({ where: { id: userId } })
      if (!existingUser) {
        return NextResponse.json(apiError("User not found"), { status: 404 })
      }
      // Check if user is already linked to a faculty record
      const existingFacultyForUser = await db.faculty.findUnique({ where: { userId } })
      if (existingFacultyForUser) {
        return NextResponse.json(apiError("This user is already a faculty member"), { status: 409 })
      }
      // Do NOT change the user's role — a Department Chair or Program Chair
      // can also be assigned as faculty without losing their admin role
      targetUserId = userId
    } else if (firstName && lastName) {
      if (email) {
        // ── Real email provided → create a Supabase auth user (passwordless) ──
        // Check our DB first to avoid creating orphan Supabase accounts
        const existingByEmail = await db.user.findUnique({ where: { email } })
        if (existingByEmail) {
          const alreadyFaculty = await db.faculty.findUnique({ where: { userId: existingByEmail.id } })
          if (alreadyFaculty) {
            return NextResponse.json(
              apiError("A faculty member with this email already exists"),
              { status: 409 }
            )
          }
          // Email exists in DB but not yet a faculty record — reuse the user
          targetUserId = existingByEmail.id
        } else {
          // Create the Supabase auth user with email_confirm: true so they can
          // sign in immediately via magic link without any further confirmation step.
          const supabaseAdmin = createAdminClient()
          const { data: authData, error: authError } =
            await supabaseAdmin.auth.admin.createUser({
              email,
              email_confirm: true,
              user_metadata: { first_name: firstName, last_name: lastName },
            })

          if (authError) {
            const isDuplicate =
              authError.status === 422 ||
              authError.message?.toLowerCase().includes("already")
            return NextResponse.json(
              apiError(
                isDuplicate
                  ? "This email is already registered in the auth system"
                  : `Auth error: ${authError.message}`
              ),
              { status: isDuplicate ? 409 : 500 }
            )
          }

          const newUser = await db.user.create({
            data: {
              supabaseId: authData.user.id,
              email,
              firstName,
              lastName,
              role: "FACULTY",
              isApproved: true,
            },
          })
          targetUserId = newUser.id
        }
      } else {
        // ── No email → stub user with no email (cannot use magic link) ──
        const newUser = await db.user.create({
          data: {
            supabaseId: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            email: null,
            firstName,
            lastName,
            role: "FACULTY",
            isApproved: true,
          },
        })
        targetUserId = newUser.id
      }
    } else {
      return NextResponse.json(apiError("Either userId or firstName/lastName are required"), { status: 400 })
    }

    const faculty = await db.faculty.create({
      data: {
        userId: targetUserId,
        departmentId,
        employeeId,
        specializations: specializations ?? [],
        sectionCounts: sectionCounts ?? {},
        maxUnitsPerWeek: maxUnitsPerWeek ?? 21,
      },
      include: { user: true, department: true },
    })

    const facName = `${faculty.user?.firstName ?? ""} ${faculty.user?.lastName ?? ""}`

    // Notify all super admins about new faculty
    await notifyAllSuperAdmins(
      "Faculty Added",
      `${facName} (${employeeId}) has been added as faculty in ${faculty.department?.abbreviation ?? "a department"}.`,
      "faculty_added",
      "/dashboard/faculty"
    )

    return NextResponse.json(apiResponse(faculty), { status: 201 })
  } catch (error) {
    console.error("POST /api/faculty error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}
