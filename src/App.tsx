import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity, Bot, FolderOpen, Send, Users, Vote, X,
} from 'lucide-react';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { activePolls as demoPolls, topicNodes as demoTopics } from '@/data';
import {
  getCurrentWorkspace, loadWorkspaceData, sendMessage, createWorkspace,
  listWorkspaceMembers, listWorkspaceInvites, inviteToWorkspace, updateWorkspaceMemberRole,
  removeWorkspaceMember, listDecisions, createDecision, loadDashboardData,
  type WorkspaceMember, type WorkspaceInvite, type WorkspaceRole, type DashboardData,
} from '@/lib/pulseApi';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { ActivePoll, DecisionSummary, IntentWave, TopicNode } from '@/types';
import { HomeHeader } from '@/components/home/HomeHeader';
import { NavDrawer, type HomeView } from '@/components/home/NavDrawer';
import { LivingStateLedger } from '@/components/home/LivingStateLedger';
import { DiscussionsList } from '@/components/home/DiscussionsList';
import { MessageComposer } from '@/components/home/MessageComposer';
import { DecisionsListView } from '@/components/decisions/DecisionsListView';
import { NewDecisionModal } from '@/components/decisions/NewDecisionModal';
import { DecisionRoom } from '@/components/decisions/DecisionRoom';
import { DashboardView } from '@/components/DashboardView';

const intentLabels: Record<IntentWave, string> = { whisper: 'Whisper', standard: 'Standard', pulse: 'Pulse Alert' };

const demoResources = [
  { name: 'Project Brief', icon: FolderOpen },
  { name: 'Roadmap', icon: FolderOpen },
  { name: 'Resources', icon: FolderOpen },
];

/** Fills the Ledger/Decisions views with something to look at before Supabase is configured. */
function demoDecisionSummaries(): DecisionSummary[] {
  return [
    { id: 'demo-1', workspaceId: 'demo', title: 'Brand Identity', description: 'Locking the wordmark-only direction.', status: 'decided', outcome: 'approved', deadline: null, ownerId: null, ownerName: 'Sarah Chen', createdBy: 'demo', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), decidedAt: new Date().toISOString() },
    { id: 'demo-2', workspaceId: 'demo', title: 'Launch Strategy', description: 'Q3 soft launch timeline and channels.', status: 'in-review', outcome: null, deadline: null, ownerId: null, ownerName: 'Marcus Lee', createdBy: 'demo', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), decidedAt: null },
    { id: 'demo-3', workspaceId: 'demo', title: 'AI Integration', description: 'Recommendation engine rollout.', status: 'in-review', outcome: null, deadline: null, ownerId: null, ownerName: 'Aisha Patel', createdBy: 'demo', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), decidedAt: null },
  ];
}

function AuthScreen() {
  const { signIn, signUp, configured } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setNotice(''); setBusy(true);
    const result = mode === 'login' ? await signIn(email, password) : await signUp(email, password, name);
    if (result.error) setError(result.error);
    else if (mode === 'signup' && result.needsConfirmation) setNotice('Account created. Check your email to confirm your address.');
    setBusy(false);
  };

  return <div className="min-h-screen px-5 py-10 flex items-center justify-center">
    <div className="w-full max-w-md glass-strong rounded-3xl p-6 shadow-card">
      <div className="flex items-center gap-3 mb-8"><div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#06b6d4] grid place-items-center shadow-glow"><Activity className="text-white" /></div><div><div className="font-display text-2xl font-bold">PULSE</div><div className="text-[10px] uppercase tracking-[.25em] text-ink-500">Decision OS</div></div></div>
      <h1 className="font-display text-2xl font-semibold">{mode === 'login' ? 'Welcome back.' : 'Create your workspace account.'}</h1>
      <p className="mt-2 text-sm text-ink-400">{configured ? 'Sign in to your real PULSE workspace.' : 'The interface is ready. Connect Supabase to enable real accounts.'}</p>
      {!configured && <div className="mt-4 rounded-xl border border-alert-500/30 bg-alert-500/10 p-3 text-xs text-alert-300">Supabase is not configured. Add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before production.</div>}
      <form onSubmit={submit} className="mt-6 space-y-3">
        {mode === 'signup' && <input required value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" className="field" />}
        <input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" className="field" />
        <input required minLength={8} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password (8+ characters)" className="field" />
        {error && <div className="text-sm text-ember-400">{error}</div>}{notice && <div className="text-sm text-flux-400">{notice}</div>}
        <button disabled={busy || !configured} className="w-full rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#06b6d4] py-3 font-semibold text-white disabled:opacity-40">{busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
      </form>
      <button onClick={()=>{setMode(mode==='login'?'signup':'login');setError('');setNotice('')}} className="mt-4 w-full text-sm text-pulse-300">{mode === 'login' ? 'Create an account' : 'Already have an account? Sign in'}</button>
    </div>
  </div>;
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

function TeamPanel({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  const { user } = useAuth();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('member');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    const [m, i] = await Promise.all([listWorkspaceMembers(workspaceId), listWorkspaceInvites(workspaceId)]);
    setMembers(m); setInvites(i);
  }, [workspaceId]);
  useEffect(() => { refresh().catch(e => setError(e instanceof Error ? e.message : 'Could not load team')); }, [refresh]);

  const invite = async (e: FormEvent) => {
    e.preventDefault(); if (!email.trim()) return; setBusy(true); setError(''); setNotice('');
    try {
      const result = await inviteToWorkspace(workspaceId, email, role);
      setEmail('');
      setNotice(result.added ? 'Existing PULSE user added to the workspace.' : 'Invitation saved. Email delivery will be connected next.');
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not invite member'); }
    finally { setBusy(false); }
  };

  const changeRole = async (member: WorkspaceMember, next: WorkspaceRole) => {
    if (member.userId === user?.id && member.role === 'owner') return;
    try { await updateWorkspaceMemberRole(workspaceId, member.userId, next); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update role'); }
  };

  const remove = async (member: WorkspaceMember) => {
    if (member.userId === user?.id) return;
    if (!confirm(`Remove ${member.email} from this workspace?`)) return;
    try { await removeWorkspaceMember(workspaceId, member.userId); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not remove member'); }
  };

  return <AnimatePresence><div className="fixed inset-0 z-50 bg-black/70 p-3 md:p-8" onClick={onClose}>
    <motion.div initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} onClick={e=>e.stopPropagation()} className="ml-auto flex h-full w-full max-w-2xl flex-col glass-strong rounded-3xl overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/5 p-5"><div><div className="text-[10px] uppercase tracking-[.2em] text-pulse-300">Workspace</div><h2 className="font-display text-2xl font-semibold">Team & members</h2><p className="mt-1 text-xs text-ink-500">Manage who can access this PULSE workspace.</p></div><button className="icon-btn" onClick={onClose}><X/></button></div>
      <div className="flex-1 overflow-y-auto p-5">
        <form onSubmit={invite} className="rounded-2xl border border-pulse-500/20 bg-pulse-500/5 p-4"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-pulse-300"/><b className="text-sm">Invite a teammate</b></div><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="teammate@email.com" className="field flex-1"/><select value={role} onChange={e=>setRole(e.target.value as WorkspaceRole)} className="field sm:w-32"><option value="member">Member</option><option value="admin">Admin</option></select><button disabled={busy} className="primary-btn justify-center disabled:opacity-40">{busy?'Adding…':'Invite'}</button></div></form>
        {error && <p className="mt-3 text-sm text-ember-400">{error}</p>}{notice && <p className="mt-3 text-sm text-flux-400">{notice}</p>}
        <div className="mt-6 flex items-center justify-between"><h3 className="font-semibold">Members <span className="text-xs text-ink-500">{members.length}</span></h3><span className="text-[10px] uppercase tracking-widest text-ink-500">Live workspace access</span></div>
        <div className="mt-3 space-y-2">{members.map(m=><div key={m.userId} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[.02] p-3"><div className="avatar">{m.name.slice(0,1).toUpperCase()}</div><div className="min-w-0 flex-1"><b className="block truncate text-sm">{m.name}</b><span className="block truncate text-xs text-ink-500">{m.email}</span></div>{m.role==='owner' ? <span className="badge text-pulse-300 border-pulse-500/20 bg-pulse-500/10">Owner</span> : <><select value={m.role} onChange={e=>changeRole(m,e.target.value as WorkspaceRole)} className="field w-24 py-2 text-xs"><option value="member">Member</option><option value="admin">Admin</option></select><button onClick={()=>remove(m)} className="icon-btn text-ember-300"><X/></button></>}</div>)}</div>
        {invites.length>0 && <><h3 className="mt-7 font-semibold">Pending invitations</h3><div className="mt-3 space-y-2">{invites.filter(i=>i.status==='pending').map(i=><div key={i.id} className="flex items-center gap-3 rounded-2xl border border-white/5 p-3"><div className="h-8 w-8 rounded-xl bg-alert-500/10 grid place-items-center"><MailIcon/></div><span className="flex-1 truncate text-sm">{i.email}</span><span className="badge text-alert-300 border-alert-500/20 bg-alert-500/10">{i.role}</span></div>)}</div></>}
      </div>
    </motion.div></div></AnimatePresence>;
}

function MailIcon(){ return <span className="text-alert-300 text-xs">@</span>; }

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

function AppShell() {
  const { user, signOut } = useAuth();
  const [workspace, setWorkspace] = useState<{ id: string; name: string; memberCount: number } | null>(null);
  const [topics, setTopics] = useState<TopicNode[]>(demoTopics);
  const [polls, setPolls] = useState<ActivePoll[]>(demoPolls);
  const [decisions, setDecisions] = useState<DecisionSummary[]>(demoDecisionSummaries());
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData>({ waitingForYou: [], decidedByYou: [], upcomingDeadlines: [], teamActivity: [] });

  const [view, setView] = useState<HomeView>('home');
  const [navOpen, setNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showTeam, setShowTeam] = useState(false);
  const [showNewDecision, setShowNewDecision] = useState(false);
  const [activeDecisionId, setActiveDecisionId] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<TopicNode | null>(null);
  const [message, setMessage] = useState('');
  const [intent, setIntent] = useState<IntentWave>('standard');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refreshWorkspaceData = useCallback(async (workspaceId: string) => {
    const [wsData, decisionRows] = await Promise.all([loadWorkspaceData(workspaceId), listDecisions(workspaceId)]);
    if (wsData) { setTopics(wsData.topics); setPolls(wsData.polls); }
    setDecisions(decisionRows);
    if (user) setDashboard(await loadDashboardData(workspaceId, user.id));
  }, [user]);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;
    getCurrentWorkspace(user.id).then(async (ws) => {
      setWorkspace(ws);
      if (!ws) return;
      const m = await listWorkspaceMembers(ws.id);
      setMembers(m);
      await refreshWorkspaceData(ws.id);
    }).catch((e) => setError(e instanceof Error ? e.message : 'Could not load workspace'));
  }, [user, refreshWorkspaceData]);

  useEffect(() => {
    if (!supabase || !workspace) return;
    const client = supabase;
    const channel = client.channel(`workspace:${workspace.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => refreshWorkspaceData(workspace.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'decisions' }, () => refreshWorkspaceData(workspace.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'decision_history' }, () => refreshWorkspaceData(workspace.id))
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [workspace, refreshWorkspaceData]);

  const filteredTopics = useMemo(
    () => topics.filter((t) => `${t.title} ${t.summary} ${t.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())),
    [topics, query]
  );

  const openDecision = (id: string) => {
    if (!isSupabaseConfigured) { setNotice('Connect Supabase to open the full Decision Room — this is demo data.'); return; }
    setActiveDecisionId(id);
  };

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
    try {
      await sendMessage(target.id, user.id, text, 'standard');
      await refreshWorkspaceData(workspace.id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not send message'); }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden pb-24 text-ink-50">
      <div className="mx-auto max-w-md">
        <HomeHeader
          memberCount={workspace?.memberCount ?? 128}
          isLive={Boolean(workspace)}
          activity={dashboard.teamActivity}
          searchOpen={searchOpen}
          onToggleSearch={() => setSearchOpen((v) => !v)}
          onOpenNav={() => setNavOpen(true)}
        />

        {error && <div className="mx-4 mb-3 rounded-xl border border-ember-500/30 bg-ember-500/10 p-3 text-xs text-ember-300">{error}</div>}
        {notice && <div className="mx-4 mb-3 rounded-xl border border-alert-500/30 bg-alert-500/10 p-3 text-xs text-alert-300">{notice}</div>}
        {!workspace && isSupabaseConfigured && (
          <div className="mx-4 mb-3 rounded-xl border border-alert-500/30 bg-alert-500/10 p-4 text-sm text-alert-300">
            Your account is authenticated, but it has no workspace yet.
          </div>
        )}

        {view === 'home' && (
          <>
            <LivingStateLedger
              decisions={decisions}
              polls={polls}
              resources={demoResources}
              onViewAllDecisions={() => setView('decisions')}
              onVoteNow={() => setSelectedTopic(topics[0] ?? null)}
              onOpenResourceHub={() => setView('dashboard')}
            />
            <DiscussionsList
              topics={filteredTopics}
              decisions={decisions}
              searchOpen={searchOpen}
              query={query}
              onQueryChange={setQuery}
              onCloseSearch={() => { setSearchOpen(false); setQuery(''); }}
              onSelectTopic={setSelectedTopic}
            />
          </>
        )}

        {view === 'decisions' && (
          <DecisionsListView decisions={decisions} onOpen={openDecision} onNew={() => setShowNewDecision(true)} />
        )}

        {view === 'dashboard' && (
          <DashboardView data={dashboard} onOpenDecision={openDecision} />
        )}
      </div>

      {view === 'home' && <MessageComposer onSend={handleComposerSend} onPlus={() => setShowNewDecision(true)} />}

      <nav className="fixed bottom-3 left-1/2 z-40 flex -translate-x-1/2 gap-1 rounded-2xl glass-strong p-1.5 shadow-card">
        <button onClick={() => setView('home')} className={`nav-btn ${view==='home'?'active':''}`}><Activity/></button>
        <button onClick={() => setView('decisions')} className={`nav-btn ${view==='decisions'?'active':''}`}><Vote/></button>
        <button onClick={() => setView('dashboard')} className={`nav-btn ${view==='dashboard'?'active':''}`}><FolderOpen/></button>
        <button onClick={signOut} className="nav-btn"><Bot/></button>
      </nav>

      <NavDrawer
        open={navOpen}
        view={view}
        workspaceName={workspace?.name ?? 'Demo workspace'}
        onClose={() => setNavOpen(false)}
        onNavigate={setView}
        onOpenTeam={() => setShowTeam(true)}
      />

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

      {activeDecisionId && (
        <DecisionRoom
          decisionId={activeDecisionId}
          members={members}
          isAdmin={members.some((m) => m.userId === user?.id && (m.role === 'owner' || m.role === 'admin'))}
          onClose={() => { setActiveDecisionId(null); if (workspace) refreshWorkspaceData(workspace.id); }}
        />
      )}

      {showTeam && workspace && <TeamPanel workspaceId={workspace.id} onClose={() => setShowTeam(false)} />}
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
