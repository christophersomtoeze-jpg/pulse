import type { LucideIcon } from 'lucide-react';

interface ComingSoonViewProps {
  icon: LucideIcon;
  title: string;
  phase: string;
  description: string;
  examples?: string[];
}

export function ComingSoonView({ icon: Icon, title, phase, description, examples }: ComingSoonViewProps) {
  return (
    <div className="mx-auto max-w-lg px-4 pb-28 pt-16 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-[#7c3aed]/25 bg-[#7c3aed]/10">
        <Icon className="h-7 w-7 text-pulse-300" />
      </div>
      <p className="mt-5 text-[10px] font-semibold uppercase tracking-[.2em] text-pulse-300">{phase}</p>
      <h1 className="mt-1 font-display text-2xl font-semibold">{title}</h1>
      <p className="mt-3 text-sm text-ink-400">{description}</p>
      {examples && examples.length > 0 && (
        <div className="mt-6 space-y-2 text-left">
          <p className="text-center text-[11px] font-medium uppercase tracking-wide text-ink-600">What you'll be able to ask</p>
          {examples.map((e) => (
            <div key={e} className="rounded-xl border border-white/5 bg-white/[.02] px-3.5 py-2.5 text-sm text-ink-300">"{e}"</div>
          ))}
        </div>
      )}
      <p className="mt-8 text-xs text-ink-600">This is a real placeholder, not a demo — nothing here is faked data. It'll become fully functional as we build this phase.</p>
    </div>
  );
}
