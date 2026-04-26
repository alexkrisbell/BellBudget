'use client'

import { useAppStore } from '@/store/appStore'
import { useDashboard } from '@/hooks/useDashboard'
import { MonthSelector } from '@/components/shared/MonthSelector'
import { StreakBadge } from './StreakBadge'
import { BudgetOverviewCard } from './BudgetOverviewCard'
import { CategoryGrid } from './CategoryGrid'
import { IncomeStrip } from './IncomeStrip'
import { RecentTransactions } from './RecentTransactions'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import type { DashboardData } from '@/types'

interface Props {
  initialData: DashboardData
  initialMonth: number
  initialYear: number
}

export function DashboardClient({ initialData, initialMonth, initialYear }: Props) {
  const currentMonth = useAppStore((s) => s.currentMonth)
  const currentYear = useAppStore((s) => s.currentYear)

  const isInitialMonth = currentMonth === initialMonth && currentYear === initialYear

  const { data, isLoading, isError } = useDashboard(
    { month: currentMonth, year: currentYear },
    isInitialMonth ? initialData : undefined
  )

  // Show skeleton rows while loading a different month
  if (isLoading && !data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-slate-100 rounded-full w-48" />
        <div className="h-28 bg-slate-100 rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-xl" />
          ))}
        </div>
        <div className="h-20 bg-slate-100 rounded-xl" />
      </div>
    )
  }

  if (isError && !data) {
    return (
      <ErrorAlert
        title="Failed to load dashboard"
        message="There was a problem fetching your financial data. Your last data is shown below if available."
        className="mb-4"
      />
    )
  }

  const d = data ?? initialData

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StreakBadge current={d.streak.current} onTrack={d.streak.on_track} />
        <MonthSelector />
      </div>

      <BudgetOverviewCard
        totalBudgeted={d.total_budgeted}
        totalSpent={d.total_spent}
        totalRemaining={d.total_remaining}
        pctUsed={d.pct_used}
      />

      <CategoryGrid categories={d.categories} />

      <IncomeStrip expected={d.income.expected} actual={d.income.actual} />

      <RecentTransactions transactions={d.recent_transactions} />
    </div>
  )
}
