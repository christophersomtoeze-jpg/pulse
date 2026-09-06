// Supabase Edge Function: delete-account
// ------------------------------------------
// Permanently deletes the calling user's account. Users can't do this
// themselves via the client SDK (auth.admin.deleteUser needs the service-role
// key), so this function verifies the caller's own JWT first, then deletes
// their own auth.users row — cascading deletes remove their profile and
// everything foreign-keyed to it per schema.sql's "on delete cascade" rules.
//
//   supabase functions deploy delete-account

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: CORS_HEADERS });

  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData?.user) return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers: CORS_HEADERS });

  // A workspace owner can't just vanish and orphan their workspace — require
  // transferring ownership or deleting owned workspaces first.
  const { data: ownedWorkspaces } = await callerClient.from('workspaces').select('id,name').eq('owner_id', userData.user.id);
  if (ownedWorkspaces && ownedWorkspaces.length > 0) {
    return new Response(JSON.stringify({
      error: `You own ${ownedWorkspaces.length} workspace(s) (${ownedWorkspaces.map((w) => w.name).join(', ')}). Transfer ownership or delete them before deleting your account.`,
    }), { status: 409, headers: CORS_HEADERS });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { error: deleteError } = await admin.auth.admin.deleteUser(userData.user.id);
  if (deleteError) return new Response(JSON.stringify({ error: deleteError.message }), { status: 500, headers: CORS_HEADERS });

  return new Response(JSON.stringify({ deleted: true }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
});
