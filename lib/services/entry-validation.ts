// Entry-level constraint validation for POST/PATCH schedule entries
// Enforces the same constraints as the backtracking engine at the API level

import { db } from "@/lib/db"

interface EntryData {
  subjectId: string
  facultyId: string
  roomId: string
  sectionId: string
  day: string
  startTime: string
  endTime: string
  set?: string | null
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

function timesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  return toMinutes(s1) < toMinutes(e2) && toMinutes(s2) < toMinutes(e1)
}

/**
 * Validate a schedule entry against all constraints.
 * Returns null if valid, or an error message string if invalid.
 * Checks existing entries in the same schedule to detect overlaps.
 */
export async function validateEntry(
  scheduleId: string,
  entry: EntryData,
  excludeEntryId?: string // exclude this entry from overlap checks (for PATCH)
): Promise<string | null> {
  // 6. Time validation (check first — no DB needed)
  if (toMinutes(entry.startTime) >= toMinutes(entry.endTime)) {
    return "Start time must be before end time"
  }

  // Step 1: Fetch the schedule to get semesterId (needed for cross-schedule checks)
  const schedule = await db.schedule.findUnique({
    where: { id: scheduleId },
    select: { semesterId: true },
  })

  // Step 2: Parallel fetch using semesterId
  const [sameScheduleEntries, crossScheduleEntries, faculty, subject, section, roomAccess] = await Promise.all([
    // Entries within THIS schedule — used for section-overlap checks
    db.scheduleEntry.findMany({
      where: {
        scheduleId,
        ...(excludeEntryId ? { id: { not: excludeEntryId } } : {}),
      },
      select: {
        facultyId: true,
        roomId: true,
        sectionId: true,
        day: true,
        startTime: true,
        endTime: true,
        set: true,
        subject: { select: { code: true, type: true } },
        faculty: { select: { user: { select: { firstName: true, lastName: true } } } },
        room: { select: { code: true } },
        section: { select: { name: true } },
      },
    }),
    // ALL entries across non-archived schedules in the same semester —
    // used for room and faculty overlap checks to catch cross-department double-bookings.
    schedule?.semesterId
      ? db.scheduleEntry.findMany({
          where: {
            scheduleId: { not: scheduleId },
            schedule: { semesterId: schedule.semesterId, isArchived: false },
            ...(excludeEntryId ? { id: { not: excludeEntryId } } : {}),
          },
          select: {
            facultyId: true,
            roomId: true,
            sectionId: true,
            day: true,
            startTime: true,
            endTime: true,
            set: true,
            subject: { select: { code: true, type: true } },
            faculty: { select: { user: { select: { firstName: true, lastName: true } } } },
            room: { select: { code: true } },
            section: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    // Faculty — check active status and specializations
    db.faculty.findUnique({
      where: { id: entry.facultyId },
      select: {
        specializations: true,
        isActive: true,
        user: { select: { firstName: true, lastName: true, isActive: true } },
      },
    }),
    // Subject info (include year and yearLevelId for section alignment check)
    db.subject.findUnique({
      where: { id: entry.subjectId },
      select: { title: true, code: true, year: true, yearLevelId: true, departmentId: true },
    }),
    // Section info (include yearLevel + college for alignment and Saturday checks)
    db.section.findUnique({
      where: { id: entry.sectionId },
      select: {
        name: true,
        yearLevelId: true,
        yearLevel: {
          select: {
            level: true,
            program: {
              select: {
                id: true,
                name: true,
                departmentId: true,
                department: { select: { college: { select: { abbreviation: true } } } },
              },
            },
          },
        },
      },
    }),
    // Room access restrictions (department- and program-level, union semantics)
    db.room.findUnique({
      where: { id: entry.roomId },
      select: {
        code: true,
        departments: { select: { departmentId: true } },
        programs: { select: { programId: true } },
      },
    }),
  ])

  // Room/faculty checks use ALL entries (same + other schedules).
  // Section checks use only same-schedule entries (sections appear in one schedule each).
  const allEntries = [...sameScheduleEntries, ...crossScheduleEntries]
  const existingEntries = sameScheduleEntries

  // 0. Inactive faculty check — either Faculty.isActive or User.isActive must be true
  if (faculty && (faculty.isActive === false || faculty.user?.isActive === false)) {
    const fname = faculty.user ? `${faculty.user.firstName} ${faculty.user.lastName}` : "This faculty member"
    return `${fname} is inactive and cannot be assigned to a schedule entry`
  }

  // 0b. Saturday restriction — only CAM (College of Allied Medicine) sections and
  // NSTP subjects may be scheduled on Saturdays (hard constraint, same as engine).
  if (entry.day === "SATURDAY") {
    const subjCode = (subject?.code ?? "").toUpperCase()
    const isNstp = subjCode.startsWith("NSTP") || subjCode.startsWith("NST")
    const collegeAbbr = section?.yearLevel?.program?.department?.college?.abbreviation
    if (!isNstp && collegeAbbr !== "CAM") {
      return `Saturday classes are reserved for CAM (College of Allied Medicine) sections and NSTP subjects. ${section?.name ?? "This section"} cannot be scheduled on Saturday.`
    }
  }

  // 0c. Room access restriction — a room restricted to departments/programs may
  // only host sections whose department OR program (course) is on its list.
  if (roomAccess && (roomAccess.departments.length > 0 || roomAccess.programs.length > 0)) {
    const sectionDeptId = section?.yearLevel?.program?.departmentId
    const sectionProgramId = section?.yearLevel?.program?.id
    const allowed =
      (!!sectionDeptId && roomAccess.departments.some((d) => d.departmentId === sectionDeptId)) ||
      (!!sectionProgramId && roomAccess.programs.some((p) => p.programId === sectionProgramId))
    if (!allowed) {
      return `Room access restriction: ${roomAccess.code} is reserved for specific departments/programs — ${section?.yearLevel?.program?.name ?? "this section's program"} is not allowed to use it.`
    }
  }

  // 1. Faculty overlap — same faculty, same day, overlapping times (checked globally across all schedules)
  const facultyConflict = allEntries.find(
    (e) =>
      e.facultyId === entry.facultyId &&
      e.day === entry.day &&
      timesOverlap(e.startTime, e.endTime, entry.startTime, entry.endTime)
  )
  if (facultyConflict) {
    const fname = `${facultyConflict.faculty?.user?.lastName ?? ""}, ${facultyConflict.faculty?.user?.firstName ?? ""}`
    return `Faculty conflict: ${fname} is already assigned to "${facultyConflict.subject?.code}" on ${entry.day} (${facultyConflict.startTime}-${facultyConflict.endTime})`
  }

  // 2. Room overlap — same room, same day, overlapping times (checked globally across all schedules)
  const roomConflict = allEntries.find(
    (e) =>
      e.roomId === entry.roomId &&
      e.day === entry.day &&
      timesOverlap(e.startTime, e.endTime, entry.startTime, entry.endTime)
  )
  if (roomConflict) {
    return `Room conflict: ${roomConflict.room?.code ?? "Room"} is already booked on ${entry.day} (${roomConflict.startTime}-${roomConflict.endTime}) for "${roomConflict.subject?.code}"`
  }

  // 3. Section overlap — same section, same day, overlapping times (within schedule only —
  // sections appear in exactly one schedule, so cross-schedule check is unnecessary)
  const sectionConflict = existingEntries.find(
    (e) =>
      e.sectionId === entry.sectionId &&
      e.day === entry.day &&
      timesOverlap(e.startTime, e.endTime, entry.startTime, entry.endTime) &&
      // Skip if both are lab entries with different sets
      !(entry.set && (e as any).set && entry.set !== (e as any).set)
  )
  if (sectionConflict) {
    return `Section conflict: ${sectionConflict.section?.name ?? "Section"} already has "${sectionConflict.subject?.code}" on ${entry.day} (${sectionConflict.startTime}-${sectionConflict.endTime})`
  }

  // 4. Faculty availability — check if faculty is available at this time
  if (schedule?.semesterId) {
    const availability = await db.facultyAvailability.findMany({
      where: {
        facultyId: entry.facultyId,
        semesterId: schedule.semesterId,
        day: entry.day as any,
      },
    })
    if (availability.length > 0) {
      const entryStart = toMinutes(entry.startTime)
      const entryEnd = toMinutes(entry.endTime)
      const isAvailable = availability.some(
        (a) => toMinutes(a.startTime) <= entryStart && toMinutes(a.endTime) >= entryEnd
      )
      if (!isAvailable) {
        return `Faculty is not available on ${entry.day} from ${entry.startTime} to ${entry.endTime}. Check their availability settings.`
      }
    }
  }

  // 5. Specialization check — verify faculty can teach this subject
  if (faculty && subject && faculty.specializations.length > 0) {
    const specLower = faculty.specializations.map((s: string) => s.toLowerCase().trim())
    const titleLower = (subject.title ?? "").toLowerCase().trim()
    const matches = specLower.some(
      (sp: string) => sp === titleLower || titleLower.includes(sp) || sp.includes(titleLower)
    )
    if (!matches) {
      return `Specialization mismatch: Faculty's specializations (${faculty.specializations.join(", ")}) do not match subject "${subject.code} - ${subject.title}"`
    }
  }

  // 7. Subject-Section alignment — verify the subject belongs to the section's program
  if (subject && section) {
    // Check year level match
    if (subject.year && section.yearLevel?.level && subject.year !== section.yearLevel.level) {
      return `Year mismatch: "${subject.code}" is a Year ${subject.year} subject but ${section.name} is Year ${section.yearLevel.level}. Please select a matching section.`
    }

    // If subject is linked to a specific yearLevel, it must match the section's yearLevel
    if (subject.yearLevelId && subject.yearLevelId !== section.yearLevelId) {
      return `Program mismatch: "${subject.code}" is assigned to a specific program year level that doesn't match ${section.name}. Check subject assignment in Courses / Departments.`
    }

    // If subject is NOT a GEC/PATHFIT and not from CAS (which manages shared subjects),
    // it must belong to the same department as the section's program.
    const CAS_DEPT_ID = 'cmmzovtv10009qkvur7tude03'
    const isGEC = subject.code.startsWith("GEC") || subject.code.startsWith("GEL") ||
      subject.code.startsWith("PATHFIT") || subject.code.startsWith("PATHFit") ||
      subject.code.startsWith("NST")
    const isCASSubject = subject.departmentId === CAS_DEPT_ID
    // CAS subjects (GEC, science, arts, etc.) can be assigned to any program
    if (!isGEC && !isCASSubject && !subject.yearLevelId) {
      const sectionDeptId = section.yearLevel?.program?.departmentId
      if (sectionDeptId && subject.departmentId && sectionDeptId !== subject.departmentId) {
        return `Department mismatch: "${subject.code} - ${subject.title}" belongs to a different department than ${section.name} (${section.yearLevel?.program?.name ?? "unknown program"}).`
      }
    }
  }

  return null // All checks passed
}
