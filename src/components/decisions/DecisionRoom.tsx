import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, CheckSquare, ExternalLink, Link2, Plus, User, X } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import {
  addDecisionComment, addDecisionResource, castDecisionVote, createAction, getDecision, getDecisionVoteTally,
  getLatestAIAnalysis, listActions, listDecisionComments, listDecisionHistory, listDecisionResources,
  requestAIAnalysis, setDecisionOutcome, type WorkspaceMember,
} from '@/lib/pulseApi';
import type {
  DecisionAIAnalysis, DecisionComment, DecisionHistoryEntry, DecisionOutcome,
  DecisionResource, DecisionSummary, DecisionVoteTally, VoteChoice, WorkspaceAction,
} from '@/types';
import { VotingPanel } from './VotingPanel';
import { CommentThread } from './CommentThread';
import { AIInsightPanel } from './AIInsightPanel';
import { OutcomeControls } from './OutcomeControls';

const statusPill: Record<string, string> = {
  approved: 'text-flux-300 bg-flux-500/15 border-flux-500/30',
  rejected: 'text-ember-300 bg-ember-500/15 border-ember-500/30',
  postponed: 'text-alert-300 bg-alert-500/15 border-alert-500/30',
  open: 'text-[#93c5fd] bg-[#3b82f6]/15 border-[#3b82f6]/30',
};

interface DecisionRoomProps {
  decisionId: string;
  members: WorkspaceMember[];
  isAdmin: boolean;
  onClose: () => void;
}

export function DecisionRoom({ decisionId, members, isAdmin, onClose }: DecisionRoomProps) {
  const { user } = useAuth();
  const [decision, setDecision] = useState<DecisionSummary | null>(null);
  const [resources, setResources] = useState<DecisionResource[]>([]);
  const [comments, setComments] = useState<DecisionComment[]>([]);
  const [tally, setTally] = useState<DecisionVoteTally>({ yes: 0, no: 0, needsInfo: 0, total: 0, myVote: null });
  const [history, setHistory] = useState<DecisionHistoryEntry[]>([]);
  const [analysis, setAnalysis] = useState<DecisionAIAnalysis | null>(null);
  const [decisionActions, setDecisionActions] = useState<WorkspaceAction[]>([]);
  const [addingAction, setAddingAction] = useState(false);
  const [actionTitle, setActionTitle] = useState('');
  const [addingResource, setAddingResource] = useState(false);
  const [resourceName, setResourceName] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const d = await getDecision(decisionId);
      const [res, cmts, t, hist, ai, allActions] = await Promise.all([
        listDecisionResources(decisionId),
        listDecisionComments(decisionId),
        getDecisionVoteTally(decisionId, user.id),
        listDecisionHistory(decisionId),
        getLatestAIAnalysis(decisionId),
        d ? listActions(d.workspaceId) : Promise.resolve([] as WorkspaceAction[]),
      ]);
      setDecision(d); setResources(res); setComments(cmts); setTally(t); setHistory(hist); setAnalysis(ai);
      setDecisionActions(allActions.filter((a) => a.decisionId === decisionId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this decision');
    }
  }, [decisionId, user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const channel = client
      .channel(`decision:${decisionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'decision_comments', filter: `decision_id=eq.${decisionId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'decision_votes', filter: `decision_id=eq.${decisionId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'decisions', filter: `id=eq.${decisionId}` }, load)
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [decisionId, load]);

  if (!decision) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
        <div className="glass-strong rounded-2xl px-6 py-4 text-sm text-ink-300">{error || 'Loading decision…'}</div>
      </div>
    );
  }

  const canDecide = isAdmin || decision.ownerId === user?.id || decision.createdBy === user?.id;
  const pillKey = decision.outcome ?? (decision.status === 'in-review' ? 'open' : decision.status === 'decided' ? 'approved' : 'open');

  const submitResource = async () => {
    if (!user || !resourceName.trim() || !resourceUrl.trim()) return;
    await addDecisionResource(decision.workspaceId, decision.id, resourceName.trim(), resourceUrl.trim(), user.id);
    setResourceName(''); setResourceUrl(''); setAddingResource(false);
    load();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/60 p-3 md:p-8" onClick={onClose}>
        <motion.div
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          onClick={(e) => e.stopPropagation()}
          className="ml-auto flex h-full w-full max-w-2xl flex-col glass-strong overflow-hidden rounded-3xl"
        >
          <div className="flex items-start justify-between border-b border-white/5 p-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[.2em] text-pulse-300">
                Decision Room
                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold normal-case tracking-normal ${statusPill[pillKey] ?? statusPill.open}`}>
                  {decision.outcome ?? decision.status}
                </span>
              </div>
              <h2 className="mt-1 font-display text-xl font-semibold">{decision.title}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-ink-400">
                {decision.ownerName && <span className="flex items-center gap-1"><User className="h-3 w-3" /> {decision.ownerName}</span>}
                {decision.deadline && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Due {new Date(decision.deadline).toLocaleDateString()}</span>}
              </div>
            </div>
            <button className="icon-btn shrink-0" onClick={onClose}><X /></button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {error && <p className="text-sm text-ember-400">{error}</p>}
            {decision.description && <p className="text-sm leading-relaxed text-ink-300">{decision.description}</p>}

            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Context &amp; resources</h3>
                <button onClick={() => setAddingResource((v) => !v)} className="icon-btn h-7 w-7"><Plus className="h-3.5 w-3.5" /></button>
              </div>
              {addingResource && (
                <div className="mt-2 flex gap-2">
                  <input value={resourceName} onChange={(e) => setResourceName(e.target.value)} placeholder="Name" className="field text-xs" />
                  <input value={resourceUrl} onChange={(e) => setResourceUrl(e.target.value)} placeholder="https://…" className="field text-xs" />
                  <button onClick={submitResource} className="icon-btn shrink-0"><Plus className="h-4 w-4" /></button>
                </div>
              )}
              <div className="mt-2 space-y-1.5">
                {resources.map((r) => (
                  <a key={r.id} href={r.url ?? '#'} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[.02] px-3 py-2 text-xs hover:border-pulse-500/30">
                    <Link2 className="h-3.5 w-3.5 shrink-0 text-pulse-300" />
                    <span className="truncate font-medium">{r.name}</span>
                    <ExternalLink className="ml-auto h-3 w-3 shrink-0 text-ink-500" />
                  </a>
                ))}
                {resources.length === 0 && <p className="text-xs text-ink-500">No resources added yet.</p>}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold"><CheckSquare className="h-3.5 w-3.5 text-pulse-300" /> Actions from this decision</h3>
                <button onClick={() => setAddingAction((v) => !v)} className="icon-btn h-7 w-7"><Plus className="h-3.5 w-3.5" /></button>
              </div>
              {addingAction && (
                <div className="mt-2 flex gap-2">
                  <input value={actionTitle} onChange={(e) => setActionTitle(e.target.value)} placeholder="What needs to happen next?" className="field text-xs" />
                  <button
                    onClick={async () => {
                      if (!user || !actionTitle.trim()) return;
                      await createAction(decision.workspaceId, { title: actionTitle.trim(), decisionId: decision.id, ownerId: decision.ownerId }, user.id);
                      setActionTitle(''); setAddingAction(false); load();
                    }}
                    className="icon-btn shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div className="mt-2 space-y-1.5">
                {decisionActions.map((a) => (
                  <div key={a.id} className="rounded-xl border border-white/5 bg-white/[.02] px-3 py-2 text-xs">
                    <span className={a.status === 'done' ? 'text-ink-500 line-through' : 'text-ink-200'}>{a.title}</span>
                    {a.ownerName && <span className="ml-2 text-ink-500">→ {a.ownerName}</span>}
                  </div>
                ))}
                {decisionActions.length === 0 && <p className="text-xs text-ink-500">No actions created from this decision yet.</p>}
              </div>
            </div>

            <VotingPanel tally={tally} onVote={async (choice: VoteChoice, anon) => { await castDecisionVote(decision.id, choice, anon); load(); }} />

            <AIInsightPanel
              analysis={analysis}
              configured={Boolean(supabase)}
              onAnalyze={async () => { const a = await requestAIAnalysis(decision.id); setAnalysis(a); }}
            />

            <OutcomeControls
              currentOutcome={decision.outcome}
              history={history}
              canDecide={canDecide}
              onSetOutcome={async (outcome: DecisionOutcome, note: string) => { const updated = await setDecisionOutcome(decision.id, outcome, note); setDecision(updated); load(); }}
            />

            <CommentThread
              comments={comments}
              members={members}
              onSubmit={async (body, mentions, parentId) => { if (!user) return; await addDecisionComment(decision.id, user.id, body, mentions, parentId); load(); }}
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
