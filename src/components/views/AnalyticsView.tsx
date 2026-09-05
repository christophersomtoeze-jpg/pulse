import { useEffect, useState } from 'react';
import { AlertOctagon, CheckCircle2, Clock3, PieChart, TrendingUp, Users } from 'lucide-react';
import { computeAnalytics } from '@/lib/pulseApi';
import type { AnalyticsSnapshot } from '@/types';

function StatCard({ icon: Icon, value, label }: { icon: typeof Clock3; value: string; label: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <Icon className="h-4 w-4 text-pulse-300" />
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
      <p className="text-[11px] text-ink-500">{label}</p>
    </div>
  );
}

export function AnalyticsView({ workspaceId }: { workspaceId: string }) {
  const [data, setData] = useState<AnalyticsSnapshot | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    computeAnalytics(workspaceId).then(setData).catch((e) => setError(e instanceof Error ? e.message : 'Could not compute analytics'));
  }, [workspaceId]);

  if (error) return <div className="mx-auto max-w-2xl px-4 pt-5 text-sm text-ember-400">{error}</div>;
  if (!data) return <div className="mx-auto max-w-2xl px-4 pt-5 text-xs text-ink-500">Crunching numbers…</div>;

  const maxActivity = Math.max(1, ...data.discussionActivity.map((d) => d.count));

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pb-28 pt-5">
      <div>
        <p className="flex items-center gap-1.5 text-xs uppercase tracking-[.2em] text-pulse-300"><PieChart className="h-3.5 w-3.5" /> Phase 5 — Business</p>
        <h1 className="mt-1 font-display text-2xl font-semibold">Analytics</h1>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <StatCard icon={TrendingUp} value={String(data.decisionsThisMonth)} label="Decisions this month" />
        <StatCard icon={Clock3} value={data.avgDecisionDays !== null ? `${data.avgDecisionDays.toFixed(1)}d` : '—'} label="Avg. decision time" />
        <StatCard icon={AlertOctagon} value={String(data.stuckDecisions)} label="Stuck decisions" />
        <StatCard icon={CheckCircle2} value={String(data.completedDecisions)} label="Completed" />
        <StatCard icon={Users} value={`${data.participationPct}%`} label="Team participation" />
        <StatCard icon={AlertOctagon} value={String(data.overdueActions)} label="Overdue actions" />
      </div>

      <div className="glass rounded-2xl p-4">
        <h3 className="text-sm font-semibold">Discussion activity</h3>
        {data.discussionActivity.length === 0 ? (
          <p className="mt-2 text-xs text-ink-500">No messages yet to chart.</p>
        ) : (
          <div className="mt-4 flex items-end gap-2" style={{ height: 96 }}>
            {data.discussionActivity.map((d) => (
              <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t-md bg-gradient-to-t from-[#7c3aed] to-[#06b6d4]" style={{ height: `${(d.count / maxActivity) * 100}%`, minHeight: 4 }} />
                <span className="text-[9px] text-ink-500">{d.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
