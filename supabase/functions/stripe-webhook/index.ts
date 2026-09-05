// Supabase Edge Function: stripe-webhook
// -----------------------------------------
// Receives Stripe's subscription lifecycle events and updates
// workspace_subscriptions accordingly. INERT until connected:
//
//   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
//   supabase functions deploy stripe-webhook --no-verify-jwt
//
// Then in Stripe Dashboard > Developers > Webhooks, add an endpoint pointing to
// https://<project-ref>.supabase.co/functions/v1/stripe-webhook
// listening for: checkout.session.completed, customer.subscription.updated,
// customer.subscription.deleted.
//
// NOTE: real signature verification needs the `stripe` npm package's
// webhooks.constructEvent, which needs Node crypto APIs not always available
// in edge runtimes — if `npm:stripe` import fails in your Supabase project,
// swap to manual HMAC-SHA256 verification per Stripe's docs before going live.

import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@16?target=deno';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    return new Response('Billing is not connected yet — set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.', { status: 500 });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${err instanceof Error ? err.message : err}`, { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as { client_reference_id: string; customer: string; subscription: string };
    await admin.from('workspace_subscriptions').upsert({
      workspace_id: session.client_reference_id,
      plan: 'pro',
      status: 'active',
      stripe_customer_id: session.customer,
      stripe_subscription_id: session.subscription,
      updated_at: new Date().toISOString(),
    });
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as { id: string; status: string; current_period_end: number };
    await admin.from('workspace_subscriptions')
      .update({
        status: event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status === 'past_due' ? 'past_due' : 'active',
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', sub.id);
  }

  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
});
