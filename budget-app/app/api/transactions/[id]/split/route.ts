import { createClient, createAdminClient } from '@/lib/supabase/server'

interface SplitInput {
  category_id: string
  amount: number
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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
  const splits: SplitInput[] = Array.isArray(body.splits) ? body.splits : []

  const admin = createAdminClient()

  const { data: transaction } = await admin
    .from('transactions')
    .select('id, amount, is_income')
    .eq('id', id)
    .eq('household_id', member.household_id)
    .single()
  if (!transaction) return Response.json({ error: 'Transaction not found.' }, { status: 404 })

  if (splits.length > 0) {
    if (transaction.is_income) {
      return Response.json({ error: 'Income transactions cannot be split.' }, { status: 400 })
    }
    if (splits.length < 2) {
      return Response.json({ error: 'A split needs at least 2 categories.' }, { status: 400 })
    }
    if (splits.some((s) => !s.category_id || !(Number(s.amount) > 0))) {
      return Response.json({ error: 'Each split needs a category and a positive amount.' }, { status: 400 })
    }

    const categoryIds = splits.map((s) => s.category_id)
    const { data: categories } = await admin
      .from('categories')
      .select('id, household_id')
      .in('id', categoryIds)
    const validIds = new Set(
      (categories ?? [])
        .filter((c) => c.household_id === null || c.household_id === member.household_id)
        .map((c) => c.id)
    )
    if (categoryIds.some((cid) => !validIds.has(cid))) {
      return Response.json({ error: 'Invalid category.' }, { status: 400 })
    }

    const splitCents = splits.reduce((sum, s) => sum + Math.round(Number(s.amount) * 100), 0)
    const transactionCents = Math.round(transaction.amount * 100)
    if (splitCents !== transactionCents) {
      return Response.json(
        { error: 'Split amounts must add up to the transaction total.' },
        { status: 400 }
      )
    }
  }

  const { error: deleteError } = await admin
    .from('transaction_splits')
    .delete()
    .eq('transaction_id', id)
  if (deleteError) return Response.json({ error: deleteError.message }, { status: 500 })

  if (splits.length > 0) {
    const { error: insertError } = await admin.from('transaction_splits').insert(
      splits.map((s) => ({
        transaction_id: id,
        household_id: member.household_id,
        category_id: s.category_id,
        amount: s.amount,
      }))
    )
    if (insertError) return Response.json({ error: insertError.message }, { status: 500 })
  }

  const { data: updated, error: updateError } = await admin
    .from('transactions')
    .update({ category_id: null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(
      '*, category:categories(id,name,color,icon), splits:transaction_splits(id,category_id,amount,category:categories(id,name,color,icon))'
    )
    .single()
  if (updateError) return Response.json({ error: updateError.message }, { status: 500 })

  return Response.json({ transaction: updated })
}
