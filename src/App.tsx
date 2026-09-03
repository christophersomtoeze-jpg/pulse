import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity, ArrowRight, Bell, BarChart3, Bot, Check, ChevronDown, ChevronRight,
  CircleHelp, FileText, FolderOpen, Hash, LayoutDashboard, Menu, MessageCircle,
  MoreHorizontal, Paperclip, Plus, Search, Send, Settings, Sparkles, Users, X,
  Zap, Vote, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { activePolls, pinnedDecisions, quickLinks, topicNodes } from './data';
import type { IntentWave, TopicNode } from './types';

type View = 'overview' | 'discussions' | 'polls' | 'resources' | 'insights';

const nav: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'discussions', label: 'Discussions', icon: MessageCircle },
  { id: 'polls', label: 'Polls', icon: Vote },
  { id: 'resources', label: 'Resources', icon: FolderOpen },
  { id: 'insights', label: 'AI Insights', icon: Sparkles },
];

const avatarPalette = [
  'from-violet-500 to-fuchsia-500',
  'from-cyan-400 to-blue-500',
  'from-emerald-400 to-teal-500',
  'from-amber-400 to-orange-500',
];

function Avatar({ name, index = 0, large = false }: { name: string; index?: number; large?: boolean }) {
  return (
    <div className={`${large ? 'h-10 w-10 text-xs' : 'h-7 w-7 text-[10px]'} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarPalette[index % avatarPalette.length]} font-bold text-white ring-2 ring-ink-950`}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`glass rounded-3xl shadow-card ${className}`}>{children}</div>;
}

function StatusPill({ label, tone = 'cyan' }: { label: string; tone?: 'cyan' | 'green' | 'amber' | 'rose' }) {
  const styles = {
    cyan: 'border-pulse-500/30 bg-pulse-500/10 text-pulse-300',
    green: 'border-flux-500/30 bg-flux-500/10 text-flux-400',
    amber: 'border-alert-500/30 bg-alert-500/10 text-alert-400',
    rose: 'border-ember-500/30 bg-ember-500/10 text-ember-400',
  }[tone];
  return <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${styles}`}>{label}</span>;
}

function Ledger({ onOpen }: { onOpen: (view: View) => void }) {
  return (
    <GlassCard className="overflow-hidden border-pulse-400/20 bg-[radial-gradient(circle_at_10%_0%,rgba(34,211,238,.10),transparent_35%),radial-gradient(circle_at_100%_100%,rgba(124,58,237,.12),transparent_40%)]">
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-pulse-500/10 text-pulse-300 shadow-glow-sm"><Activity size={18}/><span className="absolute inset-0 animate-pulse-ring rounded-xl border border-pulse-400/50" /></div>
          <div><h2 className="font-display text-sm font-semibold">Living State Ledger</h2><p className="text-[11px] text-ink-400">The live operating picture for your workspace</p></div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-flux-500/20 bg-flux-500/10 px-2.5 py-1 text-[10px] font-semibold text-flux-400"><span className="h-1.5 w-1.5 rounded-full bg-flux-400"/>Live</span>
      </div>
      <div className="grid gap-3 p-3 md:grid-cols-3">
        <LedgerColumn title="Pinned decisions" icon={<Zap size={15}/>}>
          {pinnedDecisions.slice(0, 3).map((d) => <button key={d.id} onClick={() => onOpen('discussions')} className="group rounded-2xl border border-white/5 bg-ink-900/70 p-3 text-left transition hover:border-pulse-500/25 hover:bg-white/[.04]"><div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold text-ink-100">{d.title}</span><StatusPill label={d.status === 'decided' ? 'Approved' : d.status === 'in-review' ? 'In progress' : 'Revisiting'} tone={d.status === 'decided' ? 'green' : d.status === 'in-review' ? 'cyan' : 'rose'} /></div><p className="mt-1 line-clamp-1 text-[10px] text-ink-400">{d.summary}</p></button>)}
          <button onClick={() => onOpen('discussions')} className="flex items-center justify-between px-1 pt-1 text-[10px] font-semibold text-pulse-300">View all <ArrowRight size={13}/></button>
        </LedgerColumn>
        <LedgerColumn title="Active polls" icon={<BarChart3 size={15}/>}>
          {activePolls.slice(0, 2).map((p, i) => { const pct = Math.round((p.options[0].votes / p.totalVotes) * 100); return <button key={p.id} onClick={() => onOpen('polls')} className="rounded-2xl border border-white/5 bg-ink-900/70 p-3 text-left"><div className="flex justify-between gap-2"><span className="line-clamp-1 text-xs font-semibold">{p.question}</span><span className="text-[10px] text-ink-400">{p.timeLeft}</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-700"><div className={`h-full rounded-full ${i ? 'w-[46%] bg-pulse-500' : 'bg-violet-400'}`} style={i ? undefined : {width: `${pct}%`}}/></div><div className="mt-2 flex justify-between text-[10px] text-ink-400"><span>{p.totalVotes} votes</span><span>{pct}% leading</span></div></button> })}
          <button onClick={() => onOpen('polls')} className="flex items-center justify-between px-1 pt-1 text-[10px] font-semibold text-pulse-300">Vote now <ArrowRight size={13}/></button>
        </LedgerColumn>
        <LedgerColumn title="Resources" icon={<FolderOpen size={15}/>}>
          {quickLinks.slice(0, 3).map((q) => <button key={q.id} onClick={() => onOpen('resources')} className="flex items-center gap-3 rounded-xl border border-white/5 bg-ink-900/70 px-3 py-2.5 text-left transition hover:bg-white/[.04]"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-pulse-300"><FileText size={14}/></div><span className="flex-1 text-xs font-medium">{q.label}</span><ChevronRight size={13} className="text-ink-500"/></button>)}
          <button onClick={() => onOpen('resources')} className="flex items-center justify-between px-1 pt-1 text-[10px] font-semibold text-pulse-300">Open hub <ArrowRight size={13}/></button>
        </LedgerColumn>
      </div>
    </GlassCard>
  );
}

function LedgerColumn({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-white/5 bg-white/[.015] p-3"><div className="mb-2 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400"><span className="text-pulse-300">{icon}</span>{title}</div><div className="space-y-2">{children}</div></div>;
}

function TopicCard({ node, index, onMessage }: { node: TopicNode; index: number; onMessage: (node: TopicNode) => void }) {
  const [open, setOpen] = useState(index === 0);
  const tone = node.status === 'heating' ? 'rose' : node.status === 'settling' ? 'green' : 'cyan';
  return <motion.div layout className={`glass overflow-hidden rounded-3xl border transition ${open ? 'border-pulse-500/20' : 'border-white/5'}`}>
    <button onClick={() => setOpen(v => !v)} className="w-full p-4 text-left md:p-5">
      <div className="flex gap-3">
        <div className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${node.status === 'heating' ? 'bg-rose-500/10 text-rose-300' : node.status === 'settling' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-pulse-500/10 text-pulse-300'} shadow-glow-sm`}><Hash size={20}/></div>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="font-display text-sm font-semibold md:text-base">{node.title}</h3><StatusPill label={node.status === 'heating' ? 'Heating' : node.status === 'settling' ? 'Settling' : 'Active'} tone={tone}/></div><p className={`mt-1 text-xs leading-relaxed text-ink-400 ${open ? '' : 'line-clamp-2'}`}>{node.summary}</p><div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-ink-500"><span className="flex items-center gap-1"><Users size={12}/>{node.participants} members</span><span className="flex items-center gap-1"><MessageCircle size={12}/>{node.metric.find(m=>m.label==='Messages')?.value} messages</span><span>{node.lastActive}</span></div></div>
        <motion.div animate={{ rotate: open ? 180 : 0 }}><ChevronDown size={18} className="text-ink-500"/></motion.div>
      </div>
    </button>
    <AnimatePresence initial={false}>{open && <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}}><div className="border-t border-white/5 px-4 pb-4 md:px-5 md:pb-5"><div className="space-y-4 rounded-2xl border border-white/5 bg-ink-950/50 p-4">{node.messages.map((m,i)=><div key={m.id} className="flex gap-3"><Avatar name={m.author} index={i}/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold">{m.author}</span><span className="text-[10px] text-ink-500">{m.time}</span>{m.intent==='pulse' && <StatusPill label="Pulse alert" tone="rose"/>}</div><p className="mt-1 text-xs leading-relaxed text-ink-200 md:text-sm">{m.text}</p></div></div>)}</div><button onClick={(e)=>{e.stopPropagation(); onMessage(node)}} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-pulse-500/20 bg-pulse-500/5 py-2.5 text-xs font-semibold text-pulse-300 hover:bg-pulse-500/10"><MessageCircle size={14}/>Open discussion</button></div></motion.div>}</AnimatePresence>
  </motion.div>;
}

function DiscussionView({ onMessage }: { onMessage: (node: TopicNode) => void }) {
  const [query, setQuery] = useState('');
  const filtered = topicNodes.filter(n => `${n.title} ${n.summary} ${n.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  return <section><SectionHeader title="Active discussions" description="Every conversation, decision and signal in one place" action={<button className="button-primary"><Plus size={15}/>New discussion</button>}/><div className="mb-4 flex items-center gap-2 rounded-2xl border border-white/5 bg-white/[.025] px-3 py-2.5"><Search size={15} className="text-ink-500"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search discussions, tags or people..." className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-ink-500"/></div><div className="space-y-3">{filtered.map((node,i)=><TopicCard key={node.id} node={node} index={i} onMessage={onMessage}/>)}</div></section>;
}

function PollsView() {
  const [votes, setVotes] = useState<Record<string, number>>({});
  return <section><SectionHeader title="Polls & decisions" description="Turn opinions into visible, accountable decisions" action={<button className="button-primary"><Plus size={15}/>Create poll</button>}/><div className="grid gap-4 lg:grid-cols-2">{activePolls.map(p=>{const selected=votes[p.id]; return <GlassCard key={p.id} className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-widest text-pulse-300">Active poll</p><h3 className="mt-1 font-display text-lg font-semibold">{p.question}</h3></div><StatusPill label={p.timeLeft}/></div><div className="mt-5 space-y-2">{p.options.map((o,i)=>{const pct=Math.round(o.votes/p.totalVotes*100); const is=selected===i; return <button key={o.label} onClick={()=>setVotes(v=>({...v,[p.id]:i}))} className={`relative w-full overflow-hidden rounded-2xl border p-3 text-left ${is?'border-pulse-400/40 bg-pulse-500/10':'border-white/5 bg-ink-900/60'}`}><div className="absolute inset-y-0 left-0 bg-pulse-500/10" style={{width:`${pct}%`}}/><div className="relative flex justify-between gap-3 text-xs"><span className={is?'text-pulse-200':'text-ink-200'}>{o.label}</span><span className="font-semibold text-ink-400">{pct}%</span></div></button>})}</div><div className="mt-4 flex items-center justify-between text-[10px] text-ink-500"><span>{p.totalVotes} votes</span>{selected!==undefined?<span className="flex items-center gap-1 text-flux-400"><Check size={12}/>Vote recorded in demo mode</span>:<span>Select an option</span>}</div></GlassCard>})}</div></section>;
}

function ResourcesView() {
  const resources = ['Project Brief','Roadmap','Brand Assets','Research','Guidelines','Launch Plan'];
  return <section><SectionHeader title="Resources hub" description="A single source of truth for the files your team needs" action={<button className="button-primary"><Plus size={15}/>Upload</button>}/><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{resources.map((r,i)=><GlassCard key={r} className="group cursor-pointer p-4 transition hover:-translate-y-0.5 hover:border-pulse-500/25"><div className="flex items-center gap-3"><div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${i%3===0?'bg-violet-500/10 text-violet-300':i%3===1?'bg-cyan-500/10 text-cyan-300':'bg-emerald-500/10 text-emerald-300'}`}><FileText size={20}/></div><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">{r}</h3><p className="mt-0.5 text-[10px] text-ink-500">{7+i*3} files · updated today</p></div><MoreHorizontal size={16} className="text-ink-500"/></div></GlassCard>)}</div></section>;
}

function InsightsView() {
  const insights = ['The team is aligned on design direction.','Feature priority is strongest around collaboration and decisions.','AI Integration is on track for the next milestone.'];
  return <section><SectionHeader title="AI insights" description="Pulse turns team activity into useful signals" action={<button className="button-primary"><Bot size={15}/>Ask AI</button>}/><div className="grid gap-4 lg:grid-cols-3"><GlassCard className="lg:col-span-2 p-5"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300"><Sparkles size={19}/></div><div><h3 className="font-display font-semibold">Workspace summary</h3><p className="text-[10px] text-ink-500">Generated from recent activity</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Metric value="24" label="new discussions"/><Metric value="2" label="polls closing soon"/><Metric value="5" label="decisions pending"/><Metric value="12" label="tasks updated"/></div></GlassCard><GlassCard className="p-5"><p className="text-[10px] font-semibold uppercase tracking-widest text-violet-300">Top insights</p><div className="mt-4 space-y-4">{insights.map((x,i)=><div key={x} className="flex gap-3"><span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-[9px] font-bold text-violet-300">{i+1}</span><p className="text-xs leading-relaxed text-ink-200">{x}</p></div>)}</div></GlassCard></div></section>;
}

function Metric({value,label}:{value:string;label:string}) { return <div className="rounded-2xl border border-white/5 bg-ink-900/60 p-4"><div className="font-display text-2xl font-semibold">{value}</div><div className="mt-1 text-[10px] text-ink-500">{label}</div></div>; }
function SectionHeader({title,description,action}:{title:string;description:string;action:React.ReactNode}) { return <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-display text-xl font-semibold md:text-2xl">{title}</h2><p className="mt-1 text-xs text-ink-400">{description}</p></div><div>{action}</div></div>; }

function ChatDrawer({ node, onClose }: { node: TopicNode; onClose: () => void }) {
  const [messages,setMessages]=useState(node.messages);
  const [text,setText]=useState('');
  const [intent,setIntent]=useState<IntentWave>('standard');
  const send=()=>{if(!text.trim())return; setMessages(m=>[...m,{id:crypto.randomUUID(),author:'You',avatar:'YO',text:text.trim(),time:'now',intent}]);setText('')};
  return <motion.div initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-xl flex-col border-l border-white/10 bg-ink-950/95 shadow-2xl backdrop-blur-2xl"><div className="flex items-center justify-between border-b border-white/5 p-4"><div><p className="text-[10px] uppercase tracking-widest text-pulse-300">Discussion</p><h3 className="font-display font-semibold">{node.title}</h3></div><button onClick={onClose} className="icon-button"><X size={17}/></button></div><div className="flex-1 space-y-5 overflow-y-auto p-5">{messages.map((m,i)=><div key={m.id} className="flex gap-3"><Avatar name={m.author} index={i}/><div><div className="flex items-center gap-2"><span className="text-xs font-semibold">{m.author}</span><span className="text-[10px] text-ink-500">{m.time}</span></div><p className="mt-1 text-sm leading-relaxed text-ink-200">{m.text}</p></div></div>)}</div><div className="border-t border-white/5 p-4"><div className="mb-2 flex gap-2">{(['whisper','standard','pulse'] as IntentWave[]).map(i=><button key={i} onClick={()=>setIntent(i)} className={`rounded-full border px-2.5 py-1 text-[10px] ${intent===i?'border-pulse-400/40 bg-pulse-500/10 text-pulse-300':'border-white/5 text-ink-500'}`}>{i}</button>)}</div><div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[.03] p-2"><button className="icon-button"><Paperclip size={16}/></button><input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')send()}} placeholder="Write a message..." className="min-w-0 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-ink-500"/><button onClick={send} className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-pulse-500 text-white shadow-glow"><Send size={15}/></button></div></div></motion.div>;
}

function App() {
  const [view, setView] = useState<View>('overview');
  const [sidebar, setSidebar] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [drawer, setDrawer] = useState<TopicNode | null>(null);
  const [notifications, setNotifications] = useState(false);
  const [search, setSearch] = useState('');
  const overviewTopics = useMemo(() => topicNodes.slice(0, 3), []);

  const navigate = (nextView: View) => {
    setView(nextView);
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderContent = () => {
    if (view === 'discussions') return <DiscussionView onMessage={setDrawer} />;
    if (view === 'polls') return <PollsView />;
    if (view === 'resources') return <ResourcesView />;
    if (view === 'insights') return <InsightsView />;

    return (
      <>
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-ink-500">
              <span className="h-1.5 w-1.5 rounded-full bg-flux-400" />
              Workspace online
            </div>
            <h1 className="mt-2 font-display text-2xl font-semibold md:text-3xl">Good evening, Alex.</h1>
            <p className="mt-1 text-xs text-ink-400">Here’s what changed across your team since you last checked in.</p>
          </div>
          <button className="button-primary w-fit"><Plus size={15} />New discussion</button>
        </div>
        <Ledger onOpen={navigate} />
        <div className="mt-8 flex items-end justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Active discussions</h2>
            <p className="mt-1 text-[11px] text-ink-500">The conversations moving the workspace forward</p>
          </div>
          <button onClick={() => navigate('discussions')} className="text-[11px] font-semibold text-pulse-300">View all</button>
        </div>
        <div className="mt-3 space-y-3">
          {overviewTopics.map((node, index) => (
            <TopicCard key={node.id} node={node} index={index} onMessage={setDrawer} />
          ))}
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-ink-950 text-ink-50">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-violet-600/10 blur-3xl" />
        <div className="absolute -right-40 top-1/3 h-96 w-96 rounded-full bg-pulse-500/10 blur-3xl" />
      </div>

      <header className="sticky top-0 z-50 border-b border-white/5 bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-3 px-4 lg:px-6">
          <button onClick={() => setMobileMenu(true)} className="icon-button lg:hidden"><Menu size={19} /></button>
          <button onClick={() => setSidebar(value => !value)} className="icon-button hidden lg:flex">
            {sidebar ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-pulse-500 shadow-glow"><Activity size={19} /></div>
            <div>
              <div className="font-display text-lg font-bold tracking-tight">PULSE</div>
              <div className="-mt-1 text-[8px] font-semibold uppercase tracking-[.25em] text-ink-500">Decision OS</div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden w-64 items-center gap-2 rounded-xl border border-white/5 bg-white/[.03] px-3 py-2 md:flex">
              <Search size={14} className="text-ink-500" />
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search PULSE..." className="w-full bg-transparent text-xs outline-none placeholder:text-ink-500" />
            </div>
            <button onClick={() => setNotifications(value => !value)} className="icon-button relative"><Bell size={18} /><span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-violet-400" /></button>
            <Avatar name="Alex" large />
          </div>
        </div>
      </header>

      <div className="relative mx-auto flex max-w-[1500px]">
        {sidebar && (
          <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 border-r border-white/5 p-4 lg:block">
            <div className="mb-5 rounded-2xl border border-white/5 bg-white/[.02] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300"><Sparkles size={17} /></div>
                <div className="min-w-0"><p className="truncate text-xs font-semibold">Acme Labs</p><p className="text-[10px] text-ink-500">Product workspace</p></div>
                <ChevronDown size={14} className="ml-auto text-ink-500" />
              </div>
            </div>
            <nav className="space-y-1">
              {nav.map(item => {
                const Icon = item.icon;
                return (
                  <button key={item.id} onClick={() => navigate(item.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition ${view === item.id ? 'bg-pulse-500/10 text-pulse-200 shadow-glow-sm' : 'text-ink-400 hover:bg-white/[.03] hover:text-ink-100'}`}>
                    <Icon size={16} />{item.label}
                    {item.id === 'polls' && <span className="ml-auto rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[9px] text-violet-300">2</span>}
                  </button>
                );
              })}
            </nav>
            <div className="mt-8 border-t border-white/5 pt-4">
              <button className="side-link"><Users size={16} />Members<span className="ml-auto text-[10px] text-ink-500">128</span></button>
              <button className="side-link"><Settings size={16} />Settings</button>
              <button className="side-link"><CircleHelp size={16} />Help center</button>
            </div>
            <div className="absolute bottom-5 left-4 right-4 rounded-2xl border border-violet-500/15 bg-violet-500/5 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold"><Bot size={15} className="text-violet-300" />AI Copilot</div>
              <p className="mt-1 text-[10px] leading-relaxed text-ink-500">Ask about decisions, blockers or team sentiment.</p>
              <button onClick={() => navigate('insights')} className="mt-2 text-[10px] font-semibold text-violet-300">Open insights →</button>
            </div>
          </aside>
        )}

        <main className="min-w-0 flex-1 px-4 pb-28 pt-6 lg:px-8">
          <div className="mx-auto max-w-6xl">{renderContent()}</div>
        </main>
      </div>

      <nav className="fixed bottom-3 left-1/2 z-40 flex w-[calc(100%-1rem)] max-w-md -translate-x-1/2 items-center justify-around rounded-2xl border border-white/10 bg-ink-900/90 p-1.5 shadow-2xl backdrop-blur-xl lg:hidden">
        {nav.map(item => {
          const Icon = item.icon;
          return <button key={item.id} onClick={() => navigate(item.id)} className={`flex h-10 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl ${view === item.id ? 'bg-pulse-500/10 text-pulse-300' : 'text-ink-500'}`}><Icon size={15} /><span className="text-[8px] font-semibold">{item.label.split(' ')[0]}</span></button>;
        })}
      </nav>

      <AnimatePresence>
        {drawer && (
          <>
            <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={() => setDrawer(null)} />
            <ChatDrawer node={drawer} onClose={() => setDrawer(null)} />
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mobileMenu && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setMobileMenu(false)}>
            <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} className="h-full w-72 border-r border-white/10 bg-ink-950 p-5" onClick={event => event.stopPropagation()}>
              <div className="flex items-center justify-between"><div className="font-display text-lg font-bold">PULSE</div><button onClick={() => setMobileMenu(false)} className="icon-button"><X size={17} /></button></div>
              <div className="mt-7 space-y-1">
                {nav.map(item => { const Icon = item.icon; return <button key={item.id} onClick={() => navigate(item.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm ${view === item.id ? 'bg-pulse-500/10 text-pulse-200' : 'text-ink-400'}`}><Icon size={17} />{item.label}</button>; })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {notifications && (
        <div className="fixed right-4 top-20 z-[55] w-80 rounded-2xl border border-white/10 bg-ink-900/95 p-4 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between"><span className="text-sm font-semibold">Notifications</span><button onClick={() => setNotifications(false)} className="text-ink-500"><X size={14} /></button></div>
          <div className="mt-3 space-y-2"><div className="rounded-xl bg-white/[.03] p-3 text-xs"><b>Priya</b> posted a pulse alert in Brand Identity.</div><div className="rounded-xl bg-white/[.03] p-3 text-xs"><b>Launch Strategy</b> poll closes in 3 hours.</div></div>
        </div>
      )}
    </div>
  );
}

export default App;
