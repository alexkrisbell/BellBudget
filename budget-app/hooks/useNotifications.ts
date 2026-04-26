'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/appStore'
import type { Notification } from '@/types'

interface NotificationsResponse {
  notifications: Notification[]
  unread_count: number
}

async function fetchNotifications(): Promise<NotificationsResponse> {
  const res = await fetch('/api/notifications')
  if (!res.ok) throw new Error('Failed to fetch notifications')
  return res.json()
}

export function useNotifications(householdId: string | null) {
  const queryClient = useQueryClient()
  const setNotifCount = useAppStore((s) => s.setNotifCount)
  const incrementNotifCount = useAppStore((s) => s.incrementNotifCount)

  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    enabled: !!householdId,
    staleTime: 30 * 1000,
  })

  // Sync unread count to Zustand whenever data changes
  useEffect(() => {
    if (query.data) {
      setNotifCount(query.data.unread_count)
    }
  }, [query.data, setNotifCount])

  // Supabase Realtime — listen for new notifications for this household
  useEffect(() => {
    if (!householdId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`notifications:${householdId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `household_id=eq.${householdId}`,
        },
        () => {
          // Refetch and bump badge
          queryClient.invalidateQueries({ queryKey: ['notifications'] })
          incrementNotifCount()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [householdId, queryClient, incrementNotifCount])

  return query
}

export async function markNotificationRead(id: string) {
  await fetch(`/api/notifications/${id}/read`, { method: 'POST' })
}

export async function markAllRead(notifications: Notification[]) {
  await Promise.all(notifications.map((n) => markNotificationRead(n.id)))
}
