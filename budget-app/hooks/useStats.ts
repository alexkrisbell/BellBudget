'use client'

import { useQuery } from '@tanstack/react-query'
import type { StatsData } from '@/lib/stats/compute'

interface StatsParams {
  months: number
}

async function fetchStats(params: StatsParams): Promise<StatsData> {
  const res = await fetch(`/api/stats?months=${params.months}`)
  if (!res.ok) throw new Error('Failed to fetch stats')
  return res.json()
}

export function useStats(params: StatsParams, initialData?: StatsData) {
  return useQuery({
    queryKey: ['stats', params],
    queryFn: () => fetchStats(params),
    initialData,
    staleTime: 5 * 60 * 1000,
  })
}
