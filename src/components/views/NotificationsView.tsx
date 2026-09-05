import { Bell, CheckCircle2, Clock3, RefreshCw, XCircle } from 'lucide-react';
import type { DecisionHistoryEntry } from '@/types';

const outcomeIcon: Record<string, typeof CheckCircle2> = { approved: CheckCircle2, rejected: XCircle, postponed: RefreshCw };

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationsView({ activity }: { activity: DecisionHistoryEntry[] }) {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-28 pt-5">
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-[.2em] text-pulse-300"><Bell className="h-3.5 w-3.5" /> Workspace</p>
      <h1 className="mt-1 font-display text-2xl font-semibold">Notifications</h1>

      <div className="mt-5 space-y-2">
        {activity.map((entry) => {
          const Icon = (entry.outcome && outcomeIcon[entry.outcome]) || Clock3;
          return (
            <div key={entry.id} className="glass flex gap-3 rounded-2xl p-3.5">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-pulse-300" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink-200">
                  {entry.changedByName ?? 'A teammate'}{' '}
                  {entry.outcome ? <>marked a decision <b className="text-ink-50">{entry.outcome}</b></> : 'updated a decision'}
                </p>
                {entry.note && <p className="mt-0.5 text-xs text-ink-500">{entry.note}</p>}
                <p className="mt-1 text-[11px] text-ink-600">{timeAgo(entry.createdAt)}</p>
              </div>
            </div>
          );
        })}
        {activity.length === 0 && <p className="py-8 text-center text-xs text-ink-500">Nothing yet — decision activity will show up here.</p>}
      </div>
    </div>
  );
}
