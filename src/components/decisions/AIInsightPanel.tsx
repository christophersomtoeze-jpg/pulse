import { useState } from 'react';
import { AlertTriangle, Gauge, MessageSquareQuote, Sparkles, Swords } from 'lucide-react';
import type { DecisionAIAnalysis } from '@/types';

interface AIInsightPanelProps {
  analysis: DecisionAIAnalysis | null;
  configured: boolean;
  onAnalyze: () => Promise<void>;
}

function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? 'bg-flux-400' : pct >= 40 ? 'bg-alert-400' : 'bg-ember-400';
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] text-ink-400">
        <span className="flex items-center gap-1"><Gauge className="h-3 w-3" /> Confidence</span>
        <span>{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-white/5"><div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export function AIInsightPanel({ analysis, configured, onAnalyze }: AIInsightPanelProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setBusy(true); setError('');
    try { await onAnalyze(); }
    catch (e) { setError(e instanceof Error ? e.message : 'AI analysis failed'); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl border border-[#7c3aed]/20 bg-[#7c3aed]/5 p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-pulse-300" /> AI Decision Intelligence</h3>
        <button onClick={run} disabled={busy || !configured} className="rounded-lg border border-[#7c3aed]/30 bg-[#7c3aed]/15 px-2.5 py-1 text-[10px] font-semibold text-pulse-200 disabled:opacity-40">
          {busy ? 'Analyzing…' : analysis ? 'Re-analyze' : 'Analyze with AI'}
        </button>
      </div>

      {!configured && <p className="mt-2 text-[11px] text-ink-500">Connect Supabase and deploy the ai-decision-summary function to enable this.</p>}
      {error && <p className="mt-2 text-xs text-ember-400">{error}</p>}

      {analysis ? (
        <div className="mt-3 space-y-3 text-xs">
          <div>
            <p className="font-semibold text-ink-200">Summary</p>
            <p className="mt-0.5 text-ink-300">{analysis.summary}</p>
          </div>
          {analysis.disagreements && (
            <div>
              <p className="flex items-center gap-1 font-semibold text-ink-200"><AlertTriangle className="h-3 w-3 text-alert-400" /> Disagreements</p>
              <p className="mt-0.5 text-ink-300">{analysis.disagreements}</p>
            </div>
          )}
          {analysis.strongestArguments && (
            <div>
              <p className="flex items-center gap-1 font-semibold text-ink-200"><Swords className="h-3 w-3 text-pulse-300" /> Strongest arguments</p>
              <p className="mt-0.5 text-ink-300">{analysis.strongestArguments}</p>
            </div>
          )}
          {analysis.recommendation && (
            <div>
              <p className="flex items-center gap-1 font-semibold text-ink-200"><MessageSquareQuote className="h-3 w-3 text-flux-400" /> Recommendation</p>
              <p className="mt-0.5 text-ink-300">{analysis.recommendation}</p>
            </div>
          )}
          {analysis.confidence !== null && <ConfidenceMeter value={analysis.confidence} />}
        </div>
      ) : (
        <p className="mt-3 text-xs text-ink-500">Run AI analysis to summarize the discussion, surface disagreements, and get a recommendation.</p>
      )}
    </div>
  );
}
