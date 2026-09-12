# PULSE Billing & Monetization Build

- Built from the user-provided `PULSE(2).zip` source of truth.
- Added a fuller Billing UI with plan cards, subscription status, renewal/cancellation state, past-due notice, Stripe checkout actions, and Billing Portal access.
- Added `stripe-billing-portal` Supabase Edge Function.
- Hardened `stripe-checkout` with admin/owner authorization, stable app URL support, customer email, plan/workspace metadata, and safe method checks.
- Hardened `stripe-webhook` to sync Pro/Business plans from Stripe metadata and handle subscription lifecycle events.
- Added Stripe setup/deploy instructions to `SUPABASE_SETUP.md`.
- Frontend `npm run typecheck`: PASS.
- `npm run build` could not complete in this Linux validation environment because the ZIP's Windows-installed Rollup optional binary is not present (`@rollup/rollup-linux-x64-gnu`). Run `npm install` and `npm run build` on the Windows PULSE machine before deployment.
- No secrets or `.env` values are included.
