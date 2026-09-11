// Creates the 30/90/180-day outcome review rows for decided PULSE decisions.
// Run this daily with a Supabase scheduled invocation or pg_cron.
// Service-role credentials stay server-side.
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data, error } = await supabase.rpc('create_due_decision_outcome_reviews');
    if (error) return json({ error: error.message }, 400);
    return json({ created: data ?? 0 });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Scheduler failed' }, 500);
  }
});
