'use client'

import { useState, useCallback, useEffect } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import type { PlaidLinkOnSuccess } from 'react-plaid-link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

interface Props {
  onSuccess?: () => void
}

export function PlaidLinkButton({ onSuccess }: Props) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSuccess = useCallback<PlaidLinkOnSuccess>(
    async (public_token, metadata) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/plaid/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            public_token,
            institution_id: metadata.institution?.institution_id ?? '',
            institution_name: metadata.institution?.name ?? 'Unknown Bank',
            accounts: metadata.accounts.map((acc) => ({
              id: acc.id,
              name: acc.name,
              type: acc.type,
              subtype: acc.subtype,
            })),
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed to connect account.')
        onSuccess?.()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect account.')
      } finally {
        setLoading(false)
        setLinkToken(null)
      }
    },
    [onSuccess]
  )

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handleSuccess,
    onExit: () => {
      setLinkToken(null)
      setLoading(false)
    },
  })

  // Open the Plaid modal once the token is ready
  useEffect(() => {
    if (linkToken && ready) {
      open()
    }
  }, [linkToken, ready, open])

  const handleClick = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/plaid/create-link-token', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to initialize bank connection.')
      setLinkToken(data.link_token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setLoading(false)
    }
  }, [])

  return (
    <div>
      <Button onClick={handleClick} disabled={loading} className="gap-2">
        <Plus className="h-4 w-4" />
        {loading ? 'Connecting…' : 'Connect Account'}
      </Button>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
