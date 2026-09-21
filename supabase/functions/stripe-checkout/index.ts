// Stripe Checkout — Starter / Pro / Business subscriptions
// Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_STARTER, STRIPE_PRICE_PRO, STRIPE_PRICE_BUSINESS

import { createClient } from 'npm:@supabase/supabase-js@2';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const STRIPE_PRICE_STARTER = Deno.env.get('STRIPE_PRICE_STARTER');
const STRIPE_PRICE_PRO = Deno.env.get('STRIPE_PRICE_PRO');
const STRIPE_PRICE_BUSINESS = Deno.env.get('STRIPE_PRICE_BUSINESS');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const APP_URL = Deno.env.get('APP_URL') ?? Deno.env.get('SITE_URL') ?? '';

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin');
  const allowed = APP_URL && origin === APP_URL ? origin : APP_URL || '*';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } });
}

type Plan = 'starter' | 'pro' | 'business';

function priceFor(plan: Plan): string | undefined {
  if (plan === 'starter') return STRIPE_PRICE_STARTER;
  if (plan === 'pro') return STRIPE_PRICE_PRO;
  return STRIPE_PRICE_BUSINESS;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (!STRIPE_SECRET_KEY) return json(req, { error: 'Billing is not connected yet — set STRIPE_SECRET_KEY.' }, 500);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json(req, { error: 'Missing Authorization header' }, 401);

    const body = await req.json();
    const workspaceId = body.workspaceId as string;
    const plan = body.plan as Plan;
    if (!workspaceId || !['starter', 'pro', 'business'].includes(plan)) {
      return json(req, { error: 'workspaceId and plan (starter|pro|business) are required' }, 400);
    }

    const priceId = priceFor(plan);
    if (!priceId) return json(req, { error: `STRIPE_PRICE_${plan.toUpperCase()} is not set` }, 500);

    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await callerClient.auth.getUser();
    if (!userData?.user) return json(req, { error: 'Not authenticated' }, 401);

    const { data: membership } = await callerClient
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return json(req, { error: 'Only workspace owners/admins can change billing.' }, 403);
    }

    const origin = APP_URL || req.headers.get('origin') || new URL(req.url).origin;
    const params = new URLSearchParams({
      mode: 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: `${origin}/?checkout=success&plan=${plan}`,
      cancel_url: `${origin}/?checkout=cancelled`,
      client_reference_id: workspaceId,
      'metadata[workspace_id]': workspaceId,
      'metadata[plan]': plan,
      'subscription_data[metadata][workspace_id]': workspaceId,
      'subscription_data[metadata][plan]': plan,
    });

    // Reuse existing Stripe customer when present
    const { data: existing } = await callerClient
      .from('workspace_subscriptions')
      .select('stripe_customer_id')
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (existing?.stripe_customer_id) {
      params.set('customer', existing.stripe_customer_id);
    } else if (userData.user.email) {
      params.set('customer_email', userData.user.email);
    }

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!stripeRes.ok) {
      const text = await stripeRes.text();
      return json(req, { error: `Stripe error: ${text.slice(0, 300)}` }, 500);
    }

    const session = await stripeRes.json();
    return json(req, { url: session.url });
  } catch (err) {
    return json(req, { error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
