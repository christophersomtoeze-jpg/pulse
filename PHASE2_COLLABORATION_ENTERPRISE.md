# Phase 2 — Collaboration & Enterprise Readiness

## What was completed / strengthened

### 1. Workspace invites + full role system
- Roles: **Owner · Admin · Member · Guest · Viewer**
- Viewer maps to DB `guest` (read-only semantics)
- Helpers: `canMutateContent()`, `canManageWorkspace()`
- Invite by email with role selection
- **Revoke** pending invitations
- Audit log entries on invite / role change / remove

### 2. Workspace settings
- General settings panel (name, language, timezone, AI toggle)
- **Data retention** for discussions (90 / 180 / 365 days or forever)
- SSO domain mapping (existing)
- Members & roles management via Team + Invitations views

### 3. Complete Audit Log
- Table + RLS already in schema
- View for members
- New events written for invites, role changes, removals, content reports

### 4. Moderation & reporting
- `reportContent()` API — reports spam / harassment / off-topic / sensitive / other
- Stored as structured `content.reported` audit events
- Client rate limit on reports (max 10/min)

### 5. Notifications
- In-app notification list (existing)
- Notification preferences (existing)
- Edge functions ready: `send-notification-email`, `send-push-notification`, `send-digest-emails`
- Push subscribe helper in pulseApi (needs `VITE_VAPID_PUBLIC_KEY`)

### 6. Advanced search
- Global search across discussions, decisions, actions, resources, people
- Smart decision search
- Search modal already wired in App

### 7. Rate limiting + abuse protection
- `checkRateLimit(key, maxPerMinute)` client utility
- Applied to content reports
- Can be reused on AI / invite / export actions

### 8. Data export / deletion
- **Export my data** (personal)
- **Export entire workspace** (owner) — JSON download with members, decisions, discussions, actions, polls, audit log
- Delete workspace (owner confirm)
- Delete account (edge function + ownership guard)

---

## How to verify

1. Open **Invitations** → invite with Admin / Member / Guest / Viewer → revoke one
2. Open **Settings → Data & Privacy** → Export workspace data (as owner)
3. Open **Audit Log** → confirm invite / role events appear
4. Open **Notifications** preferences and in-app list
5. Use global search (⌘K / search icon) across decisions and people
6. Set discussion retention in Data & Privacy

---

## Optional next hardening (still recommended)

- Dedicated `content_reports` table + admin queue UI
- Server-side rate limits on edge functions
- Email delivery for invitations (Resend / Supabase auth hooks)
- Enforce `canMutateContent` on every write button in UI for guests/viewers

---

## Next phase

**Phase 3 — Integrations** (Slack, Teams, Google, Jira, Notion completion)

Say **continue Phase 3** when ready.
