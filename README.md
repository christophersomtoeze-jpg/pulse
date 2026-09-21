# PULSE — Decision OS

PULSE is an AI-powered team decision workspace (Decision OS).  
It captures context, forces clarity, tracks outcomes, and builds institutional memory so organizations stop repeating expensive mistakes.

## Current status (Phase 0 foundation)

The codebase already includes:

- Responsive desktop + mobile shell with dark glassmorphism UI
- Living State Ledger, Decision Rooms, polls, discussions, resources
- Pre-decision Gate, Decision Brief / Execution Package, outcome reviews
- Organizational Memory, Risk Center, Analytics, AI Insights UI
- AuthProvider (email/password + OAuth ready)
- Real Supabase queries in `src/lib/pulseApi.ts` (demo mode when keys are missing)
- Production schema with extensive Row Level Security (`schema.sql`)
- Edge functions for AI summaries, account deletion, outcome reviews, Stripe, Slack, Jira, Notion, Microsoft, Google, etc.
- Privacy Policy + Terms pages
- Dual-mode: works as a polished demo without credentials; becomes live when Supabase is connected

**Phase 0 setup instructions:** see [`PHASE0_SETUP.md`](./PHASE0_SETUP.md)

## Quick start (local)

```bash
cp .env.example .env.local
# Add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

npm install
npm run typecheck
npm run dev
```

Open http://localhost:5173

- No keys → demo data
- With keys → real authentication and live data

## Scripts

| Command            | Purpose                    |
|--------------------|----------------------------|
| `npm run dev`      | Local development server   |
| `npm run build`    | Production build           |
| `npm run typecheck`| TypeScript check           |
| `npm run lint`     | ESLint                     |
| `npm run preview`  | Preview production build   |

## Architecture

- **Frontend**: React 18 + TypeScript + Vite + Tailwind + Framer Motion
- **Backend**: Supabase (Postgres + Auth + Realtime + Storage + Edge Functions)
- **AI**: Server-side only (Anthropic via Edge Functions — keys never reach the browser)
- **Payments**: Stripe (edge functions ready)
- **Integrations**: Slack, Google, Microsoft, Jira, Notion (edge function stubs present)

## Phase roadmap

### Phase 0 — Foundation (current focus)
- Supabase project + schema + RLS
- Real authentication
- Secure AI edge functions
- File storage policies
- Account deletion + legal pages
- Production deployment checklist

See `PHASE0_SETUP.md` for the exact step-by-step.

### Phase 1 — Core Decision OS
- Fully live Decision Rooms, Gate, Brief, Outcome Reviews
- Living State Ledger + Risk Center on real data
- Action tracking with owners and due dates
- Stronger AI decision intelligence

### Phase 2 — Collaboration & Enterprise
- Invites + full roles (owner/admin/member/guest)
- Audit log, moderation, advanced search
- Email / push / digests
- SSO readiness

### Phase 3 — Integrations
- Complete Slack, Teams, Google, Jira, Notion, calendar sync

### Phase 4 — Monetization
- Stripe subscriptions (Pro / Business)
- Plan limits + usage-based AI credits

### Phase 5 — Intelligence layer (moat)
- Decision quality scoring, pattern detection, predictive risk, automated post-mortems

## Important security notes

- Never put `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, or `STRIPE_SECRET_KEY` in any `VITE_` variable.
- All AI and billing calls go through Supabase Edge Functions.
- RLS policies in `schema.sql` scope every row to workspace membership.

## License / ownership

Private project. All rights reserved by the project owner.
