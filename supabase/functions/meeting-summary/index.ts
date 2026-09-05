// Supabase Edge Function: meeting-summary
// -----------------------------------------
// Takes pasted meeting notes/transcript text and produces a summary, key
// points, and suggested action items. Same key-safety pattern as
// ai-decision-summary and pulse-assistant — deploy + configure with:
//
//   supabase functions deploy meeting-summary
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   (skip if already set)

import { createClient } from 'npm:@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);
    if (!ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY is not set. Run: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...' }, 500);

    const { workspaceId, title, rawNotes } = await req.json();
    if (!workspaceId || !title || !rawNotes) return json({ error: 'workspaceId, title and rawNotes are required' }, 400);

    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData?.user) return json({ error: 'Not authenticated' }, 401);

    // Confirms membership by relying on RLS: a non-member gets zero rows back, not an error.
    const { data: membershipCheck } = await callerClient.from('workspaces').select('id').eq('id', workspaceId).maybeSingle();
    if (!membershipCheck) return json({ error: 'Not a member of this workspace' }, 403);

    const prompt = `Summarize these meeting notes for a team workspace tool. Respond with ONLY a JSON object (no markdown fences, no prose outside it):
{
  "summary": "3-5 sentence neutral summary of what was discussed",
  "keyPoints": "the most important points, as a short bulleted-style text block",
  "actionItems": "concrete action items suggested by the discussion, one per line, or 'None identified.' if none"
}

Meeting notes:
${rawNotes}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!response.ok) {
      const text = await response.text();
      return json({ error: `AI provider error (${response.status}): ${text.slice(0, 300)}` }, 500);
    }
    const data = await response.json();
    const raw = (data.content ?? []).map((b: { type: string; text?: string }) => b.text ?? '').join('');
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: saved, error: saveError } = await adminClient
      .from('meeting_summaries')
      .insert({
        workspace_id: workspaceId, title, raw_notes: rawNotes,
        summary: parsed.summary ?? '', key_points: parsed.keyPoints ?? '', action_items: parsed.actionItems ?? '',
        created_by: userData.user.id,
      })
      .select('id,created_at').single();
    if (saveError) return json({ error: saveError.message }, 500);

    return json({ id: saved.id, title, summary: parsed.summary, keyPoints: parsed.keyPoints, actionItems: parsed.actionItems, createdAt: saved.created_at });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
