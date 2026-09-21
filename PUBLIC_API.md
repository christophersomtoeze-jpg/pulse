# PULSE Public API foundations

Base URL (after deploy):

```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/api
```

Authenticate with a workspace API key created in **Settings → API Keys**:

```
Authorization: Bearer pulse_...
```

## Endpoints (edge function `api`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/decisions` | List decisions in the key's workspace |
| GET | `/actions` | List actions |
| POST | `/actions` | Create an action (JSON body) |
| GET | `/health` | Liveness |

Exact routing is implemented in `supabase/functions/api/index.ts`. Extend that function as you publish stable REST resources.

## Incoming webhooks

Create a webhook in **Integrations** (or via `createIncomingWebhook`). External systems POST to:

```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/webhook-intake
```

Include the webhook token as configured in the function. Use this for Linear, Zapier, Make, or custom tools until first-class OAuth exists.

## Security notes

- API keys are hashed at rest; only the prefix is shown after creation.
- Revoke keys immediately if leaked.
- Prefer edge functions over exposing service-role keys to clients.
