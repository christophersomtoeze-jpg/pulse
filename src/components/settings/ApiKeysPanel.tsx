import { useEffect, useState } from 'react';
import { Copy, KeyRound, Plus, X } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { createApiKey, listApiKeys, revokeApiKey } from '@/lib/pulseApi';
import type { ApiKeySummary } from '@/types';

export function ApiKeysPanel({ workspaceId, isAdmin }: { workspaceId: string; isAdmin: boolean }) {
  const { user } = useAuth();
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [name, setName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => listApiKeys(workspaceId).then(setKeys).catch((e) => setError(e instanceof Error ? e.message : 'Could not load API keys'));
  useEffect(() => { load(); }, [workspaceId]);

  const create = async () => {
    if (!user || !name.trim()) return;
    setBusy(true); setError('');
    try { const key = await createApiKey(workspaceId, name.trim(), user.id); setNewKey(key); setName(''); load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not create key'); }
    finally { setBusy(false); }
  };

  const revoke = async (id: string) => { await revokeApiKey(id); load(); };

  if (!isAdmin) return <p className="text-xs text-ink-500">Only workspace admins can manage API keys.</p>;

  return (
    <div className="glass rounded-2xl p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold"><KeyRound className="h-3.5 w-3.5 text-pulse-300" /> API keys</h2>
      <p className="mt-1 text-xs text-ink-500">For your own scripts and tools — see <code className="text-ink-400">GET /decisions</code>, <code className="text-ink-400">GET /actions</code>, <code className="text-ink-400">POST /actions</code> at your project's <code className="text-ink-400">/functions/v1/api</code> endpoint.</p>

      {newKey && (
        <div className="mt-3 rounded-xl border border-flux-500/30 bg-flux-500/10 p-3">
          <p className="text-xs font-semibold text-flux-300">Copy this now — it won't be shown again.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-black/30 px-2 py-1.5 text-xs text-ink-100">{newKey}</code>
            <button onClick={() => navigator.clipboard.writeText(newKey)} className="icon-btn h-8 w-8 shrink-0"><Copy className="h-3.5 w-3.5" /></button>
            <button onClick={() => setNewKey(null)} className="icon-btn h-8 w-8 shrink-0"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Key name (e.g. Zapier)" className="field flex-1 text-sm" />
        <button onClick={create} disabled={busy || !name.trim()} className="icon-btn shrink-0 disabled:opacity-40"><Plus className="h-4 w-4" /></button>
      </div>
      {error && <p className="mt-2 text-xs text-ember-400">{error}</p>}

      <div className="mt-3 space-y-2">
        {keys.map((k) => (
          <div key={k.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[.02] px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm">{k.name} {k.revoked && <span className="text-ember-300">(revoked)</span>}</p>
              <p className="text-[10px] text-ink-500">{k.keyPrefix}… · {k.lastUsedAt ? `used ${new Date(k.lastUsedAt).toLocaleDateString()}` : 'never used'}</p>
            </div>
            {!k.revoked && <button onClick={() => revoke(k.id)} className="text-xs font-medium text-ember-300">Revoke</button>}
          </div>
        ))}
        {keys.length === 0 && <p className="text-xs text-ink-500">No API keys yet.</p>}
      </div>
    </div>
  );
}
