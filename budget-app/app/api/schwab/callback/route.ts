import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { exchangeSchwabCode, verifySchwabState } from '@/lib/schwab/oauth'
import { syncSchwabHoldings } from '@/lib/schwab/sync'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const errorParam = request.nextUrl.searchParams.get('error')

  function redirectTo(path: string): NextResponse {
    return NextResponse.redirect(new URL(path, request.url))
  }

  if (errorParam) {
    return redirectTo(`/accounts?schwab_error=${encodeURIComponent(errorParam)}`)
  }
  if (!code || !state) {
    return redirectTo('/accounts?schwab_error=invalid_state')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirectTo('/login')

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return redirectTo('/onboarding')

  if (!verifySchwabState(state, member.household_id)) {
    return redirectTo('/accounts?schwab_error=invalid_state')
  }

  const admin = createAdminClient()

  try {
    const tokens = await exchangeSchwabCode(code)
    const now = Date.now()

    const { data: existing } = await admin
      .from('brokerage_connections')
      .select('id, access_token_vault_id, refresh_token_vault_id')
      .eq('household_id', member.household_id)
      .eq('provider', 'schwab')
      .maybeSingle()

    if (existing) {
      await admin.rpc('vault_update_schwab_token', {
        p_secret_id: existing.access_token_vault_id,
        p_token: tokens.access_token,
      })
      await admin.rpc('vault_update_schwab_token', {
        p_secret_id: existing.refresh_token_vault_id,
        p_token: tokens.refresh_token,
      })
      await admin
        .from('brokerage_connections')
        .update({
          access_token_expires_at: new Date(now + tokens.expires_in * 1000).toISOString(),
          refresh_token_expires_at: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'active',
          error_code: null,
          connected_by_user_id: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    } else {
      const { data: accessVaultId, error: accessVaultError } = await admin.rpc('vault_store_schwab_token', {
        p_token: tokens.access_token,
        p_label: `schwab_access_${member.household_id}`,
      })
      const { data: refreshVaultId, error: refreshVaultError } = await admin.rpc('vault_store_schwab_token', {
        p_token: tokens.refresh_token,
        p_label: `schwab_refresh_${member.household_id}`,
      })
      if (accessVaultError || refreshVaultError || !accessVaultId || !refreshVaultId) {
        console.error('Schwab vault store error:', accessVaultError, refreshVaultError)
        throw new Error('Failed to store Schwab tokens')
      }

      await admin.from('brokerage_connections').insert({
        household_id: member.household_id,
        provider: 'schwab',
        access_token_vault_id: accessVaultId,
        refresh_token_vault_id: refreshVaultId,
        access_token_expires_at: new Date(now + tokens.expires_in * 1000).toISOString(),
        refresh_token_expires_at: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active',
        connected_by_user_id: user.id,
      })
    }
  } catch (err) {
    console.error('Schwab callback error:', err)
    return redirectTo('/accounts?schwab_error=connect_failed')
  }

  // Best-effort, non-blocking — connection is already saved, so a sync
  // hiccup here shouldn't turn a successful connect into an error page.
  syncSchwabHoldings(member.household_id).catch((err) =>
    console.error('Initial Schwab sync failed:', err)
  )

  return redirectTo('/accounts?schwab_connected=1')
}
