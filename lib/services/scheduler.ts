// Constraint-Based Scheduling Engine with Backtracking Algorithm
// Uses MRV (Minimum Remaining Values) and LCV (Least Constraining Value) heuristics

type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY'

interface SubjectInput {
  id: string
  code: string
  hoursPerWeek: number
  type: 'LECTURE' | 'LABORATORY' | 'HYBRID'
  requiredRoomType: string[]
  units: number
}

interface FacultyInput {
  id: string
  name: string
  specializations: string[]
  maxUnitsPerWeek: number
  availability: {
    day: DayOfWeek
    startTime: string
    endTime: string
  }[]
}

interface RoomInput {
  id: string
  code: string
  type: string
  capacity: number
}

interface SectionInput {
  id: string
  name: string
  capacity: number
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

export interface ScheduleConstraints {
  noFacultyOverlap: boolean
  noRoomOverlap: boolean
  noSectionOverlap: boolean
  respectFacultyAvail: boolean
  respectRoomType: boolean
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
  maxDailyLoad: 8,
  maxWeeklyUnits: 21,
  noBackToBackLab: true,
  preferMorningSlots: false,
}

export class SchedulingError extends Error {
  constructor(message: string, public details?: string[]) {
    super(message)
    this.name = 'SchedulingError'
  }
}

export class SchedulingEngine {
  private assignments: Assignment[] = []
  private constraints: ScheduleConstraints
  private domains: Map<string, Assignment[]>
  private savedDomains: Map<string, Map<string, Assignment[]>> = new Map()

  constructor(
    private subjects: SubjectInput[],
    private faculty: FacultyInput[],
    private rooms: RoomInput[],
    private sections: SectionInput[],
    constraints: Partial<ScheduleConstraints> = {}
  ) {
    this.constraints = { ...DEFAULT_CONSTRAINTS, ...constraints }
    this.domains = this.initializeDomains()
  }

  async generate(): Promise<Assignment[]> {
    this.assignments = []
    const orderedSubjects = this.applyMRV(this.subjects)
    const success = this.backtrack(orderedSubjects, 0)

    if (!success) {
      throw new SchedulingError(
        'Unable to generate a valid schedule with current constraints',
        ['Try relaxing constraints or adding more rooms/timeslots']
      )
    }
    return [...this.assignments]
  }

  private backtrack(subjects: SubjectInput[], index: number): boolean {
    if (index === subjects.length) return true

    const subject = subjects[index]
    const domain = this.domains.get(subject.id) ?? []
    const ordered = this.applyLCV(domain)

    for (const candidate of ordered) {
      if (this.isConsistent(candidate)) {
        this.assignments.push(candidate)
        this.saveDomains(subject.id)
        this.propagateConstraints(candidate)

        if (this.backtrack(subjects, index + 1)) return true

        this.assignments.pop()
        this.restoreDomains(subject.id)
      }
    }

    return false
  }

  private isConsistent(candidate: Assignment): boolean {
    if (this.constraints.noFacultyOverlap && this.hasFacultyConflict(candidate)) return false
    if (this.constraints.noRoomOverlap && this.hasRoomConflict(candidate)) return false
    if (this.constraints.noSectionOverlap && this.hasSectionConflict(candidate)) return false
    if (this.constraints.respectFacultyAvail && !this.isFacultyAvailable(candidate)) return false
    if (this.exceedsDailyLoad(candidate)) return false
    if (this.exceedsWeeklyUnits(candidate)) return false
    return true
  }

  private hasFacultyConflict(candidate: Assignment): boolean {
    return this.assignments.some(a =>
      a.facultyId === candidate.facultyId &&
      a.day === candidate.day &&
      this.timesOverlap(a.startTime, a.endTime, candidate.startTime, candidate.endTime)
    )
  }

  private hasRoomConflict(candidate: Assignment): boolean {
    return this.assignments.some(a =>
      a.roomId === candidate.roomId &&
      a.day === candidate.day &&
      this.timesOverlap(a.startTime, a.endTime, candidate.startTime, candidate.endTime)
    )
  }

  private hasSectionConflict(candidate: Assignment): boolean {
    return this.assignments.some(a =>
      a.sectionId === candidate.sectionId &&
      a.day === candidate.day &&
      this.timesOverlap(a.startTime, a.endTime, candidate.startTime, candidate.endTime)
    )
  }

  private isFacultyAvailable(candidate: Assignment): boolean {
    const faculty = this.faculty.find(f => f.id === candidate.facultyId)
    if (!faculty) return false

    return faculty.availability.some(a =>
      a.day === candidate.day &&
      this.toMinutes(a.startTime) <= this.toMinutes(candidate.startTime) &&
      this.toMinutes(a.endTime) >= this.toMinutes(candidate.endTime)
    )
  }

  private exceedsDailyLoad(candidate: Assignment): boolean {
    const dailyHours = this.assignments
      .filter(a => a.facultyId === candidate.facultyId && a.day === candidate.day)
      .reduce((sum, a) => sum + (this.toMinutes(a.endTime) - this.toMinutes(a.startTime)) / 60, 0)

    const candidateHours = (this.toMinutes(candidate.endTime) - this.toMinutes(candidate.startTime)) / 60
    return (dailyHours + candidateHours) > this.constraints.maxDailyLoad
  }

  private exceedsWeeklyUnits(candidate: Assignment): boolean {
    const subject = this.subjects.find(s => s.id === candidate.subjectId)
    if (!subject) return false

    const currentUnits = this.assignments
      .filter(a => a.facultyId === candidate.facultyId)
      .reduce((sum, a) => {
        const s = this.subjects.find(sub => sub.id === a.subjectId)
        return sum + (s?.units ?? 0)
      }, 0)

    return (currentUnits + subject.units) > this.constraints.maxWeeklyUnits
  }

  private timesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
    const [start1, end1] = [this.toMinutes(s1), this.toMinutes(e1)]
    const [start2, end2] = [this.toMinutes(s2), this.toMinutes(e2)]
    return start1 < end2 && start2 < end1
  }

  private toMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
  }

  private fromMinutes(minutes: number): string {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  }

  private applyMRV(subjects: SubjectInput[]): SubjectInput[] {
    return [...subjects].sort((a, b) => {
      const domainA = this.domains.get(a.id)?.length ?? 0
      const domainB = this.domains.get(b.id)?.length ?? 0
      if (domainA !== domainB) return domainA - domainB
      // Tie-break: labs first (harder to schedule)
      if (a.type === 'LABORATORY' && b.type !== 'LABORATORY') return -1
      if (b.type === 'LABORATORY' && a.type !== 'LABORATORY') return 1
      // Then by units DESC
      return b.units - a.units
    })
  }

  private applyLCV(domain: Assignment[]): Assignment[] {
    if (this.constraints.preferMorningSlots) {
      return [...domain].sort((a, b) =>
        this.toMinutes(a.startTime) - this.toMinutes(b.startTime)
      )
    }
    return domain
  }

  private propagateConstraints(assigned: Assignment): void {
    for (const [subjectId, domain] of this.domains) {
      this.domains.set(
        subjectId,
        domain.filter(a => {
          if (a.facultyId === assigned.facultyId && a.day === assigned.day &&
              this.timesOverlap(a.startTime, a.endTime, assigned.startTime, assigned.endTime)) {
            return false
          }
          if (a.roomId === assigned.roomId && a.day === assigned.day &&
              this.timesOverlap(a.startTime, a.endTime, assigned.startTime, assigned.endTime)) {
            return false
          }
          if (a.sectionId === assigned.sectionId && a.day === assigned.day &&
              this.timesOverlap(a.startTime, a.endTime, assigned.startTime, assigned.endTime)) {
            return false
          }
          return true
        })
      )
    }
  }

  private saveDomains(key: string): void {
    const snapshot = new Map<string, Assignment[]>()
    for (const [sid, domain] of this.domains) {
      snapshot.set(sid, [...domain])
    }
    this.savedDomains.set(key, snapshot)
  }

  private restoreDomains(key: string): void {
    const snapshot = this.savedDomains.get(key)
    if (snapshot) {
      this.domains = snapshot
      this.savedDomains.delete(key)
    }
  }

  private initializeDomains(): Map<string, Assignment[]> {
    const domains = new Map<string, Assignment[]>()
    const days: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']

    for (const subject of this.subjects) {
      const possible: Assignment[] = []
      const eligibleFaculty = this.faculty.filter(f =>
        f.specializations.length === 0 || f.specializations.some(s => subject.code.includes(s))
      )
      const compatibleRooms = this.rooms.filter(r =>
        subject.requiredRoomType.length === 0 || subject.requiredRoomType.includes(r.type)
      )

      for (const faculty of eligibleFaculty) {
        for (const room of compatibleRooms) {
          for (const section of this.sections) {
            if (room.capacity < section.capacity) continue

            for (const day of days) {
              const availWindows = faculty.availability.filter(a => a.day === day)
              for (const window of availWindows) {
                const windowStart = this.toMinutes(window.startTime)
                const windowEnd = this.toMinutes(window.endTime)
                const durationMins = subject.hoursPerWeek * 60

                for (let start = windowStart; start + durationMins <= windowEnd; start += 30) {
                  possible.push({
                    subjectId: subject.id,
                    facultyId: faculty.id,
                    roomId: room.id,
                    sectionId: section.id,
                    day,
                    startTime: this.fromMinutes(start),
                    endTime: this.fromMinutes(start + durationMins),
                  })
                }
              }
            }
          }
        }
      }

      domains.set(subject.id, possible)
    }

    return domains
  }
}
