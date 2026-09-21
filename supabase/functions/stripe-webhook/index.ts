// Stripe webhooks — activate/update/cancel subscriptions with correct plan
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
// No npm:stripe import (avoids Deno bundler "Invalid package specifier" errors).

import { createClient } from 'npm:@supabase/supabase-js@2';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');
const STRIPE_PRICE_STARTER = Deno.env.get('STRIPE_PRICE_STARTER');
const STRIPE_PRICE_PRO = Deno.env.get('STRIPE_PRICE_PRO');
const STRIPE_PRICE_BUSINESS = Deno.env.get('STRIPE_PRICE_BUSINESS');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const PLAN_ALLOWANCE: Record<string, number> = {
  free: 20,
  starter: 100,
  pro: 500,
  business: 2000,
  enterprise: 10000,
};

function planFromPriceId(priceId: string | undefined | null): string {
  if (!priceId) return 'pro';
  if (STRIPE_PRICE_STARTER && priceId === STRIPE_PRICE_STARTER) return 'starter';
  if (STRIPE_PRICE_PRO && priceId === STRIPE_PRICE_PRO) return 'pro';
  if (STRIPE_PRICE_BUSINESS && priceId === STRIPE_PRICE_BUSINESS) return 'business';
  return 'pro';
}

/** Verify Stripe-Signature header (HMAC-SHA256) without the Stripe SDK. */
async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((p) => {
      const [k, v] = p.split('=');
      return [k.trim(), v];
    }),
  );
  const timestamp = parts['t'];
  const v1 = parts['v1'];
  if (!timestamp || !v1) return false;

  // Reject stale timestamps (5 minutes)
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (Number.isNaN(age) || age > 300) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time-ish compare
  if (hex.length !== v1.length) return false;
  let ok = 0;
  for (let i = 0; i < hex.length; i++) ok |= hex.charCodeAt(i) ^ v1.charCodeAt(i);
  return ok === 0;
}

async function stripeGet(path: string): Promise<Record<string, unknown> | null> {
  if (!STRIPE_SECRET_KEY) return null;
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    return new Response(
      'Billing is not connected — set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.',
      { status: 500 },
    );
  }

  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  const valid = await verifyStripeSignature(body, signature, STRIPE_WEBHOOK_SECRET);
  if (!valid) {
    return new Response('Webhook signature verification failed', { status: 400 });
  }

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(body);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const ensureCredits = async (workspaceId: string, plan: string) => {
    const allowance = PLAN_ALLOWANCE[plan] ?? 20;
    await admin.from('workspace_ai_credits').upsert({
      workspace_id: workspaceId,
      balance: allowance,
      monthly_allowance: allowance,
      used_this_period: 0,
      period_start: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    });
  };

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const workspaceId = String(
      session.client_reference_id ||
        (session.metadata as Record<string, string> | undefined)?.workspace_id ||
        '',
    );
    let plan = String((session.metadata as Record<string, string> | undefined)?.plan || 'pro');

    const subId = typeof session.subscription === 'string' ? session.subscription : null;
    if (subId) {
      const sub = await stripeGet(`/subscriptions/${subId}`);
      const items = sub?.items as { data?: { price?: { id?: string } }[] } | undefined;
      const priceId = items?.data?.[0]?.price?.id;
      plan = planFromPriceId(priceId) || plan;
    }

    if (workspaceId) {
      await admin.from('workspace_subscriptions').upsert({
        workspace_id: workspaceId,
        plan,
        status: 'active',
        stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
        stripe_subscription_id: subId,
        updated_at: new Date().toISOString(),
      });
      await ensureCredits(workspaceId, plan);
    }
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    const items = sub.items as { data?: { price?: { id?: string } }[] } | undefined;
    const priceId = items?.data?.[0]?.price?.id;
    const plan = planFromPriceId(priceId);
    const workspaceId = (sub.metadata as Record<string, string> | undefined)?.workspace_id;
    const subId = String(sub.id || '');

    const status =
      event.type === 'customer.subscription.deleted'
        ? 'canceled'
        : sub.status === 'past_due'
          ? 'past_due'
          : 'active';

    const periodEnd =
      typeof sub.current_period_end === 'number'
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null;

    const update: Record<string, unknown> = {
      status,
      plan: event.type === 'customer.subscription.deleted' ? 'free' : plan,
      current_period_end: periodEnd,
      updated_at: new Date().toISOString(),
    };

    if (workspaceId) {
      await admin.from('workspace_subscriptions').update(update).eq('workspace_id', workspaceId);
      await ensureCredits(
        workspaceId,
        event.type === 'customer.subscription.deleted' ? 'free' : plan,
      );
    } else if (subId) {
      await admin.from('workspace_subscriptions').update(update).eq('stripe_subscription_id', subId);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});