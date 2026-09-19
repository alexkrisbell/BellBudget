# CLAUDE.md — Bell Bucks

## 1. Product Vision

**Bell Bucks is the budgeting app built for couples who manage their money together.**

Most budgeting apps are single-user accounting software with "household sharing" bolted on afterward. Bell Bucks is built the other way around: a shared financial dashboard from day one, designed to answer the questions couples actually ask each other, in plain language:

* "Can we afford this?"
* "How much can we spend this weekend?"
* "Are we overspending on restaurants?"
* "How much did we invest this month?" *(active work — see §6)*
* "How much money can we safely move into savings?"
* "What bills are coming up?"

It should feel like **a shared control panel for a household's money** — not a ledger, not accounting software, not a spreadsheet replacement. If a feature makes it feel more like the latter, it's probably the wrong feature.

**North Star:** Bell Bucks should make couples feel confident about where their money is going and what they can safely do with it next. Most budgeting apps stop at "you spent $1,247 on restaurants." Bell Bucks should get to "you have $1,850 available after your upcoming bills, budget, and savings target." The second one is a decision a couple can act on; the first is just a fact.

**Hard rule:** every major feature must help answer one of the six questions above. If it doesn't, it needs a very good reason to exist.

---

## 2. Who It's For

* Couples and households who want one shared view of their finances instead of two separate mental models.
* Each household is its own private, isolated workspace — "shared" means shared *within* a household, never across households. A household can be two people or more (roommates, family), but the couples use case is the primary design target.
* Right now: the founder's own household plus a small circle of friends/family testing it. **Onboarding new strangers is paused** (see §6) — not because the app isn't ready in a technical sense, but because the founder concluded it doesn't yet fully deliver on its own founding purpose without investment accounts. Friends/family testing continues; it's serving a different job now (find what's missing) than growth.

---

## 3. Design Philosophy

* **Don't over-engineer.** Prefer the simplest implementation that's correct. Three similar lines beat a premature abstraction. This has been the single most-repeated correction across this project's history — keep defaulting to it.
* **One source of truth for money math.** Category totals, income classification, and similar calculations must live in exactly one shared function, called from every place that needs them (dashboard, budget page, notifications, stats). This project has shipped three separate real bugs from the same logic existing in two places at once — never again.
* Minimal, clean, fast-loading. White/light background, soft neutral colors, simple typography.
* Progress bars and simple charts over complex ones. No chart, graph, or feature earns a place just because it's possible to build.
* Mobile-responsive by default, not as an afterthought — most real usage is on a phone. Keep the bottom nav to 5 items or fewer; it visibly breaks past that on a real phone screen.
* If a feature adds complexity without clarity → do not add it.

---

## 4. Product Guardrails

Bell Bucks should **not** become:

* a bank or brokerage
* a tax platform
* a credit-monitoring service
* an accounting platform (double-entry ledgers, invoicing, etc.)
* a financial marketplace (comparing/selling other products)
* a social network (no feeds, no comparing yourself to other households)
* an investment-*trading* platform — tracking investments is on the roadmap; executing trades is not

When evaluating a new feature, prioritize **user clarity, frequency of use, and alignment with the couple/household mission** over technical novelty or "wouldn't it be cool if." A feature that's impressive to build and rarely opened is a bad trade.

Any feature that produces a confident-looking number a couple would act on (a spending limit, a "safe to move" amount, anything in that shape) must show its reasoning, never just the bare number, and round conservative rather than optimistic. A wrong number damages trust worse than not having the feature at all.

**The feature test — answer all six before building anything new:**

1. What user question does this answer? (Ideally one of the six in §1.)
2. Is that question important enough that someone actually cares?
3. How often will a household realistically use it?
4. Does it make the household's financial picture *clearer*, not just more detailed?
5. Does it increase trust, or does it risk breaking it?
6. Can it be built without introducing unnecessary complexity?

If the answers aren't clearly good, don't build it yet.

---

## 5. Current State — What's Built

This list is deliberately high-level. For exact schema, routes, or implementation, read the code — `supabase/migrations/` and `app/api/` are the source of truth, not this file. Keeping a hand-maintained schema/API list here was tried and abandoned; it went stale within weeks.

* **Accounts**: Plaid-connected checking, savings, credit, loan, and investment accounts, auto-synced daily plus real-time via webhook (webhook signatures verified). Guardrails against runaway account connections (a household cap and a rate limit) are in place ahead of any paid Plaid tier.
* **Transactions**: full sync from Plaid, AI-assisted categorization with rule-learning from manual overrides, and the ability to split a single transaction across multiple categories.
* **Budgeting**: monthly budget templates, copy-from-previous-month, planned vs. actual per category with visual progress indicators.
* **Dashboard**: at-a-glance monthly snapshot — budget overview, category progress, income summary, streak status. Deliberately kept lean; features get added here only when they're a daily-glance concern (recurring bills and net worth live on the Stats page instead, not here, because they're periodic insights, not daily ones).
* **Stats & Insights**: net worth trend (assets minus liabilities, tracked via daily balance snapshots), monthly saved/spent trends, recurring bill detection (flags subscriptions from transaction patterns).
* **Notifications**: in-app alerts for budget thresholds, paychecks, sync failures, and reconnect-required accounts.
* **Streaks**: monthly gamification for staying within budget.
* **Multi-household**: fully self-service — anyone can sign up and create their own isolated household today; invites bring a second person into an existing one. This was already true before it was ever asked for, which is worth remembering next time "does this scale to more users" comes up.
* **Quality/reliability**: automated tests around the money-math logic (category actuals, income resolution, split validation, net worth, recurring-bill detection), Sentry error tracking, RLS on every table.

This is a genuinely complete MVP, not a work-in-progress. The next phase is **product refinement and validation**, not feature accumulation.

---

## 6. Roadmap & Milestones

### Two kinds of validation — don't confuse them

*External validation* (would strangers want this) and *founder validation* (does this serve the household it was actually built for) are different kinds of evidence, and this project uses both, deliberately, for different decisions:

* The Feature Test (§4) and the "don't build on assumption" rule below are about **external validation** — they exist to stop guessing what strangers want instead of asking them.
* Investment tracking (below) is being built on **founder validation** instead — not "strangers demanded it," but "the founder's own stated reason for building Bell Bucks (one shared financial picture with his wife) isn't met without it," since the majority of his money lives in an account Bell Bucks can't see. That's a legitimate, different reason to build something, and it doesn't weaken the external-validation rule for stranger-facing features — it just doesn't apply here, because the user in question is already known and already validated (Milestone 1).

### Phase 1 — Ready for a stranger's first look ✅ Done

1. ✅ **A real landing page at `/`.**
2. ✅ **Self-service account deletion**, in Settings → Danger Zone.
3. ✅ **A feedback channel** — "Send Feedback" in the account menu.

### Rejected: "Safe-to-Spend" / "Safe-to-Save"

Both were seriously considered and cut — worth recording why, since it's the Feature Test in §4 actually working. `total_remaining` on the Budget page already nets planned-but-unpaid bills against spending (if rent has a line item, it's already subtracted from "remaining" before it's even paid), and per-category planned-vs-actual already answers "are we overspending on X." A dedicated Safe-to-Spend/Save calculation would have been mostly redundant with math the app already surfaces, validated against real monthly usage rather than guessed at. **Don't re-propose these** without a specific, concrete gap that remaining-budget and net-worth-trend genuinely don't cover (e.g., cash-flow *timing* within the month, not just monthly totals) — and get that gap from a real user, not a brainstorm.

### Active — Investment tracking

Schwab's Individual Trader API was previously scoped as the likely path (self-service approval, built for exactly this "connect your own accounts" use case, ~120 req/min rate limit) — revisit that research when starting real implementation work.

Once this exists, **merge the Stats page into it** rather than keeping two destinations — a net worth trend and an investment balance are the same kind of number, and Stats was already flagged as maybe not pulling its weight as its own nav item. Don't build the merged page speculatively ahead of the Schwab work landing; do it as part of the same effort, not before.

### Paused — Get it in front of real strangers

*(Previously "Phase 2." Paused, not abandoned — resume when the founder decides Bell Bucks is ready to represent his own finances well, not on a timer.)*

1. Get 5–10 real non-family households using it (see Milestones below).
2. Let *their* feedback — not another brainstorm — decide what's actually missing beyond investment tracking.

### Milestones (replaces "launch" as the goal)

1. ✅ The founder's household uses it every month. *(True, but see the note above — "uses it" and "it covers our actual finances" turned out to be different bars.)*
2. 20 strangers use it for 60 days. *(Paused — see above.)*
3. 10 strangers say they'd be genuinely upset if it disappeared.
4. 5–10 strangers voluntarily offer to pay for it.
5. 100 households pay.

Each milestone is a gate, not a deadline. Don't move to monetization work (§7) before milestone 4 has real signal, not just a hope.

---

## 7. Path to Monetization (Later — Not Now)

Recorded here so the intent isn't lost, but explicitly **not** current work — gated on the milestones in §6, not a calendar date. In order:

1. **Validate** — milestones 2-4 above, before building anything below.
2. **Business & legal foundation** — LLC, EIN, business bank account, a real (eventually lawyer-reviewed) ToS/Privacy Policy, Stripe.
3. **Plaid production upgrade** — a genuine Commercial/Production application (not the personal Trial/Pay-as-you-go tier), with a real cost quote at target scale before picking a price.
4. **Product readiness** — subscription billing and plan-gating in-app, a security review, Phase 1 of §6 done.
5. **Soft launch** — a small paid beta, real unit economics (cost per household vs. revenue per household) before spending on growth.
6. **Scale** — marketing, SEO, possibly a native app. Not a near-term concern.

The target model is subscription (Plaid is a recurring per-account cost, so revenue has to be recurring too), in the neighborhood of what Monarch Money / Copilot Money / YNAB charge (~$8–15/month) — Monarch in particular is the closest positioning competitor (couples/family-first) and worth watching, not copying. This can be a lean, profitable side business without needing to be a venture-scale company — that's a fine outcome, not a consolation prize.

---

## 8. Tech Stack

* **Frontend**: Next.js (App Router), TailwindCSS, Zustand + React Query
* **Backend**: Supabase (Postgres, Auth, Row-Level Security)
* **APIs**: Plaid (financial data), OpenAI (categorization fallback)
* **Testing**: Vitest, focused on the money-math logic in `lib/`
* **Monitoring**: Sentry
* **Hosting**: Vercel

---

## 9. Security Principles

* Plaid tokenization only — bank credentials are never stored, ever.
* Plaid access tokens live in Supabase Vault, not in plaintext columns.
* Row-Level Security on every table; a household can only ever see its own data.
* Webhook signatures are verified, not assumed.
* HTTPS required everywhere.
* Revisit this section for a real security review before charging strangers (see §7, phase 4) — reasonable today for a small trusted group is not the same bar as reasonable for the public internet.

---

## 10. Notes for AI Coding Assistant

* Prefer simple implementations over complex abstractions. Avoid over-engineering — this is the philosophy this project cares about most.
* Before proposing or building a new feature, run it through the feature test in §4. If it doesn't clearly pass, say so instead of building it anyway.
* When touching money math (category totals, income/expense classification, budget calculations), check whether the logic already exists elsewhere first. Duplicated money math is this project's most common source of real bugs.
* Add tests for new money-math logic in `lib/` — extract pure functions out of API routes/DB-calling code specifically so they're testable, the way `categoryActuals`, `transactionSplits`, and the dashboard/stats compute modules already do.
* Always design mobile-responsive first, not as an afterthought. Keep the bottom nav lean — it breaks visually past 5 items.
* Prioritize UX clarity over feature depth. A feature that needs an explanation is a feature that needs a redesign.
* This app is on a Next.js version recent enough to have real breaking changes from training data — see `budget-app/AGENTS.md` before touching routing, middleware, or instrumentation.
* Keep this file itself lean. Don't hand-maintain schema or API endpoint lists here — they go stale immediately and the code is always the real source of truth. This file is for vision, priorities, and durable principles, not implementation detail.
