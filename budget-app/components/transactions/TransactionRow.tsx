'use client'

import { useState } from 'react'
import { EyeOff } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { CategoryPicker } from './CategoryPicker'
import type { Category, Transaction } from '@/types'

interface Props {
  transaction: Transaction
  categories: Category[]
  onCategoryUpdate: (txId: string, categoryId: string) => void
  onExclude?: (txId: string) => void
}

export function TransactionRow({ transaction, categories, onCategoryUpdate, onExclude }: Props) {
  const [excluding, setExcluding] = useState(false)
  const isIncome = transaction.is_income
  const displayName = transaction.merchant_name ?? transaction.description

  async function handleExclude() {
    setExcluding(true)
    try {
      await fetch(`/api/transactions/${transaction.id}/exclude`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excluded: true }),
      })
      onExclude?.(transaction.id)
    } finally {
      setExcluding(false)
    }
  }

  return (
    <div className="flex items-center gap-3 py-3 group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{displayName}</p>
        <div className="flex items-center gap-2 mt-1">
          <CategoryPicker
            transactionId={transaction.id}
            currentCategory={transaction.category ?? null}
            categories={categories}
            onUpdate={onCategoryUpdate}
          />
          {transaction.account && (
            <span className="text-xs text-slate-400">{transaction.account.name}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          <p className={`text-sm font-semibold ${isIncome ? 'text-green-600' : 'text-slate-800'}`}>
            {isIncome ? '+' : '–'}{formatCurrency(Math.abs(transaction.amount))}
          </p>
          {transaction.pending && (
            <p className="text-xs text-slate-400 mt-0.5">Pending</p>
          )}
        </div>
        <button
          onClick={handleExclude}
          disabled={excluding}
          title="Exclude from budget"
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 disabled:opacity-40"
        >
          <EyeOff className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
