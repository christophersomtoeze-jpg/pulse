import { Activity } from 'lucide-react';

export function TermsPage() {
  return (
    <div className="mx-auto min-h-screen max-w-2xl px-5 py-10 text-ink-200">
      <div className="mb-8 flex items-center gap-2"><Activity className="h-6 w-6 text-pulse-300" /><span className="font-display text-lg font-bold">PULSE</span></div>
      <h1 className="font-display text-2xl font-semibold text-ink-50">Terms of Service</h1>
      <div className="mt-3 rounded-xl border border-alert-500/30 bg-alert-500/10 p-4 text-sm text-alert-300">
        This is a generic starting template, not legal advice. Have a lawyer review and customize it — especially the liability, data, and termination sections — before relying on it for real customers.
      </div>

      <div className="mt-6 space-y-5 text-sm leading-relaxed">
        <section><h2 className="font-semibold text-ink-100">1. Acceptance of terms</h2><p className="mt-1 text-ink-400">By creating an account or using PULSE ("the Service"), you agree to these Terms. If you're using PULSE on behalf of an organization, you're agreeing on its behalf and confirming you have authority to do so.</p></section>
        <section><h2 className="font-semibold text-ink-100">2. The Service</h2><p className="mt-1 text-ink-400">PULSE provides team discussion, decision-tracking, and related workspace tools. Features may change, and some rely on third-party AI providers processing content you submit to generate summaries and recommendations.</p></section>
        <section><h2 className="font-semibold text-ink-100">3. Accounts and workspaces</h2><p className="mt-1 text-ink-400">You're responsible for your account credentials and for what happens under your account. Workspace owners and admins control who has access to their workspace's data.</p></section>
        <section><h2 className="font-semibold text-ink-100">4. Your content</h2><p className="mt-1 text-ink-400">You retain ownership of content you submit. You grant PULSE a license to store, process, and display that content as needed to provide the Service, including sending relevant content to AI providers to generate summaries and insights you request.</p></section>
        <section><h2 className="font-semibold text-ink-100">5. Acceptable use</h2><p className="mt-1 text-ink-400">Don't use PULSE to violate the law, infringe others' rights, or attempt to disrupt or gain unauthorized access to the Service.</p></section>
        <section><h2 className="font-semibold text-ink-100">6. Payment and plans</h2><p className="mt-1 text-ink-400">Paid plans are billed as described at checkout. Fees are non-refundable except where required by law.</p></section>
        <section><h2 className="font-semibold text-ink-100">7. Termination</h2><p className="mt-1 text-ink-400">You may stop using the Service at any time. We may suspend or terminate accounts that violate these Terms.</p></section>
        <section><h2 className="font-semibold text-ink-100">8. Disclaimers and liability</h2><p className="mt-1 text-ink-400">The Service is provided "as is." AI-generated summaries and recommendations may be inaccurate or incomplete and should not be your sole basis for important decisions. To the extent permitted by law, PULSE is not liable for indirect or consequential damages.</p></section>
        <section><h2 className="font-semibold text-ink-100">9. Changes</h2><p className="mt-1 text-ink-400">We may update these Terms and will post the updated version here.</p></section>
        <section><h2 className="font-semibold text-ink-100">10. Contact</h2><p className="mt-1 text-ink-400">Questions about these Terms: support@pulse.app</p></section>
      </div>

      <a href="/" className="mt-8 inline-block text-sm font-medium text-pulse-300">← Back to PULSE</a>
    </div>
  );
}
