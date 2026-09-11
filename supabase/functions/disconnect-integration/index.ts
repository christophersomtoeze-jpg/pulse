import { createClient } from 'npm:@supabase/supabase-js@2';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' };
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }); }
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'Missing Authorization header.' }, 401);
  try {
    const { workspaceId, provider } = await req.json();
    if (!workspaceId || !provider) return json({ error: 'workspaceId and provider are required.' }, 400);
    const caller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: userData } = await caller.auth.getUser();
    if (!userData.user) return json({ error: 'Not authenticated.' }, 401);
    const { data: isAdmin } = await caller.rpc('is_workspace_admin', { target_workspace: workspaceId });
    if (!isAdmin) return json({ error: 'Only workspace admins can disconnect integrations.' }, 403);
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await admin.from('workspace_integrations').update({ status: 'disconnected', access_token: null, refresh_token: null, expires_at: null }).eq('workspace_id', workspaceId).eq('provider', provider);
    if (error) return json({ error: 'Could not disconnect integration.' }, 500);
    return json({ disconnected: true });
  } catch (err) { return json({ error: err instanceof Error ? err.message : 'Unable to disconnect integration.' }, 500); }
});
