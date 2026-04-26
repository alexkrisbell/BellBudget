'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/store/appStore'

export function HouseholdInitializer({ householdId }: { householdId: string }) {
  const setHouseholdId = useAppStore((s) => s.setHouseholdId)

  useEffect(() => {
    setHouseholdId(householdId)
  }, [householdId, setHouseholdId])

  return null
}
