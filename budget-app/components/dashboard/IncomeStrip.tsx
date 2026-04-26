import { cn } from '@/lib/utils'

interface Props {
  expected: number | null
  actual: number
}

export function IncomeStrip({ expected, actual }: Props) {
  const diff = expected !== null ? actual - expected : null

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Income</p>
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
    </div>
  )
}
