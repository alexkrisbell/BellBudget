'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 text-center px-4">
        <p className="text-slate-700 font-semibold">Something went wrong</p>
        <p className="text-sm text-slate-500">This has been reported. Please try again.</p>
        <button
          onClick={reset}
          className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Try again
        </button>
      </body>
    </html>
  )
}
