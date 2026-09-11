'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts'
import { cn, formatCurrency } from '@/lib/utils'
import { useStats } from '@/hooks/useStats'
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

  const months = parseInt(searchParams.get('months') ?? String(initialMonths), 10)
  const { data } = useStats(
    { months },
    months === initialMonths ? initialData : undefined
  )

  function setMonths(m: number) {
    router.replace(`${pathname}?months=${m}`)
  }

  if (!data) {
    return null
  }

  const currentMonth = data.months.at(-1)
  const chartMonths = data.months.map((m) => ({
    ...m,
    savedLabel: formatCurrency(m.saved),
    ratePct: m.rate !== null ? Math.round(m.rate * 1000) / 10 : null,
  }))

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
        <p className="text-sm font-medium text-slate-600 mb-4">Saved per month</p>
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
            <Bar dataKey="saved" radius={[4, 4, 4, 4]}>
              {chartMonths.map((m) => (
                <Cell key={`${m.year}-${m.month}`} fill={m.saved >= 0 ? '#22c55e' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-slate-100 bg-white p-5">
        <p className="text-sm font-medium text-slate-600 mb-4">Savings rate</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartMonths} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#f1f5f9" />
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
              width={44}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              formatter={(value) => (value === null || value === undefined ? '—' : `${value}%`)}
              contentStyle={{ fontSize: 13, borderRadius: 8, borderColor: '#e2e8f0' }}
            />
            <ReferenceLine y={0} stroke="#cbd5e1" />
            <Line
              type="monotone"
              dataKey="ratePct"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ r: 3, fill: '#6366f1' }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
