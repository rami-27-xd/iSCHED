"use client"

import { useMemo } from "react"
import FullCalendar from "@fullcalendar/react"
import timeGridPlugin from "@fullcalendar/timegrid"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import type { EventInput, EventContentArg } from "@fullcalendar/core"

interface ScheduleEntry {
  id: string
  subjectCode: string
  subjectTitle: string
  facultyName: string
  roomCode: string
  sectionName: string
  day: string
  startTime: string
  endTime: string
  type: "LECTURE" | "LABORATORY" | "HYBRID"
  hasConflict?: boolean
}

interface ScheduleCalendarProps {
  entries: ScheduleEntry[]
  editable?: boolean
  onEntryClick?: (entryId: string) => void
  onEntryDrop?: (entryId: string, newDay: string, newStart: string, newEnd: string) => void
}

const DAY_MAP: Record<string, number> = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
}

const TYPE_COLORS = {
  LECTURE: { bg: "#1B4332", border: "#1B4332" },
  LABORATORY: { bg: "#2D6A4F", border: "#2D6A4F" },
  HYBRID: { bg: "#40916C", border: "#40916C" },
}

const CONFLICT_COLOR = { bg: "#DC2626", border: "#DC2626" }

function renderEventContent(eventInfo: EventContentArg) {
  const props = eventInfo.event.extendedProps as ScheduleEntry
  return (
    <div className="px-1.5 py-1 text-xs overflow-hidden leading-tight">
      <div className="font-semibold truncate">{props.subjectCode}</div>
      <div className="text-white/80 truncate">{props.facultyName}</div>
      <div className="text-white/70 truncate">{props.roomCode} &middot; {props.sectionName}</div>
    </div>
  )
}

export function ScheduleCalendar({
  entries,
  editable = false,
  onEntryClick,
  onEntryDrop,
}: ScheduleCalendarProps) {
  const events: EventInput[] = useMemo(
    () =>
      entries.map((entry) => {
        const colors = entry.hasConflict ? CONFLICT_COLOR : TYPE_COLORS[entry.type]
        return {
          id: entry.id,
          title: entry.subjectCode,
          daysOfWeek: [DAY_MAP[entry.day]],
          startTime: entry.startTime,
          endTime: entry.endTime,
          backgroundColor: colors.bg,
          borderColor: colors.border,
          textColor: "#FFFFFF",
          extendedProps: entry,
        }
      }),
    [entries]
  )

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden [&_.fc-theme-standard_td]:border-border [&_.fc-theme-standard_th]:border-border [&_.fc-scrollgrid]:border-border [&_.fc-col-header-cell]:bg-muted/50 [&_.fc-col-header-cell]:py-2 [&_.fc-col-header-cell-cushion]:text-sm [&_.fc-col-header-cell-cushion]:font-medium [&_.fc-col-header-cell-cushion]:text-foreground [&_.fc-timegrid-slot-label-cushion]:text-xs [&_.fc-timegrid-slot-label-cushion]:text-muted-foreground [&_.fc-button-primary]:bg-primary [&_.fc-button-primary]:border-primary [&_.fc-button-primary:hover]:bg-primary/90 [&_.fc-button-active]:!bg-primary/80 [&_.fc-toolbar-title]:text-base [&_.fc-toolbar-title]:font-semibold">
      <FullCalendar
        plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "timeGridWeek,timeGridDay",
        }}
        slotMinTime="07:00:00"
        slotMaxTime="21:00:00"
        slotDuration="00:30:00"
        allDaySlot={false}
        weekends={false}
        events={events}
        editable={editable}
        eventContent={renderEventContent}
        eventClick={(info) => onEntryClick?.(info.event.id)}
        eventDrop={(info) => {
          const start = info.event.start
          if (start && onEntryDrop) {
            const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
            onEntryDrop(
              info.event.id,
              days[start.getDay()],
              start.toTimeString().slice(0, 5),
              info.event.end?.toTimeString().slice(0, 5) ?? ""
            )
          }
        }}
        height="auto"
        expandRows
        dayHeaderFormat={{ weekday: "short" }}
      />
    </div>
  )
}
