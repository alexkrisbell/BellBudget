import Link from 'next/link'
import { CategoryProgressCard } from './CategoryProgressCard'
import type { CategoryActual } from '@/types'

interface Props {
  categories: CategoryActual[]
}

export function CategoryGrid({ categories }: Props) {
  if (categories.length === 0) {
    return (
      <div className="rounded-xl border border-slate-100 bg-white px-4 py-10 text-center space-y-2">
        <p className="text-sm text-slate-400">No budget categories set for this month.</p>
        <Link href="/budget" className="text-sm text-indigo-600 hover:underline">
          Set up your budget →
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {categories.map((cat) => (
        <Link key={cat.id} href={`/transactions?category=${cat.id}`} className="block">
          <CategoryProgressCard category={cat} />
        </Link>
      ))}
    </div>
  )
}
