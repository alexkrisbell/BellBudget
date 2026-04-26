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
  return (
    <div className="flex flex-wrap gap-3">
      <Select value={selectedCategory} onValueChange={(val) => onCategoryChange(val ?? 'all')}>
        <SelectTrigger className="w-44 h-9 text-sm">
          <SelectValue placeholder="All categories" />
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
          <SelectValue placeholder="All accounts" />
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
