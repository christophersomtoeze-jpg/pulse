import { motion } from 'framer-motion';
import { Activity, ChevronRight, FileText, Folder, Map, Pin } from 'lucide-react';
import type { ActivePoll, DecisionSummary } from '@/types';

interface LivingStateLedgerProps {
  decisions: DecisionSummary[];
  polls: ActivePoll[];
  resources: { name: string; icon: typeof FileText }[];
  onViewAllDecisions: () => void;
  onVoteNow: () => void;
  onOpenResourceHub: () => void;
}

function decisionPill(d: DecisionSummary): { label: string; classes: string } {
  if (d.outcome === 'approved') return { label: 'Approved', classes: 'text-flux-300 bg-flux-500/15 border-flux-500/30' };
  if (d.outcome === 'rejected') return { label: 'Rejected', classes: 'text-ember-300 bg-ember-500/15 border-ember-500/30' };
  if (d.outcome === 'postponed') return { label: 'Postponed', classes: 'text-alert-300 bg-alert-500/15 border-alert-500/30' };
  if (d.status === 'in-review') return { label: 'In Progress', classes: 'text-[#93c5fd] bg-[#3b82f6]/15 border-[#3b82f6]/30' };
  return { label: 'Pending', classes: 'text-ink-300 bg-white/5 border-white/10' };
}

export function LivingStateLedger({ decisions, polls, resources, onViewAllDecisions, onVoteNow, onOpenResourceHub }: LivingStateLedgerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="mx-4 rounded-3xl border border-[#7c3aed]/25 bg-gradient-to-b from-[#7c3aed]/10 to-transparent p-4 shadow-card"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-pulse-300" strokeWidth={2.5} />
          <h2 className="font-display text-sm font-bold tracking-wide">LIVING STATE LEDGER</h2>
        </div>
        <span className="flex items-center gap-1 text-[10px] font-semibold text-flux-300">
          Live <span className="h-1.5 w-1.5 rounded-full bg-flux-400 animate-pulse-ring" />
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {/* Pinned decisions */}
        <div className="min-w-0 rounded-2xl border border-white/5 bg-black/20 p-2.5">
          <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-ink-400">
            <Pin className="h-2.5 w-2.5 shrink-0" /> <span className="truncate">Pinned</span>
            <span className="ml-auto shrink-0 rounded-full bg-white/5 px-1.5 py-0.5 text-[8px] text-ink-300">+{decisions.length}</span>
          </div>
          <div className="mt-2 space-y-1.5">
            {decisions.slice(0, 3).map((d) => {
              const pill = decisionPill(d);
              return (
                <div key={d.id} className="space-y-0.5">
                  <p className="truncate text-[10px] font-medium text-ink-100">{d.title}</p>
                  <span className={`inline-block rounded-full border px-1.5 py-0.5 text-[8px] font-medium ${pill.classes}`}>{pill.label}</span>
                </div>
              );
            })}
            {decisions.length === 0 && <p className="text-[10px] text-ink-500">No decisions yet.</p>}
          </div>
          <button onClick={onViewAllDecisions} className="mt-2 flex items-center gap-0.5 text-[9px] font-semibold text-pulse-300">
            View all <ChevronRight className="h-2.5 w-2.5" />
          </button>
        </div>

        {/* Active polls */}
        <div className="min-w-0 rounded-2xl border border-white/5 bg-black/20 p-2.5">
          <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-ink-400">
            <Map className="h-2.5 w-2.5 shrink-0" /> <span className="truncate">Polls</span>
            <span className="ml-auto shrink-0 rounded-full bg-white/5 px-1.5 py-0.5 text-[8px] text-ink-300">+{polls.length}</span>
          </div>
          <div className="mt-2 space-y-2">
            {polls.slice(0, 2).map((p) => {
              const top = p.options[0];
              const pct = top && p.totalVotes ? Math.round((top.votes / p.totalVotes) * 100) : 0;
              return (
                <div key={p.id}>
                  <p className="truncate text-[10px] font-medium text-ink-100">{p.question}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <div className="h-1.5 flex-1 rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#7c3aed] to-[#06b6d4]" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[8px] text-ink-400">{pct}%</span>
                  </div>
                </div>
              );
            })}
            {polls.length === 0 && <p className="text-[10px] text-ink-500">No active polls.</p>}
          </div>
          <button onClick={onVoteNow} className="mt-2 flex items-center gap-0.5 text-[9px] font-semibold text-pulse-300">
            Vote now <ChevronRight className="h-2.5 w-2.5" />
          </button>
        </div>

        {/* Resources */}
        <div className="min-w-0 rounded-2xl border border-white/5 bg-black/20 p-2.5">
          <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-ink-400">
            <Folder className="h-2.5 w-2.5 shrink-0" /> <span className="truncate">Resources</span>
          </div>
          <div className="mt-2 space-y-1.5">
            {resources.slice(0, 3).map(({ name, icon: Icon }) => (
              <div key={name} className="flex items-center gap-1.5 text-[10px] text-ink-200">
                <Icon className="h-2.5 w-2.5 shrink-0 text-pulse-300" />
                <span className="truncate">{name}</span>
              </div>
            ))}
          </div>
          <button onClick={onOpenResourceHub} className="mt-2 flex items-center gap-0.5 text-[9px] font-semibold text-pulse-300">
            Open hub <ChevronRight className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
