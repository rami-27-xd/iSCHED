"use client"

import { useQuery } from "@tanstack/react-query"
import { RoleGuard } from "@/components/shared/role-guard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Loader2,
  CalendarDays,
  MapPin,
  BookOpen,
  Users,
  Clock,
  FileDown,
  List,
  Building2,
} from "lucide-react"
import { useState, useMemo } from "react"

const DAY_ORDER = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
const DAY_LABELS: Record<string, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
}

function formatTime12h(time: string): string {
  const [h, m] = time.split(":").map(Number)
  const ampm = h >= 12 ? "PM" : "AM"
  const hour = h % 12 || 12
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`
}

export default function MySchedulePage() {
  const [view, setView] = useState<"list" | "grid">("list")

  const { data, isLoading, error } = useQuery({
    queryKey: ["my-schedule"],
    queryFn: async () => {
      const res = await fetch("/api/faculty/my-schedule")
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to fetch schedule")
      return json.data ?? []
    },
  })

  const entries: any[] = data ?? []

  // Group by day
  const byDay = useMemo(() =>
    DAY_ORDER.map((day) => ({
      day,
      label: DAY_LABELS[day],
      entries: entries
        .filter((e: any) => e.day === day)
        .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime)),
    })).filter((d) => d.entries.length > 0),
    [entries]
  )

  // Stats
  const totalUnits = useMemo(() => {
    const seen = new Set<string>()
    let units = 0
    for (const e of entries) {
      if (e.subject?.id && !seen.has(e.subject.id)) {
        seen.add(e.subject.id)
        units += e.subject?.units ?? 0
      }
    }
    return units
  }, [entries])

  const uniqueSubjects = useMemo(() => {
    const seen = new Set<string>()
    entries.forEach((e: any) => { if (e.subject?.id) seen.add(e.subject.id) })
    return seen.size
  }, [entries])

  // Semester info from first entry
  const semesterInfo = useMemo(() => {
    if (entries.length === 0) return null
    const sched = entries[0]?.schedule
    if (!sched) return null
    const semType = sched.semester?.type === "FIRST" ? "1st Semester"
      : sched.semester?.type === "SECOND" ? "2nd Semester" : "Summer"
    const ay = sched.semester?.academicYear?.label ?? ""
    const dept = sched.department?.name ?? ""
    return { semType, ay, dept }
  }, [entries])

  // Export / Print
  function handleExport() {
    if (entries.length === 0) return
    const rows = entries
      .sort((a: any, b: any) => {
        const dayDiff = DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day)
        if (dayDiff !== 0) return dayDiff
        return a.startTime.localeCompare(b.startTime)
      })
      .map((e: any) => `
        <tr>
          <td style="border:1px solid #ddd;padding:8px">${DAY_LABELS[e.day] ?? e.day}</td>
          <td style="border:1px solid #ddd;padding:8px">${formatTime12h(e.startTime)} – ${formatTime12h(e.endTime)}</td>
          <td style="border:1px solid #ddd;padding:8px;font-family:monospace">${e.subject?.code ?? ""}</td>
          <td style="border:1px solid #ddd;padding:8px">${e.subject?.title ?? ""}</td>
          <td style="border:1px solid #ddd;padding:8px">${e.subject?.units ?? ""}</td>
          <td style="border:1px solid #ddd;padding:8px;font-family:monospace">${e.room?.code ?? ""}</td>
          <td style="border:1px solid #ddd;padding:8px">${e.section?.name ?? ""}</td>
        </tr>
      `).join("")

    const html = `
      <!DOCTYPE html><html><head>
        <title>My Schedule${semesterInfo ? ` - ${semesterInfo.semType} ${semesterInfo.ay}` : ""}</title>
        <style>
          body { font-family: 'Poppins', Arial, sans-serif; padding: 30px; }
          h1 { color: #1B4332; font-size: 20px; margin-bottom: 4px; }
          h2 { color: #666; font-size: 14px; font-weight: normal; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th { background: #1B4332; color: white; padding: 10px 8px; text-align: left; }
          tr:nth-child(even) { background: #f9f9f9; }
          .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #999; display: flex; flex-direction: column; align-items: center; gap: 4px; }
          @media print { body { padding: 15px; } }
        </style>
      </head><body>
        <h1>Faculty Schedule</h1>
        <h2>${semesterInfo ? `${semesterInfo.semType} | Academic Year ${semesterInfo.ay}` : ""} | SLSU Lucban Campus</h2>
        <p style="font-size:12px;color:#888;margin-bottom:16px;">${entries.length} entries &middot; ${totalUnits} total units</p>
        <table>
          <thead><tr>
            <th>Day</th><th>Time</th><th>Code</th><th>Subject</th><th>Units</th><th>Room</th><th>Section</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="footer">
          <img src="/images/logo.png" alt="iSched" style="height:36px;margin-bottom:6px;border-radius:50%;" />
          <div>Generated by iSched — Southern Luzon State University, Lucban Campus</div>
        </div>
      </body></html>
    `

    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
    }
  }

  return (
    <RoleGuard allowedRoles={["FACULTY", "SUPER_ADMIN", "ADMIN"]}>
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">My Schedule</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {semesterInfo
              ? `${semesterInfo.semType} — ${semesterInfo.ay}`
              : "View your assigned class schedule for the current semester."}
          </p>
        </div>
        {entries.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleExport} className="w-fit">
            <FileDown className="mr-2 h-4 w-4" />
            Print / Export
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading schedule...
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Unable to load schedule. Make sure your account is linked to a faculty record.
          </CardContent>
        </Card>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No schedule entries found for this semester.</p>
            <p className="text-xs text-muted-foreground mt-1">Your schedule will appear here once it is published.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border bg-card p-3 sm:p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <BookOpen className="h-3.5 w-3.5" />
                Subjects
              </div>
              <p className="text-lg sm:text-2xl font-bold text-[#1B4332]">{uniqueSubjects}</p>
            </div>
            <div className="rounded-lg border bg-card p-3 sm:p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <CalendarDays className="h-3.5 w-3.5" />
                Classes/Week
              </div>
              <p className="text-lg sm:text-2xl font-bold text-[#1B4332]">{entries.length}</p>
            </div>
            <div className="rounded-lg border bg-card p-3 sm:p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Clock className="h-3.5 w-3.5" />
                Teaching Days
              </div>
              <p className="text-lg sm:text-2xl font-bold text-[#1B4332]">{byDay.length}</p>
            </div>
            <div className="rounded-lg border bg-card p-3 sm:p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <BookOpen className="h-3.5 w-3.5" />
                Total Units
              </div>
              <p className="text-lg sm:text-2xl font-bold text-[#1B4332]">{totalUnits}</p>
            </div>
          </div>

          {/* View toggle */}
          <Tabs value={view} onValueChange={(v) => v && setView(v as "list" | "grid")}>
            <TabsList>
              <TabsTrigger value="list">
                <List className="mr-1.5 h-3.5 w-3.5" />
                <span className="hidden sm:inline">Day View</span>
                <span className="sm:hidden">Days</span>
              </TabsTrigger>
              <TabsTrigger value="grid">
                <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                <span className="hidden sm:inline">Weekly Grid</span>
                <span className="sm:hidden">Grid</span>
              </TabsTrigger>
            </TabsList>

            {/* ── DAY VIEW ── */}
            <TabsContent value="list" className="mt-4">
              <div className="space-y-3 sm:space-y-4">
                {byDay.map(({ day, label, entries: dayEntries }) => (
                  <Card key={day}>
                    <div className="bg-[#1B4332] text-white px-3 sm:px-4 py-2 rounded-t-lg flex items-center justify-between">
                      <h3 className="text-sm font-semibold">{label}</h3>
                      <span className="text-[10px] sm:text-xs text-white/70">
                        {dayEntries.length} {dayEntries.length === 1 ? "class" : "classes"}
                      </span>
                    </div>
                    <CardContent className="p-0">
                      <div className="divide-y divide-border">
                        {dayEntries.map((entry: any) => (
                          <div key={entry.id} className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 p-3 sm:py-3 sm:px-4">
                            {/* Time */}
                            <div className="flex items-center gap-2 sm:w-32 shrink-0">
                              <Clock className="h-3.5 w-3.5 text-[#1B4332] shrink-0 sm:hidden" />
                              <span className="text-sm font-semibold text-[#1B4332]">
                                {formatTime12h(entry.startTime)} – {formatTime12h(entry.endTime)}
                              </span>
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium">
                                  {entry.subject?.code} — {entry.subject?.title}
                                </span>
                                <Badge variant="outline" className="text-[10px]">
                                  {entry.subject?.units}u
                                </Badge>
                                {entry.subject?.type && (
                                  <Badge
                                    className={`text-[10px] ${
                                      entry.subject.type === "LABORATORY"
                                        ? "bg-[#2D6A4F] text-white"
                                        : "bg-[#1B4332] text-white"
                                    }`}
                                  >
                                    {entry.subject.type === "LABORATORY" ? "Lab" : "Lec"}
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {entry.room?.code}
                                  {entry.room?.building?.name && ` — ${entry.room.building.name}`}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {entry.section?.name}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* ── WEEKLY GRID VIEW ── */}
            <TabsContent value="grid" className="mt-4">
              {/* Desktop: full grid */}
              <div className="hidden sm:block overflow-x-auto">
                <div className="min-w-[700px]">
                  <div className="grid grid-cols-6 gap-px bg-border rounded-lg overflow-hidden">
                    {/* Header row */}
                    {DAY_ORDER.map((day) => (
                      <div key={day} className="bg-[#1B4332] text-white text-center text-xs font-semibold py-2.5">
                        {DAY_LABELS[day]}
                      </div>
                    ))}
                    {/* Body */}
                    {DAY_ORDER.map((day) => {
                      const dayEntries = entries
                        .filter((e: any) => e.day === day)
                        .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime))
                      return (
                        <div key={day} className="bg-white p-2 min-h-[120px] space-y-1.5">
                          {dayEntries.length === 0 ? (
                            <p className="text-[10px] text-muted-foreground/50 text-center pt-4">—</p>
                          ) : (
                            dayEntries.map((entry: any) => (
                              <div
                                key={entry.id}
                                className={`rounded-md border-l-3 p-2 text-[11px] leading-snug ${
                                  entry.subject?.type === "LABORATORY"
                                    ? "bg-[#2D6A4F]/10 border-l-[#2D6A4F]"
                                    : "bg-[#1B4332]/5 border-l-[#1B4332]"
                                }`}
                              >
                                <p className="font-bold text-[#1B4332]">{entry.subject?.code}</p>
                                <p className="text-muted-foreground truncate">{formatTime12h(entry.startTime)}–{formatTime12h(entry.endTime)}</p>
                                <p className="text-muted-foreground truncate">{entry.room?.code} &middot; {entry.section?.name}</p>
                              </div>
                            ))
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Mobile: stacked cards per day */}
              <div className="sm:hidden space-y-3">
                {byDay.map(({ day, label, entries: dayEntries }) => (
                  <div key={day}>
                    <h4 className="text-xs font-semibold text-[#1B4332] mb-1.5">{label}</h4>
                    <div className="space-y-1.5">
                      {dayEntries.map((entry: any) => (
                        <div
                          key={entry.id}
                          className={`rounded-lg border-l-3 p-2.5 ${
                            entry.subject?.type === "LABORATORY"
                              ? "bg-[#2D6A4F]/10 border-l-[#2D6A4F]"
                              : "bg-[#1B4332]/5 border-l-[#1B4332]"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#1B4332]">{entry.subject?.code}</span>
                            <span className="text-[10px] text-muted-foreground">{formatTime12h(entry.startTime)}–{formatTime12h(entry.endTime)}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{entry.subject?.title}</p>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                            <span>{entry.room?.code}</span>
                            <span>&middot;</span>
                            <span>{entry.section?.name}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
    </RoleGuard>
  )
}
