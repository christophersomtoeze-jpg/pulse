# PULSE Supabase setup

1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. In Authentication > URL Configuration, add your Render URL as the Site URL and add your local URL to Redirect URLs.
4. Copy the project URL and anon/publishable key into Render environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Redeploy PULSE on Render.

Never put a Supabase service-role key in this React app or in GitHub.
