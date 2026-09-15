import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  // Deliberately no Session Replay / Feedback widget here — this app renders
  // real account balances and transactions, and Replay records the DOM.
  // Error tracking only, no performance tracing (keeps Sentry's free-tier
  // transaction quota untouched on a small personal app).
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
