import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { listAssistantMessages, sendAssistantMessage } from '@/lib/pulseApi';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { AssistantMessage } from '@/types';

const suggestions = [
  'What decisions are currently stuck?',
  'Summarize this week\'s discussions.',
  'What are our biggest disagreements?',
  'What should we decide next?',
];

export function PulseAIView({ workspaceId }: { workspaceId: string }) {
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

  return (
    <div className="mx-auto flex h-[calc(100vh-2rem)] max-w-2xl flex-col px-4 pb-28 pt-5 lg:h-[calc(100vh-3rem)]">
      <div>
        <p className="flex items-center gap-1.5 text-xs uppercase tracking-[.2em] text-pulse-300"><Sparkles className="h-3.5 w-3.5" /> Phase 4 — AI</p>
        <h1 className="mt-1 font-display text-2xl font-semibold">PULSE AI</h1>
        {!isSupabaseConfigured && <p className="mt-1 text-xs text-ink-500">Connect Supabase and deploy the pulse-assistant function to enable this.</p>}
      </div>

      <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-ink-500">Try asking:</p>
            {suggestions.map((s) => (
              <button key={s} onClick={() => send(s)} className="glass block w-full rounded-xl px-3.5 py-2.5 text-left text-sm text-ink-300 hover:border-pulse-500/30">"{s}"</button>
            ))}
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

      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask PULSE AI about this workspace…" className="field flex-1 text-sm" />
        <button disabled={busy || !input.trim()} className="icon-btn shrink-0 bg-pulse-500/15 text-pulse-300 disabled:opacity-30"><Send className="h-4 w-4" /></button>
      </form>
    </div>
  );
}
