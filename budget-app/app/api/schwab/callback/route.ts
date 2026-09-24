import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { exchangeSchwabCode } from '@/lib/schwab/oauth'
import { syncSchwabHoldings } from '@/lib/schwab/sync'

const STATE_COOKIE = 'schwab_oauth_state'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const errorParam = url.searchParams.get('error')

  const cookieStore = await cookies()
  const expectedState = cookieStore.get(STATE_COOKIE)?.value
  cookieStore.delete(STATE_COOKIE)

  if (errorParam) {
    redirect(`/settings?schwab_error=${encodeURIComponent(errorParam)}`)
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    redirect('/settings?schwab_error=invalid_state')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single()
  if (!member) redirect('/onboarding')

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
    redirect('/settings?schwab_error=connect_failed')
  }

  // Best-effort, non-blocking — connection is already saved, so a sync
  // hiccup here shouldn't turn a successful connect into an error page.
  syncSchwabHoldings(member.household_id).catch((err) =>
    console.error('Initial Schwab sync failed:', err)
  )

  redirect('/settings?schwab_connected=1')
}
