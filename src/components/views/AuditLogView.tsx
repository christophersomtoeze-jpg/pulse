import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, History, ShieldCheck } from 'lucide-react';
import { listAuditLog } from '@/lib/pulseApi';
import type { AuditLogEntry } from '@/types';
import type { AppView } from '@/lib/viewTypes';

export function AuditLogView({ workspaceId, onNavigate, onOpenDecision }: { workspaceId: string; onNavigate: (view: AppView) => void; onOpenDecision: (id: string) => void }) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    listAuditLog(workspaceId).then(setEntries).catch((e) => setError(e instanceof Error ? e.message : 'Could not load the audit log'));
  }, [workspaceId]);

  const openEntry = (entry: AuditLogEntry) => {
    if (entry.targetType === 'decision' && entry.targetId) { onOpenDecision(entry.targetId); return; }
    if (entry.targetType === 'team') { onNavigate('team'); return; }
    if (entry.targetType === 'invitations') { onNavigate('invitations'); return; }
    setExpandedId((current) => current === entry.id ? null : entry.id);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-28 pt-5">
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-[.2em] text-pulse-300"><History className="h-3.5 w-3.5" /> Phase 5 — Business</p>
      <h1 className="mt-1 font-display text-2xl font-semibold">Audit Log</h1>
      <p className="mt-1 text-xs text-ink-500">Immutable workspace history. Entries with a linked record can be opened directly.</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {[['RLS protected','Workspace-scoped data',ShieldCheck],['OAuth protected','One-time connection state',CheckCircle2],['Secrets server-side','Provider tokens stay off the UI',ShieldCheck]].map(([title, detail, Icon]) => {
          const SecurityIcon = Icon as typeof ShieldCheck;
          return <div key={title as string} className="glass rounded-2xl p-3"><SecurityIcon className="h-4 w-4 text-flux-300" /><p className="mt-2 text-xs font-semibold text-ink-200">{title as string}</p><p className="mt-0.5 text-[10px] text-ink-500">{detail as string}</p></div>;
        })}
      </div>

      {error && <p className="mt-4 text-sm text-ember-400">{error}</p>}

      <div className="mt-5 space-y-2">
        {entries.map((e) => {
          const clickable = Boolean(e.targetType);
          const expanded = expandedId === e.id;
          return <button key={e.id} type="button" onClick={() => openEntry(e)} className="glass flex w-full items-start gap-3 rounded-2xl p-3.5 text-left transition hover:bg-white/[.06]">
            <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-pulse-400" />
            <div className="min-w-0 flex-1"><p className="text-sm text-ink-200">{e.detail ?? e.action}</p><p className="mt-0.5 text-[11px] text-ink-500">{e.actorName ?? 'System'} · {new Date(e.createdAt).toLocaleString()}</p>{expanded && <div className="mt-2 rounded-xl border border-white/8 bg-white/[.025] p-2.5 text-[11px] text-ink-400"><p className="font-semibold text-ink-300">{e.action}</p><p className="mt-1 break-words">{e.detail ?? 'No additional details.'}</p></div>}</div>
            <ArrowRight className={`mt-1 h-3.5 w-3.5 shrink-0 ${clickable ? 'text-pulse-300' : 'text-ink-600 rotate-90'}`} />
          </button>;
        })}
        {entries.length === 0 && <p className="py-8 text-center text-xs text-ink-500">No audited events yet.</p>}
      </div>
    </div>
  );
}
