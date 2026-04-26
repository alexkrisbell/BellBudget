'use client'

import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Category } from '@/types'

interface Props {
  transactionId: string
  currentCategory: Category | null | undefined
  categories: Category[]
  onUpdate: (transactionId: string, categoryId: string) => void
}

export function CategoryPicker({ transactionId, currentCategory, categories, onUpdate }: Props) {
  const [open, setOpen] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSelect(categoryId: string) {
    setUpdating(true)
    setError(null)
    try {
      const res = await fetch(`/api/transactions/${transactionId}/category`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_id: categoryId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to update category')
      }
      onUpdate(transactionId, categoryId)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium hover:opacity-80 transition-opacity cursor-pointer"
        style={{
          backgroundColor: currentCategory?.color ? `${currentCategory.color}25` : '#f1f5f9',
          color: currentCategory?.color ?? '#64748b',
        }}
      >
        {currentCategory?.icon && <span>{currentCategory.icon}</span>}
        <span>{currentCategory?.name ?? 'Uncategorized'}</span>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2" align="start">
        <p className="px-2 pb-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Category
        </p>
        {error && (
          <p className="px-2 pb-1.5 text-xs text-red-500">{error}</p>
        )}
        <div className="max-h-60 overflow-y-auto space-y-0.5">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleSelect(cat.id)}
              disabled={updating}
              className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100 text-left disabled:opacity-50"
            >
              <span className="text-base leading-none">{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
