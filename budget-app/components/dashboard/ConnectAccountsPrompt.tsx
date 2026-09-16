'use client'

import { Landmark } from 'lucide-react'
import { PlaidLinkButton } from '@/components/accounts/PlaidLinkButton'

export function ConnectAccountsPrompt() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center max-w-md mx-auto mt-6">
      <div className="size-12 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-4">
        <Landmark className="h-6 w-6 text-indigo-600" />
      </div>
      <h3 className="text-lg font-semibold text-slate-800">Connect your accounts</h3>
      <p className="text-sm text-slate-500 mt-1.5 mb-5">
        This is where Bell Bucks starts working for you. Once your checking, savings, and
        cards are connected, your transactions, budget, and net worth all come to life
        automatically.
      </p>
      <div className="flex justify-center">
        <PlaidLinkButton onSuccess={() => { window.location.href = '/dashboard' }} />
      </div>
    </div>
  )
}
