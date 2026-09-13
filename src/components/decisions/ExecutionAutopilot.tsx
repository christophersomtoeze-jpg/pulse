import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock3, Play, UserRound, Zap } from 'lucide-react';
import { updateActionStatus, updateActionOwner, type WorkspaceMember } from '@/lib/pulseApi';
import type { DecisionSummary, WorkspaceAction, ActionStatus } from '@/types';

interface Props { decision: DecisionSummary; actions: WorkspaceAction[]; members: WorkspaceMember[]; userId: string; onChanged: () => void; }
type Health = 'on-track' | 'attention' | 'at-risk';
interface Signal { id: string; kind: 'overdue' | 'stalled' | 'unassigned' | 'deadline'; title: string; detail: string; actionId?: string; }

export function ExecutionAutopilot({ decision, actions, members, userId, onChanged }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const now = Date.now();
  const signals = useMemo<Signal[]>(() => {
    const result: Signal[] = [];
    for (const action of actions) {
      if (action.status === 'done') continue;
      if (action.deadline && new Date(action.deadline).getTime() < now) result.push({ id: `overdue-${action.id}`, kind: 'overdue', title: action.title, detail: `Overdue since ${new Date(action.deadline).toLocaleDateString()}.`, actionId: action.id });
      else if (!action.ownerId) result.push({ id: `unassigned-${action.id}`, kind: 'unassigned', title: action.title, detail: 'No owner is assigned yet.', actionId: action.id });
      else if (action.status === 'todo' && (now - new Date(action.createdAt).getTime()) > 5 * 86400000) result.push({ id: `stalled-${action.id}`, kind: 'stalled', title: action.title, detail: 'Open for more than 5 days without starting.', actionId: action.id });
    }
    if (decision.deadline && new Date(decision.deadline).getTime() > now) {
      const days = (new Date(decision.deadline).getTime() - now) / 86400000;
      const open = actions.filter(a => a.status !== 'done').length;
      if (days <= 3 && open > 0) result.push({ id: 'decision-deadline', kind: 'deadline', title: decision.title, detail: `${open} execution step${open === 1 ? '' : 's'} remain with ${Math.ceil(days)} day${Math.ceil(days) === 1 ? '' : 's'} left.` });
    }
    return result.slice(0, 8);
  }, [actions, decision, now]);
  const done = actions.filter(a => a.status === 'done').length;
  const progress = actions.length ? Math.round(done / actions.length * 100) : 0;
  const health: Health = signals.some(s => s.kind === 'overdue' || s.kind === 'deadline') ? 'at-risk' : signals.length ? 'attention' : 'on-track';
  const healthLabel = health === 'on-track' ? 'On track' : health === 'attention' ? 'Needs attention' : 'At risk';
  const healthClass = health === 'on-track' ? 'text-flux-300 bg-flux-500/10 border-flux-500/20' : health === 'attention' ? 'text-alert-300 bg-alert-500/10 border-alert-500/20' : 'text-ember-300 bg-ember-500/10 border-ember-500/20';
  const setStatus = async (id: string, status: ActionStatus) => { setBusy(id); try { await updateActionStatus(id, status); onChanged(); } finally { setBusy(null); } };
  const assignOwner = async (action: WorkspaceAction) => {
    const owner = members.find(m => m.userId === decision.ownerId) ?? members[0]; if (!owner) return;
    setBusy(action.id); try { await updateActionOwner(action.id, owner.userId); onChanged(); } finally { setBusy(null); }
  };
  return <section className="glass rounded-2xl p-4">
    <div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.18em] text-pulse-300"><Zap className="h-3 w-3" /> Execution Autopilot</p><h3 className="mt-1 text-sm font-semibold">Watch the work, not just the decision</h3><p className="mt-1 text-[11px] text-ink-500">PULSE checks live execution signals and surfaces what needs attention.</p></div><span className={`rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-wider ${healthClass}`}>{healthLabel}</span></div>
    <div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl border border-white/5 bg-white/[.02] p-2.5"><p className="text-[9px] uppercase tracking-wider text-ink-500">Progress</p><p className="mt-1 text-base font-semibold">{progress}%</p></div><div className="rounded-xl border border-white/5 bg-white/[.02] p-2.5"><p className="text-[9px] uppercase tracking-wider text-ink-500">Open</p><p className="mt-1 text-base font-semibold">{actions.length - done}</p></div><div className="rounded-xl border border-white/5 bg-white/[.02] p-2.5"><p className="text-[9px] uppercase tracking-wider text-ink-500">Signals</p><p className="mt-1 text-base font-semibold">{signals.length}</p></div></div>
    <div className="mt-4 space-y-2">{signals.length === 0 ? <div className="flex items-center gap-2 rounded-xl border border-flux-500/15 bg-flux-500/[.04] p-3 text-xs text-ink-300"><CheckCircle2 className="h-4 w-4 text-flux-300" /> No execution risks detected right now.</div> : signals.map(signal => { const action = signal.actionId ? actions.find(a => a.id === signal.actionId) : null; return <div key={signal.id} className="rounded-xl border border-white/5 bg-white/[.02] p-3"><div className="flex items-start gap-2">{signal.kind === 'overdue' || signal.kind === 'deadline' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-ember-300" /> : signal.kind === 'unassigned' ? <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-alert-300" /> : <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-alert-300" />}<div className="min-w-0 flex-1"><p className="text-xs font-medium text-ink-200">{signal.title}</p><p className="mt-0.5 text-[10px] text-ink-500">{signal.detail}</p></div>{action && <div className="flex shrink-0 gap-1.5">{signal.kind === 'unassigned' && <button onClick={() => assignOwner(action)} disabled={busy === action.id} className="secondary-btn h-7 text-[9px]">{busy === action.id ? 'Working…' : 'Assign'}</button>}{action.status === 'todo' && signal.kind !== 'overdue' && <button onClick={() => setStatus(action.id, 'in-progress')} disabled={busy === action.id} className="icon-btn h-7 w-7"><Play className="h-3 w-3" /></button>}{action.status === 'in-progress' && <button onClick={() => setStatus(action.id, 'done')} disabled={busy === action.id} className="secondary-btn h-7 text-[9px]">Complete</button>}</div>}</div></div>; })}</div>
    <div className="mt-3 flex items-center gap-1.5 text-[9px] text-ink-600"><Activity className="h-3 w-3" /> Signals are computed from live decision and action data.</div>
  </section>;
}
