export type IntentWave = 'whisper' | 'standard' | 'pulse';

export interface PinnedDecision {
  id: string;
  title: string;
  status: 'decided' | 'in-review' | 'revisiting';
  summary: string;
  timestamp: string;
}

export interface PollOption {
  label: string;
  votes: number;
}

export interface ActivePoll {
  id: string;
  question: string;
  totalVotes: number;
  options: PollOption[];
  timeLeft: string;
}

export interface QuickLink {
  id: string;
  label: string;
  icon: string;
  color: string;
}

export type TopicStatus = 'active' | 'heating' | 'settling' | 'archived';

export interface FeedMessage {
  id: string;
  author: string;
  avatar: string;
  text: string;
  time: string;
  intent: IntentWave;
}

export interface TopicNode {
  id: string;
  title: string;
  status: TopicStatus;
  summary: string;
  participants: number;
  lastActive: string;
  tags: string[];
  messages: FeedMessage[];
  metric: { label: string; value: string }[];
}
