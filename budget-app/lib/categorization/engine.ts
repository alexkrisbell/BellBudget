import { loadRules, matchRule, normalizeMerchant } from './rules'
import { batchCategorize } from '@/lib/openai/categorize'
import { createAdminClient } from '@/lib/supabase/server'
import type { Transaction as PlaidTransaction } from 'plaid'

const PLAID_CATEGORY_MAP: Record<string, string> = {
  FOOD_AND_DRINK: 'Dining Out',
  GROCERIES: 'Groceries',
  GENERAL_MERCHANDISE: 'Shopping',
  HOME_IMPROVEMENT: 'Shopping',
  MEDICAL: 'Health',
  PERSONAL_CARE: 'Personal Care',
  ENTERTAINMENT: 'Entertainment',
  TRAVEL: 'Travel',
  TRANSPORTATION: 'Transportation',
  RENT_AND_UTILITIES: 'Utilities',
  LOAN_PAYMENTS: 'Other',
  BANK_FEES: 'Other',
  TRANSFER_IN: 'Transfer',
  TRANSFER_OUT: 'Transfer',
  INCOME: 'Paycheck',
  GOVERNMENT_AND_NON_PROFIT: 'Other',
  GENERAL_SERVICES: 'Other',
  EDUCATION: 'Education',
  INSURANCE: 'Insurance',
}

export interface CategorizationResult {
  category_id: string | null
  source: 'rule' | 'plaid' | 'ai'
}

export async function categorizeBatch(
  transactions: PlaidTransaction[],
  householdId: string,
  categoryByName: Map<string, string>
): Promise<Map<string, CategorizationResult>> {
  const supabase = createAdminClient()
  const rules = await loadRules(householdId)
  const results = new Map<string, CategorizationResult>()

  // Queue for AI: normalized merchant → [transaction IDs]
  const pendingAI = new Map<string, string[]>()
  // normalized merchant → original name (for the AI call)
  const normalizedToOriginal = new Map<string, string>()

  for (const tx of transactions) {
    const merchant = tx.merchant_name ?? tx.name

    // 1. Rule matching (user rules have priority=10, ai rules=5, sorted DESC)
    const ruleMatch = matchRule(merchant, rules)
    if (ruleMatch) {
      results.set(tx.transaction_id, { category_id: ruleMatch.category_id, source: 'rule' })
      continue
    }

    // 2. Plaid personal_finance_category mapping
    const plaidPrimary = tx.personal_finance_category?.primary ?? ''
    const plaidCategoryName = PLAID_CATEGORY_MAP[plaidPrimary]
    if (plaidCategoryName) {
      const categoryId = categoryByName.get(plaidCategoryName.toLowerCase()) ?? null
      results.set(tx.transaction_id, { category_id: categoryId, source: 'plaid' })
      continue
    }

    // 3. Queue for AI
    const normalized = normalizeMerchant(merchant)
    if (!pendingAI.has(normalized)) {
      pendingAI.set(normalized, [])
      normalizedToOriginal.set(normalized, merchant)
    }
    pendingAI.get(normalized)!.push(tx.transaction_id)
  }

  // 4. Batch AI call for merchants that need it
  if (pendingAI.size > 0) {
    const uniqueMerchants = [...pendingAI.keys()].map(
      (norm) => normalizedToOriginal.get(norm)!
    )
    const aiResults = await batchCategorize(uniqueMerchants)

    for (const [originalMerchant, categoryName] of Object.entries(aiResults)) {
      const categoryId = categoryByName.get(categoryName.toLowerCase()) ?? null
      if (!categoryId) continue

      const normalized = normalizeMerchant(originalMerchant)
      const txIds = pendingAI.get(normalized) ?? []

      // Store as AI rule so future syncs skip OpenAI for this merchant
      await supabase.from('categorization_rules').upsert(
        {
          household_id: householdId,
          merchant_keyword: normalized,
          category_id: categoryId,
          match_type: 'contains',
          priority: 5,
          source: 'ai',
          usage_count: txIds.length,
        },
        { onConflict: 'household_id,merchant_keyword' }
      )

      for (const txId of txIds) {
        results.set(txId, { category_id: categoryId, source: 'ai' })
      }
    }
  }

  // 5. Fallback: "Other" for anything still unresolved
  const otherCategoryId = categoryByName.get('other') ?? null
  for (const tx of transactions) {
    if (!results.has(tx.transaction_id)) {
      results.set(tx.transaction_id, { category_id: otherCategoryId, source: 'plaid' })
    }
  }

  return results
}
