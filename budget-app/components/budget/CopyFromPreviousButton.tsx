'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface Props {
  month: number
  year: number
}

export function CopyFromPreviousButton({ month, year }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year

  async function handleCopy() {
    setLoading(true)
    setError(null)

    try {
      const checkRes = await fetch(`/api/budget?month=${prevMonth}&year=${prevYear}`)
      if (!checkRes.ok) throw new Error('Could not check previous month.')

      const { budget: prevBudget } = await checkRes.json()
      if (!prevBudget) {
        throw new Error(`No budget found for ${MONTH_NAMES[prevMonth - 1]} ${prevYear}.`)
      }

      const res = await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year, copy_from: prevBudget.id }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to copy budget.')
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to copy.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant="outline" size="sm" onClick={handleCopy} disabled={loading}>
        <Copy className="size-3.5" />
        {loading ? 'Copying…' : `Copy from ${MONTH_NAMES[prevMonth - 1]}`}
      </Button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
