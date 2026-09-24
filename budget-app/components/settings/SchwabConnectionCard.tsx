'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Landmark, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { BrokerageConnection, InvestmentAccount } from '@/types'

interface Props {
  initialConnection: BrokerageConnection | null
  initialAccounts: InvestmentAccount[]
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: 'That connection attempt expired or was tampered with — try again.',
  storage_failed: 'Failed to securely store your Schwab tokens — try again.',
  connect_failed: 'Failed to connect to Schwab — try again.',
}

export function SchwabConnectionCard({ initialConnection, initialAccounts }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [connection] = useState(initialConnection)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState<string | null>(
    () => {
      const code = searchParams.get('schwab_error')
      return code ? (ERROR_MESSAGES[code] ?? 'Something went wrong connecting to Schwab.') : null
    }
  )

  const totalValue = initialAccounts.reduce(
    (sum, acc) => sum + (acc.market_value ?? 0) + (acc.cash_balance ?? 0),
    0
  )

  async function handleDisconnect() {
    if (!confirm('Disconnect Schwab? Bell Bucks will stop syncing your investment balances.')) return
    setDisconnecting(true)
    setError(null)
    const res = await fetch('/api/schwab/connection', { method: 'DELETE' })
    setDisconnecting(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to disconnect.')
      return
    }
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
        Investments
      </p>

      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

      {!connection ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm text-slate-600">
            <Landmark className="h-4 w-4 text-slate-400" />
            Connect your Schwab brokerage account to track investments alongside your budget.
          </div>
          <a href="/api/schwab/authorize">
            <Button size="sm">Connect Schwab</Button>
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Landmark className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-700">Schwab</p>
                <p className="text-xs text-slate-400">
                  {connection.status === 'requires_reauth'
                    ? 'Needs to be reconnected'
                    : initialAccounts.length > 0
                      ? `${initialAccounts.length} account${initialAccounts.length === 1 ? '' : 's'} · $${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                      : 'Connected'}
                </p>
              </div>
            </div>
            {connection.status === 'requires_reauth' ? (
              <a href="/api/schwab/authorize">
                <Button size="sm" variant="outline">
                  <RefreshCcw className="size-3.5" />
                  Reconnect
                </Button>
              </a>
            ) : (
              <Button size="sm" variant="outline" onClick={handleDisconnect} disabled={disconnecting}>
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
