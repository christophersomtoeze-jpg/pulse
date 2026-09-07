import { useEffect, useState } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { getNotificationPreferences, isPushSubscribed, subscribeToPush, unsubscribeFromPush, updateNotificationPreferences } from '@/lib/pulseApi';
import type { NotificationPreferences } from '@/types';

const categories: { key: keyof NotificationPreferences; label: string }[] = [
  { key: 'notifyMentions', label: 'Mentions' },
  { key: 'notifyDecisions', label: 'New decisions' },
  { key: 'notifyActions', label: 'Assigned actions' },
  { key: 'notifyInvitations', label: 'Invitations' },
];

function ToggleRow({ label, on, disabled, onToggle }: { label: string; on: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm disabled:opacity-50 ${on ? 'border-flux-500/30 bg-flux-500/10 text-flux-300' : 'border-white/10 text-ink-400'}`}
    >
      {label}
      <span className={`h-5 w-9 rounded-full p-0.5 transition-colors ${on ? 'bg-flux-500' : 'bg-white/10'}`}><span className={`block h-4 w-4 rounded-full bg-white transition-transform ${on ? 'translate-x-4' : ''}`} /></span>
    </button>
  );
}

export function NotificationsPanel() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) getNotificationPreferences(user.id).then(setPrefs);
    isPushSubscribed().then(setPushSubscribed);
  }, [user]);

  const save = async (next: NotificationPreferences) => {
    if (!user) return;
    setPrefs(next); setBusy(true);
    try { await updateNotificationPreferences(user.id, next); setNotice('Saved.'); setTimeout(() => setNotice(''), 1500); }
    finally { setBusy(false); }
  };

  const togglePush = async () => {
    if (!user || !prefs) return;
    setBusy(true); setError('');
    try {
      if (pushSubscribed) {
        const result = await unsubscribeFromPush();
        if (result.error) throw new Error(result.error);
        setPushSubscribed(false);
        await save({ ...prefs, pushEnabled: false });
      } else {
        const result = await subscribeToPush(user.id);
        if (result.error) throw new Error(result.error);
        setPushSubscribed(true);
        await save({ ...prefs, pushEnabled: true });
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update push notifications'); }
    finally { setBusy(false); }
  };

  if (!prefs) return <p className="text-xs text-ink-500">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold"><BellRing className="h-3.5 w-3.5 text-pulse-300" /> Push notifications</h2>
        <p className="mt-1 text-xs text-ink-500">Real browser notifications — works even when PULSE isn't open in a tab.</p>
        <div className="mt-3"><ToggleRow label={`Push notifications ${pushSubscribed ? 'on' : 'off'}`} on={pushSubscribed} disabled={busy} onToggle={togglePush} /></div>
        {error && <p className="mt-2 text-xs text-ember-400">{error}</p>}
      </div>

      <div className="glass rounded-2xl p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Bell className="h-3.5 w-3.5 text-pulse-300" /> Email notifications</h2>
        <div className="mt-3"><ToggleRow label={`Email notifications ${prefs.emailEnabled ? 'on' : 'off'}`} on={prefs.emailEnabled} disabled={busy} onToggle={() => save({ ...prefs, emailEnabled: !prefs.emailEnabled })} /></div>

        <div className="mt-4 space-y-2">
          {categories.map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between text-sm text-ink-300">
              {label}
              <input type="checkbox" checked={prefs[key] as boolean} disabled={busy || (!prefs.emailEnabled && !prefs.pushEnabled)} onChange={(e) => save({ ...prefs, [key]: e.target.checked })} className="h-4 w-4 accent-[#7c3aed]" />
            </label>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-ink-600">These categories apply to whichever of email/push you have on above.</p>

        <div className="mt-4">
          <label className="text-xs font-medium text-ink-400">Digest email</label>
          <select value={prefs.digestFrequency} disabled={!prefs.emailEnabled || busy} onChange={(e) => save({ ...prefs, digestFrequency: e.target.value as NotificationPreferences['digestFrequency'] })} className="field mt-1.5">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="off">Off</option>
          </select>
        </div>
        {notice && <p className="mt-2 text-xs text-flux-400">{notice}</p>}
      </div>
    </div>
  );
}
