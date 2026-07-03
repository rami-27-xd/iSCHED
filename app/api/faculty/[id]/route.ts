import { NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiResponse, apiError } from "@/lib/api-helpers"
import { createAdminClient } from "@/lib/supabase/admin"

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
    const { employeeId, departmentId, specializations, sectionCounts, maxUnitsPerWeek, isActive, firstName, lastName, email } = body

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

    // Update the linked User record if name or email provided
    if ((firstName !== undefined || lastName !== undefined || email !== undefined) && faculty.userId) {
      const linkedUser = faculty.user as any
      const isStub = linkedUser?.supabaseId?.startsWith("manual-")
      const newEmail: string | null = email === "" ? null : (email ?? undefined)

      // If a real email is being added to a stub user, create a Supabase auth account
      if (isStub && newEmail && newEmail !== linkedUser?.email) {
        const existingByEmail = await db.user.findUnique({ where: { email: newEmail } })
        if (existingByEmail && existingByEmail.id !== faculty.userId) {
          return NextResponse.json(apiError("This email is already registered"), { status: 409 })
        }
        if (!existingByEmail) {
          const supabaseAdmin = createAdminClient()
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: newEmail,
            email_confirm: true,
            user_metadata: {
              first_name: firstName ?? linkedUser?.firstName,
              last_name: lastName ?? linkedUser?.lastName,
            },
          })
          if (authError) {
            const isDuplicate = authError.status === 422 || authError.message?.toLowerCase().includes("already")
            return NextResponse.json(
              apiError(isDuplicate ? "This email is already registered in the auth system" : `Auth error: ${authError.message}`),
              { status: isDuplicate ? 409 : 500 }
            )
          }
          // Swap the stub supabaseId for the real one
          await db.user.update({
            where: { id: faculty.userId },
            data: { supabaseId: authData.user.id },
          })
        }
      }

      await db.user.update({
        where: { id: faculty.userId },
        data: {
          ...(firstName !== undefined ? { firstName } : {}),
          ...(lastName !== undefined ? { lastName } : {}),
          ...(email !== undefined ? { email: newEmail } : {}),
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
