import { useState } from 'react';
import { ArrowDown, ArrowUp, Link2, Plus, Trash2 } from 'lucide-react';
import type { DecisionLink } from '@/types';
import { deleteDecisionLink } from '@/lib/pulseApi';
import { LinkDecisionModal } from './LinkDecisionModal';

const labels: Record<DecisionLink['relationshipType'], string> = {
  depends_on: 'Depends on',
  supersedes: 'Supersedes',
  related: 'Related to',
  blocks: 'Blocks',
  unlocked: 'Unlocks',
};

export function ConnectedDecisionsPanel({
  decisionId, workspaceId, links, onLinksChange, isAdmin,
}: {
  decisionId: string; workspaceId: string; links: DecisionLink[];
  onLinksChange: () => void; isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const incoming = links.filter((l) => l.toDecisionId === decisionId);
  const outgoing = links.filter((l) => l.fromDecisionId === decisionId);

  const remove = async (id: string) => {
    setBusyId(id);
    try { await deleteDecisionLink(id); onLinksChange(); }
    finally { setBusyId(null); }
  };

  return (
    <section className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Link2 className="h-3.5 w-3.5 text-pulse-300" /> Connected decisions</h3>
          <p className="mt-0.5 text-[11px] text-ink-500">Keep this decision connected to the reasoning around it.</p>
        </div>
        {isAdmin && <button onClick={() => setOpen(true)} className="secondary-btn"><Plus className="h-3.5 w-3.5" /> Link</button>}
      </div>

      <div className="mt-3 space-y-2">
        {outgoing.map((link) => (
          <div key={link.id} className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[.02] px-3 py-2 text-xs">
            <ArrowUp className="h-3.5 w-3.5 shrink-0 text-pulse-300" />
            <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] text-ink-400">{labels[link.relationshipType]}</span>
            <span className="min-w-0 flex-1 truncate font-medium">{link.toDecisionTitle ?? link.toDecisionId}</span>
            {isAdmin && <button disabled={busyId === link.id} onClick={() => void remove(link.id)} className="text-ink-500 hover:text-ember-300"><Trash2 className="h-3.5 w-3.5" /></button>}
          </div>
        ))}
        {incoming.map((link) => (
          <div key={link.id} className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[.02] px-3 py-2 text-xs">
            <ArrowDown className="h-3.5 w-3.5 shrink-0 text-alert-300" />
            <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] text-ink-400">{labels[link.relationshipType]}</span>
            <span className="min-w-0 flex-1 truncate font-medium">{link.fromDecisionTitle ?? link.fromDecisionId}</span>
            {isAdmin && <button disabled={busyId === link.id} onClick={() => void remove(link.id)} className="text-ink-500 hover:text-ember-300"><Trash2 className="h-3.5 w-3.5" /></button>}
          </div>
        ))}
        {links.length === 0 && <p className="py-3 text-center text-xs text-ink-500">No connected decisions yet.</p>}
      </div>

      <LinkDecisionModal
        open={open}
        decisionId={decisionId}
        workspaceId={workspaceId}
        onClose={() => setOpen(false)}
        onCreated={() => { setOpen(false); onLinksChange(); }}
      />
    </section>
  );
}
