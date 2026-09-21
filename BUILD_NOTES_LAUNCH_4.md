# PULSE Launch Build 4 — Notifications & Audit Navigation

## Fixed
- Notification rows are clickable and route to the relevant Decision Room, Actions, Team, or Invitations area when a target can be resolved.
- New notifications refresh in real time through Supabase Realtime.
- Notification bell badge now uses actual unread notifications instead of decision activity count.
- Added **Mark all** and **Clear** controls to Notifications.
- Notification clearing is protected by the user-owned RLS delete policy.
- Future decision outcome-review notifications include the exact decision UUID for deep-linking.
- Audit log rows now expose a clickable navigation affordance when an event has a resolvable target.
- Member audit events route to Team; invitation events route to Invitations; decision content reports can open the Decision Room.
- Audit log remains immutable: there is intentionally no Clear/Delete control for audit history.

## New migration
`supabase/migrations/20260917_notifications_audit_navigation.sql`

Run this after the previous Build 3 migrations:
1. schema.sql
2. phase4_monetization.sql
3. 20260911_decision_intelligence.sql
4. 20260912_subscription_entitlements.sql
5. 20260913_execution_engine_v2.sql
6. 20260914_server_usage_enforcement.sql
7. 20260915_launch_hardening.sql
8. 20260916_production_billing_reliability.sql
9. 20260917_notifications_audit_navigation.sql

## Local checks
From the project root:

```bash
npm ci
npm run typecheck
npm run lint
npm run build
node scripts/verify-production.mjs
```

The build environment used to prepare this ZIP did not have a completed dependency install, so the final `npm run typecheck/lint/build` must be run on the developer machine after `npm ci`.
