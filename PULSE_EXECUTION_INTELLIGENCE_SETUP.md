# PULSE Execution Intelligence

This build adds the AI Execution Planner to Decision Room.

## Deploy

From the PULSE project root:

```bash
supabase functions deploy execution-plan
```

The function uses the existing server-side `ANTHROPIC_API_KEY` Supabase secret. Do not put the key in the frontend or commit it.

No new database migration is required for the planner; it creates normal rows in the existing `actions` and `action_dependencies` tables.
