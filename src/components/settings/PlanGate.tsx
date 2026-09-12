import { LockKeyhole, Sparkles } from 'lucide-react';
import type { PaidFeature } from '@/lib/planEntitlements';
import { getRequiredPlan } from '@/lib/planEntitlements';
import type { SubscriptionPlan } from '@/types';

export function PlanGate({ plan, feature, title, description, onBilling }: {
  plan: SubscriptionPlan;
  feature: PaidFeature;
  title?: string;
  description?: string;
  onBilling?: () => void;
}) {
  const required = getRequiredPlan(feature);
  const label = required === 'business' ? 'Business' : 'Pro';
  return (
    <div className="mx-auto max-w-xl px-4 pb-28 pt-12">
      <div className="glass-strong rounded-3xl p-6 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-pulse-400/10 text-pulse-200">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <p className="mt-4 text-[10px] font-semibold uppercase tracking-[.2em] text-pulse-300">{label} feature</p>
        <h1 className="mt-2 font-display text-xl font-semibold text-ink-50">{title ?? 'Unlock this PULSE capability'}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-400">
          {description ?? `This capability is included with ${label}. Upgrade the workspace to unlock it for your team.`}
        </p>
        {onBilling && (
          <button onClick={onBilling} className="primary-btn mx-auto mt-5 inline-flex justify-center">
            <Sparkles className="h-4 w-4" /> View plans
          </button>
        )}
      </div>
    </div>
  );
}
