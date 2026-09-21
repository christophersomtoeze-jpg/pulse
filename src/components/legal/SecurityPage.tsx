import { ArrowLeft, FileKey2, Lock, Server, ShieldCheck, UserCheck } from 'lucide-react';

const sections = [
  {
    icon: Lock,
    title: 'Encryption',
    body: 'Data in transit is protected with TLS. Data at rest is encrypted by the underlying Postgres/storage providers (Supabase). Application secrets and AI provider keys never ship to the browser.',
  },
  {
    icon: UserCheck,
    title: 'Access control (RLS)',
    body: 'Every workspace row is guarded by Postgres Row Level Security. Members only see data for workspaces they belong to. Admin and owner roles gate invites, billing, API keys, and destructive actions.',
  },
  {
    icon: FileKey2,
    title: 'Audit log',
    body: 'Sensitive actions (invites, role changes, removals, content reports) are written to an append-style audit log visible to workspace members. AI and billing calls run through server-side edge functions.',
  },
  {
    icon: Server,
    title: 'Infrastructure',
    body: 'Auth, database, realtime, and file storage run on Supabase. Edge functions handle OAuth, Stripe, Slack, and AI so provider credentials stay server-side.',
  },
  {
    icon: ShieldCheck,
    title: 'Compliance roadmap',
    body: 'Current: RLS, audit events, export/delete, privacy & terms pages. Next: formal SOC 2 Type I readiness, DPA templates, optional data residency, and SSO (SAML) for Business plans.',
  },
];

export function SecurityPage() {
  return (
    <div className="min-h-screen bg-[#06070d] px-5 py-10 text-ink-100">
      <div className="mx-auto max-w-2xl">
        <a href="/" className="inline-flex items-center gap-1.5 text-sm text-pulse-300 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to PULSE
        </a>
        <p className="mt-6 flex items-center gap-1.5 text-xs uppercase tracking-[.2em] text-pulse-300">
          <ShieldCheck className="h-3.5 w-3.5" /> Trust
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Security at PULSE</h1>
        <p className="mt-2 text-sm text-ink-400">
          Decision data is high-stakes. PULSE is built so companies can put real strategy conversations into the product without exposing them to the wrong people — or to client-side secrets.
        </p>

        <div className="mt-8 space-y-4">
          {sections.map(({ icon: Icon, title, body }) => (
            <section key={title} className="glass rounded-2xl p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="h-4 w-4 text-pulse-300" /> {title}
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-ink-400">{body}</p>
            </section>
          ))}
        </div>

        <p className="mt-8 text-xs text-ink-500">
          Security questions: security@pulse.app · Privacy: <a className="text-pulse-300 hover:underline" href="/privacy">/privacy</a> · Terms:{' '}
          <a className="text-pulse-300 hover:underline" href="/terms">/terms</a>
        </p>
      </div>
    </div>
  );
}
