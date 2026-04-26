'use client'

import { useEffect, useRef } from 'react'
import { X, BellOff } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/store/appStore'
import { markNotificationRead, markAllRead } from '@/hooks/useNotifications'
import type { Notification } from '@/types'
import { cn } from '@/lib/utils'

const TYPE_LABELS: Record<Notification['type'], string> = {
  budget_warning: '⚠️ Budget Warning',
  budget_exceeded: '🚨 Budget Exceeded',
  paycheck: '💰 Paycheck',
  streak_update: '🔥 Streak',
  item_error: '🔗 Bank Issue',
}

interface Props {
  open: boolean
  onClose: () => void
  notifications: Notification[]
}

export function NotificationPanel({ open, onClose, notifications }: Props) {
  const queryClient = useQueryClient()
  const decrementNotifCount = useAppStore((s) => s.decrementNotifCount)
  const setNotifCount = useAppStore((s) => s.setNotifCount)
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open, onClose])

  async function handleMarkRead(id: string) {
    await markNotificationRead(id)
    decrementNotifCount()
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  async function handleMarkAllRead() {
    await markAllRead(notifications)
    setNotifCount(0)
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          'fixed top-0 right-0 h-full w-80 bg-white shadow-xl z-50 flex flex-col transition-transform duration-200',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 shrink-0">
          <p className="text-sm font-semibold text-slate-800">Notifications</p>
          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-indigo-600 hover:underline"
              >
                Mark all read
              </button>
            )}
            <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
              <X className="h-4 w-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
              <BellOff className="h-8 w-8" />
              <p className="text-sm">You&apos;re all caught up</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {notifications.map((n) => (
                <li key={n.id} className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-500 mb-0.5">
                      {TYPE_LABELS[n.type]}
                    </p>
                    <p className="text-sm font-semibold text-slate-800 truncate">{n.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {new Date(n.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => handleMarkRead(n.id)}
                    className="shrink-0 mt-0.5 h-5 w-5 rounded-full border border-slate-300 hover:bg-indigo-100 hover:border-indigo-400 transition-colors"
                    title="Mark as read"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}
