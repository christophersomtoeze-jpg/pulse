import { useEffect, useState } from 'react';
import { AlertTriangle, Bell, Check, CheckCircle2, Clock3, RefreshCw, Trash2, Zap } from 'lucide-react';
import { listNotifications, markNotificationRead, markAllNotificationsRead, clearAllNotifications, type PulseNotification } from '@/lib/pulseApi';
import { supabase } from '@/lib/supabase';
import type { DecisionHistoryEntry } from '@/types';
import type { AppView } from '@/lib/viewTypes';

const outcomeIcon: Record<string, typeof CheckCircle2> = { approved: CheckCircle2, rejected: AlertTriangle, postponed: RefreshCw };
function timeAgo(iso: string): string { const mins=Math.max(0,Math.floor((Date.now()-new Date(iso).getTime())/60000)); if(mins<1)return 'just now'; if(mins<60)return `${mins}m ago`; const hrs=Math.floor(mins/60); if(hrs<24)return `${hrs}h ago`; return `${Math.floor(hrs/24)}d ago`; }

interface NotificationsViewProps {
  activity: DecisionHistoryEntry[];
  onNavigate: (view: AppView) => void;
  onOpenDecision: (id: string, commentId?: string) => void;
}

export function NotificationsView({ activity, onNavigate, onOpenDecision }: NotificationsViewProps) {
  const [items,setItems]=useState<PulseNotification[]>([]); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  const load = () => listNotifications().then(setItems).catch(e=>setError(e instanceof Error?e.message:'Could not load notifications'));
  useEffect(()=>{ void load(); },[]);
  useEffect(()=>{
    if (!supabase) return;
    const client = supabase;
    const channel = client.channel('user-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => { void load(); })
      .subscribe();
    return () => { client.removeChannel(channel); };
  },[]);

  const mark=async(id:string)=>{try{await markNotificationRead(id);setItems(x=>x.map(n=>n.id===id?{...n,readAt:new Date().toISOString()}:n))} catch (e) { setError(e instanceof Error ? e.message : 'Could not mark notification as read'); }};
  const markAll=async()=>{setBusy(true);setError('');try{await markAllNotificationsRead();setItems(x=>x.map(n=>({...n,readAt:n.readAt??new Date().toISOString()})))}catch(e){setError(e instanceof Error?e.message:'Could not mark notifications as read')}finally{setBusy(false)}};
  const clear=async()=>{if(!window.confirm('Clear all notifications? This cannot be undone.'))return;setBusy(true);setError('');try{await clearAllNotifications();setItems([])}catch(e){setError(e instanceof Error?e.message:'Could not clear notifications')}finally{setBusy(false)}};
  const openNotification = async (n: PulseNotification) => {
    if (!n.readAt) await mark(n.id);
    if ((n.targetType === 'decision' || n.targetType === 'decision_comment') && n.targetId) { onOpenDecision(n.targetId, n.targetCommentId ?? undefined); return; }
    if (n.targetType === 'action') { onNavigate('actions'); return; }
    if (n.targetType === 'team') { onNavigate('team'); return; }
    if (n.targetType === 'invitations') { onNavigate('invitations'); return; }
  };

  const unread = items.filter(n=>!n.readAt).length;
  return <div className="mx-auto max-w-2xl px-4 pb-28 pt-5"><div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-1.5 text-xs uppercase tracking-[.2em] text-pulse-300"><Bell className="h-3.5 w-3.5"/> Workspace</p><h1 className="mt-1 font-display text-2xl font-semibold">Notifications</h1><p className="mt-1 text-xs text-ink-500">Real alerts from your workspace and PULSE automations.</p></div><div className="flex shrink-0 gap-2"><button type="button" onClick={markAll} disabled={busy||unread===0} className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-[10px] font-semibold text-ink-300 hover:bg-white/10 disabled:opacity-40"><Check className="h-3.5 w-3.5"/> Mark all</button><button type="button" onClick={clear} disabled={busy||items.length===0} className="flex items-center gap-1.5 rounded-xl border border-ember-500/20 bg-ember-500/5 px-2.5 py-2 text-[10px] font-semibold text-ember-300 hover:bg-ember-500/10 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5"/> Clear</button></div></div>
    {error&&<div className="mt-4 glass rounded-2xl p-3 text-xs text-ember-300">{error}</div>}
    <div className="mt-5 space-y-2">
      {items.map(n=><button key={n.id} type="button" onClick={()=>void openNotification(n)} className={`glass flex w-full gap-3 rounded-2xl p-3.5 text-left transition hover:bg-white/[.06] focus:outline-none focus:ring-2 focus:ring-pulse-500/30 ${n.readAt?'opacity-65':'border-pulse-500/20'}`}><span className="mt-0.5 shrink-0 rounded-lg bg-pulse-500/10 p-1.5"><Zap className="h-3.5 w-3.5 text-pulse-300"/></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><b className="text-sm text-ink-100">{n.title}</b>{!n.readAt&&<span className="h-1.5 w-1.5 rounded-full bg-pulse-300"/>}</span><span className="mt-0.5 block text-xs text-ink-400">{n.body?.replace(/\s*\[[0-9a-f-]{20,}\]$/i,'') ?? ''}</span><span className="mt-1 block text-[11px] text-ink-600">{timeAgo(n.createdAt)}{n.targetType==='decision'?' · Open Decision Room':n.targetType==='action'?' · Open Actions':n.targetType==='team'?' · Open Team':n.targetType==='invitations'?' · Open Invitations':''}</span></span></button>)}
      {activity.map(entry=>{const Icon=(entry.outcome&&outcomeIcon[entry.outcome])||Clock3;return <button type="button" key={`history-${entry.id}`} onClick={()=>entry.decisionId?onOpenDecision(entry.decisionId):onNavigate('audit-log')} className="glass flex w-full gap-3 rounded-2xl p-3.5 text-left transition hover:bg-white/[.06]"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-pulse-300"/><div><p className="text-sm text-ink-200">{entry.changedByName??'A teammate'} {entry.outcome?<>marked a decision <b className="text-ink-50">{entry.outcome}</b></>:'updated a decision'}</p>{entry.note&&<p className="mt-0.5 text-xs text-ink-500">{entry.note}</p>}<p className="mt-1 text-[11px] text-ink-600">{timeAgo(entry.createdAt)} · Open activity</p></div></button>})}
      {items.length===0&&activity.length===0&&<p className="py-8 text-center text-xs text-ink-500">Nothing yet — PULSE alerts and decision activity will appear here.</p>}
    </div></div>;
}
