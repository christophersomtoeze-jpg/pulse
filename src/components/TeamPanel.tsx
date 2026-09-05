import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Users, X } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import {
  inviteToWorkspace, listWorkspaceInvites, listWorkspaceMembers, removeWorkspaceMember,
  updateWorkspaceMemberRole, type WorkspaceInvite, type WorkspaceMember, type WorkspaceRole,
} from '@/lib/pulseApi';

function MailIcon() { return <span className="text-alert-300 text-xs">@</span>; }

function TeamPanelBody({ workspaceId }: { workspaceId: string }) {
  const { user } = useAuth();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('member');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = async () => {
    const [m, i] = await Promise.all([listWorkspaceMembers(workspaceId), listWorkspaceInvites(workspaceId)]);
    setMembers(m); setInvites(i);
  };
  useEffect(() => { refresh().catch((e) => setError(e instanceof Error ? e.message : 'Could not load team')); }, [workspaceId]);

  const invite = async (e: FormEvent) => {
    e.preventDefault(); if (!email.trim()) return; setBusy(true); setError(''); setNotice('');
    try {
      const result = await inviteToWorkspace(workspaceId, email, role);
      setEmail('');
      setNotice(result.added ? 'Existing PULSE user added to the workspace.' : 'Invitation saved. Email delivery will be connected next.');
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not invite member'); }
    finally { setBusy(false); }
  };

  const changeRole = async (member: WorkspaceMember, next: WorkspaceRole) => {
    if (member.userId === user?.id && member.role === 'owner') return;
    try { await updateWorkspaceMemberRole(workspaceId, member.userId, next); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update role'); }
  };

  const remove = async (member: WorkspaceMember) => {
    if (member.userId === user?.id) return;
    if (!confirm(`Remove ${member.email} from this workspace?`)) return;
    try { await removeWorkspaceMember(workspaceId, member.userId); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not remove member'); }
  };

  return (
    <>
      <form onSubmit={invite} className="rounded-2xl border border-pulse-500/20 bg-pulse-500/5 p-4">
        <div className="flex items-center gap-2"><Users className="h-4 w-4 text-pulse-300" /><b className="text-sm">Invite a teammate</b></div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@email.com" className="field flex-1" />
          <select value={role} onChange={(e) => setRole(e.target.value as WorkspaceRole)} className="field sm:w-32">
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <button disabled={busy} className="primary-btn justify-center disabled:opacity-40">{busy ? 'Adding…' : 'Invite'}</button>
        </div>
      </form>
      {error && <p className="mt-3 text-sm text-ember-400">{error}</p>}
      {notice && <p className="mt-3 text-sm text-flux-400">{notice}</p>}

      <div className="mt-6 flex items-center justify-between">
        <h3 className="font-semibold">Members <span className="text-xs text-ink-500">{members.length}</span></h3>
        <span className="text-[10px] uppercase tracking-widest text-ink-500">Live workspace access</span>
      </div>
      <div className="mt-3 space-y-2">
        {members.map((m) => (
          <div key={m.userId} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[.02] p-3">
            <div className="avatar">{m.name.slice(0, 1).toUpperCase()}</div>
            <div className="min-w-0 flex-1"><b className="block truncate text-sm">{m.name}</b><span className="block truncate text-xs text-ink-500">{m.email}</span></div>
            {m.role === 'owner' ? (
              <span className="badge text-pulse-300 border-pulse-500/20 bg-pulse-500/10">Owner</span>
            ) : (
              <>
                <select value={m.role} onChange={(e) => changeRole(m, e.target.value as WorkspaceRole)} className="field w-24 py-2 text-xs">
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <button onClick={() => remove(m)} className="icon-btn text-ember-300"><X /></button>
              </>
            )}
          </div>
        ))}
      </div>

      {invites.length > 0 && (
        <>
          <h3 className="mt-7 font-semibold">Pending invitations</h3>
          <div className="mt-3 space-y-2">
            {invites.filter((i) => i.status === 'pending').map((i) => (
              <div key={i.id} className="flex items-center gap-3 rounded-2xl border border-white/5 p-3">
                <div className="h-8 w-8 rounded-xl bg-alert-500/10 grid place-items-center"><MailIcon /></div>
                <span className="flex-1 truncate text-sm">{i.email}</span>
                <span className="badge text-alert-300 border-alert-500/20 bg-alert-500/10">{i.role}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/** Full-page version for the desktop sidebar's "Team" nav item. */
export function TeamView({ workspaceId }: { workspaceId: string }) {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-28 pt-5">
      <p className="text-[10px] uppercase tracking-[.2em] text-pulse-300">Workspace</p>
      <h1 className="mt-1 font-display text-2xl font-semibold">Team &amp; members</h1>
      <p className="mt-1 text-xs text-ink-500">Manage who can access this PULSE workspace.</p>
      <div className="mt-5"><TeamPanelBody workspaceId={workspaceId} /></div>
    </div>
  );
}

/** Slide-over version used from the mobile nav drawer. */
export function TeamPanel({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }): ReactNode {
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/70 p-3 md:p-8" onClick={onClose}>
        <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} onClick={(e) => e.stopPropagation()} className="ml-auto flex h-full w-full max-w-2xl flex-col glass-strong rounded-3xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/5 p-5">
            <div>
              <div className="text-[10px] uppercase tracking-[.2em] text-pulse-300">Workspace</div>
              <h2 className="font-display text-2xl font-semibold">Team &amp; members</h2>
              <p className="mt-1 text-xs text-ink-500">Manage who can access this PULSE workspace.</p>
            </div>
            <button className="icon-btn" onClick={onClose}><X /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-5"><TeamPanelBody workspaceId={workspaceId} /></div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
