import { createAdminClient } from '@/lib/supabase/server'

type NotificationType =
  | 'budget_warning'
  | 'budget_exceeded'
  | 'paycheck'
  | 'streak_update'
  | 'item_error'

interface CreateNotificationOptions {
  householdId: string
  userId?: string | null
  type: NotificationType
  title: string
  body: string
  metadata?: Record<string, unknown>
}

export async function createNotification(opts: CreateNotificationOptions) {
  const admin = createAdminClient()
  const { error } = await admin.from('notifications').insert({
    household_id: opts.householdId,
    user_id: opts.userId ?? null,
    type: opts.type,
    title: opts.title,
    body: opts.body,
    metadata: opts.metadata ?? null,
  })
  if (error) {
    console.error('[createNotification] error:', error.message)
  }
}
