import { useEffect, useState } from 'react';
import { CreditCard, LogOut, Moon, Shield, User } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { getWorkspaceSubscription, startCheckout } from '@/lib/pulseApi';
import type { WorkspaceSubscription } from '@/types';

const planLabel: Record<WorkspaceSubscription['plan'], string> = { free: 'Free', pro: 'Pro', business: 'Business', enterprise: 'Enterprise' };

function BillingSection({ workspaceId, isAdmin }: { workspaceId: string; isAdmin: boolean }) {
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

export function SettingsView({ workspaceId, workspaceName, workspaceRole, isAdmin }: { workspaceId: string; workspaceName: string; workspaceRole: string; isAdmin: boolean }) {
  const { user, signOut } = useAuth();

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 pb-28 pt-5">
      <div>
        <p className="flex items-center gap-1.5 text-xs uppercase tracking-[.2em] text-pulse-300"><User className="h-3.5 w-3.5" /> Account</p>
        <h1 className="mt-1 font-display text-2xl font-semibold">Settings</h1>
      </div>

      <section className="glass rounded-2xl p-4">
        <h2 className="text-sm font-semibold">Account</h2>
        <div className="mt-3 flex items-center gap-3">
          <div className="avatar h-11 w-11">{(user?.user_metadata?.full_name?.[0] ?? user?.email?.[0] ?? 'A').toUpperCase()}</div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user?.user_metadata?.full_name ?? 'You'}</p>
            <p className="truncate text-xs text-ink-500">{user?.email}</p>
          </div>
        </div>
      </section>

      <section className="glass rounded-2xl p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Shield className="h-3.5 w-3.5 text-pulse-300" /> Workspace</h2>
        <p className="mt-2 text-sm text-ink-300">{workspaceName}</p>
        <p className="text-xs text-ink-500">Your role: {workspaceRole}</p>
      </section>

      <BillingSection workspaceId={workspaceId} isAdmin={isAdmin} />

      <section className="glass rounded-2xl p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Moon className="h-3.5 w-3.5 text-pulse-300" /> Appearance</h2>
        <p className="mt-2 text-xs text-ink-500">PULSE currently ships dark-theme only. Light/system theme switching is planned for a later settings pass.</p>
      </section>

      <button onClick={signOut} className="flex w-full items-center justify-center gap-2 rounded-xl border border-ember-500/30 bg-ember-500/10 py-3 text-sm font-medium text-ember-300">
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}
