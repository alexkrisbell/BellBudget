// ─── Core DB entities ──────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Household {
  id: string
  name: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface HouseholdMember {
  id: string
  household_id: string
  user_id: string
  role: 'owner' | 'member'
  joined_at: string
  user?: User
}

export interface HouseholdInvite {
  id: string
  household_id: string
  invited_email: string
  invite_token: string
  invited_by: string
  accepted_at: string | null
  expires_at: string
  created_at: string
}

export interface PlaidItem {
  id: string
  household_id: string
  plaid_item_id: string
  institution_id: string
  institution_name: string
  status: 'active' | 'error' | 'requires_reauth'
  error_code: string | null
  cursor: string | null
  last_synced_at: string | null
  connected_by_user_id: string | null
  created_at: string
  updated_at: string
  // access_token_vault_id is a UUID referencing vault.secrets — never sent to client
}

export interface Account {
  id: string
  household_id: string
  plaid_item_id: string
  plaid_account_id: string
  name: string
  official_name: string | null
  type: 'depository' | 'credit' | 'loan' | 'investment'
  subtype: string | null
  current_balance: number | null
  available_balance: number | null
  balance_updated_at: string | null
  is_active: boolean
  created_at: string
}

export interface Category {
  id: string
  household_id: string | null
  name: string
  color: string
  icon: string
  is_income: boolean
  is_system: boolean
  sort_order: number
  created_at: string
}

export interface CategorizationRule {
  id: string
  household_id: string
  merchant_keyword: string
  category_id: string
  match_type: 'exact' | 'contains' | 'starts_with'
  priority: number
  source: 'user' | 'ai' | 'system'
  usage_count: number
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  account_id: string
  household_id: string
  plaid_transaction_id: string
  amount: number // positive = debit/expense, negative = credit/income (Plaid convention)
  merchant_name: string | null
  description: string
  date: string // YYYY-MM-DD
  authorized_date: string | null
  category_id: string | null
  categorization_source: 'plaid' | 'rule' | 'ai' | 'user'
  user_id: string | null
  is_income: boolean
  pending: boolean
  excluded: boolean
  notes: string | null
  created_at: string
  updated_at: string
  // Joined
  category?: Category
  account?: Pick<Account, 'id' | 'name' | 'type' | 'subtype'>
}

export interface Budget {
  id: string
  household_id: string
  month: number
  year: number
  total_income_expected: number | null
  notes: string | null
  is_template: boolean
  template_name: string | null
  created_at: string
  updated_at: string
}

export interface BudgetItem {
  id: string
  budget_id: string
  category_id: string
  planned_amount: number
  sort_order: number
  category?: Category
}

export interface Streak {
  household_id: string
  current_streak: number
  longest_streak: number
  last_evaluated_month: number | null
  last_evaluated_year: number | null
  last_success_at: string | null
  last_reset_at: string | null
  updated_at: string
}

export interface Notification {
  id: string
  household_id: string
  user_id: string | null
  type:
    | 'budget_warning'
    | 'budget_exceeded'
    | 'paycheck'
    | 'streak_update'
    | 'item_error'
  title: string
  body: string
  metadata: Record<string, unknown> | null
  read_at: string | null
  created_at: string
}

// ─── API response shapes ────────────────────────────────────────────────────

export interface CategoryActual {
  id: string
  name: string
  color: string
  icon: string
  planned: number
  actual: number
  pct: number
}

export interface RecentTransaction {
  id: string
  merchant_name: string | null
  description: string
  amount: number
  is_income: boolean
  date: string
  category?: { id: string; name: string; color: string; icon: string } | null
}

export interface IncomeSource {
  id: string
  name: string
  icon: string
  color: string
  amount: number
}

export interface DashboardData {
  total_budgeted: number
  total_spent: number
  total_remaining: number
  pct_used: number
  categories: CategoryActual[]
  income: {
    expected: number | null
    actual: number
    sources: IncomeSource[]
  }
  streak: {
    current: number
    longest: number
    on_track: boolean
  }
  notifications: Notification[]
  recent_transactions: RecentTransaction[]
}

export interface BudgetWithActuals {
  budget: Budget
  items: (BudgetItem & { actual: number; pct: number })[]
}

export interface TransactionListResponse {
  transactions: Transaction[]
  total: number
  page: number
  has_more: boolean
}

export interface StreakResponse {
  current: number
  longest: number
  last_success_at: string | null
  on_track_this_month: boolean
}
