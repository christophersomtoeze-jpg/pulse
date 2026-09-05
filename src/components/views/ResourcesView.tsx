import { useEffect, useState, type FormEvent } from 'react';
import { ExternalLink, Folder, Link2, Plus, X } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { addWorkspaceResource, listWorkspaceResources, type WorkspaceResource } from '@/lib/pulseApi';

export function ResourcesView({ workspaceId }: { workspaceId: string }) {
  const { user } = useAuth();
  const [resources, setResources] = useState<WorkspaceResource[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const load = () => listWorkspaceResources(workspaceId).then(setResources).catch((e) => setError(e instanceof Error ? e.message : 'Could not load resources'));
  useEffect(() => { load(); }, [workspaceId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim() || !url.trim()) return;
    try { await addWorkspaceResource(workspaceId, name.trim(), url.trim(), user.id); setName(''); setUrl(''); setAdding(false); load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not add resource'); }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pb-28 pt-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-[.2em] text-pulse-300"><Folder className="h-3.5 w-3.5" /> Workspace</p>
          <h1 className="mt-1 font-display text-2xl font-semibold">Resources</h1>
        </div>
        <button onClick={() => setAdding((v) => !v)} className="primary-btn"><Plus className="h-4 w-4" /> Add</button>
      </div>

      {adding && (
        <form onSubmit={submit} className="glass flex flex-col gap-2 rounded-2xl p-4 sm:flex-row sm:items-center">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="field text-sm" />
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="field text-sm" />
          <div className="flex gap-2">
            <button className="icon-btn shrink-0"><Plus className="h-4 w-4" /></button>
            <button type="button" onClick={() => setAdding(false)} className="icon-btn shrink-0"><X className="h-4 w-4" /></button>
          </div>
        </form>
      )}

      {error && <p className="text-sm text-ember-400">{error}</p>}

      <div className="space-y-2">
        {resources.map((r) => (
          <a key={r.id} href={r.url ?? '#'} target="_blank" rel="noreferrer" className="glass flex items-center gap-3 rounded-2xl p-3.5 hover:border-pulse-500/30">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-pulse-500/10"><Link2 className="h-4 w-4 text-pulse-300" /></div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.name}</p>
              <p className="truncate text-[11px] text-ink-500">{r.decisionTitle ? `From decision: ${r.decisionTitle}` : 'Workspace resource'}</p>
            </div>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-ink-500" />
          </a>
        ))}
        {resources.length === 0 && (
          <div className="glass rounded-2xl p-8 text-center">
            <p className="text-sm text-ink-400">No resources yet.</p>
            <button onClick={() => setAdding(true)} className="mt-3 text-sm font-medium text-pulse-300">Add the first one</button>
          </div>
        )}
      </div>
    </div>
  );
}
