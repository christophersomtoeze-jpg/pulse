import { useState } from 'react';
import { CircleHelp, Eye, EyeOff, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { DecisionVoteTally, VoteChoice } from '@/types';

interface VotingPanelProps {
  tally: DecisionVoteTally;
  disabled?: boolean;
  onVote: (choice: VoteChoice, anonymous: boolean) => Promise<void>;
}

const choices: { id: VoteChoice; label: string; icon: typeof ThumbsUp; color: string; bar: string }[] = [
  { id: 'yes', label: 'Yes', icon: ThumbsUp, color: 'text-flux-300 border-flux-500/30 bg-flux-500/10', bar: 'bg-flux-400' },
  { id: 'no', label: 'No', icon: ThumbsDown, color: 'text-ember-300 border-ember-500/30 bg-ember-500/10', bar: 'bg-ember-400' },
  { id: 'needs_info', label: 'Need more info', icon: CircleHelp, color: 'text-alert-300 border-alert-500/30 bg-alert-500/10', bar: 'bg-alert-400' },
];

export function VotingPanel({ tally, disabled, onVote }: VotingPanelProps) {
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState<VoteChoice | null>(null);

  const cast = async (choice: VoteChoice) => {
    setBusy(choice);
    try { await onVote(choice, anonymous); } finally { setBusy(null); }
  };

  const pct = (n: number) => (tally.total ? Math.round((n / tally.total) * 100) : 0);

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[.02] p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Vote</h3>
        <button
          type="button"
          onClick={() => setAnonymous((v) => !v)}
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${anonymous ? 'border-pulse-500/30 bg-pulse-500/10 text-pulse-300' : 'border-white/10 text-ink-400'}`}
        >
          {anonymous ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {anonymous ? 'Anonymous' : 'Visible'}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {choices.map(({ id, label, icon: Icon, color }) => (
          <button
            key={id}
            type="button"
            disabled={disabled || busy !== null}
            onClick={() => cast(id)}
            className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-medium transition-all disabled:opacity-40 ${
              tally.myVote === id ? color : 'border-white/5 bg-black/20 text-ink-300 hover:border-white/15'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {choices.map(({ id, label, bar }) => {
          const value = id === 'yes' ? tally.yes : id === 'no' ? tally.no : tally.needsInfo;
          return (
            <div key={id}>
              <div className="flex items-center justify-between text-[10px] text-ink-400">
                <span>{label}</span>
                <span>{value} · {pct(value)}%</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-white/5">
                <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct(value)}%` }} />
              </div>
            </div>
          );
        })}
        <p className="pt-1 text-[10px] text-ink-500">{tally.total} vote{tally.total === 1 ? '' : 's'} total</p>
      </div>
    </div>
  );
}
