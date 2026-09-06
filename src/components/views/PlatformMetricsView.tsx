import { useEffect, useState } from 'react';
import { Activity, Building2, TrendingUp, Users, Vote } from 'lucide-react';
import { getPlatformMetrics } from '@/lib/pulseApi';
import type { PlatformMetrics } from '@/types';

function Stat({ icon: Icon, value, label }: { icon: typeof Vote; value: number; label: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <Icon className="h-4 w-4 text-pulse-300" />
      <p className="mt-2 font-display text-2xl font-bold">{value.toLocaleString()}</p>
      <p className="text-[11px] text-ink-500">{label}</p>
    </div>
  );
}

export function PlatformMetricsView() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getPlatformMetrics().then(setMetrics).catch((e) => setError(e instanceof Error ? e.message : 'Could not load metrics'));
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-28 pt-5">
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-[.2em] text-pulse-300"><TrendingUp className="h-3.5 w-3.5" /> Founder-only</p>
      <h1 className="mt-1 font-display text-2xl font-semibold">Platform Metrics</h1>
      <p className="mt-1 text-xs text-ink-500">Real usage across every workspace on PULSE — visible only to platform admins.</p>

      {error && <p className="mt-4 text-sm text-ember-400">{error}</p>}
      {!metrics && !error && <p className="mt-6 text-center text-xs text-ink-500">Loading…</p>}

      {metrics && (
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <Stat icon={Building2} value={metrics.totalWorkspaces} label="Total workspaces" />
          <Stat icon={Users} value={metrics.totalUsers} label="Total users" />
          <Stat icon={Activity} value={metrics.weeklyActiveUsers} label="Weekly active users" />
          <Stat icon={Vote} value={metrics.decisionsCreated7d} label="Decisions (7d)" />
          <Stat icon={Vote} value={metrics.decisionsCreated30d} label="Decisions (30d)" />
          <Stat icon={TrendingUp} value={metrics.votesCast7d} label="Votes cast (7d)" />
        </div>
      )}
    </div>
  );
}
