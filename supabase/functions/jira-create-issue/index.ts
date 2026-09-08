// Supabase Edge Function: jira-create-issue
// -------------------------------------------------
// Called from the "Send to Jira" button on an Action. Creates a real Jira
// issue and stores its key back on the action.
//
//   supabase functions deploy jira-create-issue

import { createClient } from 'npm:@supabase/supabase-js@2';
import { getValidAccessToken } from '../_shared/oauthRefresh.ts';

const JIRA_CLIENT_ID = Deno.env.get('JIRA_CLIENT_ID')!;
const JIRA_CLIENT_SECRET = Deno.env.get('JIRA_CLIENT_SECRET')!;
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

    const { actionId, projectKey } = await req.json();
    if (!actionId || !projectKey) return json({ error: 'actionId and projectKey are required' }, 400);

    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await callerClient.auth.getUser();
    if (!userData?.user) return json({ error: 'Not authenticated' }, 401);

    const { data: action } = await callerClient.from('actions').select('id,title,description,workspace_id').eq('id', actionId).maybeSingle();
    if (!action) return json({ error: 'Action not found or you are not a member of its workspace' }, 404);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: integration } = await admin.from('workspace_integrations').select('metadata').eq('workspace_id', action.workspace_id).eq('provider', 'jira').maybeSingle();
    const siteUrl = (integration?.metadata as { site_url?: string })?.site_url;
    const cloudId = (integration?.metadata as { cloud_id?: string })?.cloud_id;
    if (!cloudId) return json({ error: 'Jira is not connected for this workspace' }, 400);

    const accessToken = await getValidAccessToken(admin, action.workspace_id, 'jira', {
      tokenUrl: 'https://auth.atlassian.com/oauth/token', clientId: JIRA_CLIENT_ID, clientSecret: JIRA_CLIENT_SECRET,
    });

    const createRes = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          project: { key: projectKey },
          summary: action.title,
          description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: action.description || 'Created from PULSE.' }] }] },
          issuetype: { name: 'Task' },
        },
      }),
    });
    const created = await createRes.json();
    if (!createRes.ok) return json({ error: `Jira error: ${JSON.stringify(created)}` }, 500);

    await admin.from('actions').update({ jira_issue_key: created.key }).eq('id', actionId);

    return json({ issueKey: created.key, url: siteUrl ? `${siteUrl}/browse/${created.key}` : null });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
