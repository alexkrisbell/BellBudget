'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export function InviteCard() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleInvite() {
    const trimmed = email.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    setInviteUrl(null)
    try {
      const res = await fetch('/api/household/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create invite.')
      setInviteUrl(data.invite_url)
      setEmail('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
        Invite Partner
      </p>
      <p className="text-xs text-slate-500 mb-4">
        Send a join link to your partner. The link expires in 7 days.
      </p>

      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleInvite() }}
          placeholder="partner@email.com"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={handleInvite}
          disabled={loading || !email.trim()}
          className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 shrink-0"
        >
          {loading ? 'Sending…' : 'Generate Link'}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {inviteUrl && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
          <p className="flex-1 text-xs text-slate-600 truncate font-mono">{inviteUrl}</p>
          <button
            onClick={handleCopy}
            className="shrink-0 flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  )
}
