// Supabase Edge Function: jira-oauth-callback
// -------------------------------------------------
//   supabase secrets set JIRA_CLIENT_ID=...
//   supabase secrets set JIRA_CLIENT_SECRET=...
//   supabase functions deploy jira-oauth-callback --no-verify-jwt
//
// Get these at https://developer.atlassian.com/console/myapps/ — Create app
// > OAuth 2.0 integration. Under Permissions, add the "Jira API" scopes:
// read:jira-work, write:jira-work, offline_access. Under Authorization,
// set the callback URL to:
//   https://<project-ref>.supabase.co/functions/v1/jira-oauth-callback
// Set VITE_JIRA_CLIENT_ID in your frontend env (same value as JIRA_CLIENT_ID).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { consumeOAuthState } from '../_shared/oauthState.ts';

const JIRA_CLIENT_ID = Deno.env.get('JIRA_CLIENT_ID');
const JIRA_CLIENT_SECRET = Deno.env.get('JIRA_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!JIRA_CLIENT_ID || !JIRA_CLIENT_SECRET) {
    return new Response('Jira is not connected yet — set JIRA_CLIENT_ID and JIRA_CLIENT_SECRET.', { status: 500 });
  }
  if (!code || !state) return new Response('Missing OAuth code or state.', { status: 400 });

  let oauthState;
  try { oauthState = await consumeOAuthState(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, state, 'jira'); }
  catch (err) { return new Response(err instanceof Error ? err.message : 'Invalid OAuth session.', { status: 400 }); }
  const workspaceId = oauthState.workspace_id;

  const redirectUri = `${SUPABASE_URL}/functions/v1/jira-oauth-callback`;
  const tokenRes = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'authorization_code', client_id: JIRA_CLIENT_ID, client_secret: JIRA_CLIENT_SECRET, code, redirect_uri: redirectUri }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) return new Response(`Jira rejected the exchange: ${JSON.stringify(tokenData)}`, { status: 400 });

  // Jira's OAuth token is scoped to a "cloud instance" you must look up separately.
  const resourcesRes = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
    headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/json' },
  });
  const resources = await resourcesRes.json();
  const cloudId = resources?.[0]?.id ?? null;
  const siteUrl = resources?.[0]?.url ?? null;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  await admin.from('workspace_integrations').upsert({
    workspace_id: workspaceId,
    provider: 'jira',
    status: 'connected',
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token ?? null,
    expires_at: new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000).toISOString(),
    metadata: { cloud_id: cloudId, site_url: siteUrl },
    connected_at: new Date().toISOString(),
  }, { onConflict: 'workspace_id,provider' });

  return new Response(null, { status: 302, headers: { Location: '/' } });
});
