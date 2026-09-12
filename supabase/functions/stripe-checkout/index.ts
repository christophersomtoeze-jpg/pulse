// Supabase Edge Function: stripe-checkout
// Creates a Stripe Checkout subscription for a workspace admin.
// Required secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_PRO, STRIPE_PRICE_BUSINESS.
// Optional: APP_URL for stable success/cancel URLs.

import { createClient } from 'npm:@supabase/supabase-js@2';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const STRIPE_PRICE_PRO = Deno.env.get('STRIPE_PRICE_PRO');
const STRIPE_PRICE_BUSINESS = Deno.env.get('STRIPE_PRICE_BUSINESS');
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

    const priceId = plan === 'pro' ? STRIPE_PRICE_PRO : STRIPE_PRICE_BUSINESS;
    if (!priceId) return json({ error: `STRIPE_PRICE_${plan.toUpperCase()} is not configured.` }, 500);

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
      'metadata[workspace_id]': workspaceId,
      'metadata[plan]': plan,
      'customer_email': userData.user.email ?? '',
    });

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const stripeBody = await stripeRes.text();
    if (!stripeRes.ok) return json({ error: `Stripe error: ${stripeBody.slice(0, 300)}` }, 502);
    const session = JSON.parse(stripeBody);
    return json({ url: session.url ?? null });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unable to start checkout.' }, 500);
  }
});
