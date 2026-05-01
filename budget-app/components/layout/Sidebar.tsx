'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ArrowLeftRight, PieChart, Landmark, Settings } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard',    label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions',  icon: ArrowLeftRight },
  { href: '/budget',       label: 'Budget',        icon: PieChart },
  { href: '/accounts',     label: 'Accounts',      icon: Landmark },
  { href: '/settings',     label: 'Settings',      icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex w-60 flex-col bg-[#0D321C] min-h-screen">
      <div className="h-16 flex items-center gap-2.5 px-5 border-b border-white/10">
        <Image src="/Icon-192.png" width={32} height={32} alt="" className="rounded-lg flex-shrink-0" />
        <span className="text-lg font-bold text-white">Bell Bucks</span>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-[#FBC64F]/20 text-[#FBC64F]'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
