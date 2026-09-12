import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Bot, CheckCircle2, MessageCircle, Users, Vote } from 'lucide-react';
import { getWorkspaceSubscription, getWorkspaceUsage } from '@/lib/pulseApi';
import { getLimit, usageValue } from '@/lib/planEntitlements';
import type { SubscriptionPlan, WorkspaceSubscription, WorkspaceUsage } from '@/types';

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
  const [usage, setUsage] = useState<WorkspaceUsage | null>(null);
  const [sub, setSub] = useState<WorkspaceSubscription | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([getWorkspaceUsage(workspaceId), getWorkspaceSubscription(workspaceId)])
      .then(([u, s]) => { setUsage(u); setSub(s); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to load usage.'));
  }, [workspaceId]);

  const plan = (sub?.plan ?? 'free') as SubscriptionPlan;
  const limits = useMemo(() => ({ members: getLimit(plan, 'members'), aiAnalyses: getLimit(plan, 'aiAnalyses'), automations: getLimit(plan, 'automations') }), [plan]);
  if (error) return <p className="text-xs text-ember-300">{error}</p>;
  if (!usage) return <p className="text-xs text-ink-500">Loading…</p>;

  return <div className="space-y-4">
    <div className="glass rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">Workspace usage</h2><p className="mt-1 text-[11px] text-ink-500">Plan-aware usage for the current workspace.</p></div><span className="rounded-full bg-pulse-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-pulse-200">{plan}</span></div>
      <div className="mt-4 grid gap-2"><Meter label="Team members" value={usage.activeMembers} limit={limits.members} /><Meter label="AI analyses" value={usage.aiAnalysesRun} limit={limits.aiAnalyses} /><Meter label="Automation runs" value={usage.automationsRun} limit={limits.automations} /></div>
    </div>
    <div className="glass rounded-2xl p-4"><h3 className="text-sm font-semibold">Workspace activity</h3><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"><Stat icon={Users} value={usage.activeMembers} label="Members" /><Stat icon={MessageCircle} value={usage.discussionsCreated} label="Discussions" /><Stat icon={Vote} value={usage.decisionsMade} label="Decisions" /><Stat icon={BarChart3} value={usage.pollsCreated} label="Polls" /><Stat icon={Bot} value={usage.aiAnalysesRun} label="AI analyses" /><Stat icon={CheckCircle2} value={usage.automationsRun} label="Automation runs" /></div></div>
    <p className="px-1 text-[11px] leading-5 text-ink-600">Usage limits are workspace-level. Billing status and feature access are evaluated from the subscription record.</p>
  </div>;
}
