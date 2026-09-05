import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FolderOpen, Home, LayoutGrid, MessageCircle, Send, Sparkles, Users, X } from 'lucide-react';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { TeamView } from '@/components/TeamPanel';
import { Sidebar } from '@/components/layout/Sidebar';
import { NavDrawer } from '@/components/home/NavDrawer';
import { HomeHeader } from '@/components/home/HomeHeader';
import { MessageComposer } from '@/components/home/MessageComposer';
import { GlobalSearchModal } from '@/components/GlobalSearchModal';
import { DiscussionsView } from '@/components/views/DiscussionsView';
import { PollsView } from '@/components/views/PollsView';
import { ResourcesView } from '@/components/views/ResourcesView';
import { ActionsView } from '@/components/views/ActionsView';
import { PulseAIView } from '@/components/views/PulseAIView';
import { RiskCenterView } from '@/components/views/RiskCenterView';
import { MeetingSummariesView } from '@/components/views/MeetingSummariesView';
import { AnalyticsView } from '@/components/views/AnalyticsView';
import { AuditLogView } from '@/components/views/AuditLogView';
import { IntegrationsView } from '@/components/views/IntegrationsView';
import { NotificationsView } from '@/components/views/NotificationsView';
import { InvitationsView } from '@/components/views/InvitationsView';
import { SettingsView } from '@/components/views/SettingsView';
import { HelpView } from '@/components/views/HelpView';
import { ComingSoonView } from '@/components/views/ComingSoonView';
import { DashboardView } from '@/components/DashboardView';
import { DecisionsListView } from '@/components/decisions/DecisionsListView';
import { NewDecisionModal } from '@/components/decisions/NewDecisionModal';
import { DecisionRoom } from '@/components/decisions/DecisionRoom';
import { KeyboardShortcutsModal } from '@/components/KeyboardShortcutsModal';
import type { AppView } from '@/lib/viewTypes';
import { activePolls as demoPolls, topicNodes as demoTopics } from '@/data';
import {
  getCurrentWorkspace, getWorkspaceById, loadWorkspaceData, sendMessage, createWorkspace,
  listWorkspaceMembers, listWorkspaceInvites, listDecisions, createDecision, loadDashboardData,
  listMyWorkspaces, listActions, computeRisks, type WorkspaceMember, type DashboardData,
} from '@/lib/pulseApi';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { ActivePoll, DecisionSummary, IntentWave, TopicNode, WorkspaceListItem } from '@/types';

const ACTIVE_WORKSPACE_KEY = 'pulse:active-workspace-id';
const intentLabels: Record<IntentWave, string> = { whisper: 'Whisper', standard: 'Standard', pulse: 'Pulse Alert' };

const demoResources = [
  { name: 'Project Brief', icon: FolderOpen },
  { name: 'Roadmap', icon: FolderOpen },
  { name: 'Resources', icon: FolderOpen },
];

/** Fills the Ledger/Decisions/Dashboard views with something to look at before Supabase is configured. */
function demoDecisionSummaries(): DecisionSummary[] {
  return [
    { id: 'demo-1', workspaceId: 'demo', title: 'Brand Identity', description: 'Locking the wordmark-only direction.', status: 'decided', outcome: 'approved', deadline: null, ownerId: null, ownerName: 'Sarah Chen', createdBy: 'demo', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), decidedAt: new Date().toISOString() },
    { id: 'demo-2', workspaceId: 'demo', title: 'Launch Strategy', description: 'Q3 soft launch timeline and channels.', status: 'in-review', outcome: null, deadline: null, ownerId: null, ownerName: 'Marcus Lee', createdBy: 'demo', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), decidedAt: null },
    { id: 'demo-3', workspaceId: 'demo', title: 'AI Integration', description: 'Recommendation engine rollout.', status: 'in-review', outcome: null, deadline: null, ownerId: null, ownerName: 'Aisha Patel', createdBy: 'demo', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), decidedAt: null },
  ];
}

function WorkspaceSetup({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (!user || !name.trim()) return; setBusy(true); setError('');
    try { await createWorkspace(user.id, name.trim()); onCreated(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not create workspace'); }
    finally { setBusy(false); }
  };
  return <div className="min-h-screen px-5 py-10 grid place-items-center"><form onSubmit={submit} className="w-full max-w-md glass-strong rounded-3xl p-6"><div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#06b6d4] grid place-items-center shadow-glow"><Users className="text-white"/></div><h1 className="mt-5 font-display text-2xl font-semibold">Create your workspace</h1><p className="mt-2 text-sm text-ink-400">This is your company or team space. You can invite people after the foundation is connected.</p><input required value={name} onChange={e=>setName(e.target.value)} placeholder="Company or workspace name" className="field mt-6"/><p className="mt-2 text-xs text-ink-500">Example: Acme Product Team</p>{error && <p className="mt-3 text-sm text-ember-400">{error}</p>}<button disabled={busy} className="primary-btn mt-5 w-full justify-center disabled:opacity-40">{busy?'Creating…':'Create workspace'}</button></form></div>;
}

function NewWorkspaceModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (ws: { id: string; name: string }) => void }) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (!user || !name.trim()) return; setBusy(true); setError('');
    try { const ws = await createWorkspace(user.id, name.trim()); setName(''); onCreated(ws); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not create workspace'); }
    finally { setBusy(false); }
  };
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4" onClick={onClose}>
          <motion.form onSubmit={submit} onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="glass-strong w-full max-w-sm rounded-2xl p-5">
            <div className="flex items-center justify-between"><h2 className="font-display text-lg font-semibold">New workspace</h2><button type="button" className="icon-btn" onClick={onClose}><X className="h-4 w-4" /></button></div>
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Workspace name" className="field mt-4" />
            {error && <p className="mt-2 text-xs text-ember-400">{error}</p>}
            <button disabled={busy || !name.trim()} className="primary-btn mt-4 w-full justify-center disabled:opacity-40">{busy ? 'Creating…' : 'Create workspace'}</button>
          </motion.form>
        </div>
      )}
    </AnimatePresence>
  );
}

function DiscussionDrawer({ topic, onClose, onSend, busy, message, setMessage, intent, setIntent }: {
  topic: TopicNode; onClose: () => void; onSend: (e: FormEvent) => void;
  busy: boolean; message: string; setMessage: (v: string) => void;
  intent: IntentWave; setIntent: (v: IntentWave) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 p-3 md:p-10" onClick={onClose}>
      <motion.div initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} onClick={e=>e.stopPropagation()} className="ml-auto flex h-full w-full max-w-xl flex-col glass-strong rounded-3xl">
        <div className="flex items-center justify-between border-b border-white/5 p-4"><div><div className="text-xs text-pulse-300">DISCUSSION</div><h2 className="font-display text-xl font-semibold">{topic.title}</h2></div><button className="icon-btn" onClick={onClose}><X/></button></div>
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-sm text-ink-300">{topic.summary}</p>
          <div className="mt-5 space-y-4">{topic.messages.map(m=><div key={m.id} className="flex gap-3"><div className="avatar">{m.avatar}</div><div><div className="text-xs font-semibold">{m.author} <span className="ml-2 text-ink-500">{m.time}</span></div><p className="mt-1 text-sm text-ink-300">{m.text}</p><span className="mt-1 inline-block text-[10px] text-pulse-300">{intentLabels[m.intent]}</span></div></div>)}</div>
        </div>
        <form onSubmit={onSend} className="border-t border-white/5 p-3">
          <div className="mb-2 flex gap-2">{(['whisper','standard','pulse'] as IntentWave[]).map(x=><button type="button" key={x} onClick={()=>setIntent(x)} className={`rounded-lg border px-2 py-1 text-[10px] ${intent===x?'border-pulse-500/50 bg-pulse-500/10 text-pulse-300':'border-white/5 text-ink-500'}`}>{intentLabels[x]}</button>)}</div>
          <div className="flex gap-2"><input value={message} onChange={e=>setMessage(e.target.value)} placeholder="Write a message…" className="field flex-1"/><button disabled={busy} className="icon-btn bg-pulse-500/20 text-pulse-300 disabled:opacity-30"><Send/></button></div>
        </form>
      </motion.div>
    </div>
  );
}

const bottomNavItems: { id: AppView; icon: typeof Home }[] = [
  { id: 'dashboard', icon: Home },
  { id: 'discussions', icon: MessageCircle },
  { id: 'decisions', icon: LayoutGrid },
  { id: 'pulse-ai', icon: Sparkles },
];

function AppShell() {
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<{ id: string; name: string; memberCount: number } | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceListItem[]>([]);
  const [topics, setTopics] = useState<TopicNode[]>(demoTopics);
  const [polls, setPolls] = useState<ActivePoll[]>(demoPolls);
  const [decisions, setDecisions] = useState<DecisionSummary[]>(demoDecisionSummaries());
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);
  const [myOpenActionCount, setMyOpenActionCount] = useState(0);
  const [riskCount, setRiskCount] = useState(0);
  const [dashboard, setDashboard] = useState<DashboardData>({ waitingForYou: [], decidedByYou: [], upcomingDeadlines: [], teamActivity: [] });

  const [view, setView] = useState<AppView>('dashboard');
  const [navOpen, setNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [showNewDecision, setShowNewDecision] = useState(false);
  const [showNewWorkspace, setShowNewWorkspace] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [activeDecisionId, setActiveDecisionId] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<TopicNode | null>(null);
  const [message, setMessage] = useState('');
  const [intent, setIntent] = useState<IntentWave>('standard');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refreshWorkspaceData = useCallback(async (workspaceId: string) => {
    const [wsData, decisionRows, invites, myActions, risks] = await Promise.all([
      loadWorkspaceData(workspaceId), listDecisions(workspaceId), listWorkspaceInvites(workspaceId),
      user ? listActions(workspaceId) : Promise.resolve([]),
      computeRisks(workspaceId),
    ]);
    if (wsData) { setTopics(wsData.topics); setPolls(wsData.polls); }
    setDecisions(decisionRows);
    setPendingInviteCount(invites.filter((i) => i.status === 'pending').length);
    setMyOpenActionCount(myActions.filter((a) => a.status !== 'done' && a.ownerId === user?.id).length);
    setRiskCount(risks.length);
    if (user) setDashboard(await loadDashboardData(workspaceId, user.id));
  }, [user]);

  const loadWorkspaceById = useCallback(async (workspaceId: string) => {
    const ws = await getWorkspaceById(workspaceId);
    setWorkspace(ws);
    if (!ws) return;
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, ws.id);
    const m = await listWorkspaceMembers(ws.id);
    setMembers(m);
    await refreshWorkspaceData(ws.id);
  }, [refreshWorkspaceData]);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;
    listMyWorkspaces(user.id).then(async (list) => {
      setWorkspaces(list);
      if (list.length === 0) return;
      const remembered = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
      const target = list.find((w) => w.id === remembered) ?? list[0];
      await loadWorkspaceById(target.id);
    }).catch((e) => setError(e instanceof Error ? e.message : 'Could not load workspace'));
  }, [user, loadWorkspaceById]);

  useEffect(() => {
    if (!supabase || !workspace) return;
    const client = supabase;
    const channel = client.channel(`workspace:${workspace.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => refreshWorkspaceData(workspace.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'decisions' }, () => refreshWorkspaceData(workspace.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'decision_history' }, () => refreshWorkspaceData(workspace.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, () => refreshWorkspaceData(workspace.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, () => refreshWorkspaceData(workspace.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'actions' }, () => refreshWorkspaceData(workspace.id))
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [workspace, refreshWorkspaceData]);

  const openDecision = (id: string) => {
    if (!isSupabaseConfigured) { setNotice('Connect Supabase to open the full Decision Room — this is demo data.'); return; }
    setActiveDecisionId(id);
  };

  const switchWorkspace = async (id: string) => { setView('dashboard'); await loadWorkspaceById(id); };
  const handleWorkspaceCreated = async (ws: { id: string; name: string }) => {
    setShowNewWorkspace(false);
    if (user) setWorkspaces(await listMyWorkspaces(user.id));
    await loadWorkspaceById(ws.id);
  };

  // Real, working keyboard shortcuts: N = new decision, / = search, ? = shortcuts panel, Esc = close top overlay.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (e.key === 'Escape') {
        if (showShortcuts) setShowShortcuts(false);
        else if (globalSearchOpen) setGlobalSearchOpen(false);
        else if (activeDecisionId) setActiveDecisionId(null);
        else if (showNewDecision) setShowNewDecision(false);
        else if (showNewWorkspace) setShowNewWorkspace(false);
        else if (selectedTopic) setSelectedTopic(null);
        else if (navOpen) setNavOpen(false);
        return;
      }
      if (typing) return;
      if (e.key === 'n' || e.key === 'N') setShowNewDecision(true);
      if (e.key === '?') setShowShortcuts((v) => !v);
      if (e.key === '/') { e.preventDefault(); setGlobalSearchOpen(true); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showShortcuts, globalSearchOpen, activeDecisionId, showNewDecision, showNewWorkspace, selectedTopic, navOpen]);

  const submitTopicMessage = async (e: FormEvent) => {
    e.preventDefault(); if (!message.trim() || !selectedTopic || !user || !workspace) return;
    setBusy(true); setError('');
    try { await sendMessage(selectedTopic.id, user.id, message.trim(), intent); setMessage(''); await refreshWorkspaceData(workspace.id); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not send message'); }
    finally { setBusy(false); }
  };

  const handleComposerSend = async (text: string) => {
    if (!workspace || !user) { setNotice('Connect Supabase and sign in to send real messages — this is demo data.'); return; }
    const target = topics[0];
    if (!target) return;
    try { await sendMessage(target.id, user.id, text, 'standard'); await refreshWorkspaceData(workspace.id); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not send message'); }
  };

  const badges = { actions: myOpenActionCount, risks: riskCount, notifications: dashboard.teamActivity.length, invitations: pendingInviteCount };
  const isAdmin = members.some((m) => m.userId === user?.id && (m.role === 'owner' || m.role === 'admin'));
  const workspaceRole = members.find((m) => m.userId === user?.id)?.role ?? 'member';
  const greetingName = (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? 'there';

  return (
    <div className="flex min-h-screen text-ink-50">
      <Sidebar
        view={view}
        onNavigate={setView}
        workspaceName={workspace?.name ?? 'Demo workspace'}
        workspaceRole={workspaceRole}
        workspaces={workspaces}
        activeWorkspaceId={workspace?.id ?? null}
        onSwitchWorkspace={switchWorkspace}
        onCreateWorkspace={() => setShowNewWorkspace(true)}
        badges={badges}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        onOpenShortcuts={() => setShowShortcuts(true)}
      />

      <div className="relative min-h-screen flex-1 overflow-x-hidden pb-24 lg:pb-8">
        <div className="lg:hidden">
          <HomeHeader
            memberCount={workspace?.memberCount ?? 128}
            isLive={Boolean(workspace)}
            activity={dashboard.teamActivity}
            searchOpen={globalSearchOpen}
            onToggleSearch={() => setGlobalSearchOpen((v) => !v)}
            onOpenNav={() => setNavOpen(true)}
          />
        </div>

        <div className="mx-auto max-w-2xl px-4 lg:hidden">
          {error && <div className="mb-3 rounded-xl border border-ember-500/30 bg-ember-500/10 p-3 text-xs text-ember-300">{error}</div>}
          {notice && <div className="mb-3 rounded-xl border border-alert-500/30 bg-alert-500/10 p-3 text-xs text-alert-300">{notice}</div>}
          {!workspace && isSupabaseConfigured && (
            <div className="mb-3 rounded-xl border border-alert-500/30 bg-alert-500/10 p-4 text-sm text-alert-300">Your account is authenticated, but it has no workspace yet.</div>
          )}
        </div>
        <div className="mx-auto hidden max-w-2xl px-4 pt-5 lg:block">
          {error && <div className="mb-3 rounded-xl border border-ember-500/30 bg-ember-500/10 p-3 text-xs text-ember-300">{error}</div>}
          {notice && <div className="mb-3 rounded-xl border border-alert-500/30 bg-alert-500/10 p-3 text-xs text-alert-300">{notice}</div>}
        </div>

        {view === 'dashboard' && (
          <DashboardView
            greetingName={greetingName}
            topics={topics}
            polls={polls}
            decisions={decisions}
            resources={demoResources}
            data={dashboard}
            onOpenDecision={openDecision}
            onViewAllDecisions={() => setView('decisions')}
            onVoteNow={() => setView('polls')}
            onOpenResourceHub={() => setView('resources')}
          />
        )}
        {view === 'discussions' && <DiscussionsView topics={topics} decisions={decisions} onSelectTopic={setSelectedTopic} />}
        {view === 'decisions' && workspace && <DecisionsListView workspaceId={workspace.id} decisions={decisions} onOpen={openDecision} onNew={() => setShowNewDecision(true)} />}
        {view === 'decisions' && !workspace && <DecisionsListView workspaceId="demo" decisions={decisions} onOpen={openDecision} onNew={() => setShowNewDecision(true)} />}
        {view === 'polls' && workspace && <PollsView workspaceId={workspace.id} polls={polls} onRefresh={() => refreshWorkspaceData(workspace.id)} />}
        {view === 'polls' && !workspace && <ComingSoonView icon={Sparkles} phase="Connect Supabase" title="Polls need a workspace" description="Sign in and create a workspace to create and vote on real polls." />}
        {view === 'resources' && workspace && <ResourcesView workspaceId={workspace.id} />}
        {view === 'resources' && !workspace && <ComingSoonView icon={FolderOpen} phase="Connect Supabase" title="Resources need a workspace" description="Sign in and create a workspace to store real resources." />}
        {view === 'actions' && workspace && <ActionsView workspaceId={workspace.id} members={members} />}
        {view === 'actions' && !workspace && <ComingSoonView icon={Sparkles} phase="Connect Supabase" title="Actions need a workspace" description="Sign in and create a workspace to create and track real actions." />}
        {view === 'pulse-ai' && workspace && <PulseAIView workspaceId={workspace.id} />}
        {view === 'pulse-ai' && !workspace && <ComingSoonView icon={Sparkles} phase="Connect Supabase" title="PULSE AI needs a workspace" description="Sign in and create a workspace, then deploy the pulse-assistant function." />}
        {view === 'risks' && workspace && <RiskCenterView workspaceId={workspace.id} />}
        {view === 'risks' && !workspace && <ComingSoonView icon={Sparkles} phase="Connect Supabase" title="Risk Center needs a workspace" description="Risk detection runs against your real discussions, votes, and actions." />}
        {view === 'analytics' && workspace && <AnalyticsView workspaceId={workspace.id} />}
        {view === 'analytics' && !workspace && <ComingSoonView icon={Sparkles} phase="Connect Supabase" title="Analytics needs a workspace" description="Every number here is computed from your real workspace activity." />}
        {view === 'meeting-summaries' && workspace && <MeetingSummariesView workspaceId={workspace.id} />}
        {view === 'meeting-summaries' && !workspace && <ComingSoonView icon={Sparkles} phase="Connect Supabase" title="Meeting Summaries need a workspace" description="Sign in and create a workspace, then deploy the meeting-summary function." />}
        {view === 'team' && workspace && <TeamView workspaceId={workspace.id} />}
        {view === 'notifications' && <NotificationsView activity={dashboard.teamActivity} />}
        {view === 'invitations' && workspace && <InvitationsView workspaceId={workspace.id} />}
        {view === 'audit-log' && workspace && <AuditLogView workspaceId={workspace.id} />}
        {view === 'audit-log' && !workspace && <ComingSoonView icon={Sparkles} phase="Connect Supabase" title="Audit Log needs a workspace" description="Every role change, invite, and decision outcome is logged automatically once you're connected." />}
        {view === 'settings' && workspace && <SettingsView workspaceId={workspace.id} workspaceName={workspace.name} workspaceRole={workspaceRole} isAdmin={isAdmin} />}
        {view === 'integrations' && workspace && <IntegrationsView workspaceId={workspace.id} isAdmin={isAdmin} />}
        {view === 'integrations' && !workspace && <ComingSoonView icon={Sparkles} phase="Connect Supabase" title="Integrations need a workspace" description="Connect Slack and the rest once you're signed into a real workspace." />}
        {view === 'help' && <HelpView onOpenShortcuts={() => setShowShortcuts(true)} />}

        {view === 'discussions' && <MessageComposer onSend={handleComposerSend} onPlus={() => setShowNewDecision(true)} />}
      </div>

      <nav className="fixed bottom-3 left-1/2 z-40 flex -translate-x-1/2 gap-1 rounded-2xl glass-strong p-1.5 shadow-card lg:hidden">
        {bottomNavItems.map(({ id, icon: Icon }) => (
          <button key={id} onClick={() => setView(id)} className={`nav-btn ${view === id ? 'active' : ''}`}><Icon /></button>
        ))}
      </nav>

      <NavDrawer
        open={navOpen}
        view={view}
        workspaceName={workspace?.name ?? 'Demo workspace'}
        badges={badges}
        onClose={() => setNavOpen(false)}
        onNavigate={setView}
      />

      <GlobalSearchModal open={globalSearchOpen} workspaceId={workspace?.id ?? null} onClose={() => setGlobalSearchOpen(false)} onNavigate={setView} />

      <AnimatePresence>
        {selectedTopic && (
          <DiscussionDrawer
            topic={selectedTopic}
            onClose={() => setSelectedTopic(null)}
            onSend={submitTopicMessage}
            busy={busy}
            message={message}
            setMessage={setMessage}
            intent={intent}
            setIntent={setIntent}
          />
        )}
      </AnimatePresence>

      <NewDecisionModal
        open={showNewDecision}
        members={members}
        currentUserId={user?.id ?? ''}
        onClose={() => setShowNewDecision(false)}
        onCreate={async (input) => {
          if (!workspace || !user) { setNotice('Connect Supabase and sign in to create real decisions — this is demo data.'); return; }
          await createDecision({ workspaceId: workspace.id, ...input }, user.id);
          await refreshWorkspaceData(workspace.id);
        }}
      />

      <NewWorkspaceModal open={showNewWorkspace} onClose={() => setShowNewWorkspace(false)} onCreated={handleWorkspaceCreated} />

      {activeDecisionId && (
        <DecisionRoom
          decisionId={activeDecisionId}
          members={members}
          isAdmin={isAdmin}
          onClose={() => { setActiveDecisionId(null); if (workspace) refreshWorkspaceData(workspace.id); }}
        />
      )}

      <KeyboardShortcutsModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  );
}

function AppInner() {
  const { loading, user } = useAuth();
  const [setup, setSetup] = useState(false);
  const [checkingWorkspace, setCheckingWorkspace] = useState(true);
  useEffect(() => {
    let active = true;
    if (!user || !isSupabaseConfigured) { setCheckingWorkspace(false); return; }
    getCurrentWorkspace(user.id).then(ws => { if (active) { setSetup(!ws); setCheckingWorkspace(false); } }).catch(() => { if (active) setCheckingWorkspace(false); });
    return () => { active = false; };
  }, [user]);
  if (loading || (user && isSupabaseConfigured && checkingWorkspace)) return <div className="min-h-screen grid place-items-center text-ink-400">Loading PULSE…</div>;
  if (!user) return <AuthScreen />;
  if (setup) return <WorkspaceSetup onCreated={() => setSetup(false)} />;
  return <AppShell />;
}

export default function App() { return <AuthProvider><AppInner /></AuthProvider>; }
