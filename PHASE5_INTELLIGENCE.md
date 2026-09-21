# Phase 5 — Intelligence Layer

## What was added (this is what you “add” for companies & investors)

### 1. Decision quality over time
- Average quality score across the workspace
- 6-month quality trend chart in **Analytics**
- Per-decision quality from Decision Intelligence AI

### 2. Patterns & bias-style signals
Detected automatically from real data:
- Slow decision cycle
- Frequent split votes
- Low voting participation
- Decision reversals
- Execution lag (overdue actions)
- Below-target average quality

### 3. Similar past decisions
- Already in Decision Intelligence panel (AI + candidate matching)
- Workspace “healthy outcome rate” shown in Analytics

### 4. Predictive risk
- Flags open decisions that look like past weak outcomes:
  - long open without outcome
  - low quality score
  - split votes
- Click-through to open the Decision Room

### 5. Automated post-mortems
- `generatePostMortem(decisionId, workspaceId)` builds Markdown from:
  - outcome reviews
  - reversals
  - AI evidence gaps / arguments
  - history
- Uses 1 AI credit when invoked

### 6. AI credit gating on intelligence
- Running Decision Intelligence consumes **2 credits**
- Post-mortem consumes **1 credit**
- Enforced via Phase 4 credit system

### 7. Existing intelligence kept
- Edge function `decision-intelligence` (quality, risk, similar, graph suggestions)
- Decision Intelligence panel in each Decision Room
- Risk Center + Living State Ledger

---

## How much value this adds (plain language)

| Before Phase 5 | After Phase 5 |
|----------------|---------------|
| Decisions are documented | Decisions are **scored and compared over time** |
| Risks are reactive | Risks are **predicted before failure** |
| Learning is optional | Post-mortems become **systematic** |
| AI is a feature | AI is a **metered intelligence layer** tied to plans |

For investors: this is the **data moat** — every decision makes the workspace smarter and harder to leave.

---

## Verify

1. Open **Analytics** — see quality score, trend, patterns, predictive risks  
2. Open a Decision Room → **Run Decision Intelligence** (uses credits)  
3. Confirm similar decisions + quality score appear  
4. Call `generatePostMortem` after an outcome is 30+ days old  

---

## Optional next (beyond Phase 5)

- Cross-workspace anonymized benchmarks (opt-in)
- Facilitator coaching prompts inside Decision Room
- Scheduled weekly intelligence email digest

Core product roadmap Phases 0–5 are now complete in code.
