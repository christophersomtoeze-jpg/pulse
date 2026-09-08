// Supabase Edge Function: microsoft-events
// ----------------------------------------------
// Receives Microsoft Graph "change notifications" for a Teams channel and
// turns new messages into a real PULSE discussion, same idea as slack-events.
//
//   supabase functions deploy microsoft-events --no-verify-jwt
//
// Graph webhooks work differently from Slack's: you must actively CREATE a
// subscription pointing at this URL (Slack's dashboard does that step for
// you; Graph doesn't have an equivalent UI). After deploying this function:
//
//   POST https://graph.microsoft.com/v1.0/subscriptions
//   Authorization: Bearer <a Microsoft access token from a connected workspace>
//   {
//     "changeType": "created",
//     "notificationUrl": "https://<project-ref>.supabase.co/functions/v1/microsoft-events",
//     "resource": "/teams/{team-id}/channels/{channel-id}/messages",
//     "expirationDateTime": "<now + 60 minutes, ISO 8601 — Graph requires renewing this hourly>",
//     "clientState": "<the workspace_id, used below to route the notification>"
//   }
//
// You'll need the specific team-id/channel-id you want synced (find them via
// Graph Explorer: https://developer.microsoft.com/graph/graph-explorer).
// Subscriptions expire and must be renewed — a production setup would renew
// this on a schedule via pg_cron the same way the digest emails are scheduled.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // Graph's validation handshake: when you create a subscription, it POSTs
  // here once with ?validationToken=... and expects that exact token echoed
  // back as plain text within 10 seconds — this is what proves you own the URL.
  const validationToken = url.searchParams.get('validationToken');
  if (validationToken) {
    return new Response(validationToken, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  const payload = await req.json().catch(() => ({ value: [] }));
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  for (const notification of payload.value ?? []) {
    const workspaceId = notification.clientState; // set to the workspace_id when the subscription was created
    if (!workspaceId) continue;

    const { data: owner } = await admin.from('workspaces').select('owner_id').eq('id', workspaceId).maybeSingle();
    if (!owner) continue;

    const discussionTitle = 'Teams channel sync';
    let { data: discussion } = await admin.from('discussions').select('id').eq('workspace_id', workspaceId).eq('title', discussionTitle).maybeSingle();
    if (!discussion) {
      const { data: created } = await admin.from('discussions').insert({
        workspace_id: workspaceId, title: discussionTitle, summary: 'Imported from a Microsoft Teams channel.', status: 'active', created_by: owner.owner_id,
      }).select('id').single();
      discussion = created;
    }
    if (discussion) {
      await admin.from('messages').insert({ discussion_id: discussion.id, author_id: owner.owner_id, body: '[from Teams] New activity in the connected channel.' });
    }
  }

  return new Response('ok');
});
