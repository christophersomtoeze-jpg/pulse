import { useEffect, useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, Plug, Plus, Trash2, Webhook } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { connectSlack, createIncomingWebhook, deleteIncomingWebhook, disconnectIntegration, listIncomingWebhooks, listWorkspaceIntegrations } from '@/lib/pulseApi';
import type { IncomingWebhookSummary, IntegrationProvider, WorkspaceIntegration } from '@/types';

const providerInfo: Record<IntegrationProvider, { name: string; description: string; docsHint: string; wired: boolean }> = {
  slack: { name: 'Slack', description: 'Turn channel conversations into PULSE discussions.', docsHint: 'Fully wired — needs SLACK_CLIENT_ID/SECRET set (see SUPABASE_SETUP.md).', wired: true },
  teams: { name: 'Microsoft Teams', description: 'Bring Teams channel activity into PULSE.', docsHint: 'Needs a Teams app registration + Graph API webhook — not yet built. Use an Incoming Webhook below as a workaround via Power Automate.', wired: false },
  google: { name: 'Google Workspace', description: 'Google Drive documents and Calendar events.', docsHint: 'Needs a Google Cloud OAuth app with Drive/Calendar scopes — not yet built.', wired: false },
  microsoft365: { name: 'Microsoft 365', description: 'OneDrive documents and Outlook Calendar.', docsHint: 'Needs a Microsoft Entra app registration with Graph scopes — not yet built.', wired: false },
  jira: { name: 'Jira', description: 'Sync PULSE Actions with Jira issues.', docsHint: 'Needs a Jira OAuth 2.0 (3LO) app — not yet built. Jira Automation can call an Incoming Webhook below in the meantime.', wired: false },
  notion: { name: 'Notion', description: 'Pull Notion pages in as Resources.', docsHint: 'Needs a Notion internal integration token — not yet built.', wired: false },
};

function IncomingWebhooksSection({ workspaceId, isAdmin }: { workspaceId: string; isAdmin: boolean }) {
  const { user } = useAuth();
  const [hooks, setHooks] = useState<IncomingWebhookSummary[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';

  const load = () => listIncomingWebhooks(workspaceId).then(setHooks).catch(() => {});
  useEffect(() => { load(); }, [workspaceId]);

  const create = async () => {
    if (!user || !name.trim()) return;
    setBusy(true);
    try { await createIncomingWebhook(workspaceId, name.trim(), user.id); setName(''); load(); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => { await deleteIncomingWebhook(id); load(); };
  const urlFor = (token: string) => {
    if (!supabaseUrl) return '(set VITE_SUPABASE_URL to see the real URL)';
    try { return `${new URL(supabaseUrl).origin}/functions/v1/webhook-intake/${token}`; }
    catch { return '(invalid VITE_SUPABASE_URL)'; }
  };

  return (
    <section className="mt-6">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Webhook className="h-4 w-4 text-pulse-300" /> Incoming webhooks</h2>
      <p className="mt-1 text-xs text-ink-500">Give Zapier, Make, n8n, Jira Automation, Power Automate — or any script — a URL that posts real updates into PULSE as a discussion. Works today, no OAuth app needed.</p>

      {isAdmin && (
        <div className="mt-3 flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. GitHub deploys)" className="field flex-1 text-sm" />
          <button onClick={create} disabled={busy || !name.trim()} className="icon-btn shrink-0 disabled:opacity-40"><Plus className="h-4 w-4" /></button>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {hooks.map((h) => (
          <div key={h.id} className="glass rounded-2xl p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{h.name}</p>
              {isAdmin && <button onClick={() => remove(h.id)} className="icon-btn h-7 w-7 text-ember-300"><Trash2 className="h-3.5 w-3.5" /></button>}
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg bg-black/30 px-2 py-1.5 text-[11px] text-ink-400">{urlFor(h.token)}</code>
              <button onClick={() => navigator.clipboard.writeText(urlFor(h.token))} className="icon-btn h-7 w-7 shrink-0"><Copy className="h-3 w-3" /></button>
            </div>
            <p className="mt-1 text-[10px] text-ink-600">POST {'{'}"title": "...", "body": "..."{'}'} · {h.lastUsedAt ? `last used ${new Date(h.lastUsedAt).toLocaleDateString()}` : 'never used'}</p>
          </div>
        ))}
        {hooks.length === 0 && <p className="text-xs text-ink-500">No incoming webhooks yet.</p>}
      </div>
    </section>
  );
}

export function IntegrationsView({ workspaceId, isAdmin }: { workspaceId: string; isAdmin: boolean }) {
  const [integrations, setIntegrations] = useState<WorkspaceIntegration[]>([]);
  const [error, setError] = useState('');

  const load = () => listWorkspaceIntegrations(workspaceId).then(setIntegrations).catch((e) => setError(e instanceof Error ? e.message : 'Could not load integrations'));
  useEffect(() => { load(); }, [workspaceId]);

  const disconnect = async (provider: IntegrationProvider) => { await disconnectIntegration(workspaceId, provider); load(); };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-28 pt-5">
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-[.2em] text-pulse-300"><Plug className="h-3.5 w-3.5" /> Phase 6</p>
      <h1 className="mt-1 font-display text-2xl font-semibold">Integrations</h1>
      <p className="mt-1 text-xs text-ink-500">Connect the tools your team already uses. Nothing here shows "Connected" unless it genuinely is.</p>

      {error && <p className="mt-4 text-sm text-ember-400">{error}</p>}
      {!isAdmin && <p className="mt-4 text-xs text-alert-300">Only workspace admins can connect or disconnect integrations.</p>}

      <div className="mt-5 space-y-2.5">
        {integrations.map((i) => {
          const info = providerInfo[i.provider];
          const connected = i.status === 'connected';
          return (
            <div key={i.provider} className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold">{info.name}{connected && <CheckCircle2 className="h-3.5 w-3.5 text-flux-400" />}</p>
                  <p className="mt-0.5 text-xs text-ink-500">{info.description}</p>
                </div>
                {connected ? (
                  <button disabled={!isAdmin} onClick={() => disconnect(i.provider)} className="rounded-lg border border-ember-500/30 bg-ember-500/10 px-3 py-1.5 text-xs font-medium text-ember-300 disabled:opacity-40">Disconnect</button>
                ) : i.provider === 'slack' ? (
                  <button disabled={!isAdmin} onClick={() => connectSlack(workspaceId)} className="primary-btn px-3 py-1.5 text-xs disabled:opacity-40">Connect</button>
                ) : (
                  <span className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-ink-500">Not yet built</span>
                )}
              </div>
              {!connected && <p className="mt-2 flex items-center gap-1 text-[11px] text-ink-600"><ExternalLink className="h-3 w-3" /> {info.docsHint}</p>}
            </div>
          );
        })}
      </div>

      <IncomingWebhooksSection workspaceId={workspaceId} isAdmin={isAdmin} />
    </div>
  );
}
