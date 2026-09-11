import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Search, Sparkles, Users, Zap } from 'lucide-react';
import { analyzeDecisionProposal, searchDecisions } from '@/lib/pulseApi';
import type { DecisionGateAnswers, DecisionReversibility, DecisionUrgency, DecisionSummary } from '@/types';

export function PreDecisionGate({
  open, workspaceId, onClose, onProceed,
}: {
  open: boolean; workspaceId: string; onClose: () => void;
  onProceed: (input: { title: string; description: string; gateAnswers: DecisionGateAnswers; suggestedOwners: string[]; similarDecisionIds: string[] }) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [alreadyDecided, setAlreadyDecided] = useState<boolean | null>(null);
  const [reversibility, setReversibility] = useState<DecisionReversibility>('reversible');
  const [urgency, setUrgency] = useState<DecisionUrgency>('medium');
  const [costDelay, setCostDelay] = useState('');
  const [owners, setOwners] = useState('');
  const [similar, setSimilar] = useState<DecisionSummary[]>([]);
  const [analysis, setAnalysis] = useState<Awaited<ReturnType<typeof analyzeDecisionProposal>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle(''); setDescription(''); setAlreadyDecided(null); setReversibility('reversible');
    setUrgency('medium'); setCostDelay(''); setOwners(''); setSimilar([]); setAnalysis(null); setError('');
  }, [open]);

  const runAnalysis = async () => {
    if (!title.trim()) { setError('Start with the decision you are considering.'); return; }
    setBusy(true); setError('');
    try {
      const [found, ai] = await Promise.all([
        searchDecisions(workspaceId, title.trim()),
        analyzeDecisionProposal(workspaceId, title.trim(), description.trim()),
      ]);
      setSimilar(found.filter((d) => d.status !== 'in-review').slice(0, 5));
      setAnalysis(ai);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not analyze the proposal'); }
    finally { setBusy(false); }
  };

  if (!open) return null;

  const proceed = () => {
    if (!analysis || alreadyDecided === null) { setError('Answer the gate questions and run the analysis first.'); return; }
    const gateAnswers: DecisionGateAnswers = {
      alreadyDecided, reversibility, urgency, estimatedCostOfDelay: costDelay.trim(),
      suggestedOwners: owners.split(',').map((x) => x.trim()).filter(Boolean),
      similarDecisionIds: similar.map((d) => d.id),
      aiRecommendation: analysis.recommendation,
      recommendedProcess: analysis.recommendedProcess,
    };
    onProceed({ title: title.trim(), description: description.trim(), gateAnswers, suggestedOwners: gateAnswers.suggestedOwners, similarDecisionIds: gateAnswers.similarDecisionIds });
  };

  return (
    <div className="fixed inset-0 z-[78] grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="glass-strong max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-pulse-500/20 bg-pulse-500/10 text-pulse-300"><Sparkles className="h-5 w-5" /></div>
          <div><p className="text-[10px] uppercase tracking-[.2em] text-pulse-300">Pre-decision gate</p><h2 className="mt-1 font-display text-xl font-semibold">Should this become a PULSE decision?</h2><p className="mt-1 text-xs text-ink-500">A short checkpoint prevents duplicate decisions and matches the process to the stakes.</p></div>
        </div>

        <div className="mt-5 space-y-4">
          <div><label className="text-xs text-ink-400">What are you deciding?</label><input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="field mt-1.5" placeholder="e.g. Which onboarding flow should we ship?" /></div>
          <div><label className="text-xs text-ink-400">Context</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} className="field mt-1.5 min-h-20 resize-none" placeholder="What changed, what is at stake, and what outcome do you want?" /></div>

          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold"><Search className="h-3.5 w-3.5 text-pulse-300" /> Has this already been decided?</p>
            <div className="mt-2 flex gap-2"><button onClick={() => setAlreadyDecided(true)} className={`secondary-btn ${alreadyDecided === true ? 'border-pulse-500/40 bg-pulse-500/10' : ''}`}>Yes</button><button onClick={() => setAlreadyDecided(false)} className={`secondary-btn ${alreadyDecided === false ? 'border-flux-500/40 bg-flux-500/10' : ''}`}>No</button></div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="text-xs text-ink-400">Reversibility</label><select value={reversibility} onChange={(e) => setReversibility(e.target.value as DecisionReversibility)} className="field mt-1.5"><option value="reversible">Easy to reverse</option><option value="hard_to_reverse">Hard to reverse</option><option value="irreversible">Irreversible</option></select></div>
            <div><label className="flex items-center gap-1.5 text-xs text-ink-400"><Clock3 className="h-3.5 w-3.5" /> Urgency</label><select value={urgency} onChange={(e) => setUrgency(e.target.value as DecisionUrgency)} className="field mt-1.5"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
          </div>
          <div><label className="text-xs text-ink-400">Estimated cost of delay</label><input value={costDelay} onChange={(e) => setCostDelay(e.target.value)} className="field mt-1.5" placeholder="e.g. $5k/week, missed launch, team blocked…" /></div>
          <div><label className="flex items-center gap-1.5 text-xs text-ink-400"><Users className="h-3.5 w-3.5" /> People who should be involved</label><input value={owners} onChange={(e) => setOwners(e.target.value)} className="field mt-1.5" placeholder="Names, separated by commas" /></div>

          <button onClick={() => void runAnalysis()} disabled={busy || !title.trim()} className="primary-btn w-full justify-center disabled:opacity-40"><Zap className="h-3.5 w-3.5" /> {busy ? 'Analyzing…' : 'Analyze proposal'}</button>

          {analysis && (
            <div className="rounded-2xl border border-pulse-500/20 bg-pulse-500/5 p-4">
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-flux-300" /><span className="text-xs font-semibold">Recommended process: {analysis.recommendedProcess}</span></div>
              <p className="mt-2 text-xs leading-5 text-ink-300">{analysis.recommendation}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2"><div className="rounded-xl bg-white/[.03] p-2 text-[10px] text-ink-400">Reversibility: <strong>{analysis.reversibility}</strong></div><div className="rounded-xl bg-white/[.03] p-2 text-[10px] text-ink-400">Urgency: <strong>{analysis.urgency}</strong></div></div>
            </div>
          )}

          {alreadyDecided === true && <div className="flex gap-2 rounded-xl border border-alert-500/20 bg-alert-500/5 p-3 text-xs text-alert-200"><AlertTriangle className="h-4 w-4 shrink-0" /> This looks like a repeat decision. Review the similar decisions below before creating another permanent node.</div>}

          {similar.length > 0 && (
            <div><p className="text-xs font-semibold">Similar past decisions</p><div className="mt-2 space-y-1.5">{similar.map((d) => <div key={d.id} className="rounded-xl border border-white/5 bg-white/[.02] px-3 py-2"><p className="text-xs font-medium">{d.title}</p><p className="mt-0.5 text-[10px] text-ink-500">{d.outcome ? `Outcome: ${d.outcome}` : d.status}</p></div>)}</div></div>
          )}
        </div>

        {error && <p className="mt-3 text-xs text-ember-300">{error}</p>}
        <div className="mt-5 flex gap-2 border-t border-white/5 pt-4">
          <button onClick={onClose} className="secondary-btn flex-1 justify-center">Cancel</button>
          <button onClick={proceed} disabled={!analysis || alreadyDecided === null} className="primary-btn flex-1 justify-center disabled:opacity-40"><ArrowRight className="h-3.5 w-3.5" /> Continue</button>
        </div>
      </div>
    </div>
  );
}
