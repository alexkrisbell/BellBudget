'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Bell, LogOut, User } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { signOut } from '@/lib/auth/actions'
import { useNotifications } from '@/hooks/useNotifications'
import { NotificationPanel } from './NotificationPanel'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface TopBarProps {
  title?: string
  userFullName?: string | null
  householdId?: string | null
}

export function TopBar({ title, userFullName, householdId = null }: TopBarProps) {
  const notifCount = useAppStore((s) => s.notifCount)
  const [panelOpen, setPanelOpen] = useState(false)

  const { data } = useNotifications(householdId)
  const notifications = data?.notifications ?? []

  return (
    <>
      <header className="h-16 flex items-center justify-between px-4 md:px-6 bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="flex items-center gap-2 md:hidden">
          <Image src="/Icon-192.png" width={28} height={28} alt="" className="rounded-md flex-shrink-0" />
          <h1 className="text-base font-semibold text-slate-900">
            {title ?? 'Bell Bucks'}
          </h1>
        </div>
        <div className="hidden md:block" />

        <div className="flex items-center gap-2">
          {/* Notification bell */}
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => setPanelOpen(true)}
          >
            <Bell className="h-5 w-5 text-slate-600" />
            {notifCount > 0 && (
              <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center leading-none">
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </Button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
              <User className="h-5 w-5 text-slate-600" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {userFullName && (
                <>
                  <div className="px-2 py-1.5 text-sm font-medium text-slate-700 truncate">
                    {userFullName}
                  </div>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem variant="destructive" className="cursor-pointer">
                <form action={signOut} className="flex items-center gap-2 w-full">
                  <LogOut className="h-4 w-4" />
                  <button type="submit" className="w-full text-left">Sign out</button>
                </form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <NotificationPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        notifications={notifications}
      />
    </>
  )
}
