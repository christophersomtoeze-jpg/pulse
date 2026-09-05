// Supabase Edge Function: pulse-assistant
// ----------------------------------------
// A workspace-aware chat assistant. Gathers real context from the caller's
// workspace (open decisions, recent discussions, overdue actions) and asks
// Claude to answer using ONLY that context — it never invents data. The
// ANTHROPIC_API_KEY stays server-side; deploy + configure exactly like
// ai-decision-summary (see SUPABASE_SETUP.md):
//
//   supabase functions deploy pulse-assistant
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

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

    const { workspaceId, content } = await req.json();
    if (!workspaceId || !content) return json({ error: 'workspaceId and content are required' }, 400);

    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData?.user) return json({ error: 'Not authenticated' }, 401);
    const userId = userData.user.id;

    // RLS on every one of these queries silently returns nothing if the
    // caller isn't actually a member of workspaceId — this fails closed.
    const [decisionsRes, discussionsRes, actionsRes, historyRes] = await Promise.all([
      callerClient.from('decisions').select('title,status,outcome,deadline').eq('workspace_id', workspaceId).order('updated_at', { ascending: false }).limit(10),
      callerClient.from('discussions').select('title,summary,status,updated_at').eq('workspace_id', workspaceId).order('updated_at', { ascending: false }).limit(10),
      callerClient.from('actions').select('title,status,deadline').eq('workspace_id', workspaceId).neq('status', 'done').limit(10),
      callerClient.from('decision_history').select('note,outcome,created_at').order('created_at', { ascending: false }).limit(10),
    ]);
    if (decisionsRes.error) return json({ error: decisionsRes.error.message }, 400);

    const context = `
Open/recent decisions:
${(decisionsRes.data ?? []).map((d) => `- "${d.title}" — status: ${d.status}${d.outcome ? `, outcome: ${d.outcome}` : ''}${d.deadline ? `, deadline: ${d.deadline}` : ''}`).join('\n') || '(none)'}

Recent discussions:
${(discussionsRes.data ?? []).map((d) => `- "${d.title}" (${d.status}): ${d.summary ?? ''}`).join('\n') || '(none)'}

Open actions:
${(actionsRes.data ?? []).map((a) => `- "${a.title}" — ${a.status}${a.deadline ? `, due ${a.deadline}` : ''}`).join('\n') || '(none)'}
`.trim();

    // Recent chat history for this user, so the assistant has conversational memory.
    const { data: priorMessages } = await callerClient
      .from('assistant_messages').select('role,content').eq('workspace_id', workspaceId).eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(10);
    const history = (priorMessages ?? []).reverse().map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));

    const systemPrompt = `You are PULSE AI, a decision-intelligence assistant embedded in a team's PULSE workspace. Answer using ONLY the workspace context below — if something isn't in it, say you don't have that information rather than guessing. Be concise and direct.\n\nWorkspace context:\n${context}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        system: systemPrompt,
        messages: [...history, { role: 'user', content }],
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      return json({ error: `AI provider error (${response.status}): ${text.slice(0, 300)}` }, 500);
    }
    const data = await response.json();
    const reply = (data.content ?? []).map((b: { type: string; text?: string }) => b.text ?? '').join('').trim();

    // Persist both sides of the exchange with the service-role client (bypasses RLS
    // insert restrictions only for the write itself; reads still respect RLS above).
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await adminClient.from('assistant_messages').insert({ workspace_id: workspaceId, user_id: userId, role: 'user', content });
    const { data: saved, error: saveError } = await adminClient
      .from('assistant_messages').insert({ workspace_id: workspaceId, user_id: userId, role: 'assistant', content: reply })
      .select('id,created_at').single();
    if (saveError) return json({ error: saveError.message }, 500);

    return json({ id: saved.id, content: reply, createdAt: saved.created_at });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
