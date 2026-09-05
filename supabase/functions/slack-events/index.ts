// Supabase Edge Function: slack-events
// ----------------------------------------
// Slack's Events API posts message events here. Turns a Slack thread into a
// PULSE Discussion + Messages (the "Slack -> PULSE: Discussion -> Decision ->
// Actions" flow from the roadmap). Requires the app's Event Subscriptions
// request URL set to:
//   https://<project-ref>.supabase.co/functions/v1/slack-events
// and SLACK_SIGNING_SECRET set for verifying requests are genuinely from Slack:
//
//   supabase secrets set SLACK_SIGNING_SECRET=...
//   supabase functions deploy slack-events --no-verify-jwt

import { createClient } from 'npm:@supabase/supabase-js@2';

const SLACK_SIGNING_SECRET = Deno.env.get('SLACK_SIGNING_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function verifySlackSignature(req: Request, rawBody: string): Promise<boolean> {
  if (!SLACK_SIGNING_SECRET) return false;
  const timestamp = req.headers.get('x-slack-request-timestamp');
  const signature = req.headers.get('x-slack-signature');
  if (!timestamp || !signature) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 60 * 5) return false; // reject stale requests (replay protection)

  const base = `v0:${timestamp}:${rawBody}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SLACK_SIGNING_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(base));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `v0=${hex}` === signature;
}

Deno.serve(async (req) => {
  const rawBody = await req.text();
  const payload = JSON.parse(rawBody);

  // Slack's one-time URL verification handshake when you first save the Event Subscriptions URL.
  if (payload.type === 'url_verification') {
    return new Response(JSON.stringify({ challenge: payload.challenge }), { headers: { 'Content-Type': 'application/json' } });
  }

  if (!(await verifySlackSignature(req, rawBody))) {
    return new Response('Invalid Slack signature — check SLACK_SIGNING_SECRET.', { status: 401 });
  }

  const event = payload.event;
  if (event?.type === 'message' && !event.subtype && event.text) {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: integration } = await admin.from('workspace_integrations').select('workspace_id').eq('provider', 'slack').eq('external_team_id', payload.team_id).maybeSingle();
    if (integration) {
      // One discussion per Slack channel — find-or-create, then append the message.
      const discussionTitle = `Slack: #${event.channel}`;
      let { data: discussion } = await admin.from('discussions').select('id').eq('workspace_id', integration.workspace_id).eq('title', discussionTitle).maybeSingle();
      if (!discussion) {
        const { data: created } = await admin.from('discussions').insert({
          workspace_id: integration.workspace_id, title: discussionTitle, summary: 'Imported from Slack.', status: 'active',
          created_by: (await admin.from('workspaces').select('owner_id').eq('id', integration.workspace_id).single()).data?.owner_id,
        }).select('id').single();
        discussion = created;
      }
      if (discussion) {
        await admin.from('messages').insert({
          discussion_id: discussion.id,
          author_id: (await admin.from('workspaces').select('owner_id').eq('id', integration.workspace_id).single()).data?.owner_id,
          body: `[from Slack] ${event.text}`,
        });
      }
    }
  }

  return new Response('ok');
});
