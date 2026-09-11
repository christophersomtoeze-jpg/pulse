# PULSE AI Decision Intelligence — Setup

This upgrade adds the server-side `decision-intelligence` Edge Function and richer cached AI analysis.

## 1. Run the database upgrade

In Supabase SQL Editor, run:

`supabase/migrations/20260911_decision_intelligence.sql`

You can also run the matching block at the bottom of `schema.sql`.

## 2. Deploy the Edge Function

From the PULSE project folder:

```bash
supabase functions deploy decision-intelligence
```

The function uses the same server-side secret as the existing AI features:

```bash
supabase secrets set ANTHROPIC_API_KEY=YOUR_KEY_HERE
```

Never put the Anthropic key in the React app or commit it to GitHub.

## 3. Frontend checks

```bash
npm install
npm run typecheck
npm run build
```

## 4. GitHub

After the checks pass:

```bash
git add .
git commit -m "Add PULSE AI decision intelligence engine"
git push origin main
```
