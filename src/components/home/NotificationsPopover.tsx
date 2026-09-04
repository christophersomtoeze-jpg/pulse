import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Clock3, RefreshCw, XCircle } from 'lucide-react';
import type { DecisionHistoryEntry } from '@/types';

const outcomeIcon: Record<string, typeof CheckCircle2> = {
  approved: CheckCircle2,
  rejected: XCircle,
  postponed: RefreshCw,
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationsPopover({ open, activity, onClose }: { open: boolean; activity: DecisionHistoryEntry[]; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="absolute right-4 top-16 z-50 w-80 max-w-[90vw] overflow-hidden rounded-2xl glass-strong shadow-card"
          >
            <div className="border-b border-white/5 px-4 py-3 text-sm font-semibold">Team activity</div>
            <div className="max-h-80 overflow-y-auto">
              {activity.length === 0 && (
                <p className="px-4 py-6 text-center text-xs text-ink-500">Nothing yet — decision updates will show up here.</p>
              )}
              {activity.map((entry) => {
                const Icon = (entry.outcome && outcomeIcon[entry.outcome]) || Clock3;
                return (
                  <div key={entry.id} className="flex gap-3 border-b border-white/5 px-4 py-3 last:border-0">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-pulse-300" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-ink-200">
                        {entry.changedByName ?? 'A teammate'}{' '}
                        {entry.outcome ? <>marked a decision <b className="text-ink-50">{entry.outcome}</b></> : 'updated a decision'}
                      </p>
                      {entry.note && <p className="mt-0.5 truncate text-[11px] text-ink-500">{entry.note}</p>}
                      <p className="mt-0.5 text-[10px] text-ink-500">{timeAgo(entry.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
