// Supabase Edge Function: api
// --------------------------------
// A small real REST surface for a workspace's own scripts/tools, authenticated
// with an admin-generated API key (Settings > Security > API Keys) instead of
// a user session — this is what "API keys for admins" in the roadmap means.
//
//   supabase functions deploy api --no-verify-jwt
//
// Usage:
//   GET  https://<project-ref>.supabase.co/functions/v1/api/decisions
//   GET  https://<project-ref>.supabase.co/functions/v1/api/actions
//   POST https://<project-ref>.supabase.co/functions/v1/api/actions   { "title": "..." }
//   Header: Authorization: Bearer pulse_sk_...

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });

  const authHeader = req.headers.get('Authorization') ?? '';
  const presentedKey = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!presentedKey.startsWith('pulse_sk_')) return json({ error: 'Missing or malformed API key. Use: Authorization: Bearer pulse_sk_...' }, 401);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const keyHash = await sha256Hex(presentedKey);
  const { data: keyRow, error: keyError } = await admin.from('api_keys').select('id,workspace_id,revoked').eq('key_hash', keyHash).maybeSingle();
  if (keyError || !keyRow || keyRow.revoked) return json({ error: 'Invalid or revoked API key' }, 401);

  await admin.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyRow.id);

  const url = new URL(req.url);
  const resource = url.pathname.split('/').filter(Boolean).pop();

  if (resource === 'decisions' && req.method === 'GET') {
    const { data, error } = await admin.from('decisions').select('id,title,status,outcome,deadline,created_at').eq('workspace_id', keyRow.workspace_id).order('created_at', { ascending: false }).limit(100);
    if (error) return json({ error: error.message }, 500);
    return json({ decisions: data });
  }

  if (resource === 'actions' && req.method === 'GET') {
    const { data, error } = await admin.from('actions').select('id,title,status,priority,deadline,created_at').eq('workspace_id', keyRow.workspace_id).order('created_at', { ascending: false }).limit(100);
    if (error) return json({ error: error.message }, 500);
    return json({ actions: data });
  }

  if (resource === 'actions' && req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    if (!body.title) return json({ error: 'title is required' }, 400);
    const { data: ws } = await admin.from('workspaces').select('owner_id').eq('id', keyRow.workspace_id).single();
    const { data, error } = await admin.from('actions').insert({
      workspace_id: keyRow.workspace_id, title: body.title, description: body.description ?? '',
      priority: body.priority ?? 'medium', deadline: body.deadline ?? null, created_by: ws?.owner_id,
    }).select('id,title,status').single();
    if (error) return json({ error: error.message }, 500);
    return json({ action: data }, 201);
  }

  return json({ error: 'Unknown endpoint. Try GET /decisions, GET /actions, or POST /actions.' }, 404);
});
