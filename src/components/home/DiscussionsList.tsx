import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, CheckCheck, List, Network, Palette, Pin, Rocket, Search, Sparkles, X } from 'lucide-react';
import type { DecisionSummary, TopicNode } from '@/types';

interface DiscussionsListProps {
  topics: TopicNode[];
  decisions: DecisionSummary[];
  searchOpen: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  onCloseSearch: () => void;
  onSelectTopic: (topic: TopicNode) => void;
}

const TOPIC_VISUALS: { match: RegExp; icon: typeof Palette; ring: string; bg: string; color: string }[] = [
  { match: /brand|identity|design|logo/i, icon: Palette, ring: 'ring-[#a855f7]/40', bg: 'bg-[#a855f7]/15', color: 'text-[#c084fc]' },
  { match: /launch|strategy|market|go-to/i, icon: Rocket, ring: 'ring-[#3b82f6]/40', bg: 'bg-[#3b82f6]/15', color: 'text-[#93c5fd]' },
  { match: /ai|integration|intelligence/i, icon: Brain, ring: 'ring-[#14b8a6]/40', bg: 'bg-[#14b8a6]/15', color: 'text-[#5eead4]' },
  { match: /pricing|tier|monetization/i, icon: Sparkles, ring: 'ring-[#f59e0b]/40', bg: 'bg-[#f59e0b]/15', color: 'text-[#fbbf24]' },
];
const FALLBACK_VISUAL = { icon: Network, ring: 'ring-pulse-500/40', bg: 'bg-pulse-500/15', color: 'text-pulse-300' };

function getTopicVisual(title: string) {
  return TOPIC_VISUALS.find((v) => v.match.test(title)) ?? FALLBACK_VISUAL;
}

const avatarColors = ['from-[#a855f7] to-[#6366f1]', 'from-[#3b82f6] to-[#06b6d4]', 'from-[#14b8a6] to-[#22c55e]', 'from-[#f59e0b] to-[#f43f5e]'];

export function DiscussionsList({ topics, decisions, searchOpen, query, onQueryChange, onCloseSearch, onSelectTopic }: DiscussionsListProps) {
  const [filter, setFilter] = useState<'all' | 'mine'>('all');

  const pinnedTitles = useMemo(() => new Set(decisions.map((d) => d.title.toLowerCase())), [decisions]);
  const visible = useMemo(() => {
    const byQuery = topics.filter((t) => `${t.title} ${t.summary} ${t.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase()));
    if (filter === 'all') return byQuery;
    return byQuery.filter((t) => t.participants > 0);
  }, [topics, query, filter]);

  return (
    <div className="mt-6 px-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-pulse-300" />
          <h2 className="font-display text-sm font-bold tracking-wide">ACTIVE DISCUSSIONS</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5 text-[10px] font-semibold">
            <button onClick={() => setFilter('all')} className={`rounded-full px-2.5 py-1 ${filter === 'all' ? 'bg-[#7c3aed] text-white' : 'text-ink-400'}`}>All</button>
            <button onClick={() => setFilter('mine')} className={`rounded-full px-2.5 py-1 ${filter === 'mine' ? 'bg-[#7c3aed] text-white' : 'text-ink-400'}`}>My Nodes</button>
          </div>
          <button className="icon-btn h-8 w-8"><List className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {searchOpen && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500" />
            <input autoFocus value={query} onChange={(e) => onQueryChange(e.target.value)} placeholder="Search discussions…" className="field pl-9 text-sm" />
          </div>
          <button className="icon-btn" onClick={onCloseSearch}><X /></button>
        </motion.div>
      )}

      <div className="mt-3 space-y-3">
        {visible.map((node, i) => {
          const visual = getTopicVisual(node.title);
          const Icon = visual.icon;
          const lastMessage = node.messages[node.messages.length - 1];
          const authors = [...new Set(node.messages.map((m) => m.author))];
          const isPinned = pinnedTitles.has(node.title.toLowerCase());
          const messageCount = node.metric.find((m) => m.label === 'Messages')?.value ?? node.messages.length;

          return (
            <motion.button
              key={node.id}
              onClick={() => onSelectTopic(node)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass w-full rounded-2xl p-3.5 text-left transition-colors hover:border-pulse-500/30"
            >
              <div className="flex items-start gap-3">
                <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ring-1 ${visual.ring} ${visual.bg}`}>
                  <Icon className={`h-5 w-5 ${visual.color}`} strokeWidth={2.2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="truncate font-display text-sm font-semibold text-ink-50">{node.title}</h3>
                    {isPinned && <Pin className="h-3 w-3 shrink-0 text-pulse-300" />}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-ink-500">
                    <span>{messageCount} messages</span>
                    <span>·</span>
                    <span>{node.lastActive}</span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-ink-400">{node.summary}</p>
                </div>
                <div className="flex shrink-0 -space-x-2">
                  {authors.slice(0, 3).map((author, idx) => (
                    <div key={author} className={`h-6 w-6 rounded-full border-2 border-ink-900 bg-gradient-to-br ${avatarColors[idx % avatarColors.length]} grid place-items-center text-[9px] font-bold text-white`}>
                      {author.slice(0, 1)}
                    </div>
                  ))}
                  {authors.length > 3 && (
                    <div className="h-6 w-6 rounded-full border-2 border-ink-900 bg-white/10 grid place-items-center text-[9px] font-bold text-ink-200">
                      +{authors.length - 3}
                    </div>
                  )}
                </div>
              </div>

              {lastMessage && (
                <div className="mt-3 rounded-xl border border-white/5 bg-black/25 p-2.5">
                  <p className="text-[11px] font-semibold text-pulse-300">{lastMessage.author}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-ink-200">{lastMessage.text}</p>
                  <div className="mt-1 flex items-center gap-1 text-[9px] text-ink-500">
                    {lastMessage.time} <CheckCheck className="h-3 w-3 text-pulse-400" />
                  </div>
                </div>
              )}
            </motion.button>
          );
        })}
        {visible.length === 0 && <p className="py-8 text-center text-xs text-ink-500">No discussions match yet.</p>}
      </div>
    </div>
  );
}
