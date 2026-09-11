# PULSE Production Security Hardening

## Included
- One-time, 10-minute OAuth state records for Slack, Google, Microsoft 365 and Jira.
- OAuth state is created only after the authenticated caller is verified as a workspace admin.
- OAuth callbacks consume and delete the state before exchanging the provider code, preventing replay of a completed state.
- Provider OAuth client IDs/secrets are now read by the server-side `oauth-start` function.
- Integration disconnects run through the authenticated `disconnect-integration` function rather than directly updating token columns from the browser.
- Browser roles no longer have SELECT/UPDATE privileges on provider access/refresh token columns in `workspace_integrations`.
- Existing audit log UI now exposes the security posture directly.
- Expired OAuth states have a cleanup function for scheduled service-role execution.

## Supabase action required
Run the **Production security hardening** section appended to `schema.sql`, then deploy:
- `oauth-start`
- `disconnect-integration`
- the updated provider OAuth callbacks

Keep provider secrets in Supabase Edge Function secrets. Do not commit `.env` or service-role keys.

## Validation
The assistant environment could not complete a clean dependency install before timeout, so a full TypeScript build could not be independently completed here. Run `npm install`, `npm run typecheck`, and `npm run build` locally before pushing.
