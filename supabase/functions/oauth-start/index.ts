import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' };

type Provider = 'slack' | 'google' | 'microsoft365' | 'jira';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

function authorizeUrl(provider: Provider, state: string) {
  const redirectBase = `${SUPABASE_URL}/functions/v1`;
  if (provider === 'slack') {
    const clientId = Deno.env.get('SLACK_CLIENT_ID');
    if (!clientId) throw new Error('Slack is not configured on the server.');
    const scopes = ['channels:read', 'chat:write', 'channels:history'].join(',');
    return `https://slack.com/oauth/v2/authorize?client_id=${encodeURIComponent(clientId)}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(`${redirectBase}/slack-oauth-callback`)}&state=${encodeURIComponent(state)}`;
  }
  if (provider === 'google') {
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    if (!clientId) throw new Error('Google is not configured on the server.');
    const scopes = ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/calendar.readonly'].join(' ');
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(`${redirectBase}/google-oauth-callback`)}&response_type=code&access_type=offline&prompt=consent&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(state)}`;
  }
  if (provider === 'microsoft365') {
    const clientId = Deno.env.get('MICROSOFT_CLIENT_ID');
    if (!clientId) throw new Error('Microsoft is not configured on the server.');
    const scopes = 'offline_access User.Read Files.Read Calendars.Read ChannelMessage.Read.All';
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(`${redirectBase}/microsoft-oauth-callback`)}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(state)}`;
  }
  const clientId = Deno.env.get('JIRA_CLIENT_ID');
  if (!clientId) throw new Error('Jira is not configured on the server.');
  const scopes = 'read:jira-work write:jira-work offline_access';
  return `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${encodeURIComponent(clientId)}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(`${redirectBase}/jira-oauth-callback`)}&state=${encodeURIComponent(state)}&response_type=code&prompt=consent`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'Missing Authorization header.' }, 401);
    const { provider, workspaceId } = await req.json() as { provider?: Provider; workspaceId?: string };
    if (!provider || !workspaceId || !['slack', 'google', 'microsoft365', 'jira'].includes(provider)) return json({ error: 'Invalid provider or workspace.' }, 400);

    const caller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: userData } = await caller.auth.getUser();
    if (!userData.user) return json({ error: 'Not authenticated.' }, 401);
    const { data: isAdmin } = await caller.rpc('is_workspace_admin', { target_workspace: workspaceId });
    if (!isAdmin) return json({ error: 'Only workspace admins can connect integrations.' }, 403);

    const state = crypto.randomUUID();
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await admin.from('oauth_states').insert({
      state, workspace_id: workspaceId, provider, created_by: userData.user.id,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (error) return json({ error: 'Could not create a secure OAuth session.' }, 500);

    return json({ url: authorizeUrl(provider, state) });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unable to start OAuth.' }, 500);
  }
});
