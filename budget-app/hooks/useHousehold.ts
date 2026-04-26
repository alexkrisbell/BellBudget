'use client'

import { useQuery } from '@tanstack/react-query'
import { useAppStore } from '@/store/appStore'

interface HouseholdData {
  household: { id: string; name: string; created_by: string; created_at: string } | null
  role: 'owner' | 'member' | null
}

async function fetchHousehold(): Promise<HouseholdData> {
  const res = await fetch('/api/household')
  if (!res.ok) throw new Error('Failed to fetch household')
  return res.json()
}

export function useHousehold() {
  const householdId = useAppStore((s) => s.householdId)
  const setHouseholdId = useAppStore((s) => s.setHouseholdId)

  const query = useQuery({
    queryKey: ['household'],
    queryFn: async () => {
      const data = await fetchHousehold()
      if (data.household?.id && data.household.id !== householdId) {
        setHouseholdId(data.household.id)
      }
      return data
    },
    staleTime: 5 * 60 * 1000,
  })

  return {
    household: query.data?.household ?? null,
    role: query.data?.role ?? null,
    isLoading: query.isLoading,
    error: query.error,
  }
}
