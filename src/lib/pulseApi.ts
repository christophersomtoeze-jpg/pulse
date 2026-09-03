import type { ActivePoll, FeedMessage, PinnedDecision, TopicNode } from '@/types';
import { supabase } from '@/lib/supabase';

export interface WorkspaceSummary {
  id: string;
  name: string;
  memberCount: number;
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
  const { error } = await supabase.from('workspaces').insert({ name, slug, owner_id: userId });
  if (error) throw new Error(error.message);
  const { data: workspace, error: lookupError } = await supabase.from('workspaces').select('id,name').eq('slug', slug).single();
  if (lookupError) throw new Error(lookupError.message);
  const { error: memberError } = await supabase.from('workspace_members').insert({ workspace_id: workspace.id, user_id: userId, role: 'owner' });
  if (memberError) throw new Error(memberError.message);
  return workspace;
}
