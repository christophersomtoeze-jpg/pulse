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

// ---- Phase 3: Actions ----
export type ActionStatus = 'todo' | 'in-progress' | 'done';
export type ActionPriority = 'low' | 'medium' | 'high';

export interface WorkspaceAction {
  id: string;
  workspaceId: string;
  decisionId: string | null;
  decisionTitle: string | null;
  title: string;
  description: string;
  ownerId: string | null;
  ownerName: string | null;
  deadline: string | null;
  status: ActionStatus;
  priority: ActionPriority;
  createdAt: string;
}

// ---- Global / decision-history search ----
export interface GlobalSearchResults {
  discussions: { id: string; title: string; summary: string }[];
  decisions: { id: string; title: string; description: string }[];
  actions: { id: string; title: string }[];
  resources: { id: string; name: string; url: string | null }[];
  people: { id: string; name: string; email: string }[];
}

// ---- Phase 4: AI ----
export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface MeetingSummary {
  id: string;
  title: string;
  rawNotes: string;
  summary: string | null;
  keyPoints: string | null;
  actionItems: string | null;
  createdAt: string;
}

export type RiskSeverity = 'high' | 'medium' | 'low';
export interface RiskItem {
  id: string;
  kind: 'stalled-discussion' | 'disagreement' | 'missing-evidence' | 'overdue-action';
  severity: RiskSeverity;
  title: string;
  detail: string;
  linkId: string;
}

// ---- Phase 5: Business ----
export interface WorkspaceListItem {
  id: string;
  name: string;
  role: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  detail: string | null;
  actorName: string | null;
  createdAt: string;
}

export interface AnalyticsSnapshot {
  decisionsThisMonth: number;
  avgDecisionDays: number | null;
  stuckDecisions: number;
  completedDecisions: number;
  participationPct: number;
  overdueActions: number;
  discussionActivity: { label: string; count: number }[];
}

export type SubscriptionPlan = 'free' | 'pro' | 'business' | 'enterprise';
export interface WorkspaceSubscription {
  plan: SubscriptionPlan;
  status: 'active' | 'past_due' | 'canceled';
  currentPeriodEnd: string | null;
}

// ---- Phase 6: Integrations ----
export type IntegrationProvider = 'slack' | 'teams' | 'google' | 'microsoft365' | 'jira' | 'notion';
export interface WorkspaceIntegration {
  provider: IntegrationProvider;
  status: 'connected' | 'disconnected';
  connectedAt: string | null;
}
