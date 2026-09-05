import { useEffect, useState, type FormEvent } from 'react';
import { Mail, UserPlus } from 'lucide-react';
import { inviteToWorkspace, listWorkspaceInvites, type WorkspaceInvite, type WorkspaceRole } from '@/lib/pulseApi';

export function InvitationsView({ workspaceId }: { workspaceId: string }) {
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('member');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = () => listWorkspaceInvites(workspaceId).then(setInvites).catch((e) => setError(e instanceof Error ? e.message : 'Could not load invitations'));
  useEffect(() => { load(); }, [workspaceId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await inviteToWorkspace(workspaceId, email, role);
      setEmail('');
      setNotice(result.added ? 'Existing PULSE user added to the workspace.' : 'Invitation saved. Email delivery will be connected next.');
      load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not invite'); }
    finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-28 pt-5">
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-[.2em] text-pulse-300"><UserPlus className="h-3.5 w-3.5" /> Workspace</p>
      <h1 className="mt-1 font-display text-2xl font-semibold">Invitations</h1>

      <form onSubmit={submit} className="glass mt-5 rounded-2xl p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@email.com" className="field flex-1" />
          <select value={role} onChange={(e) => setRole(e.target.value as WorkspaceRole)} className="field sm:w-32">
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <button disabled={busy} className="primary-btn justify-center disabled:opacity-40">{busy ? 'Sending…' : 'Invite'}</button>
        </div>
        {error && <p className="mt-2 text-sm text-ember-400">{error}</p>}
        {notice && <p className="mt-2 text-sm text-flux-400">{notice}</p>}
      </form>

      <div className="mt-5 space-y-2">
        {invites.map((i) => (
          <div key={i.id} className="glass flex items-center gap-3 rounded-2xl p-3.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-alert-500/10"><Mail className="h-4 w-4 text-alert-300" /></div>
            <span className="flex-1 truncate text-sm">{i.email}</span>
            <span className="badge text-alert-300 border-alert-500/20 bg-alert-500/10">{i.role}</span>
            <span className="text-[10px] uppercase tracking-wide text-ink-500">{i.status}</span>
          </div>
        ))}
        {invites.length === 0 && <p className="py-8 text-center text-xs text-ink-500">No invitations sent yet.</p>}
      </div>
    </div>
  );
}
