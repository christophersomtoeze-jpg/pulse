import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { listAuditLog } from '@/lib/pulseApi';
import type { AuditLogEntry } from '@/types';

export function AuditLogView({ workspaceId }: { workspaceId: string }) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    listAuditLog(workspaceId).then(setEntries).catch((e) => setError(e instanceof Error ? e.message : 'Could not load the audit log'));
  }, [workspaceId]);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-28 pt-5">
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-[.2em] text-pulse-300"><History className="h-3.5 w-3.5" /> Phase 5 — Business</p>
      <h1 className="mt-1 font-display text-2xl font-semibold">Audit Log</h1>
      <p className="mt-1 text-xs text-ink-500">Written automatically by the database whenever roles change, invitations go out, or a decision outcome is recorded — never editable from the client.</p>

      {error && <p className="mt-4 text-sm text-ember-400">{error}</p>}

      <div className="mt-5 space-y-2">
        {entries.map((e) => (
          <div key={e.id} className="glass flex items-start gap-3 rounded-2xl p-3.5">
            <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-pulse-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink-200">{e.detail ?? e.action}</p>
              <p className="mt-0.5 text-[11px] text-ink-500">{e.actorName ?? 'System'} · {new Date(e.createdAt).toLocaleString()}</p>
            </div>
          </div>
        ))}
        {entries.length === 0 && <p className="py-8 text-center text-xs text-ink-500">No audited events yet.</p>}
      </div>
    </div>
  );
}
