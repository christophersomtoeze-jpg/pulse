import { createClient } from 'npm:@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const priorities = ['low', 'medium', 'high'] as const;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

async function callClaude(context: string) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not configured.');
  const prompt = `You are PULSE Execution Intelligence. Turn the supplied decision into a realistic execution plan. Do not invent people, facts, commitments, tools, or deadlines. Produce 3-8 concrete steps. Each step must be independently actionable and written as a verb-led task. Use daysFromNow as a relative planning suggestion from today (0-30), not a factual deadline. dependsOnIndex is zero-based and may only reference an earlier step; use null when there is no dependency. Return ONLY JSON: {"steps":[{"title":"...","rationale":"...","priority":"low|medium|high","daysFromNow":3,"dependsOnIndex":null}]}. Prefer sequencing that makes blockers explicit. If the decision has a deadline, make the plan fit before it when reasonable.\n\nCONTEXT:\n${context}`;
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1400, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!response.ok) throw new Error(`AI provider error (${response.status}): ${(await response.text()).slice(0, 300)}`);
  const data = await response.json();
  const raw = (data.content ?? []).map((b: { text?: string }) => b.text ?? '').join('').replace(/```json|```/g, '').trim();
  return JSON.parse(raw);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);
    const { decisionId } = await req.json();
    if (!decisionId) return json({ error: 'decisionId is required' }, 400);
    const caller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: decision, error } = await caller.from('decisions').select('id,workspace_id,title,description,status,outcome,deadline,owner_id,created_at,decided_at,decision_gate').eq('id', decisionId).maybeSingle();
    if (error) return json({ error: error.message }, 400);
    if (!decision) return json({ error: 'Decision not found or access denied' }, 404);
    const { data: quota, error: quotaError } = await caller.rpc('consume_workspace_usage', { p_workspace_id: decision.workspace_id, p_metric: 'ai_analyses' });
    if (quotaError) return json({ error: quotaError.message }, 400);
    if (!quota?.allowed) return json({ error: quota?.reason ?? 'AI usage limit reached for this workspace.', quota }, 429);
    const [actions, comments, resources, votes] = await Promise.all([
      caller.from('actions').select('title,status,priority,deadline,owner_id').eq('decision_id', decisionId).limit(40),
      caller.from('decision_comments').select('body,created_at').eq('decision_id', decisionId).order('created_at', { ascending: true }).limit(50),
      caller.from('resources').select('name,url').eq('decision_id', decisionId).limit(20),
      caller.from('decision_votes').select('choice').eq('decision_id', decisionId),
    ]);
    for (const r of [actions, comments, resources, votes]) if (r.error) return json({ error: r.error.message }, 400);
    const context = JSON.stringify({ decision, existingActions: actions.data ?? [], discussion: (comments.data ?? []).map((x) => x.body), evidence: resources.data ?? [], voteTally: { yes: (votes.data ?? []).filter((v) => v.choice === 'yes').length, no: (votes.data ?? []).filter((v) => v.choice === 'no').length, needsInfo: (votes.data ?? []).filter((v) => v.choice === 'needs_info').length } }, null, 2);
    const parsed = await callClaude(context);
    const steps = Array.isArray(parsed.steps) ? parsed.steps.slice(0, 8).map((x: Record<string, unknown>, i: number) => ({
      title: String(x.title ?? '').trim().slice(0, 180),
      rationale: String(x.rationale ?? '').trim().slice(0, 400),
      priority: priorities.includes(String(x.priority) as typeof priorities[number]) ? String(x.priority) : 'medium',
      daysFromNow: Math.max(0, Math.min(30, Number(x.daysFromNow ?? i + 1))),
      dependsOnIndex: x.dependsOnIndex == null ? null : Math.max(0, Math.min(i - 1, Number(x.dependsOnIndex))),
    })).filter((x: { title: string }) => x.title) : [];
    return json({ decisionId, steps });
  } catch (err) { return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500); }
});
