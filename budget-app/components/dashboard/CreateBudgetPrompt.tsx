import Link from 'next/link'
import { PieChart } from 'lucide-react'

export function CreateBudgetPrompt() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center max-w-md mx-auto mt-6">
      <div className="size-12 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-4">
        <PieChart className="h-6 w-6 text-indigo-600" />
      </div>
      <h3 className="text-lg font-semibold text-slate-800">Create your first budget</h3>
      <p className="text-sm text-slate-500 mt-1.5 mb-5">
        Accounts are connected — nice. Now set a planned amount for a few categories like
        Rent, Groceries, and Fun, and your dashboard will show exactly where you stand.
      </p>
      <Link
        href="/budget"
        className="inline-block px-5 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
      >
        Set up my budget
      </Link>
    </div>
  )
}
