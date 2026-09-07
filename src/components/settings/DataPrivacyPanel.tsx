import { useEffect, useState } from 'react';
import { AlertTriangle, Download, Trash2 } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { deleteMyAccount, deleteWorkspace, exportMyData, getDataRetentionDays, setDataRetentionDays } from '@/lib/pulseApi';

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function RetentionSection({ workspaceId, isOwner }: { workspaceId: string; isOwner: boolean }) {
  const [days, setDays] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => { getDataRetentionDays(workspaceId).then(setDays); }, [workspaceId]);

  const save = async (value: number | null) => {
    setDays(value); setBusy(true);
    try { await setDataRetentionDays(workspaceId, value); setNotice('Saved.'); setTimeout(() => setNotice(''), 1500); }
    finally { setBusy(false); }
  };

  return (
    <section className="glass rounded-2xl p-4">
      <h2 className="text-sm font-semibold">Data retention</h2>
      <p className="mt-1 text-xs text-ink-500">Auto-archives Discussions (chat) after this many days of inactivity. Decisions are never auto-cleaned — they're PULSE's permanent record by design.</p>
      <select
        value={days ?? ''}
        disabled={!isOwner || busy}
        onChange={(e) => save(e.target.value ? Number(e.target.value) : null)}
        className="field mt-3 disabled:opacity-60"
      >
        <option value="">Keep forever</option>
        <option value="90">Archive after 90 days</option>
        <option value="180">Archive after 180 days</option>
        <option value="365">Archive after 1 year</option>
      </select>
      {notice && <p className="mt-2 text-xs text-flux-400">{notice}</p>}
      {!isOwner && <p className="mt-2 text-[11px] text-ink-600">Only the workspace owner can change this.</p>}
    </section>
  );
}

export function DataPrivacyPanel({ workspaceId, workspaceName, isOwner }: { workspaceId: string; workspaceName: string; isOwner: boolean }) {
  const { user, signOut } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [error, setError] = useState('');

  const exportData = async () => {
    if (!user) return;
    setExporting(true);
    try { const data = await exportMyData(user.id); downloadJson(data, `pulse-data-export-${new Date().toISOString().slice(0, 10)}.json`); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not export data'); }
    finally { setExporting(false); }
  };

  const removeWorkspace = async () => {
    if (confirmText !== workspaceName) return;
    setDeletingWorkspace(true); setError('');
    try { await deleteWorkspace(workspaceId); window.location.href = '/'; }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not delete workspace'); setDeletingWorkspace(false); }
  };

  const removeAccount = async () => {
    setDeletingAccount(true); setError('');
    const result = await deleteMyAccount();
    if (result.error) { setError(result.error); setDeletingAccount(false); return; }
    await signOut();
  };

  return (
    <div className="space-y-5">
      <section className="glass rounded-2xl p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Download className="h-3.5 w-3.5 text-pulse-300" /> Download my data</h2>
        <p className="mt-1 text-xs text-ink-500">Every decision, comment, vote, and action you've created, as a JSON file.</p>
        <button onClick={exportData} disabled={exporting} className="primary-btn mt-3 disabled:opacity-40">{exporting ? 'Preparing export…' : 'Export my data'}</button>
      </section>

      <RetentionSection workspaceId={workspaceId} isOwner={isOwner} />

      {isOwner && (
        <section className="rounded-2xl border border-ember-500/30 bg-ember-500/5 p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ember-300"><AlertTriangle className="h-3.5 w-3.5" /> Delete workspace</h2>
          <p className="mt-1 text-xs text-ink-400">Permanently deletes "{workspaceName}" and everything in it — discussions, decisions, actions, resources. This cannot be undone.</p>
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={`Type "${workspaceName}" to confirm`} className="field mt-3 text-sm" />
          <button onClick={removeWorkspace} disabled={confirmText !== workspaceName || deletingWorkspace} className="mt-2 flex items-center gap-2 rounded-xl bg-ember-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">
            <Trash2 className="h-3.5 w-3.5" /> {deletingWorkspace ? 'Deleting…' : 'Delete this workspace forever'}
          </button>
        </section>
      )}

      <section className="rounded-2xl border border-ember-500/30 bg-ember-500/5 p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ember-300"><AlertTriangle className="h-3.5 w-3.5" /> Delete account</h2>
        <p className="mt-1 text-xs text-ink-400">Permanently deletes your PULSE account. If you own any workspaces, transfer or delete them first.</p>
        {!showDeleteAccount ? (
          <button onClick={() => setShowDeleteAccount(true)} className="mt-2 text-xs font-semibold text-ember-300">Delete my account…</button>
        ) : (
          <div className="mt-2 flex gap-2">
            <button onClick={removeAccount} disabled={deletingAccount} className="flex items-center gap-2 rounded-xl bg-ember-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">
              <Trash2 className="h-3.5 w-3.5" /> {deletingAccount ? 'Deleting…' : 'Yes, permanently delete my account'}
            </button>
            <button onClick={() => setShowDeleteAccount(false)} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-ink-300">Cancel</button>
          </div>
        )}
      </section>

      {error && <p className="text-sm text-ember-400">{error}</p>}
    </div>
  );
}
