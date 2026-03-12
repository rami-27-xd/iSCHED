import { create } from "zustand"

interface ScheduleEntry {
  id: string
  subjectId: string
  facultyId: string
  roomId: string
  sectionId: string
  day: string
  startTime: string
  endTime: string
}

interface ScheduleStore {
  // State
  selectedEntryId: string | null
  pendingChanges: Map<string, Partial<ScheduleEntry>>
  isDirty: boolean
  isGenerating: boolean
  currentScheduleId: string | null
  currentSemesterId: string | null
  viewMode: "calendar" | "list"

  // Actions
  selectEntry: (id: string | null) => void
  updateEntry: (id: string, changes: Partial<ScheduleEntry>) => void
  resetChanges: () => void
  setGenerating: (isGenerating: boolean) => void
  setCurrentSchedule: (scheduleId: string | null) => void
  setCurrentSemester: (semesterId: string | null) => void
  setViewMode: (mode: "calendar" | "list") => void
}

export const useScheduleStore = create<ScheduleStore>((set) => ({
  selectedEntryId: null,
  pendingChanges: new Map(),
  isDirty: false,
  isGenerating: false,
  currentScheduleId: null,
  currentSemesterId: null,
  viewMode: "calendar",

  selectEntry: (id) => set({ selectedEntryId: id }),

  updateEntry: (id, changes) =>
    set((state) => {
      const next = new Map(state.pendingChanges)
      next.set(id, { ...(next.get(id) ?? {}), ...changes })
      return { pendingChanges: next, isDirty: true }
    }),

  resetChanges: () =>
    set({ pendingChanges: new Map(), isDirty: false }),

  setGenerating: (isGenerating) => set({ isGenerating }),

  setCurrentSchedule: (scheduleId) =>
    set({ currentScheduleId: scheduleId }),

  setCurrentSemester: (semesterId) =>
    set({ currentSemesterId: semesterId }),

  setViewMode: (mode) => set({ viewMode: mode }),
}))
