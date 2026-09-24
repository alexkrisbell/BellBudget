'use client'

import { useState } from 'react'
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
} from 'recharts'
import { cn, formatCurrency, formatShortDate } from '@/lib/utils'
import { useStats } from '@/hooks/useStats'
import { useNetWorth } from '@/hooks/useNetWorth'
import { useAppStore } from '@/store/appStore'
import type { StatsData } from '@/lib/stats/compute'
import type { NetWorthData } from '@/lib/netWorth/compute'

const WINDOW_OPTIONS = [3, 6, 12] as const
type Tab = 'netWorth' | 'saved' | 'spent' | 'rate'

interface Props {
  initialData: StatsData
  initialNetWorth: NetWorthData
  initialMonths: number
}

export function StatsClient({ initialData, initialNetWorth, initialMonths }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const setCurrentMonth = useAppStore((s) => s.setCurrentMonth)
  const [activeTab, setActiveTab] = useState<Tab>('netWorth')

  const months = parseInt(searchParams.get('months') ?? String(initialMonths), 10)
  const { data } = useStats(
    { months },
    months === initialMonths ? initialData : undefined
  )
  const { data: netWorth } = useNetWorth(
    { months },
    months === initialMonths ? initialNetWorth : undefined
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
  const chartMonths = data.months.map((m) => ({
    ...m,
    ratePct: m.rate !== null ? Math.round(m.rate * 1000) / 10 : null,
  }))
  const netWorthPoints = (netWorth?.points ?? []).map((p) => ({ ...p, label: formatShortDate(p.date) }))

  const tiles: Array<{ id: Tab; label: string; value: string; sub?: { text: string; positive: boolean } }> = [
    {
      id: 'netWorth',
      label: 'Net worth',
      value: netWorth?.current != null ? formatCurrency(netWorth.current) : '—',
      sub: netWorth?.changeAmount != null
        ? { text: `${netWorth.changeAmount >= 0 ? '+' : ''}${formatCurrency(netWorth.changeAmount)}`, positive: netWorth.changeAmount >= 0 }
        : undefined,
    },
    {
      id: 'saved',
      label: 'This month saved',
      value: formatCurrency(currentMonth?.saved ?? 0),
      sub: undefined,
    },
    {
      id: 'spent',
      label: 'Avg monthly spend',
      value: formatCurrency(data.avgMonthlySpend),
    },
    {
      id: 'rate',
      label: 'Avg savings rate',
      value: data.avgSavingsRate !== null ? `${Math.round(data.avgSavingsRate * 100)}%` : '—',
    },
  ]

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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tiles.map((tile) => (
          <button
            key={tile.id}
            onClick={() => setActiveTab(tile.id)}
            className={cn(
              'rounded-xl border p-4 text-left transition-colors',
              activeTab === tile.id
                ? 'border-indigo-300 bg-indigo-50/60 ring-1 ring-indigo-200'
                : 'border-slate-100 bg-white hover:border-slate-200'
            )}
          >
            <p className="text-xs text-slate-400 mb-0.5">{tile.label}</p>
            <p
              className={cn(
                'text-xl font-semibold',
                tile.id === 'saved' && (currentMonth?.saved ?? 0) < 0 ? 'text-red-600' : 'text-slate-800'
              )}
            >
              {tile.value}
            </p>
            {tile.sub && (
              <p className={cn('text-xs mt-0.5', tile.sub.positive ? 'text-green-600' : 'text-red-600')}>
                {tile.sub.text}
              </p>
            )}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-100 bg-white p-5">
        {activeTab === 'netWorth' && (
          <>
            <p className="text-sm font-medium text-slate-600 mb-1">Net worth over time</p>
            {netWorthPoints.length >= 2 ? (
              <>
                <p className="text-xs text-slate-400 mb-4">Assets (including investments) minus credit card and loan balances.</p>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={netWorthPoints} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={64} tickFormatter={(v: number) => formatCurrency(v)} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ fontSize: 13, borderRadius: 8, borderColor: '#e2e8f0' }} />
                    <Line type="monotone" dataKey="netWorth" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} />
                  </LineChart>
                </ResponsiveContainer>
              </>
            ) : (
              <p className="text-sm text-slate-400 py-10 text-center">
                Net worth history builds up day by day from when tracking started — check back soon.
              </p>
            )}
          </>
        )}

        {activeTab === 'saved' && (
          <>
            <p className="text-sm font-medium text-slate-600 mb-1">Saved per month</p>
            <p className="text-xs text-slate-400 mb-4">Click a bar to open that month&apos;s dashboard.</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartMonths} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={56} tickFormatter={(v: number) => formatCurrency(v)} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ fontSize: 13, borderRadius: 8, borderColor: '#e2e8f0' }} />
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
          </>
        )}

        {activeTab === 'spent' && (
          <>
            <p className="text-sm font-medium text-slate-600 mb-1">Spent per month</p>
            <p className="text-xs text-slate-400 mb-4">Click a bar to open that month&apos;s dashboard.</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartMonths} margin={{ top: 4, right: 32, left: 8, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={56} tickFormatter={(v: number) => formatCurrency(v)} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ fontSize: 13, borderRadius: 8, borderColor: '#e2e8f0' }} />
                <ReferenceLine
                  y={data.avgMonthlySpend}
                  stroke="#6366f1"
                  strokeDasharray="4 4"
                  label={{ value: 'Avg', position: 'right', fontSize: 11, fill: '#6366f1' }}
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
          </>
        )}

        {activeTab === 'rate' && (
          <>
            <p className="text-sm font-medium text-slate-600 mb-1">Savings rate per month</p>
            <p className="text-xs text-slate-400 mb-4">Percent of income saved. Months with no income show as a gap.</p>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartMonths} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={48} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip formatter={(value) => (value == null ? '—' : `${value}%`)} contentStyle={{ fontSize: 13, borderRadius: 8, borderColor: '#e2e8f0' }} />
                <ReferenceLine y={0} stroke="#cbd5e1" />
                <Line type="monotone" dataKey="ratePct" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </div>
    </div>
  )
}
