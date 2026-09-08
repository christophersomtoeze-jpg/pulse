import { useEffect, useState, type FormEvent } from 'react';
import { ShieldCheck, Trash2 } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { addSsoDomain, listSsoDomains, removeSsoDomain } from '@/lib/pulseApi';
import type { SsoDomainSummary } from '@/types';

export function SsoPanel({ workspaceId, isOwner }: { workspaceId: string; isOwner: boolean }) {
  const { user } = useAuth();
  const [domains, setDomains] = useState<SsoDomainSummary[]>([]);
  const [domain, setDomain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => listSsoDomains(workspaceId).then(setDomains).catch((e) => setError(e instanceof Error ? e.message : 'Could not load SSO domains'));
  useEffect(() => { load(); }, [workspaceId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !domain.trim()) return;
    setBusy(true); setError('');
    try { await addSsoDomain(workspaceId, domain.trim(), user.id); setDomain(''); load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not add domain'); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => { await removeSsoDomain(id); load(); };

  return (
    <div className="glass rounded-2xl p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold"><ShieldCheck className="h-3.5 w-3.5 text-pulse-300" /> Single sign-on (SSO)</h2>
      <p className="mt-1 text-xs text-ink-500">
        Registers your company's email domain so people who sign in via SSO land in this workspace automatically. This is
        real code against Supabase Auth's own SSO API — but the actual identity-provider handshake (Okta, Azure AD, Google
        Workspace) needs your Supabase project on a plan with the SAML SSO add-on, configured via their CLI. See
        SUPABASE_SETUP.md for the exact steps — that gate belongs to Supabase, not to PULSE.
      </p>

      {isOwner && (
        <form onSubmit={submit} className="mt-3 flex gap-2">
          <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="yourcompany.com" className="field flex-1 text-sm" />
          <button disabled={busy || !domain.trim()} className="primary-btn text-xs disabled:opacity-40">{busy ? 'Adding…' : 'Add'}</button>
        </form>
      )}
      {error && <p className="mt-2 text-xs text-ember-400">{error}</p>}

      <div className="mt-3 space-y-2">
        {domains.map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[.02] px-3 py-2">
            <span className="text-sm">{d.domain}</span>
            {isOwner && <button onClick={() => remove(d.id)} className="icon-btn h-7 w-7 text-ember-300"><Trash2 className="h-3.5 w-3.5" /></button>}
          </div>
        ))}
        {domains.length === 0 && <p className="text-xs text-ink-500">No domains registered yet.</p>}
      </div>
      {!isOwner && <p className="mt-2 text-[11px] text-ink-600">Only the workspace owner can manage SSO domains.</p>}
    </div>
  );
}
