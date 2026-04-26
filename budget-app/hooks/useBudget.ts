'use client'

import { useQuery } from '@tanstack/react-query'

interface BudgetParams {
  month: number
  year: number
}

async function fetchBudget(params: BudgetParams) {
  const res = await fetch(`/api/budget?month=${params.month}&year=${params.year}`)
  if (!res.ok) throw new Error('Failed to fetch budget')
  return res.json()
}

export function useBudget(params: BudgetParams) {
  return useQuery({
    queryKey: ['budget', params],
    queryFn: () => fetchBudget(params),
    staleTime: 30 * 1000,
  })
}
