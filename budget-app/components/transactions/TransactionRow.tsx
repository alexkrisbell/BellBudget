'use client'

import { useState } from 'react'
import { EyeOff, Eye } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { CategoryPicker } from './CategoryPicker'
import type { Category, Transaction } from '@/types'

interface Props {
  transaction: Transaction
  categories: Category[]
  onCategoryUpdate: (txId: string, categoryId: string) => void
  onExclude?: (txId: string) => void
  onInclude?: (txId: string) => void
}

export function TransactionRow({ transaction, categories, onCategoryUpdate, onExclude, onInclude }: Props) {
  const [loading, setLoading] = useState(false)
  const isIncome = transaction.is_income
  const displayName = transaction.merchant_name ?? transaction.description
  const isExcludedRow = !!onInclude

  async function handleExclude() {
    setLoading(true)
    try {
      await fetch(`/api/transactions/${transaction.id}/exclude`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excluded: true }),
      })
      onExclude?.(transaction.id)
    } finally {
      setLoading(false)
    }
  }

  async function handleInclude() {
    setLoading(true)
    try {
      await fetch(`/api/transactions/${transaction.id}/exclude`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excluded: false }),
      })
      onInclude?.(transaction.id)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`flex items-center gap-3 py-3 group ${isExcludedRow ? 'opacity-50' : ''}`}>
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
        {isExcludedRow ? (
          <button
            onClick={handleInclude}
            disabled={loading}
            title="Re-include in budget"
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-green-50 text-slate-400 hover:text-green-600 disabled:opacity-40"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={handleExclude}
            disabled={loading}
            title="Exclude from budget"
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 disabled:opacity-40"
          >
            <EyeOff className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
