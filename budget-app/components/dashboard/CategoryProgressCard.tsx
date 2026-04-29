import { cn } from '@/lib/utils'
import type { CategoryActual } from '@/types'

interface Props {
  category: CategoryActual
}

export function CategoryProgressCard({ category }: Props) {
  const { name, icon, planned, actual, pct } = category

  const barColor = pct > 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-400' : 'bg-green-500'
  const badgeClass =
    pct > 100
      ? 'bg-red-100 text-red-700'
      : pct >= 80
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-green-100 text-green-700'

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 space-y-2.5 hover:border-indigo-200 hover:shadow-sm transition-all">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl leading-none shrink-0">{icon}</span>
          <span className="text-sm font-medium text-slate-700 truncate">{name}</span>
        </div>
        <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded-full shrink-0', badgeClass)}>
          {pct}%
        </span>
      </div>

      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full', barColor)}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400">
        {actual <= 0 ? (
          <span className="text-green-600 font-medium">+${Math.abs(actual).toLocaleString()} net credit</span>
        ) : (
          <span>${actual.toLocaleString()} spent</span>
        )}
        <span>${planned.toLocaleString()} planned</span>
      </div>
    </div>
  )
}
