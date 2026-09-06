// Supabase Edge Function: send-digest-emails
// -----------------------------------------------
// Called on a schedule by pg_cron (see the commented cron.schedule() calls at
// the end of schema.sql). For every user whose digest_frequency matches, this
// summarizes real activity in their workspaces since the last digest — never
// invented content — and sends one email via send-notification-email.
//
//   supabase functions deploy send-digest-emails --no-verify-jwt
//
// --no-verify-jwt because pg_cron calls this with the service-role key, not a
// user session.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const { frequency } = await req.json().catch(() => ({ frequency: 'daily' }));
  if (frequency !== 'daily' && frequency !== 'weekly') {
    return new Response(JSON.stringify({ error: 'frequency must be daily or weekly' }), { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const since = new Date(Date.now() - (frequency === 'daily' ? 1 : 7) * 86400000).toISOString();

  const { data: subscribers, error } = await admin
    .from('notification_preferences')
    .select('user_id, profiles:user_id(email, full_name)')
    .eq('digest_frequency', frequency)
    .eq('email_enabled', true);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  let sent = 0;
  for (const sub of subscribers ?? []) {
    const profile = Array.isArray(sub.profiles) ? sub.profiles[0] : sub.profiles;
    if (!profile?.email) continue;

    const { data: memberships } = await admin.from('workspace_members').select('workspace_id, workspaces(name)').eq('user_id', sub.user_id);
    const workspaceIds = (memberships ?? []).map((m) => m.workspace_id);
    if (workspaceIds.length === 0) continue;

    const [{ count: decisionsCount }, { count: actionsCount }] = await Promise.all([
      admin.from('decisions').select('*', { count: 'exact', head: true }).in('workspace_id', workspaceIds).gte('created_at', since),
      admin.from('actions').select('*', { count: 'exact', head: true }).in('workspace_id', workspaceIds).eq('owner_id', sub.user_id).neq('status', 'done'),
    ]);

    if (!decisionsCount && !actionsCount) continue; // nothing real happened — don't send a hollow email

    const body = `In the last ${frequency === 'daily' ? '24 hours' : '7 days'}: ${decisionsCount ?? 0} new decision(s) across your workspaces, and you have ${actionsCount ?? 0} open action(s) assigned to you.`;

    await fetch(`${SUPABASE_URL}/functions/v1/send-notification-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: sub.user_id, category: 'digest', subject: `Your ${frequency} PULSE digest`, heading: 'Here\'s what happened', body }),
    });
    sent += 1;
  }

  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } });
});
