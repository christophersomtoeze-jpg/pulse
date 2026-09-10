import { useEffect, useMemo, useState } from 'react';
import { Brain, CalendarClock, CheckCircle2, Clock3, Search, Sparkles, Target, X } from 'lucide-react';
import { listDecisions, listDecisionHistory, searchDecisionHistory } from '@/lib/pulseApi';
import type { DecisionHistoryEntry, DecisionSummary } from '@/types';

interface MemoryItem extends DecisionHistoryEntry { decisionId: string; decisionTitle: string; }

function relativeDate(value: string) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function OutcomePill({ outcome }: { outcome: string | null }) {
  if (!outcome) return null;
  const label = outcome.charAt(0).toUpperCase() + outcome.slice(1);
  return <span className="rounded-full border border-emerald-400/15 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-200">{label}</span>;
}

export function MemoryView({ workspaceId, onOpenDecision }: { workspaceId: string; onOpenDecision: (id: string) => void }) {
  const [decisions, setDecisions] = useState<DecisionSummary[]>([]);
  const [timeline, setTimeline] = useState<MemoryItem[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<DecisionSummary | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<DecisionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true); setError('');
    try {
      const [ds, history] = await Promise.all([listDecisions(workspaceId), searchDecisionHistory(workspaceId, '')]);
      setDecisions(ds); setTimeline(history);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load organizational memory'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); }, [workspaceId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return timeline;
    return timeline.filter(item => item.decisionTitle.toLowerCase().includes(q) || (item.note ?? '').toLowerCase().includes(q) || (item.outcome ?? '').toLowerCase().includes(q) || (item.changedByName ?? '').toLowerCase().includes(q));
  }, [timeline, query]);

  const recentDecisions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return decisions.filter(d => !q || `${d.title} ${d.description} ${d.outcome ?? ''}`.toLowerCase().includes(q)).slice(0, 8);
  }, [decisions, query]);

  const openMemory = async (decision: DecisionSummary) => {
    setSelected(decision);
    try { setSelectedHistory(await listDecisionHistory(decision.id)); } catch { setSelectedHistory([]); }
  };

  return <div className="mx-auto max-w-4xl space-y-4 px-4 pb-28 pt-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="flex items-center gap-1.5 text-xs uppercase tracking-[.2em] text-pulse-300"><Brain className="h-3.5 w-3.5" /> Organizational memory</p>
        <h1 className="mt-1 font-display text-2xl font-semibold">What PULSE remembers</h1>
        <p className="mt-1 max-w-2xl text-xs text-ink-500">Preserve the story behind decisions — what changed, who changed it, and what your team chose.</p>
      </div>
      <button onClick={() => void refresh()} className="rounded-xl border border-white/10 px-3 py-2 text-[11px] text-ink-300 hover:bg-white/5">Refresh memory</button>
    </div>

    <div className="glass rounded-2xl p-3">
      <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-600" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search decisions, reasoning, outcomes, people…" className="field pl-9 pr-9" />{query && <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-white"><X className="h-4 w-4" /></button>}</div>
    </div>

    {error && <div className="rounded-xl border border-ember-400/20 bg-ember-400/5 p-3 text-xs text-ember-300">{error}</div>}
    {loading ? <div className="glass rounded-2xl p-8 text-center text-xs text-ink-500">Reconstructing your workspace memory…</div> : <>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="glass rounded-2xl p-4"><Brain className="h-4 w-4 text-pulse-300" /><p className="mt-2 font-display text-2xl font-bold">{decisions.length}</p><p className="text-[10px] text-ink-500">Decisions remembered</p></div>
        <div className="glass rounded-2xl p-4"><CalendarClock className="h-4 w-4 text-pulse-300" /><p className="mt-2 font-display text-2xl font-bold">{timeline.length}</p><p className="text-[10px] text-ink-500">Decision events</p></div>
        <div className="glass rounded-2xl p-4"><CheckCircle2 className="h-4 w-4 text-emerald-300" /><p className="mt-2 font-display text-2xl font-bold">{decisions.filter(d => d.outcome).length}</p><p className="text-[10px] text-ink-500">Outcomes captured</p></div>
        <div className="glass rounded-2xl p-4"><Clock3 className="h-4 w-4 text-amber-300" /><p className="mt-2 font-display text-2xl font-bold">{decisions.filter(d => d.status !== 'decided').length}</p><p className="text-[10px] text-ink-500">Still in motion</p></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
        <section className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Decision timeline</h2><p className="text-[10px] text-ink-500">The permanent trail behind your team's choices</p></div><Target className="h-4 w-4 text-pulse-300" /></div>
          <div className="mt-4 space-y-2">
            {filtered.slice(0, 30).map(item => <button key={item.id} onClick={() => { const d = decisions.find(x => x.id === item.decisionId); if (d) void openMemory(d); }} className="flex w-full items-start gap-3 rounded-xl border border-white/5 bg-white/[.02] p-3 text-left hover:bg-white/[.045]">
              <div className="mt-0.5 h-7 w-7 shrink-0 rounded-lg bg-gradient-to-br from-[#7c3aed]/25 to-[#06b6d4]/15 grid place-items-center"><Sparkles className="h-3.5 w-3.5 text-pulse-300" /></div>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-xs font-semibold text-ink-100">{item.decisionTitle}</p><OutcomePill outcome={item.outcome} /></div><p className="mt-1 text-[11px] text-ink-400">{item.note || `Status changed to ${item.status ?? 'updated'}.`}</p><p className="mt-1 text-[9px] text-ink-600">{relativeDate(item.createdAt)} · {item.changedByName ?? 'PULSE member'}</p></div>
            </button>)}
            {filtered.length === 0 && <div className="rounded-xl border border-white/5 p-5 text-center text-xs text-ink-500">No memory matches that search.</div>}
          </div>
        </section>

        <section className="glass rounded-2xl p-4">
          <div><h2 className="text-sm font-semibold">Decision archive</h2><p className="text-[10px] text-ink-500">Open any decision's full memory trail</p></div>
          <div className="mt-4 space-y-2">{recentDecisions.map(d => <button key={d.id} onClick={() => void openMemory(d)} className="w-full rounded-xl border border-white/5 bg-white/[.02] p-3 text-left hover:bg-white/[.045]"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-ink-100">{d.title}</span><span className="text-[9px] text-ink-600">{relativeDate(d.updatedAt)}</span></div><p className="mt-1 line-clamp-2 text-[10px] text-ink-500">{d.description || 'No decision description recorded.'}</p></button>)}{recentDecisions.length === 0 && <p className="text-xs text-ink-500">No decisions found.</p>}</div>
        </section>
      </div>
    </>}

    {selected && <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) setSelected(null); }}>
      <div className="glass-strong w-full max-w-2xl rounded-t-3xl p-5 sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] uppercase tracking-[.2em] text-pulse-300">Decision memory</p><h2 className="mt-1 font-display text-xl font-semibold">{selected.title}</h2><p className="mt-1 text-xs text-ink-500">{selected.description}</p></div><button onClick={() => setSelected(null)} className="icon-btn"><X className="h-4 w-4" /></button></div>
        <div className="mt-5 max-h-[55vh] space-y-2 overflow-y-auto">{selectedHistory.map(h => <div key={h.id} className="rounded-xl border border-white/5 bg-white/[.025] p-3"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-wider text-pulse-300">{h.outcome ? `Outcome · ${h.outcome}` : h.status ? `Status · ${h.status}` : 'Decision event'}</span><span className="text-[9px] text-ink-600">{relativeDate(h.createdAt)}</span></div>{h.note && <p className="mt-1.5 text-xs leading-5 text-ink-300">{h.note}</p>}<p className="mt-1 text-[9px] text-ink-600">Recorded by {h.changedByName ?? 'PULSE'}</p></div>)}{selectedHistory.length === 0 && <p className="py-6 text-center text-xs text-ink-500">No history events recorded yet.</p>}</div>
        <div className="mt-4 flex gap-2"><button onClick={() => { setSelected(null); onOpenDecision(selected.id); }} className="primary-btn flex-1 justify-center">Open Decision Room</button><button onClick={() => setSelected(null)} className="secondary-btn">Close</button></div>
      </div>
    </div>}
  </div>;
}
