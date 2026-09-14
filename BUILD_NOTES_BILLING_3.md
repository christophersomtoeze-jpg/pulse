# PULSE Billing 3.0

- Pricing is visible in-app: Free $0, Pro $49/month, Business $149/month.
- Added read-only Stripe billing summary for masked payment method + recent invoices.
- Billing summary is authorized by workspace membership and uses the Stripe secret only server-side.
- Stripe Price IDs remain environment secrets and must correspond to the displayed amounts.
