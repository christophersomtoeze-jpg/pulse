# Billing Checkout Diagnostic & Price Validation Fix

This build keeps the existing PULSE billing UI and monthly/yearly pricing, but hardens Stripe Checkout.

## What changed
- `stripe-checkout` now validates the configured Stripe Price before creating Checkout.
- It verifies the Price is active and recurring.
- It verifies monthly selection uses a monthly recurring Price and yearly selection uses a yearly recurring Price.
- Stripe API errors are returned with their actual message instead of only a generic non-2xx response.
- Browser billing code now attempts to surface the Edge Function's actual JSON error.
- Empty `customer_email` is no longer sent to Stripe.

## Required Supabase secrets
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PRO_YEARLY`
- `STRIPE_PRICE_BUSINESS_MONTHLY`
- `STRIPE_PRICE_BUSINESS_YEARLY`
- `APP_URL`

## Deploy
```powershell
supabase functions deploy stripe-checkout
```

Then test Pro monthly first. If configuration is still wrong, PULSE should now display the real reason (for example an invalid Price ID or wrong billing interval).
