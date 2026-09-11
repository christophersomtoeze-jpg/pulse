import { useEffect, useState } from 'react';
import { Link2, Search, X } from 'lucide-react';
import { createDecisionLink, searchDecisions, suggestDecisionLinks } from '@/lib/pulseApi';
import type { DecisionRelationshipType, DecisionSummary } from '@/types';

const relationshipOptions: { value: DecisionRelationshipType; label: string; help: string }[] = [
  { value: 'depends_on', label: 'Depends on', help: 'This decision requires the selected decision.' },
  { value: 'supersedes', label: 'Supersedes', help: 'This decision replaces the selected decision.' },
  { value: 'related', label: 'Related', help: 'Both decisions share useful context.' },
  { value: 'blocks', label: 'Blocks', help: 'This decision prevents the selected decision from moving forward.' },
  { value: 'unlocked', label: 'Unlocks', help: 'This decision enables the selected decision.' },
];

export function LinkDecisionModal({
  open, decisionId, workspaceId, onClose, onCreated,
}: {
  open: boolean; decisionId: string; workspaceId: string; onClose: () => void; onCreated: () => void;
}) {
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<DecisionSummary[]>([]);
  const [suggestions, setSuggestions] = useState<{ decisionId: string; title: string; reason: string; confidence: number }[]>([]);
  const [selected, setSelected] = useState<DecisionSummary | null>(null);
  const [relationship, setRelationship] = useState<DecisionRelationshipType>('related');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setQuery(''); setSelected(null); setNote(''); setError('');
    void suggestDecisionLinks(decisionId).then(setSuggestions).catch(() => setSuggestions([]));
  }, [open, decisionId]);

  useEffect(() => {
    if (!query.trim()) { setCandidates([]); return; }
    const timer = window.setTimeout(() => {
      void searchDecisions(workspaceId, query).then(setCandidates).catch(() => setCandidates([]));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [query, workspaceId]);

  const save = async () => {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      await createDecisionLink({
        workspaceId, fromDecisionId: decisionId, toDecisionId: selected.id, relationshipType: relationship, note,
      });
      onCreated();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create link'); }
    finally { setBusy(false); }
  };

  const suggestionRows = suggestions.map((s) => ({ id: s.decisionId, title: s.title, description: s.reason } as DecisionSummary));

  return open ? (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="glass-strong w-full max-w-lg rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <div><p className="text-[10px] uppercase tracking-[.2em] text-pulse-300">Decision graph</p><h2 className="mt-1 text-lg font-semibold">Connect a decision</h2></div>
          <button className="icon-btn" onClick={onClose}><X /></button>
        </div>
        <div className="mt-4 flex gap-2">
          <Search className="mt-2.5 h-4 w-4 text-ink-500" />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search decisions…" className="field flex-1" />
        </div>
        <div className="mt-3 max-h-48 space-y-1 overflow-y-auto">
          {(query.trim() ? candidates : suggestionRows).map((d) => (
            <button key={d.id} onClick={() => setSelected(d)} className={`w-full rounded-xl border px-3 py-2 text-left ${selected?.id === d.id ? 'border-pulse-500/50 bg-pulse-500/10' : 'border-white/5 bg-white/[.02]'}`}>
              <div className="truncate text-xs font-semibold">{d.title}</div>
              <div className="mt-0.5 truncate text-[10px] text-ink-500">{d.description}</div>
            </button>
          ))}
          {!query.trim() && suggestions.length > 0 && <p className="px-1 text-[10px] text-ink-600">Suggested connections</p>}
          {query.trim() && candidates.length === 0 && <p className="py-4 text-center text-xs text-ink-500">No matching decisions.</p>}
        </div>
        {selected && (
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-ink-500">Relationship</label>
              <select value={relationship} onChange={(e) => setRelationship(e.target.value as DecisionRelationshipType)} className="field mt-1">
                {relationshipOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <p className="mt-1 text-[10px] text-ink-500">{relationshipOptions.find((o) => o.value === relationship)?.help}</p>
            </div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note…" className="field min-h-16 resize-none text-xs" />
            {error && <p className="text-xs text-ember-300">{error}</p>}
            <button disabled={busy} onClick={() => void save()} className="primary-btn w-full justify-center disabled:opacity-40"><Link2 className="h-3.5 w-3.5" /> {busy ? 'Linking…' : 'Create connection'}</button>
          </div>
        )}
      </div>
    </div>
  ) : null;
}
