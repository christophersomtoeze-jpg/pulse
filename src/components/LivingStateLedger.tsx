import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Pin,
  CheckCircle2,
  Eye,
  RefreshCw,
  Vote,
  ChevronRight,
  Clock,
} from 'lucide-react';
import type { PinnedDecision, ActivePoll, QuickLink } from '@/types';
import * as LucideIcons from 'lucide-react';

const decisionStatusConfig = {
  decided: {
    label: 'Decided',
    icon: CheckCircle2,
    color: 'text-flux-400',
    bg: 'bg-flux-500/10',
    border: 'border-flux-500/30',
  },
  'in-review': {
    label: 'In Review',
    icon: Eye,
    color: 'text-alert-400',
    bg: 'bg-alert-500/10',
    border: 'border-alert-500/30',
  },
  revisiting: {
    label: 'Revisiting',
    icon: RefreshCw,
    color: 'text-ember-400',
    bg: 'bg-ember-500/10',
    border: 'border-ember-500/30',
  },
} as const;

function PinnedDecisionCard({ decision }: { decision: PinnedDecision }) {
  const cfg = decisionStatusConfig[decision.status];
  const Icon = cfg.icon;
  return (
    <div className="rounded-2xl border border-white/5 bg-ink-850/80 p-4 transition-colors hover:border-white/10">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${cfg.bg} ${cfg.border} border`}>
          <Icon className={`h-3.5 w-3.5 ${cfg.color}`} strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-sm font-semibold text-ink-50">{decision.title}</h4>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-300">{decision.summary}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className={`text-[10px] font-medium uppercase tracking-wider ${cfg.color}`}>
              {cfg.label}
            </span>
            <span className="text-[10px] text-ink-500">·</span>
            <span className="text-[10px] text-ink-400">{decision.timestamp}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PollBar({ poll }: { poll: ActivePoll }) {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <div className="rounded-2xl border border-white/5 bg-ink-850/80 p-4">
      <div className="flex items-center gap-2">
        <Vote className="h-3.5 w-3.5 text-pulse-400" strokeWidth={2.5} />
        <h4 className="text-sm font-semibold text-ink-50">{poll.question}</h4>
      </div>
      <div className="mt-3 space-y-2">
        {poll.options.map((opt, i) => {
          const pct = Math.round((opt.votes / poll.totalVotes) * 100);
          const isSelected = selected === i;
          return (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className="group relative w-full overflow-hidden rounded-xl border border-white/5 bg-ink-900/60 px-3 py-2 text-left transition-all hover:border-pulse-500/30 focus-ring"
            >
              <div
                className={`absolute inset-y-0 left-0 rounded-xl transition-all duration-500 ${
                  isSelected ? 'bg-pulse-500/20' : 'bg-white/[0.03] group-hover:bg-white/[0.05]'
                }`}
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between">
                <span className={`text-xs font-medium ${isSelected ? 'text-pulse-200' : 'text-ink-200'}`}>
                  {opt.label}
                </span>
                <span className="text-xs font-semibold text-ink-400">{pct}%</span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] text-ink-400">{poll.totalVotes} votes</span>
        <span className="flex items-center gap-1 text-[10px] text-ink-400">
          <Clock className="h-3 w-3" />
          {poll.timeLeft}
        </span>
      </div>
    </div>
  );
}

function QuickLinkChip({ link }: { link: QuickLink }) {
  const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>>)[link.icon] ?? LucideIcons.Link;
  return (
    <button className="group flex shrink-0 flex-col items-center gap-1.5 rounded-xl border border-white/5 bg-ink-850/80 px-3.5 py-2.5 transition-all hover:border-white/15 hover:bg-ink-800 focus-ring">
      <Icon className={`h-4 w-4 ${link.color} transition-transform group-hover:scale-110`} strokeWidth={2} />
      <span className="text-[10px] font-medium text-ink-200">{link.label}</span>
    </button>
  );
}

type LedgerTab = 'decisions' | 'polls' | 'links';

const tabs: { id: LedgerTab; label: string; icon: typeof Pin; count: number }[] = [
  { id: 'decisions', label: 'Pinned Decisions', icon: Pin, count: 3 },
  { id: 'polls', label: 'Active Polls', icon: Vote, count: 2 },
  { id: 'links', label: 'Quick Links', icon: ChevronRight, count: 5 },
];

export function LivingStateLedger() {
  const [activeTab, setActiveTab] = useState<LedgerTab>('decisions');

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="glass-strong sticky top-3 z-30 rounded-3xl shadow-card"
    >
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-pulse-400" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-pulse-400" />
            </div>
            <h2 className="font-display text-sm font-semibold tracking-wide text-ink-50">
              Living State Ledger
            </h2>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-medium uppercase tracking-widest text-ink-300">
            Live
          </span>
        </div>
      </div>

      <div className="flex gap-1 px-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[11px] font-medium transition-colors focus-ring ${
                isActive ? 'text-ink-50' : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              <Icon className="h-3 w-3" strokeWidth={2.5} />
              <span className="hidden xs:inline sm:inline">{tab.label.split(' ')[0]}</span>
              <span className="xs:hidden sm:hidden">{tab.label.split(' ')[0]}</span>
              {isActive && (
                <motion.div
                  layoutId="ledger-tab"
                  className="absolute inset-0 -z-10 rounded-xl border border-pulse-500/30 bg-pulse-500/10"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="px-3 pb-3 pt-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.25 }}
          >
            {activeTab === 'decisions' && (
              <div className="space-y-2">
                {pinnedDecisionsData.map((d) => (
                  <PinnedDecisionCard key={d.id} decision={d} />
                ))}
              </div>
            )}
            {activeTab === 'polls' && (
              <div className="space-y-2">
                {activePollsData.map((p) => (
                  <PollBar key={p.id} poll={p} />
                ))}
              </div>
            )}
            {activeTab === 'links' && (
              <div className="flex gap-2 overflow-x-auto scroll-hide pb-1">
                {quickLinksData.map((l) => (
                  <QuickLinkChip key={l.id} link={l} />
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

import { pinnedDecisions as pinnedDecisionsData, activePolls as activePollsData, quickLinks as quickLinksData } from '@/data';
