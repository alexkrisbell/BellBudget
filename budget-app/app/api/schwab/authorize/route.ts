import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSchwabAuthorizationUrl } from '@/lib/schwab/oauth'

const STATE_COOKIE = 'schwab_oauth_state'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return Response.json({ error: 'No household.' }, { status: 400 })

  const state = randomBytes(24).toString('hex')

  // Attach the cookie directly to the redirect response — relying on
  // cookies().set() from next/headers alongside the throw-based redirect()
  // from next/navigation didn't reliably carry the Set-Cookie header on this
  // Next version's Route Handlers (the state cookie never made it to Schwab's
  // callback, so the round trip always failed as "invalid_state").
  const response = NextResponse.redirect(getSchwabAuthorizationUrl(state))
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600, // the whole OAuth round trip only needs a few minutes
    path: '/',
  })
  return response
}
