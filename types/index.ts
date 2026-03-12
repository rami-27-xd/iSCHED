export type UserRole = 'SUPER_ADMIN' | 'DEPARTMENT_CHAIR' | 'PROGRAM_HEAD' | 'FACULTY' | 'STUDENT'
export type ScheduleStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'PUBLISHED' | 'ARCHIVED'
export type SubjectType = 'LECTURE' | 'LABORATORY' | 'HYBRID'
export type RoomType = 'LECTURE_ROOM' | 'LABORATORY' | 'COMPUTER_LAB' | 'LECTURE_LAB'
export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY'
export type SemesterType = 'FIRST' | 'SECOND' | 'SUMMER'
export type ConflictType = 'FACULTY_OVERLAP' | 'ROOM_OVERLAP' | 'SECTION_OVERLAP' | 'LOAD_EXCEEDED' | 'AVAILABILITY_VIOLATION' | 'ROOM_CAPACITY_EXCEEDED'

export interface NavItem {
  title: string
  href: string
  icon: string
  roles: UserRole[]
  badge?: number
}

export interface KPIData {
  title: string
  value: string | number
  change?: { value: number; label: string }
  icon: string
  variant?: 'default' | 'accent' | 'success' | 'error'
}

export interface ApiResponse<T> {
  data: T | null
  error: string | null
  meta?: { total?: number; page?: number; perPage?: number }
}

export interface Conflict {
  type: ConflictType
  severity: 'ERROR' | 'WARNING'
  description: string
  entryIds: string[]
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
  preferMorningSlots?: boolean
}
