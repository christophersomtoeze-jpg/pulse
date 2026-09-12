// Supabase Edge Function: stripe-billing-portal
// Creates a Stripe Billing Portal session for an existing workspace subscription.
// Required secret: STRIPE_SECRET_KEY.

import { createClient } from 'npm:@supabase/supabase-js@2';

const KEY = Deno.env.get('STRIPE_SECRET_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const APP_URL = (Deno.env.get('APP_URL') || '').replace(/\/$/, '');
const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...HEADERS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    if (!KEY) return json({ error: 'Billing is not connected: STRIPE_SECRET_KEY is missing.' }, 500);
    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'Missing Authorization header' }, 401);
    const { workspaceId } = await req.json();
    if (typeof workspaceId !== 'string' || !workspaceId) return json({ error: 'workspaceId is required' }, 400);

    const caller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: userData } = await caller.auth.getUser();
    if (!userData.user) return json({ error: 'Not authenticated' }, 401);

    const { data: membership } = await caller.from('workspace_members').select('role').eq('workspace_id', workspaceId).eq('user_id', userData.user.id).maybeSingle();
    if (!membership || !['owner', 'admin'].includes(String(membership.role))) return json({ error: 'Only workspace owners and admins can manage billing.' }, 403);

    const { data: sub } = await caller.from('workspace_subscriptions').select('stripe_customer_id').eq('workspace_id', workspaceId).maybeSingle();
    if (!sub?.stripe_customer_id) return json({ error: 'No Stripe customer is attached to this workspace yet.' }, 400);

    const params = new URLSearchParams({
      customer: String(sub.stripe_customer_id),
      return_url: `${APP_URL || req.headers.get('origin') || 'http://localhost:5173'}/`,
    });
    const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const text = await res.text();
    if (!res.ok) return json({ error: `Stripe error: ${text.slice(0, 300)}` }, 502);
    return json({ url: JSON.parse(text).url ?? null });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unable to open billing portal.' }, 500);
  }
});
