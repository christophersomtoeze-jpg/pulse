import { useEffect, useMemo, useState } from 'react';
import { Check, CreditCard, ExternalLink, Sparkles } from 'lucide-react';
import { getWorkspaceSubscription, startCheckout, openBillingPortal } from '@/lib/pulseApi';
import type { SubscriptionPlan, WorkspaceSubscription } from '@/types';

const plans: Array<{
  id: Exclude<SubscriptionPlan, 'enterprise'>;
  name: string;
  price: string;
  description: string;
  features: string[];
}> = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    description: 'For small teams getting started with better decisions.',
    features: ['Core discussions', 'Decisions & polls', 'Basic Actions', 'PULSE AI basics'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'Paid',
    description: 'For teams that want deeper intelligence and execution.',
    features: ['Everything in Free', 'Decision intelligence', 'Automation', 'Analytics & risk signals', 'Integrations'],
  },
  {
    id: 'business',
    name: 'Business',
    price: 'Paid',
    description: 'For organizations with advanced workflows and governance.',
    features: ['Everything in Pro', 'Advanced governance', 'Higher usage limits', 'Priority support'],
  },
];

const planLabel: Record<WorkspaceSubscription['plan'], string> = {
  free: 'Free', pro: 'Pro', business: 'Business', enterprise: 'Enterprise',
};

export function BillingPanel({ workspaceId, isAdmin }: { workspaceId: string; isAdmin: boolean }) {
  const [sub, setSub] = useState<WorkspaceSubscription | null>(null);
  const [busy, setBusy] = useState<'pro' | 'business' | 'portal' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    try { setSub(await getWorkspaceSubscription(workspaceId)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to load billing.'); }
  };

  useEffect(() => { void load(); }, [workspaceId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    if (checkout === 'success') {
      setNotice('Payment completed. Your workspace plan will update after Stripe confirms the subscription.');
      void load();
      window.history.replaceState({}, '', window.location.pathname);
    } else if (checkout === 'cancelled') {
      setNotice('Checkout was cancelled. Your current plan has not changed.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [workspaceId]);

  const current = sub?.plan ?? 'free';
  const currentPlan = useMemo(() => planLabel[current], [current]);

  const upgrade = async (plan: 'pro' | 'business') => {
    setBusy(plan); setError(''); setNotice('');
    try {
      const result = await startCheckout(workspaceId, plan);
      if (result.error) setError(result.error);
      else if (result.url) window.location.assign(result.url);
      else setError('Stripe did not return a checkout URL.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start checkout.');
    } finally { setBusy(null); }
  };

  const manage = async () => {
    setBusy('portal'); setError(''); setNotice('');
    try {
      const result = await openBillingPortal(workspaceId);
      if (result.error) setError(result.error);
      else if (result.url) window.location.assign(result.url);
      else setError('Stripe did not return a billing portal URL.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open billing portal.');
    } finally { setBusy(null); }
  };

  return (
    <section className="space-y-4">
      <div className="glass rounded-2xl p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <CreditCard className="h-4 w-4 text-pulse-300" /> Plan & Billing
            </h2>
            <p className="mt-1 text-xs text-ink-500">Manage the subscription for this workspace.</p>
          </div>
          <span className="rounded-full border border-pulse-400/20 bg-pulse-400/10 px-2.5 py-1 text-xs font-semibold text-pulse-200">
            {currentPlan}
          </span>
        </div>

        {sub?.currentPeriodEnd && (
          <p className="mt-3 text-xs text-ink-400">
            {sub.status === 'canceled' ? 'Access period ends' : 'Renews'} {new Date(sub.currentPeriodEnd).toLocaleDateString()}
          </p>
        )}

        {sub?.status === 'past_due' && (
          <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-200">
            Your subscription needs attention. Open Stripe Billing to update the payment method.
          </div>
        )}

        {isAdmin && current !== 'free' && current !== 'enterprise' && (
          <button onClick={() => void manage()} disabled={busy !== null} className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-xs font-semibold text-ink-100 hover:bg-white/[.06] disabled:opacity-40">
            <ExternalLink className="h-3.5 w-3.5" /> {busy === 'portal' ? 'Opening…' : 'Manage subscription'}
          </button>
        )}
      </div>

      {notice && <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs text-emerald-200">{notice}</div>}
      {error && <div className="rounded-xl border border-ember-400/20 bg-ember-400/5 p-3 text-xs text-ember-300">{error}</div>}

      <div className="grid gap-3 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = current === plan.id;
          const canUpgrade = isAdmin && current === 'free' && !isCurrent && (plan.id === 'pro' || plan.id === 'business');
          return (
            <div key={plan.id} className={`glass rounded-2xl p-4 ${isCurrent ? 'ring-1 ring-pulse-400/30' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-base font-semibold">{plan.name}</h3>
                {isCurrent && <span className="text-[10px] font-semibold uppercase tracking-wider text-pulse-300">Current</span>}
              </div>
              <p className="mt-1 text-xl font-bold">{plan.price}<span className="text-xs font-normal text-ink-500">{plan.id === 'free' ? '' : ' / workspace'}</span></p>
              <p className="mt-2 min-h-10 text-xs leading-5 text-ink-400">{plan.description}</p>
              <ul className="mt-3 space-y-2">
                {plan.features.map((feature) => <li key={feature} className="flex gap-2 text-xs text-ink-300"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pulse-300" />{feature}</li>)}
              </ul>
              {canUpgrade && (
                <button onClick={() => void upgrade(plan.id as 'pro' | 'business')} disabled={busy !== null} className="primary-btn mt-4 w-full justify-center text-xs disabled:opacity-40">
                  <Sparkles className="h-3.5 w-3.5" /> {busy === plan.id ? 'Opening checkout…' : `Choose ${plan.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="px-1 text-[11px] leading-5 text-ink-600">
        Stripe is the payment processor. Pricing shown here is intentionally not hard-coded to a currency amount until your Stripe Products and Prices are configured. Only workspace admins can start or manage billing.
      </p>
    </section>
  );
}
