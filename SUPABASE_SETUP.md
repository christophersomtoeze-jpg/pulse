# PULSE Supabase setup

1. Create a Supabase project.
2. Open SQL Editor and run `schema.sql` (it's at the project root, not under a supabase/ folder).
3. In Authentication > URL Configuration, add your Render URL as the Site URL and add your local URL to Redirect URLs.
4. Copy the project URL and anon/publishable key into Render environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Redeploy PULSE on Render.

Never put a Supabase service-role key in this React app or in GitHub.


## Team & Workspace upgrade
Run the updated `schema.sql` in Supabase SQL Editor. This adds workspace invitations, profile emails, role management, and an atomic workspace creation RPC. After applying it, the Team button in PULSE opens the real member manager. Existing users may need a fresh login/signup to populate the new profile email field.

## Phase 3/4 — Actions, Search, AI Assistant, Meeting Summaries, Risk Center
Run the latest `schema.sql` (it's additive — safe to re-run). Then deploy the two new AI functions, same pattern as ai-decision-summary:

```bash
supabase functions deploy pulse-assistant
supabase functions deploy meeting-summary
# ANTHROPIC_API_KEY is shared across all three AI functions — skip this if you already set it
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

Global search, decision-history search, the Actions/Tasks board, and Risk Center need no extra setup — they're plain Supabase queries against `schema.sql`.

## Phase 5 — Multi-workspace, Audit Log, Analytics, Billing
Multi-workspace switching, the audit log, and analytics all work as soon as `schema.sql` is applied — no extra config.

Billing is inert until you connect your own Stripe account:
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set STRIPE_PRICE_PRO=price_...
supabase secrets set STRIPE_PRICE_BUSINESS=price_...
supabase functions deploy stripe-checkout
supabase functions deploy stripe-webhook --no-verify-jwt
```
Get the secret key from Stripe Dashboard > Developers > API keys, the price IDs from Products > (your product), and add a webhook endpoint at Developers > Webhooks pointing to `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`, listening for `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.

Until these are set, the "Upgrade" buttons in Settings > Billing show a clear error instead of silently failing.

## Phase 6 — Slack (fully wired) + the integrations framework
Slack is the one integration that's completely built end-to-end. To activate it:

1. Create an app at https://api.slack.com/apps
2. Under **OAuth & Permissions**, add this redirect URL: `https://<project-ref>.supabase.co/functions/v1/slack-oauth-callback`
3. Under **Event Subscriptions**, enable events and set the request URL to `https://<project-ref>.supabase.co/functions/v1/slack-events` (Slack will verify this URL automatically once the function is deployed)
4. Subscribe to the `message.channels` bot event
5. Copy the Client ID, Client Secret, and Signing Secret from **Basic Information**

```bash
supabase secrets set SLACK_CLIENT_ID=...
supabase secrets set SLACK_CLIENT_SECRET=...
supabase secrets set SLACK_SIGNING_SECRET=...
supabase functions deploy slack-oauth-callback --no-verify-jwt
supabase functions deploy slack-events --no-verify-jwt
```

Also add to Render's environment variables: `VITE_SLACK_CLIENT_ID` (same value as `SLACK_CLIENT_ID`).

Teams, Google, Microsoft 365, Jira, and Notion are **not** built yet — they show "Not yet built" in the Integrations screen rather than a fake "Connect" button. Each would need its own OAuth app registration exactly like Slack's above, plus a dedicated edge function for its API. Ask for any of these by name when you're ready and it can be built as a real, working integration the same way Slack was.

## Security note on integration tokens
`workspace_integrations.access_token` is currently stored in plaintext in Postgres. Before connecting a real Slack workspace (or any future integration) in production, move this column to use Supabase Vault (pgsodium) so tokens are encrypted at rest. This wasn't set up here because it requires an extra one-time `vault` extension setup step in your specific project — flagging it explicitly rather than silently shipping plaintext secrets.
