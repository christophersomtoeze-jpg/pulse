import { Activity } from 'lucide-react';

export function PrivacyPage() {
  return (
    <div className="mx-auto min-h-screen max-w-2xl px-5 py-10 text-ink-200">
      <div className="mb-8 flex items-center gap-2"><Activity className="h-6 w-6 text-pulse-300" /><span className="font-display text-lg font-bold">PULSE</span></div>
      <h1 className="font-display text-2xl font-semibold text-ink-50">Privacy Policy</h1>
      <div className="mt-3 rounded-xl border border-alert-500/30 bg-alert-500/10 p-4 text-sm text-alert-300">
        This is a generic starting template, not legal advice. A real privacy policy must accurately describe what you actually collect and who you actually share it with — have a lawyer review it, and update it whenever your data practices change (e.g. new integrations, new sub-processors).
      </div>

      <div className="mt-6 space-y-5 text-sm leading-relaxed">
        <section><h2 className="font-semibold text-ink-100">What we collect</h2><p className="mt-1 text-ink-400">Account info (name, email), workspace content you create (discussions, decisions, messages, uploaded images/voice notes), and basic usage events (e.g. sign-up, workspace created) used to improve the product.</p></section>
        <section><h2 className="font-semibold text-ink-100">How we use it</h2><p className="mt-1 text-ink-400">To operate the Service, including sending relevant workspace content to our AI provider (Anthropic) when you request an AI summary, recommendation, or assistant response. To communicate with you about your account. To improve PULSE using aggregated usage patterns.</p></section>
        <section><h2 className="font-semibold text-ink-100">Who we share it with</h2><p className="mt-1 text-ink-400">Sub-processors that help run the Service: Supabase (database, authentication, file storage), Anthropic (AI features), and — if your workspace connects them — Slack or other integrations you explicitly authorize. We don't sell your data.</p></section>
        <section><h2 className="font-semibold text-ink-100">Your choices</h2><p className="mt-1 text-ink-400">You can export or delete your workspace's data on request. Workspace admins control who has access within a workspace.</p></section>
        <section><h2 className="font-semibold text-ink-100">Data retention</h2><p className="mt-1 text-ink-400">We keep workspace data for as long as the workspace is active, plus a reasonable period after deletion for backups, unless you request earlier deletion.</p></section>
        <section><h2 className="font-semibold text-ink-100">Security</h2><p className="mt-1 text-ink-400">Data is protected with row-level access controls scoped to your workspace membership. No system is perfectly secure, and we can't guarantee absolute security.</p></section>
        <section><h2 className="font-semibold text-ink-100">Children</h2><p className="mt-1 text-ink-400">PULSE is not directed at children and is not intended for use by anyone under 16.</p></section>
        <section><h2 className="font-semibold text-ink-100">Changes</h2><p className="mt-1 text-ink-400">We'll post updates to this policy here.</p></section>
        <section><h2 className="font-semibold text-ink-100">Contact</h2><p className="mt-1 text-ink-400">Privacy questions: privacy@pulse.app</p></section>
      </div>

      <a href="/" className="mt-8 inline-block text-sm font-medium text-pulse-300">← Back to PULSE</a>
    </div>
  );
}
