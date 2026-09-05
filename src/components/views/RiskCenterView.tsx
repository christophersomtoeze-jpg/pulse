import { useEffect, useState } from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { computeRisks } from '@/lib/pulseApi';
import type { RiskItem, RiskSeverity } from '@/types';

const severityClasses: Record<RiskSeverity, string> = {
  high: 'text-ember-300 bg-ember-500/15 border-ember-500/30',
  medium: 'text-alert-300 bg-alert-500/15 border-alert-500/30',
  low: 'text-ink-300 bg-white/5 border-white/10',
};

const kindLabel: Record<RiskItem['kind'], string> = {
  'stalled-discussion': 'Stalled discussion',
  disagreement: 'Team disagreement',
  'missing-evidence': 'Missing evidence',
  'overdue-action': 'Overdue action',
};

export function RiskCenterView({ workspaceId }: { workspaceId: string }) {
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    computeRisks(workspaceId).then(setRisks).catch((e) => setError(e instanceof Error ? e.message : 'Could not compute risks')).finally(() => setLoading(false));
  }, [workspaceId]);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-28 pt-5">
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-[.2em] text-pulse-300"><ShieldAlert className="h-3.5 w-3.5" /> Phase 4 — AI</p>
      <h1 className="mt-1 font-display text-2xl font-semibold">Risk Center</h1>
      <p className="mt-1 text-xs text-ink-500">Computed live from your real workspace data — nothing here is a canned example.</p>

      {error && <p className="mt-4 text-sm text-ember-400">{error}</p>}
      {loading && <p className="mt-6 text-center text-xs text-ink-500">Scanning workspace…</p>}

      <div className="mt-5 space-y-2.5">
        {risks.map((r) => (
          <div key={r.id} className="glass rounded-2xl p-3.5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-ember-300" />
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${severityClasses[r.severity]}`}>{kindLabel[r.kind]}</span>
            </div>
            <p className="mt-2 text-sm font-medium">{r.title}</p>
            <p className="mt-0.5 text-xs text-ink-400">{r.detail}</p>
          </div>
        ))}
        {!loading && risks.length === 0 && (
          <div className="glass rounded-2xl p-8 text-center">
            <p className="text-sm text-ink-300">No risks detected right now.</p>
            <p className="mt-1 text-xs text-ink-500">Nothing stalled, no split votes, no undecided items sitting too long.</p>
          </div>
        )}
      </div>
    </div>
  );
}
