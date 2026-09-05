import { Calendar, CheckCircle2, Clock3, FolderOpen, MessageCircle, Users, Vote } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ActivePoll, DecisionSummary, TopicNode } from '@/types';
import type { DashboardData } from '@/lib/pulseApi';
import { LivingStateLedger } from '@/components/home/LivingStateLedger';

interface DashboardViewProps {
  greetingName: string;
  topics: TopicNode[];
  polls: ActivePoll[];
  decisions: DecisionSummary[];
  resources: { name: string; icon: typeof FolderOpen }[];
  data: DashboardData;
  onOpenDecision: (id: string) => void;
  onViewAllDecisions: () => void;
  onVoteNow: () => void;
  onOpenResourceHub: () => void;
}

function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function SummaryCard({ icon: Icon, value, label }: { icon: typeof MessageCircle; value: number; label: string }) {
  return (
    <div className="glass rounded-2xl p-3.5">
      <Icon className="h-4 w-4 text-pulse-300" />
      <p className="mt-2 font-display text-xl font-bold">{value}</p>
      <p className="text-[11px] text-ink-500">{label}</p>
    </div>
  );
}

function Section({ icon: Icon, title, count, children }: { icon: typeof Clock3; title: string; count: number; children: ReactNode }) {
  return (
    <section className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-pulse-300" /> {title}
        <span className="ml-auto rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-ink-400">{count}</span>
      </div>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

export function DashboardView({ greetingName, topics, polls, decisions, resources, data, onOpenDecision, onViewAllDecisions, onVoteNow, onOpenResourceHub }: DashboardViewProps) {
  const pendingDecisions = decisions.filter((d) => !d.outcome).length;

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pb-28 pt-5">
      <div>
        <h1 className="font-display text-2xl font-semibold">{timeGreeting()}, {greetingName}</h1>
        <p className="mt-1 text-sm text-ink-400">Here's what's happening across your workspace.</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <SummaryCard icon={MessageCircle} value={topics.length} label="Active Discussions" />
        <SummaryCard icon={Vote} value={pendingDecisions} label="Decisions Pending" />
        <SummaryCard icon={Users} value={polls.length} label="Polls Running" />
        <SummaryCard icon={CheckCircle2} value={data.upcomingDeadlines.length} label="Deadlines Ahead" />
      </div>

      <LivingStateLedger
        decisions={decisions}
        polls={polls}
        resources={resources}
        onViewAllDecisions={onViewAllDecisions}
        onVoteNow={onVoteNow}
        onOpenResourceHub={onOpenResourceHub}
      />

      <Section icon={Clock3} title="Decisions waiting for you" count={data.waitingForYou.length}>
        {data.waitingForYou.map((d) => (
          <button key={d.id} onClick={() => onOpenDecision(d.id)} className="mini-card block w-full text-left">
            <b>{d.title}</b>
            <p>{d.deadline ? `Due ${new Date(d.deadline).toLocaleDateString()}` : 'No deadline set'}</p>
          </button>
        ))}
        {data.waitingForYou.length === 0 && <p className="text-xs text-ink-500">You're all caught up.</p>}
      </Section>

      <Section icon={CheckCircle2} title="Decisions you've made" count={data.decidedByYou.length}>
        {data.decidedByYou.map((d) => (
          <button key={d.id} onClick={() => onOpenDecision(d.id)} className="mini-card block w-full text-left">
            <b>{d.title}</b>
            <p>{d.outcome ? `Marked ${d.outcome}` : 'Voted'}{d.decidedAt ? ` · ${new Date(d.decidedAt).toLocaleDateString()}` : ''}</p>
          </button>
        ))}
        {data.decidedByYou.length === 0 && <p className="text-xs text-ink-500">Nothing recorded yet.</p>}
      </Section>

      <Section icon={Calendar} title="Upcoming deadlines" count={data.upcomingDeadlines.length}>
        {data.upcomingDeadlines.map((d) => (
          <button key={d.id} onClick={() => onOpenDecision(d.id)} className="mini-card block w-full text-left">
            <b>{d.title}</b>
            <p>Due {new Date(d.deadline!).toLocaleDateString()}</p>
          </button>
        ))}
        {data.upcomingDeadlines.length === 0 && <p className="text-xs text-ink-500">No deadlines on the horizon.</p>}
      </Section>

      <Section icon={Users} title="Team activity" count={data.teamActivity.length}>
        {data.teamActivity.map((entry) => (
          <div key={entry.id} className="mini-card">
            <b>{entry.changedByName ?? 'A teammate'}</b>
            <p>{entry.outcome ? `marked a decision ${entry.outcome}` : `updated status to ${entry.status}`}{entry.note ? ` — ${entry.note}` : ''}</p>
          </div>
        ))}
        {data.teamActivity.length === 0 && <p className="text-xs text-ink-500">No activity yet.</p>}
      </Section>
    </div>
  );
}
