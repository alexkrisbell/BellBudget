// Schwab Trader API config. Unlike Plaid there's no SDK — these are plain
// REST calls, so this module just centralizes the base URLs and app
// credentials every other lib/schwab/ file needs.

export const SCHWAB_API_BASE = 'https://api.schwabapi.com/trader/v1'
export const SCHWAB_OAUTH_BASE = 'https://api.schwabapi.com/v1/oauth'

export function getSchwabAppKey(): string {
  const key = process.env.SCHWAB_APP_KEY
  if (!key) throw new Error('SCHWAB_APP_KEY is not set.')
  return key
}

export function getSchwabAppSecret(): string {
  const secret = process.env.SCHWAB_APP_SECRET
  if (!secret) throw new Error('SCHWAB_APP_SECRET is not set.')
  return secret
}

// Same NEXT_PUBLIC_APP_URL pattern Plaid's redirect_uri/webhook registration
// already uses — must exactly match the callback URL registered in the
// Schwab Developer Portal (https://bell-budget-8wmo.vercel.app/api/schwab/callback).
export function getSchwabRedirectUri(): string {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  return `${appUrl}/api/schwab/callback`
}
