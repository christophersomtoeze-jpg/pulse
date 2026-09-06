import { Moon } from 'lucide-react';

export function AppearancePanel() {
  return (
    <div className="glass rounded-2xl p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Moon className="h-3.5 w-3.5 text-pulse-300" /> Appearance</h2>
      <p className="mt-2 text-xs text-ink-500">
        PULSE ships dark-theme only right now. Light/system theme, accent color choices, and interface density are real
        features on the roadmap, not built yet — this page will show real, working toggles once they are, not placeholders
        pretending to switch anything today.
      </p>
    </div>
  );
}
