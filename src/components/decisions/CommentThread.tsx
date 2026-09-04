import { useMemo, useState, type FormEvent } from 'react';
import { CornerDownRight, Send, X } from 'lucide-react';
import type { DecisionComment } from '@/types';
import type { WorkspaceMember } from '@/lib/pulseApi';
import { extractMentionedUserIds, splitMentionSegments, suggestMentions } from '@/lib/mentions';

interface CommentThreadProps {
  comments: DecisionComment[];
  members: WorkspaceMember[];
  onSubmit: (body: string, mentionedUserIds: string[], parentCommentId: string | null) => Promise<void>;
}

function CommentBody({ body }: { body: string }) {
  return (
    <p className="text-sm text-ink-200">
      {splitMentionSegments(body).map((seg, i) =>
        seg.isMention ? (
          <span key={i} className="font-medium text-pulse-300">{seg.text}</span>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </p>
  );
}

export function CommentThread({ comments, members, onSubmit }: CommentThreadProps) {
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<DecisionComment | null>(null);
  const [busy, setBusy] = useState(false);

  const memberList = useMemo(() => members.map((m) => ({ id: m.userId, name: m.name })), [members]);
  const mentionQuery = useMemo(() => {
    const match = text.match(/@([a-zA-Z][a-zA-Z0-9 ._-]{0,40})$/);
    return match ? match[1] : null;
  }, [text]);
  const suggestions = mentionQuery !== null ? suggestMentions(mentionQuery, memberList) : [];

  const topLevel = comments.filter((c) => !c.parentCommentId);
  const repliesOf = (id: string) => comments.filter((c) => c.parentCommentId === id);

  const pickMention = (name: string) => {
    setText((t) => t.replace(/@([a-zA-Z][a-zA-Z0-9 ._-]{0,40})$/, `@${name} `));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await onSubmit(text.trim(), extractMentionedUserIds(text, memberList), replyTo?.id ?? null);
      setText('');
      setReplyTo(null);
    } finally {
      setBusy(false);
    }
  };

  const Comment = ({ comment, nested }: { comment: DecisionComment; nested?: boolean }) => (
    <div className={nested ? 'ml-8 mt-2' : ''}>
      <div className="flex gap-2.5">
        <div className="avatar h-7 w-7 shrink-0 text-[10px]">{comment.authorName.slice(0, 1).toUpperCase()}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-ink-100">{comment.authorName}</span>
            <span className="text-ink-500">{new Date(comment.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="mt-0.5"><CommentBody body={comment.body} /></div>
          {!nested && (
            <button onClick={() => setReplyTo(comment)} className="mt-1 flex items-center gap-1 text-[10px] font-medium text-ink-500 hover:text-pulse-300">
              <CornerDownRight className="h-3 w-3" /> Reply
            </button>
          )}
        </div>
      </div>
      {repliesOf(comment.id).map((reply) => <Comment key={reply.id} comment={reply} nested />)}
    </div>
  );

  return (
    <div>
      <h3 className="text-sm font-semibold">Team discussion</h3>
      <div className="mt-3 space-y-4">
        {topLevel.map((c) => <Comment key={c.id} comment={c} />)}
        {topLevel.length === 0 && <p className="text-xs text-ink-500">No comments yet — start the discussion.</p>}
      </div>

      <form onSubmit={submit} className="relative mt-4">
        {replyTo && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-white/5 bg-white/[.03] px-2.5 py-1.5 text-[11px] text-ink-400">
            Replying to <b className="text-ink-200">{replyTo.authorName}</b>
            <button type="button" onClick={() => setReplyTo(null)} className="ml-auto"><X className="h-3 w-3" /></button>
          </div>
        )}
        {suggestions.length > 0 && (
          <div className="absolute bottom-full mb-1 w-48 overflow-hidden rounded-xl border border-white/10 bg-ink-850 shadow-card">
            {suggestions.map((s) => (
              <button key={s.id} type="button" onClick={() => pickMention(s.name)} className="block w-full px-3 py-2 text-left text-xs hover:bg-white/5">
                {s.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment. Type @ to mention someone…"
            className="field flex-1 text-sm"
          />
          <button disabled={busy || !text.trim()} className="icon-btn shrink-0 bg-pulse-500/15 text-pulse-300 disabled:opacity-30">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
