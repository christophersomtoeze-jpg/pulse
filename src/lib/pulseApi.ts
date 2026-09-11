import type {
  ActivePoll, FeedMessage, PinnedDecision, TopicNode,
  DecisionAIAnalysis, DecisionComment, DecisionHistoryEntry,
  DecisionOutcome, DecisionResource, DecisionSummary, DecisionVoteTally, VoteChoice,
  WorkspaceAction, ActionStatus, ActionPriority, GlobalSearchResults,
  AssistantMessage, MeetingSummary, RiskItem, WorkspaceListItem, AuditLogEntry,
  AnalyticsSnapshot, WorkspaceSubscription, WorkspaceIntegration, IntegrationProvider, PlatformMetrics,
  ProfileDetails, NotificationPreferences, LoginHistoryEntry, WorkspaceGeneralSettings, WorkspaceUsage,
  ApiKeySummary, IncomingWebhookSummary, SsoDomainSummary,
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
    ? await supabase.from('messages').select('id,discussion_id,body,created_at,author_id,attachment_url,attachment_type,profiles:author_id(full_name,avatar_url)').in('discussion_id', topicIds).order('created_at', { ascending: true }).limit(100)
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
      attachmentUrl: message.attachment_url ?? null,
      attachmentType: (message.attachment_type as 'image' | 'audio' | null) ?? null,
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

  const pollRows = polls.data ?? [];
  const mappedPolls = await hydratePolls(pollRows);

  return { topics: mappedTopics, decisions: mappedDecisions, polls: mappedPolls };
}

/** Attaches real options + live vote counts to a set of poll rows. Fixes the old bug where options were always []. */
async function hydratePolls(pollRows: { id: string; question: string; closes_at: string | null }[]): Promise<ActivePoll[]> {
  if (!supabase || pollRows.length === 0) return [];
  const pollIds = pollRows.map((p) => p.id);
  const [optionsRes, votesRes] = await Promise.all([
    supabase.from('poll_options').select('id,poll_id,label,position').in('poll_id', pollIds).order('position', { ascending: true }),
    supabase.from('poll_votes').select('poll_id,option_id').in('poll_id', pollIds),
  ]);
  if (optionsRes.error) throw new Error(optionsRes.error.message);
  if (votesRes.error) throw new Error(votesRes.error.message);

  return pollRows.map((poll) => {
    const options = (optionsRes.data ?? []).filter((o) => o.poll_id === poll.id);
    const votesForPoll = (votesRes.data ?? []).filter((v) => v.poll_id === poll.id);
    return {
      id: poll.id,
      question: poll.question,
      totalVotes: votesForPoll.length,
      timeLeft: poll.closes_at ? new Date(poll.closes_at).toLocaleDateString() : 'Open',
      options: options.map((o) => ({ id: o.id, label: o.label, votes: votesForPoll.filter((v) => v.option_id === o.id).length })),
    };
  });
}

export async function listPolls(workspaceId: string): Promise<ActivePoll[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('polls').select('id,question,closes_at,created_at').eq('workspace_id', workspaceId).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return hydratePolls(data ?? []);
}

export async function createPoll(workspaceId: string, question: string, optionLabels: string[], closesAt?: string | null) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('create_poll', { p_workspace_id: workspaceId, p_question: question, p_option_labels: optionLabels, p_closes_at: closesAt ?? null });
  if (error) throw new Error(error.message);
}

export async function castPollVote(pollId: string, optionId: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('cast_poll_vote', { p_poll_id: pollId, p_option_id: optionId });
  if (error) throw new Error(error.message);
}

export async function getMyPollVote(pollId: string, userId: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('poll_votes').select('option_id').eq('poll_id', pollId).eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.option_id ?? null;
}

export async function createDiscussion(workspaceId: string, title: string, summary: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.from('discussions').insert({ workspace_id: workspaceId, title, summary, status: 'active' }).select('id,title,summary,status,created_at,updated_at').single();
  if (error) throw new Error(error.message);
  return data;
}

export async function sendMessage(
  discussionId: string,
  authorId: string,
  body: string,
  intent: 'whisper' | 'standard' | 'pulse',
  attachment?: { url: string; type: 'image' | 'audio' } | null
) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('messages')
    .insert({ discussion_id: discussionId, author_id: authorId, body, intent, attachment_url: attachment?.url ?? null, attachment_type: attachment?.type ?? null })
    .select('id,discussion_id,body,created_at,author_id')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Uploads an image or voice-note blob to the pulse-media bucket and returns its public URL. */
export async function uploadMedia(file: Blob, kind: 'image' | 'audio', userId: string): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const ext = kind === 'audio' ? 'webm' : (file as File).name?.split('.').pop() || 'jpg';
  const path = `${userId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('pulse-media').upload(path, file, { contentType: file.type || undefined });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('pulse-media').getPublicUrl(path);
  return data.publicUrl;
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


export async function getWorkspaceById(workspaceId: string): Promise<WorkspaceSummary | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('workspaces').select('id,name').eq('id', workspaceId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const { count } = await supabase.from('workspace_members').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId);
  return { id: data.id, name: data.name, memberCount: count ?? 0 };
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

export interface WorkspaceResource {
  id: string;
  name: string;
  url: string | null;
  decisionId: string | null;
  decisionTitle: string | null;
  createdAt: string;
}

export async function listWorkspaceResources(workspaceId: string): Promise<WorkspaceResource[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('resources')
    .select('id,name,url,decision_id,created_at,decision:decision_id(title)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  type ResourceRow = { id: string; name: string; url: string | null; decision_id: string | null; created_at: string; decision: { title: string } | { title: string }[] | null };
  return (data ?? []).map((row) => {
    const r = row as unknown as ResourceRow;
    const decision = Array.isArray(r.decision) ? r.decision[0] : r.decision;
    return {
      id: r.id,
      name: r.name,
      url: r.url,
      decisionId: r.decision_id,
      decisionTitle: decision?.title ?? null,
      createdAt: r.created_at,
    };
  });
}

export async function addWorkspaceResource(workspaceId: string, name: string, url: string, uploadedBy: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('resources').insert({ workspace_id: workspaceId, name, url, storage_path: url, uploaded_by: uploadedBy });
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

  const others = mentionedUserIds.filter((id) => id !== authorId);
  if (others.length > 0) {
    const { data: author } = await supabase.from('profiles').select('full_name').eq('id', authorId).maybeSingle();
    await Promise.all(others.map((id) => notifyMentioned(id, author?.full_name ?? 'A teammate', body.slice(0, 140))));
  }
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

// ============================================================================
// Phase 5: Multi-workspace
// ============================================================================

export async function listMyWorkspaces(userId: string): Promise<WorkspaceListItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('workspace_members').select('role,workspace:workspace_id(id,name)').eq('user_id', userId);
  if (error) throw new Error(error.message);
  type Row = { role: string; workspace: { id: string; name: string } | { id: string; name: string }[] | null };
  return ((data ?? []) as unknown as Row[])
    .map((row) => {
      const ws = Array.isArray(row.workspace) ? row.workspace[0] : row.workspace;
      return ws ? { id: ws.id, name: ws.name, role: row.role } : null;
    })
    .filter((w): w is WorkspaceListItem => w !== null);
}

// ============================================================================
// Phase 3: Actions / Tasks
// ============================================================================

type ActionRow = {
  id: string; workspace_id: string; decision_id: string | null; title: string; description: string | null;
  owner_id: string | null; deadline: string | null; status: ActionStatus; priority: ActionPriority; created_at: string;
  jira_issue_key: string | null;
  owner: { full_name: string } | { full_name: string }[] | null;
  decision: { title: string } | { title: string }[] | null;
};

function mapActionRow(row: ActionRow): WorkspaceAction {
  const owner = Array.isArray(row.owner) ? row.owner[0] : row.owner;
  const decision = Array.isArray(row.decision) ? row.decision[0] : row.decision;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    decisionId: row.decision_id,
    decisionTitle: decision?.title ?? null,
    title: row.title,
    description: row.description ?? '',
    ownerId: row.owner_id,
    ownerName: owner?.full_name ?? null,
    deadline: row.deadline,
    status: row.status,
    priority: row.priority,
    createdAt: row.created_at,
    jiraIssueKey: row.jira_issue_key,
  };
}

const ACTION_SELECT = 'id,workspace_id,decision_id,title,description,owner_id,deadline,status,priority,created_at,jira_issue_key,owner:owner_id(full_name),decision:decision_id(title)';

export async function listActions(workspaceId: string): Promise<WorkspaceAction[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('actions').select(ACTION_SELECT).eq('workspace_id', workspaceId).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapActionRow(row as unknown as ActionRow));
}

export interface CreateActionInput {
  title: string;
  description?: string;
  ownerId?: string | null;
  deadline?: string | null;
  priority?: ActionPriority;
  decisionId?: string | null;
}

export async function createAction(workspaceId: string, input: CreateActionInput, createdBy: string): Promise<WorkspaceAction> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('actions')
    .insert({
      workspace_id: workspaceId,
      decision_id: input.decisionId ?? null,
      title: input.title,
      description: input.description ?? '',
      owner_id: input.ownerId ?? null,
      deadline: input.deadline ?? null,
      priority: input.priority ?? 'medium',
      created_by: createdBy,
    })
    .select(ACTION_SELECT)
    .single();
  if (error) throw new Error(error.message);
  const created = mapActionRow(data as unknown as ActionRow);
  if (created.ownerId && created.ownerId !== createdBy) {
    const { data: ws } = await supabase.from('workspaces').select('name').eq('id', workspaceId).maybeSingle();
    await notifyActionAssigned(created.ownerId, created.title, ws?.name ?? 'your workspace');
  }
  return created;
}

export async function updateActionStatus(actionId: string, status: ActionStatus) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('actions').update({ status, updated_at: new Date().toISOString() }).eq('id', actionId);
  if (error) throw new Error(error.message);
}

// ============================================================================
// Phase 3: Global search + decision-history search
// ============================================================================

export async function globalSearch(workspaceId: string, query: string): Promise<GlobalSearchResults> {
  const empty: GlobalSearchResults = { discussions: [], decisions: [], actions: [], resources: [], people: [] };
  if (!supabase || !query.trim()) return empty;
  const like = `%${query.trim()}%`;

  const [discussions, decisions, actions, resources, people] = await Promise.all([
    supabase.from('discussions').select('id,title,summary').eq('workspace_id', workspaceId).or(`title.ilike.${like},summary.ilike.${like}`).limit(8),
    supabase.from('decisions').select('id,title,description').eq('workspace_id', workspaceId).or(`title.ilike.${like},description.ilike.${like}`).limit(8),
    supabase.from('actions').select('id,title').eq('workspace_id', workspaceId).ilike('title', like).limit(8),
    supabase.from('resources').select('id,name,url').eq('workspace_id', workspaceId).ilike('name', like).limit(8),
    supabase.from('workspace_members').select('user_id,profiles:user_id(full_name,email:user_id)').eq('workspace_id', workspaceId).limit(50),
  ]);

  if (discussions.error) throw new Error(discussions.error.message);
  if (decisions.error) throw new Error(decisions.error.message);
  if (actions.error) throw new Error(actions.error.message);
  if (resources.error) throw new Error(resources.error.message);

  // People are matched client-side since profiles has no email column to filter by directly here.
  const memberRows = people.error ? [] : (people.data ?? []);
  type MemberRow = { user_id: string; profiles: { full_name: string } | { full_name: string }[] | null };
  const q = query.trim().toLowerCase();
  const matchedPeople = (memberRows as unknown as MemberRow[])
    .map((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return { id: row.user_id, name: profile?.full_name ?? 'PULSE Member', email: '' };
    })
    .filter((p) => p.name.toLowerCase().includes(q))
    .slice(0, 8);

  return {
    discussions: (discussions.data ?? []).map((r) => ({ id: r.id, title: r.title, summary: r.summary ?? '' })),
    decisions: (decisions.data ?? []).map((r) => ({ id: r.id, title: r.title, description: r.description ?? '' })),
    actions: (actions.data ?? []).map((r) => ({ id: r.id, title: r.title })),
    resources: (resources.data ?? []).map((r) => ({ id: r.id, name: r.name, url: r.url })),
    people: matchedPeople,
  };
}

export interface DecisionHistorySearchEntry extends DecisionHistoryEntry {
  decisionId: string;
  decisionTitle: string;
}

export async function searchDecisionHistory(workspaceId: string, query: string): Promise<DecisionHistorySearchEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('decision_history')
    .select('id,status,outcome,note,created_at,changed_by:changed_by(full_name),decision:decision_id(id,title,workspace_id)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  type Row = {
    id: string; status: string | null; outcome: string | null; note: string | null; created_at: string;
    changed_by: { full_name: string } | { full_name: string }[] | null;
    decision: { id: string; title: string; workspace_id: string } | { id: string; title: string; workspace_id: string }[] | null;
  };
  const q = query.trim().toLowerCase();
  return ((data ?? []) as unknown as Row[])
    .map((row) => {
      const decision = Array.isArray(row.decision) ? row.decision[0] : row.decision;
      const changedBy = Array.isArray(row.changed_by) ? row.changed_by[0] : row.changed_by;
      if (!decision || decision.workspace_id !== workspaceId) return null;
      return {
        id: row.id,
        status: row.status,
        outcome: row.outcome,
        note: row.note,
        changedByName: changedBy?.full_name ?? null,
        createdAt: row.created_at,
        decisionId: decision.id,
        decisionTitle: decision.title,
      };
    })
    .filter((e): e is DecisionHistorySearchEntry => e !== null)
    .filter((e) => !q || e.decisionTitle.toLowerCase().includes(q) || (e.note ?? '').toLowerCase().includes(q) || (e.outcome ?? '').toLowerCase().includes(q));
}

// ============================================================================
// Phase 4: standalone PULSE AI assistant
// ============================================================================

export async function listAssistantMessages(workspaceId: string, userId: string): Promise<AssistantMessage[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('assistant_messages').select('id,role,content,created_at').eq('workspace_id', workspaceId).eq('user_id', userId).order('created_at', { ascending: true }).limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({ id: row.id, role: row.role as 'user' | 'assistant', content: row.content, createdAt: row.created_at }));
}

export async function sendAssistantMessage(workspaceId: string, content: string): Promise<AssistantMessage> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.functions.invoke('pulse-assistant', { body: { workspaceId, content } });
  if (error) throw new Error(error.message);
  return { id: data.id, role: 'assistant', content: data.content, createdAt: data.createdAt ?? new Date().toISOString() };
}

// ============================================================================
// Phase 4: Meeting summaries
// ============================================================================

export async function listMeetingSummaries(workspaceId: string): Promise<MeetingSummary[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('meeting_summaries').select('id,title,raw_notes,summary,key_points,action_items,created_at').eq('workspace_id', workspaceId).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id, title: row.title, rawNotes: row.raw_notes, summary: row.summary,
    keyPoints: row.key_points, actionItems: row.action_items, createdAt: row.created_at,
  }));
}

export async function createMeetingSummary(workspaceId: string, title: string, rawNotes: string): Promise<MeetingSummary> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.functions.invoke('meeting-summary', { body: { workspaceId, title, rawNotes } });
  if (error) throw new Error(error.message);
  return {
    id: data.id, title: data.title ?? title, rawNotes, summary: data.summary,
    keyPoints: data.keyPoints, actionItems: data.actionItems, createdAt: data.createdAt ?? new Date().toISOString(),
  };
}

// ============================================================================
// Phase 4: Risk Center — rule-based, computed from real data, never fabricated
// ============================================================================

export async function computeRisks(workspaceId: string): Promise<RiskItem[]> {
  if (!supabase) return [];
  const risks: RiskItem[] = [];
  const STALE_DAYS = 4;
  const now = Date.now();

  const [discussionsRes, decisionsRes, tallyRes, actionsRes] = await Promise.all([
    supabase.from('discussions').select('id,title,updated_at,status').eq('workspace_id', workspaceId),
    supabase.from('decisions').select('id,title,created_at,outcome').eq('workspace_id', workspaceId).is('outcome', null),
    supabase.from('decision_votes').select('decision_id,choice'),
    supabase.from('actions').select('id,title,deadline,status').eq('workspace_id', workspaceId).neq('status', 'done'),
  ]);
  if (discussionsRes.error) throw new Error(discussionsRes.error.message);
  if (decisionsRes.error) throw new Error(decisionsRes.error.message);
  if (tallyRes.error) throw new Error(tallyRes.error.message);
  if (actionsRes.error) throw new Error(actionsRes.error.message);

  for (const d of discussionsRes.data ?? []) {
    if (d.status === 'archived') continue;
    const daysSince = (now - new Date(d.updated_at).getTime()) / 86400000;
    if (daysSince >= STALE_DAYS) {
      risks.push({
        id: `stalled-${d.id}`, kind: 'stalled-discussion', severity: daysSince >= 8 ? 'high' : 'medium',
        title: d.title, detail: `No activity for ${Math.floor(daysSince)} days.`, linkId: d.id,
      });
    }
  }

  const openDecisions = decisionsRes.data ?? [];
  const votesByDecision = new Map<string, { yes: number; no: number }>();
  for (const v of tallyRes.data ?? []) {
    const entry = votesByDecision.get(v.decision_id) ?? { yes: 0, no: 0 };
    if (v.choice === 'yes') entry.yes += 1;
    else if (v.choice === 'no') entry.no += 1;
    votesByDecision.set(v.decision_id, entry);
  }
  for (const d of openDecisions) {
    const tally = votesByDecision.get(d.id);
    if (!tally) continue;
    const total = tally.yes + tally.no;
    if (total >= 3 && Math.abs(tally.yes - tally.no) / total <= 0.2) {
      risks.push({
        id: `disagreement-${d.id}`, kind: 'disagreement', severity: 'high',
        title: d.title, detail: `Split vote: ${tally.yes} yes vs ${tally.no} no.`, linkId: d.id,
      });
    }
    const ageDays = (now - new Date(d.created_at).getTime()) / 86400000;
    if (ageDays >= 7) {
      risks.push({
        id: `stuck-${d.id}`, kind: 'missing-evidence', severity: ageDays >= 14 ? 'high' : 'medium',
        title: d.title, detail: `In review for ${Math.floor(ageDays)} days with no recorded outcome.`, linkId: d.id,
      });
    }
  }

  for (const a of actionsRes.data ?? []) {
    if (!a.deadline) continue;
    if (new Date(a.deadline).getTime() < now) {
      risks.push({
        id: `overdue-${a.id}`, kind: 'overdue-action', severity: 'medium',
        title: a.title, detail: `Was due ${new Date(a.deadline).toLocaleDateString()}.`, linkId: a.id,
      });
    }
  }

  return risks.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'high' ? -1 : 1));
}

// ============================================================================
// Phase 5: Audit log
// ============================================================================

export async function listAuditLog(workspaceId: string): Promise<AuditLogEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('audit_log').select('id,action,detail,created_at,actor:actor_id(full_name)').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  type Row = { id: string; action: string; detail: string | null; created_at: string; actor: { full_name: string } | { full_name: string }[] | null };
  return ((data ?? []) as unknown as Row[]).map((row) => {
    const actor = Array.isArray(row.actor) ? row.actor[0] : row.actor;
    return { id: row.id, action: row.action, detail: row.detail, actorName: actor?.full_name ?? null, createdAt: row.created_at };
  });
}

// ============================================================================
// Phase 5: Analytics — every number here is computed from real rows, never mocked
// ============================================================================

export async function computeAnalytics(workspaceId: string): Promise<AnalyticsSnapshot> {
  const empty: AnalyticsSnapshot = {
    decisionsThisMonth: 0,
    avgDecisionDays: null,
    stuckDecisions: 0,
    completedDecisions: 0,
    participationPct: 0,
    overdueActions: 0,
    activeDecisions: 0,
    decisionOutcomeRate: 0,
    actionCompletionRate: 0,
    decisionsLast7d: 0,
    decisionsPrevious7d: 0,
    alignmentPct: 0,
    discussionActivity: [],
    topBottlenecks: [],
  };
  if (!supabase) return empty;

  const [decisionsRes, membersRes, votesRes, actionsRes, messagesRes] = await Promise.all([
    supabase.from('decisions').select('id,title,created_at,decided_at,outcome').eq('workspace_id', workspaceId),
    supabase.from('workspace_members').select('user_id').eq('workspace_id', workspaceId),
    supabase.from('decision_votes').select('user_id,decision_id,choice,created_at,decisions!inner(workspace_id)').eq('decisions.workspace_id', workspaceId),
    supabase.from('actions').select('id,title,deadline,status,created_at').eq('workspace_id', workspaceId),
    supabase.from('messages').select('id,created_at,discussion_id,discussions!inner(workspace_id)').eq('discussions.workspace_id', workspaceId).limit(1000),
  ]);
  if (decisionsRes.error) throw new Error(decisionsRes.error.message);
  if (membersRes.error) throw new Error(membersRes.error.message);
  if (votesRes.error) throw new Error(votesRes.error.message);
  if (actionsRes.error) throw new Error(actionsRes.error.message);

  const decisions = decisionsRes.data ?? [];
  const actions = actionsRes.data ?? [];
  const now = Date.now();
  const date = new Date(now);
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  const sevenDaysAgo = now - 7 * 86400000;
  const fourteenDaysAgo = now - 14 * 86400000;

  const decisionsThisMonth = decisions.filter((d) => new Date(d.created_at).getTime() >= monthStart).length;
  const decisionsLast7d = decisions.filter((d) => new Date(d.created_at).getTime() >= sevenDaysAgo).length;
  const decisionsPrevious7d = decisions.filter((d) => {
    const t = new Date(d.created_at).getTime();
    return t >= fourteenDaysAgo && t < sevenDaysAgo;
  }).length;

  const decidedOnes = decisions.filter((d) => d.decided_at);
  const avgDecisionDays = decidedOnes.length
    ? decidedOnes.reduce((sum, d) => sum + (new Date(d.decided_at!).getTime() - new Date(d.created_at).getTime()), 0) / decidedOnes.length / 86400000
    : null;

  const activeDecisions = decisions.filter((d) => !d.outcome).length;
  const stuckDecisions = decisions.filter((d) => !d.outcome && (now - new Date(d.created_at).getTime()) / 86400000 >= 7).length;
  const completedDecisions = decisions.filter((d) => Boolean(d.outcome)).length;
  const decisionOutcomeRate = decisions.length ? Math.round((completedDecisions / decisions.length) * 100) : 0;

  const memberIds = new Set((membersRes.data ?? []).map((m) => m.user_id));
  const recentVoters = new Set(
    (votesRes.data ?? [])
      .filter((v) => new Date(v.created_at).getTime() >= sevenDaysAgo)
      .map((v) => v.user_id),
  );
  const participationPct = memberIds.size
    ? Math.round(([...memberIds].filter((id) => recentVoters.has(id)).length / memberIds.size) * 100)
    : 0;

  const activeActions = actions.filter((a) => a.status !== 'done');
  const completedActions = actions.filter((a) => a.status === 'done').length;
  const actionCompletionRate = actions.length ? Math.round((completedActions / actions.length) * 100) : 0;
  const overdueActions = activeActions.filter((a) => a.deadline && new Date(a.deadline).getTime() < now).length;

  const voteRows = (votesRes.data ?? []) as { decision_id: string; choice: string }[];
  const byDecision = new Map<string, { yes: number; no: number; total: number }>();
  for (const vote of voteRows) {
    if (vote.choice === 'needs_info') continue;
    const current = byDecision.get(vote.decision_id) ?? { yes: 0, no: 0, total: 0 };
    if (vote.choice === 'yes') current.yes += 1;
    if (vote.choice === 'no') current.no += 1;
    current.total += 1;
    byDecision.set(vote.decision_id, current);
  }
  const alignmentScores = [...byDecision.values()].filter((v) => v.total > 0).map((v) => Math.max(v.yes, v.no) / v.total * 100);
  const alignmentPct = alignmentScores.length ? Math.round(alignmentScores.reduce((a, b) => a + b, 0) / alignmentScores.length) : 0;

  const discussionActivity: { label: string; count: number }[] = [];
  if (!messagesRes.error) {
    const byDay = new Map<string, number>();
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date(now - i * 86400000);
      byDay.set(d.toISOString().slice(0, 10), 0);
    }
    for (const m of messagesRes.data ?? []) {
      const key = new Date(m.created_at).toISOString().slice(0, 10);
      if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }
    for (const [key, count] of byDay) {
      const d = new Date(`${key}T00:00:00`);
      discussionActivity.push({ label: d.toLocaleDateString('en-US', { weekday: 'short' }), count });
    }
  }

  const bottlenecks: { label: string; count: number; detail: string }[] = [];
  if (stuckDecisions > 0) bottlenecks.push({ label: 'Stalled decisions', count: stuckDecisions, detail: 'Open for 7+ days without an outcome.' });
  if (overdueActions > 0) bottlenecks.push({ label: 'Overdue actions', count: overdueActions, detail: 'Open actions have passed their deadline.' });
  const splitDecisions = [...byDecision.values()].filter((v) => v.total >= 3 && Math.abs(v.yes - v.no) / v.total <= 0.2).length;
  if (splitDecisions > 0) bottlenecks.push({ label: 'Low alignment', count: splitDecisions, detail: 'Decisions have closely split yes/no votes.' });
  const lowParticipation = memberIds.size > 0 && participationPct < 50;
  if (lowParticipation) bottlenecks.push({ label: 'Low participation', count: memberIds.size, detail: 'Less than half of members voted in the last 7 days.' });
  bottlenecks.sort((a, b) => b.count - a.count);

  return {
    decisionsThisMonth,
    avgDecisionDays,
    stuckDecisions,
    completedDecisions,
    participationPct,
    overdueActions,
    activeDecisions,
    decisionOutcomeRate,
    actionCompletionRate,
    decisionsLast7d,
    decisionsPrevious7d,
    alignmentPct,
    discussionActivity,
    topBottlenecks: bottlenecks.slice(0, 4),
  };
}

// ============================================================================
// Phase 5: Billing (scaffold — inert until a real Stripe account is connected)
// ============================================================================

export async function getWorkspaceSubscription(workspaceId: string): Promise<WorkspaceSubscription> {
  if (!supabase) return { plan: 'free', status: 'active', currentPeriodEnd: null };
  const { data, error } = await supabase.from('workspace_subscriptions').select('plan,status,current_period_end').eq('workspace_id', workspaceId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { plan: 'free', status: 'active', currentPeriodEnd: null };
  return { plan: data.plan, status: data.status, currentPeriodEnd: data.current_period_end };
}

export async function startCheckout(workspaceId: string, plan: 'pro' | 'business'): Promise<{ url: string | null; error: string | null }> {
  if (!supabase) return { url: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.functions.invoke('stripe-checkout', { body: { workspaceId, plan } });
  if (error) return { url: null, error: error.message };
  return { url: data?.url ?? null, error: data?.error ?? null };
}

// ============================================================================
// Phase 6: Integrations
// ============================================================================

const ALL_PROVIDERS: IntegrationProvider[] = ['slack', 'teams', 'google', 'microsoft365', 'jira', 'notion'];

export async function listWorkspaceIntegrations(workspaceId: string): Promise<WorkspaceIntegration[]> {
  if (!supabase) return ALL_PROVIDERS.map((provider) => ({ provider, status: 'disconnected', connectedAt: null }));
  const { data, error } = await supabase.from('workspace_integrations').select('provider,status,connected_at').eq('workspace_id', workspaceId);
  if (error) throw new Error(error.message);
  const byProvider = new Map((data ?? []).map((row) => [row.provider, row]));
  return ALL_PROVIDERS.map((provider) => {
    const row = byProvider.get(provider);
    return { provider, status: (row?.status as 'connected' | 'disconnected') ?? 'disconnected', connectedAt: row?.connected_at ?? null };
  });
}

/** Starts a server-side, one-time-state OAuth flow for a provider. */
export async function startIntegrationOAuth(workspaceId: string, provider: 'slack' | 'google' | 'microsoft365' | 'jira') {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.functions.invoke('oauth-start', { body: { workspaceId, provider } });
  if (error) throw new Error(error.message);
  if (!data?.url) throw new Error(data?.error ?? 'Unable to start secure OAuth.');
  window.location.assign(data.url);
}

export function connectSlack(workspaceId: string) { return startIntegrationOAuth(workspaceId, 'slack'); }
export function connectGoogle(workspaceId: string) { return startIntegrationOAuth(workspaceId, 'google'); }
export function connectMicrosoft(workspaceId: string) { return startIntegrationOAuth(workspaceId, 'microsoft365'); }
export function connectJira(workspaceId: string) { return startIntegrationOAuth(workspaceId, 'jira'); }

export async function disconnectIntegration(workspaceId: string, provider: IntegrationProvider) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.functions.invoke('disconnect-integration', { body: { workspaceId, provider } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
}

export async function hasCastAnyVote(userId: string): Promise<boolean> {
  if (!supabase) return false;
  const { count } = await supabase.from('decision_votes').select('*', { count: 'exact', head: true }).eq('user_id', userId);
  return (count ?? 0) > 0;
}

// ============================================================================
// Founder traction metrics (platform admins only — see schema.sql platform_admins)
// ============================================================================

export async function isPlatformAdmin(): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('is_platform_admin');
  if (error) return false;
  return Boolean(data);
}

export async function getPlatformMetrics(): Promise<PlatformMetrics | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_platform_metrics');
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    totalWorkspaces: Number(row.total_workspaces ?? 0),
    totalUsers: Number(row.total_users ?? 0),
    decisionsCreated7d: Number(row.decisions_created_7d ?? 0),
    decisionsCreated30d: Number(row.decisions_created_30d ?? 0),
    votesCast7d: Number(row.votes_cast_7d ?? 0),
    discussionsCreated7d: Number(row.discussions_created_7d ?? 0),
    weeklyActiveUsers: Number(row.weekly_active_users ?? 0),
  };
}

export async function logProductEvent(eventName: string, workspaceId?: string | null, metadata?: Record<string, unknown>) {
  if (!supabase) return;
  await supabase.rpc('log_product_event', { p_event_name: eventName, p_workspace_id: workspaceId ?? null, p_metadata: metadata ?? {} });
}

// ============================================================================
// Account settings
// ============================================================================

export async function getMyProfile(userId: string): Promise<ProfileDetails | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('profiles').select('full_name,email,phone,bio,avatar_url').eq('id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { fullName: data.full_name, email: data.email ?? '', phone: data.phone ?? '', bio: data.bio ?? '', avatarUrl: data.avatar_url };
}

export async function updateMyProfile(userId: string, updates: { fullName?: string; phone?: string; bio?: string; avatarUrl?: string }) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('profiles').update({
    ...(updates.fullName !== undefined ? { full_name: updates.fullName } : {}),
    ...(updates.phone !== undefined ? { phone: updates.phone } : {}),
    ...(updates.bio !== undefined ? { bio: updates.bio } : {}),
    ...(updates.avatarUrl !== undefined ? { avatar_url: updates.avatarUrl } : {}),
    updated_at: new Date().toISOString(),
  }).eq('id', userId);
  if (error) throw new Error(error.message);
}

/** Triggers Supabase's email-change confirmation flow (an email is sent to confirm). */
export async function changeMyEmail(newEmail: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) throw new Error(error.message);
}

export async function changeMyPassword(newPassword: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

export async function sendPasswordResetEmail(email: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  if (error) throw new Error(error.message);
}

/** Signs out every OTHER session for this user, leaving the current device signed in. */
export async function signOutOtherDevices() {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.auth.signOut({ scope: 'others' });
  if (error) throw new Error(error.message);
}

export async function recordLogin(userId: string) {
  if (!supabase) return;
  await supabase.from('login_history').insert({ user_id: userId, user_agent: navigator.userAgent });
}

export async function listLoginHistory(userId: string): Promise<LoginHistoryEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('login_history').select('id,user_agent,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({ id: row.id, userAgent: row.user_agent, createdAt: row.created_at }));
}

export async function deleteMyAccount(): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: 'Not signed in.' };
  const { data, error } = await supabase.functions.invoke('delete-account', {});
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  return { error: null };
}

/** Gathers everything the user owns/authored across their workspaces into one JSON export. */
export async function exportMyData(userId: string): Promise<Record<string, unknown>> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const [profile, workspaces, decisions, comments, votes, actions] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('workspace_members').select('role,workspaces(id,name)').eq('user_id', userId),
    supabase.from('decisions').select('*').eq('created_by', userId),
    supabase.from('decision_comments').select('*').eq('author_id', userId),
    supabase.from('decision_votes').select('*').eq('user_id', userId),
    supabase.from('actions').select('*').eq('owner_id', userId),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    profile: profile.data ?? null,
    workspaces: workspaces.data ?? [],
    decisionsCreated: decisions.data ?? [],
    comments: comments.data ?? [],
    votes: votes.data ?? [],
    actionsAssigned: actions.data ?? [],
  };
}

// ============================================================================
// Notification preferences
// ============================================================================

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const fallback: NotificationPreferences = { emailEnabled: true, pushEnabled: true, notifyMentions: true, notifyDecisions: true, notifyActions: true, notifyInvitations: true, digestFrequency: 'weekly' };
  if (!supabase) return fallback;
  const { data, error } = await supabase.from('notification_preferences').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return fallback;
  return {
    emailEnabled: data.email_enabled, pushEnabled: data.push_enabled, notifyMentions: data.notify_mentions, notifyDecisions: data.notify_decisions,
    notifyActions: data.notify_actions, notifyInvitations: data.notify_invitations, digestFrequency: data.digest_frequency,
  };
}

export async function updateNotificationPreferences(userId: string, prefs: NotificationPreferences) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('notification_preferences').upsert({
    user_id: userId, email_enabled: prefs.emailEnabled, push_enabled: prefs.pushEnabled, notify_mentions: prefs.notifyMentions, notify_decisions: prefs.notifyDecisions,
    notify_actions: prefs.notifyActions, notify_invitations: prefs.notifyInvitations, digest_frequency: prefs.digestFrequency,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

/** Fire-and-forget: sends a real notification email, silently doing nothing if the recipient turned that category off. */
async function notifyByEmail(userId: string, category: 'mentions' | 'decisions' | 'actions' | 'invitations', subject: string, heading: string, body: string) {
  if (!supabase) return;
  try { await supabase.functions.invoke('send-notification-email', { body: { userId, category, subject, heading, body } }); }
  catch { /* best-effort — a failed notification email should never block the underlying action */ }
}

/** Fire-and-forget: sends a real browser push notification, respecting the same per-category + push-enabled preferences as email. */
async function notifyByPush(userId: string, category: 'mentions' | 'decisions' | 'actions' | 'invitations', title: string, body: string) {
  if (!supabase) return;
  try { await supabase.functions.invoke('send-push-notification', { body: { userId, category, title, body } }); }
  catch { /* best-effort — push failures never block the underlying action */ }
}

export interface PulseNotification { id: string; type: string; title: string; body: string | null; readAt: string | null; createdAt: string; }

export async function listNotifications(limit = 40): Promise<PulseNotification[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, readAt: n.read_at, createdAt: n.created_at }));
}

export async function markNotificationRead(id: string) {
  if (!supabase) return;
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function notifyActionAssigned(ownerId: string, actionTitle: string, workspaceName: string) {
  await Promise.all([
    notifyByEmail(ownerId, 'actions', `New action assigned: ${actionTitle}`, 'You\'ve been assigned an action', `You were assigned "${actionTitle}" in ${workspaceName}.`),
    notifyByPush(ownerId, 'actions', 'New action assigned', `You were assigned "${actionTitle}" in ${workspaceName}.`),
  ]);
}

export async function notifyMentioned(mentionedUserId: string, mentionerName: string, context: string) {
  await Promise.all([
    notifyByEmail(mentionedUserId, 'mentions', `${mentionerName} mentioned you`, 'You were mentioned', `${mentionerName} mentioned you: "${context}"`),
    notifyByPush(mentionedUserId, 'mentions', `${mentionerName} mentioned you`, context),
  ]);
}

// ============================================================================
// ============================================================================
// PULSE Automation
// ============================================================================

export interface AutomationRule {
  id: string; workspaceId: string; name: string; trigger: string; enabled: boolean;
}

export interface AutomationRun {
  id: string; ruleName: string; actionCount: number; createdAt: string;
}

export async function listAutomationRules(workspaceId: string): Promise<AutomationRule[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('automation_rules').select('*').eq('workspace_id', workspaceId).order('created_at');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ id: r.id, workspaceId: r.workspace_id, name: r.name, trigger: r.trigger, enabled: r.enabled }));
}

export async function updateAutomationRule(id: string, enabled: boolean) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('automation_rules').update({ enabled }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function runWorkspaceAutomations(workspaceId: string): Promise<{ processed: number; notifications: number }> {
  if (!supabase) return { processed: 0, notifications: 0 };
  const { data, error } = await supabase.rpc('run_workspace_automations', { target_workspace: workspaceId });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return { processed: Number(row?.processed ?? 0), notifications: Number(row?.notifications ?? 0) };
}

export async function listAutomationRuns(workspaceId: string): Promise<AutomationRun[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('automation_runs').select('id,rule_id,action_count,created_at,automation_rules(name)').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(30);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({ id: r.id, ruleName: r.automation_rules?.name ?? 'Automation', actionCount: Number(r.action_count ?? 0), createdAt: r.created_at }));
}

// Workspace general settings + usage
// ============================================================================

export async function getWorkspaceGeneral(workspaceId: string): Promise<WorkspaceGeneralSettings | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('workspaces').select('name,description,ai_enabled,default_language,timezone').eq('id', workspaceId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { name: data.name, description: data.description ?? '', aiEnabled: data.ai_enabled, defaultLanguage: data.default_language, timezone: data.timezone };
}

export async function updateWorkspaceGeneral(workspaceId: string, updates: Partial<{ name: string; description: string; aiEnabled: boolean; defaultLanguage: string; timezone: string }>) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('workspaces').update({
    ...(updates.name !== undefined ? { name: updates.name } : {}),
    ...(updates.description !== undefined ? { description: updates.description } : {}),
    ...(updates.aiEnabled !== undefined ? { ai_enabled: updates.aiEnabled } : {}),
    ...(updates.defaultLanguage !== undefined ? { default_language: updates.defaultLanguage } : {}),
    ...(updates.timezone !== undefined ? { timezone: updates.timezone } : {}),
    updated_at: new Date().toISOString(),
  }).eq('id', workspaceId);
  if (error) throw new Error(error.message);
}

export async function deleteWorkspace(workspaceId: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('workspaces').delete().eq('id', workspaceId);
  if (error) throw new Error(error.message);
}

export async function getWorkspaceUsage(workspaceId: string): Promise<WorkspaceUsage> {
  const empty: WorkspaceUsage = { activeMembers: 0, discussionsCreated: 0, decisionsMade: 0, pollsCreated: 0, aiAnalysesRun: 0 };
  if (!supabase) return empty;
  const [members, discussions, decisions, polls, ai] = await Promise.all([
    supabase.from('workspace_members').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
    supabase.from('discussions').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
    supabase.from('decisions').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
    supabase.from('polls').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
    supabase.from('decision_ai_analyses').select('id,decisions!inner(workspace_id)', { count: 'exact', head: true }).eq('decisions.workspace_id', workspaceId),
  ]);
  return {
    activeMembers: members.count ?? 0, discussionsCreated: discussions.count ?? 0, decisionsMade: decisions.count ?? 0,
    pollsCreated: polls.count ?? 0, aiAnalysesRun: ai.count ?? 0,
  };
}

// ============================================================================
// Web Push subscription management (client side)
// ============================================================================

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Asks the browser for notification permission and subscribes to push, saving the subscription for this user. */
export async function subscribeToPush(userId: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured.' };
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return { error: 'Push notifications are not supported in this browser.' };
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapidPublicKey) return { error: 'Push is not configured yet — VITE_VAPID_PUBLIC_KEY is missing.' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { error: 'Notification permission was not granted.' };

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToUint8Array(vapidPublicKey),
  });
  const raw = subscription.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: userId, endpoint: raw.endpoint!, p256dh: raw.keys!.p256dh, auth: raw.keys!.auth,
  }, { onConflict: 'endpoint' });
  if (error) return { error: error.message };
  return { error: null };
}

export async function unsubscribeFromPush(): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured.' };
  if (!('serviceWorker' in navigator)) return { error: null };
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return { error: null };
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) return { error: error.message };
  return { error: null };
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return subscription !== null;
}

// ============================================================================
// Admin API keys
// ============================================================================

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function listApiKeys(workspaceId: string): Promise<ApiKeySummary[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('api_keys').select('id,name,key_prefix,revoked,last_used_at,created_at').eq('workspace_id', workspaceId).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({ id: row.id, name: row.name, keyPrefix: row.key_prefix, revoked: row.revoked, lastUsedAt: row.last_used_at, createdAt: row.created_at }));
}

/** Creates a new API key and returns the FULL key exactly once — it is never retrievable again after this. */
export async function createApiKey(workspaceId: string, name: string, createdBy: string): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const randomBytes = crypto.getRandomValues(new Uint8Array(24));
  const fullKey = `pulse_sk_${Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('')}`;
  const keyHash = await sha256Hex(fullKey);
  const { error } = await supabase.from('api_keys').insert({ workspace_id: workspaceId, name, key_prefix: fullKey.slice(0, 16), key_hash: keyHash, created_by: createdBy });
  if (error) throw new Error(error.message);
  return fullKey;
}

export async function revokeApiKey(keyId: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('api_keys').update({ revoked: true }).eq('id', keyId);
  if (error) throw new Error(error.message);
}

// ============================================================================
// Incoming webhooks
// ============================================================================

export async function listIncomingWebhooks(workspaceId: string): Promise<IncomingWebhookSummary[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('incoming_webhooks').select('id,name,token,last_used_at,created_at').eq('workspace_id', workspaceId).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({ id: row.id, name: row.name, token: row.token, lastUsedAt: row.last_used_at, createdAt: row.created_at }));
}

export async function createIncomingWebhook(workspaceId: string, name: string, createdBy: string): Promise<IncomingWebhookSummary> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.from('incoming_webhooks').insert({ workspace_id: workspaceId, name, created_by: createdBy }).select('id,name,token,last_used_at,created_at').single();
  if (error) throw new Error(error.message);
  return { id: data.id, name: data.name, token: data.token, lastUsedAt: data.last_used_at, createdAt: data.created_at };
}

export async function deleteIncomingWebhook(id: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('incoming_webhooks').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ============================================================================
// Data retention
// ============================================================================

export async function getDataRetentionDays(workspaceId: string): Promise<number | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('workspaces').select('discussion_retention_days').eq('id', workspaceId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.discussion_retention_days ?? null;
}

export async function setDataRetentionDays(workspaceId: string, days: number | null) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('workspaces').update({ discussion_retention_days: days }).eq('id', workspaceId);
  if (error) throw new Error(error.message);
}

// ============================================================================
// Google / Microsoft / Jira / Notion integrations
// ============================================================================

export async function connectNotion(workspaceId: string, token: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { data, error } = await supabase.functions.invoke('notion-connect', { body: { workspaceId, token } });
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  return { error: null };
}

export async function syncGoogle(workspaceId: string): Promise<{ importedResources: number; upcomingEvents: { title: string; start: string | null }[]; error?: string }> {
  if (!supabase) return { importedResources: 0, upcomingEvents: [], error: 'Supabase is not configured.' };
  const { data, error } = await supabase.functions.invoke('google-sync', { body: { workspaceId } });
  if (error) return { importedResources: 0, upcomingEvents: [], error: error.message };
  return data;
}

export async function syncMicrosoft(workspaceId: string): Promise<{ importedResources: number; upcomingEvents: { title: string; start: string | null }[]; error?: string }> {
  if (!supabase) return { importedResources: 0, upcomingEvents: [], error: 'Supabase is not configured.' };
  const { data, error } = await supabase.functions.invoke('microsoft-sync', { body: { workspaceId } });
  if (error) return { importedResources: 0, upcomingEvents: [], error: error.message };
  return data;
}

export async function sendActionToJira(actionId: string, projectKey: string): Promise<{ issueKey?: string; url?: string | null; error?: string }> {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { data, error } = await supabase.functions.invoke('jira-create-issue', { body: { actionId, projectKey } });
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  return data;
}

// ============================================================================
// SSO domain mapping
// ============================================================================

export async function listSsoDomains(workspaceId: string): Promise<SsoDomainSummary[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('workspace_sso_domains').select('id,domain,default_role,created_at').eq('workspace_id', workspaceId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({ id: row.id, domain: row.domain, defaultRole: row.default_role, createdAt: row.created_at }));
}

export async function addSsoDomain(workspaceId: string, domain: string, createdBy: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('workspace_sso_domains').insert({ workspace_id: workspaceId, domain: domain.toLowerCase().trim(), created_by: createdBy });
  if (error) throw new Error(error.message);
}

export async function removeSsoDomain(id: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('workspace_sso_domains').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
