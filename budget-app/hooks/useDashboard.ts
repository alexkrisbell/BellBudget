'use client'

import { useQuery } from '@tanstack/react-query'
import type { DashboardData } from '@/types'

interface DashboardParams {
  month: number
  year: number
}

async function fetchDashboard(params: DashboardParams): Promise<DashboardData> {
  const res = await fetch(`/api/dashboard?month=${params.month}&year=${params.year}`)
  if (!res.ok) throw new Error('Failed to fetch dashboard')
  return res.json()
}

export function useDashboard(params: DashboardParams, initialData?: DashboardData) {
  return useQuery({
    queryKey: ['dashboard', params],
    queryFn: () => fetchDashboard(params),
    initialData,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })
}
