# Phase 4 — Monetization

## What is included

### 1. Stripe subscription plans
- **Free** — default
- **Starter** — small teams
- **Pro** — growth teams
- **Business** — larger orgs / SSO-ready tier
- Checkout edge function supports `starter | pro | business`
- Webhook sets the correct plan from price ID + metadata

### 2. Plan limits enforcement
| Plan | Seats | AI credits / month | History depth |
|------|------:|-------------------:|--------------:|
| Free | 3 | 20 | 30 days |
| Starter | 10 | 100 | 90 days |
| Pro | 50 | 500 | 365 days |
| Business | 500 | 2000 | ~10 years |

- Invites blocked when seat limit reached (`assertCanInvite` / `inviteToWorkspace`)
- AI gated via `consume_ai_credit` RPC + `consumeAiCredit()` client helper

### 3. Usage-based AI credits
- Table: `workspace_ai_credits`
- Monthly allowance resets each period
- `consume_ai_credit(workspace_id, cost)` returns false when over limit
- Webhook tops up allowance on plan change

### 4. Customer portal
- Edge function: `stripe-portal`
- Billing panel button: **Manage subscription & invoices**
- Change card, download invoices, cancel / switch plans in Stripe-hosted UI

### 5. Upgrade / downgrade flows
- Upgrade: Checkout session for Starter / Pro / Business
- Manage / downgrade / cancel: Customer Portal
- Webhook keeps `workspace_subscriptions` + AI credits in sync

---

## Activate on your project

1. Run SQL migration:
   ```bash
   # or paste in Supabase SQL Editor
   supabase/migrations/phase4_monetization.sql
   ```

2. Create Stripe products/prices for Starter, Pro, Business

3. Set secrets:
   ```bash
   supabase secrets set STRIPE_SECRET_KEY=sk_...
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   supabase secrets set STRIPE_PRICE_STARTER=price_...
   supabase secrets set STRIPE_PRICE_PRO=price_...
   supabase secrets set STRIPE_PRICE_BUSINESS=price_...
   ```

4. Deploy functions:
   ```bash
   supabase functions deploy stripe-checkout
   supabase functions deploy stripe-webhook --no-verify-jwt
   supabase functions deploy stripe-portal
   ```

5. Stripe webhook URL:
   `https://YOUR_REF.supabase.co/functions/v1/stripe-webhook`  
   Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

6. Enable Customer Portal in Stripe Dashboard → Settings → Billing → Customer portal

---

## In-app usage

- **Settings → Billing** — current plan, seat/AI usage meters, upgrade cards, portal button
- **Invitations** — blocked with clear error when seats full
- Call `consumeAiCredit(workspaceId)` before AI summary / intelligence requests

---

## Verify

1. As admin, upgrade Free → Starter (test mode)
2. Confirm plan + AI allowance after webhook
3. Invite until seat limit → error
4. Open **Manage subscription & invoices** → portal loads
5. Cancel or change plan in portal → webhook updates app

---

Next: **Phase 5 — Intelligence layer** (decision quality scores, patterns, predictive risk).
