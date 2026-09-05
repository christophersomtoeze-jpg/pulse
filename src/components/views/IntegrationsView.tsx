import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Plug } from 'lucide-react';
import { connectSlack, disconnectIntegration, listWorkspaceIntegrations } from '@/lib/pulseApi';
import type { IntegrationProvider, WorkspaceIntegration } from '@/types';

const providerInfo: Record<IntegrationProvider, { name: string; description: string; docsHint: string; wired: boolean }> = {
  slack: { name: 'Slack', description: 'Turn channel conversations into PULSE discussions.', docsHint: 'Fully wired — needs SLACK_CLIENT_ID/SECRET set (see SUPABASE_SETUP.md).', wired: true },
  teams: { name: 'Microsoft Teams', description: 'Bring Teams channel activity into PULSE.', docsHint: 'Needs a Teams app registration + Graph API webhook — not yet built.', wired: false },
  google: { name: 'Google Workspace', description: 'Google Drive documents and Calendar events.', docsHint: 'Needs a Google Cloud OAuth app with Drive/Calendar scopes — not yet built.', wired: false },
  microsoft365: { name: 'Microsoft 365', description: 'OneDrive documents and Outlook Calendar.', docsHint: 'Needs a Microsoft Entra app registration with Graph scopes — not yet built.', wired: false },
  jira: { name: 'Jira', description: 'Sync PULSE Actions with Jira issues.', docsHint: 'Needs a Jira OAuth 2.0 (3LO) app — not yet built.', wired: false },
  notion: { name: 'Notion', description: 'Pull Notion pages in as Resources.', docsHint: 'Needs a Notion internal integration token — not yet built.', wired: false },
};

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
    </div>
  );
}
