import { useMemo, useState } from 'react';
import type { DecisionSummary, TopicNode } from '@/types';
import { DiscussionsList } from '@/components/home/DiscussionsList';

interface DiscussionsViewProps {
  topics: TopicNode[];
  decisions: DecisionSummary[];
  onSelectTopic: (topic: TopicNode) => void;
}

export function DiscussionsView({ topics, decisions, onSelectTopic }: DiscussionsViewProps) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () => topics.filter((t) => `${t.title} ${t.summary} ${t.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())),
    [topics, query]
  );

  return (
    <div className="mx-auto max-w-2xl pb-28 pt-5">
      <div className="px-4">
        <p className="text-xs uppercase tracking-[.2em] text-pulse-300">Workspace</p>
        <h1 className="mt-1 font-display text-2xl font-semibold">Discussions</h1>
      </div>
      <DiscussionsList
        topics={filtered}
        decisions={decisions}
        searchOpen
        query={query}
        onQueryChange={setQuery}
        onCloseSearch={() => setQuery('')}
        onSelectTopic={onSelectTopic}
      />
    </div>
  );
}
