import { useState } from 'react';
import {
  Activity, BarChart3, Bell, CheckSquare, ChevronDown, ClipboardList, Folder, HelpCircle,
  History, Home, Keyboard, LayoutGrid, MessageCircle, MoreVertical, Plug, PanelLeftClose,
  PanelLeftOpen, PieChart, Settings, ShieldAlert, Sparkles, UserPlus, Users,
} from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import type { AppView } from '@/lib/viewTypes';

export interface NavItem {
  id: AppView;
  label: string;
  icon: typeof Home;
  badge?: number;
}

export const workspaceItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'discussions', label: 'Discussions', icon: MessageCircle },
  { id: 'decisions', label: 'Decisions', icon: LayoutGrid },
  { id: 'polls', label: 'Polls', icon: BarChart3 },
  { id: 'actions', label: 'Actions', icon: CheckSquare },
  { id: 'resources', label: 'Resources', icon: Folder },
];

export const intelligenceItems: NavItem[] = [
  { id: 'pulse-ai', label: 'PULSE AI', icon: Sparkles },
  { id: 'risks', label: 'Risks', icon: ShieldAlert },
  { id: 'analytics', label: 'Analytics', icon: PieChart },
  { id: 'meeting-summaries', label: 'Meeting Summaries', icon: ClipboardList },
];

export const teamItems: NavItem[] = [
  { id: 'team', label: 'Team', icon: Users },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'invitations', label: 'Invitations', icon: UserPlus },
  { id: 'audit-log', label: 'Audit Log', icon: History },
];

export const toolItems: NavItem[] = [
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'help', label: 'Help & Support', icon: HelpCircle },
];

interface SidebarProps {
  view: AppView;
  onNavigate: (view: AppView) => void;
  workspaceName: string;
  workspaceRole: string;
  workspaces: { id: string; name: string; role: string }[];
  activeWorkspaceId: string | null;
  onSwitchWorkspace: (id: string) => void;
  onCreateWorkspace: () => void;
  badges: { actions: number; risks: number; notifications: number; invitations: number };
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenShortcuts: () => void;
}

function NavSection({ title, items, view, onNavigate, badges, collapsed }: {
  title: string; items: NavItem[]; view: AppView; onNavigate: (v: AppView) => void;
  badges: SidebarProps['badges']; collapsed: boolean;
}) {
  const badgeFor = (id: AppView) =>
    id === 'actions' ? badges.actions : id === 'risks' ? badges.risks : id === 'notifications' ? badges.notifications : id === 'invitations' ? badges.invitations : 0;

  return (
    <div className="mt-6 first:mt-0">
      {!collapsed && <p className="px-3 text-[10px] font-semibold uppercase tracking-[.2em] text-ink-600">{title}</p>}
      <div className="mt-2 space-y-0.5">
        {items.map(({ id, label, icon: Icon }) => {
          const active = view === id;
          const badge = badgeFor(id);
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              title={collapsed ? label : undefined}
              className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'border border-[#7c3aed]/40 bg-gradient-to-r from-[#7c3aed]/20 to-[#06b6d4]/10 text-white shadow-glow'
                  : 'text-ink-400 hover:bg-white/5 hover:text-ink-100'
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-pulse-300' : ''}`} />
              {!collapsed && <span className="truncate">{label}</span>}
              {!collapsed && badge > 0 && (
                <span className="ml-auto grid h-5 min-w-[20px] place-items-center rounded-full bg-[#7c3aed] px-1 text-[10px] font-bold text-white">{badge}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Sidebar({ view, onNavigate, workspaceName, workspaceRole, workspaces, activeWorkspaceId, onSwitchWorkspace, onCreateWorkspace, badges, collapsed, onToggleCollapsed, onOpenShortcuts }: SidebarProps) {
  const { user, signOut } = useAuth();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const initials = workspaceName.slice(0, 2).toUpperCase();

  return (
    <aside className={`sticky top-0 hidden h-screen flex-col border-r border-white/5 bg-ink-950/60 p-3 lg:flex ${collapsed ? 'w-[76px]' : 'w-72'}`}>
      <div className={`flex items-center gap-2.5 px-2 py-3 ${collapsed ? 'justify-center' : ''}`}>
        <Activity className="h-8 w-8 shrink-0 text-pulse-300" strokeWidth={2.3} />
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-display text-lg font-bold tracking-tight">PULSE</div>
            <div className="text-[9px] uppercase tracking-[.25em] text-ink-500">Think · Decide · Move</div>
          </div>
        )}
      </div>

      <nav className="mt-2 flex-1 overflow-y-auto px-0.5">
        <NavSection title="Workspace" items={workspaceItems} view={view} onNavigate={onNavigate} badges={badges} collapsed={collapsed} />
        <NavSection title="Intelligence" items={intelligenceItems} view={view} onNavigate={onNavigate} badges={badges} collapsed={collapsed} />
        <NavSection title="Team" items={teamItems} view={view} onNavigate={onNavigate} badges={badges} collapsed={collapsed} />

        {!collapsed && (
          <div className="mt-6">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-[.2em] text-ink-600">Workspace switcher</p>
            <button onClick={() => setSwitcherOpen((v) => !v)} className="mt-2 flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/[.03] p-2.5">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#7c3aed] to-[#06b6d4] text-xs font-bold text-white">{initials}</div>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium">{workspaceName}</p>
                <p className="truncate text-[10px] text-ink-500">{workspaceRole}</p>
              </div>
              <ChevronDown className={`h-4 w-4 shrink-0 text-ink-500 transition-transform ${switcherOpen ? 'rotate-180' : ''}`} />
            </button>
            {switcherOpen && (
              <div className="mt-1.5 space-y-1 rounded-lg border border-white/5 bg-black/20 p-1.5">
                {workspaces.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => { onSwitchWorkspace(w.id); setSwitcherOpen(false); }}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${w.id === activeWorkspaceId ? 'bg-[#7c3aed]/15 text-pulse-200' : 'text-ink-300 hover:bg-white/5'}`}
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-gradient-to-br from-[#7c3aed] to-[#06b6d4] text-[9px] font-bold text-white">{w.name.slice(0, 2).toUpperCase()}</span>
                    <span className="truncate">{w.name}</span>
                    <span className="ml-auto shrink-0 text-[10px] text-ink-500">{w.role}</span>
                  </button>
                ))}
                <button onClick={() => { onCreateWorkspace(); setSwitcherOpen(false); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-pulse-300 hover:bg-white/5">
                  + New workspace
                </button>
              </div>
            )}
          </div>
        )}

        <NavSection title="Tools" items={toolItems} view={view} onNavigate={onNavigate} badges={badges} collapsed={collapsed} />
        {!collapsed && (
          <button onClick={onOpenShortcuts} className="mt-0.5 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-400 hover:bg-white/5 hover:text-ink-100">
            <Keyboard className="h-4 w-4" /> Keyboard Shortcuts
          </button>
        )}
        {collapsed && (
          <button onClick={onOpenShortcuts} title="Keyboard Shortcuts" className="mt-0.5 flex w-full items-center justify-center rounded-xl px-3 py-2.5 text-ink-400 hover:bg-white/5">
            <Keyboard className="h-4 w-4" />
          </button>
        )}
      </nav>

      <div className="border-t border-white/5 pt-3">
        {!collapsed ? (
          <div className="relative flex items-center gap-2.5 rounded-xl px-2 py-2">
            <div className="relative">
              <div className="avatar h-9 w-9">{(user?.user_metadata?.full_name?.[0] ?? user?.email?.[0] ?? 'A').toUpperCase()}</div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-ink-950 bg-flux-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.user_metadata?.full_name ?? 'You'}</p>
              <p className="truncate text-[11px] text-ink-500">{user?.email}</p>
            </div>
            <button onClick={() => setUserMenuOpen((v) => !v)} className="icon-btn h-7 w-7 shrink-0"><MoreVertical className="h-3.5 w-3.5" /></button>
            {userMenuOpen && (
              <div className="absolute bottom-full right-0 mb-1 w-40 overflow-hidden rounded-xl border border-white/10 bg-ink-850 shadow-card">
                <button onClick={() => onNavigate('settings')} className="block w-full px-3 py-2 text-left text-xs hover:bg-white/5">Account settings</button>
                <button onClick={signOut} className="block w-full px-3 py-2 text-left text-xs text-ember-300 hover:bg-white/5">Sign out</button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex justify-center py-1">
            <div className="avatar h-9 w-9">{(user?.email?.[0] ?? 'A').toUpperCase()}</div>
          </div>
        )}

        <button onClick={onToggleCollapsed} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-ink-500 hover:bg-white/5">
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /> Collapse sidebar</>}
        </button>
      </div>
    </aside>
  );
}
