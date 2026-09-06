import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { getWorkspaceGeneral, updateWorkspaceGeneral } from '@/lib/pulseApi';

export function AISettingsPanel({ workspaceId, isAdmin, onChanged }: { workspaceId: string; isAdmin: boolean; onChanged?: (enabled: boolean) => void }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { getWorkspaceGeneral(workspaceId).then((s) => setEnabled(s?.aiEnabled ?? true)); }, [workspaceId]);

  const toggle = async () => {
    if (enabled === null) return;
    const next = !enabled;
    setBusy(true);
    try { await updateWorkspaceGeneral(workspaceId, { aiEnabled: next }); setEnabled(next); onChanged?.(next); }
    finally { setBusy(false); }
  };

  return (
    <div className="glass rounded-2xl p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-3.5 w-3.5 text-pulse-300" /> AI features</h2>
      <p className="mt-1 text-xs text-ink-500">Controls AI Decision Intelligence, the standalone PULSE AI assistant, and Meeting Summaries for everyone in this workspace. Risk Center stays on — it's rule-based, not AI.</p>
      <button
        onClick={toggle}
        disabled={!isAdmin || busy || enabled === null}
        className={`mt-3 flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm disabled:opacity-60 ${enabled ? 'border-flux-500/30 bg-flux-500/10 text-flux-300' : 'border-white/10 text-ink-400'}`}
      >
        AI features are {enabled ? 'on' : 'off'} for this workspace
        <span className={`h-5 w-9 rounded-full p-0.5 transition-colors ${enabled ? 'bg-flux-500' : 'bg-white/10'}`}><span className={`block h-4 w-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-4' : ''}`} /></span>
      </button>
      {!isAdmin && <p className="mt-2 text-[11px] text-ink-600">Only workspace admins can change this.</p>}
    </div>
  );
}
