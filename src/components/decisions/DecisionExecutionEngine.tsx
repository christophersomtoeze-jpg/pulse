import { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Circle, Clock3, Plus, Sparkles, Target } from 'lucide-react';
import { createAction, updateActionStatus, type WorkspaceMember } from '@/lib/pulseApi';
import type { DecisionIntelligence, DecisionSummary, WorkspaceAction, ActionPriority, ActionStatus } from '@/types';

interface Props {
  decision: DecisionSummary;
  actions: WorkspaceAction[];
  intelligence: DecisionIntelligence | null;
  members: WorkspaceMember[];
  userId: string;
  onChanged: () => void;
}

const nextStatus: Record<ActionStatus, ActionStatus> = { todo: 'in-progress', 'in-progress': 'done', done: 'todo' };

export function DecisionExecutionEngine({ decision, actions, intelligence, members, userId, onChanged }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [ownerId, setOwnerId] = useState(decision.ownerId ?? '');
  const [priority, setPriority] = useState<ActionPriority>('medium');

  const open = actions.filter((a) => a.status !== 'done');
  const done = actions.filter((a) => a.status === 'done').length;
  const progress = actions.length ? Math.round((done / actions.length) * 100) : 0;
  const suggestions = useMemo(() => {
    const existing = new Set(actions.map((a) => a.title.trim().toLowerCase()));
    return (intelligence?.nextActions ?? []).filter((a) => a.trim() && !existing.has(a.trim().toLowerCase())).slice(0, 6);
  }, [actions, intelligence]);

  const add = async (title: string) => {
    if (!title.trim()) return;
    setBusy(title);
    try {
      await createAction(decision.workspaceId, {
        title: title.trim(),
        description: `Execution step for: ${decision.title}`,
        decisionId: decision.id,
        ownerId: ownerId || decision.ownerId || null,
        priority,
      }, userId);
      onChanged();
    } finally { setBusy(null); }
  };

  const addAll = async () => {
    if (!suggestions.length) return;
    setCreating(true);
    try { for (const title of suggestions) await add(title); } finally { setCreating(false); }
  };

  const cycle = async (action: WorkspaceAction) => {
    setBusy(action.id);
    try { await updateActionStatus(action.id, nextStatus[action.status]); onChanged(); } finally { setBusy(null); }
  };

  return (
    <section className="glass rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.18em] text-pulse-300"><Target className="h-3 w-3" /> Execution Engine</p>
          <h3 className="mt-1 text-sm font-semibold">Turn this decision into an execution plan</h3>
          <p className="mt-1 text-[11px] text-ink-500">Track the work, owners and progress without losing the decision that caused it.</p>
        </div>
        <div className="text-right"><div className="text-lg font-semibold">{progress}%</div><div className="text-[9px] uppercase tracking-wider text-ink-500">complete</div></div>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-pulse-400 transition-all" style={{ width: `${progress}%` }} /></div>
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-ink-500"><span>{done} done</span><span>{open.length} open</span>{decision.deadline && <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> Decision due {new Date(decision.deadline).toLocaleDateString()}</span>}</div>

      {suggestions.length > 0 && (
        <div className="mt-4 rounded-xl border border-pulse-500/15 bg-pulse-500/[.04] p-3">
          <div className="flex items-center justify-between gap-2"><p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-pulse-300"><Sparkles className="h-3 w-3" /> AI execution steps</p><button onClick={addAll} disabled={creating} className="secondary-btn h-7 text-[10px]">{creating ? 'Adding…' : 'Add all'}</button></div>
          <div className="mt-2 space-y-1.5">
            {suggestions.map((s) => <div key={s} className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[.02] px-2.5 py-2"><span className="min-w-0 flex-1 text-xs text-ink-200">{s}</span><button onClick={() => add(s)} disabled={busy === s} className="icon-btn h-7 w-7 shrink-0"><Plus className="h-3.5 w-3.5" /></button></div>)}
          </div>
        </div>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
        <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="field text-xs"><option value="">Use decision owner / unassigned</option>{members.map((m) => <option key={m.userId} value={m.userId}>{m.name || m.email}</option>)}</select>
        <select value={priority} onChange={(e) => setPriority(e.target.value as ActionPriority)} className="field text-xs"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
      </div>

      <div className="mt-3 space-y-1.5">
        {actions.map((a) => <button key={a.id} onClick={() => cycle(a)} disabled={busy === a.id} className="flex w-full items-center gap-2 rounded-xl border border-white/5 bg-white/[.02] px-3 py-2 text-left hover:border-pulse-500/20 disabled:opacity-50">
          {a.status === 'done' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-flux-300" /> : <Circle className="h-4 w-4 shrink-0 text-ink-500" />}
          <span className={`min-w-0 flex-1 text-xs ${a.status === 'done' ? 'text-ink-500 line-through' : 'text-ink-200'}`}>{a.title}</span>
          <span className="text-[9px] uppercase tracking-wider text-ink-500">{a.status === 'todo' ? 'Start' : a.status === 'in-progress' ? 'Finish' : 'Reset'}</span><ArrowRight className="h-3 w-3 text-ink-600" />
        </button>)}
        {!actions.length && <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-[11px] text-ink-500">No execution steps yet. Run Decision Intelligence above to get AI-generated next actions.</div>}
      </div>
    </section>
  );
}
