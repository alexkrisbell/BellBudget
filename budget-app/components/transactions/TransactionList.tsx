'use client'

import { useMemo, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { TransactionRow } from './TransactionRow'
import { formatDate } from '@/lib/utils'
import type { Category, Transaction } from '@/types'

interface Props {
  transactions: Transaction[]
  categories: Category[]
  queryKey: unknown[]
  onLoadMore?: () => void
  hasMore?: boolean
  isLoading?: boolean
  onExclude?: (txId: string) => void
  onInclude?: (txId: string) => void
}

export function TransactionList({
  transactions,
  categories,
  queryKey,
  onLoadMore,
  hasMore,
  isLoading,
  onExclude,
  onInclude,
}: Props) {
  const queryClient = useQueryClient()

  const handleCategoryUpdate = useCallback(
    (txId: string, categoryId: string) => {
      const category = categories.find((c) => c.id === categoryId)
      queryClient.setQueriesData(
        { queryKey },
        (old: unknown) => {
          const data = old as { pages?: { transactions: Transaction[] }[] } | undefined
          if (!data?.pages) return old
          return {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              transactions: page.transactions.map((tx) =>
                tx.id === txId
                  ? { ...tx, category_id: categoryId, category, categorization_source: 'user' as const }
                  : tx
              ),
            })),
          }
        }
      )
    },
    [queryClient, queryKey, categories]
  )

  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    for (const tx of transactions) {
      if (!map.has(tx.date)) map.set(tx.date, [])
      map.get(tx.date)!.push(tx)
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a))
  }, [transactions])

  if (isLoading && grouped.length === 0) {
    return (
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white border border-slate-100 overflow-hidden">
            <div className="h-8 bg-slate-50 border-b border-slate-100" />
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex items-center gap-3 px-4 py-3 border-b border-slate-50">
                <div className="h-8 w-8 rounded-full bg-slate-100 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-slate-100 rounded-full w-32" />
                  <div className="h-3 bg-slate-100 rounded-full w-20" />
                </div>
                <div className="h-4 bg-slate-100 rounded-full w-16" />
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (grouped.length === 0 && !isLoading) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
        <p className="text-slate-500 font-medium">No transactions found.</p>
        <p className="text-sm text-slate-400 mt-1">
          Try adjusting your filters or sync your accounts.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {grouped.map(([date, txs]) => (
        <div key={date} className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {formatDate(date)}
            </p>
          </div>
          <div className="divide-y divide-slate-50">
            {txs.map((tx) => (
              <div key={tx.id} className="px-4">
                <TransactionRow
                  transaction={tx}
                  categories={categories}
                  onCategoryUpdate={handleCategoryUpdate}
                  onExclude={onExclude}
                  onInclude={onInclude}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {hasMore && (
        <button
          onClick={onLoadMore}
          disabled={isLoading}
          className="w-full py-3 text-sm font-medium text-slate-500 hover:text-slate-700 disabled:opacity-50"
        >
          {isLoading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  )
}
