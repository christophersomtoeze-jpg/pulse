# PULSE Phase 3 — Decision Memory, Smart Search & Risk Intelligence

## Added
- Smart workspace search ranking across decisions, discussions, actions, resources and decision history.
- Search results surface outcome status and outcome score when available.
- Risk Center now detects overdue outcome reviews, low-scoring decisions, missed decision deadlines and dependency/blocking risks.
- Existing Decision Graph and Outcome Tracking remain integrated.

## Supabase
The Phase 1 schema already contains `decision_links` and `decision_outcome_reviews`. Run the latest `schema.sql` if your Supabase project has not received the Phase 1 migration yet.

## Local verification
```bash
npm install
npm run typecheck
npm run build
```

## GitHub
```bash
git status
git add .
git commit -m "Add smart decision memory search and risk intelligence"
git push origin main
```

Never commit `.env`, Supabase service-role keys, Anthropic keys, Stripe secrets, or OAuth client secrets.
