import { HelpCircle, Keyboard, Mail } from 'lucide-react';

export function HelpView({ onOpenShortcuts }: { onOpenShortcuts: () => void }) {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pb-28 pt-5">
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-[.2em] text-pulse-300"><HelpCircle className="h-3.5 w-3.5" /> Support</p>
      <h1 className="mt-1 font-display text-2xl font-semibold">Help &amp; Support</h1>

      <button onClick={onOpenShortcuts} className="glass flex w-full items-center gap-3 rounded-2xl p-4 text-left">
        <Keyboard className="h-5 w-5 text-pulse-300" />
        <div><p className="text-sm font-medium">Keyboard shortcuts</p><p className="text-xs text-ink-500">See what you can do without touching the mouse.</p></div>
      </button>

      <a href="mailto:support@pulse.app" className="glass flex items-center gap-3 rounded-2xl p-4">
        <Mail className="h-5 w-5 text-pulse-300" />
        <div><p className="text-sm font-medium">Email support</p><p className="text-xs text-ink-500">support@pulse.app</p></div>
      </a>

      <p className="pt-2 text-xs text-ink-600">A full help center with docs and search is planned for a later phase.</p>
    </div>
  );
}
