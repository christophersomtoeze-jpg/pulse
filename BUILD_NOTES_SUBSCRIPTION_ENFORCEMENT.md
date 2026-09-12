# PULSE — Subscription Enforcement 1.0

Built on top of the Billing & Monetization build.

## Included
- Central plan/feature entitlement map in `src/lib/planEntitlements.ts`.
- PlanGate UI for locked Pro/Business capabilities.
- App-level gates for PULSE AI intelligence, Risk Center, Analytics, Memory, Meeting Summaries, Automation, Audit Log and Integrations.
- Settings gates for API Keys and SSO.
- Plan-aware Usage panel with member, AI-analysis and automation-run meters.
- Supabase RPCs `workspace_plan` and `workspace_plan_allows`.
- Matching migration and setup documentation.

## Important
The UI gate is not treated as a security boundary. The new RPCs are the foundation for server-side enforcement. The next pass should apply the RPC to metered Edge Functions and creation paths so limits cannot be bypassed by direct API calls.
