'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function MonthNav({ month, year }: { month: number; year: number }) {
  const router = useRouter()

  function navigate(m: number, y: number) {
    const now = new Date()
    if (m === now.getMonth() + 1 && y === now.getFullYear()) {
      router.push('/budget')
    } else {
      router.push(`/budget/${y}-${String(m).padStart(2, '0')}`)
    }
  }

  function prev() {
    navigate(month === 1 ? 12 : month - 1, month === 1 ? year - 1 : year)
  }

  function next() {
    navigate(month === 12 ? 1 : month + 1, month === 12 ? year + 1 : year)
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon-sm" onClick={prev} aria-label="Previous month">
        <ChevronLeft />
      </Button>
      <span className="text-sm font-medium text-slate-700 min-w-36 text-center">
        {MONTH_NAMES[month - 1]} {year}
      </span>
      <Button variant="ghost" size="icon-sm" onClick={next} aria-label="Next month">
        <ChevronRight />
      </Button>
    </div>
  )
}
