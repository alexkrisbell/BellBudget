'use client'

import { useState } from 'react'
import { EyeOff, Eye, SplitSquareHorizontal, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { CategoryPicker } from './CategoryPicker'
import { SplitDialog } from './SplitDialog'
import type { Category, Transaction } from '@/types'

interface Props {
  transaction: Transaction
  categories: Category[]
  onCategoryUpdate: (txId: string, categoryId: string) => void
  onSplitUpdate?: (txId: string, updated: Transaction) => void
  onExclude?: (txId: string) => void
  onInclude?: (txId: string) => void
}

export function TransactionRow({
  transaction,
  categories,
  onCategoryUpdate,
  onSplitUpdate,
  onExclude,
  onInclude,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [splitOpen, setSplitOpen] = useState(false)
  const isIncome = transaction.is_income
  const displayName = transaction.merchant_name ?? transaction.description
  const isExcludedRow = !!onInclude
  const canSplit = !isIncome

  const splits = transaction.splits
  const hasSplits = !!splits && splits.length > 0
  const splitCentsSum = hasSplits
    ? splits!.reduce((sum, s) => sum + Math.round(s.amount * 100), 0)
    : 0
  const splitIsStale = hasSplits && splitCentsSum !== Math.round(transaction.amount * 100)

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
    <>
    <div
      onClick={canSplit ? () => setSplitOpen(true) : undefined}
      className={`flex items-center gap-3 py-3 px-2 -mx-2 rounded-lg group transition-colors ${
        isExcludedRow ? 'opacity-50' : ''
      } ${canSplit ? 'cursor-pointer hover:bg-slate-50' : ''}`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{displayName}</p>
        <div className="flex items-center gap-2 mt-1">
          {hasSplits ? (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-indigo-50 text-indigo-700">
              <SplitSquareHorizontal className="h-3 w-3" />
              Split ({splits!.length})
              {splitIsStale && <AlertTriangle className="h-3 w-3 text-amber-600" />}
            </span>
          ) : (
            <div onClick={(e) => e.stopPropagation()}>
              <CategoryPicker
                transactionId={transaction.id}
                currentCategory={transaction.category ?? null}
                categories={categories}
                onUpdate={onCategoryUpdate}
              />
            </div>
          )}
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
            onClick={(e) => { e.stopPropagation(); handleInclude() }}
            disabled={loading}
            title="Re-include in budget"
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-green-50 text-slate-400 hover:text-green-600 disabled:opacity-40"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); handleExclude() }}
            disabled={loading}
            title="Exclude from budget"
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 disabled:opacity-40"
          >
            <EyeOff className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
    {canSplit && (
      <SplitDialog
        open={splitOpen}
        onOpenChange={setSplitOpen}
        transaction={transaction}
        categories={categories}
        onSaved={(updated) => onSplitUpdate?.(transaction.id, updated)}
      />
    )}
    </>
  )
}
