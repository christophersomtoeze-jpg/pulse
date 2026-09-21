# Phase 0 Completion Checklist

Use this before you tell anyone the foundation is ready.

## Code & project structure
- [x] `package.json` restored
- [x] `vite.config.ts` present
- [x] `index.html` present
- [x] `.env.example` present
- [x] `.gitignore` present
- [x] `PHASE0_SETUP.md` written
- [x] README updated with current status and architecture
- [x] Dual-mode (demo vs live) already implemented in App + pulseApi
- [x] AuthProvider ready for email + OAuth
- [x] schema.sql contains extensive RLS
- [x] delete-account edge function present
- [x] Privacy + Terms pages present

## What you (the owner) must still do
- [ ] Create Supabase project
- [ ] Run `schema.sql` in the SQL Editor
- [ ] Copy URL + anon key into `.env.local`
- [ ] Enable Email + Google (and optionally Microsoft) auth providers
- [ ] Set Auth Site URL + Redirect URLs
- [ ] Deploy edge functions (`delete-account`, `ai-decision-summary`, etc.)
- [ ] Set edge function secrets (`ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, …)
- [ ] Create Storage bucket + policies
- [ ] Deploy frontend to production host
- [ ] Point domain + update Supabase Auth URLs to production
- [ ] Test: sign up → create workspace → create decision → refresh → still there
- [ ] Test: account deletion path
- [ ] Customize Privacy/Terms contact email and company name if needed

## Definition of “Phase 0 done”
A new real user can:
1. Sign up / sign in
2. Create a workspace
3. Create and view decisions that persist
4. Have their data protected by RLS
5. Delete their account (after handling owned workspaces)
6. See no secrets in the browser network tab
