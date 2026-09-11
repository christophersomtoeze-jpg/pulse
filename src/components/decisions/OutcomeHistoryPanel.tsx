import { useState } from 'react';
import { CheckCircle2, Clock3, RotateCcw } from 'lucide-react';
import type { DecisionOutcomeReview } from '@/types';
import { OutcomeReviewModal } from './OutcomeReviewModal';

export function OutcomeHistoryPanel({ reviews, canReview, onReviewSubmitted }: {
  decisionId: string; reviews: DecisionOutcomeReview[]; canReview: boolean; onReviewSubmitted: () => void;
}) {
  const [selected, setSelected] = useState<DecisionOutcomeReview | null>(null);
  const pending = reviews.filter((r) => r.status === 'pending' || r.status === 'overdue');
  const completed = reviews.filter((r) => r.status === 'completed');

  return (
    <section className="glass rounded-2xl p-4">
      <div className="flex items-start justify-between">
        <div><h3 className="text-sm font-semibold">Outcome tracking</h3><p className="mt-0.5 text-[11px] text-ink-500">PULSE checks whether past decisions actually worked.</p></div>
        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] text-ink-400">{completed.length}/{reviews.length} reviewed</span>
      </div>
      <div className="mt-3 space-y-2">
        {pending.map((review) => (
          <div key={review.id} className="flex items-center gap-2 rounded-xl border border-alert-500/20 bg-alert-500/5 p-3">
            <Clock3 className="h-4 w-4 shrink-0 text-alert-300" />
            <div className="min-w-0 flex-1"><p className="text-xs font-semibold">{review.reviewType} review {review.status === 'overdue' ? 'overdue' : 'due'}</p><p className="text-[10px] text-ink-500">{new Date(review.scheduledFor).toLocaleDateString()}</p></div>
            {canReview && <button onClick={() => setSelected(review)} className="primary-btn text-[10px]">Review</button>}
          </div>
        ))}
        {completed.map((review) => (
          <div key={review.id} className="flex items-start gap-2 rounded-xl border border-white/5 bg-white/[.02] p-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-flux-300" />
            <div className="min-w-0 flex-1"><p className="text-xs font-semibold">{review.reviewType} · {review.wasSuccessful ? 'Successful' : 'Not successful'} · {review.score}/5</p><p className="mt-0.5 text-[10px] text-ink-500">{review.lessons || review.whatHappened || 'No lesson recorded.'}</p></div>
            {review.shouldReverse && <RotateCcw className="h-3.5 w-3.5 text-alert-300" />}
          </div>
        ))}
        {reviews.length === 0 && <p className="py-3 text-center text-xs text-ink-500">Outcome reviews will appear after this decision is closed.</p>}
      </div>
      {selected && <OutcomeReviewModal review={selected} onClose={() => setSelected(null)} onSubmitted={onReviewSubmitted} />}
    </section>
  );
}
