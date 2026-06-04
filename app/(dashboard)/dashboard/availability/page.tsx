"use client"

import { useState, useMemo, useCallback, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useFacultyList } from "@/hooks/use-data"
import { RoleGuard } from "@/components/shared/role-guard"

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const
const DAY_SHORT: Record<string, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
}
const DAY_LABELS: Record<string, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
}

// 30-min slots from 07:30 to 21:00 (27 slots)
const SLOTS = Array.from({ length: 27 }, (_, i) => {
  const totalMins = 7 * 60 + 30 + i * 30
  const h = String(Math.floor(totalMins / 60)).padStart(2, "0")
  const m = String(totalMins % 60).padStart(2, "0")
  return `${h}:${m}`
})

function getEndTime(startTime: string): string {
  const [hStr, mStr] = startTime.split(":")
  const totalMins = parseInt(hStr) * 60 + parseInt(mStr) + 30
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
}

function formatTime12(time24: string): string {
  const [hStr, mStr] = time24.split(":")
  let h = parseInt(hStr)
  const ampm = h >= 12 ? "PM" : "AM"
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${h}:${mStr} ${ampm}`
}

/** Merge overlapping/adjacent intervals and return sorted merged list */
function mergeIntervals(intervals: [number, number][]): [number, number][] {
  if (intervals.length === 0) return []
  const sorted = [...intervals].sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = [sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1]
    if (sorted[i][0] <= last[1]) {
      last[1] = Math.max(last[1], sorted[i][1])
    } else {
      merged.push(sorted[i])
    }
  }
  return merged
}

function minsToTimeStr(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
}

// ─── SLSU brand colors ────────────────────────────────────────────────────────
const BRAND_GREEN = "#1B4332"
const BRAND_GOLD = "#D4AF37"

// ─── Timeline hour labels (for display above the timeline) ────────────────────
const HOUR_LABELS = (() => {
  const labels: { time: string; offsetSlots: number }[] = []
  for (let i = 0; i < SLOTS.length; i++) {
    const [, m] = SLOTS[i].split(":").map(Number)
    if (m === 0) {
      labels.push({ time: SLOTS[i], offsetSlots: i })
    }
  }
  return labels
})()

// ─── Faculty Card Component ───────────────────────────────────────────────────

function FacultyCard({
  faculty,
  availabilityMap,
  allAvailability,
  selectedSemesterId,
  onSave,
  isSaving,
}: {
  faculty: any
  availabilityMap: Map<string, Set<string>>
  allAvailability: any[]
  selectedSemesterId: string
  onSave: (facultyId: string, newSlots: { day: string; startTime: string; endTime: string }[]) => void
  isSaving: boolean
}) {
  const [activeDay, setActiveDay] = useState<string>("MONDAY")
  const dragRef = useRef<{ dragging: boolean; startIdx: number; endIdx: number; mode: "add" | "remove" } | null>(null)
  const [dragPreview, setDragPreview] = useState<{ startIdx: number; endIdx: number; mode: "add" | "remove" } | null>(null)

  const facultySlots = availabilityMap.get(faculty.id) ?? new Set<string>()

  const firstName = faculty.user?.firstName ?? ""
  const lastName = faculty.user?.lastName ?? ""
  const department = faculty.department?.name ?? ""
  const fullName = `${lastName}${firstName ? `, ${firstName}` : ""}`

  // ─── Build summary across all days ────────────────────────────────────
  const summary = useMemo(() => {
    const parts: string[] = []
    for (const day of DAYS) {
      const daySlots = SLOTS.filter((s) => facultySlots.has(`${day}-${s}`))
      if (daySlots.length === 0) continue
      // Group into contiguous ranges
      const ranges: string[] = []
      let rangeStart = daySlots[0]
      let prevIdx = SLOTS.indexOf(daySlots[0])
      for (let i = 1; i < daySlots.length; i++) {
        const curIdx = SLOTS.indexOf(daySlots[i])
        if (curIdx !== prevIdx + 1) {
          ranges.push(`${formatTime12(rangeStart)}-${formatTime12(getEndTime(SLOTS[prevIdx]))}`)
          rangeStart = daySlots[i]
        }
        prevIdx = curIdx
      }
      ranges.push(`${formatTime12(rangeStart)}-${formatTime12(getEndTime(SLOTS[prevIdx]))}`)
      parts.push(`${DAY_SHORT[day]}: ${ranges.join(", ")}`)
    }
    return parts.length > 0 ? parts.join(" | ") : "No availability set"
  }, [facultySlots])

  // ─── Compute new slots after a bulk change for one day ────────────────
  const buildNewSlots = useCallback(
    (day: string, selectedIndices: Set<number>) => {
      // Keep all slots from other days
      const currentSlots = allAvailability
        .filter((a: any) => a.facultyId === faculty.id)
        .map((a: any) => ({ day: a.day, startTime: a.startTime, endTime: a.endTime }))

      const otherDaySlots = currentSlots.filter((s) => s.day !== day)

      // Build merged intervals from selected indices
      const intervals: [number, number][] = []
      for (const idx of selectedIndices) {
        const [h, m] = SLOTS[idx].split(":").map(Number)
        const start = h * 60 + m
        intervals.push([start, start + 30])
      }
      const merged = mergeIntervals(intervals)

      const daySlots = merged.map(([s, e]) => ({
        day,
        startTime: minsToTimeStr(s),
        endTime: minsToTimeStr(e),
      }))

      return [...otherDaySlots, ...daySlots]
    },
    [allAvailability, faculty.id],
  )

  // ─── Commit a drag or quick-button change ─────────────────────────────
  const commitDaySlots = useCallback(
    (day: string, newSelectedIndices: Set<number>) => {
      const newSlots = buildNewSlots(day, newSelectedIndices)
      onSave(faculty.id, newSlots)
    },
    [buildNewSlots, faculty.id, onSave],
  )

  // ─── Drag handlers ────────────────────────────────────────────────────
  const handleMouseDown = useCallback(
    (idx: number) => {
      const key = `${activeDay}-${SLOTS[idx]}`
      const isCurrentlyOn = facultySlots.has(key)
      const mode = isCurrentlyOn ? "remove" : "add"
      dragRef.current = { dragging: true, startIdx: idx, endIdx: idx, mode }
      setDragPreview({ startIdx: idx, endIdx: idx, mode })
    },
    [activeDay, facultySlots],
  )

  const handleMouseEnter = useCallback((idx: number) => {
    if (!dragRef.current?.dragging) return
    dragRef.current.endIdx = idx
    setDragPreview({
      startIdx: dragRef.current.startIdx,
      endIdx: idx,
      mode: dragRef.current.mode,
    })
  }, [])

  const handleMouseUp = useCallback(() => {
    if (!dragRef.current?.dragging) return
    const { startIdx, endIdx, mode } = dragRef.current
    dragRef.current = null
    setDragPreview(null)

    const lo = Math.min(startIdx, endIdx)
    const hi = Math.max(startIdx, endIdx)

    // Build new set of selected indices for this day
    const currentSelected = new Set<number>()
    for (let i = 0; i < SLOTS.length; i++) {
      if (facultySlots.has(`${activeDay}-${SLOTS[i]}`)) {
        currentSelected.add(i)
      }
    }

    for (let i = lo; i <= hi; i++) {
      if (mode === "add") {
        currentSelected.add(i)
      } else {
        currentSelected.delete(i)
      }
    }

    commitDaySlots(activeDay, currentSelected)
  }, [activeDay, facultySlots, commitDaySlots])

  // ─── Quick buttons ────────────────────────────────────────────────────
  const applyPreset = useCallback(
    (startTime: string, endTime: string) => {
      const currentSelected = new Set<number>()
      for (let i = 0; i < SLOTS.length; i++) {
        if (facultySlots.has(`${activeDay}-${SLOTS[i]}`)) {
          currentSelected.add(i)
        }
      }

      const [sH, sM] = startTime.split(":").map(Number)
      const [eH, eM] = endTime.split(":").map(Number)
      const startMins = sH * 60 + sM
      const endMins = eH * 60 + eM

      for (let i = 0; i < SLOTS.length; i++) {
        const [h, m] = SLOTS[i].split(":").map(Number)
        const slotMins = h * 60 + m
        if (slotMins >= startMins && slotMins + 30 <= endMins) {
          currentSelected.add(i)
        }
      }

      commitDaySlots(activeDay, currentSelected)
    },
    [activeDay, facultySlots, commitDaySlots],
  )

  const clearDay = useCallback(() => {
    commitDaySlots(activeDay, new Set())
  }, [activeDay, commitDaySlots])

  // ─── Check which indices are in the drag preview ──────────────────────
  const getDragRange = (): Set<number> => {
    if (!dragPreview) return new Set()
    const lo = Math.min(dragPreview.startIdx, dragPreview.endIdx)
    const hi = Math.max(dragPreview.startIdx, dragPreview.endIdx)
    const set = new Set<number>()
    for (let i = lo; i <= hi; i++) set.add(i)
    return set
  }

  const dragRange = getDragRange()

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div
        className="px-4 py-3 text-white"
        style={{ backgroundColor: BRAND_GREEN }}
      >
        <h3 className="font-semibold text-base">{fullName}</h3>
        {department && (
          <p className="text-xs mt-0.5" style={{ color: BRAND_GOLD }}>
            {department}
          </p>
        )}
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Day tabs */}
        <div className="flex gap-1 flex-wrap">
          {DAYS.map((day) => {
            const isActive = activeDay === day
            const hasSlotsForDay = SLOTS.some((s) => facultySlots.has(`${day}-${s}`))
            return (
              <button
                key={day}
                type="button"
                onClick={() => setActiveDay(day)}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors relative"
                style={{
                  backgroundColor: isActive ? BRAND_GREEN : "transparent",
                  color: isActive ? "#fff" : BRAND_GREEN,
                  border: `1.5px solid ${isActive ? BRAND_GREEN : "#d1d5db"}`,
                }}
              >
                {DAY_SHORT[day]}
                {hasSlotsForDay && (
                  <span
                    className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
                    style={{ backgroundColor: BRAND_GOLD }}
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* Quick-action buttons */}
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => applyPreset("07:30", "12:00")}
            disabled={isSaving}
            className="px-3 py-1.5 text-xs font-medium rounded-md border transition-colors hover:opacity-80 disabled:opacity-50"
            style={{ borderColor: BRAND_GREEN, color: BRAND_GREEN }}
          >
            Morning (7:30-12:00)
          </button>
          <button
            type="button"
            onClick={() => applyPreset("12:00", "17:00")}
            disabled={isSaving}
            className="px-3 py-1.5 text-xs font-medium rounded-md border transition-colors hover:opacity-80 disabled:opacity-50"
            style={{ borderColor: BRAND_GREEN, color: BRAND_GREEN }}
          >
            Afternoon (12:00-5:00)
          </button>
          <button
            type="button"
            onClick={() => applyPreset("07:30", "21:00")}
            disabled={isSaving}
            className="px-3 py-1.5 text-xs font-medium rounded-md border transition-colors hover:opacity-80 disabled:opacity-50"
            style={{ borderColor: BRAND_GREEN, color: BRAND_GREEN }}
          >
            Full Day (7:30-9:00 PM)
          </button>
          <button
            type="button"
            onClick={clearDay}
            disabled={isSaving}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-red-300 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            Clear {DAY_SHORT[activeDay]}
          </button>
        </div>

        {/* Hour labels — scrollable on mobile */}
        <div className="relative select-none overflow-x-auto" style={{ userSelect: "none" }}>
          <div className="min-w-[600px]">
          <div className="flex text-[10px] text-muted-foreground mb-0.5 pl-0">
            {SLOTS.map((slot, i) => {
              const [, m] = slot.split(":").map(Number)
              return (
                <div
                  key={i}
                  className="text-center"
                  style={{ width: `${100 / SLOTS.length}%`, minWidth: 0 }}
                >
                  {m === 0 ? formatTime12(slot).replace(":00 ", "").replace(" ", "") : ""}
                </div>
              )
            })}
          </div>

          {/* Timeline slots */}
          <div
            className="flex rounded-lg overflow-hidden border border-border"
            onMouseLeave={() => {
              if (dragRef.current?.dragging) handleMouseUp()
            }}
          >
            {SLOTS.map((slot, idx) => {
              const key = `${activeDay}-${slot}`
              const isAvailable = facultySlots.has(key)
              const isInDrag = dragRange.has(idx)

              let bgColor: string
              if (isInDrag) {
                bgColor = dragPreview?.mode === "add" ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.3)"
              } else if (isAvailable) {
                bgColor = "rgba(34,197,94,0.6)"
              } else {
                bgColor = "transparent"
              }

              // Visual separator at hour boundaries
              const [, m] = slot.split(":").map(Number)
              const isHourBoundary = m === 0 && idx > 0

              return (
                <div
                  key={idx}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleMouseDown(idx)
                  }}
                  onMouseEnter={() => handleMouseEnter(idx)}
                  onMouseUp={handleMouseUp}
                  className="relative cursor-pointer transition-all hover:brightness-90 hover:scale-y-110 active:scale-y-95"
                  style={{
                    width: `${100 / SLOTS.length}%`,
                    height: "44px",
                    backgroundColor: bgColor,
                    borderLeft: isHourBoundary ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(0,0,0,0.04)",
                  }}
                  title={`${DAY_LABELS[activeDay]} ${formatTime12(slot)} - ${formatTime12(getEndTime(slot))} ${isAvailable ? "(Available)" : "(Unavailable)"}`}
                />
              )
            })}
          </div>

          {/* Start/End labels under timeline */}
          <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5 px-0.5">
            <span>{formatTime12(SLOTS[0])}</span>
            <span>{formatTime12(getEndTime(SLOTS[SLOTS.length - 1]))}</span>
          </div>
          </div>{/* end min-w wrapper */}
        </div>

        {/* Summary */}
        <div className="rounded-md px-3 py-2 text-xs text-muted-foreground bg-muted/50 leading-relaxed">
          <span className="font-medium text-foreground">Schedule: </span>
          {summary}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AvailabilityPage() {
  const queryClient = useQueryClient()
  const { data: faculty = [], isLoading: loadingFaculty } = useFacultyList()
  // Fetch semesters from active schedules so availability aligns with manage schedules
  const { data: activeSchedules = [] } = useQuery({
    queryKey: ["schedules", { isArchived: false }],
    queryFn: async () => {
      const res = await fetch("/api/schedules")
      const json = await res.json()
      if (!res.ok) return []
      return json.data ?? []
    },
  })
  // Extract unique semesters from active schedules
  const semesters = useMemo(() => {
    const map = new Map<string, any>()
    activeSchedules.forEach((s: any) => {
      if (s.semester && !map.has(s.semester.id)) {
        map.set(s.semester.id, s.semester)
      }
    })
    return Array.from(map.values())
  }, [activeSchedules])

  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")

  // Fetch ALL faculty availability for the selected semester
  const { data: allAvailability = [], isLoading: loadingAvailability } = useQuery({
    queryKey: ["faculty-availability-all", selectedSemesterId],
    queryFn: async () => {
      if (!selectedSemesterId) return []
      const res = await fetch(`/api/faculty/availability?semesterId=${selectedSemesterId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to fetch")
      return json.data ?? []
    },
    enabled: !!selectedSemesterId,
  })

  // Build a lookup: facultyId -> Set of "DAY-HH:MM" keys for 30-min slots
  const availabilityMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const slot of allAvailability) {
      const fid = (slot as any).facultyId
      if (!map.has(fid)) map.set(fid, new Set())
      const set = map.get(fid)!
      const startH = parseInt((slot as any).startTime.split(":")[0])
      const startM = parseInt((slot as any).startTime.split(":")[1])
      const endH = parseInt((slot as any).endTime.split(":")[0])
      const endM = parseInt((slot as any).endTime.split(":")[1])
      const availStart = startH * 60 + startM
      const availEnd = endH * 60 + endM

      for (const slotTime of SLOTS) {
        const [sh, sm] = slotTime.split(":").map(Number)
        const slotStart = sh * 60 + sm
        const slotEnd = slotStart + 30
        if (slotStart >= availStart && slotEnd <= availEnd) {
          set.add(`${(slot as any).day}-${slotTime}`)
        }
      }
    }
    return map
  }, [allAvailability])

  // Save mutation - accepts full slot list for a faculty
  const saveMutation = useMutation({
    mutationFn: async ({
      facultyId,
      slots,
    }: {
      facultyId: string
      slots: { day: string; startTime: string; endTime: string }[]
    }) => {
      const res = await fetch("/api/faculty/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facultyId,
          semesterId: selectedSemesterId,
          slots,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to save")
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faculty-availability-all", selectedSemesterId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleSave = useCallback(
    (facultyId: string, newSlots: { day: string; startTime: string; endTime: string }[]) => {
      saveMutation.mutate({ facultyId, slots: newSlots })
    },
    [saveMutation],
  )

  const isLoading = loadingFaculty || loadingAvailability

  return (
    <RoleGuard allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: BRAND_GREEN }}>
          Faculty Availability
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Drag across time slots to select availability ranges. Use quick buttons for common presets. Changes auto-save.
        </p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block h-4 w-8 rounded"
            style={{ backgroundColor: "rgba(34,197,94,0.6)", border: "1px solid rgba(34,197,94,0.8)" }}
          />
          Available
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-4 w-8 rounded bg-muted border border-border" />
          Unavailable
        </div>
      </div>

      {/* Semester Selector + Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="w-full max-w-sm">
              <label className="block text-sm font-medium mb-1.5">Semester</label>
              <select
                value={selectedSemesterId}
                onChange={(e) => setSelectedSemesterId(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select semester...</option>
                {semesters.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.type === "FIRST" ? "1st" : s.type === "SECOND" ? "2nd" : "Summer"} Semester — {s.academicYear?.label}
                  </option>
                ))}
              </select>
            </div>
            {selectedSemesterId && (
              <div className="w-full max-w-sm">
                <label className="block text-sm font-medium mb-1.5">Search Faculty</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or department..."
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading state */}
      {selectedSemesterId && isLoading && (
        <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading faculty availability...
        </div>
      )}

      {/* No faculty */}
      {selectedSemesterId && !isLoading && faculty.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No faculty members found.
        </div>
      )}

      {/* Faculty cards */}
      {selectedSemesterId && !isLoading && faculty.length > 0 && (() => {
        const q = searchQuery.toLowerCase().trim()
        const filtered = q
          ? (faculty as any[]).filter((f) => {
              const name = `${f.user?.firstName ?? ""} ${f.user?.lastName ?? ""}`.toLowerCase()
              const dept = (f.department?.name ?? "").toLowerCase()
              return name.includes(q) || dept.includes(q)
            })
          : (faculty as any[])
        return filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No faculty found matching &ldquo;{searchQuery}&rdquo;
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
            {filtered.map((f) => (
              <FacultyCard
                key={f.id}
                faculty={f}
                availabilityMap={availabilityMap}
                allAvailability={allAvailability}
                selectedSemesterId={selectedSemesterId}
                onSave={handleSave}
                isSaving={saveMutation.isPending}
              />
            ))}
          </div>
        )
      })()}
    </div>
    </RoleGuard>
  )
}
