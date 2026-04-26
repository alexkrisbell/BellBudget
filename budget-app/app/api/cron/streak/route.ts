import { createAdminClient } from '@/lib/supabase/server'
import { evaluateStreak } from '@/lib/streak/calculator'

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Evaluate the previous month (cron runs on the 1st of each month)
  const now = new Date()
  const evalMonth = now.getMonth() === 0 ? 12 : now.getMonth()
  const evalYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()

  const admin = createAdminClient()
  const { data: households } = await admin.from('households').select('id')

  if (!households || households.length === 0) {
    return Response.json({ message: 'No households to evaluate.' })
  }

  const results = await Promise.allSettled(
    households.map((h: { id: string }) => evaluateStreak(h.id, evalMonth, evalYear))
  )

  const succeeded = results.filter((r) => r.status === 'fulfilled').length
  const skipped = results
    .filter((r) => r.status === 'fulfilled')
    .filter((r) => (r as PromiseFulfilledResult<{ skipped?: boolean }>).value?.skipped).length
  const failed = results.filter((r) => r.status === 'rejected').length

  return Response.json({
    evaluated: succeeded - skipped,
    skipped,
    failed,
    total: households.length,
    month: evalMonth,
    year: evalYear,
  })
}
