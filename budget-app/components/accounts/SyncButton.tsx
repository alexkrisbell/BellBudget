'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SyncButton() {
  const [state, setState] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle')
  const [summary, setSummary] = useState<string | null>(null)
  const [transactionsDebug, setTransactionsDebug] = useState<string[] | null>(null)
  const router = useRouter()

  async function handleSync() {
    setState('syncing')
    setSummary(null)
    setTransactionsDebug(null)
    try {
      // Register webhooks on all existing items (idempotent, ensures live updates)
      await fetch('/api/plaid/register-webhooks', { method: 'POST' })

      // Trigger a full sync from the beginning (force resets the cursor)
      const res = await fetch('/api/plaid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      })
      const data = await res.json()

      if (!res.ok) {
        setSummary(data.error ?? 'Sync failed.')
        setState('error')
        return
      }

      const { added, modified, removed, investmentsSynced, investmentsError, transactionsDebug: txDebug } = data as {
        added: number
        modified: number
        removed: number
        investmentsSynced: boolean
        investmentsError?: string
        transactionsDebug?: string[]
      }
      const parts: string[] = []
      if (added > 0) parts.push(`${added} new`)
      if (modified > 0) parts.push(`${modified} updated`)
      if (removed > 0) parts.push(`${removed} removed`)
      if (investmentsSynced) parts.push('investments updated')
      if (investmentsError) parts.push(`investments failed: ${investmentsError}`)
      setSummary(parts.length > 0 ? parts.join(', ') : 'Already up to date')
      setTransactionsDebug(txDebug && txDebug.length > 0 ? txDebug : null)
      setState(investmentsError ? 'error' : 'done')
      router.refresh()
    } catch {
      setSummary('Network error. Try again.')
      setState('error')
    }
  }

  const spinning = state === 'syncing'

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        {summary && (
          <p className={`text-xs ${state === 'error' ? 'text-red-500' : 'text-slate-500'}`}>
            {summary}
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={spinning}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${spinning ? 'animate-spin' : ''}`} />
          {spinning ? 'Syncing…' : 'Sync Now'}
        </Button>
      </div>
      {transactionsDebug && (
        <ul className="text-[11px] text-slate-400 font-mono text-right max-w-md space-y-0.5">
          {transactionsDebug.map((line, i) => (
            <li key={i} className="break-words">{line}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
