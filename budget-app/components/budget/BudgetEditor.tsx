'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BudgetItemRow } from './BudgetItemRow'
import { CopyFromPreviousButton } from './CopyFromPreviousButton'
import type { Budget, Category } from '@/types'

interface BudgetItemData {
  category_id: string
  planned_amount: number
  sort_order: number
  actual?: number
  pct?: number
  category?: Category
}

interface LocalItem {
  key: string
  category_id: string
  planned_amount: string
  actual?: number
  pct?: number
  category?: Category
}

interface Props {
  budget: Budget | null
  items: BudgetItemData[]
  categories: Category[]
  month: number
  year: number
  isReadOnly: boolean
}

function makeKey(categoryId: string) {
  return `${categoryId}-${Math.random().toString(36).slice(2, 7)}`
}

export function BudgetEditor({
  budget: initialBudget,
  items: initialItems,
  categories,
  month,
  year,
  isReadOnly,
}: Props) {
  const router = useRouter()
  const [budgetId, setBudgetId] = useState<string | null>(initialBudget?.id ?? null)
  const [items, setItems] = useState<LocalItem[]>(() =>
    initialItems.map((item) => ({
      key: makeKey(item.category_id),
      category_id: item.category_id,
      planned_amount: String(item.planned_amount),
      actual: item.actual,
      pct: item.pct,
      category: item.category,
    }))
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Key changes after each add to reset Select back to placeholder
  const [selectKey, setSelectKey] = useState(0)

  const usedIds = new Set(items.map((i) => i.category_id))
  const availableCategories = categories.filter((c) => !c.is_income && !usedIds.has(c.id))

  const totalPlanned = items.reduce((sum, i) => sum + (parseFloat(i.planned_amount) || 0), 0)
  const totalActual = items.reduce((sum, i) => sum + (i.actual ?? 0), 0)

  function handleAmountChange(categoryId: string, value: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.category_id === categoryId ? { ...item, planned_amount: value } : item
      )
    )
    setSaved(false)
  }

  function handleRemove(categoryId: string) {
    setItems((prev) => prev.filter((item) => item.category_id !== categoryId))
    setSaved(false)
  }

  function handleAddCategory(categoryId: string) {
    if (!categoryId) return
    const cat = categories.find((c) => c.id === categoryId)
    if (!cat) return
    setItems((prev) => [
      ...prev,
      {
        key: makeKey(categoryId),
        category_id: categoryId,
        planned_amount: '',
        category: cat,
      },
    ])
    setSelectKey((k) => k + 1)
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    const itemsToSave = items.map((item) => ({
      category_id: item.category_id,
      planned_amount: parseFloat(item.planned_amount) || 0,
    }))

    try {
      let res: Response
      if (budgetId) {
        res = await fetch(`/api/budget/${budgetId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: itemsToSave }),
        })
      } else {
        res = await fetch('/api/budget', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ month, year, items: itemsToSave }),
        })
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to save budget.')
      }

      const data = await res.json()
      if (!budgetId && data.budget?.id) {
        setBudgetId(data.budget.id)
      }
      setSaved(true)
      router.refresh()
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  // Read-only empty state
  if (isReadOnly && items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-100 bg-white px-4 py-10 text-center">
        <p className="text-sm text-slate-400">No budget was set for this month.</p>
      </div>
    )
  }

  // Editable empty state (no budget yet, no items added)
  if (!budgetId && !isReadOnly && items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center space-y-4">
        <p className="text-sm text-slate-500">No budget set for this month yet.</p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button
            size="sm"
            onClick={() => {
              const cat = availableCategories[0]
              if (cat) handleAddCategory(cat.id)
            }}
            disabled={availableCategories.length === 0}
          >
            <Plus className="size-3.5" />
            Add First Category
          </Button>
          <CopyFromPreviousButton month={month} year={year} />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Category budgets
        </p>
        {!isReadOnly && (
          <div className="flex items-center gap-2">
            {!budgetId && <CopyFromPreviousButton month={month} year={year} />}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              variant={saved ? 'secondary' : 'default'}
            >
              {saved ? (
                <>
                  <Check className="size-3.5" />
                  Saved
                </>
              ) : saving ? (
                'Saving…'
              ) : (
                'Save Budget'
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="px-4">
        {items.length === 0 ? (
          <p className="py-6 text-sm text-slate-400 text-center">
            No categories yet — add one below.
          </p>
        ) : (
          items.map((item) => (
            <BudgetItemRow
              key={item.key}
              categoryId={item.category_id}
              plannedAmount={item.planned_amount}
              actual={item.actual}
              pct={item.pct}
              category={item.category}
              onChange={(val) => handleAmountChange(item.category_id, val)}
              onRemove={() => handleRemove(item.category_id)}
              isReadOnly={isReadOnly}
            />
          ))
        )}
      </div>

      {/* Footer: add category + totals */}
      <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-4">
        {!isReadOnly && availableCategories.length > 0 ? (
          <Select
            key={selectKey}
            onValueChange={(val: string | null) => { if (val) handleAddCategory(val) }}
          >
            <SelectTrigger className="w-48 h-8 text-sm">
              <SelectValue placeholder="+ Add category" />
            </SelectTrigger>
            <SelectContent>
              {availableCategories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div />
        )}

        {isReadOnly ? (
          <div className="text-sm text-slate-600">
            <span className="font-medium">${totalActual.toFixed(0)}</span>
            <span className="text-slate-400"> spent / </span>
            <span className="font-medium">${totalPlanned.toFixed(0)}</span>
            <span className="text-slate-400"> planned</span>
          </div>
        ) : (
          <div className="text-sm text-slate-600">
            Total:{' '}
            <span className="font-semibold text-indigo-600">${totalPlanned.toFixed(0)}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="px-4 pb-3 text-xs text-red-500">{error}</div>
      )}
    </div>
  )
}
