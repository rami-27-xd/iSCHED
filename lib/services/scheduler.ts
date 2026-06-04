// Constraint-Based Scheduling Engine with Backtracking Algorithm
// Uses MRV (Minimum Remaining Values) and LCV (Least Constraining Value) heuristics
//
// KEY CONCEPT: The engine schedules "tasks" — each task is a (subject × section) pair.
// Every section at a given year level must have all subjects for that year scheduled.
//
// HARD CONSTRAINT EVALUATION ORDER (applied at candidate-init time for max pruning):
//   1. Lab specialization match  — eliminates mismatched room types early
//   2. Building availability     — eliminates rooms in buildings faculty can't reach
//   3. Room type compatibility   — eliminates wrong room category
//   4. Faculty specialization    — eliminates faculty who can't teach the subject
//   5. Slot-based overlap checks — applied in isConsistentFast during backtracking

type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY'

interface SubjectInput {
  id: string
  code: string
  title: string
  hoursPerWeek: number
  type: 'LECTURE' | 'LABORATORY'
  requiredRoomType: string[]
  units: number
  year: number
  departmentCode?: string
  // When set, only rooms whose labSpecialization matches exactly are valid (Hard Constraint).
  requiredLabSpecialization?: string | null
}

interface FacultyInput {
  id: string
  name: string
  specializations: string[]
  sectionCounts?: Record<string, number>
  maxUnitsPerWeek: number
  availability: {
    day: DayOfWeek
    startTime: string
    endTime: string
  }[]
  // Buildings this faculty member is available to teach in for the semester.
  // Empty array = no restriction (legacy data fallback).
  // Enforced as a Hard Constraint when enforceBuildingAvailability is true.
  allowedBuildingIds: string[]
}

interface RoomInput {
  id: string
  code: string
  type: string
  buildingId: string
  buildingCode?: string
  // Populated for LABORATORY / COMPUTER_LAB rooms.
  // Matched against SubjectInput.requiredLabSpecialization (Hard Constraint).
  labSpecialization?: string | null
}

interface SectionInput {
  id: string
  name: string
  yearLevel: number
}

interface Assignment {
  subjectId: string
  facultyId: string
  roomId: string
  sectionId: string
  day: DayOfWeek
  startTime: string
  endTime: string
}

interface SchedulingTask {
  taskId: string // `${subjectId}__${sectionId}`
  subjectId: string
  sectionId: string
  subject: SubjectInput
  section: SectionInput
}

export interface ScheduleConstraints {
  noFacultyOverlap: boolean
  noRoomOverlap: boolean
  noSectionOverlap: boolean
  respectFacultyAvail: boolean
  respectRoomType: boolean
  // Hard Constraint: faculty cannot be assigned to a building not in their allowedBuildingIds.
  enforceBuildingAvailability: boolean
  // Hard Constraint: subjects with requiredLabSpecialization can only use matching rooms.
  enforceLabSpecialization: boolean
  maxDailyLoad: number
  maxWeeklyUnits: number
  noBackToBackLab: boolean
  preferMorningSlots: boolean
}

const DEFAULT_CONSTRAINTS: ScheduleConstraints = {
  noFacultyOverlap: true,
  noRoomOverlap: true,
  noSectionOverlap: true,
  respectFacultyAvail: true,
  respectRoomType: true,
  enforceBuildingAvailability: true,
  enforceLabSpecialization: true,
  maxDailyLoad: 8,
  maxWeeklyUnits: 21,
  noBackToBackLab: true,
  preferMorningSlots: false,
}

const MAX_BACKTRACK_MS = 25_000
const MAX_CANDIDATES_PER_TASK = 500
const TIMEOUT_CHECK_INTERVAL = 200

export class SchedulingError extends Error {
  constructor(message: string, public details?: string[]) {
    super(message)
    this.name = 'SchedulingError'
  }
}

export class SchedulingEngine {
  private assignments: Assignment[] = []
  private constraints: ScheduleConstraints
  private tasks: SchedulingTask[] = []

  private subjectMap: Map<string, SubjectInput>
  private facultyMap: Map<string, FacultyInput>
  private roomMap: Map<string, RoomInput>

  private taskCandidates: Map<string, Assignment[]>

  // Slot-based occupancy maps for O(1) conflict detection.
  // key = "id|day|minuteSlot"
  private facultySlots: Map<string, boolean> = new Map()
  private roomSlots: Map<string, boolean> = new Map()
  private sectionSlots: Map<string, boolean> = new Map()

  private facultyDailyMinutes: Map<string, number> = new Map()
  private facultyWeeklyUnits: Map<string, number> = new Map()
  private facultySubjectSections: Map<string, number> = new Map()

  private startTime = 0
  private candidateChecks = 0

  constructor(
    private subjects: SubjectInput[],
    private faculty: FacultyInput[],
    private rooms: RoomInput[],
    private sections: SectionInput[],
    constraints: Partial<ScheduleConstraints> = {}
  ) {
    this.constraints = { ...DEFAULT_CONSTRAINTS, ...constraints }

    this.subjectMap = new Map(subjects.map(s => [s.id, s]))
    this.facultyMap = new Map(faculty.map(f => [f.id, f]))
    this.roomMap = new Map(rooms.map(r => [r.id, r]))

    this.tasks = this.buildTasks()
    this.taskCandidates = this.initializeCandidates()
  }

  private buildTasks(): SchedulingTask[] {
    const tasks: SchedulingTask[] = []
    for (const subject of this.subjects) {
      const matchingSections = this.sections.filter(s => s.yearLevel === subject.year)
      if (matchingSections.length === 0) continue
      for (const section of matchingSections) {
        tasks.push({
          taskId: `${subject.id}__${section.id}`,
          subjectId: subject.id,
          sectionId: section.id,
          subject,
          section,
        })
      }
    }
    return tasks
  }

  async generate(): Promise<Assignment[]> {
    if (this.tasks.length === 0) {
      throw new SchedulingError(
        'No scheduling tasks to process',
        ['No subjects match any sections by year level. Ensure subjects have year levels and sections exist for each year.']
      )
    }

    const diagnostics: string[] = []
    const emptyDomainTasks: SchedulingTask[] = []

    for (const task of this.tasks) {
      const candidates = this.taskCandidates.get(task.taskId)
      if (!candidates || candidates.length === 0) {
        emptyDomainTasks.push(task)
        const reasons = this.diagnoseEmptyDomain(task.subject)
        diagnostics.push(`"${task.subject.code} → ${task.section.name}": ${reasons.join('; ')}`)
      }
    }

    if (emptyDomainTasks.length === this.tasks.length) {
      throw new SchedulingError(
        `Cannot schedule any classes — all ${this.tasks.length} tasks have no valid assignments`,
        diagnostics
      )
    }

    const schedulableTasks = this.tasks.filter(t => {
      const cands = this.taskCandidates.get(t.taskId)
      return cands && cands.length > 0
    })

    const orderedTasks = this.applyMRV(schedulableTasks)

    this.assignments = []
    this.facultySlots.clear()
    this.roomSlots.clear()
    this.sectionSlots.clear()
    this.facultyDailyMinutes.clear()
    this.facultyWeeklyUnits.clear()
    this.facultySubjectSections.clear()
    this.candidateChecks = 0
    this.startTime = Date.now()

    const success = this.backtrack(orderedTasks, 0)

    if (!success) {
      const failureDetails = [
        `Attempted to schedule ${schedulableTasks.length} tasks (subject×section pairs)`,
        `${this.faculty.length} faculty, ${this.rooms.length} rooms, ${this.sections.length} sections`,
        `Successfully assigned ${this.assignments.length} before hitting a conflict`,
      ]
      if (emptyDomainTasks.length > 0) {
        failureDetails.push(`${emptyDomainTasks.length} task(s) skipped (no eligible faculty/rooms)`)
      }
      failureDetails.push(...diagnostics.slice(0, 5))
      if (diagnostics.length > 5) {
        failureDetails.push(`...and ${diagnostics.length - 5} more issues`)
      }
      failureDetails.push('Try: adding more faculty availability, checking specialization matches, or adding more rooms')

      throw new SchedulingError(
        'Unable to generate a valid schedule with current constraints',
        failureDetails
      )
    }

    return [...this.assignments]
  }

  // ── Hard Constraint Checks ────────────────────────────────────────────────
  //
  // Both checks are applied at initializeCandidates() time so invalid
  // (faculty, room) pairs are pruned BEFORE backtracking begins. This is the
  // critical optimization: the search tree never visits branches that violate
  // these hard constraints. They are also re-checked in isConsistentFast as
  // a safety net for any runtime state that may have changed.

  /**
   * Hard Constraint 1 — Building Availability
   * Returns true if the faculty member is permitted to teach in the building
   * that contains this room for the current semester.
   *
   * Evaluation order rationale: checked FIRST because it eliminates the largest
   * number of (faculty × room) pairs before we even consider timeslots. A single
   * faculty member restricted to one building eliminates all rooms in all other
   * buildings in O(1) per candidate.
   */
  private checkBuildingAvailability(facultyId: string, roomId: string): boolean {
    if (!this.constraints.enforceBuildingAvailability) return true

    const faculty = this.facultyMap.get(facultyId)
    const room = this.roomMap.get(roomId)
    if (!faculty || !room) return false

    // No restrictions recorded for this faculty — allow all buildings (legacy fallback).
    if (faculty.allowedBuildingIds.length === 0) return true

    return faculty.allowedBuildingIds.includes(room.buildingId)
  }

  /**
   * Hard Constraint 2 — Lab Specialization
   * Returns true if the room's specialization satisfies the subject's requirement.
   *
   * Evaluation order rationale: checked SECOND. After building pruning, this
   * eliminates mismatched room types within valid buildings, keeping only rooms
   * that serve the exact academic category (e.g., Cisco Networking Lab for a
   * Cisco-tagged subject). Subjects without a requiredLabSpecialization pass
   * automatically, so lecture courses are unaffected.
   */
  private checkLabSpecialization(subjectId: string, roomId: string): boolean {
    if (!this.constraints.enforceLabSpecialization) return true

    const subject = this.subjectMap.get(subjectId)
    const room = this.roomMap.get(roomId)
    if (!subject || !room) return false

    if (!subject.requiredLabSpecialization) return true

    return room.labSpecialization === subject.requiredLabSpecialization
  }

  // ── Candidate Initialization ─────────────────────────────────────────────

  /**
   * Pre-compute all valid (faculty, room, day, startTime, endTime) tuples per task.
   * Hard constraints are applied here to prune the search space before backtracking.
   * Constraint evaluation order:
   *   1. checkLabSpecialization   — most targeted, eliminates wrong room specializations
   *   2. checkBuildingAvailability — eliminates rooms in forbidden buildings per faculty
   *   3. roomCompatible (type)    — eliminates wrong room categories
   *   4. matchesSpecialization    — eliminates faculty without subject knowledge
   *   5. timeslot windows         — eliminates slots outside faculty availability
   */
  private initializeCandidates(): Map<string, Assignment[]> {
    const candidates = new Map<string, Assignment[]>()
    const days: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']

    for (const task of this.tasks) {
      const { subject, section } = task
      const possible: Assignment[] = []

      const eligibleFaculty = this.faculty.filter(f =>
        f.availability.length > 0 && this.matchesSpecialization(f, subject)
      )

      // Pre-filter rooms by lab specialization and room type — O(rooms) once per subject.
      // This avoids re-evaluating these constraints inside the nested faculty×room loop.
      const compatibleRooms = this.rooms.filter(r =>
        this.checkLabSpecialization(subject.id, r.id) && this.roomTypeCompatible(r, subject)
      )

      const sessionDuration = subject.type === 'LABORATORY' ? 180 : 60

      for (const fac of eligibleFaculty) {
        // Filter rooms further by building availability per faculty — O(compatibleRooms).
        const reachableRooms = compatibleRooms.filter(r =>
          this.checkBuildingAvailability(fac.id, r.id)
        )

        for (const room of reachableRooms) {
          for (const day of days) {
            const availWindows = fac.availability.filter(a => a.day === day)
            if (availWindows.length === 0) continue

            for (const window of availWindows) {
              const windowStart = this.toMinutes(window.startTime)
              const windowEnd = this.toMinutes(window.endTime)

              for (let start = windowStart; start + sessionDuration <= windowEnd; start += 30) {
                possible.push({
                  subjectId: subject.id,
                  facultyId: fac.id,
                  roomId: room.id,
                  sectionId: section.id,
                  day,
                  startTime: this.fromMinutes(start),
                  endTime: this.fromMinutes(start + sessionDuration),
                })
              }
            }
          }
        }
      }

      // Fisher-Yates shuffle before trimming to ensure diversity across faculty/rooms.
      if (possible.length > MAX_CANDIDATES_PER_TASK) {
        for (let i = possible.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [possible[i], possible[j]] = [possible[j], possible[i]]
        }
        possible.length = MAX_CANDIDATES_PER_TASK
      }

      candidates.set(task.taskId, possible)
    }

    return candidates
  }

  // ── Compatibility Helpers ─────────────────────────────────────────────────

  private matchesSpecialization(faculty: FacultyInput, subject: SubjectInput): boolean {
    if (faculty.specializations.length === 0) return true
    const titleLower = (subject.title?.toLowerCase() ?? '').trim()
    return faculty.specializations.some(sp => {
      const spLower = sp.toLowerCase().trim()
      return spLower === titleLower || titleLower.includes(spLower) || spLower.includes(titleLower)
    })
  }

  // Checks room type compatibility only (not lab specialization — that's a separate constraint).
  private roomTypeCompatible(room: RoomInput, subject: SubjectInput): boolean {
    if (subject.requiredRoomType.length > 0 && !subject.requiredRoomType.includes(room.type)) {
      return false
    }
    return true
  }

  private diagnoseEmptyDomain(subject: SubjectInput): string[] {
    const reasons: string[] = []

    const facultyWithAvailability = this.faculty.filter(f => f.availability.length > 0)
    if (facultyWithAvailability.length === 0) {
      reasons.push('No faculty have availability configured for this semester')
      return reasons
    }

    const eligibleBySpec = facultyWithAvailability.filter(f =>
      this.matchesSpecialization(f, subject)
    )
    if (eligibleBySpec.length === 0) {
      reasons.push(`No faculty specializations match "${subject.title}"`)
    }

    const typeCompatible = this.rooms.filter(r => this.roomTypeCompatible(r, subject))
    if (typeCompatible.length === 0) {
      const reqTypes = subject.requiredRoomType.length > 0 ? subject.requiredRoomType.join(', ') : 'any'
      reasons.push(`No rooms match required type (needs: ${reqTypes})`)
    } else if (subject.requiredLabSpecialization) {
      const specCompatible = typeCompatible.filter(r =>
        r.labSpecialization === subject.requiredLabSpecialization
      )
      if (specCompatible.length === 0) {
        reasons.push(`No rooms with lab specialization "${subject.requiredLabSpecialization}"`)
      }
    }

    if (eligibleBySpec.length > 0) {
      const reachableRooms = this.rooms.filter(r =>
        this.checkLabSpecialization(subject.id, r.id) && this.roomTypeCompatible(r, subject)
      )
      const anyReachable = eligibleBySpec.some(f =>
        reachableRooms.some(r => this.checkBuildingAvailability(f.id, r.id))
      )
      if (!anyReachable && reachableRooms.length > 0) {
        reasons.push('No eligible faculty have building availability that overlaps compatible rooms')
      }
    }

    if (reasons.length === 0) {
      reasons.push('Faculty availability windows may be too short for session duration')
    }

    return reasons
  }

  // ── Slot-Based Conflict Detection ─────────────────────────────────────────

  private hasSlotConflict(
    slots: Map<string, boolean>,
    id: string,
    day: string,
    startMin: number,
    endMin: number
  ): boolean {
    for (let t = startMin; t < endMin; t += 30) {
      if (slots.has(`${id}|${day}|${t}`)) return true
    }
    return false
  }

  private addSlots(
    slots: Map<string, boolean>,
    id: string,
    day: string,
    startMin: number,
    endMin: number
  ): void {
    for (let t = startMin; t < endMin; t += 30) {
      slots.set(`${id}|${day}|${t}`, true)
    }
  }

  private removeSlots(
    slots: Map<string, boolean>,
    id: string,
    day: string,
    startMin: number,
    endMin: number
  ): void {
    for (let t = startMin; t < endMin; t += 30) {
      slots.delete(`${id}|${day}|${t}`)
    }
  }

  // ── Backtracking ──────────────────────────────────────────────────────────

  private backtrack(tasks: SchedulingTask[], index: number): boolean {
    if (index === tasks.length) return true

    if ((Date.now() - this.startTime) > MAX_BACKTRACK_MS) return false

    const task = tasks[index]
    const candidates = this.taskCandidates.get(task.taskId) ?? []
    const ordered = this.applyLCV(candidates)

    for (const candidate of ordered) {
      this.candidateChecks++
      if (this.candidateChecks % TIMEOUT_CHECK_INTERVAL === 0) {
        if ((Date.now() - this.startTime) > MAX_BACKTRACK_MS) return false
      }

      if (this.isConsistentFast(candidate)) {
        this.assign(candidate)
        if (this.backtrack(tasks, index + 1)) return true
        this.unassign(candidate)
      }
    }

    return false
  }

  /**
   * Fast consistency check using pre-built slot maps.
   * Hard constraints (building, lab specialization) were already applied at
   * initializeCandidates time, so these checks are O(1) safety nets only.
   * The expensive O(n) checks (overlap scans) were replaced by slot maps.
   */
  private isConsistentFast(candidate: Assignment): boolean {
    const startMin = this.toMinutes(candidate.startTime)
    const endMin = this.toMinutes(candidate.endTime)

    // Hard Constraint 1 — Building Availability (safety net re-check)
    if (!this.checkBuildingAvailability(candidate.facultyId, candidate.roomId)) return false

    // Hard Constraint 2 — Lab Specialization (safety net re-check)
    if (!this.checkLabSpecialization(candidate.subjectId, candidate.roomId)) return false

    // Slot-based overlap checks
    if (this.constraints.noFacultyOverlap &&
        this.hasSlotConflict(this.facultySlots, candidate.facultyId, candidate.day, startMin, endMin)) {
      return false
    }
    if (this.constraints.noRoomOverlap &&
        this.hasSlotConflict(this.roomSlots, candidate.roomId, candidate.day, startMin, endMin)) {
      return false
    }
    if (this.constraints.noSectionOverlap &&
        this.hasSlotConflict(this.sectionSlots, candidate.sectionId, candidate.day, startMin, endMin)) {
      return false
    }

    // Daily load check
    const dailyKey = `${candidate.facultyId}|${candidate.day}`
    const currentDailyMin = this.facultyDailyMinutes.get(dailyKey) ?? 0
    if ((currentDailyMin + (endMin - startMin)) / 60 > this.constraints.maxDailyLoad) return false

    // Weekly units check
    const subject = this.subjectMap.get(candidate.subjectId)
    if (subject) {
      const currentUnits = this.facultyWeeklyUnits.get(candidate.facultyId) ?? 0
      if (currentUnits + subject.units > this.constraints.maxWeeklyUnits) return false

      // Per-subject section limit
      const fac = this.facultyMap.get(candidate.facultyId)
      if (fac?.sectionCounts && Object.keys(fac.sectionCounts).length > 0) {
        const maxSec = fac.sectionCounts[subject.title]
        if (maxSec !== undefined && maxSec > 0) {
          const fsKey = `${candidate.facultyId}|${subject.title}`
          if ((this.facultySubjectSections.get(fsKey) ?? 0) >= maxSec) return false
        }
      }

      if (this.constraints.noBackToBackLab && subject.type === 'LABORATORY') {
        if (this.hasBackToBackLabFast(candidate, startMin, endMin)) return false
      }
    }

    return true
  }

  private hasBackToBackLabFast(
    candidate: Assignment,
    candidateStart: number,
    candidateEnd: number
  ): boolean {
    return this.assignments.some(a => {
      if (a.day !== candidate.day) return false
      const otherSubject = this.subjectMap.get(a.subjectId)
      if (!otherSubject || otherSubject.type !== 'LABORATORY') return false
      if (a.facultyId !== candidate.facultyId && a.sectionId !== candidate.sectionId) return false
      const aStart = this.toMinutes(a.startTime)
      const aEnd = this.toMinutes(a.endTime)
      return aEnd === candidateStart || candidateEnd === aStart
    })
  }

  private assign(a: Assignment): void {
    this.assignments.push(a)
    const startMin = this.toMinutes(a.startTime)
    const endMin = this.toMinutes(a.endTime)

    this.addSlots(this.facultySlots, a.facultyId, a.day, startMin, endMin)
    this.addSlots(this.roomSlots, a.roomId, a.day, startMin, endMin)
    this.addSlots(this.sectionSlots, a.sectionId, a.day, startMin, endMin)

    const dailyKey = `${a.facultyId}|${a.day}`
    this.facultyDailyMinutes.set(dailyKey, (this.facultyDailyMinutes.get(dailyKey) ?? 0) + (endMin - startMin))

    const subject = this.subjectMap.get(a.subjectId)
    if (subject) {
      this.facultyWeeklyUnits.set(a.facultyId, (this.facultyWeeklyUnits.get(a.facultyId) ?? 0) + subject.units)
      const fsKey = `${a.facultyId}|${subject.title}`
      this.facultySubjectSections.set(fsKey, (this.facultySubjectSections.get(fsKey) ?? 0) + 1)
    }
  }

  private unassign(a: Assignment): void {
    this.assignments.pop()
    const startMin = this.toMinutes(a.startTime)
    const endMin = this.toMinutes(a.endTime)

    this.removeSlots(this.facultySlots, a.facultyId, a.day, startMin, endMin)
    this.removeSlots(this.roomSlots, a.roomId, a.day, startMin, endMin)
    this.removeSlots(this.sectionSlots, a.sectionId, a.day, startMin, endMin)

    const dailyKey = `${a.facultyId}|${a.day}`
    const newDaily = (this.facultyDailyMinutes.get(dailyKey) ?? 0) - (endMin - startMin)
    if (newDaily <= 0) this.facultyDailyMinutes.delete(dailyKey)
    else this.facultyDailyMinutes.set(dailyKey, newDaily)

    const subject = this.subjectMap.get(a.subjectId)
    if (subject) {
      const newUnits = (this.facultyWeeklyUnits.get(a.facultyId) ?? 0) - subject.units
      if (newUnits <= 0) this.facultyWeeklyUnits.delete(a.facultyId)
      else this.facultyWeeklyUnits.set(a.facultyId, newUnits)

      const fsKey = `${a.facultyId}|${subject.title}`
      const prevSec = this.facultySubjectSections.get(fsKey) ?? 0
      if (prevSec <= 1) this.facultySubjectSections.delete(fsKey)
      else this.facultySubjectSections.set(fsKey, prevSec - 1)
    }
  }

  // ── Heuristics ────────────────────────────────────────────────────────────

  private applyMRV(tasks: SchedulingTask[]): SchedulingTask[] {
    return [...tasks].sort((a, b) => {
      const domainA = this.taskCandidates.get(a.taskId)?.length ?? 0
      const domainB = this.taskCandidates.get(b.taskId)?.length ?? 0
      if (domainA !== domainB) return domainA - domainB
      // Labs first — they have tighter constraints (specialization + building)
      if (a.subject.type === 'LABORATORY' && b.subject.type !== 'LABORATORY') return -1
      if (b.subject.type === 'LABORATORY' && a.subject.type !== 'LABORATORY') return 1
      return b.subject.units - a.subject.units
    })
  }

  private applyLCV(domain: Assignment[]): Assignment[] {
    if (this.constraints.preferMorningSlots) {
      return [...domain].sort((a, b) => this.toMinutes(a.startTime) - this.toMinutes(b.startTime))
    }
    return domain
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  private toMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
  }

  private fromMinutes(minutes: number): string {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  }
}
