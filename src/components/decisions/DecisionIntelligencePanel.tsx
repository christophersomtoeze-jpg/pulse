import { useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, BrainCircuit, CheckCircle2, Link2, ShieldAlert, Sparkles, Target, Zap } from 'lucide-react';
import type { DecisionIntelligence, DecisionLink, DecisionRelationshipType } from '@/types';
import { createDecisionLink, requestDecisionIntelligence } from '@/lib/pulseApi';

const riskClass: Record<DecisionIntelligence['riskLevel'], string> = {
  low: 'border-flux-500/30 bg-flux-500/10 text-flux-300',
  medium: 'border-alert-500/30 bg-alert-500/10 text-alert-300',
  high: 'border-ember-500/30 bg-ember-500/10 text-ember-300',
};
const relationshipLabels: Record<DecisionRelationshipType, string> = {
  depends_on: 'Depends on', supersedes: 'Supersedes', related: 'Related', blocks: 'Blocks', unlocked: 'Unlocks',
};

export function DecisionIntelligencePanel({ decisionId, workspaceId, enabled = true, initial, onUpdated, onLinksChange }: {
  decisionId: string;
  workspaceId: string;
  enabled?: boolean;
  initial: DecisionIntelligence | null;
  onUpdated?: (value: DecisionIntelligence) => void;
  onLinksChange?: () => Promise<void> | void;
}) {
  const [analysis, setAnalysis] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [linking, setLinking] = useState<string | null>(null);

  const analyze = async () => {
    setBusy(true); setError('');
    try { const value = await requestDecisionIntelligence(decisionId); setAnalysis(value); onUpdated?.(value); }
    catch (e) { setError(e instanceof Error ? e.message : 'Decision intelligence failed'); }
    finally { setBusy(false); }
  };
  const linkSuggestion = async (suggestion: DecisionIntelligence['graphSuggestions'][number]) => {
    setLinking(suggestion.decisionId); setError('');
    try {
      await createDecisionLink({ workspaceId, fromDecisionId: decisionId, toDecisionId: suggestion.decisionId, relationshipType: suggestion.relationshipType, note: `AI suggested: ${suggestion.reason}` });
      await onLinksChange?.();
      if (analysis) setAnalysis({ ...analysis, graphSuggestions: analysis.graphSuggestions.filter((s) => s.decisionId !== suggestion.decisionId) });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create decision link'); }
    finally { setLinking(null); }
  };

  return <section className="rounded-2xl border border-[#7c3aed]/25 bg-[#7c3aed]/[.06] p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="flex items-center gap-1.5 text-sm font-semibold"><BrainCircuit className="h-4 w-4 text-pulse-300" /> Decision Intelligence</h3>
        <p className="mt-1 text-[11px] text-ink-500">PULSE evaluates evidence, participation, execution readiness, risk and historical context.</p>
      </div>
      <button onClick={analyze} disabled={!enabled || busy} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#7c3aed]/30 bg-[#7c3aed]/15 px-2.5 py-1.5 text-[10px] font-semibold text-pulse-200 disabled:opacity-40">
        <Sparkles className="h-3 w-3" /> {busy ? 'Thinking…' : analysis ? 'Refresh' : 'Analyze'}
      </button>
    </div>
    {!enabled && <p className="mt-3 text-xs text-alert-300">AI features are disabled for this workspace.</p>}
    {error && <p className="mt-3 text-xs text-ember-400">{error}</p>}
    {analysis && <div className="mt-4 space-y-4 text-xs">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/5 bg-white/[.02] p-3"><div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-ink-500"><Target className="h-3 w-3" /> Quality</div><div className="mt-1 text-xl font-semibold">{analysis.qualityScore}<span className="text-xs text-ink-500">/100</span></div></div>
        <div className={`rounded-xl border p-3 ${riskClass[analysis.riskLevel]}`}><div className="flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-80"><ShieldAlert className="h-3 w-3" /> Risk</div><div className="mt-1 text-xl font-semibold capitalize">{analysis.riskLevel}</div></div>
      </div>
      <div><p className="font-semibold text-ink-200">Executive read</p><p className="mt-1 leading-relaxed text-ink-300">{analysis.executiveSummary}</p></div>
      {analysis.recommendation && <div className="rounded-xl border border-flux-500/20 bg-flux-500/5 p-3"><p className="flex items-center gap-1 font-semibold text-flux-300"><Zap className="h-3 w-3" /> Recommendation</p><p className="mt-1 text-ink-300">{analysis.recommendation}</p></div>}
      {analysis.riskReasons.length > 0 && <InsightList title="Why PULSE sees risk" icon={<AlertTriangle className="h-3 w-3 text-alert-400" />} items={analysis.riskReasons} />}
      {analysis.evidenceGaps.length > 0 && <InsightList title="Evidence gaps" icon={<AlertTriangle className="h-3 w-3 text-pulse-300" />} items={analysis.evidenceGaps} />}
      {analysis.disagreements.length > 0 && <InsightList title="Disagreements" icon={<ShieldAlert className="h-3 w-3 text-ember-300" />} items={analysis.disagreements} />}
      {analysis.strongestArguments.length > 0 && <InsightList title="Strongest arguments" icon={<CheckCircle2 className="h-3 w-3 text-flux-400" />} items={analysis.strongestArguments} />}
      {analysis.nextActions.length > 0 && <InsightList title="Suggested next actions" icon={<Zap className="h-3 w-3 text-pulse-300" />} items={analysis.nextActions} />}
      {analysis.similarDecisions.length > 0 && <div><p className="font-semibold text-ink-200">Similar decisions</p><div className="mt-2 space-y-1.5">{analysis.similarDecisions.map((s) => <div key={s.decisionId} className="rounded-xl border border-white/5 bg-white/[.02] p-2.5"><div className="flex items-center gap-2"><span className="font-medium text-ink-200">{s.title}</span>{s.outcomeScore != null && <span className="ml-auto text-[10px] text-ink-500">Outcome {s.outcomeScore}/5</span>}</div><p className="mt-1 text-[11px] text-ink-500">{s.reason}</p></div>)}</div></div>}
      {analysis.graphSuggestions.length > 0 && <div><p className="flex items-center gap-1 font-semibold text-ink-200"><Link2 className="h-3 w-3 text-pulse-300" /> Suggested graph connections</p><div className="mt-2 space-y-1.5">{analysis.graphSuggestions.map((s) => <div key={s.decisionId} className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[.02] p-2.5"><div className="min-w-0 flex-1"><p className="truncate font-medium text-ink-200">{s.title}</p><p className="text-[10px] text-ink-500">{relationshipLabels[s.relationshipType]} · {s.reason}</p></div><button onClick={() => linkSuggestion(s)} disabled={linking === s.decisionId} className="shrink-0 rounded-lg border border-pulse-500/30 px-2 py-1 text-[10px] text-pulse-200 disabled:opacity-50">{linking === s.decisionId ? 'Linking…' : 'Link'}</button></div>)}</div></div>}
      <p className="text-[10px] text-ink-600">AI confidence: {Math.round(analysis.confidence * 100)}% · Generated {new Date(analysis.createdAt).toLocaleString()}</p>
    </div>}
    {!analysis && enabled && <p className="mt-4 text-xs text-ink-500">Analyze this decision to surface evidence gaps, risk, historical context and recommended next actions.</p>}
  </section>;
}
function InsightList({ title, icon, items }: { title: string; icon: ReactNode; items: string[] }) { return <div><p className="flex items-center gap-1 font-semibold text-ink-200">{icon}{title}</p><ul className="mt-1 space-y-1 text-ink-300">{items.map((item, i) => <li key={`${item}-${i}`} className="flex gap-2"><span className="text-ink-600">•</span><span>{item}</span></li>)}</ul></div>; }
