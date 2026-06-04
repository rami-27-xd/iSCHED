import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Logo } from "@/components/shared/logo"
import Image from "next/image"
import { GraduationCap, Users } from "lucide-react"

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect("/dashboard")

  return (
    <div className="relative min-h-screen bg-[#1B4332] flex flex-col items-center justify-center px-6 overflow-hidden">

      {/* Background glow blobs */}
      <div className="pointer-events-none absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-[#2D6A4F]/50 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-10%] right-[-10%] h-[400px] w-[400px] rounded-full bg-[#D4AF37]/10 blur-3xl" />

      {/* Main content — no card box */}
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">

        {/* SLSU Seal */}
        <Image
          src="/images/slsu-seal.png"
          alt="Southern Luzon State University"
          width={100}
          height={100}
          className="object-contain drop-shadow-xl"
          priority
        />

        {/* University name */}
        <p className="mt-3 text-[#D4AF37] text-[11px] font-semibold tracking-[0.18em] uppercase text-center">
          Southern Luzon State University
        </p>
        <p className="text-white/40 text-[10px] tracking-widest uppercase mt-0.5 text-center">
          Lucban Campus
        </p>

        {/* Thin gold divider */}
        <div className="my-7 h-px w-24 bg-[#D4AF37]/30" />

        {/* iSched logo */}
        <Logo size="lg" className="rounded-full shadow-2xl ring-4 ring-[#D4AF37]/20" />

        {/* iSched name */}
        <h1 className="mt-5 text-4xl font-extrabold text-white tracking-tight">iSched</h1>
        <p className="mt-1.5 text-white/40 text-[11px] tracking-[0.15em] uppercase text-center">
          Scheduling Management System
        </p>

        {/* Sign In */}
        <Link
          href="/sign-in"
          className="mt-10 w-full rounded-2xl bg-[#D4AF37] py-3.5 text-center text-sm font-bold text-[#1B4332] shadow-lg transition-all hover:bg-[#e8c84a] hover:shadow-[#D4AF37]/30 hover:shadow-xl active:scale-95"
        >
          Sign In
        </Link>

        {/* Register buttons */}
        <div className="mt-4 grid w-full grid-cols-2 gap-3">
          {/* Faculty */}
          <Link
            href="/sign-up?role=faculty"
            className="group relative overflow-hidden rounded-2xl bg-white/8 py-4 flex flex-col items-center gap-2 transition-all hover:bg-white/14 active:scale-95"
          >
            <GraduationCap className="h-8 w-8 text-[#D4AF37]" strokeWidth={1.5} />
            <span className="text-[11px] font-semibold text-white/80 text-center leading-tight group-hover:text-white transition-colors">
              Register as<br />Faculty
            </span>
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent" />
          </Link>

          {/* Program Chair */}
          <Link
            href="/sign-up?role=admin"
            className="group relative overflow-hidden rounded-2xl bg-white/8 py-4 flex flex-col items-center gap-2 transition-all hover:bg-white/14 active:scale-95"
          >
            <Users className="h-8 w-8 text-[#D4AF37]" strokeWidth={1.5} />
            <span className="text-[11px] font-semibold text-white/80 text-center leading-tight group-hover:text-white transition-colors">
              Register as<br />Program Chair
            </span>
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent" />
          </Link>
        </div>
      </div>

      {/* Footer */}
      <p className="relative z-10 mt-10 text-[11px] text-white/25 text-center">
        iSched &mdash; Southern Luzon State University, Lucban Campus &copy; {new Date().getFullYear()}
      </p>
    </div>
  )
}
