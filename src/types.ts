export type IntentWave = 'whisper' | 'standard' | 'pulse';

export interface PinnedDecision {
  id: string;
  title: string;
  status: 'decided' | 'in-review' | 'revisiting';
  summary: string;
  timestamp: string;
}

export interface PollOption {
  id: string;
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

// ---- Decision Room ----

export type DecisionOutcome = 'approved' | 'rejected' | 'postponed';
export type VoteChoice = 'yes' | 'no' | 'needs_info';

export interface DecisionResource {
  id: string;
  name: string;
  url: string | null;
  createdAt: string;
}

export interface DecisionSummary {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  status: PinnedDecision['status'];
  outcome: DecisionOutcome | null;
  deadline: string | null;
  ownerId: string | null;
  ownerName: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  decidedAt: string | null;
}

export interface DecisionVoteTally {
  yes: number;
  no: number;
  needsInfo: number;
  total: number;
  myVote: VoteChoice | null;
}

export interface DecisionComment {
  id: string;
  decisionId: string;
  parentCommentId: string | null;
  authorId: string;
  authorName: string;
  body: string;
  mentionedUserIds: string[];
  createdAt: string;
}

export interface DecisionHistoryEntry {
  id: string;
  status: string | null;
  outcome: string | null;
  note: string | null;
  changedByName: string | null;
  createdAt: string;
}

export interface DecisionAIAnalysis {
  id: string;
  summary: string;
  disagreements: string | null;
  strongestArguments: string | null;
  recommendation: string | null;
  confidence: number | null;
  createdAt: string;
}
