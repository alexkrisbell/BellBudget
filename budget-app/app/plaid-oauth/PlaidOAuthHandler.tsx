'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePlaidLink } from 'react-plaid-link'
import type { PlaidLinkOnSuccess } from 'react-plaid-link'

export function PlaidOAuthHandler() {
  const router = useRouter()
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [receivedRedirectUri, setReceivedRedirectUri] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('plaid_link_token')
    if (!stored) {
      setError('Session expired. Please try connecting your account again.')
      return
    }
    setLinkToken(stored)
    setReceivedRedirectUri(window.location.href)
  }, [])

  const handleSuccess: PlaidLinkOnSuccess = async (public_token, metadata) => {
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
      sessionStorage.removeItem('plaid_link_token')
      router.push('/accounts')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete connection.')
    }
  }

  const { open, ready } = usePlaidLink({
    token: linkToken ?? '',
    receivedRedirectUri,
    onSuccess: handleSuccess,
    onExit: () => {
      sessionStorage.removeItem('plaid_link_token')
      router.push('/accounts')
    },
  })

  useEffect(() => {
    if (ready && linkToken) open()
  }, [ready, linkToken, open])

  if (error) {
    return (
      <div className="text-center space-y-3">
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={() => router.push('/accounts')}
          className="text-sm text-indigo-600 hover:underline"
        >
          Back to accounts
        </button>
      </div>
    )
  }

  return (
    <div className="text-center space-y-2">
      <div className="h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-sm text-slate-500">Completing bank connection…</p>
    </div>
  )
}
