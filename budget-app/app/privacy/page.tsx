import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy — Bell Bucks',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-100 p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Privacy Policy</h1>
          <p className="text-sm text-slate-400 mt-1">Last updated September 2026</p>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed">
          Bell Bucks is a small, independently-run budgeting app built for personal and
          household use. This page explains what data the app collects and how it&apos;s used.
        </p>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-slate-800">What we collect</h2>
          <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
            <li>Your name and email address, for your account.</li>
            <li>
              Bank and credit card account and transaction data, via{' '}
              <a href="https://plaid.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                Plaid
              </a>{' '}
              — balances, transaction amounts, dates, and merchant names. We never see or
              store your bank login credentials; Plaid handles that connection directly, and
              your bank access token is encrypted at rest.
            </li>
            <li>
              Transaction merchant names may be sent to OpenAI to help automatically
              categorize spending (e.g. recognizing &quot;HEB&quot; as Groceries).
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-slate-800">How it&apos;s used</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Your financial data is used only to power your own budgeting dashboard and is
            visible only to you and the other members of your household. We don&apos;t sell
            data, share it with advertisers, or use it for anything beyond running the app.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-slate-800">Who can see your data</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Only members of your own household (people you&apos;ve explicitly invited) can see
            your household&apos;s accounts, transactions, and budget. Separate households are
            fully isolated from each other.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-slate-800">Deleting your data</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            You can delete your account at any time from Settings → Danger Zone. If
            you&apos;re the only member of your household, this permanently deletes the
            household and everything in it — connected accounts, transactions, and
            budgets. If your household has other members, only your own account is
            removed and their data stays intact. Either way, connected bank accounts are
            properly disconnected from Plaid, not just hidden. This can&apos;t be undone.
            You can also email{' '}
            <a href="mailto:alexkrisbell@gmail.com" className="text-indigo-600 hover:underline">
              alexkrisbell@gmail.com
            </a>{' '}
            if you&apos;d rather have it done for you.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-slate-800">Questions</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            This is a personal project, not a company. If you have questions about your data,
            reach out to{' '}
            <a href="mailto:alexkrisbell@gmail.com" className="text-indigo-600 hover:underline">
              alexkrisbell@gmail.com
            </a>
            .
          </p>
        </section>

        <div className="pt-4 border-t border-slate-100">
          <Link href="/login" className="text-sm text-indigo-600 hover:underline font-medium">
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
