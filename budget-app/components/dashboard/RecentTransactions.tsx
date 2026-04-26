import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { RecentTransaction } from '@/types'

interface Props {
  transactions: RecentTransaction[]
}

export function RecentTransactions({ transactions }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-xl border border-slate-100 bg-white px-4 py-10 text-center">
        <p className="text-sm text-slate-400">No transactions this month yet.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Recent Transactions
        </p>
        <Link href="/transactions" className="text-xs text-indigo-600 hover:underline">
          View all
        </Link>
      </div>
      <div className="divide-y divide-slate-100">
        {transactions.map((tx) => (
          <div key={tx.id} className="flex items-center justify-between px-4 py-3 gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="size-8 rounded-full flex items-center justify-center shrink-0 text-sm"
                style={{
                  backgroundColor: tx.category?.color ? `${tx.category.color}20` : '#f1f5f9',
                }}
              >
                {tx.category?.icon ?? '💳'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">
                  {tx.merchant_name ?? tx.description}
                </p>
                <p className="text-xs text-slate-400">{tx.date}</p>
              </div>
            </div>
            <span
              className={cn(
                'text-sm font-semibold shrink-0',
                tx.is_income ? 'text-green-600' : 'text-slate-700'
              )}
            >
              {tx.is_income ? '+' : '-'}${Math.abs(tx.amount).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
