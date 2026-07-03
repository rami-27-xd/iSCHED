'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { CalendarDays, Loader2, Eye, EyeOff, Mail, KeyRound, CheckCircle2 } from 'lucide-react'

type Mode = 'password' | 'magic-link'
type OtpState = 'idle' | 'sending' | 'sent'

export default function SignInPage() {
  const router = useRouter()

  // ── Mode toggle ──
  const [mode, setMode] = useState<Mode>('password')

  // ── Password mode state ──
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [pwError, setPwError]   = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  // ── Magic-link mode state ──
  const [mlEmail, setMlEmail]   = useState('')
  const [mlError, setMlError]   = useState('')
  const [otpState, setOtpState] = useState<OtpState>('idle')

  // ── Password sign-in ──
  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    setPwLoading(true)

    let supabase
    try {
      supabase = createClient()
    } catch (envErr: any) {
      setPwError(envErr.message)
      setPwLoading(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setPwError(
        error.message.toLowerCase().includes('fetch') || error.message === 'Failed to fetch'
          ? 'Cannot reach the authentication server. Check your internet connection and that your Supabase project is not paused.'
          : error.message
      )
      setPwLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  async function handleGoogleSignIn() {
    let supabase
    try { supabase = createClient() } catch { return }
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  // ── Magic-link sign-in ──
  async function handleSendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setMlError('')

    const trimmed = mlEmail.trim().toLowerCase()
    if (!trimmed) {
      setMlError('Please enter your email address.')
      return
    }

    setOtpState('sending')

    // 1. Verify the email belongs to an eligible faculty record before calling Supabase
    try {
      const check = await fetch('/api/auth/verify-faculty-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      })
      const json = await check.json()
      if (!json.data?.eligible) {
        setMlError(
          'No active faculty account found for this email. ' +
          'Contact your Department Head or Program Chair to have your email registered.'
        )
        setOtpState('idle')
        return
      }
    } catch {
      setMlError('Could not verify your email. Please try again.')
      setOtpState('idle')
      return
    }

    // 2. Send magic link via Supabase OTP
    let supabase
    try {
      supabase = createClient()
    } catch (envErr: any) {
      setMlError(envErr.message)
      setOtpState('idle')
      return
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: false, // only allow pre-existing accounts
      },
    })

    if (error) {
      setMlError(
        error.message.toLowerCase().includes('fetch') || error.message === 'Failed to fetch'
          ? 'Cannot reach the authentication server. Check your internet connection.'
          : error.message
      )
      setOtpState('idle')
      return
    }

    setOtpState('sent')
  }

  return (
    <div className="min-h-screen bg-[#1B4332] flex items-center justify-center px-4 relative overflow-hidden">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-white/[0.04]" />
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-white/[0.04]" />
        <div className="absolute top-1/4 right-12 h-48 w-48 rounded-full border border-white/[0.07]" />
        <div className="absolute bottom-1/3 left-10 h-28 w-28 rounded-full border border-white/[0.07]" />
        <div className="absolute top-1/3 left-1/4 h-2 w-2 rounded-full bg-[#D4AF37]/50" />
        <div className="absolute top-2/3 right-1/3 h-3 w-3 rounded-full bg-[#D4AF37]/30" />
        <div className="absolute bottom-1/4 left-1/2 h-1.5 w-1.5 rounded-full bg-[#D4AF37]/40" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent" />
      </div>

      <div className="w-full max-w-sm relative z-10">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#D4AF37] mb-4">
            <CalendarDays className="h-6 w-6 text-[#1B4332]" />
          </div>
          <h1 className="text-2xl font-bold text-white">Sign in to iSched</h1>
          <p className="mt-1 text-sm text-white/60">
            {mode === 'password'
              ? 'Welcome back! Please sign in to continue.'
              : 'Enter your email and we\'ll send you a login link.'}
          </p>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-xl">

          {/* ── Mode toggle ── */}
          <div className="flex rounded-lg border border-gray-200 p-1 mb-5 gap-1">
            <button
              type="button"
              onClick={() => { setMode('password'); setPwError(''); setMlError('') }}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-semibold transition-colors ${
                mode === 'password'
                  ? 'bg-[#1B4332] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <KeyRound className="h-3.5 w-3.5" />
              Staff / Admin
            </button>
            <button
              type="button"
              onClick={() => { setMode('magic-link'); setPwError(''); setMlError(''); setOtpState('idle') }}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-semibold transition-colors ${
                mode === 'magic-link'
                  ? 'bg-[#1B4332] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Mail className="h-3.5 w-3.5" />
              Faculty
            </button>
          </div>

          {/* ══════════════════════════════════════════
              PASSWORD MODE
          ══════════════════════════════════════════ */}
          {mode === 'password' && (
            <>
              {/* Google */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>

              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs text-gray-400">or</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <label htmlFor="pw-email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email address
                  </label>
                  <input
                    id="pw-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B4332] focus:outline-none focus:ring-1 focus:ring-[#1B4332]"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="pw-password" className="block text-sm font-medium text-gray-700">
                      Password
                    </label>
                    <Link href="/forgot-password" className="text-xs font-medium text-[#1B4332] hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      id="pw-password"
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:border-[#1B4332] focus:outline-none focus:ring-1 focus:ring-[#1B4332]"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {pwError && (
                  <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                    {pwError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={pwLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1B4332] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2D6A4F] disabled:opacity-50"
                >
                  {pwLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Continue
                </button>
              </form>
            </>
          )}

          {/* ══════════════════════════════════════════
              MAGIC-LINK MODE
          ══════════════════════════════════════════ */}
          {mode === 'magic-link' && (
            <>
              {otpState === 'sent' ? (
                /* ── Sent confirmation ── */
                <div className="py-4 text-center space-y-3">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-50 border border-green-100 mx-auto">
                    <CheckCircle2 className="h-7 w-7 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Check your inbox</p>
                    <p className="mt-1 text-sm text-gray-500">
                      We sent a login link to <span className="font-medium text-gray-700">{mlEmail}</span>.
                      Click the link to access your schedule.
                    </p>
                  </div>
                  <p className="text-xs text-gray-400">
                    Link expires in 1 hour. Didn&apos;t receive it?{' '}
                    <button
                      type="button"
                      onClick={() => { setOtpState('idle'); setMlError('') }}
                      className="text-[#1B4332] font-medium hover:underline"
                    >
                      Try again
                    </button>
                  </p>
                </div>
              ) : (
                /* ── Email input form ── */
                <form onSubmit={handleSendMagicLink} className="space-y-4">
                  <div>
                    <label htmlFor="ml-email" className="block text-sm font-medium text-gray-700 mb-1">
                      Your email address
                    </label>
                    <input
                      id="ml-email"
                      type="email"
                      value={mlEmail}
                      onChange={(e) => setMlEmail(e.target.value)}
                      autoComplete="email"
                      placeholder="you@example.com"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B4332] focus:outline-none focus:ring-1 focus:ring-[#1B4332]"
                      required
                    />
                  </div>

                  {mlError && (
                    <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                      {mlError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={otpState === 'sending'}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1B4332] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2D6A4F] disabled:opacity-50"
                  >
                    {otpState === 'sending'
                      ? <><Loader2 className="h-4 w-4 animate-spin" />Sending&hellip;</>
                      : <><Mail className="h-4 w-4" />Send login link</>
                    }
                  </button>

                  <p className="text-center text-xs text-gray-400">
                    A one-time login link will be sent to your email.
                    No password needed.
                  </p>
                </form>
              )}
            </>
          )}
        </div>

        {mode === 'password' && (
          <p className="mt-4 text-center text-sm text-white/60">
            Don&apos;t have an account?{' '}
            <Link href="/sign-up" className="font-medium text-[#D4AF37] hover:text-[#F0D060]">
              Sign up
            </Link>
          </p>
        )}

        {mode === 'magic-link' && (
          <p className="mt-4 text-center text-sm text-white/60">
            Staff or admin?{' '}
            <button
              type="button"
              onClick={() => { setMode('password'); setMlError('') }}
              className="font-medium text-[#D4AF37] hover:text-[#F0D060]"
            >
              Sign in with password
            </button>
          </p>
        )}

      </div>
    </div>
  )
}
