import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { safeFetch } from "@/lib/api-client"

// ─── Safe raw fetch that handles HTML redirects / non-JSON ───────────────────
async function rawFetch(url: string, options?: RequestInit) {
  let res: Response
  try {
    res = await fetch(url, { ...options, redirect: "follow" })
  } catch {
    throw new Error("Network error — could not reach the server.")
  }
  if (res.redirected || res.headers.get("content-type")?.includes("text/html")) {
    throw new Error("Session expired. Please sign in again.")
  }
  let json: any
  try {
    json = await res.json()
  } catch {
    throw new Error(`Server error (status ${res.status}).`)
  }
  return { res, json }
}

// ---------- Fetch schedules list ----------
export function useSchedules(semesterId?: string, isArchived = false, collegeId?: string | null) {
  return useQuery({
    queryKey: ["schedules", { semesterId, isArchived, collegeId }],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (semesterId) params.set("semesterId", semesterId)
      if (isArchived) params.set("isArchived", "true")
      if (collegeId) params.set("collegeId", collegeId)
      return safeFetch<any[]>(`/api/schedules?${params}`)
    },
    staleTime: 0,
    refetchInterval: 5000, // Poll every 5 seconds for live multi-user updates
    refetchIntervalInBackground: false, // Only poll when tab is active
  })
}

// ---------- Fetch single schedule with entries ----------
export function useSchedule(scheduleId: string | null) {
  return useQuery({
    queryKey: ["schedules", scheduleId],
    queryFn: async () => {
      if (!scheduleId) return null
      return safeFetch<any>(`/api/schedules/${scheduleId}`)
    },
    enabled: !!scheduleId,
    staleTime: 0,
    refetchInterval: 5000, // Poll every 5 seconds for live multi-user updates
    refetchIntervalInBackground: false,
  })
}

// ---------- Generate schedule ----------
export function useGenerateSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (scheduleId: string) => {
      const { res, json } = await rawFetch(`/api/schedules/${scheduleId}/generate`, {
        method: "POST",
      })
      if (!res.ok || json.error || json.success === false) {
        const err = new Error(json.error ?? `Server error (${res.status})`) as Error & { details?: string[] }
        err.details = json.details ?? []
        throw err
      }
      return json.data
    },
    onSuccess: (_data, scheduleId) => {
      queryClient.invalidateQueries({ queryKey: ["schedules", scheduleId] })
      queryClient.invalidateQueries({ queryKey: ["schedules"] })
    },
  })
}

// ---------- Update schedule status ----------
export function useUpdateSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ scheduleId, status }: { scheduleId: string; status: string }) => {
      const { json } = await rawFetch(`/api/schedules/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (json.error) throw new Error(json.error)
      return json.data
    },
    onSuccess: (_data, { scheduleId }) => {
      queryClient.invalidateQueries({ queryKey: ["schedules", scheduleId] })
      queryClient.invalidateQueries({ queryKey: ["schedules"] })
    },
  })
}

// ---------- Archive/unarchive schedule ----------
export function useArchiveSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ scheduleId, action }: { scheduleId: string; action: "archive" | "unarchive" }) => {
      const { json } = await rawFetch(`/api/schedules/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (json.error) throw new Error(json.error)
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] })
    },
  })
}

// ---------- Delete schedule ----------
export function useDeleteSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (scheduleId: string) => {
      const { json } = await rawFetch(`/api/schedules/${scheduleId}`, {
        method: "DELETE",
      })
      if (json.error) throw new Error(json.error)
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] })
    },
  })
}

// ---------- Update schedule entry ----------
export function useUpdateEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ scheduleId, entryId, changes }: { scheduleId: string; entryId: string; changes: Record<string, unknown> }) => {
      const { json } = await rawFetch(`/api/schedules/${scheduleId}/entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      })
      if (json.error) throw new Error(json.error)
      // warning is returned when force:true bypassed a constraint
      return { data: json.data, warning: (json.warning as string) ?? null }
    },
    onSuccess: (_data, { scheduleId }) => {
      queryClient.invalidateQueries({ queryKey: ["schedules", scheduleId] })
    },
  })
}

// ---------- Delete schedule entry ----------
export function useDeleteEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ scheduleId, entryId }: { scheduleId: string; entryId: string }) => {
      const { json } = await rawFetch(`/api/schedules/${scheduleId}/entries/${entryId}`, {
        method: "DELETE",
      })
      if (json.error) throw new Error(json.error)
      return json.data
    },
    onSuccess: (_data, { scheduleId }) => {
      queryClient.invalidateQueries({ queryKey: ["schedules", scheduleId] })
    },
  })
}

// ---------- Publish schedule ----------
export function usePublishSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (scheduleId: string) => {
      const { res, json } = await rawFetch(`/api/schedules/${scheduleId}/publish`, {
        method: "POST",
      })
      if (!res.ok && json.data) {
        // 422 with conflict data
        return { ...json.data, _status: res.status }
      }
      if (json.error) throw new Error(json.error)
      return json.data
    },
    onSuccess: (_data, scheduleId) => {
      queryClient.invalidateQueries({ queryKey: ["schedules", scheduleId] })
      queryClient.invalidateQueries({ queryKey: ["schedules"] })
    },
  })
}

// ---------- Unpublish schedule ----------
export function useUnpublishSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (scheduleId: string) => {
      const { json } = await rawFetch(`/api/schedules/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unpublish" }),
      })
      if (json.error) throw new Error(json.error)
      return json.data
    },
    onSuccess: (_data, scheduleId) => {
      queryClient.invalidateQueries({ queryKey: ["schedules", scheduleId] })
      queryClient.invalidateQueries({ queryKey: ["schedules"] })
    },
  })
}

// ---------- Create schedule ----------
export function useCreateSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { semesterType: string; schoolYear: string; startDate?: string; endDate?: string }) => {
      const { json } = await rawFetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (json.error) throw new Error(json.error)
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] })
    },
  })
}

// ---------- Create schedule entry ----------
export function useCreateEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ scheduleId, entry }: {
      scheduleId: string
      entry: {
        subjectId: string
        facultyId: string
        facultyName?: string | null  // free-text name override
        roomId: string
        sectionId: string
        day: string
        startTime: string
        endTime: string
        set?: string | null
      }
    }) => {
      const { res, json } = await rawFetch(`/api/schedules/${scheduleId}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      })
      if (!res.ok || json.error) throw new Error(json.error ?? `Server error (${res.status})`)
      return json.data
    },
    onSuccess: (_data, { scheduleId }) => {
      queryClient.invalidateQueries({ queryKey: ["schedules", scheduleId] })
    },
  })
}

// ---------- Fetch faculty ----------
export function useFaculty(departmentId?: string) {
  return useQuery({
    queryKey: ["faculty", { departmentId }],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (departmentId) params.set("departmentId", departmentId)
      return safeFetch<any[]>(`/api/faculty?${params}`)
    },
    staleTime: 1000 * 60 * 5,
  })
}

// ---------- Fetch rooms ----------
export function useRooms(type?: string) {
  return useQuery({
    queryKey: ["rooms", { type }],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (type) params.set("type", type)
      return safeFetch<any[]>(`/api/rooms?${params}`)
    },
    staleTime: 1000 * 60 * 5,
  })
}
