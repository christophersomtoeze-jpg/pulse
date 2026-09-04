import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link2, Plus, Trash2, X } from 'lucide-react';
import type { WorkspaceMember } from '@/lib/pulseApi';

interface NewDecisionModalProps {
  open: boolean;
  members: WorkspaceMember[];
  currentUserId: string;
  onClose: () => void;
  onCreate: (input: {
    title: string;
    description: string;
    deadline: string | null;
    ownerId: string;
    resourceLinks: { name: string; url: string }[];
  }) => Promise<void>;
}

export function NewDecisionModal({ open, members, currentUserId, onClose, onCreate }: NewDecisionModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [ownerId, setOwnerId] = useState(currentUserId);
  const [resources, setResources] = useState<{ name: string; url: string }[]>([]);
  const [resourceName, setResourceName] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const addResource = () => {
    if (!resourceName.trim() || !resourceUrl.trim()) return;
    setResources((r) => [...r, { name: resourceName.trim(), url: resourceUrl.trim() }]);
    setResourceName('');
    setResourceUrl('');
  };

  const reset = () => {
    setTitle(''); setDescription(''); setDeadline(''); setOwnerId(currentUserId); setResources([]); setError('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true); setError('');
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim(),
        deadline: deadline ? new Date(deadline).toISOString() : null,
        ownerId,
        resourceLinks: resources,
      });
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create decision');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
          <motion.form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="glass-strong flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl"
          >
            <div className="flex items-center justify-between border-b border-white/5 p-5">
              <div>
                <div className="text-[10px] uppercase tracking-[.2em] text-pulse-300">Decision Room</div>
                <h2 className="font-display text-xl font-semibold">New decision</h2>
              </div>
              <button type="button" className="icon-btn" onClick={onClose}><X /></button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <div>
                <label className="text-xs font-medium text-ink-400">Title</label>
                <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What are you deciding?" className="field mt-1.5" />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-400">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add context, constraints, and what a good outcome looks like." className="field mt-1.5 min-h-24 resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-ink-400">Deadline</label>
                  <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="field mt-1.5" />
                </div>
                <div>
                  <label className="text-xs font-medium text-ink-400">Decision owner</label>
                  <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="field mt-1.5">
                    <option value={currentUserId}>Me</option>
                    {members.filter((m) => m.userId !== currentUserId).map((m) => (
                      <option key={m.userId} value={m.userId}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-ink-400">Context &amp; resources</label>
                <div className="mt-1.5 space-y-2">
                  {resources.map((r, i) => (
                    <div key={`${r.url}-${i}`} className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[.02] px-3 py-2 text-xs">
                      <Link2 className="h-3.5 w-3.5 shrink-0 text-pulse-300" />
                      <span className="truncate font-medium">{r.name}</span>
                      <span className="truncate text-ink-500">{r.url}</span>
                      <button type="button" onClick={() => setResources((rs) => rs.filter((_, idx) => idx !== i))} className="ml-auto shrink-0 text-ember-300">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input value={resourceName} onChange={(e) => setResourceName(e.target.value)} placeholder="Resource name" className="field text-xs" />
                    <input value={resourceUrl} onChange={(e) => setResourceUrl(e.target.value)} placeholder="https://…" className="field text-xs" />
                    <button type="button" onClick={addResource} className="icon-btn shrink-0"><Plus className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>

              {error && <p className="text-sm text-ember-400">{error}</p>}
            </div>

            <div className="border-t border-white/5 p-4">
              <button disabled={busy || !title.trim()} className="primary-btn w-full justify-center disabled:opacity-40">
                {busy ? 'Creating…' : 'Create decision'}
              </button>
            </div>
          </motion.form>
        </div>
      )}
    </AnimatePresence>
  );
}
