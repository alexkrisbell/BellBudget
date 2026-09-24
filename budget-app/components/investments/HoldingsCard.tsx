'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Pencil, Check, X } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import type { AccountHoldings } from '@/lib/investments/compute'

interface Props {
  accounts: AccountHoldings[]
}

function fallbackLabel(account: AccountHoldings['account']): string {
  const type = account.account_type ?? 'Account'
  return account.last4 ? `${type} ····${account.last4}` : type
}

function AccountHeader({ account, isOpen, onToggle }: {
  account: AccountHoldings['account']
  isOpen: boolean
  onToggle: () => void
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [nickname, setNickname] = useState(account.nickname ?? fallbackLabel(account))
  const [saving, setSaving] = useState(false)

  async function save() {
    const trimmed = nickname.trim()
    if (!trimmed || trimmed === (account.nickname ?? fallbackLabel(account))) {
      setEditing(false)
      setNickname(account.nickname ?? fallbackLabel(account))
      return
    }
    setSaving(true)
    const res = await fetch(`/api/investment-accounts/${account.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: trimmed }),
    })
    setSaving(false)
    setEditing(false)
    if (res.ok) router.refresh()
    else setNickname(account.nickname ?? fallbackLabel(account))
  }

  function cancel() {
    setNickname(account.nickname ?? fallbackLabel(account))
    setEditing(false)
  }

  return (
    <div className="w-full flex items-center justify-between py-2">
      <div
        className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
        onClick={editing ? undefined : onToggle}
      >
        <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform shrink-0', isOpen && 'rotate-180')} />

        {editing ? (
          <div className="flex items-center gap-1.5 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save()
                if (e.key === 'Escape') cancel()
              }}
              className="text-sm font-medium text-slate-800 bg-white border border-indigo-300 rounded px-2 py-0.5 w-full max-w-[220px] focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
            <button onClick={save} disabled={saving} className="text-green-600 hover:text-green-700 shrink-0" aria-label="Save">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button onClick={cancel} className="text-slate-400 hover:text-slate-600 shrink-0" aria-label="Cancel">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 group min-w-0">
            <p className="text-sm font-medium text-slate-700 truncate">{account.nickname ?? fallbackLabel(account)}</p>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setEditing(true)
              }}
              className="text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              aria-label="Rename account"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
      <p className="text-sm text-slate-700 shrink-0 pl-2">{formatCurrency(account.market_value ?? 0)}</p>
    </div>
  )
}

export function HoldingsCard({ accounts }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (accounts.length === 0) return null

  const total = accounts.reduce((sum, a) => sum + (a.account.market_value ?? 0), 0)

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-5">
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-sm font-medium text-slate-600">Investments</p>
        <p className="text-sm font-semibold text-slate-800">{formatCurrency(total)}</p>
      </div>

      <div className="divide-y divide-slate-50">
        {accounts.map(({ account, holdings, asOfDate }) => {
          const isOpen = expandedId === account.id
          return (
            <div key={account.id} className="py-1">
              <AccountHeader
                account={account}
                isOpen={isOpen}
                onToggle={() => setExpandedId(isOpen ? null : account.id)}
              />

              {isOpen && (
                <div className="pl-6 pb-2">
                  {holdings.length > 0 ? (
                    <ul className="divide-y divide-slate-50">
                      {holdings.map((h) => (
                        <li key={h.id} className="flex items-center justify-between py-1.5 text-sm">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-700">{h.symbol}</p>
                            {h.description && (
                              <p className="text-xs text-slate-400 truncate">{h.description}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0 pl-3">
                            <p className="text-slate-700">{formatCurrency(h.market_value)}</p>
                            <p className="text-xs text-slate-400">{h.quantity} sh</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400 py-1.5">
                      {asOfDate ? 'All cash, no positions.' : 'Waiting on the next sync.'}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
