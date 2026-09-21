// Stripe Customer Portal — manage subscription, payment method, invoices
// Deploy: supabase functions deploy stripe-portal
// Secrets: STRIPE_SECRET_KEY

import { createClient } from 'npm:@supabase/supabase-js@2';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (!STRIPE_SECRET_KEY) return json({ error: 'Stripe is not configured (STRIPE_SECRET_KEY missing).' }, 500);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

    const { workspaceId } = await req.json();
    if (!workspaceId) return json({ error: 'workspaceId is required' }, 400);

    const caller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await caller.auth.getUser();
    if (!userData?.user) return json({ error: 'Not authenticated' }, 401);

    const { data: membership } = await caller
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return json({ error: 'Only workspace owners/admins can open the billing portal.' }, 403);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: sub } = await admin
      .from('workspace_subscriptions')
      .select('stripe_customer_id')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (!sub?.stripe_customer_id) {
      return json({ error: 'No Stripe customer on this workspace yet. Upgrade once first.' }, 400);
    }

    const origin = req.headers.get('origin') ?? '';
    const params = new URLSearchParams({
      customer: sub.stripe_customer_id,
      return_url: `${origin}/?billing=portal_return`,
    });

    const stripeRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!stripeRes.ok) {
      const text = await stripeRes.text();
      return json({ error: `Stripe portal error: ${text.slice(0, 300)}` }, 500);
    }

    const session = await stripeRes.json();
    return json({ url: session.url });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
