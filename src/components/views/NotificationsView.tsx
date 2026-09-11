import { useEffect, useState } from 'react';
import { AlertTriangle, Bell, CheckCircle2, Clock3, RefreshCw, Zap } from 'lucide-react';
import { listNotifications, markNotificationRead, type PulseNotification } from '@/lib/pulseApi';
import type { DecisionHistoryEntry } from '@/types';

const outcomeIcon: Record<string, typeof CheckCircle2> = { approved: CheckCircle2, rejected: AlertTriangle, postponed: RefreshCw };
function timeAgo(iso: string): string { const mins=Math.max(0,Math.floor((Date.now()-new Date(iso).getTime())/60000)); if(mins<1)return 'just now'; if(mins<60)return `${mins}m ago`; const hrs=Math.floor(mins/60); if(hrs<24)return `${hrs}h ago`; return `${Math.floor(hrs/24)}d ago`; }

export function NotificationsView({ activity }: { activity: DecisionHistoryEntry[] }) {
  const [items,setItems]=useState<PulseNotification[]>([]); const [error,setError]=useState('');
  useEffect(()=>{listNotifications().then(setItems).catch(e=>setError(e instanceof Error?e.message:'Could not load notifications'))},[]);
  const mark=async(id:string)=>{try{await markNotificationRead(id);setItems(x=>x.map(n=>n.id===id?{...n,readAt:new Date().toISOString()}:n))}catch{}};
  return <div className="mx-auto max-w-2xl px-4 pb-28 pt-5"><p className="flex items-center gap-1.5 text-xs uppercase tracking-[.2em] text-pulse-300"><Bell className="h-3.5 w-3.5"/> Workspace</p><h1 className="mt-1 font-display text-2xl font-semibold">Notifications</h1><p className="mt-1 text-xs text-ink-500">Real alerts from your workspace and PULSE automations.</p>
    {error&&<div className="mt-4 glass rounded-2xl p-3 text-xs text-ember-300">{error}</div>}
    <div className="mt-5 space-y-2">{items.map(n=><button key={n.id} onClick={()=>!n.readAt&&mark(n.id)} className={`glass flex w-full gap-3 rounded-2xl p-3.5 text-left ${n.readAt?'opacity-65':'border-pulse-500/20'}`}><span className="mt-0.5 shrink-0 rounded-lg bg-pulse-500/10 p-1.5"><Zap className="h-3.5 w-3.5 text-pulse-300"/></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><b className="text-sm text-ink-100">{n.title}</b>{!n.readAt&&<span className="h-1.5 w-1.5 rounded-full bg-pulse-300"/>}</span><span className="mt-0.5 block text-xs text-ink-400">{n.body?.replace(/\s*\[[0-9a-f-]{20,}\]$/i,'') ?? ''}</span><span className="mt-1 block text-[11px] text-ink-600">{timeAgo(n.createdAt)}</span></span></button>)}
      {activity.map(entry=>{const Icon=(entry.outcome&&outcomeIcon[entry.outcome])||Clock3;return <div key={`history-${entry.id}`} className="glass flex gap-3 rounded-2xl p-3.5"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-pulse-300"/><div><p className="text-sm text-ink-200">{entry.changedByName??'A teammate'} {entry.outcome?<>marked a decision <b className="text-ink-50">{entry.outcome}</b></>:'updated a decision'}</p>{entry.note&&<p className="mt-0.5 text-xs text-ink-500">{entry.note}</p>}<p className="mt-1 text-[11px] text-ink-600">{timeAgo(entry.createdAt)}</p></div></div>})}
      {items.length===0&&activity.length===0&&<p className="py-8 text-center text-xs text-ink-500">Nothing yet — PULSE alerts and decision activity will appear here.</p>}
    </div></div>;
}
