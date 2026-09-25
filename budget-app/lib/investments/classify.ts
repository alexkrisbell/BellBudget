export type TransactionCategory =
  | 'contribution'
  | 'withdrawal'
  | 'dividend_or_interest'
  | 'trade'
  | 'transfer'
  | 'fee'
  | 'other'

// Schwab's raw activity type strings, mapped to our own classification so
// "how much did we invest this month" can be computed without re-parsing
// Schwab's vocabulary every time. Unrecognized types fall back to 'other'
// rather than throwing — this endpoint's exact type enum wasn't verified
// against live data before this shipped, so new/unexpected values are
// expected and shouldn't break the sync.
const TYPE_MAP: Record<string, TransactionCategory> = {
  ACH_RECEIPT: 'contribution',
  CASH_RECEIPT: 'contribution',
  WIRE_IN: 'contribution',
  ACH_DISBURSEMENT: 'withdrawal',
  CASH_DISBURSEMENT: 'withdrawal',
  WIRE_OUT: 'withdrawal',
  DIVIDEND_OR_INTEREST: 'dividend_or_interest',
  TRADE: 'trade',
  RECEIVE_AND_DELIVER: 'trade',
  JOURNAL: 'transfer',
  ELECTRONIC_FUND: 'transfer',
}

export function classifyTransaction(rawType: string): TransactionCategory {
  return TYPE_MAP[rawType] ?? 'other'
}
