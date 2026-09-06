import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { hasCastAnyVote } from '@/lib/pulseApi';
import type { DecisionSummary } from '@/types';

interface OnboardingChecklistProps {
  workspaceId: string;
  decisions: DecisionSummary[];
  memberCount: number;
  pendingInviteCount: number;
  onNewDecision: () => void;
  onInvite: () => void;
}

const DISMISS_KEY_PREFIX = 'pulse:onboarding-dismissed:';

export function OnboardingChecklist({ workspaceId, decisions, memberCount, pendingInviteCount, onNewDecision, onInvite }: OnboardingChecklistProps) {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY_PREFIX + workspaceId) === '1');
  const [voted, setVoted] = useState(false);

  useEffect(() => { if (user) hasCastAnyVote(user.id).then(setVoted); }, [user, decisions]);

  const hasCreatedDecision = decisions.some((d) => d.createdBy === user?.id);
  const hasInvited = memberCount > 1 || pendingInviteCount > 0;
  const steps = [
    { done: hasCreatedDecision, label: 'Create your first decision', action: onNewDecision },
    { done: hasInvited, label: 'Invite a teammate', action: onInvite },
    { done: voted, label: 'Cast a vote on a decision', action: undefined },
  ];
  const remaining = steps.filter((s) => !s.done).length;

  if (dismissed || remaining === 0) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY_PREFIX + workspaceId, '1');
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-4 mt-3 rounded-2xl border border-[#7c3aed]/25 bg-[#7c3aed]/5 p-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-3.5 w-3.5 text-pulse-300" /> Get set up ({remaining} left)</p>
          <button onClick={dismiss} className="icon-btn h-6 w-6"><X className="h-3 w-3" /></button>
        </div>
        <div className="mt-2 space-y-1.5">
          {steps.map((s) => (
            <button
              key={s.label}
              onClick={s.action}
              disabled={s.done || !s.action}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs ${s.done ? 'text-flux-300' : 'text-ink-300 hover:bg-white/5'}`}
            >
              <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${s.done ? 'border-flux-500/40 bg-flux-500/20' : 'border-white/20'}`}>
                {s.done && <Check className="h-2.5 w-2.5" />}
              </span>
              <span className={s.done ? 'line-through' : ''}>{s.label}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
