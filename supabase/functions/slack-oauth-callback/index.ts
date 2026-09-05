// Supabase Edge Function: slack-oauth-callback
// -----------------------------------------------
// Slack redirects here after the user approves the app (see connectSlack() in
// src/lib/pulseApi.ts, which builds the authorize URL). Exchanges the code
// for an access token and stores it on workspace_integrations. Requires:
//
//   supabase secrets set SLACK_CLIENT_ID=...
//   supabase secrets set SLACK_CLIENT_SECRET=...
//   supabase functions deploy slack-oauth-callback --no-verify-jwt
//
// Get these by creating an app at https://api.slack.com/apps — "OAuth & Permissions"
// has the client ID/secret, and is also where you add the redirect URL:
//   https://<project-ref>.supabase.co/functions/v1/slack-oauth-callback
// Also set VITE_SLACK_CLIENT_ID in your frontend .env to the same client ID.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SLACK_CLIENT_ID = Deno.env.get('SLACK_CLIENT_ID');
const SLACK_CLIENT_SECRET = Deno.env.get('SLACK_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const workspaceId = url.searchParams.get('state'); // we passed workspaceId as `state` when building the authorize URL

  if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET) {
    return new Response('Slack is not connected yet — set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET.', { status: 500 });
  }
  if (!code || !workspaceId) return new Response('Missing code or workspace reference from Slack.', { status: 400 });

  const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: SLACK_CLIENT_ID, client_secret: SLACK_CLIENT_SECRET, code }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.ok) return new Response(`Slack rejected the exchange: ${tokenData.error}`, { status: 400 });

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  await admin.from('workspace_integrations').upsert({
    workspace_id: workspaceId,
    provider: 'slack',
    status: 'connected',
    external_team_id: tokenData.team?.id ?? null,
    access_token: tokenData.access_token,
    metadata: { team_name: tokenData.team?.name ?? null },
    connected_at: new Date().toISOString(),
  }, { onConflict: 'workspace_id,provider' });

  return new Response(null, { status: 302, headers: { Location: '/' } });
});
