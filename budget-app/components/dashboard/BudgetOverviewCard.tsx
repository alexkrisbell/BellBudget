import { cn } from '@/lib/utils'

interface Props {
  totalBudgeted: number
  totalSpent: number
  totalRemaining: number
  pctUsed: number
}

export function BudgetOverviewCard({
  totalBudgeted,
  totalSpent,
  totalRemaining,
  pctUsed,
}: Props) {
  const barColor =
    pctUsed > 100 ? 'bg-red-500' : pctUsed >= 80 ? 'bg-yellow-400' : 'bg-green-500'
  const badgeClass =
    pctUsed > 100
      ? 'bg-red-100 text-red-700'
      : pctUsed >= 80
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-green-100 text-green-700'

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-slate-600">Monthly Budget</p>
        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', badgeClass)}>
          {pctUsed}%
        </span>
      </div>

      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mb-5">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${Math.min(100, pctUsed)}%` }}
        />
      </div>

      <div className="grid grid-cols-3 divide-x divide-slate-100 text-center">
        <div className="pr-4">
          <p className="text-xs text-slate-400 mb-0.5">Spent</p>
          <p className="text-xl font-semibold text-slate-800">${totalSpent.toLocaleString()}</p>
        </div>
        <div className="px-4">
          <p className="text-xs text-slate-400 mb-0.5">Remaining</p>
          <p
            className={cn(
              'text-xl font-semibold',
              totalRemaining < 0 ? 'text-red-600' : 'text-slate-800'
            )}
          >
            {totalRemaining < 0 ? '-' : ''}${Math.abs(totalRemaining).toLocaleString()}
          </p>
        </div>
        <div className="pl-4">
          <p className="text-xs text-slate-400 mb-0.5">Budgeted</p>
          <p className="text-xl font-semibold text-slate-800">${totalBudgeted.toLocaleString()}</p>
        </div>
      </div>
    </div>
  )
}
