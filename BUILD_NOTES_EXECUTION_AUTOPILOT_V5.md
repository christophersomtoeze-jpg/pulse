# PULSE Execution Autopilot 2.0 — V5

This build adds proactive execution intelligence on top of the existing Execution Engine and Autopilot.

## New capability
- AI execution analysis from the live decision/action/dependency graph.
- Bottleneck detection with downstream blocked-counts.
- Prioritized intervention recommendations.
- Decision-level health: Healthy / At risk / Critical.
- Existing live signals remain: overdue, unassigned, stalled, and deadline pressure.

## Supabase
Deploy the new Edge Function:

```bash
supabase functions deploy execution-autopilot
```

It uses the existing server-side `ANTHROPIC_API_KEY` secret. No new database migration is required.

## Local verification
Run in the PULSE folder:

```bash
npm install
npm run typecheck
npm run build
```

The build environment used to package this ZIP does not contain node_modules, so final dependency-backed typechecking should be performed locally.
