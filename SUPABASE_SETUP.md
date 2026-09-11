# PULSE Supabase setup

1. Create a Supabase project.
2. Open SQL Editor and run `schema.sql` (it's at the project root, not under a supabase/ folder).
3. In Authentication > URL Configuration, add your Render URL as the Site URL and add your local URL to Redirect URLs.
4. Copy the project URL and anon/publishable key into Render environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
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

## Phase 6 — Real integrations
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

Google Workspace, Microsoft 365 + Teams, Jira, Notion, and Slack now have real connection code in this ZIP. They are **not live until you create the provider app/token and configure the required Supabase/Render secrets**. The Integrations screen intentionally shows a provider as connected only after a successful OAuth/token verification writes a connected row to Supabase.

## Security note on integration tokens
`workspace_integrations.access_token` is currently stored in plaintext in Postgres. **Do not treat this as production-ready for real customer workspaces yet.** Before launch, move provider tokens to Supabase Vault/another approved secret-encryption design, rotate any credentials used during testing, and audit every integration RLS path.

## Founder Metrics (Platform Metrics in the sidebar)
This is visible only to you, never to workspace members. After running the latest `schema.sql`, make yourself a platform admin (run once, in SQL Editor, replacing the email):
```sql
insert into public.platform_admins (user_id)
select id from public.profiles where email = 'you@yourcompany.com';
```
"Platform Metrics" then appears at the bottom of your sidebar with real cross-workspace numbers (total workspaces, weekly active users, decisions/votes in the last 7-30 days) — the traction data investor conversations actually need.

## Legal pages
`/terms` and `/privacy` are now real pages, linked from the login screen. They're generic starter templates (clearly marked as such in the page) — have a lawyer review and customize them, especially the data-sharing section, before treating them as your real policies.

## Onboarding
Every new workspace now seeds a "Welcome to PULSE" discussion and a sample decision automatically — no code change needed, this is part of `schema.sql`. The onboarding checklist card on the home screen tracks real completion (first decision created, teammate invited, first vote cast) and dismisses itself once done or by hand.

## Email notifications (Settings > Notifications)
Real emails for @mentions and assigned actions, plus optional daily/weekly digests. Where to add the key:

1. Create a free account at https://resend.com
2. **API Keys** → Create API Key → copy it
3. Add it to Supabase, then deploy the function:
```bash
supabase secrets set RESEND_API_KEY=re_...
supabase functions deploy send-notification-email
```
4. (Optional) Verify your own domain in Resend's dashboard and set the sender:
```bash
supabase secrets set RESEND_FROM_ADDRESS="PULSE <notifications@yourdomain.com>"
```
Until you verify a domain, Resend only lets you send to the email address you signed up with — fine for testing, not for real users.

### Daily/weekly digest emails (optional, needs one more step)
```bash
supabase functions deploy send-digest-emails --no-verify-jwt
```
Then in Supabase Dashboard → **Database → Extensions**, enable `pg_cron` and `pg_net` if they're not already on. Open the commented-out `cron.schedule(...)` block at the very end of `schema.sql`, replace `<PROJECT_REF>` and `<SERVICE_ROLE_KEY>` with your real values, uncomment it, and run just that block in the SQL Editor.

## Two-factor authentication (Settings > Password & Security)
This uses Supabase Auth's built-in TOTP support directly — no secrets or setup needed, it works as soon as `schema.sql` is applied. If enrollment ever errors, check Authentication settings in your Supabase Dashboard for an MFA toggle and make sure it's on.

## Account deletion
```bash
supabase functions deploy delete-account
```
No secrets needed beyond what's already set (it uses your existing service-role key).

## Push notifications (real browser push, no mobile app)
```bash
node scripts/generate-vapid-keys.js
```
This prints two values, using nothing but Node's built-in crypto — no account, no service, no npm package needed to generate them:
- `VITE_VAPID_PUBLIC_KEY` → add to Render's environment variables (safe to expose, it's the public half)
- `VAPID_PRIVATE_KEY` → keep secret, run: `supabase secrets set VAPID_PRIVATE_KEY=<value>`

Then:
```bash
supabase secrets set VAPID_SUBJECT=mailto:you@yourcompany.com
supabase functions deploy send-push-notification
```
Users turn it on themselves in Settings > Notifications — that's the browser's own permission prompt, nothing to configure per-user on your end.

## Installable app (PWA)
No setup needed — `manifest.json`, an icon, and a service worker are already in `public/` and wired into `index.html`/`main.tsx`. Once deployed, browsers will offer "Install PULSE" automatically (Chrome/Edge show an install icon in the address bar; Safari on iOS uses Share > Add to Home Screen).

## Incoming webhooks (Settings > Integrations, works today)
No setup needed on your end — admins generate a URL per workspace directly in the Integrations page. Anything that can send a webhook (Zapier, Make, n8n, GitHub, Jira Automation, Power Automate, a five-line script) can now post real updates into PULSE without you building a dedicated OAuth integration for it.

## Admin API keys (Settings > Security > API Keys)
```bash
supabase functions deploy api --no-verify-jwt
```
Admins generate a key in Settings, then call `GET/POST https://<project-ref>.supabase.co/functions/v1/api/decisions` (or `/actions`) with `Authorization: Bearer pulse_sk_...`.

## Configurable data retention
Works as soon as `schema.sql` is applied (Settings > Data & Privacy). The actual daily cleanup needs one more step, same as the digest emails: enable `pg_cron` in Dashboard > Database > Extensions, then uncomment and run the `cron.schedule('pulse-data-retention', ...)` line at the very end of `schema.sql`. Decisions are never touched by this — only inactive Discussions get archived.

# Everything from the "build all of it" round

## Google Workspace (Drive + Calendar)
1. https://console.cloud.google.com → create a project (or reuse one)
2. APIs & Services → Library → enable **Google Drive API** and **Google Calendar API**
3. APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application
4. Add this Authorized redirect URI: `https://<project-ref>.supabase.co/functions/v1/google-oauth-callback`
5. Copy the Client ID and secret:
```bash
supabase secrets set GOOGLE_CLIENT_ID=...
supabase secrets set GOOGLE_CLIENT_SECRET=...
supabase functions deploy google-oauth-callback --no-verify-jwt
supabase functions deploy google-sync
```
6. Add `VITE_GOOGLE_CLIENT_ID` (same value) to Render's environment variables.

## Microsoft 365 + Teams (one connection powers both)
1. https://portal.azure.com → Microsoft Entra ID → App registrations → New registration
2. Redirect URI (Web): `https://<project-ref>.supabase.co/functions/v1/microsoft-oauth-callback`
3. API permissions (Delegated) → add: `Files.Read`, `Calendars.Read`, `ChannelMessage.Read.All`, `offline_access`, `User.Read` → **Grant admin consent**
4. Certificates & secrets → New client secret → copy the value immediately (hidden after you leave the page)
```bash
supabase secrets set MICROSOFT_CLIENT_ID=...
supabase secrets set MICROSOFT_CLIENT_SECRET=...
supabase functions deploy microsoft-oauth-callback --no-verify-jwt
supabase functions deploy microsoft-sync
supabase functions deploy microsoft-events --no-verify-jwt
```
5. Add `VITE_MICROSOFT_CLIENT_ID` to Render.

**Teams channel sync needs one extra manual step** (Graph doesn't have a dashboard toggle like Slack does): after deploying `microsoft-events`, create a subscription for the specific channel you want synced via Graph Explorer (https://developer.microsoft.com/graph/graph-explorer) — the exact request is documented in the comment at the top of `supabase/functions/microsoft-events/index.ts`. Subscriptions expire hourly and need renewing; a future pass can automate that via pg_cron the same way digest emails are scheduled.

## Jira
1. https://developer.atlassian.com/console/myapps/ → Create → OAuth 2.0 integration
2. Permissions → add Jira API scopes: `read:jira-work`, `write:jira-work`, `offline_access`
3. Authorization → callback URL: `https://<project-ref>.supabase.co/functions/v1/jira-oauth-callback`
```bash
supabase secrets set JIRA_CLIENT_ID=...
supabase secrets set JIRA_CLIENT_SECRET=...
supabase functions deploy jira-oauth-callback --no-verify-jwt
supabase functions deploy jira-create-issue
```
4. Add `VITE_JIRA_CLIENT_ID` to Render. Once connected, each Action gets a "Send to Jira" button (asks for the project key, e.g. `ENG`).

## Notion (no OAuth needed — simplest of the five)
1. https://www.notion.so/my-integrations → New integration → copy the **Internal Integration Secret**
2. In Notion itself, open each page/database you want PULSE to read and click **Share** → invite your integration by name (Notion requires this per-page — it's how Notion's permission model works, not something to skip)
```bash
supabase functions deploy notion-connect
```
3. In PULSE, Settings → Integrations → Notion → paste the secret. No frontend env var needed.

## Multi-language UI
Works immediately — no setup. Settings → Workspace → General → Default language now actually translates the sidebar, header, "Living State Ledger," and login screen into Spanish, French, or Portuguese in real time. **Honest scope**: this covers the navigation shell and entry screens — the ones every user sees every session. Deeper screens (Decision Room internals, Settings sub-panels, Analytics, etc.) are still English-only; extending coverage there is straightforward but mechanical work, screen by screen, whenever you want it continued.

## SSO
Real code against Supabase Auth's own public `signInWithSSO()` API — this isn't a placeholder. What it needs from you:
1. Your Supabase project must be on a plan with the **SAML 2.0 SSO add-on** (a Supabase billing decision — check your project's billing page or talk to Supabase sales; this is their gate, not something in this code)
2. Once enabled, register your identity provider via their CLI: `supabase sso add --type saml --metadata-url <your IdP's metadata URL>` (Okta, Azure AD, Google Workspace, and most enterprise IdPs all publish one)
3. In PULSE: Settings → Security → Single Sign-On → register your company's email domain (e.g. `yourcompany.com`) — this is what makes someone who signs in via SSO land in the right workspace automatically, with the role you choose
4. On the login screen, "Sign in with SSO" asks for that same domain and hands off to Supabase's real SSO flow

## Native mobile apps (Capacitor)
This wraps the same PWA you already have into real, installable iOS/Android apps — you don't rewrite anything.
```bash
npm install
npx cap add ios       # needs a Mac with Xcode installed
npx cap add android    # needs Android Studio installed
npm run cap:ios        # builds + opens Xcode
npm run cap:android    # builds + opens Android Studio
```
Before either: open `capacitor.config.ts` and change the `server.url` to your real production URL (it currently points at a placeholder). From Xcode/Android Studio you build, sign, and submit exactly like any native app — that part genuinely needs:
- An Apple Developer account ($99/year) to submit to the App Store
- A Google Play Console account ($25 one-time) to submit to Google Play
- A Mac for the iOS build specifically (Apple requires this — no way around it)

I can't run Xcode or Android Studio from here to test a build myself — this is real, correct Capacitor configuration, but treat the first build on your machine as the actual verification step, the same way `npm run build` has been your safety net every round.

## Production security hardening

The current build uses a one-time `oauth_states` record for Slack, Google, Microsoft 365 and Jira OAuth. Run the **Production security hardening** section at the bottom of `schema.sql` once. Deploy the new `oauth-start` and `disconnect-integration` Edge Functions.

OAuth client IDs/secrets are now server-side for these connection flows. Keep `*_CLIENT_SECRET` values and the Supabase service-role key in Supabase Edge Function secrets only; never put them in `.env` committed to Git.

The browser no longer needs read/update privileges for provider access/refresh tokens. Integration status can still be read normally because the app only requests non-secret columns.
