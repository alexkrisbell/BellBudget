# Claude.md — Budgeting App (Family Finance Dashboard)

## 1. Product Overview

This application is a **minimal, clean budgeting and spending tracker** designed for **shared household use (husband + wife)**.

Core goals:

* Track all spending automatically from bank + credit card accounts
* Compare real spending vs planned monthly budget
* Provide a simple, visual dashboard of financial health
* Encourage consistency through a **monthly streak system**

This is NOT a complex finance app — it should feel:

* fast
* clean
* minimal
* intuitive

---

## 2. Core Features (MVP)

### 2.1 Account Aggregation

* Connect:

  * Credit cards (multiple users)
  * Checking accounts
  * Savings accounts
* Use **Plaid API** for seamless integration
* Auto-sync transactions daily

---

### 2.2 Transaction System

Each transaction includes:

* amount
* merchant name
* date
* account
* category
* user (optional: who spent it)

---

### 2.3 Smart Categorization

* Default: AI-powered categorization
* Fallback: rule-based categorization

Examples:

* "HEB" → Groceries
* "Shell" → Fuel

User capabilities:

* manually override category
* system learns from overrides (store rules)

---

### 2.4 Budget Planning (Monthly Template System)

* Each month is based on a **template**
* Users can:

  * create categories
  * assign planned spending amounts
  * edit per month

Example categories:

* Rent
* Groceries
* Utilities
* Fun
* Travel
* Car

---

### 2.5 Dashboard (Primary Screen)

Display:

* total monthly budget
* total spent
* remaining budget
* category progress bars

Each category:

* planned amount
* actual spending
* % used
* color indicators:

  * green (<80%)
  * yellow (80–100%)
  * red (>100%)

---

### 2.6 Alerts / Notifications

* Category hits 80%
* Budget exceeded
* Paycheck deposited

Delivery:

* in-app notifications (MVP)
* email (optional later)
* push (future mobile)

---

### 2.7 Income Tracking + Prediction

* Track income sources
* Detect recurring deposits
* Predict monthly income

Display:

* expected income vs actual

---

### 2.8 Savings Behavior Logic

At end of month:

* leftover money → marked as "saved/invested"

---

### 2.9 Streak System (Gamification)

* If user stays within total budget → streak +1 month
* If over budget → streak resets

Display prominently:

* "3 Month Streak 🔥"

---

### 2.10 Multi-User Household

* Shared workspace
* Two users (expandable later)
* Shared budgets + transactions

---

## 3. UX / UI Principles

Design must be:

* minimal
* clean
* no clutter
* fast-loading

Style:

* white/light background
* soft neutral colors
* simple typography
* no unnecessary charts

Primary UI:

* progress bars > complex graphs

---

## 4. Recommended Tech Stack

### Frontend

* Next.js (React)
* TailwindCSS
* Zustand or React Context (state)

### Backend

* Supabase:

  * PostgreSQL database
  * Auth
  * Row-level security
  * Realtime subscriptions

### APIs

* Plaid → financial data
* OpenAI API → categorization fallback

---

## 5. Database Schema (Simplified)

### Users

* id
* email
* name

### Households

* id
* name

### HouseholdMembers

* id
* user_id
* household_id

### Accounts

* id
* household_id
* plaid_account_id
* name
* type

### Transactions

* id
* account_id
* amount
* merchant
* date
* category_id
* user_id

### Categories

* id
* household_id
* name

### Budgets

* id
* household_id
* month
* year

### BudgetItems

* id
* budget_id
* category_id
* planned_amount

### Income

* id
* household_id
* amount
* source
* date

### Streaks

* household_id
* current_streak

### Rules (for categorization)

* id
* merchant_keyword
* category_id

---

## 6. Core API Endpoints

* POST /connect-bank (Plaid link)
* GET /transactions
* POST /transactions/update-category
* GET /budget
* POST /budget/update
* GET /dashboard
* GET /income
* GET /streak

---

## 7. Security Requirements

* Use Plaid tokenization (never store bank credentials)
* Encrypt sensitive data
* Use Supabase Auth (JWT)
* Row-Level Security:

  * users only access their household data
* HTTPS required

---

## 8. Development Phases

### Phase 1 (MVP)

* Auth
* Plaid integration
* Transactions display
* Categories
* Budget creation
* Dashboard

### Phase 2

* AI categorization
* rule learning
* notifications
* streak system

### Phase 3

* income prediction
* mobile app (React Native)
* push notifications

---

## 9. Future Features (Not Now)

* savings goals
* bill detection
* subscriptions tracking
* investment tracking
* advanced analytics

---

## 10. Key Design Philosophy

This app should feel like:

* a **simple control panel for your money**
* not an overwhelming finance tool

If a feature adds complexity without clarity → DO NOT ADD IT.

---

## 11. Success Criteria

* User can connect accounts in <2 minutes
* User understands financial status in <10 seconds
* Zero manual transaction entry required
* Budget vs actual always clear

---

## 12. Notes for AI Coding Assistant

* Prefer simple implementations over complex abstractions
* Avoid over-engineering
* Keep components modular
* Prioritize UX clarity over feature depth
* Always design mobile-responsive even for web MVP

---
