import { useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import type { ActivePoll, DecisionSummary, TopicNode } from '@/types';
import { LivingStateLedger } from './LivingStateLedger';
import { DiscussionsList } from './DiscussionsList';

interface HomeFeedProps {
  topics: TopicNode[];
  decisions: DecisionSummary[];
  polls: ActivePoll[];
  resources: { name: string; icon: typeof FileText }[];
  onSelectTopic: (topic: TopicNode) => void;
  onViewAllDecisions: () => void;
  onVoteNow: () => void;
  onOpenResourceHub: () => void;
}

export function HomeFeed({ topics, decisions, polls, resources, onSelectTopic, onViewAllDecisions, onVoteNow, onOpenResourceHub }: HomeFeedProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () => topics.filter((t) => `${t.title} ${t.summary} ${t.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())),
    [topics, query]
  );

  return (
    <div className="mx-auto max-w-2xl pb-28">
      <div className="sticky top-0 z-20 bg-ink-950/95 pb-1 pt-3 backdrop-blur">
        <LivingStateLedger
          decisions={decisions}
          polls={polls}
          resources={resources}
          onViewAllDecisions={onViewAllDecisions}
          onVoteNow={onVoteNow}
          onOpenResourceHub={onOpenResourceHub}
        />
      </div>

      <DiscussionsList
        topics={filtered}
        decisions={decisions}
        searchOpen={searchOpen}
        query={query}
        onQueryChange={setQuery}
        onCloseSearch={() => { setSearchOpen(false); setQuery(''); }}
        onSelectTopic={onSelectTopic}
      />
    </div>
  );
}
