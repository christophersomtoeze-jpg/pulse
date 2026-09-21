# PULSE — Launch Build 2

Launch Build 2 hardens the production connection layer without changing the core Decision OS UX.

## Included

- Stripe Checkout now requires workspace owner/admin authorization server-side.
- Stripe webhook processing is idempotent using `public.stripe_webhook_events`.
- Added migration `supabase/migrations/20260915_launch_hardening.sql`.
- Added `scripts/verify-production.mjs` for local pre-deployment checks.

## 1. Install and verify

```bash
npm ci
npm run typecheck
npm run lint
npm run build
node scripts/verify-production.mjs
```

## 2. Apply Supabase SQL

Run the migrations in this order after `schema.sql`:

1. `supabase/migrations/phase4_monetization.sql`
2. `supabase/migrations/20260911_decision_intelligence.sql`
3. `supabase/migrations/20260912_subscription_entitlements.sql`
4. `supabase/migrations/20260913_execution_engine_v2.sql`
5. `supabase/migrations/20260914_server_usage_enforcement.sql`
6. `supabase/migrations/20260915_launch_hardening.sql`

If using Supabase CLI, prefer your normal linked-project migration workflow rather than manually copying individual statements.

## 3. Deploy Edge Functions

```bash
supabase functions deploy stripe-checkout
supabase functions deploy stripe-webhook
supabase functions deploy stripe-portal
supabase functions deploy stripe-billing-summary
```

Deploy the remaining PULSE functions from `supabase/functions/` using the same method.

## 4. Server secrets

Set these in Supabase Edge Function secrets, never in frontend code:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_BUSINESS`
- AI provider secret(s), if enabled

## 5. Stripe webhook

Point the Stripe webhook endpoint to:

`https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`

At minimum, enable:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copy the endpoint signing secret into `STRIPE_WEBHOOK_SECRET`.

## 6. Frontend/Vercel

Set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (or `VITE_SUPABASE_PUBLISHABLE_KEY`)
- `VITE_SUPPORT_EMAIL` (optional)

Then deploy the repository to Vercel.

## 7. Required live tests

- New signup + email confirmation
- Login/logout
- Password reset
- Create workspace
- Invite a member
- Member cannot open billing checkout
- Owner/admin can open billing checkout
- Successful Stripe checkout activates the subscription through the webhook
- Re-delivered Stripe event is ignored safely
- Stripe portal opens for owner/admin
- AI usage is rejected after server-side entitlement limit
- Mobile/PWA smoke test

Do not consider PULSE production-ready until these live tests pass against the production Supabase project.
