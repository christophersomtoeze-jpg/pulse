# PULSE Phase 0 — Foundation Setup (Make it real)

This guide turns the prototype into a production-ready multi-tenant Decision OS.

Follow the steps **in order**.

---

## 1. Create a Supabase project

1. Go to https://supabase.com → New project
2. Choose a strong database password and a region close to your users
3. Wait until the project is ready
4. Go to **Project Settings → API** and copy:
   - Project URL → `VITE_SUPABASE_URL`
   - `anon` `public` key → `VITE_SUPABASE_ANON_KEY`
   - `service_role` key → keep this secret (only for Edge Functions)

---

## 2. Apply the database schema + RLS

1. Open **SQL Editor** in Supabase
2. Paste the entire contents of `schema.sql` and run it
3. Confirm tables exist: `profiles`, `workspaces`, `workspace_members`, `discussions`, `messages`, `decisions`, `polls`, etc.
4. Confirm RLS is enabled (most tables already have policies in the schema)

The schema already includes:
- Workspace roles (`owner`, `admin`, `member`, `guest`)
- Row Level Security policies scoped to workspace membership
- Decision, poll, message, action, history, and outcome-review tables
- Cascade deletes so account deletion is clean

---

## 3. Local development

```bash
cd PULSE
cp .env.example .env.local
# Edit .env.local and put your real VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

npm install
npm run typecheck
npm run dev
```

Open http://localhost:5173

- Without keys → demo mode (read-only sample data)
- With keys → real auth + real data

---

## 4. Authentication

In Supabase Dashboard → **Authentication → Providers**:

- Enable **Email** (email + password + magic link recommended)
- Enable **Google** (create OAuth credentials in Google Cloud Console)
- Optionally enable Microsoft / Azure AD

In **Authentication → URL Configuration**:
- Site URL = `http://localhost:5173` (local) or your production domain
- Redirect URLs = same + any callback paths you use

The frontend already has:
- `AuthProvider` with email/password, OAuth, and session persistence
- Sign-up / sign-in / sign-out flows

---

## 5. Deploy Edge Functions (server-side AI + account deletion)

Install Supabase CLI if you don’t have it:

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Set secrets (never put these in the frontend):

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
# later: STRIPE_*, SLACK_*, etc.
```

Deploy the critical Phase 0 functions:

```bash
supabase functions deploy delete-account
supabase functions deploy ai-decision-summary
supabase functions deploy create-outcome-reviews
supabase functions deploy pulse-assistant
```

Other functions (Stripe, Slack, Jira, Notion, Microsoft, Google) can be deployed later when you activate those integrations.

---

## 6. File storage

In Supabase Dashboard → **Storage**:

1. Create a bucket named `workspace-files` (or the name your code expects)
2. Set it to private
3. Add policies so only workspace members can read/write objects belonging to their workspace

(The schema and edge functions assume storage policies exist; adjust bucket name in code if needed.)

---

## 7. Production deployment checklist

- [ ] Custom domain pointed to your host (Vercel / Netlify / Cloudflare Pages / Render)
- [ ] Environment variables set in the host dashboard (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- [ ] Supabase Auth Site URL + Redirect URLs updated to production domain
- [ ] Edge Function secrets set
- [ ] HTTPS only
- [ ] Privacy Policy and Terms linked in the app (already present under `/privacy` and `/terms`)
- [ ] Support email configured
- [ ] Sentry (or equivalent) DSN added if you want error monitoring
- [ ] Test full flow: sign up → create workspace → create decision → vote → AI summary → delete account

---

## 8. Account deletion & data export

- Edge function `delete-account` already exists and requires the user to transfer or delete owned workspaces first
- Users can request data export via support or a future in-app button (hook is ready)

---

## 9. What is already solid in the codebase

- Dual-mode: demo data when Supabase is not configured, live data when it is
- `src/lib/pulseApi.ts` contains real Supabase queries for workspaces, discussions, decisions, polls, messages, analytics, etc.
- Row Level Security policies in `schema.sql`
- Auth provider with session handling
- Legal pages (Privacy + Terms)
- Edge functions for AI, account deletion, outcome reviews, and many integrations (stubs ready)

---

## 10. After Phase 0 is complete

You will have a secure, multi-tenant foundation.

Next recommended work (Phase 1):
- Finish wiring every Decision Room action to live data
- Pre-decision Gate + Decision Brief export fully live
- Outcome review scheduler
- Risk Center + Living State Ledger on real data
- Stripe billing activation

---

**You are done with Phase 0 when:**
1. A new user can sign up
2. Create a workspace
3. Create a decision and see it persist after refresh
4. Invite is ready (or can be added next)
5. Account deletion works
6. No secrets are exposed in the browser
