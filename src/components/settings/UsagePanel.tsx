import { useEffect, useState } from 'react';
import { BarChart3, MessageCircle, Sparkles, Users, Vote } from 'lucide-react';
import { getWorkspaceUsage } from '@/lib/pulseApi';
import type { WorkspaceUsage } from '@/types';

function Stat({ icon: Icon, value, label }: { icon: typeof Vote; value: number; label: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
      <Icon className="h-3.5 w-3.5 text-pulse-300" />
      <p className="mt-1.5 font-display text-lg font-bold">{value}</p>
      <p className="text-[10px] text-ink-500">{label}</p>
    </div>
  );
}

export function UsagePanel({ workspaceId }: { workspaceId: string }) {
  const [usage, setUsage] = useState<WorkspaceUsage | null>(null);

  useEffect(() => { getWorkspaceUsage(workspaceId).then(setUsage); }, [workspaceId]);

  if (!usage) return <p className="text-xs text-ink-500">Loading…</p>;

  return (
    <div className="glass rounded-2xl p-4">
      <h2 className="text-sm font-semibold">Workspace usage</h2>
      <p className="mt-1 text-[11px] text-ink-500">All-time totals, computed from your real data.</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat icon={Users} value={usage.activeMembers} label="Members" />
        <Stat icon={MessageCircle} value={usage.discussionsCreated} label="Discussions" />
        <Stat icon={Vote} value={usage.decisionsMade} label="Decisions" />
        <Stat icon={BarChart3} value={usage.pollsCreated} label="Polls" />
        <Stat icon={Sparkles} value={usage.aiAnalysesRun} label="AI analyses run" />
      </div>
      <p className="mt-3 text-[11px] text-ink-600">Storage usage isn't tracked per-workspace yet — uploaded files are billed at the project level in your Supabase dashboard for now.</p>
    </div>
  );
}
