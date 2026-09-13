import { createClient } from 'npm:@supabase/supabase-js@2';
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
async function callClaude(context: string) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not configured.');
  const prompt = `You are PULSE Execution Autopilot. Analyze a decision's live execution. Identify bottlenecks using dependency relationships, overdue work, missing owners, and deadline pressure. Never invent facts or people. Return ONLY JSON: {"health":"healthy|at-risk|critical","headline":"...","bottlenecks":[{"actionId":"existing-id","reason":"...","blockedCount":2}],"interventions":[{"kind":"bottleneck|overdue|owner|deadline|dependency","title":"...","detail":"...","priority":"low|medium|high","actionId":"existing-id-or-null","suggestedAction":"..."}],"confidence":0.0}. Use only existing action IDs from context. Keep interventions practical and concise.\n\nCONTEXT:\n${context}`;
  const response = await fetch('https://api.anthropic.com/v1/messages', { method:'POST', headers:{'content-type':'application/json','x-api-key':ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'}, body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:1600,messages:[{role:'user',content:prompt}]}) });
  if (!response.ok) throw new Error(`AI provider error (${response.status}): ${(await response.text()).slice(0,300)}`);
  const data = await response.json();
  const raw = (data.content ?? []).map((b:{text?:string})=>b.text ?? '').join('').replace(/```json|```/g,'').trim();
  return JSON.parse(raw);
}
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok',{headers:CORS_HEADERS});
  try {
    const authHeader=req.headers.get('Authorization'); if(!authHeader) return json({error:'Missing Authorization header'},401);
    const {decisionId}=await req.json(); if(!decisionId) return json({error:'decisionId is required'},400);
    const caller=createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{global:{headers:{Authorization:authHeader}}});
    const {data:decision,error}=await caller.from('decisions').select('id,workspace_id,title,description,status,deadline,owner_id').eq('id',decisionId).maybeSingle();
    if(error) return json({error:error.message},400); if(!decision) return json({error:'Decision not found or access denied'},404);
    const { data: quota, error: quotaError } = await caller.rpc('consume_workspace_usage', { p_workspace_id: decision.workspace_id, p_metric: 'ai_analyses' });
    if (quotaError) return json({ error: quotaError.message }, 400);
    if (!quota?.allowed) return json({ error: quota?.reason ?? 'AI usage limit reached for this workspace.', quota }, 429);
    const [actions, deps]=await Promise.all([
      caller.from('actions').select('id,title,status,priority,deadline,owner_id,created_at').eq('decision_id',decisionId).limit(80),
      caller.from('action_dependencies').select('action_id,depends_on_action_id').eq('workspace_id',decision.workspace_id),
    ]);
    if(actions.error) return json({error:actions.error.message},400); if(deps.error) return json({error:deps.error.message},400);
    const actionIds=new Set((actions.data??[]).map(a=>a.id));
    const relevantDeps=(deps.data??[]).filter(d=>actionIds.has(d.action_id)&&actionIds.has(d.depends_on_action_id));
    const blockedCounts=new Map<string,number>();
    for(const d of relevantDeps){ const blocker=(actions.data??[]).find(a=>a.id===d.depends_on_action_id); if(blocker?.status!=='done') blockedCounts.set(d.depends_on_action_id,(blockedCounts.get(d.depends_on_action_id)??0)+1); }
    const context=JSON.stringify({decision,actions:actions.data??[],dependencies:relevantDeps,blockedCounts:[...blockedCounts.entries()]},null,2);
    const parsed=await callClaude(context);
    const validIds=new Set((actions.data??[]).map(a=>a.id));
    const bottlenecks=Array.isArray(parsed.bottlenecks)?parsed.bottlenecks.filter((b:Record<string,unknown>)=>validIds.has(String(b.actionId))).slice(0,5).map((b:Record<string,unknown>)=>({actionId:String(b.actionId),reason:String(b.reason??'Execution dependency is creating downstream risk.').slice(0,300),blockedCount:Math.max(0,Math.min(50,Number(b.blockedCount??blockedCounts.get(String(b.actionId))??0)))})):[];
    const interventions=Array.isArray(parsed.interventions)?parsed.interventions.slice(0,6).map((i:Record<string,unknown>)=>({...i,title:String(i.title??'Review execution'),detail:String(i.detail??'Review this execution signal.'),priority:['low','medium','high'].includes(String(i.priority))?String(i.priority):'medium',actionId:i.actionId&&validIds.has(String(i.actionId))?String(i.actionId):null,suggestedAction:String(i.suggestedAction??'Review and address the blocker.')})):[];
    return json({decisionId,health:['healthy','at-risk','critical'].includes(parsed.health)?parsed.health:'at-risk',headline:String(parsed.headline??'Execution needs review.'),bottlenecks,interventions,confidence:Math.max(0,Math.min(1,Number(parsed.confidence??0.7))) });
  } catch(err){ return json({error:err instanceof Error?err.message:'Unknown error'},500); }
});
