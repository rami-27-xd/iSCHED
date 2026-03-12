import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { CalendarDays, ArrowRight, Users, DoorOpen, BarChart3 } from "lucide-react"

export default async function Home() {
  const { userId } = await auth()

  if (userId) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-[#1B4332]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 lg:px-12">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#D4AF37]">
            <CalendarDays className="h-5 w-5 text-[#1B4332]" />
          </div>
          <span className="text-xl font-bold text-white">iSched</span>
        </div>
        <Link
          href="/sign-in"
          className="rounded-lg bg-[#D4AF37] px-5 py-2 text-sm font-semibold text-[#1B4332] transition-colors hover:bg-[#F0D060]"
        >
          Sign In
        </Link>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-4xl px-6 py-16 text-center lg:py-24">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm text-white/80 mb-6">
          <CalendarDays className="h-4 w-4" />
          SLSU Lucban Campus
        </div>
        <h1 className="text-4xl font-bold text-white lg:text-5xl">
          Web-Based Scheduling
          <br />
          <span className="text-[#D4AF37]">Management System</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-white/70">
          Automated class schedule generation using constraint-based assignment with a
          backtracking algorithm. Built for SLSU Lucban Campus.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 rounded-lg bg-[#D4AF37] px-6 py-3 text-sm font-semibold text-[#1B4332] transition-colors hover:bg-[#F0D060]"
          >
            Get Started
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Features */}
        <div className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: CalendarDays, title: "Smart Scheduling", desc: "Auto-generate conflict-free schedules" },
            { icon: Users, title: "Faculty Management", desc: "Track loads and availability" },
            { icon: DoorOpen, title: "Room Allocation", desc: "Optimize room utilization" },
            { icon: BarChart3, title: "Analytics", desc: "Insights and utilization reports" },
          ].map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl bg-white/5 p-5 text-left backdrop-blur-sm border border-white/10"
            >
              <feature.icon className="h-8 w-8 text-[#D4AF37]" />
              <h3 className="mt-3 font-semibold text-white">{feature.title}</h3>
              <p className="mt-1 text-sm text-white/60">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-6 text-center text-sm text-white/40">
        iSched &copy; {new Date().getFullYear()} &middot; Southern Luzon State University — Lucban Campus
      </footer>
    </div>
  )
}
