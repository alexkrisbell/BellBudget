'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Account, Category } from '@/types'

interface Props {
  categories: Category[]
  accounts: Account[]
  selectedCategory: string
  selectedAccount: string
  onCategoryChange: (val: string) => void
  onAccountChange: (val: string) => void
}

export function FilterBar({
  categories,
  accounts,
  selectedCategory,
  selectedAccount,
  onCategoryChange,
  onAccountChange,
}: Props) {
  const selectedCategoryLabel =
    selectedCategory === 'all'
      ? 'All categories'
      : (() => {
          const cat = categories.find((c) => c.id === selectedCategory)
          return cat ? `${cat.icon} ${cat.name}` : 'All categories'
        })()

  const selectedAccountLabel =
    selectedAccount === 'all'
      ? 'All accounts'
      : accounts.find((a) => a.id === selectedAccount)?.name ?? 'All accounts'

  return (
    <div className="flex flex-wrap gap-3">
      <Select value={selectedCategory} onValueChange={(val) => onCategoryChange(val ?? 'all')}>
        <SelectTrigger className="w-44 h-9 text-sm">
          <span className="truncate">{selectedCategoryLabel}</span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {categories.map((cat) => (
            <SelectItem key={cat.id} value={cat.id}>
              {cat.icon} {cat.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={selectedAccount} onValueChange={(val) => onAccountChange(val ?? 'all')}>
        <SelectTrigger className="w-44 h-9 text-sm">
          <span className="truncate">{selectedAccountLabel}</span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All accounts</SelectItem>
          {accounts.map((acc) => (
            <SelectItem key={acc.id} value={acc.id}>
              {acc.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
