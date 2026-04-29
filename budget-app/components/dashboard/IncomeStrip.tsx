import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { IncomeSource } from '@/types'

interface Props {
  expected: number | null
  actual: number
  sources: IncomeSource[]
}

export function IncomeStrip({ expected, actual, sources }: Props) {
  const diff = expected !== null ? actual - expected : null

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
      {/* Totals row — clickable to view all income transactions */}
      <Link
        href="/transactions?income=true"
        className="block hover:bg-slate-50 -m-1 p-1 rounded-lg transition-colors group"
      >
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 group-hover:text-slate-600">Income</p>
        <div className="flex flex-wrap items-center gap-8">
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Received</p>
            <p className="text-xl font-semibold text-slate-800">${actual.toLocaleString()}</p>
          </div>
          {expected !== null && (
            <>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Expected</p>
                <p className="text-xl font-semibold text-slate-800">${expected.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Difference</p>
                <p
                  className={cn(
                    'text-xl font-semibold',
                    diff! >= 0 ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {diff! >= 0 ? '+' : '-'}${Math.abs(diff!).toLocaleString()}
                </p>
              </div>
            </>
          )}
        </div>
      </Link>

      {/* Per-source breakdown */}
      {sources.length > 0 && (
        <div className="border-t border-slate-100 pt-3 space-y-1">
          {sources.map((src) => (
            <Link
              key={src.id}
              href={src.id !== '__none__' ? `/transactions?category=${src.id}` : '/transactions'}
              className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-50 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">{src.icon}</span>
                <span className="text-sm text-slate-600 group-hover:text-slate-800">{src.name}</span>
              </div>
              <span className="text-sm font-semibold text-green-600">
                +${src.amount.toLocaleString()}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
