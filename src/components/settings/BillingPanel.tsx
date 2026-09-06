import { useEffect, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { getWorkspaceSubscription, startCheckout } from '@/lib/pulseApi';
import type { WorkspaceSubscription } from '@/types';

const planLabel: Record<WorkspaceSubscription['plan'], string> = { free: 'Free', pro: 'Pro', business: 'Business', enterprise: 'Enterprise' };

export function BillingPanel({ workspaceId, isAdmin }: { workspaceId: string; isAdmin: boolean }) {
  const [sub, setSub] = useState<WorkspaceSubscription | null>(null);
  const [busy, setBusy] = useState<'pro' | 'business' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { getWorkspaceSubscription(workspaceId).then(setSub).catch(() => {}); }, [workspaceId]);

  const upgrade = async (plan: 'pro' | 'business') => {
    setBusy(plan); setError('');
    const result = await startCheckout(workspaceId, plan);
    if (result.error) setError(result.error);
    else if (result.url) window.location.assign(result.url);
    setBusy(null);
  };

  return (
    <section className="glass rounded-2xl p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold"><CreditCard className="h-3.5 w-3.5 text-pulse-300" /> Billing</h2>
      <p className="mt-2 text-sm text-ink-300">Current plan: <b>{sub ? planLabel[sub.plan] : '—'}</b></p>
      {sub?.currentPeriodEnd && <p className="text-xs text-ink-500">Renews {new Date(sub.currentPeriodEnd).toLocaleDateString()}</p>}
      {isAdmin && sub?.plan === 'free' && (
        <div className="mt-3 flex gap-2">
          <button disabled={busy !== null} onClick={() => upgrade('pro')} className="primary-btn flex-1 justify-center text-xs disabled:opacity-40">{busy === 'pro' ? 'Redirecting…' : 'Upgrade to Pro'}</button>
          <button disabled={busy !== null} onClick={() => upgrade('business')} className="flex-1 justify-center rounded-xl border border-white/10 bg-white/[.03] py-2.5 text-xs font-semibold text-ink-100 disabled:opacity-40">{busy === 'business' ? 'Redirecting…' : 'Upgrade to Business'}</button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-ember-400">{error}</p>}
      <p className="mt-2 text-[11px] text-ink-600">Billing is inert until your own Stripe account is connected (see SUPABASE_SETUP.md) — upgrade buttons will show a clear error until then.</p>
    </section>
  );
}
