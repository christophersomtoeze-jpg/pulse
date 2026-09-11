import { useState } from 'react';
import { CheckCircle2, X, RotateCcw } from 'lucide-react';
import { submitOutcomeReview } from '@/lib/pulseApi';
import type { DecisionOutcomeReview } from '@/types';

export function OutcomeReviewModal({ review, onClose, onSubmitted }: { review: DecisionOutcomeReview; onClose: () => void; onSubmitted: () => void }) {
  const [successful, setSuccessful] = useState<boolean | null>(review.wasSuccessful);
  const [score, setScore] = useState(review.score ?? 3);
  const [whatHappened, setWhatHappened] = useState(review.whatHappened ?? '');
  const [lessons, setLessons] = useState(review.lessons ?? '');
  const [reverse, setReverse] = useState(review.shouldReverse);
  const [reverseReason, setReverseReason] = useState(review.reverseReason ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (successful === null) { setError('Tell PULSE whether the decision produced the expected result.'); return; }
    setBusy(true); setError('');
    try {
      await submitOutcomeReview(review.id, {
        wasSuccessful: successful, score, whatHappened, lessons,
        shouldReverse: reverse, reverseReason,
      });
      onSubmitted(); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save review'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[85] grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="glass-strong max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <div><p className="text-[10px] uppercase tracking-[.2em] text-pulse-300">Outcome loop · {review.reviewType}</p><h2 className="mt-1 text-lg font-semibold">Was this decision right?</h2></div>
          <button className="icon-btn" onClick={onClose}><X /></button>
        </div>
        <div className="mt-5">
          <p className="text-xs text-ink-400">Scheduled for {new Date(review.scheduledFor).toLocaleDateString()}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => setSuccessful(true)} className={`rounded-xl border p-3 text-left text-xs ${successful === true ? 'border-flux-500/50 bg-flux-500/10' : 'border-white/5'}`}><CheckCircle2 className="mb-1 h-4 w-4 text-flux-300" /> Yes — it worked</button>
            <button onClick={() => setSuccessful(false)} className={`rounded-xl border p-3 text-left text-xs ${successful === false ? 'border-ember-500/50 bg-ember-500/10' : 'border-white/5'}`}><X className="mb-1 h-4 w-4 text-ember-300" /> No — it missed the goal</button>
          </div>
        </div>
        <div className="mt-4">
          <label className="text-xs text-ink-400">Outcome score: <strong>{score}/5</strong></label>
          <input type="range" min="1" max="5" value={score} onChange={(e) => setScore(Number(e.target.value))} className="mt-2 w-full" />
        </div>
        <textarea value={whatHappened} onChange={(e) => setWhatHappened(e.target.value)} placeholder="What actually happened?" className="field mt-4 min-h-20 resize-none text-xs" />
        <textarea value={lessons} onChange={(e) => setLessons(e.target.value)} placeholder="What should the team remember next time?" className="field mt-3 min-h-20 resize-none text-xs" />
        <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-xl border border-white/5 p-3 text-xs">
          <input type="checkbox" checked={reverse} onChange={(e) => setReverse(e.target.checked)} className="mt-0.5" />
          <span><span className="flex items-center gap-1 font-semibold"><RotateCcw className="h-3.5 w-3.5" /> Reverse this decision</span><span className="mt-0.5 block text-ink-500">Mark the decision as reversed and preserve the reason in its permanent history.</span></span>
        </label>
        {reverse && <textarea value={reverseReason} onChange={(e) => setReverseReason(e.target.value)} placeholder="Why should it be reversed?" className="field mt-2 min-h-16 resize-none text-xs" />}
        {error && <p className="mt-3 text-xs text-ember-300">{error}</p>}
        <button disabled={busy} onClick={() => void submit()} className="primary-btn mt-4 w-full justify-center disabled:opacity-40">{busy ? 'Saving…' : 'Save outcome review'}</button>
      </div>
    </div>
  );
}
