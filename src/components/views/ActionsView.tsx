import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, ArrowUpRight, Calendar, CheckCircle2, CheckSquare, ExternalLink, ListFilter, Plus, Sparkles, User, Users, X } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { createAction, listActions, listDecisions, sendActionToJira, updateActionStatus, type WorkspaceMember } from '@/lib/pulseApi';
import type { ActionPriority, ActionStatus, DecisionSummary, WorkspaceAction } from '@/types';

const statusLabel: Record<ActionStatus, string> = { todo: 'To do', 'in-progress': 'In progress', done: 'Done' };
const priorityClasses: Record<ActionPriority, string> = {
  high: 'text-ember-300 bg-ember-500/15 border-ember-500/30',
  medium: 'text-alert-300 bg-alert-500/15 border-alert-500/30',
  low: 'text-ink-300 bg-white/5 border-white/10',
};

function isOverdue(a: WorkspaceAction) {
  return a.status !== 'done' && !!a.deadline && new Date(a.deadline).getTime() < Date.now();
}

function daysUntil(deadline: string | null) {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
}

function isAtRisk(a: WorkspaceAction) {
  if (a.status === 'done') return false;
  if (isOverdue(a)) return true;
  const days = daysUntil(a.deadline);
  return a.priority === 'high' || (days !== null && days <= 2);
}

function NewActionForm({ workspaceId, members, decisions, onCreated }: { workspaceId: string; members: WorkspaceMember[]; decisions: DecisionSummary[]; onCreated: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [decisionId, setDecisionId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState<ActionPriority>('medium');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim()) return;
    setBusy(true);
    try {
      await createAction(workspaceId, {
        title: title.trim(), description: description.trim(), ownerId: ownerId || null,
        decisionId: decisionId || null, deadline: deadline ? new Date(`${deadline}T23:59:00`).toISOString() : null, priority,
      }, user.id);
      setTitle(''); setDescription(''); setOwnerId(''); setDecisionId(''); setDeadline(''); setPriority('medium'); setOpen(false); onCreated();
    } finally { setBusy(false); }
  };

  if (!open) return <button onClick={() => setOpen(true)} className="primary-btn"><Plus className="h-4 w-4" /> New action</button>;

  return (
    <form onSubmit={submit} className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Create an action</h3><button type="button" onClick={() => setOpen(false)} className="icon-btn h-7 w-7"><X className="h-3.5 w-3.5" /></button></div>
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to happen?" className="field mt-3 text-sm" />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add context or acceptance criteria (optional)" rows={2} className="field mt-2 resize-none text-sm" />
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <select value={decisionId} onChange={(e) => setDecisionId(e.target.value)} className="field text-xs"><option value="">No linked decision</option>{decisions.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</select>
        <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="field text-xs"><option value="">Unassigned</option>{members.map((m) => <option key={m.userId} value={m.userId}>{m.name || m.email}</option>)}</select>
        <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="field text-xs" />
        <select value={priority} onChange={(e) => setPriority(e.target.value as ActionPriority)} className="field text-xs"><option value="low">Low priority</option><option value="medium">Medium priority</option><option value="high">High priority</option></select>
      </div>
      <button disabled={busy || !title.trim()} className="primary-btn mt-3 w-full justify-center disabled:opacity-40">{busy ? 'Creating…' : 'Create action'}</button>
    </form>
  );
}

function JiraButton({ action, onSent }: { action: WorkspaceAction; onSent: () => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const send = async () => { const projectKey = window.prompt('Jira project key (e.g. ENG):'); if (!projectKey?.trim()) return; setBusy(true); setError(''); const result = await sendActionToJira(action.id, projectKey.trim()); setBusy(false); if (result.error) setError(result.error); else onSent(); };
  if (action.jiraIssueKey) return <span className="text-[10px] text-flux-300">Jira: {action.jiraIssueKey}</span>;
  return <><button onClick={send} disabled={busy} className="flex items-center gap-1 text-[10px] font-medium text-pulse-300 disabled:opacity-40"><ExternalLink className="h-2.5 w-2.5" /> {busy ? 'Sending…' : 'Send to Jira'}</button>{error && <span className="text-[10px] text-ember-400">{error}</span>}</>;
}

export function ActionsView({ workspaceId, members }: { workspaceId: string; members: WorkspaceMember[] }) {
  const { user } = useAuth();
  const [actions, setActions] = useState<WorkspaceAction[]>([]);
  const [decisions, setDecisions] = useState<DecisionSummary[]>([]);
  const [filter, setFilter] = useState<'mine' | 'all' | 'overdue'>('mine');
  const [error, setError] = useState('');

  const load = () => Promise.all([listActions(workspaceId), listDecisions(workspaceId)]).then(([a, d]) => { setActions(a); setDecisions(d); }).catch((e) => setError(e instanceof Error ? e.message : 'Could not load actions'));
  useEffect(() => { load(); }, [workspaceId]);

  const visible = useMemo(() => actions.filter((a) => filter === 'mine' ? a.ownerId === user?.id : filter === 'overdue' ? isOverdue(a) : true), [actions, filter, user]);
  const counts = useMemo(() => ({ open: actions.filter((a) => a.status !== 'done').length, overdue: actions.filter(isOverdue).length, done: actions.filter((a) => a.status === 'done').length, atRisk: actions.filter(isAtRisk).length }), [actions]);
  const ownerLoad = useMemo(() => {
    const map = new Map<string, { name: string; open: number; overdue: number; high: number }>();
    actions.filter((a) => a.status !== 'done').forEach((a) => {
      const key = a.ownerId ?? 'unassigned';
      const current = map.get(key) ?? { name: a.ownerName ?? 'Unassigned', open: 0, overdue: 0, high: 0 };
      current.open += 1;
      if (isOverdue(a)) current.overdue += 1;
      if (a.priority === 'high') current.high += 1;
      map.set(key, current);
    });
    return [...map.entries()].sort((a, b) => (b[1].overdue * 3 + b[1].open) - (a[1].overdue * 3 + a[1].open)).slice(0, 5);
  }, [actions]);
  const focus = useMemo(() => actions.filter((a) => a.status !== 'done' && (a.ownerId === user?.id || a.ownerId === null)).sort((a, b) => {
    const risk = (x: WorkspaceAction) => (isOverdue(x) ? 100 : isAtRisk(x) ? 50 : 0) + (x.priority === 'high' ? 20 : x.priority === 'medium' ? 10 : 0) + (daysUntil(x.deadline) ?? 30) * -0.1;
    return risk(b) - risk(a);
  }).slice(0, 3), [actions, user]);

  const cycleStatus = async (a: WorkspaceAction) => {
    const next: ActionStatus = a.status === 'todo' ? 'in-progress' : a.status === 'in-progress' ? 'done' : 'todo';
    try { await updateActionStatus(a.id, next); load(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not update action'); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 pb-28 pt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="flex items-center gap-1.5 text-xs uppercase tracking-[.2em] text-pulse-300"><CheckSquare className="h-3.5 w-3.5" /> Execution</p><h1 className="mt-1 font-display text-2xl font-semibold">Actions</h1><p className="mt-1 text-xs text-ink-500">Turn decisions into work the team can actually finish.</p></div>
        <NewActionForm workspaceId={workspaceId} members={members} decisions={decisions} onCreated={load} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.35fr_.65fr]">
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.18em] text-pulse-300"><Sparkles className="h-3 w-3" /> PULSE execution intelligence</p>
              <h2 className="mt-1 text-sm font-semibold">Your highest-impact focus</h2>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-ink-500">{focus.length} suggested</span>
          </div>
          <div className="mt-3 space-y-2">
            {focus.map((a) => <div key={a.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[.025] p-2.5">
              <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{a.title}</p><p className="mt-0.5 text-[10px] text-ink-500">{isOverdue(a) ? 'Overdue' : isAtRisk(a) ? 'Needs attention' : 'Ready to execute'}{a.deadline ? ` · ${new Date(a.deadline).toLocaleDateString()}` : ''}</p></div>
              <span className={`rounded-full border px-1.5 py-0.5 text-[9px] ${priorityClasses[a.priority]}`}>{a.priority}</span>
            </div>)}
            {!focus.length && <p className="py-3 text-xs text-ink-500">Nothing urgent is assigned to you right now.</p>}
          </div>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.18em] text-ink-500"><Users className="h-3 w-3" /> Team load</p>
          <div className="mt-3 space-y-2.5">
            {ownerLoad.map(([id, load]) => <div key={id}><div className="flex items-center justify-between gap-2 text-[10px]"><span className="truncate text-ink-300">{load.name}</span><span className="text-ink-500">{load.open} open{load.overdue ? ` · ${load.overdue} overdue` : ''}</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-pulse-500" style={{ width: `${Math.min(100, load.open * 16 + load.overdue * 18)}%` }} /></div></div>)}
            {!ownerLoad.length && <p className="text-xs text-ink-500">No open work yet.</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div className="glass rounded-2xl p-3"><p className="text-[10px] uppercase tracking-wider text-ink-500">Open</p><p className="mt-1 text-xl font-semibold">{counts.open}</p></div>
        <div className="glass rounded-2xl p-3"><p className="text-[10px] uppercase tracking-wider text-ink-500">Overdue</p><p className="mt-1 text-xl font-semibold text-ember-300">{counts.overdue}</p></div>
        <div className="glass rounded-2xl p-3"><p className="text-[10px] uppercase tracking-wider text-ink-500">Completed</p><p className="mt-1 text-xl font-semibold text-flux-300">{counts.done}</p></div>
        <div className="glass rounded-2xl p-3"><p className="text-[10px] uppercase tracking-wider text-ink-500">At risk</p><p className="mt-1 text-xl font-semibold text-alert-300">{counts.atRisk}</p></div>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-white/[.03] p-1 text-[10px] font-semibold">
        <ListFilter className="ml-2 h-3.5 w-3.5 shrink-0 text-ink-500" />
        {([['mine', 'Mine'], ['all', 'All'], ['overdue', 'Overdue']] as const).map(([key, label]) => <button key={key} onClick={() => setFilter(key)} className={`rounded-xl px-3 py-1.5 ${filter === key ? 'bg-white/10 text-white' : 'text-ink-500'}`}>{label}</button>)}
      </div>

      {error && <p className="text-sm text-ember-400">{error}</p>}
      <div className="space-y-2">
        {visible.map((a) => <div key={a.id} className={`glass rounded-2xl p-3.5 ${isOverdue(a) ? 'border-ember-500/25' : ''}`}>
          <div className="flex items-start gap-3">
            <button aria-label={`Mark ${a.title} status`} onClick={() => cycleStatus(a)} className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border text-[10px] ${a.status === 'done' ? 'border-flux-500/40 bg-flux-500/20 text-flux-300' : 'border-white/20 text-transparent'}`}>{a.status === 'done' ? '✓' : '✓'}</button>
            <div className="min-w-0 flex-1"><p className={`text-sm font-medium ${a.status === 'done' ? 'text-ink-500 line-through' : 'text-ink-100'}`}>{a.title}</p>{a.description && <p className="mt-1 text-xs text-ink-500">{a.description}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-ink-500"><span className={`rounded-full border px-1.5 py-0.5 font-medium ${priorityClasses[a.priority]}`}>{a.priority}</span><span>{statusLabel[a.status]}</span>{isAtRisk(a) && <span className="flex items-center gap-1 text-alert-300"><ArrowUpRight className="h-3 w-3" /> Needs attention</span>}{a.ownerName && <span className="flex items-center gap-1"><User className="h-3 w-3" /> {a.ownerName}</span>}{a.deadline && <span className={`flex items-center gap-1 ${isOverdue(a) ? 'text-ember-300' : ''}`}><Calendar className="h-3 w-3" /> {isOverdue(a) ? 'Overdue · ' : ''}{new Date(a.deadline).toLocaleDateString()}</span>}{a.decisionTitle && <span className="rounded-full bg-pulse-500/10 px-2 py-0.5 text-pulse-300">Decision: {a.decisionTitle}</span>}<JiraButton action={a} onSent={load} /></div>
            </div>
            {a.status === 'done' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-flux-300" /> : isOverdue(a) ? <AlertTriangle className="h-4 w-4 shrink-0 text-ember-300" /> : null}
          </div>
        </div>)}
        {visible.length === 0 && <p className="py-10 text-center text-xs text-ink-500">No actions match this filter.</p>}
      </div>
    </div>
  );
}
