'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Check, X } from 'lucide-react'

interface Props {
  householdId: string
  initialName: string
}

export function HouseholdCard({ initialName }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(initialName)
  const [draft, setDraft] = useState(initialName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    const trimmed = draft.trim()
    if (!trimmed || trimmed === name) { setEditing(false); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/household', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save.')
      setName(trimmed)
      setEditing(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Household</p>

      {editing ? (
        <div className="space-y-3">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => { setEditing(false); setDraft(name) }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 rounded-lg hover:bg-slate-100"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold text-slate-800">{name}</p>
          <button
            onClick={() => { setDraft(name); setEditing(true) }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-500 rounded-lg hover:bg-slate-100"
          >
            <Pencil className="h-3.5 w-3.5" />
            Rename
          </button>
        </div>
      )}
    </div>
  )
}
