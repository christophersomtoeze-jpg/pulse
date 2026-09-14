# Billing Yearly + Monthly

- Added Monthly / Yearly billing-cycle toggle to Settings → Billing.
- Pro: $49/month or $490/year.
- Business: $149/month or $1,490/year.
- Yearly pricing is 10 paid months versus 12 monthly payments (16.7% effective savings).
- Checkout now receives the selected billing cycle and uses separate Stripe Price IDs.
- Required secrets: STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_PRO_YEARLY, STRIPE_PRICE_BUSINESS_MONTHLY, STRIPE_PRICE_BUSINESS_YEARLY.
- Existing monthly secrets remain accepted as fallback for monthly checkout.
