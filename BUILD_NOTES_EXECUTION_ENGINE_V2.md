# PULSE Execution Engine v2

This upgrade adds action dependencies so execution plans can model real bottlenecks.

## Database
Run:
`supabase/migrations/20260913_execution_engine_v2.sql`

The same SQL is appended to `schema.sql` for fresh installs.

## What changed
- `action_dependencies` table with workspace-safe validation and RLS
- Dependency linking inside Decision Room → Execution Engine
- Execution health counts: ready vs blocked actions
- Blocking explanation and dependency removal
- API helpers for listing/creating/deleting dependencies

## Deploy
After applying SQL, rebuild the frontend and deploy as normal.
