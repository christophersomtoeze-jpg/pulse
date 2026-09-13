import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Bot, CheckCircle2, MessageCircle, Users, Vote } from 'lucide-react';
import { getWorkspaceSubscription, getWorkspaceUsageSnapshot } from '@/lib/pulseApi';
import type { SubscriptionPlan, WorkspaceSubscription, WorkspaceUsageSnapshot } from '@/types';

function Meter({ label, value, limit }: { label: string; value: number; limit: number | null }) {
  const pct = limit === null ? 0 : Math.min(100, Math.round((value / Math.max(limit, 1)) * 100));
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-ink-300">{label}</span>
        <span className="font-semibold text-ink-100">{value}{limit === null ? '' : ` / ${limit}`}</span>
      </div>
      {limit !== null && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-pulse-400" style={{ width: `${pct}%` }} /></div>}
      {limit === null && <p className="mt-1 text-[10px] text-pulse-300">Unlimited on {label === 'Team members' ? 'Enterprise' : 'Enterprise'}</p>}
    </div>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof Vote; value: number; label: string }) {
  return <div className="rounded-xl border border-white/5 bg-black/20 p-3"><Icon className="h-3.5 w-3.5 text-pulse-300" /><p className="mt-1.5 font-display text-lg font-bold">{value}</p><p className="text-[10px] text-ink-500">{label}</p></div>;
}

export function UsagePanel({ workspaceId }: { workspaceId: string }) {
  const [usage, setUsage] = useState<WorkspaceUsageSnapshot | null>(null);
  const [sub, setSub] = useState<WorkspaceSubscription | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([getWorkspaceUsageSnapshot(workspaceId), getWorkspaceSubscription(workspaceId)])
      .then(([u, s]) => { setUsage(u); setSub(s); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to load usage.'));
  }, [workspaceId]);

  if (error) return <p className="text-xs text-ember-300">{error}</p>;
  if (!usage) return <p className="text-xs text-ink-500">Loading…</p>;

  const plan = (sub?.plan ?? usage.plan ?? 'free') as SubscriptionPlan;
  const limits = useMemo(() => ({
    members: usage.memberLimit,
    aiAnalyses: usage.aiAnalysesLimit,
    automations: usage.automationsLimit,
  }), [usage]);
  const health = [
    ['Team members', usage.activeMembers, limits.members],
    ['AI analyses', usage.aiAnalysesRun, limits.aiAnalyses],
    ['Automation runs', usage.automationsRun, limits.automations],
  ].map(([label, value, limit]) => ({ label: String(label), value: Number(value), limit: limit == null ? null : Number(limit), pct: limit == null ? 0 : Number(limit) === 0 ? 100 : Math.round((Number(value) / Number(limit)) * 100) }))
    .filter((m) => m.limit !== null)
    .sort((a, b) => b.pct - a.pct);
  const attention = health.find((m) => m.pct >= 80);

  return <div className="space-y-4">
    {attention && (
      <div className={`rounded-2xl border p-4 ${attention.pct >= 100 ? 'border-ember-400/25 bg-ember-400/5' : 'border-alert-400/25 bg-alert-400/5'}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`text-xs font-semibold ${attention.pct >= 100 ? 'text-ember-300' : 'text-alert-300'}`}>
              {attention.pct >= 100 ? 'Limit reached' : 'Approaching plan limit'}
            </p>
            <p className="mt-1 text-xs leading-5 text-ink-400">
              {attention.label} is at {Math.min(attention.pct, 100)}% of this workspace's {plan} allowance.
            </p>
          </div>
          <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-semibold text-ink-300">{attention.value}{attention.limit === null ? '' : ` / ${attention.limit}`}</span>
        </div>
        <button onClick={() => window.dispatchEvent(new CustomEvent('pulse:open-billing'))} className="mt-3 text-[11px] font-semibold text-pulse-200 hover:text-pulse-100">Review plan →</button>
      </div>
    )}
    <div className="glass rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">Workspace usage</h2><p className="mt-1 text-[11px] text-ink-500">Plan-aware usage for the current workspace.</p></div><span className="rounded-full bg-pulse-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-pulse-200">{plan}</span></div>
      <div className="mt-4 grid gap-2"><Meter label="Team members" value={usage.activeMembers} limit={limits.members} /><Meter label="AI analyses" value={usage.aiAnalysesRun} limit={limits.aiAnalyses} /><Meter label="Automation runs" value={usage.automationsRun} limit={limits.automations} /></div>
    </div>
    <div className="glass rounded-2xl p-4"><h3 className="text-sm font-semibold">Workspace activity</h3><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"><Stat icon={Users} value={usage.activeMembers} label="Members" /><Stat icon={MessageCircle} value={usage.discussionsCreated} label="Discussions" /><Stat icon={Vote} value={usage.decisionsMade} label="Decisions" /><Stat icon={BarChart3} value={usage.pollsCreated} label="Polls" /><Stat icon={Bot} value={usage.aiAnalysesRun} label="AI analyses" /><Stat icon={CheckCircle2} value={usage.automationsRun} label="Automation runs" /></div></div>
    <p className="px-1 text-[11px] leading-5 text-ink-600">Usage limits are workspace-level. Billing status and feature access are evaluated from the subscription record.</p>
  </div>;
}
