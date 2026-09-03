# PULSE — Decision OS

PULSE is a polished React/TypeScript product prototype for an AI-powered team decision workspace.

## Current rebuild

- Responsive desktop + mobile application shell
- PULSE visual system: dark glassmorphism, neon accents, responsive cards
- Workspace sidebar and mobile navigation
- Living State Ledger with decisions, polls and resources
- Discussion feed with expandable topics
- Searchable discussions
- Interactive poll voting in demo mode
- Real-time-style discussion drawer with message composer in demo mode
- Notifications panel
- Resources hub
- AI Insights workspace (UI/demo data)
- Accessibility-minded focus states and reduced-motion support
- Production metadata and environment template

## Run locally

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run typecheck
npm run lint
npm run build
```

## Important: demo vs production

This rebuild intentionally keeps the application usable without credentials. The displayed data and messages are demo/local state; Supabase and AI are not yet connected to production infrastructure.

## Remaining work before a real public launch

### P0 — required
1. Supabase production project and database schema.
2. Authentication: email/password, magic link or OAuth.
3. Row Level Security (RLS) for workspaces, memberships, messages, polls, files and decisions.
4. Replace demo state with Supabase queries/subscriptions.
5. Secure server/edge functions for AI calls; never expose provider secrets in browser code.
6. File storage with access policies and upload limits.
7. Error monitoring, analytics and product event tracking.
8. Automated tests and end-to-end tests.
9. Production deployment, domain, HTTPS and environment secrets.
10. Privacy policy, terms, data deletion/export process and support contact.

### P1 — strongly recommended
- Invite flows and roles (owner/admin/member/guest)
- Workspace settings and billing
- Stripe subscriptions and plan limits
- Email/push notifications
- Moderation/reporting and audit log
- Better search across messages/files
- AI summaries, decision extraction and action-item generation
- Rate limiting, abuse protection and backup/restore procedures
- App Store / Play Store packaging if native mobile apps are required

## Suggested production architecture

Frontend: React + TypeScript + Vite (or React Native/Expo if native mobile apps are the target).

Backend: Supabase/Postgres + Realtime + Storage + Edge Functions.

AI: server-side AI gateway/Edge Function with usage limits and audit logging.

Payments: Stripe.

Observability: Sentry (errors) + product analytics such as PostHog/Amplitude.

## Launch estimate from this codebase

With one person working consistently alongside an AI coding assistant:

- Production MVP: ~6–10 weeks
- Strong commercial v1: ~3–5 months
- Mature SaaS with billing, mobile, AI and scale hardening: ~5–9+ months

The exact timeline depends mainly on backend scope, authentication, billing, native mobile requirements and the level of AI functionality.
