import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Category } from '@/types'

interface Props {
  categoryId: string
  plannedAmount: string
  actual?: number
  pct?: number
  category?: Category
  onChange: (value: string) => void
  onRemove: () => void
  isReadOnly: boolean
}

export function BudgetItemRow({
  plannedAmount,
  actual,
  pct,
  category,
  onChange,
  onRemove,
  isReadOnly,
}: Props) {
  const planned = parseFloat(plannedAmount) || 0
  const safePct = pct ?? 0

  if (isReadOnly) {
    return (
      <div className="py-3 border-b border-slate-100 last:border-0 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">{category?.icon ?? '📦'}</span>
            <span className="text-sm text-slate-700">{category?.name ?? 'Unknown'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">${(actual ?? 0).toFixed(0)}</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-700 font-medium">${planned.toFixed(0)}</span>
            <span
              className={cn(
                'text-xs font-medium px-1.5 py-0.5 rounded-full min-w-10 text-center',
                safePct > 100
                  ? 'bg-red-100 text-red-700'
                  : safePct >= 80
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-green-100 text-green-700'
              )}
            >
              {safePct}%
            </span>
          </div>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              safePct > 100 ? 'bg-red-500' : safePct >= 80 ? 'bg-yellow-400' : 'bg-green-500'
            )}
            style={{ width: `${Math.min(100, safePct)}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-base leading-none">{category?.icon ?? '📦'}</span>
        <span className="text-sm text-slate-700 truncate">{category?.name ?? 'Unknown'}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-sm text-slate-400">$</span>
        <Input
          type="number"
          min="0"
          step="1"
          value={plannedAmount}
          onChange={(e) => onChange(e.target.value)}
          className="w-28 h-8 text-right text-sm"
          placeholder="0"
        />
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onRemove}
          className="text-slate-300 hover:text-red-500"
          aria-label="Remove category"
        >
          <X />
        </Button>
      </div>
    </div>
  )
}
