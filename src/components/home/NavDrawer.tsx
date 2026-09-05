import { AnimatePresence, motion } from 'framer-motion';
import { Activity, LogOut, X } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import type { AppView } from '@/lib/viewTypes';
import { intelligenceItems, teamItems, toolItems, workspaceItems, type NavItem } from '@/components/layout/Sidebar';

interface NavDrawerProps {
  open: boolean;
  view: AppView;
  workspaceName: string;
  badges: { actions: number; risks: number; notifications: number; invitations: number };
  onClose: () => void;
  onNavigate: (view: AppView) => void;
}

function badgeFor(id: AppView, badges: NavDrawerProps['badges']): number {
  if (id === 'actions') return badges.actions;
  if (id === 'risks') return badges.risks;
  if (id === 'notifications') return badges.notifications;
  if (id === 'invitations') return badges.invitations;
  return 0;
}

function Section({ title, items, view, badges, onNavigate }: { title: string; items: NavItem[]; view: AppView; badges: NavDrawerProps['badges']; onNavigate: (v: AppView) => void }) {
  return (
    <div className="mt-5 first:mt-0">
      <p className="px-1 text-[10px] font-semibold uppercase tracking-[.2em] text-ink-600">{title}</p>
      <div className="mt-1.5 space-y-0.5">
        {items.map(({ id, label, icon: Icon }) => {
          const active = view === id;
          const badge = badgeFor(id, badges);
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? 'bg-[#7c3aed]/15 text-pulse-200 border border-[#7c3aed]/30' : 'text-ink-300 hover:bg-white/5'
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
              {badge > 0 && <span className="ml-auto grid h-5 min-w-[20px] place-items-center rounded-full bg-[#7c3aed] px-1 text-[10px] font-bold text-white">{badge}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function NavDrawer({ open, view, workspaceName, badges, onClose, onNavigate }: NavDrawerProps) {
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
            className="relative flex h-full w-80 max-w-[85vw] flex-col glass-strong border-r border-white/5 p-4"
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

            <nav className="mt-6 flex-1 overflow-y-auto">
              <Section title="Workspace" items={workspaceItems} view={view} badges={badges} onNavigate={(v) => { onNavigate(v); onClose(); }} />
              <Section title="Intelligence" items={intelligenceItems} view={view} badges={badges} onNavigate={(v) => { onNavigate(v); onClose(); }} />
              <Section title="Team" items={teamItems} view={view} badges={badges} onNavigate={(v) => { onNavigate(v); onClose(); }} />
              <Section title="Tools" items={toolItems} view={view} badges={badges} onNavigate={(v) => { onNavigate(v); onClose(); }} />
            </nav>

            <div className="border-t border-white/5 pt-3">
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
