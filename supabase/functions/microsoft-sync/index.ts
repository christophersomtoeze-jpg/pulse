// Supabase Edge Function: microsoft-sync
// -------------------------------------------
//   supabase functions deploy microsoft-sync

import { createClient } from 'npm:@supabase/supabase-js@2';
import { getValidAccessToken } from '../_shared/oauthRefresh.ts';

const MICROSOFT_CLIENT_ID = Deno.env.get('MICROSOFT_CLIENT_ID')!;
const MICROSOFT_CLIENT_SECRET = Deno.env.get('MICROSOFT_CLIENT_SECRET')!;
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

    const { workspaceId } = await req.json();
    if (!workspaceId) return json({ error: 'workspaceId is required' }, 400);

    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await callerClient.auth.getUser();
    if (!userData?.user) return json({ error: 'Not authenticated' }, 401);
    const { data: ws } = await callerClient.from('workspaces').select('id').eq('id', workspaceId).maybeSingle();
    if (!ws) return json({ error: 'Not a member of this workspace' }, 403);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const accessToken = await getValidAccessToken(admin, workspaceId, 'microsoft365', {
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token', clientId: MICROSOFT_CLIENT_ID, clientSecret: MICROSOFT_CLIENT_SECRET,
    });

    const filesRes = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children?$top=10&$orderby=lastModifiedDateTime desc', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const filesData = await filesRes.json();
    if (!filesRes.ok) return json({ error: `Graph API error: ${JSON.stringify(filesData)}` }, 500);

    const now = new Date().toISOString();
    const calRes = await fetch(`https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${now}&endDateTime=${new Date(Date.now() + 7 * 86400000).toISOString()}&$top=5`, {
      headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.timezone="UTC"' },
    });
    const calData = await calRes.json();

    let imported = 0;
    for (const file of filesData.value ?? []) {
      const link = file.webUrl;
      if (!link) continue;
      const { data: existing } = await admin.from('resources').select('id').eq('workspace_id', workspaceId).eq('url', link).maybeSingle();
      if (existing) continue;
      await admin.from('resources').insert({ workspace_id: workspaceId, name: file.name, url: link, storage_path: link });
      imported += 1;
    }

    return json({
      importedResources: imported,
      upcomingEvents: (calData.value ?? []).map((e: { subject?: string; start?: { dateTime?: string } }) => ({ title: e.subject ?? '(untitled event)', start: e.start?.dateTime ?? null })),
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
