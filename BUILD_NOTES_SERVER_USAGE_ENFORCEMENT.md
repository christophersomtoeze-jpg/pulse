# PULSE — Server Usage Enforcement 1.0

Built on top of Subscription Enforcement 1.0.

## Added
- Monthly metered usage events for AI and automation work.
- Atomic `consume_workspace_usage()` RPC with per-workspace/metric advisory locking.
- `workspace_usage_snapshot()` RPC for monthly usage meters.
- Server-side member cap trigger for Free/Pro/Business plans.
- AI quota enforcement in `ai-decision-summary`, `pulse-assistant`, `execution-plan`, and `execution-autopilot`.
- Automation quota enforcement in `run_workspace_automations()`.
- Usage counters reset automatically at the start of each calendar month.

## Supabase
Apply:
`supabase/migrations/20260914_server_usage_enforcement.sql`

Then deploy the updated AI/automation functions:
- `supabase functions deploy ai-decision-summary`
- `supabase functions deploy pulse-assistant`
- `supabase functions deploy execution-plan`
- `supabase functions deploy execution-autopilot`

## Notes
UI plan gates remain UX only. The quota RPCs and database trigger are the security boundary for metered work and member creation.
