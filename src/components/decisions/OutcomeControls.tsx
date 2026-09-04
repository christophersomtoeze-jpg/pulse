import { useState } from 'react';
import { CheckCircle2, Clock3, RefreshCw, XCircle } from 'lucide-react';
import type { DecisionHistoryEntry, DecisionOutcome } from '@/types';

interface OutcomeControlsProps {
  currentOutcome: DecisionOutcome | null;
  history: DecisionHistoryEntry[];
  canDecide: boolean;
  onSetOutcome: (outcome: DecisionOutcome, note: string) => Promise<void>;
}

const outcomes: { id: DecisionOutcome; label: string; icon: typeof CheckCircle2; classes: string }[] = [
  { id: 'approved', label: 'Approve', icon: CheckCircle2, classes: 'border-flux-500/30 bg-flux-500/10 text-flux-300' },
  { id: 'rejected', label: 'Reject', icon: XCircle, classes: 'border-ember-500/30 bg-ember-500/10 text-ember-300' },
  { id: 'postponed', label: 'Postpone', icon: RefreshCw, classes: 'border-alert-500/30 bg-alert-500/10 text-alert-300' },
];

export function OutcomeControls({ currentOutcome, history, canDecide, onSetOutcome }: OutcomeControlsProps) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<DecisionOutcome | null>(null);

  const decide = async (outcome: DecisionOutcome) => {
    setBusy(outcome);
    try { await onSetOutcome(outcome, note.trim()); setNote(''); } finally { setBusy(null); }
  };

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[.02] p-4">
      <h3 className="text-sm font-semibold">Decision outcome</h3>

      {canDecide ? (
        <>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note for the record…" className="field mt-3 text-xs" />
          <div className="mt-2 grid grid-cols-3 gap-2">
            {outcomes.map(({ id, label, icon: Icon, classes }) => (
              <button
                key={id}
                disabled={busy !== null}
                onClick={() => decide(id)}
                className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-medium disabled:opacity-40 ${
                  currentOutcome === id ? classes : 'border-white/5 bg-black/20 text-ink-300 hover:border-white/15'
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-2 text-xs text-ink-500">Only the decision owner or a workspace admin records the outcome.</p>
      )}

      {history.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-white/5 pt-3">
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-ink-500"><Clock3 className="h-3 w-3" /> History</p>
          {history.map((h) => (
            <div key={h.id} className="text-[11px] text-ink-400">
              <span className="text-ink-200">{h.changedByName ?? 'Someone'}</span>{' '}
              {h.outcome ? <>marked it <b className="text-ink-100">{h.outcome}</b></> : `set status to ${h.status}`}
              {h.note && <span className="text-ink-500"> — {h.note}</span>}
              <span className="text-ink-600"> · {new Date(h.createdAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
