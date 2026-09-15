import Link from 'next/link'
import { formatCurrency, formatShortDate } from '@/lib/utils'
import type { RecurringBill } from '@/lib/recurringBills/detect'

interface Props {
  bills: RecurringBill[]
}

export function RecurringBillsCard({ bills }: Props) {
  if (bills.length === 0) return null

  const preview = bills.slice(0, 4)

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Recurring Bills
        </p>
        <Link href="/bills" className="text-xs text-indigo-600 hover:underline">
          View all
        </Link>
      </div>
      <div className="divide-y divide-slate-100">
        {preview.map((bill) => (
          <div key={bill.key} className="flex items-center justify-between px-4 py-3 gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="size-8 rounded-full flex items-center justify-center shrink-0 text-sm"
                style={{
                  backgroundColor: bill.category?.color ? `${bill.category.color}20` : '#f1f5f9',
                }}
              >
                {bill.category?.icon ?? '🔁'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{bill.label}</p>
                <p className="text-xs text-slate-400">Next ~{formatShortDate(bill.nextExpectedDate)}</p>
              </div>
            </div>
            <span className="text-sm font-semibold shrink-0 text-slate-700">
              {formatCurrency(bill.averageAmount)}/mo
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
