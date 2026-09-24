import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { SCHWAB_OAUTH_BASE, getSchwabAppKey, getSchwabAppSecret, getSchwabRedirectUri } from './client'

export interface SchwabTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number // seconds, access token — Schwab issues ~1800 (30 min)
  token_type: string
  scope: string
}

export function getSchwabAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getSchwabAppKey(),
    redirect_uri: getSchwabRedirectUri(),
    response_type: 'code',
    state,
  })
  return `${SCHWAB_OAUTH_BASE}/authorize?${params.toString()}`
}

// Self-verifying CSRF state instead of a cookie: the whole Schwab OAuth round
// trip (our redirect -> Schwab login -> Schwab's redirect back) crosses the
// proxy.ts middleware twice, and that middleware also runs Supabase's session
// refresh on every request (its matcher isn't scoped away from /api/*) — a
// state cookie set alongside a redirect in that route handler wasn't
// reliably reaching the browser. Signing the household id + a nonce + an
// expiry directly into the state param removes the round-trip dependency
// entirely: the callback can verify it from the query param alone.
function signStatePayload(payload: string): string {
  return createHmac('sha256', getSchwabAppSecret()).update(payload).digest('base64url')
}

export function createSchwabState(householdId: string): string {
  const nonce = randomBytes(12).toString('base64url')
  const expiresAt = Date.now() + 10 * 60 * 1000 // whole OAuth round trip only needs a few minutes
  const payload = `${householdId}.${nonce}.${expiresAt}`
  const payloadB64 = Buffer.from(payload, 'utf8').toString('base64url')
  return `${payloadB64}.${signStatePayload(payload)}`
}

export function verifySchwabState(state: string, expectedHouseholdId: string): boolean {
  const [payloadB64, signature] = state.split('.')
  if (!payloadB64 || !signature) return false

  const payload = Buffer.from(payloadB64, 'base64url').toString('utf8')
  const expectedSignature = signStatePayload(payload)

  const sigBuf = Buffer.from(signature)
  const expectedBuf = Buffer.from(expectedSignature)
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return false

  const [householdId, , expiresAtStr] = payload.split('.')
  const expiresAt = Number(expiresAtStr)
  if (!householdId || !expiresAt || Date.now() > expiresAt) return false

  return householdId === expectedHouseholdId
}

function basicAuthHeader(): string {
  const credentials = `${getSchwabAppKey()}:${getSchwabAppSecret()}`
  return `Basic ${Buffer.from(credentials).toString('base64')}`
}

export async function exchangeSchwabCode(code: string): Promise<SchwabTokenResponse> {
  const res = await fetch(`${SCHWAB_OAUTH_BASE}/token`, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getSchwabRedirectUri(),
    }),
  })
  if (!res.ok) {
    throw new Error(`Schwab token exchange failed (${res.status}): ${await res.text()}`)
  }
  return res.json()
}

// Schwab rotates the refresh token on every use and resets its 7-day clock
// from the moment it's used — so a sync that refreshes at least once a week
// keeps the connection alive indefinitely without the user doing anything.
// Only a sync that's been failing for close to 7 days straight should ever
// need to prompt the user to reconnect.
export async function refreshSchwabToken(refreshToken: string): Promise<SchwabTokenResponse> {
  const res = await fetch(`${SCHWAB_OAUTH_BASE}/token`, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) {
    throw new Error(`Schwab token refresh failed (${res.status}): ${await res.text()}`)
  }
  return res.json()
}
