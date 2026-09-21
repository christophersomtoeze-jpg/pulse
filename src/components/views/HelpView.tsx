import { BookOpen, HelpCircle, Keyboard, Lock, Mail, Webhook } from 'lucide-react';

export function HelpView({ onOpenShortcuts }: { onOpenShortcuts: () => void }) {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pb-28 pt-5">
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-[.2em] text-pulse-300"><HelpCircle className="h-3.5 w-3.5" /> Support</p>
      <h1 className="mt-1 font-display text-2xl font-semibold">Help &amp; Support</h1>
      <p className="text-sm text-ink-400">Get productive fast — then go deeper with API keys and security.</p>

      <button onClick={onOpenShortcuts} className="glass flex w-full items-center gap-3 rounded-2xl p-4 text-left">
        <Keyboard className="h-5 w-5 text-pulse-300" />
        <div>
          <p className="text-sm font-medium">Keyboard shortcuts</p>
          <p className="text-xs text-ink-500">Navigate and act without the mouse.</p>
        </div>
      </button>

      <a href="/security" className="glass flex items-center gap-3 rounded-2xl p-4">
        <Lock className="h-5 w-5 text-pulse-300" />
        <div>
          <p className="text-sm font-medium">Security &amp; trust</p>
          <p className="text-xs text-ink-500">Encryption, RLS, audit log, compliance roadmap.</p>
        </div>
      </a>

      <div className="glass flex items-center gap-3 rounded-2xl p-4">
        <Webhook className="h-5 w-5 text-pulse-300" />
        <div>
          <p className="text-sm font-medium">Public API &amp; webhooks</p>
          <p className="text-xs text-ink-500">Create API keys under Settings → API Keys. See PUBLIC_API.md in the repo.</p>
        </div>
      </div>

      <div className="glass flex items-center gap-3 rounded-2xl p-4">
        <BookOpen className="h-5 w-5 text-pulse-300" />
        <div>
          <p className="text-sm font-medium">Decision Brief</p>
          <p className="text-xs text-ink-500">Open any Decision Room → Brief → Copy, Download, or Print/PDF for executives.</p>
        </div>
      </div>

      <a href="mailto:support@pulse.app" className="glass flex items-center gap-3 rounded-2xl p-4">
        <Mail className="h-5 w-5 text-pulse-300" />
        <div>
          <p className="text-sm font-medium">Email support</p>
          <p className="text-xs text-ink-500">support@pulse.app</p>
        </div>
      </a>
    </div>
  );
}
