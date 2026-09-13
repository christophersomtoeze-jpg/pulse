# PULSE Usage Command Center — Build Notes

This build upgrades workspace usage reporting to use the server-side `workspace_usage_snapshot` RPC as the authoritative source for metered usage and plan limits.

## Included
- Authoritative server usage snapshot for members, AI analyses, automation runs, and workspace activity.
- Plan-limit meters driven by Supabase rather than browser-only constants.
- 80% warning and 100% limit-reached states in Settings → Usage.
- One-click navigation from a usage warning to Plan & Billing.
- Existing server-side quota enforcement remains intact.

## Supabase
Apply the latest migration in:
`supabase/migrations/20260914_server_usage_enforcement.sql`

The snapshot RPC now also reports discussion, decision, and poll counts so the Usage panel does not lose existing activity metrics.
