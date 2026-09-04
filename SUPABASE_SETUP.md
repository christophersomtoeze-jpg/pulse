# PULSE Supabase setup

1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. In Authentication > URL Configuration, add your Render URL as the Site URL and add your local URL to Redirect URLs.
4. Copy the project URL and anon/publishable key into Render environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Redeploy PULSE on Render.

Never put a Supabase service-role key in this React app or in GitHub.


## Team & Workspace upgrade
Run the updated `schema.sql` in Supabase SQL Editor. This adds workspace invitations, profile emails, role management, and an atomic workspace creation RPC. After applying it, the Team button in PULSE opens the real member manager. Existing users may need a fresh login/signup to populate the new profile email field.
