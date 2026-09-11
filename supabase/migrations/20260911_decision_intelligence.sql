-- PULSE Decision Intelligence upgrade. Safe to run repeatedly.
alter table public.decision_ai_analyses add column if not exists executive_summary text;
alter table public.decision_ai_analyses add column if not exists quality_score numeric check (quality_score >= 0 and quality_score <= 100);
alter table public.decision_ai_analyses add column if not exists risk_level text check (risk_level in ('low','medium','high'));
alter table public.decision_ai_analyses add column if not exists risk_reasons jsonb not null default '[]'::jsonb;
alter table public.decision_ai_analyses add column if not exists evidence_gaps jsonb not null default '[]'::jsonb;
alter table public.decision_ai_analyses add column if not exists strongest_arguments_list jsonb not null default '[]'::jsonb;
alter table public.decision_ai_analyses add column if not exists disagreements_list jsonb not null default '[]'::jsonb;
alter table public.decision_ai_analyses add column if not exists next_actions jsonb not null default '[]'::jsonb;
alter table public.decision_ai_analyses add column if not exists similar_decisions jsonb not null default '[]'::jsonb;
alter table public.decision_ai_analyses add column if not exists graph_suggestions jsonb not null default '[]'::jsonb;
create index if not exists decision_ai_quality_idx on public.decision_ai_analyses(decision_id, quality_score desc, created_at desc);
notify pgrst, 'reload schema';
