import type {
  PinnedDecision,
  ActivePoll,
  QuickLink,
  TopicNode,
  IntentWave,
} from './types';

export const pinnedDecisions: PinnedDecision[] = [
  {
    id: 'd1',
    title: 'Logo lockup: wordmark only',
    status: 'decided',
    summary: 'Dropped the symbol mark — wordmark carries cleaner at small sizes.',
    timestamp: '2h ago',
  },
  {
    id: 'd2',
    title: 'Pricing tier structure',
    status: 'in-review',
    summary: 'Three-tier model proposed. Awaiting finance sign-off on the mid band.',
    timestamp: '5h ago',
  },
  {
    id: 'd3',
    title: 'Launch geography',
    status: 'revisiting',
    summary: 'Reconsidering EU-first after regulatory scan flagged cookie compliance.',
    timestamp: '1d ago',
  },
];

export const activePolls: ActivePoll[] = [
  {
    id: 'p1',
    question: 'Which hero visual direction?',
    totalVotes: 24,
    timeLeft: '3h left',
    options: [
      { id: 'opt-cinematic', label: 'Cinematic product film', votes: 12 },
      { id: 'opt-editorial', label: 'Editorial photography', votes: 8 },
      { id: 'opt-abstract', label: 'Abstract motion graphics', votes: 4 },
    ],
  },
  {
    id: 'p2',
    question: 'Beta access model?',
    totalVotes: 18,
    timeLeft: '1d left',
    options: [
      { id: 'opt-waitlist', label: 'Invite-only waitlist', votes: 11 },
      { id: 'opt-public-beta', label: 'Open public beta', votes: 7 },
    ],
  },
];

export const quickLinks: QuickLink[] = [
  { id: 'q1', label: 'Brand Guide', icon: 'Palette', color: 'text-pulse-400' },
  { id: 'q2', label: 'Roadmap', icon: 'Map', color: 'text-flux-400' },
  { id: 'q3', label: 'Assets', icon: 'FolderOpen', color: 'text-alert-400' },
  { id: 'q4', label: 'Team', icon: 'Users', color: 'text-ember-400' },
  { id: 'q5', label: 'Metrics', icon: 'BarChart3', color: 'text-pulse-300' },
];

export const topicNodes: TopicNode[] = [
  {
    id: 't1',
    title: 'Brand Identity',
    status: 'active',
    summary:
      'Exploring visual language, tone of voice, and the core personality pillars that will define how PULSE feels across every touchpoint.',
    participants: 6,
    lastActive: '12m ago',
    tags: ['visual', 'tone', 'logo'],
    metric: [
      { label: 'Decisions', value: '4' },
      { label: 'Polls', value: '2' },
      { label: 'Messages', value: '38' },
    ],
    messages: [
      {
        id: 'm1',
        author: 'Maya',
        avatar: 'M',
        text: 'The wordmark-only direction is testing really well at 16px. The symbol was adding noise without adding meaning.',
        time: '12m',
        intent: 'standard',
      },
      {
        id: 'm2',
        author: 'Devon',
        avatar: 'D',
        text: 'Agreed. Let us pin this and move the symbol into the app-icon exploration instead.',
        time: '8m',
        intent: 'standard',
      },
      {
        id: 'm3',
        author: 'Priya',
        avatar: 'P',
        text: 'Flagging for everyone — the color contrast on the cyan-on-dark passes AA but fails AAA. Do we care?',
        time: '3m',
        intent: 'pulse',
      },
    ],
  },
  {
    id: 't2',
    title: 'Launch Strategy',
    status: 'heating',
    summary:
      'Sequencing the rollout, choosing the first market, and deciding between a splash launch versus a slow-burn invite wave.',
    participants: 9,
    lastActive: '25m ago',
    tags: ['go-to-market', 'sequencing', 'beta'],
    metric: [
      { label: 'Decisions', value: '2' },
      { label: 'Polls', value: '1' },
      { label: 'Messages', value: '51' },
    ],
    messages: [
      {
        id: 'm4',
        author: 'Lena',
        avatar: 'L',
        text: 'I am leaning invite-only. It gives us a controlled narrative and lets us fix rough edges before the masses see it.',
        time: '25m',
        intent: 'standard',
      },
      {
        id: 'm5',
        author: 'Marco',
        avatar: 'M',
        text: 'Counterpoint: the hype window is now. A slow burn risks losing momentum to competitors shipping next month.',
        time: '20m',
        intent: 'pulse',
      },
      {
        id: 'm6',
        author: 'Sasha',
        avatar: 'S',
        text: 'What if we do both? Invite wave week one, public gate week three. Best of both.',
        time: '15m',
        intent: 'whisper',
      },
    ],
  },
  {
    id: 't3',
    title: 'Pricing Model',
    status: 'settling',
    summary:
      'Working through tier boundaries, feature gating, and whether annual billing deserves a discount steep enough to drive conversions.',
    participants: 4,
    lastActive: '2h ago',
    tags: ['monetization', 'tiers', 'packaging'],
    metric: [
      { label: 'Decisions', value: '1' },
      { label: 'Polls', value: '0' },
      { label: 'Messages', value: '19' },
    ],
    messages: [
      {
        id: 'm7',
        author: 'Devon',
        avatar: 'D',
        text: 'Three tiers feels right. Free, Pro at $12, and Team at $29. The mid-band needs a killer feature to justify the jump.',
        time: '2h',
        intent: 'standard',
      },
      {
        id: 'm8',
        author: 'Maya',
        avatar: 'M',
        text: 'What is the killer feature though? We keep saying it without defining it.',
        time: '1h',
        intent: 'whisper',
      },
    ],
  },
  {
    id: 't4',
    title: 'Onboarding Flow',
    status: 'active',
    summary:
      'Designing the first-run experience — how much to explain upfront versus letting people discover through guided action.',
    participants: 5,
    lastActive: '45m ago',
    tags: ['first-run', 'ux', 'education'],
    metric: [
      { label: 'Decisions', value: '0' },
      { label: 'Polls', value: '1' },
      { label: 'Messages', value: '27' },
    ],
    messages: [
      {
        id: 'm9',
        author: 'Priya',
        avatar: 'P',
        text: 'The three-screen carousel is too much text. People skip it. We need a do-first-explain-later approach.',
        time: '45m',
        intent: 'standard',
      },
      {
        id: 'm10',
        author: 'Lena',
        avatar: 'L',
        text: 'Love the idea of a guided first action. Maybe the first thing they do is create a topic node, not fill a profile.',
        time: '30m',
        intent: 'standard',
      },
    ],
  },
];

export const intentWaveConfig: Record<
  IntentWave,
  { label: string; description: string; color: string; ringColor: string; bg: string; borderColor: string; icon: string }
> = {
  whisper: {
    label: 'Whisper',
    description: 'Low-stakes, informal',
    color: 'text-ink-300',
    ringColor: 'ring-ink-500',
    bg: 'bg-ink-800/60',
    borderColor: 'border-ink-600',
    icon: 'Feather',
  },
  standard: {
    label: 'Standard',
    description: 'Normal priority',
    color: 'text-pulse-300',
    ringColor: 'ring-pulse-500/60',
    bg: 'bg-pulse-500/10',
    borderColor: 'border-pulse-500/40',
    icon: 'MessageSquare',
  },
  pulse: {
    label: 'Pulse Alert',
    description: 'High-visibility, urgent',
    color: 'text-ember-400',
    ringColor: 'ring-ember-500/60',
    bg: 'bg-ember-500/10',
    borderColor: 'border-ember-500/40',
    icon: 'Zap',
  },
};
