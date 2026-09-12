import type { SubscriptionPlan, WorkspaceUsage } from '@/types';

export type PaidFeature =
  | 'decision-intelligence'
  | 'analytics'
  | 'risk-center'
  | 'memory'
  | 'automation'
  | 'integrations'
  | 'meeting-summaries'
  | 'audit-log'
  | 'api-keys'
  | 'sso';

export type UsageMetric = 'members' | 'aiAnalyses' | 'automations';

export interface PlanLimits {
  members: number | null;
  aiAnalyses: number | null;
  automations: number | null;
}

const featurePlans: Record<PaidFeature, SubscriptionPlan> = {
  'decision-intelligence': 'pro',
  analytics: 'pro',
  'risk-center': 'pro',
  memory: 'pro',
  automation: 'pro',
  integrations: 'pro',
  'meeting-summaries': 'pro',
  'audit-log': 'business',
  'api-keys': 'business',
  sso: 'business',
};

const planRank: Record<SubscriptionPlan, number> = { free: 0, pro: 1, business: 2, enterprise: 3 };

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  free: { members: 5, aiAnalyses: 20, automations: 0 },
  pro: { members: 25, aiAnalyses: 500, automations: 25 },
  business: { members: 250, aiAnalyses: 5000, automations: 250 },
  enterprise: { members: null, aiAnalyses: null, automations: null },
};

export function planAllows(plan: SubscriptionPlan, feature: PaidFeature): boolean {
  return planRank[plan] >= planRank[featurePlans[feature]];
}

export function getRequiredPlan(feature: PaidFeature): 'pro' | 'business' {
  return featurePlans[feature] === 'business' ? 'business' : 'pro';
}

export function getLimit(plan: SubscriptionPlan, metric: UsageMetric): number | null {
  return PLAN_LIMITS[plan][metric];
}

export function isUsageAtLimit(plan: SubscriptionPlan, metric: UsageMetric, usage: WorkspaceUsage): boolean {
  const limit = getLimit(plan, metric);
  if (limit === null) return false;
  const value = metric === 'members' ? usage.activeMembers : metric === 'aiAnalyses' ? usage.aiAnalysesRun : usage.automationsRun;
  return value >= limit;
}

export function usageValue(metric: UsageMetric, usage: WorkspaceUsage): number {
  return metric === 'members' ? usage.activeMembers : metric === 'aiAnalyses' ? usage.aiAnalysesRun : usage.automationsRun;
}
