import { formatCurrency } from '@/lib/utils'
import type { AccountHoldings } from '@/lib/investments/compute'

interface Props {
  accounts: AccountHoldings[]
}

function accountLabel(account: AccountHoldings['account']): string {
  const type = account.account_type ?? 'Account'
  return account.last4 ? `${type} ····${account.last4}` : type
}

export function HoldingsCard({ accounts }: Props) {
  if (accounts.length === 0) return null

  const total = accounts.reduce((sum, a) => sum + (a.account.market_value ?? 0), 0)

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-5">
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-sm font-medium text-slate-600">Investments</p>
        <p className="text-sm font-semibold text-slate-800">{formatCurrency(total)}</p>
      </div>

      <div className="space-y-5">
        {accounts.map(({ account, holdings, asOfDate }) => (
          <div key={account.id}>
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {accountLabel(account)}
              </p>
              <p className="text-sm font-medium text-slate-700">
                {formatCurrency(account.market_value ?? 0)}
              </p>
            </div>

            {holdings.length > 0 ? (
              <ul className="divide-y divide-slate-50">
                {holdings.map((h) => (
                  <li key={h.id} className="flex items-center justify-between py-1.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-700">{h.symbol}</p>
                      {h.description && (
                        <p className="text-xs text-slate-400 truncate">{h.description}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0 pl-3">
                      <p className="text-slate-700">{formatCurrency(h.market_value)}</p>
                      <p className="text-xs text-slate-400">{h.quantity} sh</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400">
                {asOfDate ? 'All cash, no positions.' : 'Waiting on the next sync.'}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
