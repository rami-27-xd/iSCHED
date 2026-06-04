'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

/**
 * Supabase Realtime hook for live schedule updates.
 * Listens to INSERT/UPDATE/DELETE on ScheduleEntry and Schedule tables.
 * When a change is detected from another user, invalidates React Query cache
 * so the UI auto-refreshes without manual reload.
 */
export function useRealtimeSchedules(scheduleId?: string | null) {
  const queryClient = useQueryClient()
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    const supabase = supabaseRef.current

    // Channel for schedule entry changes (entries added/edited/deleted)
    const entryChannel = supabase
      .channel('schedule-entries-realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'ScheduleEntry',
        },
        (payload) => {
          console.log('[Realtime] ScheduleEntry change:', payload.eventType)

          // Invalidate the specific schedule detail (entries list)
          const changedScheduleId =
            (payload.new as any)?.scheduleId ||
            (payload.old as any)?.scheduleId

          if (changedScheduleId) {
            queryClient.invalidateQueries({ queryKey: ['schedules', changedScheduleId] })
          }

          // Also invalidate the schedule list (entry counts may change)
          queryClient.invalidateQueries({ queryKey: ['schedules'] })
        }
      )
      .subscribe()

    // Channel for schedule-level changes (status changes like DRAFT → PUBLISHED)
    const scheduleChannel = supabase
      .channel('schedules-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Schedule',
        },
        (payload) => {
          console.log('[Realtime] Schedule change:', payload.eventType)
          queryClient.invalidateQueries({ queryKey: ['schedules'] })

          const changedId = (payload.new as any)?.id || (payload.old as any)?.id
          if (changedId) {
            queryClient.invalidateQueries({ queryKey: ['schedules', changedId] })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(entryChannel)
      supabase.removeChannel(scheduleChannel)
    }
  }, [queryClient])
}

/**
 * Realtime hook for notifications — shows live notification count updates.
 */
export function useRealtimeNotifications(userId?: string) {
  const queryClient = useQueryClient()
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    if (!userId) return

    const supabase = supabaseRef.current

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Notification',
          filter: `userId=eq.${userId}`,
        },
        () => {
          console.log('[Realtime] New notification')
          queryClient.invalidateQueries({ queryKey: ['notifications'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, queryClient])
}
