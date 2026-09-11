'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import type { Category, Transaction } from '@/types'

interface Row {
  key: string
  category_id: string
  amount: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: Transaction
  categories: Category[]
  onSaved: (transaction: Transaction) => void
}

function initialRows(transaction: Transaction): Row[] {
  if (transaction.splits && transaction.splits.length > 0) {
    return transaction.splits.map((s) => ({
      key: s.id,
      category_id: s.category_id,
      amount: s.amount.toFixed(2),
    }))
  }
  return [
    { key: crypto.randomUUID(), category_id: '', amount: '' },
    { key: crypto.randomUUID(), category_id: '', amount: '' },
  ]
}

// Mounted only while the dialog is open, so its form state initializes fresh
// from `transaction` every time it opens — no effect-based reset needed.
function SplitForm({
  transaction,
  categories,
  onSaved,
  onOpenChange,
}: Omit<Props, 'open'>) {
  const [rows, setRows] = useState<Row[]>(() => initialRows(transaction))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = transaction.amount
  const allocatedCents = rows.reduce((sum, r) => sum + Math.round((Number(r.amount) || 0) * 100), 0)
  const totalCents = Math.round(total * 100)
  const remainingCents = totalCents - allocatedCents
  const balanced = remainingCents === 0
  const hasSplits = !!transaction.splits && transaction.splits.length > 0

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function addRow() {
    setRows((prev) => [...prev, { key: crypto.randomUUID(), category_id: '', amount: '' }])
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length > 2 ? prev.filter((r) => r.key !== key) : prev))
  }

  async function save(splitsPayload: { category_id: string; amount: number }[]) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/transactions/${transaction.id}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ splits: splitsPayload }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to save split')
      onSaved(data.transaction)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save split')
    } finally {
      setSaving(false)
    }
  }

  function handleSave() {
    if (!balanced || rows.some((r) => !r.category_id || !(Number(r.amount) > 0))) return
    save(rows.map((r) => ({ category_id: r.category_id, amount: Number(r.amount) })))
  }

  function handleUnsplit() {
    save([])
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Split transaction</DialogTitle>
        <p className="text-sm text-slate-500">
          {transaction.merchant_name ?? transaction.description} · {formatCurrency(total)}
        </p>
      </DialogHeader>

      <div className="space-y-2">
        {rows.map((row) => {
          const selectedCategory = categories.find((c) => c.id === row.category_id)
          return (
          <div key={row.key} className="flex items-center gap-2">
            <Select
              value={row.category_id || null}
              onValueChange={(val: string | null) => updateRow(row.key, { category_id: val ?? '' })}
            >
              <SelectTrigger className="flex-1 h-8 text-sm">
                <span className="truncate">
                  {selectedCategory ? `${selectedCategory.icon} ${selectedCategory.name}` : 'Category'}
                </span>
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={row.amount}
              onChange={(e) => updateRow(row.key, { amount: e.target.value })}
              className="w-24 h-8 text-sm text-right"
            />
            <button
              type="button"
              onClick={() => removeRow(row.key)}
              disabled={rows.length <= 2}
              className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:pointer-events-none"
              title="Remove row"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          )
        })}

        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
        >
          <Plus className="h-3 w-3" /> Add category
        </button>
      </div>

      <div className="flex items-center justify-between text-sm px-1">
        <span className="text-slate-500">Remaining to allocate</span>
        <span
          className={
            balanced
              ? 'font-medium text-green-600'
              : remainingCents < 0
                ? 'font-medium text-red-600'
                : 'font-medium text-slate-700'
          }
        >
          {balanced ? '✓ Matches' : formatCurrency(remainingCents / 100)}
        </span>
      </div>

      {error && <p className="text-xs text-red-600 px-1">{error}</p>}

      <DialogFooter>
        {hasSplits && (
          <Button variant="outline" onClick={handleUnsplit} disabled={saving}>
            Un-split
          </Button>
        )}
        <Button
          onClick={handleSave}
          disabled={
            saving || !balanced || rows.some((r) => !r.category_id || !(Number(r.amount) > 0))
          }
        >
          {saving ? 'Saving…' : 'Save split'}
        </Button>
      </DialogFooter>
    </>
  )
}

export function SplitDialog({ open, onOpenChange, transaction, categories, onSaved }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <SplitForm
            transaction={transaction}
            categories={categories}
            onSaved={onSaved}
            onOpenChange={onOpenChange}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
