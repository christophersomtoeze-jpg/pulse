// Supabase Edge Function: send-push-notification
// ----------------------------------------------------
// Sends a real browser push notification via Web Push (VAPID), after
// checking the recipient's real preference through get_push_targets(). No
// third-party push service — this talks directly to the browser vendor's
// own push endpoint (Chrome/Firefox/etc.), which is what Web Push is.
//
//   node scripts/generate-vapid-keys.js
//   supabase secrets set VAPID_PRIVATE_KEY=<private key from the script>
//   supabase secrets set VAPID_SUBJECT=mailto:you@yourcompany.com
//   supabase functions deploy send-push-notification
//
// VITE_VAPID_PUBLIC_KEY (the public half) goes in Render's env vars, not here.

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';

const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
const VAPID_PUBLIC_KEY = Deno.env.get('VITE_VAPID_PUBLIC_KEY') ?? Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:support@pulse.app';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    if (!VAPID_PRIVATE_KEY || !VAPID_PUBLIC_KEY) {
      return json({ error: 'Push isn\'t configured yet. Run scripts/generate-vapid-keys.js and set VAPID_PRIVATE_KEY + VITE_VAPID_PUBLIC_KEY.' }, 500);
    }
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const { userId, category, title, body } = await req.json();
    if (!userId || !category || !title) return json({ error: 'userId, category and title are required' }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: targets, error } = await admin.rpc('get_push_targets', { p_user_id: userId, p_category: category });
    if (error) return json({ error: error.message }, 400);

    let sent = 0;
    for (const target of targets ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
          JSON.stringify({ title, body: body ?? '' })
        );
        sent += 1;
      } catch (err) {
        // A dead/expired subscription (410 Gone) is normal — clean it up rather than treating it as a real failure.
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await admin.from('push_subscriptions').delete().eq('endpoint', target.endpoint);
        }
      }
    }

    return json({ sent });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
