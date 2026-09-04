// Supabase Edge Function: ai-decision-summary
// --------------------------------------------
// Runs AI Decision Intelligence for one decision: reads its description and
// full comment thread, asks the model to summarize the discussion, identify
// disagreements, surface the strongest arguments, and recommend an outcome
// with a confidence score — then caches the result in
// public.decision_ai_analyses and returns it.
//
// The ANTHROPIC_API_KEY never reaches the browser: it's read from a Supabase
// secret and used only inside this server-side function. Deploy + configure
// with (see SUPABASE_SETUP.md for the full walkthrough):
//
//   supabase functions deploy ai-decision-summary
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// Auth: the caller's JWT is forwarded and checked against the decision's
// workspace membership before any AI call is made, using the same
// is_workspace_member() function the rest of the schema relies on.

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

interface AIResult {
  summary: string;
  disagreements: string;
  strongestArguments: string;
  recommendation: string;
  confidence: number;
}

async function callClaude(decisionTitle: string, description: string, comments: string[]): Promise<AIResult> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set. Run: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...');
  }

  const thread = comments.length ? comments.join('\n---\n') : '(no comments yet)';
  const prompt = `You are analyzing a team decision for a workspace tool called PULSE.

Decision: ${decisionTitle}
Description: ${description || '(none provided)'}

Discussion thread:
${thread}

Respond with ONLY a JSON object (no markdown fences, no prose outside the object) with exactly these keys:
{
  "summary": "2-4 sentence neutral summary of the discussion",
  "disagreements": "the key points of disagreement, or 'No significant disagreements found.' if none",
  "strongestArguments": "the strongest argument(s) made, attributed generically (e.g. 'One participant argued...')",
  "recommendation": "a clear recommended decision in 1-2 sentences",
  "confidence": 0.0 to 1.0 numeric confidence in that recommendation
}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI provider error (${response.status}): ${text.slice(0, 300)}`);
  }

  const data = await response.json();
  const raw = (data.content ?? []).map((block: { type: string; text?: string }) => block.text ?? '').join('');
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(cleaned);

  return {
    summary: String(parsed.summary ?? ''),
    disagreements: String(parsed.disagreements ?? ''),
    strongestArguments: String(parsed.strongestArguments ?? ''),
    recommendation: String(parsed.recommendation ?? ''),
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.5))),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

    const { decisionId } = await req.json();
    if (!decisionId) return json({ error: 'decisionId is required' }, 400);

    // Client scoped to the caller's JWT — respects RLS, so this fails closed
    // if the caller isn't actually a member of the decision's workspace.
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: decision, error: decisionError } = await callerClient
      .from('decisions')
      .select('id,title,description,workspace_id')
      .eq('id', decisionId)
      .maybeSingle();
    if (decisionError) return json({ error: decisionError.message }, 400);
    if (!decision) return json({ error: 'Decision not found or you are not a member of its workspace' }, 404);

    const { data: comments, error: commentsError } = await callerClient
      .from('decision_comments')
      .select('body')
      .eq('decision_id', decisionId)
      .order('created_at', { ascending: true });
    if (commentsError) return json({ error: commentsError.message }, 400);

    const { data: userData } = await callerClient.auth.getUser();
    const requestedBy = userData?.user?.id ?? null;

    const analysis = await callClaude(decision.title, decision.description ?? '', (comments ?? []).map((c) => c.body));

    // Service-role client to write the cached result (insert-only table; RLS still gates reads).
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: saved, error: saveError } = await adminClient
      .from('decision_ai_analyses')
      .insert({
        decision_id: decisionId,
        summary: analysis.summary,
        disagreements: analysis.disagreements,
        strongest_arguments: analysis.strongestArguments,
        recommendation: analysis.recommendation,
        confidence: analysis.confidence,
        requested_by: requestedBy,
      })
      .select('id,created_at')
      .single();
    if (saveError) return json({ error: saveError.message }, 500);

    return json({
      id: saved.id,
      summary: analysis.summary,
      disagreements: analysis.disagreements,
      strongestArguments: analysis.strongestArguments,
      recommendation: analysis.recommendation,
      confidence: analysis.confidence,
      createdAt: saved.created_at,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
