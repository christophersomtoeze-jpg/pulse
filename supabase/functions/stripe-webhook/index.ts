// Supabase Edge Function: stripe-webhook
// Stripe subscription lifecycle -> workspace_subscriptions.
// Deploy with --no-verify-jwt. Required secrets:
// STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@16?target=deno';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response('Stripe webhook secrets are not configured.', { status: 500 });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('Missing stripe-signature header.', { status: 400 });
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, STRIPE_WEBHOOK_SECRET);
  } catch {
    return new Response('Webhook signature verification failed.', { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const workspaceId = session.metadata?.workspace_id || session.client_reference_id;
    const plan = session.metadata?.plan;
    if (workspaceId && (plan === 'pro' || plan === 'business')) {
      await admin.from('workspace_subscriptions').upsert({
        workspace_id: workspaceId,
        plan,
        status: 'active',
        stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
        stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : null,
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted'
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const workspaceId = sub.metadata?.workspace_id;
    const plan = sub.metadata?.plan;
    const mappedPlan = plan === 'business' ? 'business' : 'pro';
    const status = event.type === 'customer.subscription.deleted'
      ? 'canceled'
      : sub.status === 'past_due' || sub.status === 'unpaid'
        ? 'past_due'
        : sub.status === 'canceled'
          ? 'canceled'
          : 'active';

    const payload = {
      plan: mappedPlan,
      status,
      stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : null,
      stripe_subscription_id: sub.id,
      current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    if (workspaceId) {
      await admin.from('workspace_subscriptions').update(payload).eq('workspace_id', workspaceId);
    } else {
      await admin.from('workspace_subscriptions').update(payload).eq('stripe_subscription_id', sub.id);
    }
  }

  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
});
