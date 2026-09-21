import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Rocket, Sparkles, Users, Vote, X } from 'lucide-react';
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

/**
 * Designed so a new team can create their first decision in under 3 minutes:
 * 1) Create decision (primary CTA)
 * 2) Invite one teammate
 * 3) Cast a vote
 */
export function OnboardingChecklist({
  workspaceId,
  decisions,
  memberCount,
  pendingInviteCount,
  onNewDecision,
  onInvite,
}: OnboardingChecklistProps) {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY_PREFIX + workspaceId) === '1');
  const [voted, setVoted] = useState(false);

  useEffect(() => {
    if (user) hasCastAnyVote(user.id).then(setVoted);
  }, [user, decisions]);

  const hasCreatedDecision = decisions.some((d) => d.createdBy === user?.id) || decisions.length > 0;
  const hasInvited = memberCount > 1 || pendingInviteCount > 0;

  const steps = [
    {
      done: hasCreatedDecision,
      label: 'Create your first decision',
      hint: '~1 min — title + short description is enough',
      icon: Rocket,
      action: onNewDecision,
      primary: true,
    },
    {
      done: hasInvited,
      label: 'Invite a teammate',
      hint: 'Decisions get better with a second voice',
      icon: Users,
      action: onInvite,
      primary: false,
    },
    {
      done: voted,
      label: 'Cast a vote',
      hint: 'Yes / No / Needs info on any open decision',
      icon: Vote,
      action: undefined,
      primary: false,
    },
  ];

  const remaining = steps.filter((s) => !s.done).length;
  if (dismissed || remaining === 0) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY_PREFIX + workspaceId, '1');
    setDismissed(true);
  };

  const next = steps.find((s) => !s.done);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="mx-4 mt-3 overflow-hidden rounded-2xl border border-[#7c3aed]/30 bg-gradient-to-br from-[#7c3aed]/15 to-[#06b6d4]/5 p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles className="h-3.5 w-3.5 text-pulse-300" /> Launch in under 3 minutes
            </p>
            <p className="mt-1 text-[11px] text-ink-400">
              {remaining} step{remaining === 1 ? '' : 's'} left · Start with one real decision your team must make this week.
            </p>
          </div>
          <button type="button" onClick={dismiss} className="icon-btn h-7 w-7 shrink-0" aria-label="Dismiss">
            <X className="h-3 w-3" />
          </button>
        </div>

        {next?.action && (
          <button type="button" onClick={next.action} className="primary-btn mt-3 w-full justify-center text-sm">
            <next.icon className="h-4 w-4" />
            {next.label}
          </button>
        )}

        <div className="mt-3 space-y-1.5">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.label}
                type="button"
                disabled={!s.action || s.done}
                onClick={() => s.action?.()}
                className={`flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
                  s.done ? 'opacity-60' : 'hover:bg-white/5'
                } ${!s.action || s.done ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <span
                  className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                    s.done ? 'border-flux-500/40 bg-flux-500/20 text-flux-300' : 'border-white/15 text-ink-400'
                  }`}
                >
                  {s.done ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                </span>
                <span className="min-w-0">
                  <span className={`block text-xs font-medium ${s.done ? 'line-through text-ink-500' : 'text-ink-100'}`}>
                    {s.label}
                  </span>
                  <span className="block text-[10px] text-ink-500">{s.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
