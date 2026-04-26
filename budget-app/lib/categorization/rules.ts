import { createAdminClient } from '@/lib/supabase/server'
import type { CategorizationRule } from '@/types'

export function normalizeMerchant(name: string): string {
  return name
    .toLowerCase()
    .replace(/#\d+/g, '')       // strip store numbers like "#123"
    .replace(/[^\w\s]/g, ' ')   // replace punctuation with space
    .replace(/\s+/g, ' ')       // collapse whitespace
    .trim()
}

export async function loadRules(householdId: string): Promise<CategorizationRule[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('categorization_rules')
    .select('*')
    .eq('household_id', householdId)
    .order('priority', { ascending: false })
  return (data ?? []) as CategorizationRule[]
}

export function matchRule(
  merchantName: string,
  rules: CategorizationRule[]
): CategorizationRule | null {
  const normalized = normalizeMerchant(merchantName)
  for (const rule of rules) {
    const keyword = normalizeMerchant(rule.merchant_keyword)
    let matched = false
    switch (rule.match_type) {
      case 'exact':       matched = normalized === keyword; break
      case 'contains':    matched = normalized.includes(keyword); break
      case 'starts_with': matched = normalized.startsWith(keyword); break
    }
    if (matched) return rule
  }
  return null
}
