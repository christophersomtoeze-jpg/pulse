// Supabase Edge Function: notion-connect
// ---------------------------------------------
// Notion's simplest integration path doesn't need OAuth at all: an admin
// creates an "internal integration" in their Notion workspace and pastes the
// token here. This function just verifies the token actually works before
// storing it.
//
//   supabase functions deploy notion-connect
//
// To get a token: https://www.notion.so/my-integrations > New integration >
// copy the "Internal Integration Secret". Then in Notion, share the specific
// pages/databases you want PULSE to read with that integration (Notion
// requires this per-page share — it's a Notion permission model thing, not
// something this code can skip).

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' };
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

    const { workspaceId, token } = await req.json();
    if (!workspaceId || !token) return json({ error: 'workspaceId and token are required' }, 400);

    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await callerClient.auth.getUser();
    if (!userData?.user) return json({ error: 'Not authenticated' }, 401);
    const { data: isAdmin } = await callerClient.rpc('is_workspace_admin', { target_workspace: workspaceId });
    if (!isAdmin) return json({ error: 'Only workspace admins can connect integrations' }, 403);

    const testRes = await fetch('https://api.notion.com/v1/users/me', {
      headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28' },
    });
    if (!testRes.ok) return json({ error: 'That token was rejected by Notion — double check you copied the full Internal Integration Secret.' }, 400);
    const me = await testRes.json();

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await admin.from('workspace_integrations').upsert({
      workspace_id: workspaceId, provider: 'notion', status: 'connected', access_token: token,
      metadata: { bot_name: me.name ?? 'Notion integration' }, connected_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id,provider' });

    return json({ connected: true, name: me.name ?? null });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
