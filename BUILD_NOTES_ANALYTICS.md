# PULSE — Analytics Intelligence Build

This full source package continues from the latest PULSE Intelligence + Risk/Execution build.

## Added
- Decision alignment signal from real decision votes
- 7-day decision momentum vs previous 7 days
- Decision outcome rate
- Action completion rate
- 14-day discussion activity chart
- Top bottlenecks from stalled decisions, overdue actions, low alignment, and low participation
- Recent-voter participation metric
- Manual analytics refresh

## Validation
- `npm run typecheck` — PASS
- `npm run build` — not completed in the assistant Linux environment because the included Windows `node_modules`/Rollup optional native dependency is platform-specific. Run `npm install` on Windows/Render before building.

## Secrets
No `.env` file is included. Keep production secrets out of Git.
