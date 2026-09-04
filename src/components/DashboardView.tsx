import { Calendar, CheckCircle2, Clock3, Users } from 'lucide-react';
import type { DashboardData } from '@/lib/pulseApi';

interface DashboardViewProps {
  data: DashboardData;
  onOpenDecision: (id: string) => void;
}

function Section({ icon: Icon, title, count, children }: { icon: typeof Clock3; title: string; count: number; children: React.ReactNode }) {
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

export function DashboardView({ data, onOpenDecision }: DashboardViewProps) {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pb-28 pt-5">
      <div>
        <p className="text-xs uppercase tracking-[.2em] text-pulse-300">Overview</p>
        <h1 className="mt-1 font-display text-2xl font-semibold">Dashboard</h1>
      </div>

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
