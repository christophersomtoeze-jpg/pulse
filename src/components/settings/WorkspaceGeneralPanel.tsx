import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { getWorkspaceGeneral, updateWorkspaceGeneral } from '@/lib/pulseApi';
import type { WorkspaceGeneralSettings } from '@/types';

export function WorkspaceGeneralPanel({ workspaceId, isAdmin, onSaved }: { workspaceId: string; isAdmin: boolean; onSaved?: (name: string) => void }) {
  const [settings, setSettings] = useState<WorkspaceGeneralSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { getWorkspaceGeneral(workspaceId).then(setSettings); }, [workspaceId]);

  const save = async () => {
    if (!settings) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await updateWorkspaceGeneral(workspaceId, settings);
      setNotice('Workspace settings saved.');
      onSaved?.(settings.name);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save'); }
    finally { setBusy(false); }
  };

  if (!settings) return <p className="text-xs text-ink-500">Loading…</p>;

  return (
    <div className="glass rounded-2xl p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Building2 className="h-3.5 w-3.5 text-pulse-300" /> Workspace general</h2>
      <div className="mt-3 space-y-3">
        <div><label className="text-xs font-medium text-ink-400">Workspace name</label><input value={settings.name} disabled={!isAdmin} onChange={(e) => setSettings({ ...settings, name: e.target.value })} className="field mt-1.5 disabled:opacity-60" /></div>
        <div><label className="text-xs font-medium text-ink-400">Description</label><textarea value={settings.description} disabled={!isAdmin} onChange={(e) => setSettings({ ...settings, description: e.target.value })} className="field mt-1.5 min-h-16 resize-none disabled:opacity-60" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs font-medium text-ink-400">Default language</label>
            <select value={settings.defaultLanguage} disabled={!isAdmin} onChange={(e) => setSettings({ ...settings, defaultLanguage: e.target.value })} className="field mt-1.5 disabled:opacity-60">
              <option value="en">English</option><option value="es">Español</option><option value="fr">Français</option><option value="de">Deutsch</option><option value="pt">Português</option>
            </select>
          </div>
          <div><label className="text-xs font-medium text-ink-400">Time zone</label>
            <select value={settings.timezone} disabled={!isAdmin} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} className="field mt-1.5 disabled:opacity-60">
              <option value="UTC">UTC</option><option value="America/New_York">Eastern (US)</option><option value="America/Chicago">Central (US)</option>
              <option value="America/Los_Angeles">Pacific (US)</option><option value="Europe/London">London</option><option value="Africa/Lagos">Lagos</option><option value="Asia/Dubai">Dubai</option>
            </select>
          </div>
        </div>
      </div>
      {!isAdmin && <p className="mt-2 text-[11px] text-ink-600">Only workspace admins can edit these — you're viewing them read-only.</p>}
      {isAdmin && (
        <>
          {error && <p className="mt-2 text-xs text-ember-400">{error}</p>}
          {notice && <p className="mt-2 text-xs text-flux-400">{notice}</p>}
          <button onClick={save} disabled={busy} className="primary-btn mt-3 disabled:opacity-40">{busy ? 'Saving…' : 'Save'}</button>
        </>
      )}
    </div>
  );
}
