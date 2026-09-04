import { useState, type FormEvent } from 'react';
import { Mic, Plus, Send, Smile } from 'lucide-react';

interface MessageComposerProps {
  disabled?: boolean;
  placeholder?: string;
  onSend: (text: string) => void;
  onPlus?: () => void;
}

export function MessageComposer({ disabled, placeholder = 'Message PULSE…', onSend, onPlus }: MessageComposerProps) {
  const [value, setValue] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    onSend(value.trim());
    setValue('');
  };

  return (
    <form onSubmit={submit} className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md px-3 pb-3">
      <div className="flex items-center gap-1.5 rounded-2xl glass-strong p-1.5 shadow-card">
        <button type="button" onClick={onPlus} className="icon-btn h-9 w-9 shrink-0" aria-label="Add">
          <Plus className="h-4 w-4" />
        </button>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink-50 placeholder:text-ink-500 focus:outline-none"
        />
        <button type="button" className="icon-btn h-9 w-9 shrink-0 border-0 bg-transparent" aria-label="Emoji">
          <Smile className="h-4 w-4" />
        </button>
        <button type="button" className="icon-btn h-9 w-9 shrink-0 border-0 bg-transparent" aria-label="Voice">
          <Mic className="h-4 w-4" />
        </button>
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#06b6d4] text-white shadow-glow disabled:opacity-30"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
