import { Calendar, Plus, User } from 'lucide-react';
import type { DecisionSummary } from '@/types';

const pill: Record<string, string> = {
  approved: 'text-flux-300 bg-flux-500/15 border-flux-500/30',
  rejected: 'text-ember-300 bg-ember-500/15 border-ember-500/30',
  postponed: 'text-alert-300 bg-alert-500/15 border-alert-500/30',
};

interface DecisionsListViewProps {
  decisions: DecisionSummary[];
  onOpen: (id: string) => void;
  onNew: () => void;
}

export function DecisionsListView({ decisions, onOpen, onNew }: DecisionsListViewProps) {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-28 pt-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[.2em] text-pulse-300">Decision Room</p>
          <h1 className="mt-1 font-display text-2xl font-semibold">All decisions</h1>
        </div>
        <button onClick={onNew} className="primary-btn"><Plus className="h-4 w-4" /> New decision</button>
      </div>

      <div className="mt-6 space-y-2.5">
        {decisions.map((d) => {
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
        {decisions.length === 0 && (
          <div className="glass rounded-2xl p-8 text-center">
            <p className="text-sm text-ink-400">No decisions yet.</p>
            <button onClick={onNew} className="primary-btn mt-3 justify-center"><Plus className="h-4 w-4" /> Create the first one</button>
          </div>
        )}
      </div>
    </div>
  );
}
