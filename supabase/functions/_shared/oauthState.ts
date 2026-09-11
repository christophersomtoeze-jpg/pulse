import { createClient } from 'npm:@supabase/supabase-js@2';

export type OAuthProvider = 'slack' | 'google' | 'microsoft365' | 'jira';

export async function consumeOAuthState(supabaseUrl: string, serviceRoleKey: string, state: string, provider: OAuthProvider) {
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await admin.from('oauth_states').select('state,workspace_id,created_by,expires_at').eq('state', state).eq('provider', provider).maybeSingle();
  if (error || !data) throw new Error('Invalid or expired OAuth session. Please start the connection again.');
  if (new Date(data.expires_at).getTime() < Date.now()) {
    await admin.from('oauth_states').delete().eq('state', state);
    throw new Error('OAuth session expired. Please start the connection again.');
  }
  await admin.from('oauth_states').delete().eq('state', state);
  return data as { state: string; workspace_id: string; created_by: string; expires_at: string };
}
