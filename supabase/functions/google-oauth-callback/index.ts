// Supabase Edge Function: google-oauth-callback
// -----------------------------------------------
// Google redirects here after the user approves the app (connectGoogle() in
// src/lib/pulseApi.ts builds the authorize URL). Exchanges the code for
// access + refresh tokens and stores them. Requires:
//
//   supabase secrets set GOOGLE_CLIENT_ID=...
//   supabase secrets set GOOGLE_CLIENT_SECRET=...
//   supabase functions deploy google-oauth-callback --no-verify-jwt
//
// Get these at https://console.cloud.google.com — APIs & Services >
// Credentials > Create OAuth client ID (Web application). Add this exact
// redirect URI there:
//   https://<project-ref>.supabase.co/functions/v1/google-oauth-callback
// Also enable the "Google Drive API" and "Google Calendar API" under
// APIs & Services > Library, and set VITE_GOOGLE_CLIENT_ID (same value as
// GOOGLE_CLIENT_ID) in your frontend env.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { consumeOAuthState } from '../_shared/oauthState.ts';

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return new Response('Google is not connected yet — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.', { status: 500 });
  }
  if (!code || !state) return new Response('Missing OAuth code or state.', { status: 400 });

  let oauthState;
  try { oauthState = await consumeOAuthState(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, state, 'google'); }
  catch (err) { return new Response(err instanceof Error ? err.message : 'Invalid OAuth session.', { status: 400 }); }
  const workspaceId = oauthState.workspace_id;

  const redirectUri = `${SUPABASE_URL}/functions/v1/google-oauth-callback`;
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri, grant_type: 'authorization_code',
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) return new Response(`Google rejected the exchange: ${JSON.stringify(tokenData)}`, { status: 400 });

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  await admin.from('workspace_integrations').upsert({
    workspace_id: workspaceId,
    provider: 'google',
    status: 'connected',
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token ?? null,
    expires_at: new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000).toISOString(),
    connected_at: new Date().toISOString(),
  }, { onConflict: 'workspace_id,provider' });

  return new Response(null, { status: 302, headers: { Location: '/' } });
});
