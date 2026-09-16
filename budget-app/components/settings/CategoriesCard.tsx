'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Category } from '@/types'

const COLOR_PRESETS = [
  '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444',
  '#EC4899', '#F97316', '#14B8A6', '#6366F1', '#84CC16',
]

interface Props {
  initialCategories: Category[]
}

export function CategoriesCard({ initialCategories }: Props) {
  const [categories, setCategories] = useState(initialCategories)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [color, setColor] = useState(COLOR_PRESETS[0])
  const [isIncome, setIsIncome] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, icon, color, is_income: isIncome }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to create category.')
      setCategories((prev) => [...prev, data.category])
      setName('')
      setIcon('')
      setIsIncome(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create category.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setError(null)
    const prev = categories
    setCategories((c) => c.filter((cat) => cat.id !== id))
    const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to delete category.')
      setCategories(prev)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
        Custom Categories
      </p>

      {categories.length > 0 && (
        <ul className="space-y-2 mb-4">
          {categories.map((cat) => (
            <li key={cat.id} className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
              >
                {cat.icon} {cat.name}
              </span>
              {cat.is_income && <span className="text-[10px] text-slate-400">income</span>}
              <button
                onClick={() => handleDelete(cat.id)}
                className="ml-auto p-1 rounded text-slate-300 hover:text-red-600 hover:bg-red-50"
                title="Delete category"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="space-y-2.5 pt-3 border-t border-slate-100">
        <div className="flex gap-2">
          <Input
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="🎯"
            className="w-14 text-center"
            maxLength={4}
          />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name"
            className="flex-1"
            maxLength={40}
          />
        </div>

        <div className="flex items-center gap-1.5">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-6 w-6 rounded-full transition-transform ${
                color === c ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : ''
              }`}
              style={{ backgroundColor: c }}
              aria-label={c}
            />
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={isIncome}
            onChange={(e) => setIsIncome(e.target.checked)}
            className="rounded border-slate-300"
          />
          This is an income category
        </label>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <Button type="submit" size="sm" disabled={saving || !name.trim()}>
          <Plus className="size-3.5" />
          {saving ? 'Adding…' : 'Add Category'}
        </Button>
      </form>
    </div>
  )
}
