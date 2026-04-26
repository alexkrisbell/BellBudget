import { createClient, createAdminClient } from '@/lib/supabase/server'
import { normalizeMerchant } from '@/lib/categorization/rules'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return Response.json({ error: 'No household.' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const { category_id } = body
  if (!category_id) return Response.json({ error: 'category_id required.' }, { status: 400 })

  const { id } = await params
  const admin = createAdminClient()

  // Use admin client — transactions table has no UPDATE RLS policy (writes are service-role only).
  // Security is enforced by the household_id check below.
  const { data: transaction, error } = await admin
    .from('transactions')
    .update({
      category_id,
      categorization_source: 'user',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('household_id', member.household_id)
    .select('*, category:categories(id,name,color,icon), account:accounts(id,name,type,subtype)')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!transaction) return Response.json({ error: 'Transaction not found.' }, { status: 404 })

  // Upsert user rule so future syncs skip OpenAI for this merchant
  const merchantSource = transaction.merchant_name ?? transaction.description
  if (merchantSource) {
    const keyword = normalizeMerchant(merchantSource)
    await admin.from('categorization_rules').upsert(
      {
        household_id: member.household_id,
        merchant_keyword: keyword,
        category_id,
        match_type: 'contains',
        priority: 10,
        source: 'user',
        usage_count: 1,
      },
      { onConflict: 'household_id,merchant_keyword' }
    )
  }

  return Response.json({ transaction })
}
