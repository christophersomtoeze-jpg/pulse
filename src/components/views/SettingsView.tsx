import { LogOut, Moon, Shield, User } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';

export function SettingsView({ workspaceName, workspaceRole }: { workspaceName: string; workspaceRole: string }) {
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
