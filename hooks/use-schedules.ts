import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

// ---------- Fetch schedules list ----------
export function useSchedules(semesterId?: string) {
  return useQuery({
    queryKey: ["schedules", { semesterId }],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (semesterId) params.set("semesterId", semesterId)
      const res = await fetch(`/api/schedules?${params}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      return json.data
    },
    staleTime: 1000 * 60 * 2,
  })
}

// ---------- Fetch single schedule with entries ----------
export function useSchedule(scheduleId: string | null) {
  return useQuery({
    queryKey: ["schedules", scheduleId],
    queryFn: async () => {
      if (!scheduleId) return null
      const res = await fetch(`/api/schedules/${scheduleId}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      return json.data
    },
    enabled: !!scheduleId,
    staleTime: 1000 * 60 * 2,
  })
}

// ---------- Generate schedule ----------
export function useGenerateSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (scheduleId: string) => {
      const res = await fetch(`/api/schedules/${scheduleId}/generate`, {
        method: "POST",
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
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
    mutationFn: async ({
      scheduleId,
      status,
    }: {
      scheduleId: string
      status: string
    }) => {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      return json.data
    },
    onSuccess: (_data, { scheduleId }) => {
      queryClient.invalidateQueries({ queryKey: ["schedules", scheduleId] })
      queryClient.invalidateQueries({ queryKey: ["schedules"] })
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
      const res = await fetch(`/api/faculty?${params}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      return json.data
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
      const res = await fetch(`/api/rooms?${params}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      return json.data
    },
    staleTime: 1000 * 60 * 5,
  })
}
