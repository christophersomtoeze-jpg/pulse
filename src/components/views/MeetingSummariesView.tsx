import { useEffect, useState, type FormEvent } from 'react';
import { ClipboardList, Plus, X } from 'lucide-react';
import { createMeetingSummary, listMeetingSummaries } from '@/lib/pulseApi';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { MeetingSummary } from '@/types';

function NewSummaryForm({ workspaceId, onCreated }: { workspaceId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !notes.trim()) return;
    setBusy(true); setError('');
    try { await createMeetingSummary(workspaceId, title.trim(), notes.trim()); setTitle(''); setNotes(''); setOpen(false); onCreated(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not summarize these notes'); }
    finally { setBusy(false); }
  };

  if (!open) return <button onClick={() => setOpen(true)} className="primary-btn"><Plus className="h-4 w-4" /> Summarize a meeting</button>;

  return (
    <form onSubmit={submit} className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">New meeting summary</h3><button type="button" onClick={() => setOpen(false)} className="icon-btn h-7 w-7"><X className="h-3.5 w-3.5" /></button></div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Meeting title" className="field mt-3 text-sm" />
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Paste your raw notes or transcript here…" className="field mt-2 min-h-32 resize-none text-sm" />
      {error && <p className="mt-2 text-xs text-ember-400">{error}</p>}
      <button disabled={busy || !title.trim() || !notes.trim()} className="primary-btn mt-3 w-full justify-center disabled:opacity-40">{busy ? 'Summarizing…' : 'Generate summary'}</button>
    </form>
  );
}

function SummaryCard({ s }: { s: MeetingSummary }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="glass rounded-2xl p-4">
      <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-between text-left">
        <span className="font-display text-sm font-semibold">{s.title}</span>
        <span className="text-[10px] text-ink-500">{new Date(s.createdAt).toLocaleDateString()}</span>
      </button>
      {s.summary && <p className="mt-2 text-xs text-ink-300">{s.summary}</p>}
      {expanded && (
        <div className="mt-3 space-y-2 border-t border-white/5 pt-3 text-xs">
          {s.keyPoints && <div><p className="font-semibold text-ink-200">Key points</p><p className="mt-0.5 whitespace-pre-line text-ink-400">{s.keyPoints}</p></div>}
          {s.actionItems && <div><p className="font-semibold text-ink-200">Action items</p><p className="mt-0.5 whitespace-pre-line text-ink-400">{s.actionItems}</p></div>}
        </div>
      )}
    </div>
  );
}

export function MeetingSummariesView({ workspaceId }: { workspaceId: string }) {
  const [summaries, setSummaries] = useState<MeetingSummary[]>([]);
  const [error, setError] = useState('');

  const load = () => listMeetingSummaries(workspaceId).then(setSummaries).catch((e) => setError(e instanceof Error ? e.message : 'Could not load summaries'));
  useEffect(() => { load(); }, [workspaceId]);

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pb-28 pt-5">
      <div>
        <p className="flex items-center gap-1.5 text-xs uppercase tracking-[.2em] text-pulse-300"><ClipboardList className="h-3.5 w-3.5" /> Phase 4 — AI</p>
        <h1 className="mt-1 font-display text-2xl font-semibold">Meeting Summaries</h1>
        {!isSupabaseConfigured && <p className="mt-1 text-xs text-ink-500">Connect Supabase and deploy the meeting-summary function to enable this.</p>}
      </div>

      <NewSummaryForm workspaceId={workspaceId} onCreated={load} />
      {error && <p className="text-sm text-ember-400">{error}</p>}

      <div className="space-y-2.5">
        {summaries.map((s) => <SummaryCard key={s.id} s={s} />)}
        {summaries.length === 0 && <p className="py-8 text-center text-xs text-ink-500">No meeting summaries yet.</p>}
      </div>
    </div>
  );
}
