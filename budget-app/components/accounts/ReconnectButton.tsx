'use client'

import { useState, useCallback, useEffect } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import type { PlaidLinkOnSuccess } from 'react-plaid-link'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

interface Props {
  itemId: string
  onSuccess?: () => void
}

export function ReconnectButton({ itemId, onSuccess }: Props) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSuccess = useCallback<PlaidLinkOnSuccess>(
    async () => {
      setLoading(true)
      setError(null)
      try {
        // After re-auth, trigger a sync to resume normal flow
        const res = await fetch('/api/plaid/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_id: itemId }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error ?? 'Reconnected but sync failed.')
        }
        onSuccess?.()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Reconnect failed.')
      } finally {
        setLoading(false)
        setLinkToken(null)
      }
    },
    [itemId, onSuccess]
  )

  const { open, ready } = usePlaidLink({
    token: linkToken ?? '',
    onSuccess: handleSuccess,
    onExit: () => {
      setLinkToken(null)
      setLoading(false)
    },
  })

  useEffect(() => {
    if (linkToken && ready) open()
  }, [linkToken, ready, open])

  const handleClick = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/plaid/create-link-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to start reconnection.')
      setLinkToken(data.link_token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setLoading(false)
    }
  }, [itemId])

  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={loading}
        className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Reconnecting…' : 'Reconnect'}
      </Button>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  )
}
