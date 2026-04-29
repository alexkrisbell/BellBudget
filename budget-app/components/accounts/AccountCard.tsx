'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Pencil, Check, X } from 'lucide-react'
import { ReconnectButton } from './ReconnectButton'
import type { Account, PlaidItem } from '@/types'
import { formatCurrency } from '@/lib/utils'

interface AccountGroup {
  item: PlaidItem
  accounts: Account[]
}

interface Props {
  group: AccountGroup
}

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  depository: 'Bank',
  credit: 'Credit Card',
  loan: 'Loan',
  investment: 'Investment',
  other: 'Other',
}

function AccountRow({ account }: { account: Account }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(account.name)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (name.trim() === account.name || !name.trim()) {
      setEditing(false)
      setName(account.name)
      return
    }
    setSaving(true)
    const res = await fetch(`/api/accounts/${account.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    setSaving(false)
    if (res.ok) {
      setEditing(false)
      router.refresh()
    } else {
      setName(account.name)
      setEditing(false)
    }
  }

  function cancel() {
    setName(account.name)
    setEditing(false)
  }

  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
      <div className="flex-1 min-w-0 mr-2">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save()
                if (e.key === 'Escape') cancel()
              }}
              className="text-sm font-medium text-slate-800 bg-white border border-indigo-300 rounded px-2 py-0.5 w-full focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
            <button
              onClick={save}
              disabled={saving}
              className="text-green-600 hover:text-green-700 shrink-0"
              aria-label="Save"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={cancel}
              className="text-slate-400 hover:text-slate-600 shrink-0"
              aria-label="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 group">
            <p className="text-sm font-medium text-slate-800 truncate">{name}</p>
            <button
              onClick={() => setEditing(true)}
              className="text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              aria-label="Rename account"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        )}
        <p className="text-xs text-slate-400">
          {ACCOUNT_TYPE_LABEL[account.type] ?? account.type}
          {account.subtype ? ` · ${account.subtype}` : ''}
        </p>
      </div>
      <div className="text-right shrink-0">
        {account.current_balance != null && (
          <p className="text-sm font-semibold text-slate-800">
            {formatCurrency(account.current_balance)}
          </p>
        )}
        {account.available_balance != null &&
          account.available_balance !== account.current_balance && (
            <p className="text-xs text-slate-400">
              {formatCurrency(account.available_balance)} available
            </p>
          )}
      </div>
    </div>
  )
}

export function AccountCard({ group }: Props) {
  const router = useRouter()
  const { item, accounts } = group
  const needsReauth = item.status === 'requires_reauth'
  const hasError = item.status === 'error'

  return (
    <Card className={needsReauth || hasError ? 'border-red-200' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">{item.institution_name}</CardTitle>
          {needsReauth && (
            <Badge variant="destructive" className="gap-1 text-xs">
              <AlertCircle className="h-3 w-3" />
              Reconnect required
            </Badge>
          )}
          {hasError && !needsReauth && (
            <Badge variant="destructive" className="text-xs">
              Error
            </Badge>
          )}
          {item.status === 'active' && (
            <Badge variant="secondary" className="text-xs text-slate-500">
              Connected
            </Badge>
          )}
        </div>
        {item.last_synced_at && (
          <p className="text-xs text-slate-400">
            Last synced {new Date(item.last_synced_at).toLocaleDateString()}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {needsReauth && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2.5 mb-1">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-red-700">Action required</p>
              <p className="text-xs text-red-600 mt-0.5">
                Your connection expired. Reconnect to resume transaction syncing.
              </p>
              <div className="mt-2">
                <ReconnectButton itemId={item.id} onSuccess={() => router.refresh()} />
              </div>
            </div>
          </div>
        )}
        {accounts.map((account) => (
          <AccountRow key={account.id} account={account} />
        ))}
        {accounts.length === 0 && (
          <p className="text-sm text-slate-400">No accounts found.</p>
        )}
      </CardContent>
    </Card>
  )
}
