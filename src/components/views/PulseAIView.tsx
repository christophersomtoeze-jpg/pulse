import { useEffect, useRef, useState, type FormEvent } from 'react';
import { BrainCircuit, CheckCircle2, CircleAlert, ListChecks, Send, Sparkles, WandSparkles } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { listAssistantMessages, sendAssistantMessage } from '@/lib/pulseApi';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { AssistantMessage } from '@/types';

const suggestions = [
  { label: 'Workspace brief', icon: BrainCircuit, prompt: 'Give me a concise executive brief of this workspace: current decisions, open actions, major risks, and the most important next step.' },
  { label: 'Stuck decisions', icon: CircleAlert, prompt: 'Which decisions appear stuck or need attention? Explain why using only the workspace data.' },
  { label: 'Team alignment', icon: CheckCircle2, prompt: 'Where is the team aligned or potentially misaligned? Highlight evidence from the workspace context.' },
  { label: 'Next actions', icon: ListChecks, prompt: 'What are the most important next actions for this workspace? Prioritize them and explain why.' },
];

export function PulseAIView({ workspaceId, aiEnabled = true }: { workspaceId: string; aiEnabled?: boolean }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    listAssistantMessages(workspaceId, user.id).then(setMessages).catch((e) => setError(e instanceof Error ? e.message : 'Could not load chat history'));
  }, [workspaceId, user]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (text: string) => {
    if (!aiEnabled) return;
    if (!text.trim() || busy) return;
    setBusy(true); setError('');
    setMessages((m) => [...m, { id: `temp-${Date.now()}`, role: 'user', content: text, createdAt: new Date().toISOString() }]);
    setInput('');
    try {
      const reply = await sendAssistantMessage(workspaceId, text.trim());
      setMessages((m) => [...m, reply]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The assistant could not respond');
    } finally { setBusy(false); }
  };

  const submit = (e: FormEvent) => { e.preventDefault(); send(input); };

  const clearChat = () => { setMessages([]); setError(''); };

  const askSuggestion = (prompt: string) => { void send(prompt); };

  return (
    <div className="mx-auto flex h-[calc(100vh-2rem)] max-w-2xl flex-col px-4 pb-28 pt-5 lg:h-[calc(100vh-3rem)]">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-[.2em] text-pulse-300"><Sparkles className="h-3.5 w-3.5" /> Decision intelligence</p>
            <h1 className="mt-1 font-display text-2xl font-semibold">PULSE AI</h1>
            <p className="mt-1 max-w-xl text-xs leading-5 text-ink-500">A workspace-aware copilot for decisions, alignment, risks and execution. It answers from PULSE data instead of inventing facts.</p>
          </div>
          {messages.length > 0 && <button type="button" onClick={clearChat} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-ink-400 hover:bg-white/5 hover:text-white">Clear chat</button>}
        </div>
        {!isSupabaseConfigured && <p className="mt-1 text-xs text-ink-500">Connect Supabase and deploy the pulse-assistant function to enable this.</p>}
        {isSupabaseConfigured && !aiEnabled && <p className="mt-1 text-xs text-alert-300">AI features are turned off for this workspace — an admin can re-enable them in Settings &gt; AI Settings.</p>}
      </div>

      <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-ink-500">Try asking:</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {suggestions.map(({ label, icon: Icon, prompt }) => (
                <button key={label} onClick={() => askSuggestion(prompt)} disabled={busy || !aiEnabled} className="glass rounded-xl border border-white/5 px-3.5 py-3 text-left transition hover:border-pulse-500/30 hover:bg-white/[.04] disabled:opacity-40">
                  <span className="flex items-center gap-2 text-xs font-semibold text-ink-200"><Icon className="h-4 w-4 text-pulse-300" /> {label}</span>
                  <span className="mt-1.5 block text-[11px] leading-4 text-ink-500">{prompt}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${m.role === 'user' ? 'ml-auto bg-[#7c3aed]/20 text-ink-50' : 'glass text-ink-200'}`}>
            {m.content}
          </div>
        ))}
        {busy && <div className="glass max-w-[60%] rounded-2xl px-3.5 py-2.5 text-sm text-ink-500">Thinking…</div>}
        {error && <p className="text-xs text-ember-400">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <div className="mb-2 flex items-center justify-between text-[10px] text-ink-600"><span className="flex items-center gap-1"><WandSparkles className="h-3 w-3" /> Grounded in your PULSE workspace</span><span>{messages.length}/100 messages</span></div>
      <form onSubmit={submit} className="mt-0 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask PULSE AI about this workspace…" className="field flex-1 text-sm" />
        <button disabled={busy || !input.trim() || !aiEnabled} className="icon-btn shrink-0 bg-pulse-500/15 text-pulse-300 disabled:opacity-30"><Send className="h-4 w-4" /></button>
      </form>
    </div>
  );
}
