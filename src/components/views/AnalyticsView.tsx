import { useEffect, useState } from 'react';
import { Activity, AlertOctagon, ArrowDownRight, ArrowUpRight, CheckCircle2, Clock3, Gauge, PieChart, Target, TrendingUp, Users } from 'lucide-react';
import { computeAnalytics, computeIntelligenceInsights, type IntelligenceInsights } from '@/lib/pulseApi';
import type { AnalyticsSnapshot } from '@/types';

function StatCard({ icon: Icon, value, label, hint }: { icon: typeof Clock3; value: string; label: string; hint?: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between gap-3">
        <Icon className="h-4 w-4 text-pulse-300" />
        {hint && <span className="text-[9px] uppercase tracking-wider text-ink-500">{hint}</span>}
      </div>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
      <p className="text-[11px] text-ink-500">{label}</p>
    </div>
  );
}

function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[11px]">
        <span className="text-ink-400">{label}</span><span className="font-semibold text-ink-200">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink-900">
        <div className="h-full rounded-full bg-gradient-to-r from-[#7c3aed] to-[#06b6d4] transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

export function AnalyticsView({ workspaceId, onOpenDecision }: { workspaceId: string; onOpenDecision?: (id: string) => void }) {
  const [data, setData] = useState<AnalyticsSnapshot | null>(null);
  const [intel, setIntel] = useState<IntelligenceInsights | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    setError('');
    try {
      const [a, i] = await Promise.all([computeAnalytics(workspaceId), computeIntelligenceInsights(workspaceId)]);
      setData(a);
      setIntel(i);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not compute analytics');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { void refresh(); }, [workspaceId]);

  if (error) return <div className="mx-auto max-w-3xl px-4 pt-5 text-sm text-ember-400">{error}</div>;
  if (!data) return <div className="mx-auto max-w-3xl px-4 pt-5 text-xs text-ink-500">Building your intelligence picture…</div>;

  const maxActivity = Math.max(1, ...data.discussionActivity.map((d) => d.count));
  const trend = data.decisionsPrevious7d === 0 ? null : Math.round(((data.decisionsLast7d - data.decisionsPrevious7d) / data.decisionsPrevious7d) * 100);

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pb-28 pt-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-[.2em] text-pulse-300"><PieChart className="h-3.5 w-3.5" /> Decision intelligence</p>
          <h1 className="mt-1 font-display text-2xl font-semibold">Analytics</h1>
          <p className="mt-1 text-xs text-ink-500">See how quickly your team decides, aligns and executes.</p>
        </div>
        <button onClick={() => void refresh()} disabled={refreshing} className="rounded-xl border border-white/10 px-3 py-2 text-[11px] text-ink-300 hover:bg-white/5 disabled:opacity-50">{refreshing ? 'Refreshing…' : 'Refresh'}</button>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard icon={Gauge} value={`${data.alignmentPct}%`} label="Decision alignment" hint="Signal" />
        <StatCard icon={Clock3} value={data.avgDecisionDays !== null ? `${data.avgDecisionDays.toFixed(1)}d` : '—'} label="Avg. decision time" />
        <StatCard icon={AlertOctagon} value={String(data.stuckDecisions)} label="Stuck decisions" />
        <StatCard icon={CheckCircle2} value={`${data.actionCompletionRate}%`} label="Action completion" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div><h3 className="text-sm font-semibold">Decision flow</h3><p className="text-[10px] text-ink-500">Current workspace throughput</p></div>
            <Target className="h-4 w-4 text-pulse-300" />
          </div>
          <div className="mt-4 space-y-4">
            <Progress value={data.decisionOutcomeRate} label="Decisions with an outcome" />
            <Progress value={data.participationPct} label="Members participating · last 7 days" />
            <Progress value={data.actionCompletionRate} label="Actions completed" />
          </div>
        </div>

        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div><h3 className="text-sm font-semibold">Momentum</h3><p className="text-[10px] text-ink-500">Last 7 days vs previous 7 days</p></div>
            {trend === null ? <Activity className="h-4 w-4 text-pulse-300" /> : trend >= 0 ? <ArrowUpRight className="h-4 w-4 text-emerald-300" /> : <ArrowDownRight className="h-4 w-4 text-amber-300" />}
          </div>
          <div className="mt-4 flex items-end gap-3">
            <div><p className="font-display text-3xl font-bold">{data.decisionsLast7d}</p><p className="text-[10px] text-ink-500">decisions this week</p></div>
            <div className="pb-1 text-xs text-ink-500">vs {data.decisionsPrevious7d} prior week</div>
            {trend !== null && <span className="ml-auto rounded-lg bg-white/5 px-2 py-1 text-[10px] font-semibold">{trend >= 0 ? '+' : ''}{trend}%</span>}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white/[.03] p-2"><p className="font-display text-lg font-bold">{data.activeDecisions}</p><p className="text-[9px] text-ink-500">active</p></div>
            <div className="rounded-xl bg-white/[.03] p-2"><p className="font-display text-lg font-bold">{data.completedDecisions}</p><p className="text-[9px] text-ink-500">completed</p></div>
            <div className="rounded-xl bg-white/[.03] p-2"><p className="font-display text-lg font-bold">{data.overdueActions}</p><p className="text-[9px] text-ink-500">overdue</p></div>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold">Discussion activity</h3><p className="text-[10px] text-ink-500">14-day message rhythm</p></div><TrendingUp className="h-4 w-4 text-pulse-300" /></div>
        {data.discussionActivity.length === 0 ? <p className="mt-3 text-xs text-ink-500">No messages yet to chart.</p> : (
          <div className="mt-4 flex items-end gap-1.5" style={{ height: 112 }}>
            {data.discussionActivity.map((d, i) => <div key={`${d.label}-${i}`} className="flex flex-1 flex-col items-center gap-1"><div className="w-full rounded-t-md bg-gradient-to-t from-[#7c3aed] to-[#06b6d4]" style={{ height: `${Math.max(4, (d.count / maxActivity) * 92)}px` }} /><span className="text-[8px] text-ink-500">{d.label}</span></div>)}
          </div>
        )}
      </div>

      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2"><AlertOctagon className="h-4 w-4 text-amber-300" /><div><h3 className="text-sm font-semibold">Top bottlenecks</h3><p className="text-[10px] text-ink-500">Where execution is losing momentum</p></div></div>
        {data.topBottlenecks.length === 0 ? <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-400/10 bg-emerald-400/5 p-3 text-xs text-emerald-200"><CheckCircle2 className="h-4 w-4" /> No major bottleneck detected from current workspace data.</div> : <div className="mt-3 space-y-2">{data.topBottlenecks.map((b) => <div key={b.label} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[.025] p-3"><div><p className="text-xs font-semibold">{b.label}</p><p className="mt-0.5 text-[10px] text-ink-500">{b.detail}</p></div><span className="rounded-lg bg-amber-400/10 px-2 py-1 text-xs font-semibold text-amber-200">{b.count}</span></div>)}</div>}
      </div>

      {intel && (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <StatCard icon={Gauge} value={intel.avgQualityScore != null ? `${intel.avgQualityScore}` : '—'} label="Avg quality score" hint="0–100" />
            <StatCard icon={Target} value={intel.similarWinRate != null ? `${intel.similarWinRate}%` : '—'} label="Healthy outcome rate" />
            <StatCard icon={AlertOctagon} value={String(intel.predictiveRisks.length)} label="Predictive risks" />
            <StatCard icon={CheckCircle2} value={String(intel.postMortemReady)} label="Ready for post-mortem" />
          </div>

          <div className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Quality over time</h3>
                <p className="text-[10px] text-ink-500">Average AI quality score by month</p>
              </div>
              <TrendingUp className="h-4 w-4 text-pulse-300" />
            </div>
            {intel.qualityTrend.every((p) => p.decisions === 0) ? (
              <p className="mt-3 text-xs text-ink-500">Run Decision Intelligence on a few decisions to populate this trend.</p>
            ) : (
              <div className="mt-4 flex items-end gap-1.5" style={{ height: 112 }}>
                {intel.qualityTrend.map((p) => (
                  <div key={p.month} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-[#7c3aed] to-[#06b6d4]"
                      style={{ height: `${Math.max(4, (p.avgQuality / 100) * 92)}px` }}
                      title={`${p.month}: ${p.avgQuality}/100 · ${p.decisions} decisions`}
                    />
                    <span className="text-[8px] text-ink-500">{p.month.slice(5)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass rounded-2xl p-4">
            <h3 className="text-sm font-semibold">Patterns & bias signals</h3>
            <p className="text-[10px] text-ink-500">How your team tends to decide — speed, alignment, participation, reversals</p>
            {intel.patterns.length === 0 ? (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-400/10 bg-emerald-400/5 p-3 text-xs text-emerald-200">
                <CheckCircle2 className="h-4 w-4" /> No concerning patterns detected yet.
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {intel.patterns.map((pat) => (
                  <div key={pat.id} className="rounded-xl border border-white/5 bg-white/[.025] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold">{pat.title}</p>
                      <span className={`text-[10px] uppercase ${pat.severity === 'alert' ? 'text-ember-300' : pat.severity === 'watch' ? 'text-alert-300' : 'text-ink-500'}`}>
                        {pat.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-ink-400">{pat.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass rounded-2xl p-4">
            <h3 className="text-sm font-semibold">Predictive risk</h3>
            <p className="text-[10px] text-ink-500">Open decisions that resemble past weak outcomes or stalls</p>
            {intel.predictiveRisks.length === 0 ? (
              <p className="mt-3 text-xs text-ink-500">No elevated risks from current open decisions.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {intel.predictiveRisks.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => r.relatedDecisionId && onOpenDecision?.(r.relatedDecisionId)}
                    className="w-full rounded-xl border border-white/5 bg-white/[.025] p-3 text-left hover:border-pulse-500/30"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold">{r.title}</p>
                      <span className={`text-[10px] uppercase ${r.probabilityLabel === 'elevated' ? 'text-ember-300' : 'text-alert-300'}`}>
                        {r.probabilityLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-ink-400">{r.reason}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {intel.postMortemReady > 0 && (
            <div className="glass rounded-2xl p-4">
              <h3 className="text-sm font-semibold">Automated post-mortems</h3>
              <p className="mt-1 text-[11px] text-ink-400">
                {intel.postMortemReady} decision(s) are past 30 days since outcome — open a Decision Room and run intelligence,.
              </p>
            </div>
          )}
        </>
      )}

      <div className="glass rounded-2xl p-4 text-center">
        <Users className="mx-auto h-5 w-5 text-pulse-300" />
        <p className="mt-2 text-sm font-semibold">PULSE measures the work behind the numbers</p>
        <p className="mt-1 text-[11px] text-ink-500">These signals come from your workspace decisions, votes, discussions and actions — not sample data.</p>
      </div>
    </div>
  );
}
