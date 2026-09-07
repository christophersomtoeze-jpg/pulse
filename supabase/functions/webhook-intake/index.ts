// Supabase Edge Function: webhook-intake
// -------------------------------------------
// Public endpoint (no Supabase auth) that any external tool — Zapier, Make,
// n8n, a custom script, another SaaS's outgoing webhook — can POST to. The
// unguessable token in the URL path IS the authentication, same pattern
// Slack/GitHub/Stripe use for their own incoming webhooks.
//
//   supabase functions deploy webhook-intake --no-verify-jwt
//
// URL shape: https://<project-ref>.supabase.co/functions/v1/webhook-intake/<token>
// POST body: { "title": "...", "body": "..." } — creates (or appends to) a
// discussion named after the webhook, with the body as a message.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.pathname.split('/').pop();
  if (!token) return new Response(JSON.stringify({ error: 'Missing webhook token in URL' }), { status: 400 });

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: hook, error: hookError } = await admin.from('incoming_webhooks').select('id,workspace_id,name').eq('token', token).maybeSingle();
  if (hookError || !hook) return new Response(JSON.stringify({ error: 'Unknown or revoked webhook token' }), { status: 404 });

  let payload: { title?: string; body?: string };
  try { payload = await req.json(); } catch { payload = {}; }
  const title = payload.title?.trim() || `Update from ${hook.name}`;
  const body = payload.body?.trim() || JSON.stringify(payload).slice(0, 500);

  const { data: owner } = await admin.from('workspaces').select('owner_id').eq('id', hook.workspace_id).single();

  const discussionTitle = `${hook.name} (webhook)`;
  let { data: discussion } = await admin.from('discussions').select('id').eq('workspace_id', hook.workspace_id).eq('title', discussionTitle).maybeSingle();
  if (!discussion) {
    const { data: created } = await admin.from('discussions').insert({
      workspace_id: hook.workspace_id, title: discussionTitle, summary: `Incoming updates from ${hook.name}`, status: 'active', created_by: owner?.owner_id,
    }).select('id').single();
    discussion = created;
  }
  if (discussion) {
    await admin.from('messages').insert({ discussion_id: discussion.id, author_id: owner?.owner_id, body: `**${title}**\n${body}` });
  }

  await admin.from('incoming_webhooks').update({ last_used_at: new Date().toISOString() }).eq('id', hook.id);

  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
});
