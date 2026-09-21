# PULSE — Launch Build 1

This build is the production-readiness pass applied to the supplied PULSE codebase.

## Changes completed

- Added a real Supabase password-reset request flow from the login screen.
- Added `/reset-password` so Supabase recovery links can set a new password.
- Added server-side password update support through the existing auth provider.
- Cleared existing TypeScript/lint errors found during the launch audit.
- Fixed Stripe billing-summary typing so invoice mapping is type-safe.
- Fixed Stripe webhook signature construction.
- Fixed webhook-intake const correctness.
- Removed unused code/imports that were blocking a clean lint run.
- Preserved the existing application architecture, Supabase integration, billing system, AI functions, integrations, and Decision OS features.

## Validation

- `npm run typecheck` — PASS
- `npm run lint` — PASS with existing React Hook/Fast Refresh warnings only
- `npm run build` could not be completed in the audit container because the ZIP's copied `node_modules` is missing Rollup's Linux optional native package. This is an environment/dependency-install issue, not a TypeScript failure. On a normal clean install, run `npm ci` and then `npm run build`.

## Important: install dependencies fresh

Do not upload the supplied `node_modules` folder. It is intentionally excluded from the launch ZIP.

Run:

```bash
npm ci
npm run typecheck
npm run lint
npm run build
```

## Supabase production order

1. Create/open your production Supabase project.
2. In Supabase SQL Editor, run `schema.sql` once for the base schema.
3. Apply the files in `supabase/migrations/` in filename order:
   - `20260911_decision_intelligence.sql`
   - `20260912_subscription_entitlements.sql`
   - `20260913_execution_engine_v2.sql`
   - `20260914_server_usage_enforcement.sql`
   - `phase4_monetization.sql`
4. Deploy the Edge Functions in `supabase/functions/`.
5. Add server-side secrets from `env.example` in Supabase Edge Function secrets.
6. Configure Auth email URLs and OAuth redirect URLs for the production domain.
7. Create/configure Stripe products and prices and set the Stripe webhook to the deployed `stripe-webhook` function.

If your production database already contains any of these migrations, do not run the same SQL twice; verify the applied migration/state first.

## Frontend deployment

Vercel is the recommended first deployment target for the Vite web app.

Set these public frontend variables in Vercel:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
VITE_SUPPORT_EMAIL=support@YOUR_DOMAIN
```

Never put these in Vite/frontend variables:

- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`
- OAuth client secrets

Those belong in Supabase Edge Function secrets or the appropriate server-side environment.

## GitHub push

From the project root:

```bash
git init
git add .
git commit -m "PULSE launch build 1"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

If the repository already exists, skip `git init` and `git remote add` and simply run:

```bash
git add .
git commit -m "PULSE launch build 1"
git push
```

## Before public launch

Complete one real production smoke test with a fresh account:

1. Sign up and confirm email.
2. Create workspace.
3. Create discussion and message.
4. Create poll and cast a vote.
5. Create decision and open Decision Room.
6. Add an execution action and complete it.
7. Run AI only after the AI secret is configured.
8. Invite a second account and verify permissions.
9. Test password reset.
10. Test Stripe checkout/webhook and plan limits.
11. Test account deletion.
12. Test mobile/PWA and the production domain.

Do not advertise paid plans until Stripe webhook + entitlement enforcement has been tested with a real test-mode transaction.
