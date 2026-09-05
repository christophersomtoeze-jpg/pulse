import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileText, FolderOpen, MessageCircle, Search, User, Vote, X } from 'lucide-react';
import { globalSearch } from '@/lib/pulseApi';
import type { GlobalSearchResults } from '@/types';
import type { AppView } from '@/lib/viewTypes';

const EMPTY: GlobalSearchResults = { discussions: [], decisions: [], actions: [], resources: [], people: [] };

interface GlobalSearchModalProps {
  open: boolean;
  workspaceId: string | null;
  onClose: () => void;
  onNavigate: (view: AppView) => void;
}

export function GlobalSearchModal({ open, workspaceId, onClose, onNavigate }: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResults>(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) { setQuery(''); setResults(EMPTY); }
  }, [open]);

  useEffect(() => {
    if (!workspaceId || !query.trim()) { setResults(EMPTY); return; }
    const timer = setTimeout(() => {
      setBusy(true);
      globalSearch(workspaceId, query).then(setResults).finally(() => setBusy(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, workspaceId]);

  const totalResults = results.discussions.length + results.decisions.length + results.actions.length + results.resources.length + results.people.length;
  const go = (view: AppView) => { onNavigate(view); onClose(); };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] bg-black/60 p-4 pt-20" onClick={onClose}>
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} onClick={(e) => e.stopPropagation()} className="glass-strong mx-auto max-h-[70vh] w-full max-w-lg overflow-hidden rounded-2xl">
            <div className="flex items-center gap-2 border-b border-white/5 p-3">
              <Search className="h-4 w-4 shrink-0 text-ink-500" />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search PULSE…" className="flex-1 bg-transparent text-sm focus:outline-none" />
              <button onClick={onClose} className="icon-btn h-7 w-7 shrink-0"><X className="h-3.5 w-3.5" /></button>
            </div>

            <div className="max-h-[55vh] overflow-y-auto p-2">
              {!query.trim() && <p className="p-6 text-center text-xs text-ink-500">Search discussions, decisions, actions, resources, and people.</p>}
              {query.trim() && !busy && totalResults === 0 && <p className="p-6 text-center text-xs text-ink-500">No matches for "{query}".</p>}

              {results.discussions.length > 0 && (
                <div className="mb-1">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-600">Discussions</p>
                  {results.discussions.map((d) => (
                    <button key={d.id} onClick={() => go('discussions')} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-white/5">
                      <MessageCircle className="h-3.5 w-3.5 shrink-0 text-pulse-300" /> <span className="truncate">{d.title}</span>
                    </button>
                  ))}
                </div>
              )}
              {results.decisions.length > 0 && (
                <div className="mb-1">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-600">Decisions</p>
                  {results.decisions.map((d) => (
                    <button key={d.id} onClick={() => go('decisions')} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-white/5">
                      <Vote className="h-3.5 w-3.5 shrink-0 text-pulse-300" /> <span className="truncate">{d.title}</span>
                    </button>
                  ))}
                </div>
              )}
              {results.actions.length > 0 && (
                <div className="mb-1">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-600">Actions</p>
                  {results.actions.map((a) => (
                    <button key={a.id} onClick={() => go('actions')} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-white/5">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-pulse-300" /> <span className="truncate">{a.title}</span>
                    </button>
                  ))}
                </div>
              )}
              {results.resources.length > 0 && (
                <div className="mb-1">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-600">Resources</p>
                  {results.resources.map((r) => (
                    <button key={r.id} onClick={() => go('resources')} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-white/5">
                      <FolderOpen className="h-3.5 w-3.5 shrink-0 text-pulse-300" /> <span className="truncate">{r.name}</span>
                    </button>
                  ))}
                </div>
              )}
              {results.people.length > 0 && (
                <div className="mb-1">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-600">People</p>
                  {results.people.map((p) => (
                    <button key={p.id} onClick={() => go('team')} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-white/5">
                      <User className="h-3.5 w-3.5 shrink-0 text-pulse-300" /> <span className="truncate">{p.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
