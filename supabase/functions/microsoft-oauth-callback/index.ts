// Supabase Edge Function: microsoft-oauth-callback
// -----------------------------------------------------
// Microsoft redirects here after approval. Powers BOTH the "Microsoft 365"
// and "Teams" integration rows — they're the same Azure AD app and the same
// Graph API token, just different scopes/features used from it. Requires:
//
//   supabase secrets set MICROSOFT_CLIENT_ID=...
//   supabase secrets set MICROSOFT_CLIENT_SECRET=...
//   supabase functions deploy microsoft-oauth-callback --no-verify-jwt
//
// Get these at https://portal.azure.com — Microsoft Entra ID > App
// registrations > New registration. Add this redirect URI (Web platform):
//   https://<project-ref>.supabase.co/functions/v1/microsoft-oauth-callback
// Under API permissions, add (Delegated): Files.Read, Calendars.Read,
// ChannelMessage.Read.All, offline_access, User.Read — then grant admin
// consent. Set VITE_MICROSOFT_CLIENT_ID in your frontend env.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { consumeOAuthState } from '../_shared/oauthState.ts';

const MICROSOFT_CLIENT_ID = Deno.env.get('MICROSOFT_CLIENT_ID');
const MICROSOFT_CLIENT_SECRET = Deno.env.get('MICROSOFT_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
    return new Response('Microsoft is not connected yet — set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET.', { status: 500 });
  }
  if (!code || !state) return new Response('Missing OAuth code or state.', { status: 400 });

  let oauthState;
  try { oauthState = await consumeOAuthState(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, state, 'microsoft365'); }
  catch (err) { return new Response(err instanceof Error ? err.message : 'Invalid OAuth session.', { status: 400 }); }
  const workspaceId = oauthState.workspace_id;

  const redirectUri = `${SUPABASE_URL}/functions/v1/microsoft-oauth-callback`;
  const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: MICROSOFT_CLIENT_ID, client_secret: MICROSOFT_CLIENT_SECRET,
      redirect_uri: redirectUri, grant_type: 'authorization_code',
      scope: 'offline_access User.Read Files.Read Calendars.Read ChannelMessage.Read.All',
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) return new Response(`Microsoft rejected the exchange: ${JSON.stringify(tokenData)}`, { status: 400 });

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const tokenFields = {
    status: 'connected' as const,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token ?? null,
    expires_at: new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000).toISOString(),
    connected_at: new Date().toISOString(),
  };
  // One token powers both rows — Microsoft 365 (files/calendar) and Teams (channel messages).
  await admin.from('workspace_integrations').upsert({ workspace_id: workspaceId, provider: 'microsoft365', ...tokenFields }, { onConflict: 'workspace_id,provider' });
  await admin.from('workspace_integrations').upsert({ workspace_id: workspaceId, provider: 'teams', ...tokenFields }, { onConflict: 'workspace_id,provider' });

  return new Response(null, { status: 302, headers: { Location: '/' } });
});
