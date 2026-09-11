# PULSE Phase 1 — Setup + GitHub

## What was integrated

- Decision Graph: permanent `decision_links` with workspace validation, RLS, relationship types, suggestions, and delete support.
- Outcome Tracking: 30/90/180-day `decision_outcome_reviews`, overdue handling, scoring, lessons, reversal tracking, audit history, and owner notifications.
- Pre-Decision Gate: duplicate-decision check, reversibility, urgency, cost of delay, people involvement, similar decisions, and recommended process.
- Decision Room UI: Connected Decisions and Outcome Tracking panels.
- New Decision flow: the gate runs before the normal New Decision form and stores the gate answers in `decisions.decision_gate`.
- Search helpers for decision graph and gate workflows.
- Daily scheduler Edge Function: `supabase/functions/create-outcome-reviews/index.ts`.

## Supabase

1. Open the Supabase project for PULSE.
2. Run the updated `schema.sql` in the SQL Editor.
3. Deploy the new Edge Function:

```bash
supabase functions deploy create-outcome-reviews
```

4. The Anthropic key remains server-side. The existing `ai-decision-summary` / `pulse-assistant` functions continue to use `ANTHROPIC_API_KEY`.

### Daily outcome-review scheduler

Enable `pg_cron` in Supabase Database > Extensions, then run the commented `pulse-outcome-reviews` schedule at the bottom of `schema.sql`.

The scheduler is idempotent, so running it more than once does not create duplicate 30/90/180 reviews.

## GitHub / Render

From the PULSE project folder after replacing the files with this version:

```bash
git status
git add .
git commit -m "Add decision graph outcome tracking and pre-decision gate"
git push origin main
```

If the repository uses a different branch, check it first:

```bash
git branch --show-current
```

Then push that branch instead of `main`.

Render should build the new commit automatically if the existing GitHub-to-Render connection is still active.

## Important

Do not commit `.env` or API keys. Keep Anthropic and other provider secrets in Supabase/Render secret configuration, not in frontend source code.
