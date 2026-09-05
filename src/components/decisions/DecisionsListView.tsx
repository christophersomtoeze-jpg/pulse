import { useEffect, useMemo, useState } from 'react';
import { Calendar, Plus, Search, User } from 'lucide-react';
import { searchDecisionHistory } from '@/lib/pulseApi';
import type { DecisionHistorySearchEntry } from '@/lib/pulseApi';
import type { DecisionSummary } from '@/types';

const pill: Record<string, string> = {
  approved: 'text-flux-300 bg-flux-500/15 border-flux-500/30',
  rejected: 'text-ember-300 bg-ember-500/15 border-ember-500/30',
  postponed: 'text-alert-300 bg-alert-500/15 border-alert-500/30',
};

interface DecisionsListViewProps {
  workspaceId: string;
  decisions: DecisionSummary[];
  onOpen: (id: string) => void;
  onNew: () => void;
}

export function DecisionsListView({ workspaceId, decisions, onOpen, onNew }: DecisionsListViewProps) {
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<DecisionHistorySearchEntry[]>([]);

  useEffect(() => {
    if (tab !== 'history') return;
    const timer = setTimeout(() => { searchDecisionHistory(workspaceId, query).then(setHistory).catch(() => {}); }, 200);
    return () => clearTimeout(timer);
  }, [tab, query, workspaceId]);

  const visibleDecisions = useMemo(
    () => decisions.filter((d) => `${d.title} ${d.description}`.toLowerCase().includes(query.toLowerCase())),
    [decisions, query]
  );

  return (
    <div className="mx-auto max-w-2xl px-4 pb-28 pt-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[.2em] text-pulse-300">Decision Room</p>
          <h1 className="mt-1 font-display text-2xl font-semibold">Decisions</h1>
        </div>
        <button onClick={onNew} className="primary-btn"><Plus className="h-4 w-4" /> New decision</button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5 text-[10px] font-semibold">
          <button onClick={() => setTab('active')} className={`rounded-full px-2.5 py-1 ${tab === 'active' ? 'bg-[#7c3aed] text-white' : 'text-ink-400'}`}>Active</button>
          <button onClick={() => setTab('history')} className={`rounded-full px-2.5 py-1 ${tab === 'history' ? 'bg-[#7c3aed] text-white' : 'text-ink-400'}`}>History</button>
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tab === 'active' ? 'Search decisions…' : 'Search decision history…'} className="field pl-9 text-sm" />
        </div>
      </div>

      {tab === 'active' ? (
        <div className="mt-4 space-y-2.5">
          {visibleDecisions.map((d) => {
            const key = d.outcome ?? '';
            const label = d.outcome ?? (d.status === 'in-review' ? 'In review' : d.status);
            return (
              <button key={d.id} onClick={() => onOpen(d.id)} className="glass block w-full rounded-2xl p-4 text-left hover:border-pulse-500/30">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-sm font-semibold">{d.title}</h3>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold ${pill[key] ?? 'text-ink-300 bg-white/5 border-white/10'}`}>{label}</span>
                </div>
                {d.description && <p className="mt-1 line-clamp-2 text-xs text-ink-400">{d.description}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-ink-500">
                  {d.ownerName && <span className="flex items-center gap-1"><User className="h-3 w-3" /> {d.ownerName}</span>}
                  {d.deadline && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(d.deadline).toLocaleDateString()}</span>}
                </div>
              </button>
            );
          })}
          {visibleDecisions.length === 0 && (
            <div className="glass rounded-2xl p-8 text-center">
              <p className="text-sm text-ink-400">No decisions match.</p>
              <button onClick={onNew} className="primary-btn mt-3 justify-center"><Plus className="h-4 w-4" /> Create one</button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {history.map((h) => (
            <button key={h.id} onClick={() => onOpen(h.decisionId)} className="glass block w-full rounded-2xl p-3.5 text-left hover:border-pulse-500/30">
              <p className="text-sm font-medium">{h.decisionTitle}</p>
              <p className="mt-0.5 text-xs text-ink-400">
                {h.changedByName ?? 'Someone'} {h.outcome ? <>marked it <b className="text-ink-200">{h.outcome}</b></> : `set status to ${h.status}`}
                {h.note && <span className="text-ink-500"> — {h.note}</span>}
              </p>
              <p className="mt-0.5 text-[10px] text-ink-600">{new Date(h.createdAt).toLocaleString()}</p>
            </button>
          ))}
          {history.length === 0 && <p className="py-8 text-center text-xs text-ink-500">No history entries match.</p>}
        </div>
      )}
    </div>
  );
}
