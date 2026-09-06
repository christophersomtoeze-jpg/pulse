import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { getNotificationPreferences, updateNotificationPreferences } from '@/lib/pulseApi';
import type { NotificationPreferences } from '@/types';

const categories: { key: keyof NotificationPreferences; label: string }[] = [
  { key: 'notifyMentions', label: 'Mentions' },
  { key: 'notifyDecisions', label: 'New decisions' },
  { key: 'notifyActions', label: 'Assigned actions' },
  { key: 'notifyInvitations', label: 'Invitations' },
];

export function NotificationsPanel() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => { if (user) getNotificationPreferences(user.id).then(setPrefs); }, [user]);

  const save = async (next: NotificationPreferences) => {
    if (!user) return;
    setPrefs(next); setBusy(true);
    try { await updateNotificationPreferences(user.id, next); setNotice('Saved.'); setTimeout(() => setNotice(''), 1500); }
    finally { setBusy(false); }
  };

  if (!prefs) return <p className="text-xs text-ink-500">Loading…</p>;

  return (
    <div className="glass rounded-2xl p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Bell className="h-3.5 w-3.5 text-pulse-300" /> Email notifications</h2>

      <button
        onClick={() => save({ ...prefs, emailEnabled: !prefs.emailEnabled })}
        className={`mt-3 flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm ${prefs.emailEnabled ? 'border-flux-500/30 bg-flux-500/10 text-flux-300' : 'border-white/10 text-ink-400'}`}
      >
        Email notifications {prefs.emailEnabled ? 'on' : 'off'}
        <span className={`h-5 w-9 rounded-full p-0.5 transition-colors ${prefs.emailEnabled ? 'bg-flux-500' : 'bg-white/10'}`}><span className={`block h-4 w-4 rounded-full bg-white transition-transform ${prefs.emailEnabled ? 'translate-x-4' : ''}`} /></span>
      </button>

      <div className="mt-4 space-y-2">
        {categories.map(({ key, label }) => (
          <label key={key} className="flex items-center justify-between text-sm text-ink-300">
            {label}
            <input type="checkbox" checked={prefs[key] as boolean} disabled={!prefs.emailEnabled || busy} onChange={(e) => save({ ...prefs, [key]: e.target.checked })} className="h-4 w-4 accent-[#7c3aed]" />
          </label>
        ))}
      </div>

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
  );
}
