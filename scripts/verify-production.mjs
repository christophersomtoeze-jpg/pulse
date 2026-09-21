#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'schema.sql',
  'supabase/migrations/20260911_decision_intelligence.sql',
  'supabase/migrations/20260912_subscription_entitlements.sql',
  'supabase/migrations/20260913_execution_engine_v2.sql',
  'supabase/migrations/20260914_server_usage_enforcement.sql',
  'supabase/migrations/20260915_launch_hardening.sql',
  'supabase/functions/stripe-checkout/index.ts',
  'supabase/functions/stripe-webhook/index.ts',
  'supabase/functions/stripe-portal/index.ts',
];

const env = process.env;
const requiredEnv = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
const serverEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'];
const priceEnv = ['STRIPE_PRICE_STARTER', 'STRIPE_PRICE_PRO', 'STRIPE_PRICE_BUSINESS'];

let failed = false;
const ok = (label) => console.log(`PASS  ${label}`);
const fail = (label) => { failed = true; console.error(`FAIL  ${label}`); };

for (const file of requiredFiles) existsSync(resolve(root, file)) ? ok(`file: ${file}`) : fail(`missing file: ${file}`);
for (const key of requiredEnv) env[key] ? ok(`frontend env present: ${key}`) : fail(`frontend env missing: ${key}`);
for (const key of serverEnv) env[key] ? ok(`server env present: ${key}`) : console.warn(`WARN  server secret not present locally: ${key}`);
for (const key of priceEnv) env[key] ? ok(`Stripe price configured: ${key}`) : console.warn(`WARN  Stripe price not present locally: ${key}`);

const checkout = readFileSync(resolve(root, 'supabase/functions/stripe-checkout/index.ts'), 'utf8');
checkout.includes("membership.role !== 'owner'") ? ok('checkout restricted to workspace owner/admin') : fail('checkout authorization hardening missing');
const webhook = readFileSync(resolve(root, 'supabase/functions/stripe-webhook/index.ts'), 'utf8');
webhook.includes('stripe_webhook_events') && webhook.includes('23505') ? ok('Stripe webhook idempotency enabled') : fail('Stripe webhook idempotency missing');

if (failed) process.exit(1);
console.log('\nProduction verification checks passed. Missing server secrets are expected locally; set them in Supabase/Vercel before deployment.');
