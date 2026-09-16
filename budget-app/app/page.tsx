import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  description: 'The budgeting app built for couples who manage their money together.',
}

// Middleware (lib/supabase/proxy.ts) redirects authenticated users away from
// '/' to /dashboard before this ever renders, so this is unauthenticated-only.

const QUESTIONS = [
  {
    icon: '🛒',
    question: 'Can we afford this?',
    answer: 'See what’s left in your budget — overall and per category — before you say yes.',
  },
  {
    icon: '🍽️',
    question: 'Are we overspending on restaurants?',
    answer: 'Every category shows planned vs. actual at a glance, so the answer is never a guess.',
  },
  {
    icon: '💵',
    question: 'How much can we safely save?',
    answer: 'Your remaining budget already accounts for bills you haven’t paid yet, not just ones you have.',
  },
  {
    icon: '🔁',
    question: 'What bills are coming up?',
    answer: 'Bell Bucks spots recurring charges automatically and flags what’s due next.',
  },
  {
    icon: '📈',
    question: 'How is our net worth trending?',
    answer: 'Every connected account, tracked over time — assets and debts, in one number.',
  },
]

const STEPS = [
  {
    title: 'Connect your accounts',
    body: 'Securely link checking, savings, and credit cards — Bell Bucks never sees your bank login.',
  },
  {
    title: 'Spending sorts itself',
    body: 'Transactions are categorized automatically, and it learns from you when you fix one.',
  },
  {
    title: 'See it together',
    body: 'One shared dashboard for your household — no spreadsheets, no separate mental math.',
  },
]

export default function RootPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <header className="bg-[#0D321C]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
          <Image
            src="/Icon-192.png"
            width={56}
            height={56}
            alt=""
            className="rounded-xl mx-auto mb-6"
          />
          <h1 className="text-3xl sm:text-5xl font-bold text-white tracking-tight">
            Bell Bucks
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-white/80 max-w-xl mx-auto">
            The budgeting app built for couples who manage their money together.
          </p>
          <p className="mt-3 text-sm sm:text-base text-white/50 max-w-lg mx-auto">
            Not a ledger. Not accounting software. A shared control panel for your
            household&apos;s money.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-6 py-3 rounded-lg text-sm font-semibold bg-[#FBC64F] text-[#0D321C] hover:opacity-90 transition-opacity"
            >
              Get started
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-6 py-3 rounded-lg text-sm font-semibold text-white border border-white/20 hover:bg-white/10 transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      {/* Questions it answers */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <h2 className="text-xl sm:text-2xl font-semibold text-slate-800 text-center">
          Built around the questions couples actually ask each other
        </h2>
        <div className="mt-10 grid sm:grid-cols-2 gap-5">
          {QUESTIONS.map((q) => (
            <div
              key={q.question}
              className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none shrink-0">{q.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{q.question}</p>
                  <p className="text-sm text-slate-500 mt-1 leading-relaxed">{q.answer}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-slate-50 border-y border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-800 text-center">
            How it works
          </h2>
          <div className="mt-10 grid sm:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <div key={step.title} className="text-center">
                <div className="mx-auto size-9 rounded-full bg-[#0D321C] text-[#FBC64F] flex items-center justify-center text-sm font-bold">
                  {i + 1}
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-800">{step.title}</p>
                <p className="mt-1 text-sm text-slate-500 leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
        <h2 className="text-xl sm:text-2xl font-semibold text-slate-800">
          Ready to see your money together?
        </h2>
        <div className="mt-6">
          <Link
            href="/signup"
            className="inline-block px-6 py-3 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            Create your household
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-400">
          <p>Bell Bucks is an independently-run personal project, not a company.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-slate-600">Privacy</Link>
            <a href="mailto:alexkrisbell@gmail.com" className="hover:text-slate-600">Contact</a>
            <Link href="/login" className="hover:text-slate-600">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
