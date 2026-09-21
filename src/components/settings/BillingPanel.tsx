import { useEffect, useState } from 'react';
import { Check, CreditCard, ExternalLink, Sparkles } from 'lucide-react';
import { getPlanUsage, getWorkspaceSubscription, openBillingPortal, startCheckout, type PlanUsageSnapshot } from '@/lib/pulseApi';
import type { WorkspaceSubscription } from '@/types';

const planLabel: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
  enterprise: 'Enterprise',
};

const plans: {
  id: 'free' | 'starter' | 'pro' | 'business';
  name: string;
  price: string;
  features: string[];
}[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    features: ['3 seats', '20 AI credits/mo', '30-day history', 'Core Decision Rooms'],
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 'From $8/user',
    features: ['10 seats', '100 AI credits/mo', '90-day history', 'Integrations'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'From $12/user',
    features: ['50 seats', '500 AI credits/mo', '1-year history', 'Full AI + outcome reviews'],
  },
  {
    id: 'business',
    name: 'Business',
    price: 'From $29/user',
    features: ['500 seats', '2000 AI credits/mo', 'Long history', 'SSO + audit + export'],
  },
];

export function BillingPanel({ workspaceId, isAdmin }: { workspaceId: string; isAdmin: boolean }) {
  const [sub, setSub] = useState<WorkspaceSubscription | null>(null);
  const [usage, setUsage] = useState<PlanUsageSnapshot | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = async () => {
    try {
      const [s, u] = await Promise.all([getWorkspaceSubscription(workspaceId), getPlanUsage(workspaceId)]);
      setSub(s);
      setUsage(u);
    } catch {
      setSub({ plan: 'free', status: 'active', currentPeriodEnd: null });
    }
  };

  useEffect(() => {
    void refresh();
  }, [workspaceId]);

  const upgrade = async (plan: 'starter' | 'pro' | 'business') => {
    if (!isAdmin) {
      setError('Only workspace admins can change the plan.');
      return;
    }
    setBusy(plan);
    setError('');
    setNotice('');
    const result = await startCheckout(workspaceId, plan);
    if (result.error) {
      setError(result.error);
      setBusy(null);
      return;
    }
    if (result.url) {
      setNotice('Redirecting to secure Stripe checkout…');
      window.location.assign(result.url);
      return;
    }
    setError('No checkout URL returned. Check Stripe secrets and price IDs.');
    setBusy(null);
  };

  const openPortal = async () => {
    if (!isAdmin) {
      setError('Only workspace admins can manage billing.');
      return;
    }
    setBusy('portal');
    setError('');
    const result = await openBillingPortal(workspaceId);
    if (result.error) {
      setError(result.error);
      setBusy(null);
      return;
    }
    if (result.url) {
      window.location.assign(result.url);
      return;
    }
    setError('Could not open billing portal.');
    setBusy(null);
  };

  const current = sub?.plan ?? usage?.plan ?? 'free';
  const paid = current !== 'free';

  return (
    <div className="space-y-4">
      <section className="glass rounded-2xl p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <CreditCard className="h-3.5 w-3.5 text-pulse-300" /> Plan & billing
        </h2>
        <p className="mt-2 text-sm text-ink-300">
          Current plan: <b className="text-ink-50">{planLabel[current] ?? current}</b>
          {sub?.status && sub.status !== 'active' && (
            <span className="ml-2 text-xs text-alert-300">({sub.status})</span>
          )}
        </p>
        {sub?.currentPeriodEnd && (
          <p className="text-xs text-ink-500">Current period ends {new Date(sub.currentPeriodEnd).toLocaleDateString()}</p>
        )}

        {usage && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-ink-400">
            <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-2">
              Seats <b className="text-ink-100">{usage.seatsUsed}/{usage.seatsLimit}</b>
            </div>
            <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-2">
              AI credits <b className="text-ink-100">{usage.aiUsed}/{usage.aiLimit}</b>
            </div>
          </div>
        )}

        {isAdmin && paid && (
          <button onClick={() => void openPortal()} disabled={busy !== null} className="secondary-btn mt-3 w-full justify-center text-xs disabled:opacity-40">
            <ExternalLink className="h-3.5 w-3.5" />
            {busy === 'portal' ? 'Opening…' : 'Manage subscription & invoices'}
          </button>
        )}
        {!isAdmin && <p className="mt-2 text-[11px] text-ink-600">Ask a workspace admin to upgrade or manage billing.</p>}
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((p) => {
          const active = current === p.id;
          const canUpgrade = isAdmin && p.id !== 'free' && p.id !== current && (p.id === 'starter' || p.id === 'pro' || p.id === 'business');
          return (
            <div
              key={p.id}
              className={`rounded-2xl border p-4 ${
                active ? 'border-pulse-500/40 bg-pulse-500/10' : 'border-white/5 bg-white/[.02]'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{p.name}</h3>
                {active && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-flux-300">
                    <Check className="h-3 w-3" /> Current
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-ink-400">{p.price}</p>
              <ul className="mt-3 space-y-1.5">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-1.5 text-[11px] text-ink-300">
                    <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-pulse-300" /> {f}
                  </li>
                ))}
              </ul>
              {canUpgrade && (
                <button
                  disabled={busy !== null}
                  onClick={() => { if (p.id !== 'free') void upgrade(p.id); }}
                  className="primary-btn mt-4 w-full justify-center text-xs disabled:opacity-40"
                >
                  {busy === p.id ? 'Redirecting…' : current === 'free' ? `Upgrade to ${p.name}` : `Switch to ${p.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="text-xs text-ember-400">{error}</p>}
      {notice && <p className="text-xs text-flux-400">{notice}</p>}
      <p className="text-[11px] text-ink-600">
        Configure Stripe price IDs: STRIPE_PRICE_STARTER, STRIPE_PRICE_PRO, STRIPE_PRICE_BUSINESS. Use the customer portal to change payment method, download invoices, or cancel.
      </p>
    </div>
  );
}
