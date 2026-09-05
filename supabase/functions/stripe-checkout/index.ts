// Supabase Edge Function: stripe-checkout
// -----------------------------------------
// Creates a Stripe Checkout session for upgrading a workspace's plan.
// INERT until you connect your own Stripe account:
//
//   supabase secrets set STRIPE_SECRET_KEY=sk_live_...
//   supabase secrets set STRIPE_PRICE_PRO=price_...
//   supabase secrets set STRIPE_PRICE_BUSINESS=price_...
//   supabase functions deploy stripe-checkout
//
// Get these from https://dashboard.stripe.com — Developers > API keys for the
// secret key, and Products > (your product) > pricing for the price IDs.

import { createClient } from 'npm:@supabase/supabase-js@2';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const STRIPE_PRICE_PRO = Deno.env.get('STRIPE_PRICE_PRO');
const STRIPE_PRICE_BUSINESS = Deno.env.get('STRIPE_PRICE_BUSINESS');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    if (!STRIPE_SECRET_KEY) {
      return json({ error: 'Billing is not connected yet — set STRIPE_SECRET_KEY (see this function\'s header comment).' }, 500);
    }
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

    const { workspaceId, plan } = await req.json();
    if (!workspaceId || (plan !== 'pro' && plan !== 'business')) return json({ error: 'workspaceId and a valid plan are required' }, 400);

    const priceId = plan === 'pro' ? STRIPE_PRICE_PRO : STRIPE_PRICE_BUSINESS;
    if (!priceId) return json({ error: `STRIPE_PRICE_${plan.toUpperCase()} is not set` }, 500);

    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await callerClient.auth.getUser();
    if (!userData?.user) return json({ error: 'Not authenticated' }, 401);

    // Confirms membership via RLS before creating any checkout session.
    const { data: ws } = await callerClient.from('workspaces').select('id,name').eq('id', workspaceId).maybeSingle();
    if (!ws) return json({ error: 'Not a member of this workspace' }, 403);

    const origin = req.headers.get('origin') ?? '';
    const params = new URLSearchParams({
      mode: 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancelled`,
      client_reference_id: workspaceId,
    });

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!stripeRes.ok) {
      const text = await stripeRes.text();
      return json({ error: `Stripe error: ${text.slice(0, 300)}` }, 500);
    }
    const session = await stripeRes.json();
    return json({ url: session.url });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
