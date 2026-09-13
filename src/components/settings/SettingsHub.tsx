import { useEffect, useState, type ReactNode } from 'react';
import {
  BarChart3, Bell, Building2, ChevronLeft, ChevronRight, CreditCard, HelpCircle,
  History, KeyRound, Lock, Plug, ShieldCheck, Sparkles, Terminal, User, Users,
} from 'lucide-react';
import type { AppView } from '@/lib/viewTypes';
import { ProfilePanel } from './ProfilePanel';
import { SecurityPanel } from './SecurityPanel';
import { AppearancePanel } from './AppearancePanel';
import { WorkspaceGeneralPanel } from './WorkspaceGeneralPanel';
import { NotificationsPanel } from './NotificationsPanel';
import { AISettingsPanel } from './AISettingsPanel';
import { UsagePanel } from './UsagePanel';
import { DataPrivacyPanel } from './DataPrivacyPanel';
import { BillingPanel } from './BillingPanel';
import { ApiKeysPanel } from './ApiKeysPanel';
import { SsoPanel } from './SsoPanel';
import { PlanGate } from './PlanGate';
import { planAllows, type PaidFeature } from '@/lib/planEntitlements';
import type { SubscriptionPlan } from '@/types';

type ItemId =
  | 'profile' | 'security' | 'appearance'
  | 'workspace-general' | 'workspace-members' | 'workspace-notifications' | 'workspace-integrations'
  | 'ai-settings' | 'usage'
  | 'audit-log' | 'data-privacy' | 'api-keys' | 'sso'
  | 'billing'
  | 'help';

interface NavItem { id: ItemId; label: string; icon: typeof User; external?: AppView }
interface Category { title: string; items: NavItem[] }

const categories: Category[] = [
  { title: 'Account', items: [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Password & Security', icon: KeyRound },
    { id: 'appearance', label: 'Appearance', icon: Sparkles },
  ] },
  { title: 'Workspace', items: [
    { id: 'workspace-general', label: 'General', icon: Building2 },
    { id: 'workspace-members', label: 'Members & Roles', icon: Users, external: 'team' },
    { id: 'workspace-notifications', label: 'Notifications', icon: Bell },
    { id: 'workspace-integrations', label: 'Integrations', icon: Plug, external: 'integrations' },
  ] },
  { title: 'Intelligence', items: [
    { id: 'ai-settings', label: 'AI Settings', icon: Sparkles },
    { id: 'usage', label: 'Usage', icon: BarChart3 },
  ] },
  { title: 'Security', items: [
    { id: 'audit-log', label: 'Audit Log', icon: History, external: 'audit-log' },
    { id: 'api-keys', label: 'API Keys', icon: Terminal },
    { id: 'sso', label: 'Single Sign-On', icon: ShieldCheck },
    { id: 'data-privacy', label: 'Data & Privacy', icon: Lock },
  ] },
  { title: 'Billing', items: [{ id: 'billing', label: 'Plan & Billing', icon: CreditCard }] },
  { title: 'Help', items: [{ id: 'help', label: 'Help & Support', icon: HelpCircle, external: 'help' }] },
];

interface SettingsHubProps {
  workspaceId: string;
  workspaceName: string;
  workspaceRole: string;
  isAdmin: boolean;
  isOwner: boolean;
  subscriptionPlan: SubscriptionPlan;
  onNavigateApp: (view: AppView) => void;
  onWorkspaceRenamed: (name: string, defaultLanguage: string) => void;
}

export function SettingsHub({ workspaceId, workspaceName, workspaceRole, isAdmin, isOwner, subscriptionPlan, onNavigateApp, onWorkspaceRenamed }: SettingsHubProps) {
  const [active, setActive] = useState<ItemId | null>(null);

  useEffect(() => {
    const openBilling = () => setActive('billing');
    window.addEventListener('pulse:open-billing', openBilling);
    return () => window.removeEventListener('pulse:open-billing', openBilling);
  }, []);

  const select = (item: NavItem) => {
    if (item.external) { onNavigateApp(item.external); return; }
    setActive(item.id);
  };

  const activeLabel = categories.flatMap((c) => c.items).find((i) => i.id === active)?.label;

  const gated = (feature: PaidFeature, content: ReactNode, title: string, description: string) =>
    planAllows(subscriptionPlan, feature) ? content : <PlanGate plan={subscriptionPlan} feature={feature} title={title} description={description} onBilling={() => setActive('billing')} />;

  const renderPanel = () => {
    switch (active) {
      case 'profile': return <ProfilePanel />;
      case 'security': return <SecurityPanel />;
      case 'appearance': return <AppearancePanel />;
      case 'workspace-general': return <WorkspaceGeneralPanel workspaceId={workspaceId} isAdmin={isAdmin} onSaved={onWorkspaceRenamed} />;
      case 'workspace-notifications': return <NotificationsPanel />;
      case 'ai-settings': return <AISettingsPanel workspaceId={workspaceId} isAdmin={isAdmin} />;
      case 'usage': return <UsagePanel workspaceId={workspaceId} />;
      case 'data-privacy': return <DataPrivacyPanel workspaceId={workspaceId} workspaceName={workspaceName} isOwner={isOwner} />;
      case 'api-keys': return gated('api-keys', <ApiKeysPanel workspaceId={workspaceId} isAdmin={isAdmin} />, 'API Keys', 'Developer API access is included with Business.');
      case 'sso': return gated('sso', <SsoPanel workspaceId={workspaceId} isOwner={isOwner} />, 'Single Sign-On', 'SSO and enterprise identity controls are included with Business.');
      case 'billing': return <BillingPanel workspaceId={workspaceId} isAdmin={isAdmin} />;
      default: return null;
    }
  };

  const NavList = (
    <div className="space-y-5">
      {categories.map((cat) => (
        <div key={cat.title}>
          <p className="px-1 text-[10px] font-semibold uppercase tracking-[.2em] text-ink-600">{cat.title}</p>
          <div className="mt-1.5 space-y-0.5">
            {cat.items.map((item) => (
              <button
                key={item.id}
                onClick={() => select(item)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium ${active === item.id ? 'bg-[#7c3aed]/15 text-pulse-200' : 'text-ink-300 hover:bg-white/5'}`}
              >
                <item.icon className="h-4 w-4 shrink-0" /> <span className="flex-1 truncate">{item.label}</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-600 lg:hidden" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 pb-28 pt-5">
      <p className="text-xs uppercase tracking-[.2em] text-pulse-300">{workspaceName} · {workspaceRole}</p>
      <h1 className="mt-1 font-display text-2xl font-semibold">Settings</h1>

      <div className="mt-5 lg:grid lg:grid-cols-[240px_1fr] lg:gap-6">
        <div className={active ? 'hidden lg:block' : 'block'}>{NavList}</div>
        <div className={active ? 'block' : 'hidden lg:block'}>
          {active ? (
            <>
              <button onClick={() => setActive(null)} className="mb-3 flex items-center gap-1 text-sm font-medium text-ink-400 lg:hidden">
                <ChevronLeft className="h-4 w-4" /> Settings
              </button>
              <p className="mb-3 hidden text-sm font-semibold text-ink-100 lg:block">{activeLabel}</p>
              {renderPanel()}
            </>
          ) : (
            <p className="hidden text-sm text-ink-500 lg:block">Choose a setting from the left.</p>
          )}
        </div>
      </div>
    </div>
  );
}
