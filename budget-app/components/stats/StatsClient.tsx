'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { cn, formatCurrency } from '@/lib/utils'
import { useStats } from '@/hooks/useStats'
import { useAppStore } from '@/store/appStore'
import type { StatsData } from '@/lib/stats/compute'

const WINDOW_OPTIONS = [3, 6, 12] as const

interface Props {
  initialData: StatsData
  initialMonths: number
}

export function StatsClient({ initialData, initialMonths }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const setCurrentMonth = useAppStore((s) => s.setCurrentMonth)

  const months = parseInt(searchParams.get('months') ?? String(initialMonths), 10)
  const { data } = useStats(
    { months },
    months === initialMonths ? initialData : undefined
  )

  function setMonths(m: number) {
    router.replace(`${pathname}?months=${m}`)
  }

  function goToMonth(month: number, year: number) {
    setCurrentMonth(month, year)
    router.push('/dashboard')
  }

  if (!data) {
    return null
  }

  const currentMonth = data.months.at(-1)
  const chartMonths = data.months.map((m) => ({ ...m }))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1.5">
        {WINDOW_OPTIONS.map((m) => (
          <button
            key={m}
            onClick={() => setMonths(m)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              months === m
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
          >
            {m} months
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-100 bg-white p-4">
          <p className="text-xs text-slate-400 mb-0.5">This month saved</p>
          <p
            className={cn(
              'text-xl font-semibold',
              (currentMonth?.saved ?? 0) < 0 ? 'text-red-600' : 'text-slate-800'
            )}
          >
            {formatCurrency(currentMonth?.saved ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4">
          <p className="text-xs text-slate-400 mb-0.5">Avg monthly spend</p>
          <p className="text-xl font-semibold text-slate-800">
            {formatCurrency(data.avgMonthlySpend)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4">
          <p className="text-xs text-slate-400 mb-0.5">Avg savings rate</p>
          <p className="text-xl font-semibold text-slate-800">
            {data.avgSavingsRate !== null ? `${Math.round(data.avgSavingsRate * 100)}%` : '—'}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-100 bg-white p-5">
        <p className="text-sm font-medium text-slate-600 mb-1">Saved per month</p>
        <p className="text-xs text-slate-400 mb-4">Click a bar to open that month&apos;s dashboard.</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartMonths} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={56}
              tickFormatter={(v: number) => formatCurrency(v)}
            />
            <Tooltip
              formatter={(value) => formatCurrency(Number(value))}
              contentStyle={{ fontSize: 13, borderRadius: 8, borderColor: '#e2e8f0' }}
            />
            <ReferenceLine y={0} stroke="#cbd5e1" />
            <Bar
              dataKey="saved"
              radius={[4, 4, 4, 4]}
              cursor="pointer"
              onClick={(entry) => {
                const m = entry?.payload as (typeof chartMonths)[number] | undefined
                if (m) goToMonth(m.month, m.year)
              }}
            >
              {chartMonths.map((m) => (
                <Cell key={`${m.year}-${m.month}`} fill={m.saved >= 0 ? '#22c55e' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-slate-100 bg-white p-5">
        <p className="text-sm font-medium text-slate-600 mb-1">Spent per month</p>
        <p className="text-xs text-slate-400 mb-4">Click a bar to open that month&apos;s dashboard.</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartMonths} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={56}
              tickFormatter={(v: number) => formatCurrency(v)}
            />
            <Tooltip
              formatter={(value) => formatCurrency(Number(value))}
              contentStyle={{ fontSize: 13, borderRadius: 8, borderColor: '#e2e8f0' }}
            />
            <ReferenceLine
              y={data.avgMonthlySpend}
              stroke="#6366f1"
              strokeDasharray="4 4"
              label={{ value: 'Avg', position: 'insideTopLeft', fontSize: 11, fill: '#6366f1' }}
            />
            <Bar
              dataKey="spent"
              radius={[4, 4, 4, 4]}
              fill="#6366f1"
              cursor="pointer"
              onClick={(entry) => {
                const m = entry?.payload as (typeof chartMonths)[number] | undefined
                if (m) goToMonth(m.month, m.year)
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
