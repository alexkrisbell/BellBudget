'use client'

import { useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { EyeOff, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'
import { useAppStore } from '@/store/appStore'
import { useTransactions } from '@/hooks/useTransactions'
import { FilterBar } from './FilterBar'
import { TransactionList } from './TransactionList'
import type { Account, Category, Transaction } from '@/types'

interface Props {
  categories: Category[]
  accounts: Account[]
}

export function TransactionsClient({ categories, accounts }: Props) {
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const currentMonth = useAppStore((s) => s.currentMonth)
  const currentYear = useAppStore((s) => s.currentYear)

  const incomeOnly = searchParams.get('income') === 'true'

  const [selectedCategory, setSelectedCategory] = useState(
    searchParams.get('category') ?? 'all'
  )
  const [selectedAccount, setSelectedAccount] = useState('all')
  const [showHidden, setShowHidden] = useState(false)

  const params = useMemo(
    () => ({
      month: currentMonth,
      year: currentYear,
      income: incomeOnly || undefined,
      categoryId: !incomeOnly && selectedCategory !== 'all' ? selectedCategory : undefined,
      accountId: selectedAccount !== 'all' ? selectedAccount : undefined,
    }),
    [currentMonth, currentYear, selectedCategory, selectedAccount, incomeOnly]
  )

  const excludedParams = useMemo(
    () => ({ ...params, excluded: true }),
    [params]
  )

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error } =
    useTransactions(params)

  const {
    data: hiddenData,
    isLoading: hiddenLoading,
  } = useTransactions(excludedParams, { enabled: showHidden })

  const transactions = useMemo(
    () => data?.pages.flatMap((p) => p.transactions) ?? [],
    [data]
  )

  const hiddenTransactions = useMemo(
    () => hiddenData?.pages.flatMap((p) => p.transactions) ?? [],
    [hiddenData]
  )

  const handleExclude = useCallback(
    (txId: string) => {
      queryClient.setQueriesData(
        { queryKey: ['transactions', params] },
        (old: unknown) => {
          const data = old as { pages?: { transactions: Transaction[] }[] } | undefined
          if (!data?.pages) return old
          return {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              transactions: page.transactions.filter((tx) => tx.id !== txId),
            })),
          }
        }
      )
      // Invalidate hidden list so the newly excluded transaction appears there
      queryClient.invalidateQueries({ queryKey: ['transactions', excludedParams] })
    },
    [queryClient, params, excludedParams]
  )

  const handleInclude = useCallback(
    (txId: string) => {
      queryClient.setQueriesData(
        { queryKey: ['transactions', excludedParams] },
        (old: unknown) => {
          const data = old as { pages?: { transactions: Transaction[] }[] } | undefined
          if (!data?.pages) return old
          return {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              transactions: page.transactions.filter((tx) => tx.id !== txId),
            })),
          }
        }
      )
      // Invalidate main list so the re-included transaction appears there
      queryClient.invalidateQueries({ queryKey: ['transactions', params] })
    },
    [queryClient, excludedParams, params]
  )

  const expenseCategories = useMemo(
    () => categories.filter((c) => !c.is_income),
    [categories]
  )

  return (
    <div className="space-y-4">
      {incomeOnly ? (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
            💵 Income transactions
          </span>
          <Link href="/transactions" className="text-xs text-slate-400 hover:text-slate-600">
            ← All transactions
          </Link>
        </div>
      ) : (
        <FilterBar
          categories={expenseCategories}
          accounts={accounts}
          selectedCategory={selectedCategory}
          selectedAccount={selectedAccount}
          onCategoryChange={setSelectedCategory}
          onAccountChange={setSelectedAccount}
        />
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Failed to load transactions. Please try again.
        </div>
      )}

      <TransactionList
        transactions={transactions}
        categories={expenseCategories}
        queryKey={['transactions', params]}
        onLoadMore={fetchNextPage}
        hasMore={hasNextPage}
        isLoading={isLoading || isFetchingNextPage}
        onExclude={handleExclude}
      />

      {/* Hidden transactions section */}
      <div className="pt-1">
        <button
          onClick={() => setShowHidden((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors py-1"
        >
          <EyeOff className="h-3.5 w-3.5" />
          {showHidden ? 'Hide excluded transactions' : 'Show excluded transactions'}
          {showHidden ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>

        {showHidden && (
          <div className="mt-2">
            {hiddenLoading && hiddenTransactions.length === 0 ? (
              <p className="text-xs text-slate-400 px-1 py-2">Loading…</p>
            ) : hiddenTransactions.length === 0 ? (
              <p className="text-xs text-slate-400 px-1 py-2">No hidden transactions this month.</p>
            ) : (
              <TransactionList
                transactions={hiddenTransactions}
                categories={expenseCategories}
                queryKey={['transactions', excludedParams]}
                isLoading={hiddenLoading}
                onInclude={handleInclude}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
