import { useState } from 'react';
import { Activity, Bell, Menu, Search, Users2 } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { NotificationsPopover } from './NotificationsPopover';
import type { DecisionHistoryEntry } from '@/types';

interface HomeHeaderProps {
  memberCount: number;
  isLive: boolean;
  activity: DecisionHistoryEntry[];
  searchOpen: boolean;
  onToggleSearch: () => void;
  onOpenNav: () => void;
}

export function HomeHeader({ memberCount, isLive, activity, searchOpen, onToggleSearch, onOpenNav }: HomeHeaderProps) {
  const { user } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const unread = activity.length;

  return (
    <header className="relative px-4 pt-5 pb-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="icon-btn" onClick={onOpenNav} aria-label="Open menu"><Menu /></button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#06b6d4] grid place-items-center shadow-glow">
              <Activity className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-display text-xl font-bold tracking-tight">PULSE</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className={`icon-btn ${searchOpen ? 'text-pulse-300 border-pulse-500/30' : ''}`} onClick={onToggleSearch} aria-label="Search">
            <Search />
          </button>
          <button className="icon-btn relative" onClick={() => setNotifOpen((v) => !v)} aria-label="Notifications">
            <Bell />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#7c3aed] px-1 text-[9px] font-bold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          <div className="relative">
            <div className="avatar h-8 w-8 text-[11px]">{(user?.email?.[0] ?? 'A').toUpperCase()}</div>
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-ink-950 bg-flux-400" />
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-flux-300">
          <span className="relative flex h-2 w-2">
            {isLive && <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-flux-400" />}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${isLive ? 'bg-flux-400' : 'bg-ink-500'}`} />
          </span>
          {isLive ? 'Online' : 'Offline'}
        </span>
        <span className="flex items-center gap-1.5 text-ink-400">
          Members: {memberCount} <Users2 className="h-3.5 w-3.5" />
        </span>
      </div>

      <NotificationsPopover open={notifOpen} activity={activity} onClose={() => setNotifOpen(false)} />
    </header>
  );
}
