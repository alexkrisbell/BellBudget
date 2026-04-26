import { Suspense } from 'react'
import { PlaidOAuthHandler } from './PlaidOAuthHandler'

export default function PlaidOAuthPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Suspense
        fallback={
          <div className="text-center space-y-2">
            <div className="h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-500">Completing bank connection…</p>
          </div>
        }
      >
        <PlaidOAuthHandler />
      </Suspense>
    </div>
  )
}
