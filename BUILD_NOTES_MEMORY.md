# PULSE Organizational Memory Build

## What changed
- Added a new Organizational Memory view under Intelligence.
- Searches decision history by decision title, event note, outcome, and member name.
- Shows decision archive metrics and a permanent decision timeline.
- Opens a decision memory drawer with the complete recorded history for a decision.
- Links directly back to the Decision Room.
- Added Memory to the typed app navigation and sidebar translations (English, Spanish, French, Portuguese).

## Database
No new migration is required. This build uses the existing `decision_history` and `decisions` tables.

## Validation
`npm install` could not complete in the build container because dependency installation timed out. Run `npm install`, `npm run typecheck`, and `npm run build` locally before pushing.
