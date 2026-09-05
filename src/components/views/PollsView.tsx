import { useEffect, useState, type FormEvent } from 'react';
import { BarChart3, Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { castPollVote, createPoll, getMyPollVote, listPolls } from '@/lib/pulseApi';
import type { ActivePoll } from '@/types';

function PollCard({ poll, workspaceId }: { poll: ActivePoll; workspaceId: string }) {
  const { user } = useAuth();
  const [myVote, setMyVote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tally, setTally] = useState(poll);

  useEffect(() => { if (user) getMyPollVote(poll.id, user.id).then(setMyVote).catch(() => {}); }, [poll.id, user]);
  useEffect(() => { setTally(poll); }, [poll]);

  const vote = async (optionId: string) => {
    if (!user) return;
    setBusy(optionId);
    try {
      await castPollVote(poll.id, optionId);
      setMyVote(optionId);
      const fresh = await listPolls(workspaceId);
      const updated = fresh.find((p) => p.id === poll.id);
      if (updated) setTally(updated);
    } finally { setBusy(null); }
  };

  return (
    <div className="glass rounded-2xl p-4">
      <h3 className="font-display text-sm font-semibold">{tally.question}</h3>
      <p className="mt-0.5 text-[11px] text-ink-500">{tally.timeLeft} · {tally.totalVotes} vote{tally.totalVotes === 1 ? '' : 's'}</p>
      <div className="mt-3 space-y-2">
        {tally.options.map((opt) => {
          const pct = tally.totalVotes ? Math.round((opt.votes / tally.totalVotes) * 100) : 0;
          const selected = myVote === opt.id;
          return (
            <button key={opt.id} disabled={busy !== null} onClick={() => vote(opt.id)} className="block w-full text-left disabled:opacity-60">
              <div className="flex items-center justify-between text-xs">
                <span className={selected ? 'font-semibold text-pulse-300' : 'text-ink-200'}>{opt.label}{selected ? ' ✓' : ''}</span>
                <span className="text-ink-500">{pct}%</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-white/5">
                <div className={`h-full rounded-full ${selected ? 'bg-gradient-to-r from-[#7c3aed] to-[#06b6d4]' : 'bg-white/20'}`} style={{ width: `${pct}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NewPollForm({ workspaceId, onCreated }: { workspaceId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || clean.length < 2) { setError('Add a question and at least two options.'); return; }
    setBusy(true); setError('');
    try { await createPoll(workspaceId, question.trim(), clean); setQuestion(''); setOptions(['', '']); setOpen(false); onCreated(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not create poll'); }
    finally { setBusy(false); }
  };

  if (!open) return <button onClick={() => setOpen(true)} className="primary-btn"><Plus className="h-4 w-4" /> New poll</button>;

  return (
    <form onSubmit={submit} className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">New poll</h3>
        <button type="button" onClick={() => setOpen(false)} className="icon-btn h-7 w-7"><X className="h-3.5 w-3.5" /></button>
      </div>
      <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What are you asking?" className="field mt-3 text-sm" />
      <div className="mt-2 space-y-2">
        {options.map((opt, i) => (
          <div key={i} className="flex gap-2">
            <input value={opt} onChange={(e) => setOptions((os) => os.map((o, idx) => (idx === i ? e.target.value : o)))} placeholder={`Option ${i + 1}`} className="field text-xs" />
            {options.length > 2 && <button type="button" onClick={() => setOptions((os) => os.filter((_, idx) => idx !== i))} className="icon-btn h-9 w-9 shrink-0 text-ember-300"><Trash2 className="h-3.5 w-3.5" /></button>}
          </div>
        ))}
        <button type="button" onClick={() => setOptions((os) => [...os, ''])} className="text-xs font-medium text-pulse-300">+ Add option</button>
      </div>
      {error && <p className="mt-2 text-xs text-ember-400">{error}</p>}
      <button disabled={busy} className="primary-btn mt-3 w-full justify-center disabled:opacity-40">{busy ? 'Creating…' : 'Create poll'}</button>
    </form>
  );
}

export function PollsView({ workspaceId, polls, onRefresh }: { workspaceId: string; polls: ActivePoll[]; onRefresh: () => void }) {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pb-28 pt-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-[.2em] text-pulse-300"><BarChart3 className="h-3.5 w-3.5" /> Workspace</p>
          <h1 className="mt-1 font-display text-2xl font-semibold">Polls</h1>
        </div>
      </div>
      <NewPollForm workspaceId={workspaceId} onCreated={onRefresh} />
      <div className="space-y-3">
        {polls.map((p) => <PollCard key={p.id} poll={p} workspaceId={workspaceId} />)}
        {polls.length === 0 && <p className="py-8 text-center text-xs text-ink-500">No polls yet.</p>}
      </div>
    </div>
  );
}
