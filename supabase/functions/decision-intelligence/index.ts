import { createClient } from 'npm:@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const relationships = ['depends_on', 'supersedes', 'related', 'blocks', 'unlocked'] as const;
const riskLevels = ['low', 'medium', 'high'] as const;
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }); }
function cleanList(value: unknown, max = 8): string[] { return Array.isArray(value) ? value.map((v) => String(v).trim()).filter(Boolean).slice(0, max) : []; }
function confidence(value: unknown) { return Math.max(0, Math.min(1, Number(value ?? 0))); }

async function callClaude(context: string) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not configured.');
  const prompt = `You are PULSE Decision Intelligence. Analyze the supplied workspace decision evidence. Do not invent facts, people, IDs, outcomes, or evidence. Use only candidate decision IDs supplied below for similar decisions and graph suggestions.

Return ONLY valid JSON:
{"executiveSummary":"2-4 sentence factual summary","qualityScore":0,"riskLevel":"low|medium|high","riskReasons":["specific reason"],"evidenceGaps":["specific missing evidence or unanswered question"],"strongestArguments":["supported argument"],"disagreements":["supported disagreement"],"recommendation":"practical recommendation; if evidence is insufficient, say what is needed","nextActions":["concrete next action"],"similarDecisions":[{"decisionId":"candidate-id","title":"candidate title","reason":"why similar","confidence":0.0}],"graphSuggestions":[{"decisionId":"candidate-id","title":"candidate title","relationshipType":"related","reason":"why this relationship exists","confidence":0.0}],"confidence":0.0}

Rules: qualityScore is 0-100 and reflects evidence, clarity, participation, execution readiness and known outcomes. Do not treat missing data as failure. Risk must have a concrete reason. Keep arrays concise. Similar/graph entries MUST use candidate IDs exactly. relationshipType must be one of depends_on, supersedes, related, blocks, unlocked.

CONTEXT:\n${context}`;
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1800, messages: [{ role: 'user', content: prompt }] }),
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
    const { data: decision, error: decisionError } = await caller.from('decisions').select('id,workspace_id,title,description,status,outcome,deadline,owner_id,created_at,updated_at,decided_at,outcome_score,is_reversed,decision_gate').eq('id', decisionId).maybeSingle();
    if (decisionError) return json({ error: decisionError.message }, 400);
    if (!decision) return json({ error: 'Decision not found or access denied' }, 404);
    const ws = decision.workspace_id;
    const [comments, resources, votes, actions, reviews, links, candidates] = await Promise.all([
      caller.from('decision_comments').select('body,created_at').eq('decision_id', decisionId).order('created_at', { ascending: true }).limit(80),
      caller.from('resources').select('name,url').eq('decision_id', decisionId).limit(30),
      caller.from('decision_votes').select('choice,anonymous').eq('decision_id', decisionId),
      caller.from('actions').select('title,status,priority,deadline').eq('workspace_id', ws).eq('decision_id', decisionId).limit(40),
      caller.from('decision_outcome_reviews').select('review_type,status,was_successful,score,what_happened,lessons,scheduled_for').eq('decision_id', decisionId).order('scheduled_for', { ascending: true }),
      caller.from('decision_links').select('from_decision_id,to_decision_id,relationship_type,note').or(`from_decision_id.eq.${decisionId},to_decision_id.eq.${decisionId}`).limit(50),
      caller.from('decisions').select('id,title,description,status,outcome,outcome_score,updated_at').eq('workspace_id', ws).neq('id', decisionId).order('updated_at', { ascending: false }).limit(20),
    ]);
    for (const result of [comments, resources, votes, actions, reviews, links, candidates]) if (result.error) return json({ error: result.error.message }, 400);
    const voteRows = votes.data ?? [];
    const voteTally = { yes: voteRows.filter((v) => v.choice === 'yes').length, no: voteRows.filter((v) => v.choice === 'no').length, needsInfo: voteRows.filter((v) => v.choice === 'needs_info').length };
    const context = JSON.stringify({ decision, discussion: (comments.data ?? []).map((x) => x.body), evidence: resources.data ?? [], votes: voteTally, actions: actions.data ?? [], outcomeReviews: reviews.data ?? [], existingLinks: links.data ?? [], candidateDecisions: (candidates.data ?? []).map((x) => ({ id: x.id, title: x.title, description: x.description, status: x.status, outcome: x.outcome, outcomeScore: x.outcome_score, updatedAt: x.updated_at })) }, null, 2);
    const parsed = await callClaude(context);
    const candidateMap = new Map((candidates.data ?? []).map((x) => [x.id, x]));
    const existingIds = new Set((links.data ?? []).flatMap((x) => [x.from_decision_id, x.to_decision_id]));
    const similar = Array.isArray(parsed.similarDecisions) ? parsed.similarDecisions.filter((x: Record<string, unknown>) => candidateMap.has(String(x.decisionId))).slice(0, 6).map((x: Record<string, unknown>) => { const c = candidateMap.get(String(x.decisionId))!; return { decisionId: c.id, title: c.title, reason: String(x.reason ?? 'Related historical decision.'), outcome: c.outcome ?? null, outcomeScore: c.outcome_score == null ? null : Number(c.outcome_score), confidence: confidence(x.confidence) }; }) : [];
    const graphSuggestions = Array.isArray(parsed.graphSuggestions) ? parsed.graphSuggestions.filter((x: Record<string, unknown>) => candidateMap.has(String(x.decisionId)) && !existingIds.has(String(x.decisionId)) && relationships.includes(String(x.relationshipType) as typeof relationships[number])).slice(0, 6).map((x: Record<string, unknown>) => ({ decisionId: String(x.decisionId), title: String(candidateMap.get(String(x.decisionId))!.title), relationshipType: String(x.relationshipType), reason: String(x.reason ?? ''), confidence: confidence(x.confidence) })) : [];
    const result = {
      executiveSummary: String(parsed.executiveSummary ?? ''), qualityScore: Math.max(0, Math.min(100, Number(parsed.qualityScore ?? 50))),
      riskLevel: riskLevels.includes(parsed.riskLevel) ? parsed.riskLevel : 'medium', riskReasons: cleanList(parsed.riskReasons), evidenceGaps: cleanList(parsed.evidenceGaps), strongestArguments: cleanList(parsed.strongestArguments), disagreements: cleanList(parsed.disagreements), recommendation: String(parsed.recommendation ?? ''), nextActions: cleanList(parsed.nextActions), similarDecisions: similar, graphSuggestions, confidence: confidence(parsed.confidence),
    };
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData } = await caller.auth.getUser();
    const { data: saved, error: saveError } = await admin.from('decision_ai_analyses').insert({ decision_id: decisionId, summary: result.executiveSummary, disagreements: result.disagreements.join('\n'), strongest_arguments: result.strongestArguments.join('\n'), recommendation: result.recommendation, confidence: result.confidence, requested_by: userData?.user?.id ?? null, executive_summary: result.executiveSummary, quality_score: result.qualityScore, risk_level: result.riskLevel, risk_reasons: result.riskReasons, evidence_gaps: result.evidenceGaps, strongest_arguments_list: result.strongestArguments, disagreements_list: result.disagreements, next_actions: result.nextActions, similar_decisions: result.similarDecisions, graph_suggestions: result.graphSuggestions }).select('id,created_at').single();
    if (saveError) return json({ error: saveError.message }, 500);
    return json({ id: saved.id, decisionId, ...result, createdAt: saved.created_at });
  } catch (err) { return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500); }
});
