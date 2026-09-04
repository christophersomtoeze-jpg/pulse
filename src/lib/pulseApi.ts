import type {
  ActivePoll, FeedMessage, PinnedDecision, TopicNode,
  DecisionAIAnalysis, DecisionComment, DecisionHistoryEntry,
  DecisionOutcome, DecisionResource, DecisionSummary, DecisionVoteTally, VoteChoice,
} from '@/types';
import { supabase } from '@/lib/supabase';

export interface WorkspaceSummary {
  id: string;
  name: string;
  memberCount: number;
}

export type WorkspaceRole = 'owner' | 'admin' | 'member';
export interface WorkspaceMember {
  userId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  joinedAt: string;
}
export interface WorkspaceInvite {
  id: string;
  email: string;
  role: WorkspaceRole;
  status: 'pending' | 'accepted' | 'revoked';
  createdAt: string;
}

export async function loadWorkspaceData(workspaceId?: string) {
  if (!supabase || !workspaceId) return null;

  const [topics, decisions, polls] = await Promise.all([
    supabase.from('discussions').select('id,title,status,summary,created_at,updated_at').eq('workspace_id', workspaceId).order('updated_at', { ascending: false }),
    supabase.from('decisions').select('id,title,status,summary,created_at,updated_at').eq('workspace_id', workspaceId).eq('pinned', true).order('updated_at', { ascending: false }).limit(5),
    supabase.from('polls').select('id,question,closes_at,created_at').eq('workspace_id', workspaceId).eq('status', 'open').order('created_at', { ascending: false }).limit(5),
  ]);

  if (topics.error || decisions.error || polls.error) {
    throw new Error(topics.error?.message || decisions.error?.message || polls.error?.message || 'Unable to load workspace');
  }

  const topicRows = topics.data ?? [];
  const topicIds = topicRows.map((row) => row.id);
  const { data: messageRows, error: messageError } = topicIds.length
    ? await supabase.from('messages').select('id,discussion_id,body,created_at,author_id,profiles:author_id(full_name,avatar_url)').in('discussion_id', topicIds).order('created_at', { ascending: true }).limit(100)
    : { data: [], error: null };
  if (messageError) throw new Error(messageError.message);

  const mappedTopics: TopicNode[] = topicRows.map((row) => {
    const messages = (messageRows ?? []).filter((message) => message.discussion_id === row.id).slice(-6).map((message): FeedMessage => ({
      id: message.id,
      author: (message.profiles as { full_name?: string } | null)?.full_name || 'Team member',
      avatar: ((message.profiles as { full_name?: string } | null)?.full_name || 'T').slice(0, 1).toUpperCase(),
      text: message.body,
      time: new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      intent: 'standard',
    }));

    return {
      id: row.id,
      title: row.title,
      status: row.status,
      summary: row.summary ?? '',
      participants: 0,
      lastActive: new Date(row.updated_at).toLocaleDateString(),
      tags: [],
      messages,
      metric: [
        { label: 'Decisions', value: '0' },
        { label: 'Polls', value: '0' },
        { label: 'Messages', value: String(messages.length) },
      ],
    };
  });

  const mappedDecisions: PinnedDecision[] = (decisions.data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    summary: row.summary ?? '',
    timestamp: new Date(row.updated_at).toLocaleDateString(),
  }));

  const mappedPolls: ActivePoll[] = (polls.data ?? []).map((row) => ({
    id: row.id,
    question: row.question,
    totalVotes: 0,
    timeLeft: row.closes_at ? new Date(row.closes_at).toLocaleDateString() : 'Open',
    options: [],
  }));

  return { topics: mappedTopics, decisions: mappedDecisions, polls: mappedPolls };
}

export async function createDiscussion(workspaceId: string, title: string, summary: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.from('discussions').insert({ workspace_id: workspaceId, title, summary, status: 'active' }).select('id,title,summary,status,created_at,updated_at').single();
  if (error) throw new Error(error.message);
  return data;
}

export async function sendMessage(discussionId: string, authorId: string, body: string, intent: 'whisper' | 'standard' | 'pulse') {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.from('messages').insert({ discussion_id: discussionId, author_id: authorId, body, intent }).select('id,discussion_id,body,created_at,author_id').single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getCurrentWorkspace(userId: string): Promise<WorkspaceSummary | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspace_id,workspaces(id,name)')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.workspaces) return null;
  const workspace = Array.isArray(data.workspaces) ? data.workspaces[0] as { id: string; name: string } | undefined : data.workspaces as { id: string; name: string } | null;
  if (!workspace) return null;
  const { count } = await supabase.from('workspace_members').select('*', { count: 'exact', head: true }).eq('workspace_id', workspace.id);
  return { id: workspace.id, name: workspace.name, memberCount: count ?? 0 };
}


export async function createWorkspace(userId: string, name: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace'}-${crypto.randomUUID().slice(0, 8)}`;
  const { data, error } = await supabase.rpc('create_workspace_with_owner', { workspace_name: name, workspace_slug: slug });
  if (error) throw new Error(error.message);
  return data as { id: string; name: string };
}

export async function listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('workspace_members').select('user_id,role,created_at,profiles:user_id(full_name,email)').eq('workspace_id', workspaceId).order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  type MemberRow = { user_id: string; role: WorkspaceRole; created_at: string; profiles: { full_name: string; email: string } | { full_name: string; email: string }[] | null };
  return (data ?? []).map((row) => {
    const r = row as unknown as MemberRow;
    const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      userId: r.user_id,
      name: profile?.full_name || 'PULSE Member',
      email: profile?.email || '—',
      role: r.role,
      joinedAt: r.created_at,
    };
  });
}

export async function listWorkspaceInvites(workspaceId: string): Promise<WorkspaceInvite[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('workspace_invitations').select('id,email,role,status,created_at').eq('workspace_id', workspaceId).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  type InviteRow = { id: string; email: string; role: WorkspaceRole; status: WorkspaceInvite['status']; created_at: string };
  return (data ?? []).map((row) => {
    const r = row as unknown as InviteRow;
    return { id: r.id, email: r.email, role: r.role, status: r.status, createdAt: r.created_at };
  });
}

export async function inviteToWorkspace(workspaceId: string, email: string, role: WorkspaceRole = 'member') {
  if (!supabase) throw new Error('Supabase is not configured.');
  const cleanEmail = email.trim().toLowerCase();
  const { data: existing, error: lookupError } = await supabase.from('profiles').select('id,email').eq('email', cleanEmail).maybeSingle();
  if (lookupError) throw new Error(lookupError.message);
  if (existing?.id) {
    const { error } = await supabase.from('workspace_members').upsert({ workspace_id: workspaceId, user_id: existing.id, role }, { onConflict: 'workspace_id,user_id' });
    if (error) throw new Error(error.message);
    return { added: true, email: cleanEmail };
  }
  const { data, error } = await supabase.from('workspace_invitations').insert({ workspace_id: workspaceId, email: cleanEmail, role }).select('id,email,role,status,created_at').single();
  if (error) throw new Error(error.message);
  return { added: false, invitation: data };
}

export async function updateWorkspaceMemberRole(workspaceId: string, userId: string, role: WorkspaceRole) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('workspace_members').update({ role }).eq('workspace_id', workspaceId).eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function removeWorkspaceMember(workspaceId: string, userId: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('workspace_members').delete().eq('workspace_id', workspaceId).eq('user_id', userId);
  if (error) throw new Error(error.message);
}

// ============================================================================
// Decision Room
// ============================================================================

type DecisionRow = {
  id: string; workspace_id: string; title: string; description: string | null;
  status: PinnedDecision['status']; outcome: DecisionOutcome | null; deadline: string | null;
  owner_id: string | null; created_by: string; created_at: string; updated_at: string; decided_at: string | null;
  owner: { full_name: string } | { full_name: string }[] | null;
};

function mapDecisionRow(row: DecisionRow): DecisionSummary {
  const owner = Array.isArray(row.owner) ? row.owner[0] : row.owner;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    description: row.description ?? '',
    status: row.status,
    outcome: row.outcome,
    deadline: row.deadline,
    ownerId: row.owner_id,
    ownerName: owner?.full_name ?? null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    decidedAt: row.decided_at,
  };
}

const DECISION_SELECT = 'id,workspace_id,title,description,status,outcome,deadline,owner_id,created_by,created_at,updated_at,decided_at,owner:owner_id(full_name)';

export async function listDecisions(workspaceId: string): Promise<DecisionSummary[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('decisions').select(DECISION_SELECT).eq('workspace_id', workspaceId).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapDecisionRow(row as unknown as DecisionRow));
}

export async function getDecision(decisionId: string): Promise<DecisionSummary | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('decisions').select(DECISION_SELECT).eq('id', decisionId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapDecisionRow(data as unknown as DecisionRow) : null;
}

export interface CreateDecisionInput {
  workspaceId: string;
  title: string;
  description: string;
  discussionId?: string | null;
  deadline?: string | null;
  ownerId?: string | null;
  resourceLinks?: { name: string; url: string }[];
}

export async function createDecision(input: CreateDecisionInput, createdBy: string): Promise<DecisionSummary> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('decisions')
    .insert({
      workspace_id: input.workspaceId,
      discussion_id: input.discussionId ?? null,
      title: input.title,
      description: input.description,
      deadline: input.deadline ?? null,
      owner_id: input.ownerId ?? createdBy,
      created_by: createdBy,
      status: 'in-review',
    })
    .select(DECISION_SELECT)
    .single();
  if (error) throw new Error(error.message);

  const resources = (input.resourceLinks ?? []).filter((r) => r.name.trim() && r.url.trim());
  if (resources.length > 0) {
    const { error: resourceError } = await supabase.from('resources').insert(
      resources.map((r) => ({
        workspace_id: input.workspaceId,
        decision_id: data.id,
        name: r.name.trim(),
        url: r.url.trim(),
        storage_path: r.url.trim(),
        uploaded_by: createdBy,
      }))
    );
    if (resourceError) throw new Error(resourceError.message);
  }

  return mapDecisionRow(data as unknown as DecisionRow);
}

export async function listDecisionResources(decisionId: string): Promise<DecisionResource[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('resources').select('id,name,url,created_at').eq('decision_id', decisionId).order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({ id: row.id, name: row.name, url: row.url, createdAt: row.created_at }));
}

export async function addDecisionResource(workspaceId: string, decisionId: string, name: string, url: string, addedBy: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('resources').insert({ workspace_id: workspaceId, decision_id: decisionId, name, url, storage_path: url, uploaded_by: addedBy });
  if (error) throw new Error(error.message);
}

// ---- Comments / discussion (threaded, with @mentions) ----

type CommentRow = {
  id: string; decision_id: string; parent_comment_id: string | null; author_id: string;
  body: string; mentioned_user_ids: string[]; created_at: string;
  author: { full_name: string } | { full_name: string }[] | null;
};

export async function listDecisionComments(decisionId: string): Promise<DecisionComment[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('decision_comments')
    .select('id,decision_id,parent_comment_id,author_id,body,mentioned_user_ids,created_at,author:author_id(full_name)')
    .eq('decision_id', decisionId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const r = row as unknown as CommentRow;
    const author = Array.isArray(r.author) ? r.author[0] : r.author;
    return {
      id: r.id,
      decisionId: r.decision_id,
      parentCommentId: r.parent_comment_id,
      authorId: r.author_id,
      authorName: author?.full_name ?? 'PULSE Member',
      body: r.body,
      mentionedUserIds: r.mentioned_user_ids ?? [],
      createdAt: r.created_at,
    };
  });
}

export async function addDecisionComment(decisionId: string, authorId: string, body: string, mentionedUserIds: string[], parentCommentId?: string | null) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('decision_comments').insert({
    decision_id: decisionId,
    author_id: authorId,
    body,
    mentioned_user_ids: mentionedUserIds,
    parent_comment_id: parentCommentId ?? null,
  });
  if (error) throw new Error(error.message);
}

// ---- Voting ----

export async function castDecisionVote(decisionId: string, choice: VoteChoice, anonymous: boolean) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('cast_decision_vote', { p_decision_id: decisionId, p_choice: choice, p_anonymous: anonymous });
  if (error) throw new Error(error.message);
}

export async function getDecisionVoteTally(decisionId: string, currentUserId: string): Promise<DecisionVoteTally> {
  if (!supabase) return { yes: 0, no: 0, needsInfo: 0, total: 0, myVote: null };
  const { data, error } = await supabase.from('decision_votes').select('user_id,choice').eq('decision_id', decisionId);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const tally: DecisionVoteTally = { yes: 0, no: 0, needsInfo: 0, total: rows.length, myVote: null };
  for (const row of rows) {
    if (row.choice === 'yes') tally.yes += 1;
    else if (row.choice === 'no') tally.no += 1;
    else tally.needsInfo += 1;
    if (row.user_id === currentUserId) tally.myVote = row.choice as VoteChoice;
  }
  return tally;
}

// ---- Outcome + permanent history ----

export async function setDecisionOutcome(decisionId: string, outcome: DecisionOutcome, note?: string): Promise<DecisionSummary> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('set_decision_outcome', { p_decision_id: decisionId, p_outcome: outcome, p_note: note ?? null });
  if (error) throw new Error(error.message);
  return mapDecisionRow(data as unknown as DecisionRow);
}

export async function listDecisionHistory(decisionId: string): Promise<DecisionHistoryEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('decision_history')
    .select('id,status,outcome,note,created_at,changed_by:changed_by(full_name)')
    .eq('decision_id', decisionId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  type HistoryRow = { id: string; status: string | null; outcome: string | null; note: string | null; created_at: string; changed_by: { full_name: string } | { full_name: string }[] | null };
  return (data ?? []).map((row) => {
    const r = row as unknown as HistoryRow;
    const changedBy = Array.isArray(r.changed_by) ? r.changed_by[0] : r.changed_by;
    return {
      id: r.id,
      status: r.status,
      outcome: r.outcome,
      note: r.note,
      changedByName: changedBy?.full_name ?? null,
      createdAt: r.created_at,
    };
  });
}

// ---- AI Decision Intelligence ----
// Calls a Supabase Edge Function (supabase/functions/ai-decision-summary) so the
// AI provider key never touches the browser. See that function's README for setup.

export async function getLatestAIAnalysis(decisionId: string): Promise<DecisionAIAnalysis | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('decision_ai_analyses')
    .select('id,summary,disagreements,strongest_arguments,recommendation,confidence,created_at')
    .eq('decision_id', decisionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data.id,
    summary: data.summary,
    disagreements: data.disagreements,
    strongestArguments: data.strongest_arguments,
    recommendation: data.recommendation,
    confidence: data.confidence,
    createdAt: data.created_at,
  };
}

export async function requestAIAnalysis(decisionId: string): Promise<DecisionAIAnalysis> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.functions.invoke('ai-decision-summary', { body: { decisionId } });
  if (error) throw new Error(error.message);
  return {
    id: data.id,
    summary: data.summary,
    disagreements: data.disagreements ?? null,
    strongestArguments: data.strongestArguments ?? data.strongest_arguments ?? null,
    recommendation: data.recommendation ?? null,
    confidence: data.confidence ?? null,
    createdAt: data.createdAt ?? new Date().toISOString(),
  };
}

// ---- Dashboard ----

export interface DashboardData {
  waitingForYou: DecisionSummary[];
  decidedByYou: DecisionSummary[];
  upcomingDeadlines: DecisionSummary[];
  teamActivity: DecisionHistoryEntry[];
}

export async function loadDashboardData(workspaceId: string, userId: string): Promise<DashboardData> {
  if (!supabase) return { waitingForYou: [], decidedByYou: [], upcomingDeadlines: [], teamActivity: [] };

  const [decisionsRes, myVotesRes, activityRes] = await Promise.all([
    supabase.from('decisions').select(DECISION_SELECT).eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
    supabase.from('decision_votes').select('decision_id').eq('user_id', userId),
    supabase
      .from('decision_history')
      .select('id,status,outcome,note,created_at,changed_by:changed_by(full_name),decision:decision_id(workspace_id)')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  if (decisionsRes.error) throw new Error(decisionsRes.error.message);
  if (myVotesRes.error) throw new Error(myVotesRes.error.message);
  if (activityRes.error) throw new Error(activityRes.error.message);

  const allDecisions = (decisionsRes.data ?? []).map((row) => mapDecisionRow(row as unknown as DecisionRow));
  const votedDecisionIds = new Set((myVotesRes.data ?? []).map((r) => r.decision_id));

  const waitingForYou = allDecisions.filter((d) => !d.outcome && !votedDecisionIds.has(d.id));
  const decidedByYou = allDecisions.filter((d) => d.outcome && (votedDecisionIds.has(d.id) || d.decidedAt));
  const upcomingDeadlines = allDecisions
    .filter((d) => d.deadline && !d.outcome && new Date(d.deadline).getTime() >= Date.now())
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());

  type ActivityRow = {
    id: string; status: string | null; outcome: string | null; note: string | null; created_at: string;
    changed_by: { full_name: string } | { full_name: string }[] | null;
    decision: { workspace_id: string } | { workspace_id: string }[] | null;
  };
  const teamActivity: DecisionHistoryEntry[] = ((activityRes.data ?? []) as unknown as ActivityRow[])
    .filter((row) => (Array.isArray(row.decision) ? row.decision[0] : row.decision)?.workspace_id === workspaceId)
    .map((row) => {
      const changedBy = Array.isArray(row.changed_by) ? row.changed_by[0] : row.changed_by;
      return {
        id: row.id,
        status: row.status,
        outcome: row.outcome,
        note: row.note,
        changedByName: changedBy?.full_name ?? null,
        createdAt: row.created_at,
      };
    });

  return { waitingForYou, decidedByYou, upcomingDeadlines, teamActivity };
}
