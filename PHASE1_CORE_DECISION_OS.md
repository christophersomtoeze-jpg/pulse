# Phase 1 — Core Decision OS (Status)

This phase makes the heart of PULSE live on real Supabase data.

## What is live and connected

### 1. Full Decision Rooms
- Create decision (with optional prefill from gate)
- Open Decision Room by ID
- Load decision, resources, comments, votes, history, links, outcome reviews, actions, AI intelligence
- Edit outcome (approve / reject / postpone) with note + history
- Add resources and execution actions inside the room
- Realtime refresh when comments, votes, decision row, actions, or resources change

### 2. Pre-decision Gate
- Structured questions before creating a decision
- AI-assisted recommendation for process / reversibility / urgency
- Similar past decision detection to reduce repeat decisions
- Gate answers stored on the decision

### 3. Live polls + voting with alignment score
- Decision votes: Yes / No / Needs info
- Anonymous or visible votes
- Live tally bars + **alignment percentage** (dominant side)
- Realtime updates via Supabase channels

### 4. Decision Brief / Execution Package
- One-click **Decision Brief** modal from the room
- Includes: status, outcome, owner, deadline, gate answers, vote tally, alignment, actions, resources, outcome reviews, history, discussion snapshot
- **Copy Markdown**
- **Download .md**
- **Print / Save as PDF** (browser print dialog)

### 5. Outcome Reviews (30 / 90 / 180 day)
- Schema + edge function `create-outcome-reviews` for scheduled reviews
- Outcome history loaded in Decision Room
- Submit review flow available via API + UI pieces

### 6. Living State Ledger
- Dashboard / ledger components consume live workspace decisions, polls, and activity when Supabase is configured

### 7. Organizational Memory
- `MemoryView` + `searchDecisionHistory` API for searchable decision archive and timeline

### 8. AI Decision Intelligence
- `requestDecisionIntelligence` / `getLatestDecisionIntelligence`
- Edge function `ai-decision-summary` (server-side Anthropic key)
- Panel shows summary, arguments, disagreements, recommendation + confidence when analysis exists

### 9. Risk Center
- `computeRisks` derives stalled decisions, low participation, overdue actions, low outcome scores, disagreements
- Auto-refresh every 30s
- One-click create action to unblock high risks

### 10. Action tracking
- Create / list / update action status
- Actions linked to decisions
- Owners, deadlines, priority, completion rate used in analytics and risk

---

## How to verify Phase 1 on your live project

1. Sign in with a real account
2. Create a workspace (if none)
3. Open **New Decision** → complete the Gate → create
4. Open the Decision Room
5. Add a resource, cast a vote, leave a comment, add an action
6. Open **Brief** → Copy / Download / Print-PDF
7. Set outcome (Approve / Reject / Postpone)
8. Open **Risk Center** and **Memory** views
9. Confirm data survives a full page refresh

---

## External dependencies still required (from Phase 0)

- Supabase project + `schema.sql` applied
- `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- Edge secrets: `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Deployed functions: `ai-decision-summary`, `create-outcome-reviews`, `delete-account`
- Realtime enabled on the relevant tables (default in Supabase)

---

## Next on the roadmap (Phase 2)

- Workspace invites + full role enforcement in every UI path
- Audit log surface for admins
- Email / push notification digests
- Advanced search polish
- SSO readiness

When you are ready, say **continue Phase 2** and we will build the next layer.
