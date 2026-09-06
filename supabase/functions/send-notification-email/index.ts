// Supabase Edge Function: send-notification-email
// ---------------------------------------------------
// Sends one transactional email, but ONLY after checking the recipient's
// real notification_preferences via get_notification_target() — if they've
// turned a category off, this silently does nothing rather than sending
// anyway. Deploy + configure:
//
//   supabase functions deploy send-notification-email
//   supabase secrets set RESEND_API_KEY=re_...
//
// Get a key at https://resend.com (free tier covers small workspaces).
// You'll also need to verify a sending domain there before production use —
// until then Resend only lets you send to your own verified email address.

import { createClient } from 'npm:@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FROM_ADDRESS = Deno.env.get('RESEND_FROM_ADDRESS') ?? 'PULSE <notifications@pulse.app>';

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    if (!RESEND_API_KEY) return json({ error: 'RESEND_API_KEY is not set. Run: supabase secrets set RESEND_API_KEY=re_...' }, 500);

    const { userId, category, subject, heading, body } = await req.json();
    if (!userId || !category || !subject || !body) return json({ error: 'userId, category, subject and body are required' }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: target, error: targetError } = await admin.rpc('get_notification_target', { p_user_id: userId, p_category: category });
    if (targetError) return json({ error: targetError.message }, 400);

    const recipient = Array.isArray(target) ? target[0] : target;
    if (!recipient?.email) {
      // Either the user has this category turned off, or emails entirely off — nothing to send, and that's correct behavior.
      return json({ sent: false, reason: 'Recipient has this notification category disabled.' });
    }

    const html = `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#111">${heading ?? subject}</h2>
      <p style="color:#333;line-height:1.5">${body}</p>
      <p style="color:#999;font-size:12px;margin-top:24px">You're getting this because of your PULSE notification settings. Manage them any time in Settings &gt; Notifications.</p>
    </div>`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_ADDRESS, to: recipient.email, subject, html }),
    });
    if (!resendRes.ok) {
      const text = await resendRes.text();
      return json({ error: `Resend error: ${text.slice(0, 300)}` }, 500);
    }

    return json({ sent: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
