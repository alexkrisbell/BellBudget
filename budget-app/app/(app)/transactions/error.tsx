'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function TransactionsError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
      <p className="text-slate-700 font-semibold">Failed to load transactions</p>
      <p className="text-sm text-slate-500">There was a problem fetching your transactions.</p>
      <button
        onClick={reset}
        className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
      >
        Try again
      </button>
    </div>
  )
}
