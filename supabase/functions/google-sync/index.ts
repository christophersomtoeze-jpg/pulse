// Supabase Edge Function: google-sync
// ---------------------------------------
// Pulls recent Google Drive files into this workspace's Resources, and
// returns upcoming Calendar events for display. Called from the Integrations
// page's "Sync now" button.
//
//   supabase functions deploy google-sync

import { createClient } from 'npm:@supabase/supabase-js@2';
import { getValidAccessToken } from '../_shared/oauthRefresh.ts';

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
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
    const accessToken = await getValidAccessToken(admin, workspaceId, 'google', {
      tokenUrl: 'https://oauth2.googleapis.com/token', clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET,
    });

    const driveRes = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=10&orderBy=modifiedTime desc&fields=files(id,name,webViewLink)', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const driveData = await driveRes.json();
    if (!driveRes.ok) return json({ error: `Google Drive error: ${JSON.stringify(driveData)}` }, 500);

    const now = new Date().toISOString();
    const calRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&maxResults=5&singleEvents=true&orderBy=startTime`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const calData = await calRes.json();

    let imported = 0;
    for (const file of driveData.files ?? []) {
      const { data: existing } = await admin.from('resources').select('id').eq('workspace_id', workspaceId).eq('url', file.webViewLink).maybeSingle();
      if (existing) continue;
      await admin.from('resources').insert({ workspace_id: workspaceId, name: file.name, url: file.webViewLink, storage_path: file.webViewLink });
      imported += 1;
    }

    return json({
      importedResources: imported,
      upcomingEvents: (calData.items ?? []).map((e: { summary?: string; start?: { dateTime?: string; date?: string } }) => ({
        title: e.summary ?? '(untitled event)', start: e.start?.dateTime ?? e.start?.date ?? null,
      })),
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
