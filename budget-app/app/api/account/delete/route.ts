import { createClient, createAdminClient } from '@/lib/supabase/server'
import { removePlaidItem } from '@/lib/plaid/disconnect'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: member } = await admin
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single()

  if (member) {
    const { data: allMembers } = await admin
      .from('household_members')
      .select('user_id')
      .eq('household_id', member.household_id)

    const otherMembers = (allMembers ?? []).filter((m) => m.user_id !== user.id)

    if (otherMembers.length === 0) {
      // Sole member — delete the entire household and everything in it.
      const { data: items } = await admin
        .from('plaid_items')
        .select('id')
        .eq('household_id', member.household_id)

      for (const item of items ?? []) {
        await removePlaidItem(admin, item.id)
      }

      const { error: deleteHouseholdError } = await admin
        .from('households')
        .delete()
        .eq('id', member.household_id)
      if (deleteHouseholdError) {
        console.error('[account/delete] household delete failed:', deleteHouseholdError)
        return Response.json({ error: 'Failed to delete household data.' }, { status: 500 })
      }
    } else {
      // Other members remain — leave the household, keep its shared data.
      const { data: household } = await admin
        .from('households')
        .select('created_by')
        .eq('id', member.household_id)
        .single()

      // households.created_by has no ON DELETE behavior (RESTRICT) — reassign
      // it before deleting this user if they created the household.
      if (household?.created_by === user.id) {
        await admin
          .from('households')
          .update({ created_by: otherMembers[0].user_id })
          .eq('id', member.household_id)
      }

      // household_invites.invited_by is NOT NULL with no ON DELETE behavior —
      // drop invites this user sent rather than leaving them dangling.
      await admin.from('household_invites').delete().eq('invited_by', user.id)

      // The household_members row itself cascades away once the user row
      // below is deleted — no explicit delete needed here.
    }
  }

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteUserError) {
    console.error('[account/delete] auth user delete failed:', deleteUserError)
    return Response.json({ error: 'Failed to delete account.' }, { status: 500 })
  }

  await supabase.auth.signOut()

  return Response.json({ ok: true })
}
