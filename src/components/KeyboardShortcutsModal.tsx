import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

const shortcuts: { keys: string; label: string }[] = [
  { keys: 'N', label: 'New decision' },
  { keys: '/', label: 'Search discussions' },
  { keys: '?', label: 'Show this shortcuts panel' },
  { keys: 'Esc', label: 'Close the open panel' },
];

export function KeyboardShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4" onClick={onClose}>
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} onClick={(e) => e.stopPropagation()} className="glass-strong w-full max-w-sm rounded-2xl p-5">
            <div className="flex items-center justify-between"><h2 className="font-display text-lg font-semibold">Keyboard shortcuts</h2><button className="icon-btn" onClick={onClose}><X className="h-4 w-4" /></button></div>
            <div className="mt-4 space-y-2">
              {shortcuts.map((s) => (
                <div key={s.label} className="flex items-center justify-between text-sm">
                  <span className="text-ink-300">{s.label}</span>
                  <kbd className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-ink-200">{s.keys}</kbd>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
