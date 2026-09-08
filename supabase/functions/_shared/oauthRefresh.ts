// supabase/functions/_shared/oauthRefresh.ts
// A Supabase convention: files under _shared/ aren't deployed as their own
// function, just imported by others via a relative path.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

interface IntegrationRow {
  id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
}

/**
 * Returns a valid access token for the given workspace+provider, refreshing
 * it first if it's expired (or about to expire) and a refresh_token exists.
 * Throws if there's no connected integration or the refresh itself fails.
 */
export async function getValidAccessToken(
  admin: SupabaseClient,
  workspaceId: string,
  provider: string,
  refreshConfig: { tokenUrl: string; clientId: string; clientSecret: string }
): Promise<string> {
  const { data, error } = await admin
    .from('workspace_integrations')
    .select('id,access_token,refresh_token,expires_at')
    .eq('workspace_id', workspaceId)
    .eq('provider', provider)
    .eq('status', 'connected')
    .maybeSingle<IntegrationRow>();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`${provider} is not connected for this workspace.`);

  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;
  const stillValid = expiresAt - Date.now() > 60_000; // more than a minute left
  if (stillValid) return data.access_token;

  if (!data.refresh_token) throw new Error(`${provider} access token expired and no refresh token is stored — reconnect it.`);

  const res = await fetch(refreshConfig.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: data.refresh_token,
      client_id: refreshConfig.clientId,
      client_secret: refreshConfig.clientSecret,
    }),
  });
  const refreshed = await res.json();
  if (!res.ok) throw new Error(`Failed to refresh ${provider} token: ${JSON.stringify(refreshed)}`);

  await admin.from('workspace_integrations').update({
    access_token: refreshed.access_token,
    expires_at: new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000).toISOString(),
  }).eq('id', data.id);

  return refreshed.access_token;
}
