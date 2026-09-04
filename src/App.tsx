import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity, Bell, Bot, ChevronRight, Clock, Database, Feather, FolderOpen,
  Hash, LogIn, MessageSquare, Plus, Search, Send, Settings, Sparkles, Users,
  Vote, X, Zap,
} from 'lucide-react';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { activePolls as demoPolls, pinnedDecisions as demoDecisions, topicNodes as demoTopics } from '@/data';
import { getCurrentWorkspace, loadWorkspaceData, createDiscussion, sendMessage, createWorkspace, listWorkspaceMembers, listWorkspaceInvites, inviteToWorkspace, updateWorkspaceMemberRole, removeWorkspaceMember, type WorkspaceMember, type WorkspaceInvite, type WorkspaceRole } from '@/lib/pulseApi';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { ActivePoll, IntentWave, PinnedDecision, TopicNode } from '@/types';

const intentLabels: Record<IntentWave, string> = { whisper: 'Whisper', standard: 'Standard', pulse: 'Pulse Alert' };
const statusStyles = {
  decided: 'text-flux-400 border-flux-500/30 bg-flux-500/10',
  'in-review': 'text-alert-400 border-alert-500/30 bg-alert-500/10',
  revisiting: 'text-ember-400 border-ember-500/30 bg-ember-500/10',
};

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
      <div className="flex items-center gap-3 mb-8"><div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-pulse-400 to-pulse-600 grid place-items-center shadow-glow"><Activity className="text-white" /></div><div><div className="font-display text-2xl font-bold">PULSE</div><div className="text-[10px] uppercase tracking-[.25em] text-ink-500">Decision OS</div></div></div>
      <h1 className="font-display text-2xl font-semibold">{mode === 'login' ? 'Welcome back.' : 'Create your workspace account.'}</h1>
      <p className="mt-2 text-sm text-ink-400">{configured ? 'Sign in to your real PULSE workspace.' : 'The interface is ready. Connect Supabase to enable real accounts.'}</p>
      {!configured && <div className="mt-4 rounded-xl border border-alert-500/30 bg-alert-500/10 p-3 text-xs text-alert-300">Supabase is not configured. Add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before production.</div>}
      <form onSubmit={submit} className="mt-6 space-y-3">
        {mode === 'signup' && <input required value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" className="field" />}
        <input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" className="field" />
        <input required minLength={8} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password (8+ characters)" className="field" />
        {error && <div className="text-sm text-ember-400">{error}</div>}{notice && <div className="text-sm text-flux-400">{notice}</div>}
        <button disabled={busy || !configured} className="w-full rounded-xl bg-gradient-to-r from-pulse-500 to-flux-500 py-3 font-semibold text-white disabled:opacity-40">{busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
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
  return <div className="min-h-screen px-5 py-10 grid place-items-center"><form onSubmit={submit} className="w-full max-w-md glass-strong rounded-3xl p-6"><div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-pulse-400 to-flux-500 grid place-items-center shadow-glow"><Users className="text-white"/></div><h1 className="mt-5 font-display text-2xl font-semibold">Create your workspace</h1><p className="mt-2 text-sm text-ink-400">This is your company or team space. You can invite people after the foundation is connected.</p><input required value={name} onChange={e=>setName(e.target.value)} placeholder="Company or workspace name" className="field mt-6"/><p className="mt-2 text-xs text-ink-500">Example: Acme Product Team</p>{error && <p className="mt-3 text-sm text-ember-400">{error}</p>}<button disabled={busy} className="primary-btn mt-5 w-full justify-center disabled:opacity-40">{busy?'Creating…':'Create workspace'}</button></form></div>;
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

  const refresh = async () => {
    const [m, i] = await Promise.all([listWorkspaceMembers(workspaceId), listWorkspaceInvites(workspaceId)]);
    setMembers(m); setInvites(i);
  };
  useEffect(() => { refresh().catch(e => setError(e instanceof Error ? e.message : 'Could not load team')); }, [workspaceId]);

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

function Dashboard() {
  const { user, signOut } = useAuth();
  const [topics, setTopics] = useState<TopicNode[]>(demoTopics);
  const [decisions, setDecisions] = useState<PinnedDecision[]>(demoDecisions);
  const [polls, setPolls] = useState<ActivePoll[]>(demoPolls);
  const [workspace, setWorkspace] = useState<{id:string;name:string;memberCount:number}|null>(null);
  const [selected, setSelected] = useState<TopicNode | null>(null);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [intent, setIntent] = useState<IntentWave>('standard');
  const [newDiscussion, setNewDiscussion] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;
    getCurrentWorkspace(user.id).then(async ws => {
      setWorkspace(ws);
      if (!ws) return;
      const data = await loadWorkspaceData(ws.id);
      if (data) { setTopics(data.topics); setDecisions(data.decisions); setPolls(data.polls); }
    }).catch(e => setError(e.message));
  }, [user]);

  useEffect(() => {
    if (!supabase || !workspace) return;
    const client = supabase;
    const channel = client.channel(`workspace:${workspace.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, async () => {
        const data = await loadWorkspaceData(workspace.id); if (data) { setTopics(data.topics); setDecisions(data.decisions); setPolls(data.polls); }
      }).subscribe();
    return () => { client.removeChannel(channel); };
  }, [workspace]);

  const filteredTopics = useMemo(() => topics.filter(t => `${t.title} ${t.summary} ${t.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())), [topics, query]);

  const submitMessage = async (e: FormEvent) => {
    e.preventDefault(); if (!message.trim() || !selected || !user || !workspace) return;
    setBusy(true); setError('');
    try { await sendMessage(selected.id, user.id, message.trim(), intent); setMessage(''); const data=await loadWorkspaceData(workspace.id); if(data) setTopics(data.topics); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not send message'); }
    finally { setBusy(false); }
  };

  const submitDiscussion = async (e: FormEvent) => {
    e.preventDefault(); if (!workspace || !newTitle.trim()) return;
    setBusy(true); setError('');
    try { await createDiscussion(workspace.id, newTitle.trim(), newSummary.trim()); const data=await loadWorkspaceData(workspace.id); if(data) setTopics(data.topics); setNewTitle(''); setNewSummary(''); setNewDiscussion(false); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not create discussion'); }
    finally { setBusy(false); }
  };

  return <div className="min-h-screen">
    <header className="sticky top-0 z-30 glass-strong border-b border-white/5">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-xl bg-gradient-to-br from-pulse-400 to-pulse-600 grid place-items-center shadow-glow"><Activity className="text-white" /></div><div><div className="font-display text-lg font-bold">PULSE</div><div className="text-[9px] uppercase tracking-[.25em] text-ink-500">Decision OS</div></div></div>
        <div className="hidden md:flex items-center gap-3 text-xs text-ink-400"><span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-flux-400"/>Live</span><span>{workspace?.name ?? 'Demo Workspace'}</span><span>{workspace?.memberCount ?? 24} members</span></div>
        <div className="flex items-center gap-2"><button className="icon-btn"><Search/></button><button className="icon-btn"><Bell/></button><button onClick={()=>setShowTeam(true)} className="icon-btn" title="Team"><Users/></button><button onClick={signOut} className="avatar">{(user?.email?.[0] ?? 'A').toUpperCase()}</button></div>
      </div>
    </header>

    <main className="mx-auto max-w-6xl px-4 py-6 pb-20">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between"><div><p className="text-xs uppercase tracking-[.25em] text-pulse-300">{workspace?.name ?? 'Demo workspace'}</p><h1 className="mt-2 font-display text-3xl font-semibold">Good evening, {user?.user_metadata?.full_name?.split(' ')[0] ?? 'Alex'}.</h1><p className="mt-2 max-w-xl text-sm text-ink-400">Here's what changed across your team since you last checked in.</p></div><button onClick={()=>setNewDiscussion(true)} className="primary-btn"><Plus/> New discussion</button></div>

      {error && <div className="mt-5 rounded-xl border border-ember-500/30 bg-ember-500/10 p-3 text-sm text-ember-300">{error}</div>}
      {!workspace && isSupabaseConfigured && <div className="mt-5 rounded-xl border border-alert-500/30 bg-alert-500/10 p-4 text-sm text-alert-300">Your account is authenticated, but it has no workspace yet. We will add the workspace creation flow next.</div>}

      <section className="mt-6 glass rounded-3xl p-4 md:p-5">
        <div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="h-11 w-11 rounded-2xl bg-flux-500/10 grid place-items-center"><Activity className="text-flux-300"/></div><div><h2 className="font-display text-lg font-semibold">Living State Ledger</h2><p className="text-xs text-ink-400">The live operating picture for your workspace</p></div></div><span className="status-live">● Live</span></div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <Ledger title="PINNED DECISIONS" icon={<Zap/>}>{decisions.slice(0,3).map(d=><div key={d.id} className="mini-card"><div className="flex items-start justify-between gap-2"><b>{d.title}</b><span className={`badge ${statusStyles[d.status]}`}>{d.status}</span></div><p>{d.summary}</p></div>)}</Ledger>
          <Ledger title="ACTIVE POLLS" icon={<Vote/>}>{polls.slice(0,2).map(p=><div key={p.id} className="mini-card"><b>{p.question}</b><div className="mt-3 h-1.5 rounded-full bg-white/5"><div className="h-full w-2/3 rounded-full bg-gradient-to-r from-pulse-400 to-flux-400"/></div><p className="mt-2">{p.totalVotes} votes · {p.timeLeft}</p></div>)}</Ledger>
          <Ledger title="RESOURCES" icon={<FolderOpen/>}><div className="space-y-2">{['Project Brief','Roadmap','Brand Assets','Research'].map(x=><div key={x} className="flex items-center gap-2 rounded-xl bg-white/[.025] p-3 text-sm"><FolderOpen className="h-4 w-4 text-pulse-300"/>{x}<ChevronRight className="ml-auto h-4 w-4 text-ink-500"/></div>)}</div></Ledger>
        </div>
      </section>

      <section className="mt-7"><div className="flex items-center justify-between gap-3"><div><h2 className="font-display text-lg font-semibold">Active discussions</h2><p className="text-xs text-ink-500">{filteredTopics.length} threads</p></div><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-500"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search discussions" className="field w-52 pl-9"/></div></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">{filteredTopics.map((node,i)=><motion.button key={node.id} onClick={()=>setSelected(node)} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:i*.05}} className="glass rounded-2xl p-4 text-left hover:border-pulse-500/30"><div className="flex items-start gap-3"><div className="h-10 w-10 shrink-0 rounded-xl bg-pulse-500/10 grid place-items-center"><MessageSquare className="h-4 w-4 text-pulse-300"/></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h3 className="font-display font-semibold truncate">{node.title}</h3><span className="text-[10px] text-ink-500">{node.lastActive}</span></div><p className="mt-1 text-sm text-ink-400 line-clamp-2">{node.summary}</p><div className="mt-3 flex gap-3 text-[10px] text-ink-500"><span>{node.metric[0].value} decisions</span><span>{node.metric[2].value} messages</span><span>{node.participants || '—'} members</span></div></div></div></motion.button>)}</div>
      </section>

      <div className="mt-7 grid gap-3 md:grid-cols-3"><div className="glass rounded-2xl p-4"><Sparkles className="text-pulse-300"/><h3 className="mt-3 font-semibold">AI Insights</h3><p className="mt-1 text-xs text-ink-400">Summaries, unresolved decisions and action items will be generated from your real workspace data.</p></div><div className="glass rounded-2xl p-4"><Users className="text-flux-300"/><h3 className="mt-3 font-semibold">Team presence</h3><p className="mt-1 text-xs text-ink-400">Realtime online status and collaboration signals are ready for the Supabase realtime layer.</p></div><div className="glass rounded-2xl p-4"><Database className="text-alert-300"/><h3 className="mt-3 font-semibold">Production backend</h3><p className="mt-1 text-xs text-ink-400">RLS policies isolate every company's workspace data.</p></div></div>
    </main>

    <AnimatePresence>{selected && <div className="fixed inset-0 z-50 bg-black/60 p-3 md:p-10" onClick={()=>setSelected(null)}><motion.div initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} onClick={e=>e.stopPropagation()} className="ml-auto flex h-full w-full max-w-xl flex-col glass-strong rounded-3xl"><div className="flex items-center justify-between border-b border-white/5 p-4"><div><div className="text-xs text-pulse-300">DISCUSSION</div><h2 className="font-display text-xl font-semibold">{selected.title}</h2></div><button className="icon-btn" onClick={()=>setSelected(null)}><X/></button></div><div className="flex-1 overflow-y-auto p-4"><p className="text-sm text-ink-300">{selected.summary}</p><div className="mt-5 space-y-4">{selected.messages.map(m=><div key={m.id} className="flex gap-3"><div className="avatar">{m.avatar}</div><div><div className="text-xs font-semibold">{m.author} <span className="ml-2 text-ink-500">{m.time}</span></div><p className="mt-1 text-sm text-ink-300">{m.text}</p><span className="mt-1 inline-block text-[10px] text-pulse-300">{intentLabels[m.intent]}</span></div></div>)}</div></div><form onSubmit={submitMessage} className="border-t border-white/5 p-3"><div className="mb-2 flex gap-2">{(['whisper','standard','pulse'] as IntentWave[]).map(x=><button type="button" key={x} onClick={()=>setIntent(x)} className={`rounded-lg border px-2 py-1 text-[10px] ${intent===x?'border-pulse-500/50 bg-pulse-500/10 text-pulse-300':'border-white/5 text-ink-500'}`}>{intentLabels[x]}</button>)}</div><div className="flex gap-2"><input value={message} onChange={e=>setMessage(e.target.value)} placeholder="Write a message…" className="field flex-1"/><button disabled={busy || !workspace} className="icon-btn bg-pulse-500/20 text-pulse-300 disabled:opacity-30"><Send/></button></div></form></motion.div></div>}</AnimatePresence>
    <AnimatePresence>{newDiscussion && <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"><motion.form onSubmit={submitDiscussion} initial={{opacity:0,scale:.96}} animate={{opacity:1,scale:1}} className="glass-strong w-full max-w-md rounded-3xl p-5"><div className="flex items-center justify-between"><h2 className="font-display text-xl font-semibold">New discussion</h2><button type="button" className="icon-btn" onClick={()=>setNewDiscussion(false)}><X/></button></div><input required value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Discussion title" className="field mt-5"/><textarea value={newSummary} onChange={e=>setNewSummary(e.target.value)} placeholder="What are you deciding?" className="field mt-3 min-h-28 resize-none"/><button disabled={busy || !workspace} className="primary-btn mt-3 w-full justify-center disabled:opacity-30">{busy?'Creating…':'Create discussion'}</button></motion.form></div>}</AnimatePresence>
    {showTeam && workspace && <TeamPanel workspaceId={workspace.id} onClose={()=>setShowTeam(false)} />}
    <nav className="fixed bottom-3 left-1/2 z-40 flex -translate-x-1/2 gap-1 rounded-2xl glass-strong p-1.5 shadow-card md:hidden"><button className="nav-btn active"><Activity/></button><button className="nav-btn"><MessageSquare/></button><button className="nav-btn"><Vote/></button><button className="nav-btn"><FolderOpen/></button><button className="nav-btn"><Bot/></button></nav>
  </div>;
}

function Ledger({title,icon,children}:{title:string;icon:React.ReactNode;children:React.ReactNode}) { return <div className="rounded-2xl border border-white/5 bg-ink-900/30 p-3"><div className="flex items-center gap-2 px-1 text-[10px] font-semibold tracking-[.18em] text-ink-400">{icon}{title}</div><div className="mt-3 space-y-2">{children}</div></div>; }

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
  return <Dashboard />;
}

export default function App() { return <AuthProvider><AppInner /></AuthProvider>; }
