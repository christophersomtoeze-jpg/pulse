import { AnimatePresence, motion } from 'framer-motion';
import { Activity, LayoutDashboard, ListChecks, LogOut, MessageSquare, Users, X } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';

export type HomeView = 'home' | 'dashboard' | 'decisions';

interface NavDrawerProps {
  open: boolean;
  view: HomeView;
  workspaceName: string;
  onClose: () => void;
  onNavigate: (view: HomeView) => void;
  onOpenTeam: () => void;
}

const items: { id: HomeView; label: string; icon: typeof MessageSquare }[] = [
  { id: 'home', label: 'Home', icon: MessageSquare },
  { id: 'decisions', label: 'Decisions', icon: ListChecks },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
];

export function NavDrawer({ open, view, workspaceName, onClose, onNavigate, onOpenTeam }: NavDrawerProps) {
  const { user, signOut } = useAuth();

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60]" onClick={onClose}>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60" />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex h-full w-72 max-w-[80vw] flex-col glass-strong border-r border-white/5 p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#06b6d4] grid place-items-center shadow-glow">
                  <Activity className="h-5 w-5 text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <div className="font-display text-base font-bold">PULSE</div>
                  <div className="text-[9px] uppercase tracking-[.2em] text-ink-500 truncate max-w-[9rem]">{workspaceName}</div>
                </div>
              </div>
              <button className="icon-btn" onClick={onClose}><X /></button>
            </div>

            <nav className="mt-8 space-y-1">
              {items.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => { onNavigate(id); onClose(); }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    view === id ? 'bg-[#7c3aed]/15 text-pulse-200 border border-[#7c3aed]/30' : 'text-ink-300 hover:bg-white/5'
                  }`}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
              <button
                onClick={() => { onOpenTeam(); onClose(); }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-300 hover:bg-white/5"
              >
                <Users className="h-4 w-4" /> Team &amp; members
              </button>
            </nav>

            <div className="mt-auto border-t border-white/5 pt-3">
              <div className="flex items-center gap-3 px-1 pb-3">
                <div className="avatar">{(user?.email?.[0] ?? 'A').toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{user?.user_metadata?.full_name ?? 'You'}</div>
                  <div className="truncate text-xs text-ink-500">{user?.email}</div>
                </div>
              </div>
              <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ember-300 hover:bg-ember-500/10">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
