import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckSquare, Clock3, Filter, ShieldAlert, Sparkles, Target, X } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { computeRisks, createAction } from '@/lib/pulseApi';
import type { RiskItem, RiskSeverity } from '@/types';
import type { AppView } from '@/lib/viewTypes';

const severityClasses: Record<RiskSeverity, string> = {
  high: 'text-ember-300 bg-ember-500/15 border-ember-500/30',
  medium: 'text-alert-300 bg-alert-500/15 border-alert-500/30',
  low: 'text-ink-300 bg-white/5 border-white/10',
};

const kindLabel: Record<RiskItem['kind'], string> = {
  'stalled-discussion': 'Stalled discussion',
  disagreement: 'Team disagreement',
  'missing-evidence': 'Decision needs evidence',
  'overdue-action': 'Overdue action',
};

const kindCopy: Record<RiskItem['kind'], string> = {
  'stalled-discussion': 'Restart the conversation or convert the blocker into a concrete action.',
  disagreement: 'Resolve the split before committing the team to an outcome.',
  'missing-evidence': 'Collect the missing evidence and bring it back into the Decision Room.',
  'overdue-action': 'Reassign, reschedule, or finish the action so execution can move again.',
};

export function RiskCenterView({ workspaceId, onNavigate, onOpenDecision }: { workspaceId: string; onNavigate: (view: AppView) => void; onOpenDecision: (id: string) => void }) {
  const { user } = useAuth();
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | RiskSeverity>('all');
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [resolved, setResolved] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setRisks(await computeRisks(workspaceId)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not compute risks'); }
    finally { setLoading(false); }
  }, [workspaceId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => { void load(); }, 30000);
    return () => window.clearInterval(timer);
  }, [load]);

  const visible = useMemo(() => risks.filter((r) => !resolved.includes(r.id) && (filter === 'all' || r.severity === filter)), [risks, filter, resolved]);
  const counts = useMemo(() => ({ high: risks.filter((r) => r.severity === 'high').length, medium: risks.filter((r) => r.severity === 'medium').length, total: risks.length }), [risks]);

  const takeAction = async (risk: RiskItem) => {
    if (!user) return;
    if (risk.kind === 'overdue-action') { onNavigate('actions'); return; }
    if (risk.kind === 'disagreement' || risk.kind === 'missing-evidence') { onOpenDecision(risk.linkId); return; }

    setWorkingId(risk.id);
    setError('');
    try {
      await createAction(workspaceId, {
        title: `Unblock: ${risk.title}`,
        description: `${kindCopy[risk.kind]} Risk detected by PULSE: ${risk.detail}`,
        ownerId: user.id,
        decisionId: null,
        deadline: null,
        priority: risk.severity === 'high' ? 'high' : 'medium',
      }, user.id);
      setResolved((current) => [...current, risk.id]);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create action'); }
    finally { setWorkingId(null); }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 pb-28 pt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-[.2em] text-pulse-300"><ShieldAlert className="h-3.5 w-3.5" /> Intelligence</p>
          <h1 className="mt-1 font-display text-2xl font-semibold">Risk Center</h1>
          <p className="mt-1 max-w-xl text-xs text-ink-500">PULSE continuously scans real workspace activity for stalled conversations, split decisions, missing evidence, and execution drift.</p>
        </div>
        <button onClick={() => void load()} className="secondary-btn self-start sm:self-auto"><Sparkles className="h-3.5 w-3.5" /> Scan again</button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="glass rounded-2xl p-3"><p className="text-[10px] uppercase tracking-wider text-ink-500">Active risks</p><p className="mt-1 text-xl font-semibold">{counts.total}</p></div>
        <div className="glass rounded-2xl p-3"><p className="text-[10px] uppercase tracking-wider text-ink-500">High priority</p><p className="mt-1 text-xl font-semibold text-ember-300">{counts.high}</p></div>
        <div className="glass rounded-2xl p-3"><p className="text-[10px] uppercase tracking-wider text-ink-500">Watch</p><p className="mt-1 text-xl font-semibold text-alert-300">{counts.medium}</p></div>
      </div>

      <div className="glass rounded-2xl p-3">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-ink-500"><Filter className="h-3.5 w-3.5" /> Filter risk level</div>
        <div className="mt-2 flex gap-1 overflow-x-auto">
          {([['all', 'All'], ['high', 'High'], ['medium', 'Watch'], ['low', 'Low']] as const).map(([key, label]) => <button key={key} onClick={() => setFilter(key)} className={`rounded-xl px-3 py-1.5 text-[10px] font-semibold ${filter === key ? 'bg-white/10 text-white' : 'text-ink-500 hover:text-ink-200'}`}>{label}</button>)}
        </div>
      </div>

      {error && <div className="glass rounded-2xl border-ember-500/20 p-3 text-sm text-ember-300">{error}</div>}
      {loading && <p className="py-8 text-center text-xs text-ink-500">Scanning workspace intelligence…</p>}

      {!loading && visible.length > 0 && <div className="space-y-2.5">
        {visible.map((risk) => (
          <article key={risk.id} className={`glass rounded-2xl p-4 ${risk.severity === 'high' ? 'border-ember-500/20' : ''}`}>
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${severityClasses[risk.severity]}`}><AlertTriangle className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${severityClasses[risk.severity]}`}>{risk.severity === 'high' ? 'High' : risk.severity === 'medium' ? 'Watch' : 'Low'}</span><span className="text-[10px] text-ink-500">{kindLabel[risk.kind]}</span></div>
                <h2 className="mt-2 text-sm font-semibold text-ink-100">{risk.title}</h2>
                <p className="mt-1 text-xs leading-5 text-ink-400">{risk.detail}</p>
                <div className="mt-2 flex items-start gap-1.5 text-[11px] text-ink-500"><Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pulse-300" />{kindCopy[risk.kind]}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => void takeAction(risk)} disabled={workingId === risk.id} className="primary-btn disabled:opacity-40">
                    {risk.kind === 'overdue-action' ? <><CheckSquare className="h-3.5 w-3.5" /> Open actions</> : risk.kind === 'disagreement' || risk.kind === 'missing-evidence' ? <><ArrowRight className="h-3.5 w-3.5" /> Open Decision Room</> : <><CheckSquare className="h-3.5 w-3.5" /> {workingId === risk.id ? 'Creating…' : 'Create unblock action'}</>}
                  </button>
                  <button onClick={() => setResolved((current) => [...current, risk.id])} className="secondary-btn"><X className="h-3.5 w-3.5" /> Dismiss for now</button>
                </div>
              </div>
              {risk.severity === 'high' ? <Clock3 className="h-4 w-4 shrink-0 text-ember-300" /> : null}
            </div>
          </article>
        ))}
      </div>}

      {!loading && visible.length === 0 && (
        <div className="glass rounded-3xl p-10 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-flux-500/20 bg-flux-500/10 text-flux-300"><ShieldAlert className="h-5 w-5" /></div>
          <p className="mt-4 text-sm font-semibold">No active risks in this view</p>
          <p className="mt-1 text-xs text-ink-500">PULSE is not seeing any qualifying blockers right now.</p>
        </div>
      )}
    </div>
  );
}
