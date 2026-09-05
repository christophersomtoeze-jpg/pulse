import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Calendar, CheckSquare, Plus, User, X } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { createAction, listActions, updateActionStatus, type WorkspaceMember } from '@/lib/pulseApi';
import type { ActionPriority, ActionStatus, WorkspaceAction } from '@/types';

const statusLabel: Record<ActionStatus, string> = { todo: 'To do', 'in-progress': 'In progress', done: 'Done' };
const priorityClasses: Record<ActionPriority, string> = {
  high: 'text-ember-300 bg-ember-500/15 border-ember-500/30',
  medium: 'text-alert-300 bg-alert-500/15 border-alert-500/30',
  low: 'text-ink-300 bg-white/5 border-white/10',
};

function NewActionForm({ workspaceId, members, onCreated }: { workspaceId: string; members: WorkspaceMember[]; onCreated: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState<ActionPriority>('medium');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim()) return;
    setBusy(true);
    try {
      await createAction(workspaceId, { title: title.trim(), ownerId: ownerId || null, deadline: deadline ? new Date(deadline).toISOString() : null, priority }, user.id);
      setTitle(''); setOwnerId(''); setDeadline(''); setPriority('medium'); setOpen(false);
      onCreated();
    } finally { setBusy(false); }
  };

  if (!open) return <button onClick={() => setOpen(true)} className="primary-btn"><Plus className="h-4 w-4" /> New action</button>;

  return (
    <form onSubmit={submit} className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">New action</h3><button type="button" onClick={() => setOpen(false)} className="icon-btn h-7 w-7"><X className="h-3.5 w-3.5" /></button></div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to happen?" className="field mt-3 text-sm" />
      <div className="mt-2 grid grid-cols-3 gap-2">
        <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="field text-xs">
          <option value="">Unassigned</option>
          {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
        </select>
        <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="field text-xs" />
        <select value={priority} onChange={(e) => setPriority(e.target.value as ActionPriority)} className="field text-xs">
          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
        </select>
      </div>
      <button disabled={busy || !title.trim()} className="primary-btn mt-3 w-full justify-center disabled:opacity-40">{busy ? 'Creating…' : 'Create action'}</button>
    </form>
  );
}

export function ActionsView({ workspaceId, members }: { workspaceId: string; members: WorkspaceMember[] }) {
  const { user } = useAuth();
  const [actions, setActions] = useState<WorkspaceAction[]>([]);
  const [filter, setFilter] = useState<'mine' | 'all'>('mine');
  const [error, setError] = useState('');

  const load = () => listActions(workspaceId).then(setActions).catch((e) => setError(e instanceof Error ? e.message : 'Could not load actions'));
  useEffect(() => { load(); }, [workspaceId]);

  const visible = useMemo(() => actions.filter((a) => filter === 'all' || a.ownerId === user?.id), [actions, filter, user]);
  const cycleStatus = async (a: WorkspaceAction) => {
    const next: ActionStatus = a.status === 'todo' ? 'in-progress' : a.status === 'in-progress' ? 'done' : 'todo';
    await updateActionStatus(a.id, next);
    load();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pb-28 pt-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-[.2em] text-pulse-300"><CheckSquare className="h-3.5 w-3.5" /> Workspace</p>
          <h1 className="mt-1 font-display text-2xl font-semibold">Actions</h1>
        </div>
        <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5 text-[10px] font-semibold">
          <button onClick={() => setFilter('mine')} className={`rounded-full px-2.5 py-1 ${filter === 'mine' ? 'bg-[#7c3aed] text-white' : 'text-ink-400'}`}>Mine</button>
          <button onClick={() => setFilter('all')} className={`rounded-full px-2.5 py-1 ${filter === 'all' ? 'bg-[#7c3aed] text-white' : 'text-ink-400'}`}>All</button>
        </div>
      </div>

      <NewActionForm workspaceId={workspaceId} members={members} onCreated={load} />
      {error && <p className="text-sm text-ember-400">{error}</p>}

      <div className="space-y-2">
        {visible.map((a) => (
          <div key={a.id} className="glass flex items-start gap-3 rounded-2xl p-3.5">
            <button onClick={() => cycleStatus(a)} className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border text-[10px] ${a.status === 'done' ? 'border-flux-500/40 bg-flux-500/20 text-flux-300' : 'border-white/20 text-transparent'}`}>✓</button>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${a.status === 'done' ? 'text-ink-500 line-through' : 'text-ink-100'}`}>{a.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-ink-500">
                <span className={`rounded-full border px-1.5 py-0.5 font-medium ${priorityClasses[a.priority]}`}>{a.priority}</span>
                <span>{statusLabel[a.status]}</span>
                {a.ownerName && <span className="flex items-center gap-1"><User className="h-3 w-3" /> {a.ownerName}</span>}
                {a.deadline && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(a.deadline).toLocaleDateString()}</span>}
                {a.decisionTitle && <span>From: {a.decisionTitle}</span>}
              </div>
            </div>
          </div>
        ))}
        {visible.length === 0 && <p className="py-8 text-center text-xs text-ink-500">No actions {filter === 'mine' ? 'assigned to you' : 'yet'}.</p>}
      </div>
    </div>
  );
}
