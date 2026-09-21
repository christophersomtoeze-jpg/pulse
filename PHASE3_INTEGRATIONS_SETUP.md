# Phase 3 — Integrations Setup Guide

PULSE already ships edge functions and UI for Slack, Microsoft, Google, Jira, Notion, and Stripe.  
This document tells you exactly how to turn them on.

---

## 1. Deploy all integration edge functions

```bash
cd PULSE
supabase link --project-ref YOUR_PROJECT_REF

supabase functions deploy oauth-start
supabase functions deploy slack-oauth-callback
supabase functions deploy slack-events --no-verify-jwt
supabase functions deploy google-oauth-callback
supabase functions deploy google-sync
supabase functions deploy microsoft-oauth-callback
supabase functions deploy microsoft-sync
supabase functions deploy microsoft-events
supabase functions deploy jira-oauth-callback
supabase functions deploy jira-create-issue
supabase functions deploy notion-connect
supabase functions deploy disconnect-integration
supabase functions deploy stripe-checkout
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy webhook-intake
```

---

## 2. Required secrets

```bash
# Core
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Slack
supabase secrets set SLACK_CLIENT_ID=...
supabase secrets set SLACK_CLIENT_SECRET=...
supabase secrets set SLACK_SIGNING_SECRET=...

# Google Workspace
supabase secrets set GOOGLE_CLIENT_ID=...
supabase secrets set GOOGLE_CLIENT_SECRET=...

# Microsoft 365 / Teams
supabase secrets set MICROSOFT_CLIENT_ID=...
supabase secrets set MICROSOFT_CLIENT_SECRET=...

# Jira (Atlassian OAuth)
supabase secrets set JIRA_CLIENT_ID=...
supabase secrets set JIRA_CLIENT_SECRET=...

# Stripe
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set STRIPE_PRICE_PRO=price_...
supabase secrets set STRIPE_PRICE_BUSINESS=price_...
```

Notion uses a user-pasted integration token (no OAuth secret required on the server beyond the connect function).

---

## 3. Provider setup (one-time)

### Slack
1. Create an app at https://api.slack.com/apps  
2. OAuth scopes: `channels:read`, `chat:write`, `channels:history`  
3. Redirect URL: `https://YOUR_REF.supabase.co/functions/v1/slack-oauth-callback`  
4. Event Subscriptions Request URL: `https://YOUR_REF.supabase.co/functions/v1/slack-events`  
5. Subscribe to `message.channels` (or the events you need)

**What PULSE does**
- OAuth connect from Integrations view  
- Incoming channel messages → Discussion + Messages in PULSE  
- Workspace can post decision activity once chat:write is granted  

### Google Workspace
1. Google Cloud Console → OAuth client (Web)  
2. Redirect: `https://YOUR_REF.supabase.co/functions/v1/google-oauth-callback`  
3. Scopes: Drive readonly + Calendar readonly  

**What PULSE does**
- Import Drive files as Resources  
- Calendar deadlines via `google-sync`  

### Microsoft 365 / Teams / Outlook
1. Azure App Registration  
2. Redirect: `https://YOUR_REF.supabase.co/functions/v1/microsoft-oauth-callback`  
3. Permissions: User.Read, Files.Read, Calendars.Read, ChannelMessage.Read.All, offline_access  

**What PULSE does**
- OneDrive → Resources  
- Outlook Calendar → deadlines  
- Teams channel messages (with extra channel mapping step)

### Jira
1. Atlassian Developer Console → OAuth 2.0 (3LO) app  
2. Redirect: `https://YOUR_REF.supabase.co/functions/v1/jira-oauth-callback`  
3. Scopes for create issue  

**What PULSE does**
- Connect workspace  
- **Actions view → “Send to Jira”** creates a real issue from a PULSE action  

### Linear
Not a separate OAuth provider in this build.  
Recommended path:
- Use Jira-style action export pattern, or  
- Use **Incoming Webhooks** / Zapier / Make to push PULSE actions into Linear until a dedicated Linear OAuth app is added.

### Notion
1. Create an internal integration at https://www.notion.so/my-integrations  
2. Share target pages/databases with the integration  
3. In PULSE Integrations → Notion → paste the token  

**What PULSE does**
- Stores connection on the workspace  
- Decision Brief can be pushed/synced via the connected token (extend with page create as needed)

### Stripe
1. Stripe Dashboard → Products: create **Pro** and **Business** prices  
2. Copy price IDs into secrets above  
3. Webhook endpoint: `https://YOUR_REF.supabase.co/functions/v1/stripe-webhook`  
   Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`  
4. Copy webhook signing secret → `STRIPE_WEBHOOK_SECRET`

**What PULSE does**
- Settings → Billing → Upgrade to Pro / Business  
- `stripe-checkout` creates Checkout Session  
- `stripe-webhook` updates `workspace_subscriptions`

---

## 4. In-app flows (already wired)

| Integration | UI location | Actions |
|-------------|-------------|---------|
| All providers | **Integrations** view | Connect / Disconnect / status |
| Google / Microsoft | Integrations | **Sync** buttons |
| Notion | Integrations | Token form |
| Jira | **Actions** view | Send to Jira (project key prompt) |
| Stripe | **Settings → Billing** | Upgrade Pro / Business |
| Incoming webhooks | Integrations | Create webhook URL for external tools |

---

## 5. Verify Phase 3

1. Open **Integrations** — each card shows Connected / Disconnected  
2. Connect Slack (or Google) with real OAuth credentials  
3. Run **Sync** on Google/Microsoft  
4. Create an Action → **Send to Jira** with a project key  
5. Paste a Notion token and connect  
6. As admin, open Billing → Upgrade (test mode first with `sk_test_`)  
7. Confirm Stripe webhook marks the workspace plan as `pro` or `business`

---

## 6. Security notes

- Never put client secrets in `VITE_` env vars  
- All OAuth token exchange happens in Edge Functions  
- `slack-events` and `stripe-webhook` deploy with `--no-verify-jwt` because external services call them  
- Always verify Slack signing secret and Stripe webhook signature (already implemented in the functions)

---

## Status vs roadmap

| Item | Status |
|------|--------|
| Slack post + notifications path | Connected (events in → PULSE; OAuth + chat:write ready) |
| Microsoft Teams / Outlook | Connected via Microsoft OAuth + sync |
| Google Calendar + Drive | Connected via OAuth + sync |
| Jira create issue from actions | Connected in Actions UI |
| Linear | Documented path; use webhook/Jira pattern until dedicated app |
| Notion decision brief sync | Token connect live; deepen page write as needed |
| Stripe checkout + webhooks + plan | Connected; activate with live keys |

Next roadmap phase: **Phase 4 Monetization polish** (plan limits enforcement, customer portal) and **Phase 5 Intelligence layer**.
