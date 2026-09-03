import { useState, useRef, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Send, Feather, MessageSquare, Zap, X } from 'lucide-react';
import type { IntentWave } from '@/types';
import { intentWaveConfig } from '@/data';

const intentOrder: IntentWave[] = ['whisper', 'standard', 'pulse'];

const intentIcons = {
  whisper: Feather,
  standard: MessageSquare,
  pulse: Zap,
};

export function IntentWaveBar() {
  const [intent, setIntent] = useState<IntentWave>('standard');
  const [message, setMessage] = useState('');
  const [selectorOpen, setSelectorOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const cfg = intentWaveConfig[intent];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setMessage('');
    inputRef.current?.focus();
  };

  const CurrentIcon = intentIcons[intent];

  return (
    <div className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-3 pb-3">
      <AnimatePresence>
        {selectorOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="glass-strong mb-2 rounded-2xl p-2 shadow-card"
          >
            <div className="flex items-center justify-between px-2 pb-2 pt-1">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-400">
                Intent Wave
              </span>
              <button
                onClick={() => setSelectorOpen(false)}
                className="text-ink-400 hover:text-ink-200 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-1">
              {intentOrder.map((key) => {
                const itemCfg = intentWaveConfig[key];
                const Icon = intentIcons[key];
                const isActive = key === intent;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setIntent(key);
                      setSelectorOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 transition-all ${
                      isActive
                        ? `${itemCfg.borderColor} ${itemCfg.bg}`
                        : 'border-transparent bg-transparent hover:bg-white/5'
                    }`}
                  >
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${itemCfg.borderColor} ${itemCfg.bg}`}>
                      <Icon className={`h-4 w-4 ${itemCfg.color}`} strokeWidth={2.5} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className={`text-sm font-semibold ${isActive ? itemCfg.color : 'text-ink-100'}`}>
                        {itemCfg.label}
                      </div>
                      <div className="text-[11px] text-ink-400">{itemCfg.description}</div>
                    </div>
                    {isActive && (
                      <div className="flex items-end gap-0.5">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className={`w-1 rounded-full ${itemCfg.color.replace('text-', 'bg-')}`}
                            style={{
                              animation: `wave-bar 1.2s ease-in-out ${i * 0.15}s infinite`,
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form
        onSubmit={handleSubmit}
        className="glass-strong flex items-center gap-2 rounded-2xl p-2 shadow-card"
      >
        <button
          type="button"
          onClick={() => setSelectorOpen((s) => !s)}
          className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${cfg.borderColor} ${cfg.bg} transition-all focus-ring`}
        >
          <CurrentIcon className={`h-4 w-4 ${cfg.color}`} strokeWidth={2.5} />
          <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-ink-900 ${cfg.color.replace('text-', 'bg-')}`} />
        </button>

        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={`Send a ${cfg.label.toLowerCase()}...`}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink-50 placeholder:text-ink-500 focus:outline-none"
        />

        <button
          type="submit"
          disabled={!message.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pulse-400 to-pulse-600 text-white shadow-glow-sm transition-all hover:shadow-glow disabled:opacity-30 disabled:shadow-none focus-ring"
        >
          <Send className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </form>
    </div>
  );
}
