'use client'

import { useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
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

  const [selectedCategory, setSelectedCategory] = useState(
    searchParams.get('category') ?? 'all'
  )
  const [selectedAccount, setSelectedAccount] = useState('all')

  const params = useMemo(
    () => ({
      month: currentMonth,
      year: currentYear,
      categoryId: selectedCategory !== 'all' ? selectedCategory : undefined,
      accountId: selectedAccount !== 'all' ? selectedAccount : undefined,
    }),
    [currentMonth, currentYear, selectedCategory, selectedAccount]
  )

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error } =
    useTransactions(params)

  const transactions = useMemo(
    () => data?.pages.flatMap((p) => p.transactions) ?? [],
    [data]
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
    },
    [queryClient, params]
  )

  const expenseCategories = useMemo(
    () => categories.filter((c) => !c.is_income),
    [categories]
  )

  return (
    <div className="space-y-4">
      <FilterBar
        categories={expenseCategories}
        accounts={accounts}
        selectedCategory={selectedCategory}
        selectedAccount={selectedAccount}
        onCategoryChange={setSelectedCategory}
        onAccountChange={setSelectedAccount}
      />

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
    </div>
  )
}
