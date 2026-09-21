import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CheckCircle2, Clock3, RefreshCw, XCircle } from 'lucide-react';
import { listNotifications, markNotificationRead, type PulseNotification } from '@/lib/pulseApi';
import { supabase } from '@/lib/supabase';
import type { DecisionHistoryEntry } from '@/types';
import type { AppView } from '@/lib/viewTypes';

const outcomeIcon: Record<string, typeof CheckCircle2> = { approved: CheckCircle2, rejected: XCircle, postponed: RefreshCw };
function timeAgo(iso: string): string { const diffMs = Date.now() - new Date(iso).getTime(); const mins = Math.floor(diffMs / 60000); if (mins < 1) return 'just now'; if (mins < 60) return `${mins}m ago`; const hrs = Math.floor(mins / 60); if (hrs < 24) return `${hrs}h ago`; return `${Math.floor(hrs / 24)}d ago`; }

interface Props { open: boolean; activity: DecisionHistoryEntry[]; onClose: () => void; onNavigate: (view: AppView) => void; onOpenDecision: (id: string) => void; }

export function NotificationsPopover({ open, activity, onClose, onNavigate, onOpenDecision }: Props) {
  const [items, setItems] = useState<PulseNotification[]>([]);
  useEffect(() => { if (open) void listNotifications(8).then(setItems).catch(() => undefined); }, [open]);
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const channel = client.channel('header-notifications').on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => { if (open) void listNotifications(8).then(setItems).catch(() => undefined); }).subscribe();
    return () => { void client.removeChannel(channel); };
  }, [open]);

  const openNotification = async (n: PulseNotification) => {
    if (!n.readAt) { await markNotificationRead(n.id).catch(() => undefined); setItems(x => x.map(i => i.id === n.id ? { ...i, readAt: new Date().toISOString() } : i)); }
    if (n.targetType === 'decision' && n.targetId) onOpenDecision(n.targetId);
    else if (n.targetType === 'action') onNavigate('actions');
    else if (n.targetType === 'team') onNavigate('team');
    else if (n.targetType === 'invitations') onNavigate('invitations');
    else onNavigate('notifications');
    onClose();
  };

  return <AnimatePresence>{open && <><div className="fixed inset-0 z-40" onClick={onClose} /><motion.div initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.97 }} transition={{ duration: 0.18 }} className="absolute right-4 top-16 z-50 w-80 max-w-[90vw] overflow-hidden rounded-2xl glass-strong shadow-card">
    <div className="flex items-center justify-between border-b border-white/5 px-4 py-3"><div className="text-sm font-semibold">Notifications</div><button type="button" onClick={() => { onClose(); onNavigate('notifications'); }} className="text-[10px] font-semibold text-pulse-300">View all</button></div>
    <div className="max-h-80 overflow-y-auto">
      {items.length === 0 && activity.length === 0 && <p className="px-4 py-6 text-center text-xs text-ink-500">Nothing yet — notifications will show up here.</p>}
      {items.map(n => <button key={n.id} type="button" onClick={() => void openNotification(n)} className={`flex w-full gap-3 border-b border-white/5 px-4 py-3 text-left last:border-0 hover:bg-white/[.05] ${!n.readAt ? 'bg-pulse-500/[.04]' : ''}`}><Bell className="mt-0.5 h-4 w-4 shrink-0 text-pulse-300" /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-ink-100">{n.title}</span><span className="mt-0.5 block truncate text-[11px] text-ink-500">{n.body?.replace(/\s*\[[0-9a-f-]{20,}\]$/i,'') ?? ''}</span><span className="mt-0.5 block text-[10px] text-ink-600">{timeAgo(n.createdAt)}</span></span>{!n.readAt && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-pulse-300" />}</button>)}
      {items.length === 0 && activity.map(entry => { const Icon = (entry.outcome && outcomeIcon[entry.outcome]) || Clock3; return <button type="button" key={entry.id} onClick={() => { onClose(); entry.decisionId ? onOpenDecision(entry.decisionId) : onNavigate('audit-log'); }} className="flex w-full gap-3 border-b border-white/5 px-4 py-3 text-left last:border-0 hover:bg-white/[.05]"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-pulse-300" /><span className="min-w-0 flex-1"><span className="block text-xs text-ink-200">{entry.changedByName ?? 'A teammate'} {entry.outcome ? `marked a decision ${entry.outcome}` : 'updated a decision'}</span><span className="mt-0.5 block text-[10px] text-ink-600">{timeAgo(entry.createdAt)}</span></span></button>; })}
    </div>
  </motion.div></>}</AnimatePresence>;
}
