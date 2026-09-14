// Supabase Edge Function: stripe-checkout
// Creates a Stripe Checkout subscription for a workspace admin.
// Required secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_PRO_YEARLY, STRIPE_PRICE_BUSINESS_MONTHLY, STRIPE_PRICE_BUSINESS_YEARLY.
// Optional: APP_URL for stable success/cancel URLs.

import { createClient } from 'npm:@supabase/supabase-js@2';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const STRIPE_PRICE_PRO_MONTHLY = Deno.env.get('STRIPE_PRICE_PRO_MONTHLY') || Deno.env.get('STRIPE_PRICE_PRO');
const STRIPE_PRICE_PRO_YEARLY = Deno.env.get('STRIPE_PRICE_PRO_YEARLY');
const STRIPE_PRICE_BUSINESS_MONTHLY = Deno.env.get('STRIPE_PRICE_BUSINESS_MONTHLY') || Deno.env.get('STRIPE_PRICE_BUSINESS');
const STRIPE_PRICE_BUSINESS_YEARLY = Deno.env.get('STRIPE_PRICE_BUSINESS_YEARLY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const APP_URL = (Deno.env.get('APP_URL') || '').replace(/\/$/, '');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    if (!STRIPE_SECRET_KEY) return json({ error: 'Billing is not connected: STRIPE_SECRET_KEY is missing.' }, 500);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

    const body = await req.json();
    const workspaceId = typeof body?.workspaceId === 'string' ? body.workspaceId : '';
    const plan = body?.plan === 'pro' || body?.plan === 'business' ? body.plan : null;
    const billingCycle = body?.billingCycle === 'yearly' ? 'yearly' : 'monthly';
    if (!workspaceId || !plan) return json({ error: 'workspaceId and a valid plan are required' }, 400);

    const caller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await caller.auth.getUser();
    if (!userData.user) return json({ error: 'Not authenticated' }, 401);

    const { data: membership } = await caller
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (!membership || !['owner', 'admin'].includes(String(membership.role))) return json({ error: 'Only workspace owners and admins can manage billing.' }, 403);

    const { data: ws } = await caller.from('workspaces').select('id,name').eq('id', workspaceId).maybeSingle();
    if (!ws) return json({ error: 'Workspace not found.' }, 404);

    const priceId = plan === 'pro'
      ? (billingCycle === 'yearly' ? STRIPE_PRICE_PRO_YEARLY : STRIPE_PRICE_PRO_MONTHLY)
      : (billingCycle === 'yearly' ? STRIPE_PRICE_BUSINESS_YEARLY : STRIPE_PRICE_BUSINESS_MONTHLY);
    if (!priceId) return json({ error: `Stripe ${plan} ${billingCycle} price is not configured. Add the matching Supabase secret.` }, 500);

    // Validate the configured Price before creating Checkout. This catches the
    // most common setup mistakes (wrong mode, wrong Price ID, one-time price,
    // or a monthly/yearly mismatch) with a useful error instead of a generic
    // "Edge Function returned a non-2xx status code" message in the browser.
    const priceRes = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });
    const priceText = await priceRes.text();
    if (!priceRes.ok) {
      let message = `Stripe could not read Price ${priceId}.`;
      try {
        const parsed = JSON.parse(priceText);
        message = parsed?.error?.message || message;
      } catch { /* keep fallback */ }
      return json({ error: message }, 500);
    }
    const price = JSON.parse(priceText);
    const expectedInterval = billingCycle === 'yearly' ? 'year' : 'month';
    if (price?.active !== true) return json({ error: `Stripe Price ${priceId} is inactive.` }, 500);
    if (price?.type !== 'recurring' || price?.recurring?.interval !== expectedInterval) {
      return json({ error: `Stripe Price ${priceId} is not a recurring ${billingCycle} Price. Check the Price ID configured for ${plan} ${billingCycle}.` }, 500);
    }

    const successBase = APP_URL || req.headers.get('origin') || 'http://localhost:5173';
    const params = new URLSearchParams({
      mode: 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: `${successBase}/?checkout=success`,
      cancel_url: `${successBase}/?checkout=cancelled`,
      client_reference_id: workspaceId,
      'subscription_data[metadata][workspace_id]': workspaceId,
      'subscription_data[metadata][plan]': plan,
      'subscription_data[metadata][billing_cycle]': billingCycle,
      'metadata[workspace_id]': workspaceId,
      'metadata[plan]': plan,
      'metadata[billing_cycle]': billingCycle,
    });

    if (userData.user.email) params.set('customer_email', userData.user.email);

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const stripeBody = await stripeRes.text();
    if (!stripeRes.ok) {
      let message = `Stripe could not start checkout (HTTP ${stripeRes.status}).`;
      try {
        const parsed = JSON.parse(stripeBody);
        message = parsed?.error?.message || message;
      } catch { /* keep fallback */ }
      return json({ error: message }, 502);
    }
    const session = JSON.parse(stripeBody);
    return json({ url: session.url ?? null });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unable to start checkout.' }, 500);
  }
});
