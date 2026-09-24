'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts'
import { cn, formatCurrency, formatShortDate } from '@/lib/utils'
import type { NetWorthData } from '@/lib/netWorth/compute'

interface Props {
  netWorth: NetWorthData
}

export function NetWorthCard({ netWorth }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (netWorth.current === null) return null

  const points = netWorth.points.map((p) => ({ ...p, label: formatShortDate(p.date) }))

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between p-5 text-left"
      >
        <div>
          <p className="text-sm font-medium text-slate-600 mb-0.5">Net Worth</p>
          <p className="text-2xl font-semibold text-slate-800">{formatCurrency(netWorth.current)}</p>
          {netWorth.changeAmount !== null && (
            <p className={cn('text-xs mt-0.5', netWorth.changeAmount >= 0 ? 'text-green-600' : 'text-red-600')}>
              {netWorth.changeAmount >= 0 ? '+' : ''}
              {formatCurrency(netWorth.changeAmount)}
            </p>
          )}
        </div>
        <ChevronDown className={cn('h-5 w-5 text-slate-400 transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="px-5 pb-5">
          {points.length >= 2 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={points} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
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
                  width={64}
                  tickFormatter={(v: number) => formatCurrency(v)}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  contentStyle={{ fontSize: 13, borderRadius: 8, borderColor: '#e2e8f0' }}
                />
                <Line type="monotone" dataKey="netWorth" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400 py-6 text-center">
              History builds up day by day — check back soon.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
