import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()

  // Redirect to sign-in page using the request origin (handles any port)
  const url = new URL('/sign-in', request.url)
  return NextResponse.redirect(url, { status: 302 })
}
