import { motion } from 'framer-motion';
import {
  Activity, ArrowRight, CheckCircle2, Clock3, MessageCircle, Plus, ShieldAlert,
  Sparkles, Target, Users, Vote, Brain, AlertTriangle, TrendingUp, ChevronRight,
} from 'lucide-react';
import type { ActivePoll, DecisionSummary, DecisionHistoryEntry, TopicNode, WorkspaceAction } from '@/types';
import type { WorkspaceMember, DashboardData } from '@/lib/pulseApi';

interface DashboardViewProps {
  workspaceName: string;
  members: WorkspaceMember[];
  decisions: DecisionSummary[];
  polls: ActivePoll[];
  topics: TopicNode[];
  actions: WorkspaceAction[];
  risks: number;
  dashboard: DashboardData;
  onNewDecision: () => void;
  onOpenDecision: (id: string) => void;
  onNavigate: (view: 'decisions' | 'discussions' | 'polls' | 'actions' | 'risks' | 'team' | 'pulse-ai'|'audit-log') => void;
}

function formatDate(value: string | null) {
  if (!value) return 'No deadline';
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function healthTone(score: number) {
  if (score >= 80) return { label: 'Healthy', text: 'text-flux-300', bar: 'bg-flux-400' };
  if (score >= 60) return { label: 'Watch', text: 'text-alert-300', bar: 'bg-alert-400' };
  return { label: 'At risk', text: 'text-ember-300', bar: 'bg-ember-400' };
}

function priorityLabel(item: DecisionSummary, waiting: boolean) {
  if (waiting) return { label: 'Needs your vote', cls: 'text-alert-300 bg-alert-500/10 border-alert-500/15' };
  if (item.deadline && new Date(item.deadline).getTime() < Date.now()) return { label: 'Past deadline', cls: 'text-ember-300 bg-ember-500/10 border-ember-500/15' };
  return { label: 'Open', cls: 'text-pulse-300 bg-[#7c3aed]/10 border-[#7c3aed]/15' };
}

function ActivityRow({ item }: { item: DecisionHistoryEntry }) {
  return (
    <div className="flex gap-3 rounded-xl border border-white/5 bg-white/[.02] p-3">
      <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#7c3aed]/10 text-pulse-300">
        <Activity className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-200">
          {item.changedByName ?? 'A team member'} updated a decision
          {item.outcome ? ` → ${item.outcome}` : ''}
        </p>
        {item.note && <p className="mt-1 truncate text-[11px] text-ink-500">{item.note}</p>}
        <p className="mt-1 text-[10px] text-ink-600">{new Date(item.createdAt).toLocaleString()}</p>
      </div>
    </div>
  );
}

export function DashboardView({ workspaceName, members, decisions, polls, topics, actions, risks, dashboard, onNewDecision, onOpenDecision, onNavigate }: DashboardViewProps) {
  const openDecisions = decisions.filter((d) => !d.outcome);
  const completedDecisions = decisions.filter((d) => Boolean(d.outcome));
  const openActions = actions.filter((a) => a.status !== 'done');
  const overdueActions = actions.filter((a) => a.status !== 'done' && a.deadline && new Date(a.deadline).getTime() < Date.now());

  const waitingIds = new Set(dashboard.waitingForYou.map((d) => d.id));
  const highPressureDecisions = openDecisions
    .map((d) => ({ decision: d, waiting: waitingIds.has(d.id) }))
    .sort((a, b) => {
      const score = (x: { decision: DecisionSummary; waiting: boolean }) =>
        (x.waiting ? 50 : 0) + (x.decision.deadline ? Math.max(0, 30 - Math.max(0, Math.round((new Date(x.decision.deadline).getTime() - Date.now()) / 86400000))) : 0);
      return score(b) - score(a);
    })
    .slice(0, 4);

  const pressure = Math.min(100, dashboard.waitingForYou.length * 12 + overdueActions.length * 15 + risks * 10);
  const intelligenceScore = Math.max(0, Math.min(100, 100 - pressure));
  const health = healthTone(intelligenceScore);

  const cards = [
    { label: 'Open decisions', value: openDecisions.length, icon: Target, action: () => onNavigate('decisions') },
    { label: 'Waiting for you', value: dashboard.waitingForYou.length, icon: Clock3, action: () => onNavigate('decisions') },
    { label: 'Open actions', value: openActions.length, icon: CheckCircle2, action: () => onNavigate('actions') },
    { label: 'Risks detected', value: risks, icon: ShieldAlert, action: () => onNavigate('risks') },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 lg:px-8 lg:pt-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.25em] text-pulse-300">PULSE COMMAND CENTER</p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight md:text-3xl">Good to see you in {workspaceName}</h1>
          <p className="mt-1 text-sm text-ink-400">See what needs a decision, what is moving, and where your team is getting stuck.</p>
        </div>
        <button onClick={onNewDecision} className="primary-btn w-full justify-center md:w-auto"><Plus className="h-4 w-4" /> New decision</button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, action }, i) => (
          <motion.button key={label} onClick={action} whileHover={{ y: -2 }} className="glass-strong rounded-2xl p-4 text-left transition-colors hover:border-[#7c3aed]/30">
            <div className="flex items-center justify-between"><div className="grid h-8 w-8 place-items-center rounded-xl bg-[#7c3aed]/10 text-pulse-300"><Icon className="h-4 w-4" /></div><span className="text-[9px] text-ink-600">0{i + 1}</span></div>
            <p className="mt-4 text-2xl font-semibold">{value}</p>
            <p className="mt-1 text-[11px] text-ink-500">{label}</p>
          </motion.button>
        ))}
      </div>

      <section className="mt-5 glass-strong overflow-hidden rounded-3xl p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#7c3aed]/20 to-[#06b6d4]/15 text-pulse-300 shadow-glow">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2"><h2 className="font-display text-base font-semibold">Decision intelligence</h2><span className="rounded-full border border-white/5 bg-white/[.03] px-2 py-0.5 text-[9px] uppercase tracking-wider text-ink-500">Live signal</span></div>
              <p className="mt-1 max-w-2xl text-xs text-ink-500">PULSE combines decision pressure, team alignment signals, deadlines and active risks into one workspace health signal.</p>
            </div>
          </div>
          <button onClick={() => onNavigate('pulse-ai')} className="primary-btn shrink-0 justify-center"><Sparkles className="h-4 w-4" /> Ask PULSE</button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
          <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
            <div className="flex items-end justify-between"><div><p className="text-[10px] uppercase tracking-[.2em] text-ink-600">Workspace health</p><p className={`mt-2 text-4xl font-semibold ${health.text}`}>{intelligenceScore}</p></div><span className={`mb-1 rounded-full border border-white/5 px-2 py-1 text-[10px] font-semibold ${health.text}`}>{health.label}</span></div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5"><div className={`h-full rounded-full ${health.bar} transition-all`} style={{ width: `${intelligenceScore}%` }} /></div>
            <div className="mt-3 flex justify-between text-[10px] text-ink-600"><span>Pressure {pressure}</span><span>100 = healthy</span></div>
          </div>

          <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
            <div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[.2em] text-ink-600">Priority queue</p><p className="mt-1 text-xs text-ink-500">What PULSE thinks deserves attention first.</p></div><TrendingUp className="h-4 w-4 text-pulse-300" /></div>
            <div className="mt-3 space-y-2">
              {highPressureDecisions.map(({ decision, waiting }) => { const p = priorityLabel(decision, waiting); return (
                <button key={decision.id} onClick={() => onOpenDecision(decision.id)} className="group flex w-full items-center gap-3 rounded-xl border border-white/5 bg-white/[.02] p-2.5 text-left hover:border-[#7c3aed]/25">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#7c3aed]/10 text-pulse-300"><Target className="h-3.5 w-3.5" /></div>
                  <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-ink-200">{decision.title}</p><p className="mt-1 truncate text-[10px] text-ink-600">{decision.description || 'No description yet'}</p></div>
                  <span className={`hidden shrink-0 rounded-full border px-2 py-1 text-[9px] sm:inline-flex ${p.cls}`}>{p.label}</span><ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-600 group-hover:text-pulse-300" />
                </button>
              ); })}
              {highPressureDecisions.length === 0 && <div className="flex items-center gap-3 rounded-xl border border-flux-500/15 bg-flux-500/5 p-3"><CheckCircle2 className="h-4 w-4 text-flux-300" /><p className="text-xs text-ink-300">No urgent decisions detected. Your workspace is clear.</p></div>}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="rounded-xl border border-white/5 bg-white/[.02] p-3"><AlertTriangle className="h-3.5 w-3.5 text-ember-300" /><p className="mt-2 text-lg font-semibold">{risks}</p><p className="text-[9px] uppercase tracking-wider text-ink-600">Active risks</p></div>
          <div className="rounded-xl border border-white/5 bg-white/[.02] p-3"><Clock3 className="h-3.5 w-3.5 text-alert-300" /><p className="mt-2 text-lg font-semibold">{dashboard.waitingForYou.length}</p><p className="text-[9px] uppercase tracking-wider text-ink-600">Waiting on you</p></div>
          <div className="rounded-xl border border-white/5 bg-white/[.02] p-3"><CheckCircle2 className="h-3.5 w-3.5 text-pulse-300" /><p className="mt-2 text-lg font-semibold">{overdueActions.length}</p><p className="text-[9px] uppercase tracking-wider text-ink-600">Overdue actions</p></div>
          <div className="rounded-xl border border-white/5 bg-white/[.02] p-3"><Target className="h-3.5 w-3.5 text-flux-300" /><p className="mt-2 text-lg font-semibold">{completedDecisions.length}</p><p className="text-[9px] uppercase tracking-wider text-ink-600">Decisions closed</p></div>
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_.85fr]">
        <section className="glass-strong rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <div><h2 className="font-display text-base font-semibold">Needs your attention</h2><p className="mt-1 text-xs text-ink-500">Decisions you have not voted on yet.</p></div>
            <button onClick={() => onNavigate('decisions')} className="text-xs font-semibold text-pulse-300">View all</button>
          </div>
          <div className="mt-4 space-y-2">
            {dashboard.waitingForYou.slice(0, 5).map((d) => (
              <button key={d.id} onClick={() => onOpenDecision(d.id)} className="group flex w-full items-center gap-3 rounded-2xl border border-white/5 bg-white/[.02] p-3 text-left hover:border-[#7c3aed]/30">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-alert-500/10 text-alert-300"><Target className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink-100">{d.title}</p><p className="mt-1 truncate text-[11px] text-ink-500">{d.description || 'No additional context'}</p></div>
                <ArrowRight className="h-4 w-4 shrink-0 text-ink-600 transition-transform group-hover:translate-x-0.5 group-hover:text-pulse-300" />
              </button>
            ))}
            {dashboard.waitingForYou.length === 0 && <div className="rounded-2xl border border-flux-500/20 bg-flux-500/5 p-5 text-center"><CheckCircle2 className="mx-auto h-6 w-6 text-flux-300" /><p className="mt-2 text-sm font-medium">You are caught up.</p><p className="mt-1 text-xs text-ink-500">No open decisions are waiting for your vote.</p></div>}
          </div>
        </section>

        <section className="glass-strong rounded-3xl p-5">
          <div className="flex items-center justify-between"><div><h2 className="font-display text-base font-semibold">Team pulse</h2><p className="mt-1 text-xs text-ink-500">Live workspace signals.</p></div><button onClick={() => onNavigate('team')} className="icon-btn"><Users className="h-4 w-4" /></button></div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/5 bg-black/20 p-3"><Users className="h-4 w-4 text-pulse-300" /><p className="mt-3 text-lg font-semibold">{members.length}</p><p className="text-[10px] text-ink-500">Members</p></div>
            <div className="rounded-2xl border border-white/5 bg-black/20 p-3"><MessageCircle className="h-4 w-4 text-pulse-300" /><p className="mt-3 text-lg font-semibold">{topics.length}</p><p className="text-[10px] text-ink-500">Discussions</p></div>
            <div className="rounded-2xl border border-white/5 bg-black/20 p-3"><Vote className="h-4 w-4 text-pulse-300" /><p className="mt-3 text-lg font-semibold">{polls.length}</p><p className="text-[10px] text-ink-500">Open polls</p></div>
            <div className="rounded-2xl border border-white/5 bg-black/20 p-3"><Sparkles className="h-4 w-4 text-pulse-300" /><p className="mt-3 text-lg font-semibold">{completedDecisions.length}</p><p className="text-[10px] text-ink-500">Decided</p></div>
          </div>
          <button onClick={() => onNavigate('pulse-ai')} className="mt-3 flex w-full items-center justify-between rounded-2xl border border-[#7c3aed]/20 bg-[#7c3aed]/5 p-3 text-left hover:bg-[#7c3aed]/10"><span><span className="block text-xs font-semibold">Ask PULSE AI</span><span className="mt-1 block text-[10px] text-ink-500">Find patterns across your workspace.</span></span><ArrowRight className="h-4 w-4 text-pulse-300" /></button>
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="glass-strong rounded-3xl p-5">
          <div className="flex items-center justify-between"><div><h2 className="font-display text-base font-semibold">Upcoming deadlines</h2><p className="mt-1 text-xs text-ink-500">Decisions and actions approaching their due date.</p></div><button onClick={() => onNavigate('actions')} className="text-xs font-semibold text-pulse-300">Actions</button></div>
          <div className="mt-4 space-y-2">
            {dashboard.upcomingDeadlines.slice(0, 3).map((d) => <button key={d.id} onClick={() => onOpenDecision(d.id)} className="flex w-full items-center gap-3 rounded-xl border border-white/5 bg-white/[.02] p-3 text-left"><Clock3 className="h-4 w-4 shrink-0 text-alert-300" /><span className="min-w-0 flex-1 truncate text-xs text-ink-200">{d.title}</span><span className="text-[10px] text-ink-500">{formatDate(d.deadline)}</span></button>)}
            {overdueActions.slice(0, 2).map((a) => <button key={a.id} onClick={() => onNavigate('actions')} className="flex w-full items-center gap-3 rounded-xl border border-ember-500/15 bg-ember-500/5 p-3 text-left"><ShieldAlert className="h-4 w-4 shrink-0 text-ember-300" /><span className="min-w-0 flex-1 truncate text-xs text-ink-200">{a.title}</span><span className="text-[10px] text-ember-300">Overdue</span></button>)}
            {dashboard.upcomingDeadlines.length === 0 && overdueActions.length === 0 && <p className="rounded-xl border border-white/5 p-4 text-xs text-ink-500">No upcoming or overdue work.</p>}
          </div>
        </section>

        <section className="glass-strong rounded-3xl p-5">
          <div className="flex items-center justify-between"><div><h2 className="font-display text-base font-semibold">Recent decision activity</h2><p className="mt-1 text-xs text-ink-500">A short audit trail of what changed.</p></div><button onClick={() => onNavigate('audit-log')} className="text-xs font-semibold text-pulse-300">Audit log</button></div>
          <div className="mt-4 space-y-2">{dashboard.teamActivity.slice(0, 4).map((item) => <ActivityRow key={item.id} item={item} />)}{dashboard.teamActivity.length === 0 && <p className="rounded-xl border border-white/5 p-4 text-xs text-ink-500">No decision activity yet.</p>}</div>
        </section>
      </div>
    </main>
  );
}
