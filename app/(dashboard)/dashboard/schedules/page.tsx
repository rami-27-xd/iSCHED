"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { PageHeader } from "@/components/shared/page-header"
import { ScheduleCalendar } from "@/components/schedule/schedule-calendar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CalendarDays,
  Globe,
  BellRing,
  BookOpen,
  Filter,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MoreHorizontal,
  Trash2,
  Archive,
  ArchiveRestore,
  FileDown,
  Cpu,
  Undo2,
  Search,
} from "lucide-react"
import { toast } from "sonner"
import {
  useSchedules,
  useSchedule,
  useCreateSchedule,
  useGenerateSchedule,
  useCreateEntry,
  useUpdateEntry,
  useDeleteEntry,
  useDeleteSchedule,
  usePublishSchedule,
  useUnpublishSchedule,
  useArchiveSchedule,
  useFaculty,
  useRooms,
} from "@/hooks/use-schedules"
import { useQuery } from "@tanstack/react-query"
import { Input } from "@/components/ui/input"
import { useSubjects, useSections } from "@/hooks/use-data"
import { RoleGuard } from "@/components/shared/role-guard"
import { useRealtimeSchedules } from "@/hooks/use-realtime"
import { getCurriculumCodes, hasCurriculumMap } from "@/lib/curriculum-map"
import { WorkflowActions } from "@/components/schedule/workflow-actions"
import { useCollege } from "@/lib/college-context"

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]

const TIME_OPTIONS = Array.from({ length: 28 }, (_, i) => {
  const totalMins = 7 * 60 + 30 + i * 30
  const h = String(Math.floor(totalMins / 60)).padStart(2, "0")
  const m = String(totalMins % 60).padStart(2, "0")
  return `${h}:${m}`
})

function ScheduleStatusBadge({ status }: { status?: string }) {
  if (!status) return null
  const variants: Record<string, { label: string; className: string }> = {
    DRAFT: { label: "Draft", className: "bg-muted text-muted-foreground" },
    PENDING_APPROVAL: { label: "Pending", className: "bg-yellow-100 text-yellow-800" },
    PUBLISHED: { label: "Published", className: "bg-green-100 text-green-800" },
    ARCHIVED: { label: "Archived", className: "bg-secondary text-secondary-foreground" },
  }
  const v = variants[status] ?? variants.DRAFT
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${v.className}`}>
      {v.label}
    </span>
  )
}

export default function SchedulesPage() {
  const [tab, setTab] = useState("active")
  const [deptFilter, setDeptFilter] = useState("")   // department filter inside the schedule list
  const [view, setView] = useState("list")
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null)

  // ── Supabase Realtime: live updates when other users add/edit/delete entries ──
  useRealtimeSchedules(selectedScheduleId)
  const [createOpen, setCreateOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [addEntryOpen, setAddEntryOpen] = useState(false)
  const [newSemType, setNewSemType] = useState("")
  const [newSchoolYear, setNewSchoolYear] = useState("")
  const [newStartDate, setNewStartDate] = useState("")
  const [newEndDate, setNewEndDate] = useState("")

  const [entryForm, setEntryForm] = useState({
    subjectId: "",
    facultyId: "",
    facultyName: "",   // free-text override — sent alongside facultyId
    roomId: "",
    sectionId: "",
    day: "",
    startTime: "",
    endTime: "",
    set: "" as "" | "A" | "B",
  })
  // Controls the faculty autocomplete dropdown visibility
  const [facultySearch, setFacultySearch] = useState("")
  const [facultyDropdownOpen, setFacultyDropdownOpen] = useState(false)
  const facultyComboRef = useRef<HTMLDivElement>(null)

  // Delete confirmation dialog
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  // Pre-publish validation dialog
  const [publishValidationOpen, setPublishValidationOpen] = useState(false)
  const [publishValidation, setPublishValidation] = useState<{
    loading: boolean
    errors: { type: string; description: string }[]
    warnings: { type: string; description: string }[]
    entryCount: number
  }>({ loading: false, errors: [], warnings: [], entryCount: 0 })

  const [sectionSearch, setSectionSearch] = useState("")
  const [sectionDropdownOpen, setSectionDropdownOpen] = useState(false)
  const sectionComboRef = useRef<HTMLDivElement>(null)

  // Close section dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sectionComboRef.current && !sectionComboRef.current.contains(e.target as Node)) {
        setSectionDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Close faculty autocomplete dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (facultyComboRef.current && !facultyComboRef.current.contains(e.target as Node)) {
        setFacultyDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Fetch current user role for access control
  const { data: currentUser } = useQuery({
    queryKey: ["current-user-role"],
    queryFn: async () => {
      const res = await fetch("/api/users/me")
      const json = await res.json()
      if (!res.ok) return { role: "FACULTY" }
      return json.data ?? { role: "FACULTY" }
    },
  })
  const userRole = (currentUser?.role ?? "FACULTY") as string
  const isSuperAdmin = userRole === "SUPER_ADMIN"
  const isAdmin = userRole === "ADMIN"

  // College filter from topbar — SUPER_ADMINs (Dept Chairs) always see ALL schedules
  // because they inject GEC subjects into every program's schedule after submission.
  // ADMIN (Program Chair) keeps the college filter.
  const { selectedCollegeId } = useCollege()
  const scheduleCollegeFilter = isSuperAdmin ? undefined : selectedCollegeId

  const { data: activeSchedules = [], isLoading: loadingActive } = useSchedules(undefined, false, scheduleCollegeFilter)
  const { data: archivedSchedules = [], isLoading: loadingArchived } = useSchedules(undefined, true, scheduleCollegeFilter)
  const { data: selectedSchedule, isLoading: loadingSchedule } = useSchedule(selectedScheduleId)
  // Derive schedule semester type (FIRST | SECOND | SUMMER) for subject filtering
  const scheduleSemesterType = selectedSchedule?.semester?.type as string | undefined
  // Fetch ALL subjects (no semester filter) — the curriculum map handles semester placement
  const { data: subjects = [] } = useSubjects()
  const { data: facultyList = [] } = useFaculty()
  const { data: rooms = [] } = useRooms()
  const { data: sections = [] } = useSections()

  // Department-restricted rooms: only rooms in buildings assigned to the
  // schedule's department. Falls back to all rooms if no department is set.
  const scheduleDeptId = selectedSchedule?.departmentId ?? selectedSchedule?.department?.id
  const { data: departmentRooms = [] } = useQuery({
    queryKey: ["rooms-by-department", scheduleDeptId],
    queryFn: async () => {
      if (!scheduleDeptId) return rooms
      const res = await fetch(`/api/rooms?departmentId=${scheduleDeptId}`)
      const json = await res.json()
      if (!res.ok) return rooms
      return json.data ?? rooms
    },
    enabled: !!scheduleDeptId,
    staleTime: 60_000,
  })

  // Fetch availability for the selected faculty (for time slot filtering in Add Entry)
  const { data: facultyAvailability = [] } = useQuery({
    queryKey: ["faculty-availability-entry", entryForm.facultyId, selectedSchedule?.semesterId],
    queryFn: async () => {
      if (!entryForm.facultyId || !selectedSchedule?.semesterId) return []
      const res = await fetch(`/api/faculty/availability?facultyId=${entryForm.facultyId}&semesterId=${selectedSchedule.semesterId}`)
      const json = await res.json()
      if (!res.ok) return []
      return json.data ?? []
    },
    enabled: !!entryForm.facultyId && !!selectedSchedule?.semesterId,
  })

  // Issue 3c: Filter subjects by selected faculty's department + specializations
  const selectedFacultyForEntry = useMemo(() => facultyList.find((f: any) => f.id === entryForm.facultyId), [facultyList, entryForm.facultyId])
  const selectedSubjectForEntry = useMemo(() => subjects.find((s: any) => s.id === entryForm.subjectId), [subjects, entryForm.subjectId])
  const selectedSectionForEntry = useMemo(() => sections.find((s: any) => s.id === entryForm.sectionId), [sections, entryForm.sectionId])

  const filteredSubjects = useMemo(() => {
    let pool = subjects

    // 1. If a section is selected, filter subjects by the section's program + year level using curriculum map
    if (entryForm.sectionId && selectedSectionForEntry) {
      const progAbbr = selectedSectionForEntry.yearLevel?.program?.abbreviation
      const yearLevel = selectedSectionForEntry.yearLevel?.level
      const sem = scheduleSemesterType as "FIRST" | "SECOND" | undefined

      if (progAbbr && yearLevel && sem && hasCurriculumMap(progAbbr)) {
        // Get exact subject codes for this program/year/semester from curriculum map
        const codes = getCurriculumCodes(progAbbr, yearLevel, sem)
        const codeSetLower = new Set(codes.map(c => c.toLowerCase()))
        pool = pool.filter((s: any) => codeSetLower.has((s.code ?? "").toLowerCase()))
      } else if (yearLevel) {
        // Fallback: filter by year level if no curriculum map
        pool = pool.filter((s: any) => s.year === yearLevel)
      }

      // Exclude subjects already scheduled for this section in the current schedule
      // (prevents adding GEC01 twice to the same section across semesters)
      const scheduleEntries: any[] = selectedSchedule?.entries ?? []
      const alreadyScheduledCodes = new Set(
        scheduleEntries
          .filter((e: any) => (e.sectionId ?? e.section?.id) === entryForm.sectionId)
          .map((e: any) => (e.subject?.code ?? "").toLowerCase())
          .filter(Boolean)
      )
      if (alreadyScheduledCodes.size > 0) {
        pool = pool.filter((s: any) => !alreadyScheduledCodes.has((s.code ?? "").toLowerCase()))
      }
    } else if (scheduleSemesterType) {
      // 2. No section selected yet — use curriculum map to get ALL codes for this semester across all programs
      //    This ensures only subjects from the correct semester are shown
      const semCodesLower = new Set<string>()
      const programAbbrs = sections
        .map((s: any) => s.yearLevel?.program?.abbreviation)
        .filter((a: string | undefined) => a && hasCurriculumMap(a))
      const uniquePrograms = [...new Set(programAbbrs)] as string[]
      for (const progAbbr of uniquePrograms) {
        for (let yr = 1; yr <= 4; yr++) {
          getCurriculumCodes(progAbbr, yr, scheduleSemesterType as "FIRST" | "SECOND")
            .forEach(c => semCodesLower.add(c.toLowerCase()))
        }
      }
      if (semCodesLower.size > 0) {
        pool = pool.filter((s: any) => semCodesLower.has((s.code ?? "").toLowerCase()))
      }
    }

    // 3. Faculty specialization filtering
    if (entryForm.facultyId && selectedFacultyForEntry) {
      const specs: string[] = selectedFacultyForEntry.specializations ?? []
      if (specs.length > 0) {
        const specLower = specs.map((sp: string) => sp.toLowerCase().trim())
        const matched = pool.filter((s: any) => {
          const titleLower = (s.title ?? "").toLowerCase().trim()
          return specLower.some((sp: string) => sp === titleLower || titleLower.includes(sp) || sp.includes(titleLower))
        })
        if (matched.length > 0) return matched
      }
    }

    // Always include the pre-selected subject (set via "Manually Assign") even if
    // curriculum-map filtering would exclude it (e.g. wrong year slot or cross-program subject).
    if (entryForm.subjectId && !pool.some((s: any) => s.id === entryForm.subjectId)) {
      const forced = subjects.find((s: any) => s.id === entryForm.subjectId)
      if (forced) pool = [forced, ...pool]
    }

    return pool
  }, [subjects, entryForm.facultyId, entryForm.sectionId, entryForm.subjectId, selectedFacultyForEntry, selectedSectionForEntry, scheduleSemesterType, sections, selectedSchedule])

  // Bidirectional: when subject is selected, show only faculty whose specializations match
  // Always exclude inactive faculty
  const filteredFaculty = useMemo(() => {
    const activeFaculty = facultyList.filter((f: any) => f.isActive !== false && f.user?.isActive !== false)

    // Scope to the subject's department so each user sees relevant faculty:
    // SUPER_ADMIN selecting a GEC subject sees CAS faculty; ADMIN selecting ITE sees CIT faculty.
    // Falls back to all active faculty if the subject's dept has no matching faculty records.
    const subjectDeptId = selectedSubjectForEntry?.departmentId
    const deptScoped = subjectDeptId
      ? activeFaculty.filter((f: any) => f.departmentId === subjectDeptId)
      : activeFaculty
    const pool = deptScoped.length > 0 ? deptScoped : activeFaculty

    if (!entryForm.subjectId || !selectedSubjectForEntry) return pool
    const subjectTitle = (selectedSubjectForEntry.title ?? "").toLowerCase()
    if (!subjectTitle) return pool
    const matched = pool.filter((f: any) => {
      const specs: string[] = f.specializations ?? []
      if (specs.length === 0) return false
      return specs.some((sp: string) => sp.toLowerCase() === subjectTitle || subjectTitle.includes(sp.toLowerCase()))
    })
    return matched.length > 0 ? matched : pool
  }, [facultyList, entryForm.subjectId, selectedSubjectForEntry])

  // Filter rooms by subject type AND department-building restriction.
  // Uses departmentRooms (already filtered to the dept's buildings) as the source pool.
  const filteredRooms = useMemo(() => {
    // Use department-restricted rooms when available, fall back to all rooms
    const pool = departmentRooms.length > 0 ? departmentRooms : rooms
    if (!entryForm.subjectId || !selectedSubjectForEntry) return pool
    const subjectType = selectedSubjectForEntry.type
    if (subjectType === 'LABORATORY') {
      const labs = pool.filter((r: any) => r.type === 'LABORATORY' || r.type === 'COMPUTER_LAB' || r.type === 'LECTURE_LAB')
      return labs.length > 0 ? labs : pool
    }
    if (subjectType === 'LECTURE') {
      const lectureRooms = pool.filter((r: any) => r.type === 'LECTURE_ROOM')
      return lectureRooms.length > 0 ? lectureRooms : pool
    }
    return pool
  }, [rooms, departmentRooms, entryForm.subjectId, selectedSubjectForEntry])

  // Issue 9: Filter time options based on faculty availability for selected day
  const availableTimeOptions = useMemo(() => {
    if (!entryForm.facultyId || !entryForm.day || facultyAvailability.length === 0) return TIME_OPTIONS
    const daySlots = facultyAvailability.filter((a: any) => a.day === entryForm.day)
    if (daySlots.length === 0) return TIME_OPTIONS // no availability data = show all
    return TIME_OPTIONS.filter((t) => {
      const tMins = parseInt(t.split(":")[0]) * 60 + parseInt(t.split(":")[1])
      return daySlots.some((slot: any) => {
        const startMins = parseInt(slot.startTime.split(":")[0]) * 60 + parseInt(slot.startTime.split(":")[1])
        const endMins = parseInt(slot.endTime.split(":")[0]) * 60 + parseInt(slot.endTime.split(":")[1])
        return tMins >= startMins && tMins < endMins
      })
    })
  }, [entryForm.facultyId, entryForm.day, facultyAvailability])

  // Filter sections by subject year level, department alignment + search text
  // ADMIN (Program Chair): restrict sections to their own department
  const adminDeptId = isAdmin ? (currentUser?.departmentId ?? currentUser?.programHead?.program?.department?.id ?? null) : null

  const filteredSections = useMemo(() => {
    let result = sections as any[]

    // ADMIN (Program Chair): only show sections from their department
    if (adminDeptId) {
      result = result.filter((s: any) => s.yearLevel?.program?.departmentId === adminDeptId)
    }

    if (entryForm.subjectId && selectedSubjectForEntry) {
      const subjectCode = selectedSubjectForEntry.code ?? ""
      const isShared = subjectCode.startsWith("GEC") || subjectCode.startsWith("GEL") ||
        subjectCode.startsWith("PATHFIT") || subjectCode.startsWith("PATHFit") ||
        subjectCode.startsWith("NST") || subjectCode.startsWith("NSTP")

      if (!isShared) {
        // Major subject — use curriculum map to find which programs have this subject
        const sem = scheduleSemesterType as "FIRST" | "SECOND" | undefined
        if (sem) {
          const matchingPrograms = new Set<string>()
          const matchingYears = new Map<string, number[]>()
          for (const sec of result) {
            const progAbbr = sec.yearLevel?.program?.abbreviation
            const yl = sec.yearLevel?.level
            if (!progAbbr || !yl || !hasCurriculumMap(progAbbr)) continue
            const codes = getCurriculumCodes(progAbbr, yl, sem)
            if (codes.some(c => c.toLowerCase() === subjectCode.toLowerCase())) {
              matchingPrograms.add(progAbbr)
              if (!matchingYears.has(progAbbr)) matchingYears.set(progAbbr, [])
              matchingYears.get(progAbbr)!.push(yl)
            }
          }
          if (matchingPrograms.size > 0) {
            result = result.filter((s: any) => {
              const progAbbr = s.yearLevel?.program?.abbreviation
              const yl = s.yearLevel?.level
              return progAbbr && matchingYears.get(progAbbr)?.includes(yl)
            })
          }
        }
      }
      // For shared subjects (GEC/PATHFit/NST): show all sections (any program can use them)
    }

    // Filter by search text
    if (sectionSearch.trim()) {
      const q = sectionSearch.toLowerCase().trim()
      result = result.filter((s: any) => s.name.toLowerCase().includes(q))
    }
    return result
  }, [sections, entryForm.subjectId, selectedSubjectForEntry, sectionSearch, adminDeptId, scheduleSemesterType])

  // Filter days by faculty availability — only show days where faculty has availability set
  const availableDays = useMemo(() => {
    if (!entryForm.facultyId || facultyAvailability.length === 0) return DAYS
    const daysWithAvail = [...new Set(facultyAvailability.map((a: any) => a.day))]
    const filtered = DAYS.filter((d) => daysWithAvail.includes(d))
    return filtered.length > 0 ? filtered : DAYS
  }, [entryForm.facultyId, facultyAvailability])

  // Conflict override dialog state (soft-validation)
  const [conflictMessage, setConflictMessage] = useState<string | null>(null)
  const [pendingForceChanges, setPendingForceChanges] = useState<Record<string, unknown> | null>(null)
  const [forceEntryId, setForceEntryId] = useState<string | null>(null)

  // Edit entry state
  const [editEntryOpen, setEditEntryOpen] = useState(false)
  const [editEntryId, setEditEntryId] = useState<string | null>(null)
  const [editEntryForm, setEditEntryForm] = useState({
    subjectId: "",
    facultyId: "",
    roomId: "",
    sectionId: "",
    day: "",
    startTime: "",
    endTime: "",
    set: "" as "" | "A" | "B",
  })
  const [editSectionSearch, setEditSectionSearch] = useState("")
  const [editSectionDropdownOpen, setEditSectionDropdownOpen] = useState(false)
  const editSectionComboRef = useRef<HTMLDivElement>(null)

  // Close edit section dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (editSectionComboRef.current && !editSectionComboRef.current.contains(e.target as Node)) {
        setEditSectionDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Fetch availability for edit form faculty
  const { data: editFacultyAvailability = [] } = useQuery({
    queryKey: ["faculty-availability-edit", editEntryForm.facultyId, selectedSchedule?.semesterId],
    queryFn: async () => {
      if (!editEntryForm.facultyId || !selectedSchedule?.semesterId) return []
      const res = await fetch(`/api/faculty/availability?facultyId=${editEntryForm.facultyId}&semesterId=${selectedSchedule.semesterId}`)
      const json = await res.json()
      if (!res.ok) return []
      return json.data ?? []
    },
    enabled: !!editEntryForm.facultyId && !!selectedSchedule?.semesterId,
  })

  // Edit: selected faculty & subject lookups
  const editSelectedFaculty = useMemo(() => facultyList.find((f: any) => f.id === editEntryForm.facultyId), [facultyList, editEntryForm.facultyId])
  const editSelectedSubject = useMemo(() => subjects.find((s: any) => s.id === editEntryForm.subjectId), [subjects, editEntryForm.subjectId])

  // Edit: filter subjects by selected faculty's specializations
  const editFilteredSubjects = useMemo(() => {
    let pool = subjects

    // Exclude subjects already fully-scheduled for this section, except:
    // - the entry currently being edited (always keep its subject in the pool)
    // - lab subjects with A/B sets: editing Set-A should not block the same subject
    //   just because Set-B is also scheduled for the section
    if (editEntryForm.sectionId) {
      const scheduleEntries: any[] = selectedSchedule?.entries ?? []
      const currentEntry = scheduleEntries.find((e: any) => e.id === editEntryId)
      const currentSet = currentEntry?.set ?? editEntryForm.set ?? null

      const alreadyScheduledCodes = new Set(
        scheduleEntries
          .filter((e: any) => {
            if ((e.sectionId ?? e.section?.id) !== editEntryForm.sectionId) return false
            if (e.id === editEntryId) return false
            // Same subject with the same set as the entry being edited → sibling set entry;
            // don't let it block the subject from appearing in the dropdown.
            const sameSubjectCode = (e.subject?.code ?? "").toLowerCase() ===
              (currentEntry?.subject?.code ?? "").toLowerCase()
            if (sameSubjectCode && currentSet && e.set && e.set !== currentSet) return false
            return true
          })
          .map((e: any) => (e.subject?.code ?? "").toLowerCase())
          .filter(Boolean)
      )
      if (alreadyScheduledCodes.size > 0) {
        pool = pool.filter((s: any) => !alreadyScheduledCodes.has((s.code ?? "").toLowerCase()))
      }
    }

    if (!editEntryForm.facultyId || !editSelectedFaculty) return pool
    const specs: string[] = editSelectedFaculty.specializations ?? []
    if (specs.length > 0) {
      const specLower = specs.map((sp: string) => sp.toLowerCase().trim())
      const matched = pool.filter((s: any) => {
        const titleLower = (s.title ?? "").toLowerCase().trim()
        return specLower.some((sp: string) => sp === titleLower || titleLower.includes(sp) || sp.includes(titleLower))
      })
      if (matched.length > 0) return matched
    }
    return pool
  }, [subjects, editEntryForm.facultyId, editEntryForm.sectionId, editEntryForm.set, editSelectedFaculty, selectedSchedule, editEntryId])

  // Edit: filter faculty by selected subject
  const editFilteredFaculty = useMemo(() => {
    const activeFaculty = facultyList.filter((f: any) => f.isActive !== false && f.user?.isActive !== false)
    if (!editEntryForm.subjectId || !editSelectedSubject) return activeFaculty
    const subjectTitle = (editSelectedSubject.title ?? "").toLowerCase()
    if (!subjectTitle) return activeFaculty
    const matched = activeFaculty.filter((f: any) => {
      const specs: string[] = f.specializations ?? []
      if (specs.length === 0) return false
      return specs.some((sp: string) => sp.toLowerCase() === subjectTitle || subjectTitle.includes(sp.toLowerCase()))
    })
    return matched.length > 0 ? matched : activeFaculty
  }, [facultyList, editEntryForm.subjectId, editSelectedSubject])

  // Edit: filter rooms by subject's required room type, falling back to subject type
  const editFilteredRooms = useMemo(() => {
    if (!editEntryForm.subjectId || !editSelectedSubject) return rooms
    // Prefer explicit requiredRoomType list set on the subject
    const requiredTypes: string[] = editSelectedSubject.requiredRoomType ?? []
    if (requiredTypes.length > 0) {
      const filtered = rooms.filter((r: any) => requiredTypes.includes(r.type))
      return filtered.length > 0 ? filtered : rooms
    }
    // Fall back: lab subjects can use any lab-category room
    const subjectType = editSelectedSubject.type
    if (subjectType === 'LABORATORY') {
      const labs = rooms.filter((r: any) =>
        r.type === 'LABORATORY' || r.type === 'COMPUTER_LAB' || r.type === 'LECTURE_LAB'
      )
      return labs.length > 0 ? labs : rooms
    }
    if (subjectType === 'LECTURE') {
      const lectureRooms = rooms.filter((r: any) => r.type === 'LECTURE_ROOM')
      return lectureRooms.length > 0 ? lectureRooms : rooms
    }
    return rooms
  }, [rooms, editEntryForm.subjectId, editSelectedSubject])

  // Edit: filter sections by subject alignment (year level + department)
  const editFilteredSections = useMemo(() => {
    let result = sections as any[]

    // ADMIN (Program Chair): only show sections from their department
    if (adminDeptId) {
      result = result.filter((s: any) => s.yearLevel?.program?.departmentId === adminDeptId)
    }

    if (editEntryForm.subjectId && editSelectedSubject) {
      const subjectYear = editSelectedSubject.year ?? editSelectedSubject.yearLevel?.level
      const subjectDeptId = editSelectedSubject.departmentId ?? editSelectedSubject.department?.id
      const subjectYearLevelId = editSelectedSubject.yearLevelId

      if (subjectYearLevelId) {
        const ylFiltered = result.filter((s: any) => s.yearLevelId === subjectYearLevelId)
        if (ylFiltered.length > 0) result = ylFiltered
      } else {
        // Non-GEC/PATHFIT subjects can only be assigned to sections in the same department
        const subjectCode = editSelectedSubject.code ?? ""
        const isGEC = subjectCode.startsWith("GEC") || subjectCode.startsWith("PATHFIT")

        if (subjectDeptId && !isGEC) {
          const deptFiltered = result.filter((s: any) => s.yearLevel?.program?.departmentId === subjectDeptId)
          if (deptFiltered.length > 0) result = deptFiltered
        }
        if (subjectYear) {
          const yearFiltered = result.filter((s: any) => (s.yearLevel?.level ?? 0) === subjectYear)
          if (yearFiltered.length > 0) result = yearFiltered
        }
      }
    }
    if (editSectionSearch.trim()) {
      const q = editSectionSearch.toLowerCase().trim()
      result = result.filter((s: any) => s.name.toLowerCase().includes(q))
    }
    return result
  }, [sections, editEntryForm.subjectId, editSelectedSubject, editSectionSearch, adminDeptId])

  // Edit: filter days by faculty availability
  const editAvailableDays = useMemo(() => {
    if (!editEntryForm.facultyId || editFacultyAvailability.length === 0) return DAYS
    const daysWithAvail = [...new Set(editFacultyAvailability.map((a: any) => a.day))]
    const filtered = DAYS.filter((d) => daysWithAvail.includes(d))
    return filtered.length > 0 ? filtered : DAYS
  }, [editEntryForm.facultyId, editFacultyAvailability])

  // Edit: filter time options by faculty availability for selected day
  const editAvailableTimeOptions = useMemo(() => {
    if (!editEntryForm.facultyId || !editEntryForm.day || editFacultyAvailability.length === 0) return TIME_OPTIONS
    const daySlots = editFacultyAvailability.filter((a: any) => a.day === editEntryForm.day)
    if (daySlots.length === 0) return TIME_OPTIONS
    return TIME_OPTIONS.filter((t) => {
      const tMins = parseInt(t.split(":")[0]) * 60 + parseInt(t.split(":")[1])
      return daySlots.some((slot: any) => {
        const startMins = parseInt(slot.startTime.split(":")[0]) * 60 + parseInt(slot.startTime.split(":")[1])
        const endMins = parseInt(slot.endTime.split(":")[0]) * 60 + parseInt(slot.endTime.split(":")[1])
        return tMins >= startMins && tMins < endMins
      })
    })
  }, [editEntryForm.facultyId, editEntryForm.day, editFacultyAvailability])

  // Entry filters (shared across list + calendar views)
  const [calFilterFaculty, setCalFilterFaculty] = useState("")
  const [calFilterSection, setCalFilterSection] = useState("")
  const [calFilterRoom, setCalFilterRoom] = useState("")
  const [entrySearch, setEntrySearch] = useState("")

  const createSchedule = useCreateSchedule()
  const generateSchedule = useGenerateSchedule()
  const createEntry = useCreateEntry()
  const updateEntry = useUpdateEntry()
  const deleteEntry = useDeleteEntry()
  const deleteSchedule = useDeleteSchedule()
  const publishSchedule = usePublishSchedule()
  const unpublishSchedule = useUnpublishSchedule()
  const archiveSchedule = useArchiveSchedule()

  const isLoading = tab === "active" ? loadingActive : loadingArchived

  // Build unique department options from every schedule we received (both tabs)
  // so the filter dropdown is stable and doesn't jump when switching tabs.
  const deptOptions = useMemo(() => {
    const map = new Map<string, string>()
    const allSchedules = [...activeSchedules as any[], ...archivedSchedules as any[]]
    const visible = isAdmin && adminDeptId
      ? allSchedules.filter((s: any) => (s.departmentId ?? s.department?.id) === adminDeptId)
      : allSchedules
    visible.forEach((s: any) => {
      if (s.department?.id)
        map.set(s.department.id, s.department.abbreviation ?? s.department.name ?? "")
    })
    return Array.from(map, ([id, label]) => ({ id, label })).sort((a, b) =>
      a.label.localeCompare(b.label)
    )
  }, [activeSchedules, archivedSchedules, isAdmin, adminDeptId])

  // Apply dept filter on top of the active/archived tab selection.
  // ADMIN (Program Chair): only show their own department's schedules.
  const visibleActiveCount = useMemo(() => {
    if (!isAdmin || !adminDeptId) return (activeSchedules as any[]).length
    return (activeSchedules as any[]).filter((s: any) => (s.departmentId ?? s.department?.id) === adminDeptId).length
  }, [activeSchedules, isAdmin, adminDeptId])

  const visibleArchivedCount = useMemo(() => {
    if (!isAdmin || !adminDeptId) return (archivedSchedules as any[]).length
    return (archivedSchedules as any[]).filter((s: any) => (s.departmentId ?? s.department?.id) === adminDeptId).length
  }, [archivedSchedules, isAdmin, adminDeptId])

  const schedules = useMemo(() => {
    let base = tab === "active" ? activeSchedules as any[] : archivedSchedules as any[]
    if (isAdmin && adminDeptId) {
      base = base.filter((s: any) => (s.departmentId ?? s.department?.id) === adminDeptId)
    }
    if (!deptFilter) return base
    return base.filter((s: any) => s.department?.id === deptFilter)
  }, [tab, activeSchedules, archivedSchedules, deptFilter, isAdmin, adminDeptId])

  const entries: any[] = selectedSchedule?.entries ?? []

  // ── Constraint-based occupied slot detection ──
  // Check which time slots are occupied by existing entries for selected faculty/room/section on the selected day
  const toMinsHelper = (t: string) => parseInt(t.split(":")[0]) * 60 + parseInt(t.split(":")[1])

  const occupiedSlots = useMemo(() => {
    if (!entryForm.day) return { faculty: [] as string[], room: [] as string[], section: [] as string[] }
    const sameDayEntries = entries.filter((e: any) => e.day === entryForm.day)

    const getOccupiedTimes = (filteredEntries: any[]) => {
      const occupied: string[] = []
      for (const e of filteredEntries) {
        const s = toMinsHelper(e.startTime)
        const end = toMinsHelper(e.endTime)
        for (const t of TIME_OPTIONS) {
          const tMins = toMinsHelper(t)
          if (tMins >= s && tMins < end) occupied.push(t)
        }
      }
      return occupied
    }

    return {
      faculty: entryForm.facultyId ? getOccupiedTimes(sameDayEntries.filter((e: any) => (e.facultyId || e.faculty?.id) === entryForm.facultyId)) : [],
      room: entryForm.roomId ? getOccupiedTimes(sameDayEntries.filter((e: any) => (e.roomId || e.room?.id) === entryForm.roomId)) : [],
      section: entryForm.sectionId ? getOccupiedTimes(sameDayEntries.filter((e: any) => (e.sectionId || e.section?.id) === entryForm.sectionId)) : [],
    }
  }, [entries, entryForm.day, entryForm.facultyId, entryForm.roomId, entryForm.sectionId])

  // Merge all occupied slots to show constraint-aware start times
  const constraintFilteredStartTimes = useMemo(() => {
    const allOccupied = new Set([...occupiedSlots.faculty, ...occupiedSlots.room, ...occupiedSlots.section])
    return availableTimeOptions.map((t) => ({
      time: t,
      available: !allOccupied.has(t),
      reasons: [
        ...(occupiedSlots.faculty.includes(t) ? ["Faculty busy"] : []),
        ...(occupiedSlots.room.includes(t) ? ["Room taken"] : []),
        ...(occupiedSlots.section.includes(t) ? ["Section busy"] : []),
      ],
    }))
  }, [availableTimeOptions, occupiedSlots])

  // For end time: additionally block slots that would overlap with the next occupied block after startTime
  const constraintFilteredEndTimes = useMemo(() => {
    if (!entryForm.startTime) return []
    const startMins = toMinsHelper(entryForm.startTime)
    const allOccupied = new Set([...occupiedSlots.faculty, ...occupiedSlots.room, ...occupiedSlots.section])

    // Find the first occupied slot after startTime to cap end time
    const nextOccupied = availableTimeOptions
      .filter((t) => toMinsHelper(t) > startMins && allOccupied.has(t))
      .sort((a, b) => toMinsHelper(a) - toMinsHelper(b))[0]
    const maxEnd = nextOccupied ? toMinsHelper(nextOccupied) : Infinity

    return availableTimeOptions
      .filter((t) => toMinsHelper(t) > startMins && toMinsHelper(t) <= maxEnd)
      .map((t) => ({ time: t, available: true }))
  }, [entryForm.startTime, availableTimeOptions, occupiedSlots])

  const isDraft = selectedSchedule?.status === "DRAFT"
  const isPendingApproval = selectedSchedule?.status === "PENDING_APPROVAL"
  const isPublished = selectedSchedule?.status === "PUBLISHED"
  // ── Permission model ──────────────────────────────────────────────────────
  // Dept Chair (SUPER_ADMIN):
  //   - Can add/edit/generate entries on PENDING_APPROVAL and PUBLISHED
  //   - Can approve/reject on PENDING_APPROVAL, unpublish on PUBLISHED
  // Program Chair (ADMIN):
  //   - Owns the DRAFT: adds entries and submits for review
  //   - After submission, schedule is locked until Dept Chair acts
  // ── Three-step scheduling workflow ───────────────────────────────────────
  // Step 1 (Dept Chair): Initializes schedule framework, sets room availability.
  // Step 2 (Program Chair): Generates/manually adds major subjects. Submits for review.
  // Step 3 (Dept Chair): Reviews submitted majors, then generates GEC/minor subjects.
  //
  // SUPER_ADMIN also has full visibility of all Program Chair schedules to detect
  // room conflicts across colleges.

  // ADMIN can only modify schedules that belong to their own department.
  // Without this, an ADMIN sees the CAS Dept Chair's Published schedule and
  // incorrectly gets "Notify Faculty" / "Add Entry" buttons on it.
  const isOwnSchedule = !isAdmin || !selectedSchedule || (
    (selectedSchedule?.departmentId ?? selectedSchedule?.department?.id) === adminDeptId
  )

  const canModifyEntries = isSuperAdmin || (isAdmin && isOwnSchedule && isDraft)
  const canAddEntry = isSuperAdmin || (isAdmin && isOwnSchedule && isDraft)
  // Step 2: ADMIN generates major subjects on DRAFT only.
  // Step 3: SUPER_ADMIN generates GEC/minor subjects after at least one ADMIN has submitted.
  //   The API gate enforces this — the UI just needs to allow the button to show.
  const canGenerate =
    (isSuperAdmin) ||
    (isAdmin && isOwnSchedule && isDraft)
  // SUPER_ADMIN: publish from PENDING_APPROVAL (approve ADMIN submission). Can also directly publish DRAFT.
  // ADMIN: "Notify Faculty" action on an already-PUBLISHED schedule (does not change status)
  const canPublish = (isSuperAdmin && (isDraft || isPendingApproval)) || (isAdmin && isOwnSchedule && isPublished)
  const canUnpublish = isSuperAdmin && isPublished
  const canDelete = isSuperAdmin
  const currentUserId = currentUser?.id ?? ""
  const canEditEntry = (entry: any) => {
    if (isSuperAdmin && (isPendingApproval || isPublished)) return true
    // Program Chair: only their own entries, only while schedule is still DRAFT
    if (isAdmin && isOwnSchedule && isDraft && entry.createdBy && entry.createdBy === currentUserId) return true
    return false
  }

  // Apply entry filters (shared across list + calendar views)
  const filteredEntries = useMemo(() => {
    let result = entries
    if (calFilterFaculty) result = result.filter((e: any) => (e.facultyId === calFilterFaculty || e.faculty?.id === calFilterFaculty))
    if (calFilterSection) result = result.filter((e: any) => (e.sectionId === calFilterSection || e.section?.id === calFilterSection))
    if (calFilterRoom) result = result.filter((e: any) => (e.roomId === calFilterRoom || e.room?.id === calFilterRoom))
    if (entrySearch.trim()) {
      const q = entrySearch.toLowerCase().trim()
      result = result.filter((e: any) => {
        const code = (e.subject?.code ?? "").toLowerCase()
        const title = (e.subject?.title ?? "").toLowerCase()
        const faculty = `${e.faculty?.user?.firstName ?? ""} ${e.faculty?.user?.lastName ?? ""}`.toLowerCase()
        const room = (e.room?.code ?? "").toLowerCase()
        const section = (e.section?.name ?? "").toLowerCase()
        return code.includes(q) || title.includes(q) || faculty.includes(q) || room.includes(q) || section.includes(q)
      })
    }
    return result
  }, [entries, calFilterFaculty, calFilterSection, calFilterRoom, entrySearch])

  const calendarEntries = filteredEntries.map((e: any) => ({
    id: e.id,
    subjectCode: e.subject?.code ?? "",
    subjectTitle: e.subject?.title ?? "",
    facultyName: e.faculty?.user ? `${e.faculty.user.firstName} ${e.faculty.user.lastName}` : "",
    roomCode: e.room?.code ?? "",
    sectionName: e.section?.name ?? "",
    day: e.day,
    startTime: e.startTime,
    endTime: e.endTime,
    type: (e.subject?.type ?? "LECTURE") as "LECTURE" | "LABORATORY",
    set: e.set ?? null,
  }))

  // Unique faculty/sections/rooms in current schedule for filter dropdowns
  const entryFacultyOptions = useMemo(() => {
    const map = new Map<string, string>()
    entries.forEach((e: any) => {
      const fid = e.facultyId ?? e.faculty?.id
      if (fid && e.faculty?.user) map.set(fid, `${e.faculty.user.firstName} ${e.faculty.user.lastName}`)
    })
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [entries])

  const entrySectionOptions = useMemo(() => {
    const map = new Map<string, string>()
    entries.forEach((e: any) => {
      const sid = e.sectionId ?? e.section?.id
      if (sid && e.section?.name) map.set(sid, e.section.name)
    })
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [entries])

  const entryRoomOptions = useMemo(() => {
    const map = new Map<string, string>()
    entries.forEach((e: any) => {
      const rid = e.roomId ?? e.room?.id
      if (rid && e.room?.code) map.set(rid, e.room.code)
    })
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [entries])

  async function handleCreate() {
    if (!newSemType || !newSchoolYear || !newStartDate || !newEndDate) return toast.error("Please fill in all fields")
    const normalizedSY = newSchoolYear.trim().replace(/[\s_]+/, '-')
    if (!/^\d{4}-\d{4}$/.test(normalizedSY)) return toast.error("School year format: YYYY-YYYY (e.g. 2025-2026 or 2025 2026)")
    if (new Date(newStartDate) >= new Date(newEndDate)) return toast.error("End date must be after start date")
    try {
      const newSchedule = await createSchedule.mutateAsync({
        semesterType: newSemType,
        schoolYear: normalizedSY,
        startDate: newStartDate,
        endDate: newEndDate,
      })
      setCreateOpen(false)
      setNewSemType("")
      setNewSchoolYear("")
      setNewStartDate("")
      setNewEndDate("")
      // ── Auto-select the new schedule so it is immediately visible ──
      if (newSchedule?.id) {
        setTab("active")      // new schedules are always active
        setDeptFilter("")     // clear dept filter so it isn't hidden
        setSelectedScheduleId(newSchedule.id)
      }
      toast.success("Schedule created")
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const [generateError, setGenerateError] = useState<{ message: string; details: string[] } | null>(null)

  async function handleGenerate() {
    if (!selectedScheduleId) return
    setGenerateError(null)
    try {
      const genResult = await generateSchedule.mutateAsync(selectedScheduleId)
      setGenerateOpen(false)
      if (genResult?.unassignedCount > 0) {
        toast.warning(
          `${genResult.entriesGenerated} entries scheduled. ${genResult.unassignedCount} subject(s) could not be assigned — see the Unassigned Queue below.`,
          { duration: 8000 }
        )
      } else {
        toast.success(`Schedule generated: ${genResult?.entriesGenerated ?? "all"} entries assigned`)
      }
    } catch (err: any) {
      const details: string[] = err.details ?? []
      setGenerateError({ message: err.message, details })
      toast.error(err.message)
    }
  }

  async function handleAddEntry() {
    if (!selectedScheduleId) return
    const { subjectId, facultyId, facultyName, roomId, sectionId, day, startTime, endTime } = entryForm

    // Require either a linked faculty OR a free-text name
    if (!facultyId && !facultyName?.trim()) {
      return toast.error("Please enter a faculty name")
    }

    // Check if faculty has subjects available
    if (facultyId && filteredSubjects.length === 0) {
      return toast.error("No subjects found for this faculty's specialization. Please assign subjects in Courses / Departments first.")
    }
    // Check if subject has matching sections
    if (subjectId && filteredSections.length === 0) {
      return toast.error("No sections found for this subject. Please create sections in Courses / Departments first.")
    }

    if (!subjectId || !roomId || !sectionId || !day || !startTime || !endTime) {
      return toast.error("Please fill in all required fields")
    }

    // Inactive faculty check
    const selectedFacForAdd = facultyList.find((f: any) => f.id === facultyId)
    if (selectedFacForAdd && (selectedFacForAdd.isActive === false || selectedFacForAdd.user?.isActive === false)) {
      const fname = `${selectedFacForAdd.user?.firstName ?? ""} ${selectedFacForAdd.user?.lastName ?? ""}`.trim()
      return toast.error(`${fname || "This faculty member"} is inactive and cannot be assigned to a schedule entry`)
    }

    // Lab subjects require a set (A or B)
    if (selectedSubjectForEntry?.type === "LABORATORY" && !entryForm.set) {
      return toast.error("Please select a Set (A or B) for this laboratory subject")
    }

    // ── Constraint-based validation (backtracking principles applied inline) ──
    const toMins = (t: string) => parseInt(t.split(":")[0]) * 60 + parseInt(t.split(":")[1])
    const overlap = (s1: string, e1: string, s2: string, e2: string) => toMins(s1) < toMins(e2) && toMins(s2) < toMins(e1)
    const sameDayEntries = entries.filter((e: any) => e.day === day)

    // Specialization check — faculty must be qualified for the subject
    if (selectedFacultyForEntry && selectedSubjectForEntry) {
      const specs: string[] = selectedFacultyForEntry.specializations ?? []
      if (specs.length > 0) {
        const titleLower = (selectedSubjectForEntry.title ?? "").toLowerCase().trim()
        const hasMatch = specs.some((sp: string) => {
          const spLower = sp.toLowerCase().trim()
          return spLower === titleLower || titleLower.includes(spLower) || spLower.includes(titleLower)
        })
        if (!hasMatch) {
          const fname = `${selectedFacultyForEntry.user?.firstName ?? ""} ${selectedFacultyForEntry.user?.lastName ?? ""}`.trim()
          return toast.error(`${fname} does not have a specialization matching "${selectedSubjectForEntry.title}". Please assign a qualified faculty member.`)
        }
      }
    }

    // Faculty conflict
    const facultyConflict = sameDayEntries.find((e: any) =>
      (e.facultyId === facultyId || e.faculty?.id === facultyId) &&
      overlap(startTime, endTime, e.startTime, e.endTime)
    )
    if (facultyConflict) {
      const fname = facultyConflict.faculty?.user ? `${facultyConflict.faculty.user.firstName} ${facultyConflict.faculty.user.lastName}` : "This faculty"
      return toast.error(`${fname} already has a class at ${facultyConflict.startTime}–${facultyConflict.endTime} on ${day.charAt(0) + day.slice(1).toLowerCase()}`)
    }

    // Room conflict
    const roomConflict = sameDayEntries.find((e: any) =>
      (e.roomId === roomId || e.room?.id === roomId) &&
      overlap(startTime, endTime, e.startTime, e.endTime)
    )
    if (roomConflict) {
      return toast.error(`Room ${roomConflict.room?.code ?? ""} is already booked at ${roomConflict.startTime}–${roomConflict.endTime} on ${day.charAt(0) + day.slice(1).toLowerCase()}`)
    }

    // Section conflict — skip if both are lab entries with different sets
    const sectionConflict = sameDayEntries.find((e: any) =>
      (e.sectionId === sectionId || e.section?.id === sectionId) &&
      overlap(startTime, endTime, e.startTime, e.endTime) &&
      !(entryForm.set && e.set && entryForm.set !== e.set)
    )
    if (sectionConflict) {
      return toast.error(`Section ${sectionConflict.section?.name ?? ""} already has a class at ${sectionConflict.startTime}–${sectionConflict.endTime} on ${day.charAt(0) + day.slice(1).toLowerCase()}`)
    }

    // Faculty availability check
    if (facultyAvailability.length > 0) {
      const daySlots = facultyAvailability.filter((a: any) => a.day === day)
      const isWithinAvailability = daySlots.some((slot: any) =>
        toMins(slot.startTime) <= toMins(startTime) && toMins(slot.endTime) >= toMins(endTime)
      )
      if (!isWithinAvailability) {
        return toast.error("This time is outside the faculty's available hours for this day")
      }
    }

    try {
      await createEntry.mutateAsync({
        scheduleId: selectedScheduleId,
        entry: {
          ...entryForm,
          facultyName: entryForm.facultyName?.trim() || null,
        },
      })
      setAddEntryOpen(false)
      setEntryForm({ subjectId: "", facultyId: "", facultyName: "", roomId: "", sectionId: "", day: "", startTime: "", endTime: "", set: "" })
      setFacultySearch("")
      toast.success("Entry added")
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  function handleOpenEditEntry(entryId: string) {
    const entry = entries.find((e: any) => e.id === entryId)
    if (!entry) return
    setEditEntryId(entryId)
    setEditEntryForm({
      subjectId: entry.subjectId ?? entry.subject?.id ?? "",
      facultyId: entry.facultyId ?? entry.faculty?.id ?? "",
      roomId: entry.roomId ?? entry.room?.id ?? "",
      sectionId: entry.sectionId ?? entry.section?.id ?? "",
      day: entry.day ?? "",
      startTime: entry.startTime ?? "",
      endTime: entry.endTime ?? "",
      set: (entry.set ?? "") as "" | "A" | "B",
    })
    setEditSectionSearch("")
    setEditEntryOpen(true)
  }

  async function handleUpdateEntry() {
    if (!selectedScheduleId || !editEntryId) return
    const { subjectId, facultyId, roomId, sectionId, day, startTime, endTime } = editEntryForm

    // Check if faculty has subjects available
    if (facultyId && editFilteredSubjects.length === 0) {
      return toast.error("No subjects found for this faculty's specialization. Please assign subjects in Courses / Departments first.")
    }
    // Check if subject has matching sections
    if (subjectId && editFilteredSections.length === 0) {
      return toast.error("No sections found for this subject. Please create sections in Courses / Departments first.")
    }

    if (!subjectId || !facultyId || !roomId || !sectionId || !day || !startTime || !endTime) {
      return toast.error("Please fill in all fields")
    }

    // Inactive faculty check
    const selectedFacForEdit = facultyList.find((f: any) => f.id === facultyId)
    if (selectedFacForEdit && (selectedFacForEdit.isActive === false || selectedFacForEdit.user?.isActive === false)) {
      const fname = `${selectedFacForEdit.user?.firstName ?? ""} ${selectedFacForEdit.user?.lastName ?? ""}`.trim()
      return toast.error(`${fname || "This faculty member"} is inactive and cannot be assigned to a schedule entry`)
    }

    // Lab subjects require a set (A or B)
    if (editSelectedSubject?.type === "LABORATORY" && !editEntryForm.set) {
      return toast.error("Please select a Set (A or B) for this laboratory subject")
    }

    // ── Constraint-based validation on edit ──
    const toMins = (t: string) => parseInt(t.split(":")[0]) * 60 + parseInt(t.split(":")[1])
    const overlap = (s1: string, e1: string, s2: string, e2: string) => toMins(s1) < toMins(e2) && toMins(s2) < toMins(e1)
    const otherEntries = entries.filter((e: any) => e.id !== editEntryId && e.day === day)

    // Faculty conflict
    const fc = otherEntries.find((e: any) => (e.facultyId === facultyId || e.faculty?.id === facultyId) && overlap(startTime, endTime, e.startTime, e.endTime))
    if (fc) return toast.error(`Faculty already has a class at ${fc.startTime}–${fc.endTime} on ${day.charAt(0) + day.slice(1).toLowerCase()}`)

    // Room conflict
    const rc = otherEntries.find((e: any) => (e.roomId === roomId || e.room?.id === roomId) && overlap(startTime, endTime, e.startTime, e.endTime))
    if (rc) return toast.error(`Room is already booked at ${rc.startTime}–${rc.endTime} on ${day.charAt(0) + day.slice(1).toLowerCase()}`)

    // Section conflict — skip if both are lab entries with different sets
    const sc = otherEntries.find((e: any) =>
      (e.sectionId === sectionId || e.section?.id === sectionId) &&
      overlap(startTime, endTime, e.startTime, e.endTime) &&
      !(editEntryForm.set && e.set && editEntryForm.set !== e.set)
    )
    if (sc) return toast.error(`Section already has a class at ${sc.startTime}–${sc.endTime} on ${day.charAt(0) + day.slice(1).toLowerCase()}`)

    // Faculty availability check
    if (editFacultyAvailability.length > 0) {
      const daySlots = editFacultyAvailability.filter((a: any) => a.day === day)
      if (daySlots.length > 0) {
        const isWithinAvailability = daySlots.some((slot: any) =>
          toMins(slot.startTime) <= toMins(startTime) && toMins(slot.endTime) >= toMins(endTime)
        )
        if (!isWithinAvailability) {
          return toast.error("This time is outside the faculty's available hours for this day")
        }
      }
    }

    // Specialization check
    const editFaculty = facultyList.find((f: any) => f.id === facultyId)
    const editSubject = subjects.find((s: any) => s.id === subjectId)
    if (editFaculty && editSubject) {
      const specs: string[] = editFaculty.specializations ?? []
      if (specs.length > 0) {
        const titleLower = (editSubject.title ?? "").toLowerCase().trim()
        const hasMatch = specs.some((sp: string) => {
          const spLower = sp.toLowerCase().trim()
          return spLower === titleLower || titleLower.includes(spLower) || spLower.includes(titleLower)
        })
        if (!hasMatch) {
          return toast.error(`${editFaculty.user?.firstName} ${editFaculty.user?.lastName} does not specialize in "${editSubject.title}"`)
        }
      }
    }

    try {
      const result = await updateEntry.mutateAsync({
        scheduleId: selectedScheduleId,
        entryId: editEntryId,
        changes: editEntryForm,
      })
      setEditEntryOpen(false)
      setEditEntryId(null)
      if (result.warning) {
        toast.warning(`Saved with conflict: ${result.warning}`, { duration: 6000 })
      } else {
        toast.success("Entry updated")
      }
    } catch (err: any) {
      // Detect conflict errors — offer soft-validation override instead of hard-blocking
      const isConflict = err.message && (
        err.message.toLowerCase().includes("conflict") ||
        err.message.toLowerCase().includes("already assigned") ||
        err.message.toLowerCase().includes("double-booked") ||
        err.message.toLowerCase().includes("not available") ||
        err.message.toLowerCase().includes("specialization mismatch")
      )
      if (isConflict && editEntryId) {
        setConflictMessage(err.message)
        setPendingForceChanges({ ...editEntryForm })
        setForceEntryId(editEntryId)
      } else {
        toast.error(err.message)
      }
    }
  }

  async function handleForceOverride() {
    if (!pendingForceChanges || !forceEntryId || !selectedScheduleId) return
    try {
      const result = await updateEntry.mutateAsync({
        scheduleId: selectedScheduleId,
        entryId: forceEntryId,
        changes: { ...pendingForceChanges, force: true },
      })
      setConflictMessage(null)
      setPendingForceChanges(null)
      setForceEntryId(null)
      setEditEntryOpen(false)
      setEditEntryId(null)
      toast.warning(result.warning ? `Saved with conflict: ${result.warning}` : "Entry saved (conflict overridden)", { duration: 6000 })
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  async function handleExport() {
    // Use filtered entries if filters are active, otherwise all entries
    const exportEntries = filteredEntries
    if (!selectedSchedule || exportEntries.length === 0) {
      toast.error("No entries to export")
      return
    }

    // Fetch logo as base64 data URL so it works in about:blank print window
    let logoDataUrl = ""
    try {
      const res = await fetch("/images/logo.png")
      if (res.ok) {
        const blob = await res.blob()
        logoDataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(blob)
        })
      }
    } catch { /* logo optional */ }

    const semLabel = selectedSchedule.semester?.type === "FIRST" ? "1st Semester"
      : selectedSchedule.semester?.type === "SECOND" ? "2nd Semester" : "Summer"
    const ayLabel = selectedSchedule.semester?.academicYear?.label ?? ""

    // Build filter label for subtitle
    const filterParts: string[] = []
    if (calFilterFaculty) {
      const f = entryFacultyOptions.find((o) => o.id === calFilterFaculty)
      if (f) filterParts.push(`Faculty: ${f.name}`)
    }
    if (calFilterSection) {
      const s = entrySectionOptions.find((o) => o.id === calFilterSection)
      if (s) filterParts.push(`Section: ${s.name}`)
    }
    if (calFilterRoom) {
      const r = entryRoomOptions.find((o) => o.id === calFilterRoom)
      if (r) filterParts.push(`Room: ${r.name}`)
    }
    const filterLabel = filterParts.length > 0 ? ` | Filtered: ${filterParts.join(", ")}` : ""

    const rows = exportEntries.map((e: any) => `
      <tr>
        <td style="border:1px solid #ddd;padding:8px;font-family:monospace">${e.subject?.code ?? ""}</td>
        <td style="border:1px solid #ddd;padding:8px">${e.subject?.title ?? ""}</td>
        <td style="border:1px solid #ddd;padding:8px">${e.faculty?.user?.firstName ?? ""} ${e.faculty?.user?.lastName ?? ""}</td>
        <td style="border:1px solid #ddd;padding:8px;font-family:monospace">${e.room?.code ?? ""}</td>
        <td style="border:1px solid #ddd;padding:8px">${e.section?.name ?? ""}</td>
        <td style="border:1px solid #ddd;padding:8px">${e.day.charAt(0) + e.day.slice(1).toLowerCase()}</td>
        <td style="border:1px solid #ddd;padding:8px">${e.startTime}–${e.endTime}</td>
      </tr>
    `).join("")

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Schedule - ${semLabel} ${ayLabel}</title>
        <style>
          body { font-family: 'Poppins', Arial, sans-serif; padding: 30px; }
          h1 { color: #1B4332; font-size: 20px; margin-bottom: 4px; }
          h2 { color: #666; font-size: 14px; font-weight: normal; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th { background: #1B4332; color: white; padding: 10px 8px; text-align: left; }
          tr:nth-child(even) { background: #f9f9f9; }
          .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #999; display: flex; flex-direction: column; align-items: center; gap: 6px; }
          .footer img { height: 40px; width: 40px; border-radius: 50%; object-fit: contain; }
          @media print { body { padding: 15px; } }
        </style>
      </head>
      <body>
        <h1>iSched — Class Schedule</h1>
        <h2>${semLabel} | Academic Year ${ayLabel} | SLSU Lucban Campus${filterLabel}</h2>
        <p style="font-size:12px;color:#888;margin-bottom:16px;">${exportEntries.length} entries${filterParts.length > 0 ? " (filtered)" : ""}</p>
        <table>
          <thead>
            <tr>
              <th>Code</th><th>Subject</th><th>Faculty</th><th>Room</th><th>Section</th><th>Day</th><th>Time</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="footer">
          ${logoDataUrl ? `<img src="${logoDataUrl}" alt="iSched" />` : ''}
          <span>Generated by iSched — Southern Luzon State University, Lucban Campus</span>
        </div>
      </body>
      </html>
    `

    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()
      // Wait for images to load before printing
      printWindow.onload = () => printWindow.print()
      // Fallback in case onload already fired
      setTimeout(() => {
        if (!printWindow.closed) printWindow.print()
      }, 800)
    }
  }

  // Pre-publish: open validation dialog with constraint checks
  async function handlePrePublish() {
    if (!selectedScheduleId) return
    setPublishValidation({ loading: true, errors: [], warnings: [], entryCount: 0 })
    setPublishValidationOpen(true)
    try {
      const res = await fetch(`/api/schedules/${selectedScheduleId}/validate`)
      const json = await res.json()
      const data = json.data ?? json
      setPublishValidation({
        loading: false,
        errors: data.errors ?? [],
        warnings: data.warnings ?? [],
        entryCount: data.entryCount ?? 0,
      })
    } catch {
      setPublishValidation({ loading: false, errors: [{ type: "UNKNOWN", description: "Failed to validate schedule" }], warnings: [], entryCount: 0 })
    }
  }

  async function handlePublish() {
    if (!selectedScheduleId) return
    try {
      const result: any = await publishSchedule.mutateAsync(selectedScheduleId)
      if (result?._status === 422) {
        toast.error(`Cannot publish: ${result.errors?.length ?? 0} blocking conflict(s) must be resolved first`)
      } else {
        setPublishValidationOpen(false)
        toast.success("Schedule published successfully!")
      }
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  return (
    <RoleGuard allowedRoles={["SUPER_ADMIN", "ADMIN"]}>

    {/* ── Full-page loading overlay shown while a new schedule is being created ── */}
    {createSchedule.isPending && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/75 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4 rounded-2xl border bg-card px-12 py-10 shadow-2xl">
          <Loader2 className="h-10 w-10 animate-spin text-[#1B4332]" />
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">Creating Schedule…</p>
            <p className="text-xs text-muted-foreground mt-1">Setting up semester and academic year</p>
          </div>
        </div>
      </div>
    )}

    <div className="space-y-6">
      {/* Faculty guard — redirect them to /dashboard/my-schedule */}
      {userRole === "FACULTY" ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              Faculty accounts can view their assigned schedule on the <a href="/dashboard/my-schedule" className="text-primary underline">My Schedule</a> page.
            </p>
          </CardContent>
        </Card>
      ) : (
      <>
      <PageHeader
        action={
          <div className="flex flex-wrap items-center gap-2">
            {(isSuperAdmin || isAdmin) && (
              <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">New Schedule</span>
                <span className="sm:hidden">New</span>
              </Button>
            )}
            {selectedScheduleId && canGenerate && (
              <Button variant="outline" size="sm" onClick={() => setGenerateOpen(true)} className="bg-[#1B4332] text-white hover:bg-[#2D6A4F]">
                <Cpu className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Generate Schedule</span>
                <span className="sm:hidden">Generate</span>
              </Button>
            )}
            {selectedScheduleId && canAddEntry && (
              <Button variant="outline" size="sm" onClick={() => { setSectionSearch(""); setAddEntryOpen(true) }}>
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Add Entry</span>
                <span className="sm:hidden">Add</span>
              </Button>
            )}
            {selectedScheduleId && entries.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <FileDown className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            )}
            {selectedScheduleId && canPublish && (
              <Button
                size="sm"
                onClick={handlePrePublish}
                disabled={publishSchedule.isPending}
                className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
              >
                {publishSchedule.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  isAdmin
                    ? <BellRing className="mr-2 h-4 w-4" />
                    : <Globe className="mr-2 h-4 w-4" />
                )}
                {isAdmin ? "Notify Faculty" : "Publish Schedule"}
              </Button>
            )}
            {selectedScheduleId && canUnpublish && (
              <Button
                size="sm"
                variant="outline"
                className="border-[#1B4332] text-[#1B4332] hover:bg-[#1B4332]/10"
                onClick={async () => {
                  try {
                    await unpublishSchedule.mutateAsync(selectedScheduleId)
                    toast.success("Schedule unpublished — now in Draft mode")
                  } catch (err: any) {
                    toast.error(err.message)
                  }
                }}
                disabled={unpublishSchedule.isPending}
              >
                {unpublishSchedule.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Undo2 className="mr-2 h-4 w-4" />
                )}
                Unpublish
              </Button>
            )}
          </div>
        }
      />

      {/* ── Workflow Action Strip ─────────────────────────────────────────────
          Shows "Submit for Review" (ADMIN on DRAFT) or "Approve / Reject"
          (SUPER_ADMIN on PENDING_APPROVAL) for the currently selected schedule.
      ── */}
      {selectedScheduleId && selectedSchedule && (
        <WorkflowActions
          scheduleId={selectedScheduleId}
          status={selectedSchedule.status}
          userRole={userRole}
          departmentName={selectedSchedule.department?.name}
          onStatusChange={() => {
            // Invalidation is handled inside WorkflowActions via useQueryClient
          }}
        />
      )}

      {/* Read-only banner — ADMIN viewing another department's schedule */}
      {isAdmin && selectedScheduleId && !isOwnSchedule && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <BookOpen className="h-4 w-4 shrink-0 mt-0.5 text-blue-600" />
          <div>
            <p className="font-medium">Department Chairperson&apos;s Schedule — Read Only</p>
            <p className="mt-0.5 text-blue-700">
              This schedule belongs to the CAS Department Chairperson. To manage your program&apos;s subjects,
              use the <strong>New Schedule</strong> button to create your own schedule.
            </p>
          </div>
        </div>
      )}


      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[280px_1fr]">
        {/* Left: Schedule List */}
        <div className="space-y-3">
          {/* Active / Archived tabs */}
          <Tabs value={tab} onValueChange={(v) => { if (v) { setTab(v); setSelectedScheduleId(null) } }}>
            <TabsList className="w-full">
              <TabsTrigger value="active" className="flex-1">
                Active
                {visibleActiveCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-[#1B4332]/15 text-[#1B4332] px-1.5 py-0.5 text-[10px] font-semibold leading-none">
                    {visibleActiveCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="archived" className="flex-1">
                Archived
                {visibleArchivedCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-muted text-muted-foreground px-1.5 py-0.5 text-[10px] font-semibold leading-none">
                    {visibleArchivedCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Department filter — visible only when SUPER_ADMIN sees multiple departments */}
          {deptOptions.length > 1 && (
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <select
                value={deptFilter}
                onChange={(e) => { setDeptFilter(e.target.value); setSelectedScheduleId(null) }}
                className="flex-1 h-8 rounded-lg border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring truncate"
              >
                <option value="">All Departments</option>
                {deptOptions.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
              {deptFilter && (
                <button
                  onClick={() => { setDeptFilter(""); setSelectedScheduleId(null) }}
                  className="text-[10px] text-red-500 hover:text-red-600 underline shrink-0"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="flex h-24 items-center justify-center text-muted-foreground text-sm">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : schedules.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {deptFilter
                ? `No ${tab} schedules for this department`
                : `No ${tab} schedules`}
            </div>
          ) : (
            <div className="space-y-2">
              {schedules.map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedScheduleId(s.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    selectedScheduleId === s.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">
                      {s.semester?.type === "FIRST"
                        ? "1st Sem"
                        : s.semester?.type === "SECOND"
                        ? "2nd Sem"
                        : "Summer"}{" "}
                      {s.semester?.academicYear?.label}
                    </p>
                    <ScheduleStatusBadge status={s.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s._count?.entries ?? 0} entries
                    {s.semester?.startDate && s.semester?.endDate && (
                      <> &middot; {new Date(s.semester.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} — {new Date(s.semester.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</>
                    )}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Schedule Detail */}
        <div>
          {!selectedScheduleId ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border text-center text-sm text-muted-foreground">
              Select a schedule to view its entries
            </div>
          ) : loadingSchedule ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground text-sm">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2">
                  {entries.length > 0 && (
                    <Badge variant="outline" className="gap-1.5 text-[11px] sm:text-xs">
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                      {entries.length} entries
                    </Badge>
                  )}
                  <ScheduleStatusBadge status={selectedSchedule?.status} />
                </div>
                {isSuperAdmin && (
                  <div className="ml-auto flex items-center gap-1 flex-wrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        archiveSchedule.mutate({
                          scheduleId: selectedScheduleId,
                          action: tab === "archived" ? "unarchive" : "archive",
                        })
                      }
                    >
                      {tab === "archived" ? (
                        <><ArchiveRestore className="mr-1 h-3.5 w-3.5" />Unarchive</>
                      ) : (
                        <><Archive className="mr-1 h-3.5 w-3.5" />Archive</>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setDeleteConfirmOpen(true)}
                      disabled={deleteSchedule.isPending}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                )}
              </div>

              {selectedSchedule?.semester?.startDate && selectedSchedule?.semester?.endDate && (
                <p className="text-sm text-muted-foreground">
                  {new Date(selectedSchedule.semester.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  {" \u2014 "}
                  {new Date(selectedSchedule.semester.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              )}

              <Tabs value={view} onValueChange={(v) => v && setView(v)}>
                <TabsList>
                  <TabsTrigger value="list">
                    <Filter className="mr-1.5 h-3.5 w-3.5" />
                    List
                  </TabsTrigger>
                  <TabsTrigger value="calendar">
                    <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                    Calendar
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="list" className="mt-4 space-y-3">
                  {/* Search & Filter bar for list view */}
                  {entries.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
                      <div className="relative flex-1 min-w-[180px] max-w-xs">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search entries..."
                          value={entrySearch}
                          onChange={(e) => setEntrySearch(e.target.value)}
                          className="h-8 pl-8 text-xs"
                        />
                      </div>
                      <select
                        value={calFilterFaculty}
                        onChange={(e) => setCalFilterFaculty(e.target.value)}
                        className="h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">All Faculty</option>
                        {entryFacultyOptions.map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                      <select
                        value={calFilterSection}
                        onChange={(e) => setCalFilterSection(e.target.value)}
                        className="h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">All Sections</option>
                        {entrySectionOptions.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <select
                        value={calFilterRoom}
                        onChange={(e) => setCalFilterRoom(e.target.value)}
                        className="h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">All Rooms</option>
                        {entryRoomOptions.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                      {(calFilterFaculty || calFilterSection || calFilterRoom || entrySearch) && (
                        <button
                          onClick={() => { setCalFilterFaculty(""); setCalFilterSection(""); setCalFilterRoom(""); setEntrySearch("") }}
                          className="text-xs text-red-600 hover:text-red-700 underline"
                        >
                          Clear
                        </button>
                      )}
                      <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                        {filteredEntries.length} of {entries.length} entries
                      </span>
                    </div>
                  )}

                  {entries.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                      No entries yet. Use &ldquo;Add Entry&rdquo; to manually add entries, or &ldquo;Generate Schedule&rdquo; to auto-assign subjects based on faculty availability and constraints.
                    </div>
                  ) : filteredEntries.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                      No entries match your search/filter criteria.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Group entries by Day → Time for a clean stacked layout */}
                      {DAYS.map((day) => {
                        const dayEntries = filteredEntries
                          .filter((e: any) => e.day === day)
                          .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime))
                        if (dayEntries.length === 0) return null

                        // Group by time slot
                        const timeGroups: Record<string, any[]> = {}
                        for (const entry of dayEntries) {
                          const key = `${entry.startTime}–${entry.endTime}`
                          if (!timeGroups[key]) timeGroups[key] = []
                          timeGroups[key].push(entry)
                        }

                        return (
                          <Card key={day}>
                            <div className="bg-[#1B4332] text-white px-4 py-2 rounded-t-lg">
                              <h3 className="text-sm font-semibold">
                                {day.charAt(0) + day.slice(1).toLowerCase()}
                              </h3>
                            </div>
                            <CardContent className="p-0 divide-y">
                              {Object.entries(timeGroups).map(([timeSlot, slotEntries]) => (
                                <div key={timeSlot} className="flex flex-col sm:flex-row">
                                  {/* Time column */}
                                  <div className="sm:w-24 shrink-0 sm:border-r bg-muted/30 px-3 py-2 sm:py-3 flex items-center sm:items-start">
                                    <span className="text-xs font-semibold text-[#1B4332]">
                                      {timeSlot}
                                    </span>
                                  </div>
                                  {/* Schedule cards stacked vertically */}
                                  <div className="flex-1 p-2 space-y-1.5">
                                    {slotEntries.map((entry: any) => (
                                      <div
                                        key={entry.id}
                                        className={`group flex items-center justify-between rounded-lg border bg-white px-3 py-2 hover:shadow-sm transition-shadow ${canEditEntry(entry) ? "cursor-pointer" : ""}`}
                                        onClick={() => {
                                          if (canEditEntry(entry)) handleOpenEditEntry(entry.id)
                                        }}
                                      >
                                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                          <div className={`w-1 h-8 rounded-full shrink-0 ${
                                            entry.subject?.type === "LABORATORY" ? "bg-[#2D6A4F]"
                                            : "bg-[#1B4332]"
                                          }`} />
                                          <div className="min-w-0">
                                            <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                                              <span className="text-xs sm:text-sm font-semibold text-foreground">{entry.subject?.code}</span>
                                              <span className="text-[11px] sm:text-xs text-muted-foreground truncate">{entry.subject?.title}</span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-0.5 mt-0.5 text-[11px] sm:text-xs text-muted-foreground">
                                              <span>
                                                {entry.facultyName ||
                                                  `${entry.faculty?.user?.firstName ?? ""} ${entry.faculty?.user?.lastName ?? ""}`.trim() ||
                                                  "—"}
                                              </span>
                                              <span className="font-mono">{entry.room?.code}</span>
                                              <span>{entry.section?.name}</span>
                                            </div>
                                          </div>
                                        </div>
                                        {canEditEntry(entry) && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              deleteEntry.mutate({
                                                scheduleId: selectedScheduleId!,
                                                entryId: entry.id,
                                              })
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-red-500 transition-opacity shrink-0"
                                            title="Delete entry"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="calendar" className="mt-4 space-y-3">
                  {/* Calendar Filters */}
                  <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
                    <div className="relative min-w-[160px] max-w-xs">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search..."
                        value={entrySearch}
                        onChange={(e) => setEntrySearch(e.target.value)}
                        className="h-8 pl-8 text-xs"
                      />
                    </div>
                    <select
                      value={calFilterFaculty}
                      onChange={(e) => setCalFilterFaculty(e.target.value)}
                      className="h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">All Faculty</option>
                      {entryFacultyOptions.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                    <select
                      value={calFilterSection}
                      onChange={(e) => setCalFilterSection(e.target.value)}
                      className="h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">All Sections</option>
                      {entrySectionOptions.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <select
                      value={calFilterRoom}
                      onChange={(e) => setCalFilterRoom(e.target.value)}
                      className="h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">All Rooms</option>
                      {entryRoomOptions.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                    {(calFilterFaculty || calFilterSection || calFilterRoom || entrySearch) && (
                      <button
                        onClick={() => { setCalFilterFaculty(""); setCalFilterSection(""); setCalFilterRoom(""); setEntrySearch("") }}
                        className="text-xs text-red-600 hover:text-red-700 underline"
                      >
                        Clear
                      </button>
                    )}
                    <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                      {calendarEntries.length} of {entries.length} entries
                    </span>
                  </div>
                  <ScheduleCalendar
                    entries={calendarEntries}
                    semesterStartDate={selectedSchedule?.semester?.startDate?.slice(0, 10)}
                    semesterEndDate={selectedSchedule?.semester?.endDate?.slice(0, 10)}
                    onEditEntry={canModifyEntries ? handleOpenEditEntry : isAdmin && isDraft ? (entryId: string) => {
                      // Program Chair: only allow editing their own entries while DRAFT
                      const entry = entries.find((e: any) => e.id === entryId)
                      if (entry && canEditEntry(entry)) {
                        handleOpenEditEntry(entryId)
                      } else {
                        toast.error("You can only edit entries you created. Department Chair entries are read-only.")
                      }
                    } : undefined}
                  />
                </TabsContent>
              </Tabs>

              {/* ── Unassigned Queue ── */}
              {selectedSchedule?.unassigned?.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    <span className="text-sm font-semibold text-amber-700">
                      Unassigned Queue ({selectedSchedule.unassigned.length})
                    </span>
                    <span className="text-xs text-muted-foreground">
                      — these subjects could not be automatically scheduled
                    </span>
                  </div>
                  <div className="space-y-2">
                    {selectedSchedule.unassigned.map((u: any) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {u.subject?.code} — {u.subject?.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {u.section?.name} &middot; {u.reason ?? "No slot available"}
                          </p>
                        </div>
                        {canModifyEntries && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0 text-xs border-amber-300 hover:border-amber-400"
                            onClick={() => {
                              setEntryForm((prev: any) => ({
                                ...prev,
                                subjectId: u.subjectId,
                                sectionId: u.sectionId,
                              }))
                              setAddEntryOpen(true)
                            }}
                          >
                            Manually Assign
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      </>
      )}

      {/* Create Schedule Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Schedule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Semester</Label>
              <select
                value={newSemType}
                onChange={(e) => setNewSemType(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select semester</option>
                <option value="FIRST">1st Semester</option>
                <option value="SECOND">2nd Semester</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label>School Year</Label>
              <Input
                placeholder="e.g. 2025-2026 or 2025 2026"
                value={newSchoolYear}
                onChange={(e) => setNewSchoolYear(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Specify when this semester starts and ends (e.g., July 13, 2026 — December 15, 2026).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createSchedule.isPending || !newSemType || !newSchoolYear || !newStartDate || !newEndDate}>
              {createSchedule.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Entry Dialog — using native selects to properly display labels */}
      <Dialog open={addEntryOpen} onOpenChange={setAddEntryOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Schedule Entry</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Section first — determines which subjects to show */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Section</Label>
                <div className="relative" ref={sectionComboRef}>
                  <Input
                    placeholder="Search section..."
                    value={sectionSearch || sections.find((s: any) => s.id === entryForm.sectionId)?.name || ""}
                    onChange={(e) => {
                      setSectionSearch(e.target.value)
                      setSectionDropdownOpen(true)
                      if (!e.target.value) setEntryForm((f) => ({ ...f, sectionId: "", subjectId: "" }))
                    }}
                    onFocus={() => {
                      setSectionDropdownOpen(true)
                      if (entryForm.sectionId) setSectionSearch("")
                    }}
                    className="w-full"
                  />
                  {sectionDropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border bg-popover shadow-lg">
                      {filteredSections.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No sections found</div>
                      ) : (
                        filteredSections.map((s: any) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setEntryForm((f) => ({ ...f, sectionId: s.id, subjectId: "" }))
                              setSectionSearch("")
                              setSectionDropdownOpen(false)
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground ${
                              entryForm.sectionId === s.id ? "bg-accent font-medium" : ""
                            }`}
                          >
                            {s.name}
                            {s.yearLevel?.program?.abbreviation && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({s.yearLevel.program.abbreviation} — Year {s.yearLevel?.level})
                              </span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {entryForm.sectionId && selectedSectionForEntry && (
                  <p className="text-[10px] text-muted-foreground">
                    {selectedSectionForEntry.yearLevel?.program?.abbreviation} — Year {selectedSectionForEntry.yearLevel?.level} ({scheduleSemesterType === "FIRST" ? "1st" : "2nd"} Sem)
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label>Subject</Label>
                <select
                  value={entryForm.subjectId}
                  onChange={(e) => setEntryForm((f) => ({ ...f, subjectId: e.target.value, set: "" }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select subject</option>
                  {filteredSubjects.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.code} — {s.title}</option>
                  ))}
                </select>
                {entryForm.sectionId && selectedSectionForEntry && (
                  <p className="text-[10px] text-muted-foreground">
                    Showing subjects for {selectedSectionForEntry.yearLevel?.program?.abbreviation} Year {selectedSectionForEntry.yearLevel?.level}
                  </p>
                )}
              </div>
            </div>
            {/* Set (A/B) — only for LABORATORY subjects */}
            {selectedSubjectForEntry?.type === "LABORATORY" && (
              <div className="grid gap-2">
                <Label>Set</Label>
                <select
                  value={entryForm.set}
                  onChange={(e) => setEntryForm((f) => ({ ...f, set: e.target.value as "" | "A" | "B" }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select set</option>
                  <option value="A">Set A (first half — ~20 students)</option>
                  <option value="B">Set B (second half — ~20 students)</option>
                </select>
                <p className="text-[10px] text-muted-foreground">Lab subjects are split into two sets. Set A and Set B can overlap in time since they are different student groups.</p>
              </div>
            )}
            {/* Faculty (text autocomplete) & Room (department-restricted) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* ── Faculty — free-text with autocomplete suggestions ────────
                  The user types a name; matching faculty appear as suggestions.
                  Selecting one fills both the display name and the internal facultyId.
                  If typed name doesn't match any faculty, it is saved as facultyName
                  override so it still appears correctly in the schedule.
              ──────────────────────────────────────────────────────────────── */}
              <div className="grid gap-2">
                <Label>Faculty</Label>
                <div className="relative" ref={facultyComboRef}>
                  <Input
                    placeholder="Type faculty name..."
                    value={
                      facultySearch ||
                      entryForm.facultyName ||
                      (entryForm.facultyId
                        ? (() => {
                            const f = facultyList.find((f: any) => f.id === entryForm.facultyId)
                            return f ? `${f.user?.firstName} ${f.user?.lastName}` : ""
                          })()
                        : "")
                    }
                    onChange={(e) => {
                      const val = e.target.value
                      setFacultySearch(val)
                      setFacultyDropdownOpen(true)
                      // Clear the ID so we don't use a stale FK while typing
                      setEntryForm((f) => ({
                        ...f,
                        facultyId: "",
                        facultyName: val, // always store typed value
                        day: "",
                        startTime: "",
                        endTime: "",
                      }))
                    }}
                    onFocus={() => {
                      setFacultyDropdownOpen(true)
                      // When field is focused again, show the raw search
                      if (entryForm.facultyId) {
                        const f = facultyList.find((fac: any) => fac.id === entryForm.facultyId)
                        setFacultySearch(f ? `${f.user?.firstName} ${f.user?.lastName}` : "")
                      }
                    }}
                    className="w-full"
                  />
                  {facultyDropdownOpen && (facultySearch || !entryForm.facultyId) && (
                    <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border bg-popover shadow-lg">
                      {/* Option to keep the typed text as-is (no DB match required) */}
                      {facultySearch && (
                        <button
                          key="__typed"
                          type="button"
                          onClick={() => {
                            setEntryForm((f) => ({ ...f, facultyId: "", facultyName: facultySearch }))
                            setFacultySearch("")
                            setFacultyDropdownOpen(false)
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent border-b"
                        >
                          <span className="text-muted-foreground text-xs">Use as typed:</span>
                          <span className="font-medium truncate">{facultySearch}</span>
                        </button>
                      )}
                      {/* Filtered faculty list */}
                      {filteredFaculty
                        .filter((f: any) => {
                          if (!facultySearch) return true
                          const full = `${f.user?.firstName} ${f.user?.lastName}`.toLowerCase()
                          return full.includes(facultySearch.toLowerCase())
                        })
                        .map((f: any) => {
                          const full = `${f.user?.firstName} ${f.user?.lastName}`
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => {
                                setEntryForm((fv) => ({
                                  ...fv,
                                  facultyId: f.id,
                                  facultyName: full,
                                  day: "",
                                  startTime: "",
                                  endTime: "",
                                }))
                                setFacultySearch("")
                                setFacultyDropdownOpen(false)
                              }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-accent ${
                                entryForm.facultyId === f.id ? "bg-accent font-medium" : ""
                              }`}
                            >
                              <span className="font-medium">{full}</span>
                              {f.specializations?.length > 0 && (
                                <span className="ml-2 text-[11px] text-muted-foreground">
                                  {f.specializations.slice(0, 2).join(", ")}
                                </span>
                              )}
                            </button>
                          )
                        })}
                      {filteredFaculty.filter((f: any) => {
                        if (!facultySearch) return true
                        const full = `${f.user?.firstName} ${f.user?.lastName}`.toLowerCase()
                        return full.includes(facultySearch.toLowerCase())
                      }).length === 0 && !facultySearch && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No faculty found</div>
                      )}
                    </div>
                  )}
                </div>
                {entryForm.facultyId && (
                  <p className="text-[10px] text-emerald-600">✓ Linked to faculty record (availability & conflicts checked)</p>
                )}
                {!entryForm.facultyId && entryForm.facultyName && (
                  <p className="text-[10px] text-amber-600">⚠ Free-text name — not linked to a faculty record</p>
                )}
              </div>

              {/* ── Room — filtered to department-assigned buildings ──────── */}
              <div className="grid gap-2">
                <Label>Room</Label>
                <select
                  value={entryForm.roomId}
                  onChange={(e) => setEntryForm((f) => ({ ...f, roomId: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select room</option>
                  {filteredRooms.map((r: any) => (
                    <option key={r.id} value={r.id}>
                      {r.code} ({r.name}) — {r.building?.code ?? ""} · {r.type?.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                {scheduleDeptId && departmentRooms.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    Showing {departmentRooms.length} room{departmentRooms.length !== 1 ? "s" : ""} in your department's buildings
                  </p>
                )}
                {entryForm.subjectId && selectedSubjectForEntry?.requiredRoomType?.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    Filtered by subject type: {selectedSubjectForEntry.requiredRoomType.map((t: string) => t.replace(/_/g, " ")).join(", ")}
                  </p>
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Day</Label>
              <select
                value={entryForm.day}
                onChange={(e) => setEntryForm((f) => ({ ...f, day: e.target.value, startTime: "", endTime: "" }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select day</option>
                {availableDays.map((d) => (
                  <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>
                ))}
              </select>
              {entryForm.facultyId && availableDays.length < DAYS.length && (
                <p className="text-[10px] text-muted-foreground">Showing days based on faculty availability</p>
              )}
              {entryForm.facultyId && facultyAvailability.length === 0 && (
                <p className="text-[10px] text-amber-600">No availability set for this faculty. All days/times shown. Set availability in Faculty Availability page.</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Start Time</Label>
                <select
                  value={entryForm.startTime}
                  onChange={(e) => setEntryForm((f) => ({ ...f, startTime: e.target.value, endTime: "" }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select time</option>
                  {constraintFilteredStartTimes.map(({ time, available, reasons }) => (
                    <option key={time} value={time} disabled={!available} className={!available ? "text-red-400" : ""}>
                      {time}{!available ? ` ✗ ${reasons.join(", ")}` : ""}
                    </option>
                  ))}
                </select>
                {entryForm.facultyId && entryForm.day && availableTimeOptions.length < TIME_OPTIONS.length && (
                  <p className="text-[10px] text-muted-foreground">Filtered by faculty availability</p>
                )}
                {entryForm.day && (occupiedSlots.faculty.length > 0 || occupiedSlots.room.length > 0 || occupiedSlots.section.length > 0) && (
                  <p className="text-[10px] text-amber-600">Occupied slots are disabled (faculty/room/section conflicts)</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label>End Time</Label>
                <select
                  value={entryForm.endTime}
                  onChange={(e) => setEntryForm((f) => ({ ...f, endTime: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select time</option>
                  {constraintFilteredEndTimes.map(({ time }) => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
                {entryForm.startTime && constraintFilteredEndTimes.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">Showing valid end times (no conflicts)</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddEntryOpen(false)}>Cancel</Button>
            <Button onClick={handleAddEntry} disabled={createEntry.isPending}>
              {createEntry.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Entry Dialog ── */}
      <Dialog open={editEntryOpen} onOpenChange={setEditEntryOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-2 border-b">
            <DialogTitle className="text-base font-semibold tracking-tight">Edit Schedule Entry</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Update the details for this scheduled class.</p>
          </DialogHeader>

          <div className="space-y-5 py-4">

            {/* Row 1: Faculty | Subject */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground/80 uppercase tracking-wide">Faculty</Label>
                <select
                  value={editEntryForm.facultyId}
                  onChange={(e) => setEditEntryForm((f) => ({ ...f, facultyId: e.target.value, day: "", startTime: "", endTime: "" }))}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">— Select faculty —</option>
                  {editFilteredFaculty.map((f: any) => (
                    <option key={f.id} value={f.id}>{f.user?.firstName} {f.user?.lastName}</option>
                  ))}
                </select>
                {editEntryForm.subjectId && !editEntryForm.facultyId && (
                  <p className="text-[10px] text-muted-foreground">Filtered by subject specialization</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground/80 uppercase tracking-wide">Subject</Label>
                <select
                  value={editEntryForm.subjectId}
                  onChange={(e) => {
                    setEditEntryForm((f) => ({ ...f, subjectId: e.target.value, sectionId: "", set: "" }))
                    setEditSectionSearch("")
                  }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">— Select subject —</option>
                  {editFilteredSubjects.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.code} — {s.title}</option>
                  ))}
                </select>
                {editFilteredSubjects.length === 0 && editEntryForm.facultyId && (
                  <p className="text-[10px] text-destructive">No subjects match this faculty&apos;s specialization.</p>
                )}
              </div>
            </div>

            {/* Row 2: Section | Room */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground/80 uppercase tracking-wide">Section</Label>
                <div className="relative" ref={editSectionComboRef}>
                  <Input
                    placeholder="Search section..."
                    value={editSectionSearch || sections.find((s: any) => s.id === editEntryForm.sectionId)?.name || ""}
                    onChange={(e) => {
                      setEditSectionSearch(e.target.value)
                      setEditSectionDropdownOpen(true)
                      if (!e.target.value) setEditEntryForm((f) => ({ ...f, sectionId: "" }))
                    }}
                    onFocus={() => {
                      setEditSectionDropdownOpen(true)
                      if (editEntryForm.sectionId) setEditSectionSearch("")
                    }}
                    className="h-9 w-full text-sm"
                  />
                  {editSectionDropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full max-h-44 overflow-y-auto rounded-md border bg-popover shadow-md">
                      {editFilteredSections.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-destructive">No matching sections found.</div>
                      ) : (
                        editFilteredSections.map((s: any) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setEditEntryForm((f) => ({ ...f, sectionId: s.id }))
                              setEditSectionSearch("")
                              setEditSectionDropdownOpen(false)
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground ${
                              editEntryForm.sectionId === s.id ? "bg-accent font-medium" : ""
                            }`}
                          >
                            {s.name}
                            {s.yearLevel?.level && (
                              <span className="ml-1.5 text-[10px] text-muted-foreground">Year {s.yearLevel.level}</span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {editEntryForm.subjectId && editSelectedSubject?.year && (
                  <p className="text-[10px] text-muted-foreground">Year {editSelectedSubject.year} sections</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground/80 uppercase tracking-wide">Room</Label>
                <select
                  value={editEntryForm.roomId}
                  onChange={(e) => setEditEntryForm((f) => ({ ...f, roomId: e.target.value }))}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">— Select room —</option>
                  {editFilteredRooms.map((r: any) => (
                    <option key={r.id} value={r.id}>{r.code} ({r.name}) — {r.type?.replace(/_/g, " ")}</option>
                  ))}
                </select>
                {editEntryForm.subjectId && editSelectedSubject?.requiredRoomType?.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">Filtered: {editSelectedSubject.requiredRoomType.map((t: string) => t.replace(/_/g, " ")).join(", ")}</p>
                )}
              </div>
            </div>

            {/* Row 3: Set — only for LABORATORY subjects */}
            {editSelectedSubject?.type === "LABORATORY" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground/80 uppercase tracking-wide">Laboratory Set</Label>
                <select
                  value={editEntryForm.set}
                  onChange={(e) => setEditEntryForm((f) => ({ ...f, set: e.target.value as "" | "A" | "B" }))}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">— Select set —</option>
                  <option value="A">Set A — First half (~20 students)</option>
                  <option value="B">Set B — Second half (~20 students)</option>
                </select>
                <p className="text-[10px] text-muted-foreground">Set A and Set B may share the same time slot as they are separate student groups.</p>
              </div>
            )}

            {/* Divider */}
            <div className="border-t" />

            {/* Row 4: Day */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground/80 uppercase tracking-wide">Day of Week</Label>
              <select
                value={editEntryForm.day}
                onChange={(e) => setEditEntryForm((f) => ({ ...f, day: e.target.value, startTime: "", endTime: "" }))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— Select day —</option>
                {editAvailableDays.map((d) => (
                  <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>
                ))}
              </select>
              {editEntryForm.facultyId && editFacultyAvailability.length === 0 && (
                <p className="text-[10px] text-amber-600">No availability configured for this faculty — all days are shown.</p>
              )}
              {editEntryForm.facultyId && editFacultyAvailability.length > 0 && (
                <p className="text-[10px] text-muted-foreground">Days filtered by faculty availability</p>
              )}
            </div>

            {/* Row 5: Start Time | End Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground/80 uppercase tracking-wide">Start Time</Label>
                <select
                  value={editEntryForm.startTime}
                  onChange={(e) => setEditEntryForm((f) => ({ ...f, startTime: e.target.value }))}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">— Select time —</option>
                  {editAvailableTimeOptions.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                {editEntryForm.facultyId && editEntryForm.day && editAvailableTimeOptions.length < TIME_OPTIONS.length && (
                  <p className="text-[10px] text-muted-foreground">Filtered by faculty availability</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground/80 uppercase tracking-wide">End Time</Label>
                <select
                  value={editEntryForm.endTime}
                  onChange={(e) => setEditEntryForm((f) => ({ ...f, endTime: e.target.value }))}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">— Select time —</option>
                  {editAvailableTimeOptions.filter((t) => !editEntryForm.startTime || t > editEntryForm.startTime).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEntryOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateEntry} disabled={updateEntry.isPending} className="bg-[#1B4332] hover:bg-[#2D6A4F]">
              {updateEntry.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Conflict Override Dialog (soft-validation) ── */}
      <Dialog
        open={!!conflictMessage}
        onOpenChange={() => { setConflictMessage(null); setPendingForceChanges(null); setForceEntryId(null) }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              Scheduling Conflict Detected
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground leading-relaxed">{conflictMessage}</p>
            <p className="text-sm font-medium">Override this constraint and save anyway?</p>
            <p className="text-xs text-muted-foreground">
              The conflict will be flagged in the conflict report. You can resolve it by adjusting
              the affected entries.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setConflictMessage(null); setPendingForceChanges(null); setForceEntryId(null) }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleForceOverride}
              disabled={updateEntry.isPending}
            >
              {updateEntry.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Override &amp; Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Generate Schedule Dialog ── */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Schedule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Run the constraint-based backtracking algorithm to automatically generate an optimized schedule.
              This considers faculty availability, specializations, room assignments, and section requirements.
            </p>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800">
                  {isSuperAdmin
                    ? "This generates GEC/minor subjects assigned to your department (e.g. SS, LLH, or MNS). NSTP and PATHFIT are excluded from auto-generation. Existing entries for this schedule will be cleared first."
                    : "This generates your program's major subjects. Make sure faculty availability and subject data are up to date. Submit after generation for Department Chair review."}
                </p>
              </div>
            </div>
            {generateError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 space-y-2">
                <p className="text-sm font-medium text-red-800">{generateError.message}</p>
                {generateError.details.length > 0 && (
                  <>
                    {generateError.details.length <= 5 ? (
                      <ul className="list-disc pl-4 text-xs text-red-700 space-y-0.5">
                        {generateError.details.map((d: string, i: number) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-xs text-red-700 space-y-1">
                        <p className="font-medium">{generateError.details.length} issues found:</p>
                        {/* Group by common patterns */}
                        {(() => {
                          const specIssues = generateError.details.filter(d => d.includes("No faculty specializations match"))
                          const roomIssues = generateError.details.filter(d => d.includes("No compatible rooms"))
                          const availIssues = generateError.details.filter(d => d.includes("availability"))
                          const otherIssues = generateError.details.filter(d =>
                            !d.includes("No faculty specializations match") &&
                            !d.includes("No compatible rooms") &&
                            !d.includes("availability")
                          )
                          return (
                            <ul className="list-disc pl-4 space-y-0.5">
                              {specIssues.length > 0 && (
                                <li><strong>{specIssues.length} subjects</strong> have no faculty with matching specializations. Go to <strong>Faculty</strong> and update their specializations to match the current subjects.</li>
                              )}
                              {roomIssues.length > 0 && (
                                <li><strong>{roomIssues.length} subjects</strong> have no compatible rooms. Check room types in <strong>Buildings / Rooms</strong>.</li>
                              )}
                              {availIssues.length > 0 && (
                                <li>{availIssues.length > 1 ? `${availIssues.length} issues` : availIssues[0]} related to faculty availability. Set availability in <strong>Faculty Availability</strong>.</li>
                              )}
                              {otherIssues.map((d, i) => (
                                <li key={i}>{d}</li>
                              ))}
                            </ul>
                          )
                        })()}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)} disabled={generateSchedule.isPending}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={generateSchedule.isPending} className="bg-[#1B4332] hover:bg-[#2D6A4F]">
              {generateSchedule.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Running Algorithm…</>
              ) : (
                <><Cpu className="mr-2 h-4 w-4" />Run Backtracking Algorithm</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Pre-Publish Validation Dialog ── */}
      <Dialog open={publishValidationOpen} onOpenChange={setPublishValidationOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {publishValidation.loading ? (
                <><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />Validating Schedule...</>
              ) : publishValidation.errors.length === 0 ? (
                <><CheckCircle2 className="h-5 w-5 text-green-600" />Schedule Validation Passed</>
              ) : (
                <><AlertTriangle className="h-5 w-5 text-red-600" />Validation Issues Found</>
              )}
            </DialogTitle>
          </DialogHeader>

          {publishValidation.loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Running constraint checks on {entries.length} entries...</span>
            </div>
          ) : (
            <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
              {/* Summary */}
              <div className="rounded-lg border p-3 bg-muted/30">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold">{publishValidation.entryCount}</p>
                    <p className="text-[10px] text-muted-foreground">Total Entries</p>
                  </div>
                  <div>
                    <p className={`text-lg font-bold ${publishValidation.errors.length > 0 ? "text-red-600" : "text-green-600"}`}>
                      {publishValidation.errors.length}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Errors</p>
                  </div>
                  <div>
                    <p className={`text-lg font-bold ${publishValidation.warnings.length > 0 ? "text-amber-600" : "text-green-600"}`}>
                      {publishValidation.warnings.length}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Warnings</p>
                  </div>
                </div>
              </div>

              {/* Errors */}
              {publishValidation.errors.length > 0 && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 space-y-2">
                  <p className="text-xs font-semibold text-red-800 uppercase tracking-wide flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Blocking Errors — Must resolve before publishing
                  </p>
                  <ul className="list-disc pl-4 text-xs text-red-700 space-y-1">
                    {publishValidation.errors.map((err, i) => (
                      <li key={i}>{err.description}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {publishValidation.warnings.length > 0 && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-2">
                  <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Warnings — Review before publishing
                  </p>
                  <ul className="list-disc pl-4 text-xs text-amber-700 space-y-1">
                    {publishValidation.warnings.map((warn, i) => (
                      <li key={i}>{warn.description}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* All clear */}
              {publishValidation.errors.length === 0 && publishValidation.warnings.length === 0 && publishValidation.entryCount > 0 && (
                <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-green-800">All constraint checks passed!</p>
                      <p className="text-xs text-green-700 mt-0.5">
                        No faculty overlaps, room conflicts, section conflicts, or load violations detected.
                        The schedule is ready to be published.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishValidationOpen(false)}>
              {publishValidation.errors.length > 0 ? "Close & Fix Issues" : "Cancel"}
            </Button>
            {publishValidation.errors.length === 0 && publishValidation.entryCount > 0 && !publishValidation.loading && (
              <Button
                onClick={handlePublish}
                disabled={publishSchedule.isPending}
                className="bg-[#1B4332] hover:bg-[#2D6A4F]"
              >
                {publishSchedule.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Publishing...</>
                ) : (
                  <><Globe className="mr-2 h-4 w-4" />Confirm & Publish</>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ── Delete Schedule Confirmation Dialog ─────────────────────────────── */}
      <Dialog open={deleteConfirmOpen} onOpenChange={(open) => { if (!deleteSchedule.isPending) setDeleteConfirmOpen(open) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-4 w-4 text-red-600" />
              </div>
              Delete Schedule?
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Schedule identity */}
            {selectedSchedule && (
              <div className="rounded-lg border bg-muted/40 px-4 py-3">
                <p className="text-sm font-semibold text-foreground">
                  {selectedSchedule.semester?.type === "FIRST"
                    ? "1st Semester"
                    : selectedSchedule.semester?.type === "SECOND"
                    ? "2nd Semester"
                    : "Summer"}{" "}
                  {selectedSchedule.semester?.academicYear?.label}
                </p>
                {selectedSchedule.department && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {selectedSchedule.department.name ?? selectedSchedule.department.abbreviation}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedSchedule.entries?.length ?? 0} entries will be permanently removed
                </p>
              </div>
            )}

            {/* Warning */}
            <div className="flex items-start gap-2.5 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
              <p className="text-xs text-red-700">
                This action <strong>cannot be undone</strong>. The schedule and all its entries will be permanently deleted.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deleteSchedule.isPending}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white gap-2"
              disabled={deleteSchedule.isPending}
              onClick={() => {
                if (!selectedScheduleId) return
                deleteSchedule.mutate(selectedScheduleId, {
                  onSuccess: () => {
                    setDeleteConfirmOpen(false)
                    setSelectedScheduleId(null)
                    toast.success("Schedule deleted successfully")
                  },
                  onError: (err: any) => {
                    toast.error(err.message)
                  },
                })
              }}
            >
              {deleteSchedule.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
    </RoleGuard>
  )
}
