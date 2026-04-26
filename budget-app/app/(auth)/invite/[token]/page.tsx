import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { AcceptInviteButton } from './AcceptInviteButton'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default async function InvitePage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params

  const admin = createAdminClient()
  const { data: invite } = await admin
    .from('household_invites')
    .select('id, household_id, invited_email, expires_at, accepted_at, households(name)')
    .eq('invite_token', token)
    .single()

  if (!invite || invite.accepted_at || new Date(invite.expires_at) < new Date()) {
    notFound()
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Supabase returns related rows as an array when using select joins
  const householdsRaw = invite.households as unknown
  const householdName = (
    Array.isArray(householdsRaw) ? householdsRaw[0]?.name :
    householdsRaw && typeof householdsRaw === 'object' ? (householdsRaw as { name: string }).name :
    null
  ) ?? 'a household'

  return (
    <Card>
      <CardHeader>
        <CardTitle>You&apos;re invited</CardTitle>
        <CardDescription>
          You&apos;ve been invited to join <strong>{householdName}</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-600">
          This invite is for <strong>{invite.invited_email}</strong>.
        </p>
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        {user ? (
          <AcceptInviteButton token={token} />
        ) : (
          <>
            <Link
              href={`/signup?invite=${token}`}
              className={cn(buttonVariants({ variant: 'default' }), 'w-full text-center')}
            >
              Create account &amp; join
            </Link>
            <Link
              href={`/login?invite=${token}`}
              className={cn(buttonVariants({ variant: 'outline' }), 'w-full text-center')}
            >
              Sign in &amp; join
            </Link>
          </>
        )}
      </CardFooter>
    </Card>
  )
}
