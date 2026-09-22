# PULSE Launch Build 5 — Collaboration & Communication

## What changed
- Decision-room comments now create real in-app notifications for @mentions and replies.
- Notification records carry explicit target metadata and the exact comment ID.
- Clicking a comment notification opens the Decision Room and highlights the referenced message.
- Replying to a comment notifies the original commenter.
- Comment creation is recorded in the immutable audit log.
- Notification realtime continues to refresh the header and notifications page.
- Existing mark-all and clear controls remain intact.

## New Supabase migration
Run only this new migration after Build 4:

`supabase/migrations/20260918_collaboration_notifications.sql`

Do not rerun the previous migrations unless your database was never migrated.

## Local verification
```bash
npm ci
npm run typecheck
npm run lint
npm run build
```

## Push
```bash
git add .
git commit -m "PULSE Launch Build 5 - collaboration notifications"
git push
```
