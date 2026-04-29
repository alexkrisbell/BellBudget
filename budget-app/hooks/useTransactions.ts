'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import type { TransactionListResponse } from '@/types'

interface TransactionParams {
  month: number
  year: number
  categoryId?: string
  accountId?: string
  excluded?: boolean
  income?: boolean
}

async function fetchPage(
  params: TransactionParams,
  page: number
): Promise<TransactionListResponse> {
  const sp = new URLSearchParams({
    month: String(params.month),
    year: String(params.year),
    page: String(page),
    limit: '50',
  })
  if (params.income) sp.set('income', 'true')
  if (params.categoryId) sp.set('category_id', params.categoryId)
  if (params.accountId) sp.set('account_id', params.accountId)
  if (params.excluded) sp.set('excluded', 'true')

  const res = await fetch(`/api/transactions?${sp}`)
  if (!res.ok) throw new Error('Failed to fetch transactions')
  return res.json()
}

export function useTransactions(
  params: TransactionParams,
  options?: { enabled?: boolean }
) {
  return useInfiniteQuery({
    queryKey: ['transactions', params],
    queryFn: ({ pageParam }) => fetchPage(params, pageParam as number),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (!lastPage.has_more) return undefined
      return (lastPageParam as number) + 1
    },
    staleTime: 60 * 1000,
    enabled: options?.enabled !== false,
  })
}
