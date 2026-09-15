'use client'

import { useQuery } from '@tanstack/react-query'
import type { NetWorthData } from '@/lib/netWorth/compute'

interface NetWorthParams {
  months: number
}

async function fetchNetWorth(params: NetWorthParams): Promise<NetWorthData> {
  const res = await fetch(`/api/net-worth?months=${params.months}`)
  if (!res.ok) throw new Error('Failed to fetch net worth')
  return res.json()
}

export function useNetWorth(params: NetWorthParams, initialData?: NetWorthData) {
  return useQuery({
    queryKey: ['net-worth', params],
    queryFn: () => fetchNetWorth(params),
    initialData,
    staleTime: 5 * 60 * 1000,
  })
}
