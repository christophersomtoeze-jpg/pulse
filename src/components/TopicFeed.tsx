import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  Users,
  Clock,
  Hash,
  TrendingUp,
  Flame,
  CheckCircle2,
  Archive,
  Feather,
  MessageSquare,
  Zap,
} from 'lucide-react';
import type { TopicNode, TopicStatus, IntentWave } from '@/types';

const statusConfig: Record<
  TopicStatus,
  { label: string; icon: typeof TrendingUp; color: string; bg: string; border: string }
> = {
  active: {
    label: 'Active',
    icon: TrendingUp,
    color: 'text-pulse-300',
    bg: 'bg-pulse-500/10',
    border: 'border-pulse-500/30',
  },
  heating: {
    label: 'Heating',
    icon: Flame,
    color: 'text-ember-400',
    bg: 'bg-ember-500/10',
    border: 'border-ember-500/30',
  },
  settling: {
    label: 'Settling',
    icon: CheckCircle2,
    color: 'text-flux-400',
    bg: 'bg-flux-500/10',
    border: 'border-flux-500/30',
  },
  archived: {
    label: 'Archived',
    icon: Archive,
    color: 'text-ink-400',
    bg: 'bg-ink-800/60',
    border: 'border-ink-600/40',
  },
};

const intentConfig: Record<
  IntentWave,
  { label: string; icon: typeof Feather; color: string; border: string; bg: string }
> = {
  whisper: {
    label: 'Whisper',
    icon: Feather,
    color: 'text-ink-300',
    border: 'border-ink-600',
    bg: 'bg-ink-800/50',
  },
  standard: {
    label: 'Standard',
    icon: MessageSquare,
    color: 'text-pulse-300',
    border: 'border-pulse-500/30',
    bg: 'bg-pulse-500/8',
  },
  pulse: {
    label: 'Pulse Alert',
    icon: Zap,
    color: 'text-ember-400',
    border: 'border-ember-500/30',
    bg: 'bg-ember-500/8',
  },
};

const avatarColors = [
  'bg-pulse-500/20 text-pulse-300',
  'bg-flux-500/20 text-flux-400',
  'bg-alert-500/20 text-alert-400',
  'bg-ember-500/20 text-ember-400',
  'bg-pulse-400/20 text-pulse-200',
];

function IntentTag({ intent }: { intent: IntentWave }) {
  const cfg = intentConfig[intent];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border ${cfg.border} ${cfg.bg} px-1.5 py-0.5 text-[9px] font-medium ${cfg.color}`}>
      <Icon className="h-2.5 w-2.5" strokeWidth={2.5} />
      {cfg.label}
    </span>
  );
}

function FeedMessageItem({
  message,
  index,
}: {
  message: TopicNode['messages'][number];
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
      className="flex gap-3"
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarColors[index % avatarColors.length]}`}
      >
        {message.avatar}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-ink-100">{message.author}</span>
          <span className="text-[10px] text-ink-500">{message.time}</span>
          <IntentTag intent={message.intent} />
        </div>
        <p className="mt-1 text-sm leading-relaxed text-ink-200">{message.text}</p>
      </div>
    </motion.div>
  );
}

export function TopicNodeCard({
  node,
  index,
}: {
  node: TopicNode;
  index: number;
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const cfg = statusConfig[node.status];
  const StatusIcon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 + 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`glass rounded-2xl border ${expanded ? cfg.border : 'border-white/5'} transition-colors`}
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full p-4 text-left focus-ring rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-semibold text-ink-50">{node.title}</h3>
            </div>
            <p className={`mt-1 text-sm leading-relaxed text-ink-300 ${expanded ? '' : 'line-clamp-2'}`}>
              {node.summary}
            </p>
          </div>
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.3 }}>
            <ChevronDown className="h-5 w-5 shrink-0 text-ink-400" />
          </motion.div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-lg border ${cfg.border} ${cfg.bg} px-2 py-1 text-[10px] font-medium ${cfg.color}`}>
            <StatusIcon className="h-3 w-3" strokeWidth={2.5} />
            {cfg.label}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-ink-400">
            <Users className="h-3 w-3" />
            {node.participants}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-ink-400">
            <Clock className="h-3 w-3" />
            {node.lastActive}
          </span>
          {node.tags.map((tag) => (
            <span key={tag} className="flex items-center gap-0.5 text-[11px] text-ink-500">
              <Hash className="h-2.5 w-2.5" />
              {tag}
            </span>
          ))}
        </div>

        {!expanded && (
          <div className="mt-3 flex gap-4 border-t border-white/5 pt-3">
            {node.metric.map((m) => (
              <div key={m.label} className="flex items-baseline gap-1">
                <span className="text-sm font-bold text-ink-100">{m.value}</span>
                <span className="text-[10px] text-ink-500">{m.label}</span>
              </div>
            ))}
          </div>
        )}
      </button>

      <div className={`expand-grid ${expanded ? 'open' : ''}`}>
        <div>
          <div className="px-4 pb-4">
            <div className="rounded-xl border border-white/5 bg-ink-900/40 p-4 space-y-4">
              {node.messages.map((msg, i) => (
                <FeedMessageItem key={msg.id} message={msg} index={i} />
              ))}
            </div>
            <div className="mt-3 flex gap-4">
              {node.metric.map((m) => (
                <div key={m.label} className="flex items-baseline gap-1">
                  <span className="text-sm font-bold text-ink-100">{m.value}</span>
                  <span className="text-[10px] text-ink-500">{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function TopicFeed() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-ink-400">
          Topic Nodes
        </h2>
        <span className="text-[11px] text-ink-500">{4} active threads</span>
      </div>
      <AnimatePresence>
        {topicNodesData.map((node, i) => (
          <TopicNodeCard key={node.id} node={node} index={i} />
        ))}
      </AnimatePresence>
    </div>
  );
}

import { topicNodes as topicNodesData } from '@/data';
