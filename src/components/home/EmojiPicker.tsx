import { useEffect, useRef } from 'react';

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  { label: 'Reactions', emojis: ['👍', '👎', '❤️', '🔥', '🎉', '👏', '😂', '😮', '🤔', '👀'] },
  { label: 'Work', emojis: ['✅', '🚀', '📌', '⚡', '💡', '📎', '🗳️', '🧠', '⏰', '🎯'] },
  { label: 'Faces', emojis: ['😀', '😅', '🙂', '😐', '😬', '😴', '🥳', '😅', '🙌', '🤝'] },
];

export function EmojiPicker({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute bottom-full right-0 mb-2 w-64 rounded-2xl border border-white/10 bg-ink-850 p-3 shadow-card">
      {EMOJI_GROUPS.map((group) => (
        <div key={group.label} className="mb-2 last:mb-0">
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-ink-600">{group.label}</p>
          <div className="grid grid-cols-8 gap-1">
            {group.emojis.map((e, i) => (
              <button key={`${e}-${i}`} type="button" onClick={() => onPick(e)} className="rounded-lg py-1 text-lg hover:bg-white/10">
                {e}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
