'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { Button } from '@/components/ui/button'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function MonthSelector() {
  const currentMonth = useAppStore((s) => s.currentMonth)
  const currentYear = useAppStore((s) => s.currentYear)
  const setCurrentMonth = useAppStore((s) => s.setCurrentMonth)

  function prev() {
    const m = currentMonth === 1 ? 12 : currentMonth - 1
    const y = currentMonth === 1 ? currentYear - 1 : currentYear
    setCurrentMonth(m, y)
  }

  function next() {
    const m = currentMonth === 12 ? 1 : currentMonth + 1
    const y = currentMonth === 12 ? currentYear + 1 : currentYear
    setCurrentMonth(m, y)
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon-sm" onClick={prev} aria-label="Previous month">
        <ChevronLeft />
      </Button>
      <span className="text-sm font-medium text-slate-700 min-w-36 text-center">
        {MONTH_NAMES[currentMonth - 1]} {currentYear}
      </span>
      <Button variant="ghost" size="icon-sm" onClick={next} aria-label="Next month">
        <ChevronRight />
      </Button>
    </div>
  )
}
