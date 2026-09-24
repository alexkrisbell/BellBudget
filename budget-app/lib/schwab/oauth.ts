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
