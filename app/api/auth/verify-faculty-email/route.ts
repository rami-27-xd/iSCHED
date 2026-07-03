import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { apiResponse, apiError } from "@/lib/api-helpers"

/**
 * POST /api/auth/verify-faculty-email
 *
 * Called by the sign-in page before sending a magic link.
 * Confirms the email belongs to an active, approved faculty record
 * that was created with a real Supabase auth account (not a stub).
 *
 * This prevents random emails from triggering Supabase OTP emails and
 * gives the user a clear "not found" message before we hand off to Supabase.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""

    if (!email) {
      return NextResponse.json(apiError("Email is required"), { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { email },
      include: { faculty: { select: { id: true, isActive: true } } },
    })

    const isEligible =
      !!user &&
      user.isApproved &&
      user.isActive &&
      !!user.faculty?.isActive &&
      // Stub users have a synthetic supabaseId — they cannot use magic links
      !user.supabaseId.startsWith("manual-")

    return NextResponse.json(apiResponse({ eligible: isEligible }))
  } catch (error) {
    console.error("POST /api/auth/verify-faculty-email error:", error)
    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}
