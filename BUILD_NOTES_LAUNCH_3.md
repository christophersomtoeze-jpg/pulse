# PULSE Launch Build 3 — Production Readiness

## What changed

- Added the missing root `schema.sql` to the launch package so the database setup is self-contained.
- Added `supabase/migrations/20260916_production_billing_reliability.sql`.
- Stripe webhook processing now distinguishes `processing`, `processed`, and `failed` events and can retry failed events.
- Stripe webhook signature verification accepts any valid `v1` signature in a rotated signature header.
- Stripe Checkout redirects use the configured `APP_URL` when available instead of trusting an arbitrary request origin.
- Added Vercel SPA routing and baseline security headers in `vercel.json`.

## Database order

1. `schema.sql`
2. `supabase/migrations/phase4_monetization.sql`
3. `supabase/migrations/20260911_decision_intelligence.sql`
4. `supabase/migrations/20260912_subscription_entitlements.sql`
5. `supabase/migrations/20260913_execution_engine_v2.sql`
6. `supabase/migrations/20260914_server_usage_enforcement.sql`
7. `supabase/migrations/20260915_launch_hardening.sql`
8. `supabase/migrations/20260916_production_billing_reliability.sql`

Run each file in Supabase SQL Editor in this order. Stop on the first SQL error and resolve it before continuing.

## Build verification

```bash
npm ci
npm run typecheck
npm run lint
npm run build
node scripts/verify-production.mjs
```

## Production frontend variables

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (or `VITE_SUPABASE_PUBLISHABLE_KEY`)

## Supabase Edge Function secrets

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_BUSINESS`
- `APP_URL`

Keep server secrets out of Git and frontend JavaScript.
