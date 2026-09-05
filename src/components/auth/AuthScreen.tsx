import { useState, type FormEvent } from 'react';
import { Activity, BrainCircuit, Eye, EyeOff, Lock, Mail, ShieldCheck, Users2 } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { GoogleMark, MicrosoftMark, AppleMark } from './BrandMarks';

const features = [
  { icon: BrainCircuit, title: 'AI Powered Insights', body: 'Get intelligent summaries, recommendations and signals.' },
  { icon: Users2, title: 'Better Decisions', body: 'Structured discussions, polls and evidence in one place.' },
  { icon: ShieldCheck, title: 'Secure & Private', body: 'Enterprise grade security to keep your data safe.' },
];

function PulseWave() {
  return (
    <svg viewBox="0 0 400 160" className="w-full max-w-sm" aria-hidden="true">
      <defs>
        <linearGradient id="wave" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0" />
          <stop offset="50%" stopColor="#a855f7" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 90 Q 60 90 80 40 T 140 90 T 200 20 T 260 90 T 320 60 T 400 90" fill="none" stroke="url(#wave)" strokeWidth="2.5" />
      <path d="M0 100 Q 60 100 80 60 T 140 100 T 200 50 T 260 100 T 320 80 T 400 100" fill="none" stroke="url(#wave)" strokeWidth="1.5" opacity="0.5" />
    </svg>
  );
}

export function AuthScreen() {
  const { signIn, signUp, signInWithOAuth, configured } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<'google' | 'azure' | 'apple' | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setNotice(''); setBusy(true);
    const result = mode === 'login' ? await signIn(email, password) : await signUp(email, password, name);
    if (result.error) setError(result.error);
    else if (mode === 'signup' && result.needsConfirmation) setNotice('Account created. Check your email to confirm your address.');
    setBusy(false);
  };

  const oauth = async (provider: 'google' | 'azure' | 'apple') => {
    setError(''); setOauthBusy(provider);
    const result = await signInWithOAuth(provider);
    if (result.error) { setError(result.error); setOauthBusy(null); }
    // On success the browser redirects away, so no need to clear oauthBusy here.
  };

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Hero panel — hidden on small screens, shown on lg+ like the reference */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-ink-950 p-12 lg:flex">
        <div>
          <div className="flex items-center gap-3">
            <Activity className="h-10 w-10 text-pulse-300" strokeWidth={2.2} />
          </div>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-[.15em]">PULSE</h1>
          <p className="mt-6 max-w-sm text-2xl font-medium text-ink-100">
            Where teams think, decide and <span className="bg-gradient-to-r from-[#a855f7] to-[#06b6d4] bg-clip-text text-transparent">move forward.</span>
          </p>
          <p className="mt-3 max-w-sm text-sm text-ink-500">PULSE is the decision intelligence platform for modern teams.</p>
        </div>

        <div className="my-10"><PulseWave /></div>

        <div className="space-y-4">
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-pulse-500/20 bg-pulse-500/5">
                <Icon className="h-5 w-5 text-pulse-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-100">{title}</p>
                <p className="text-xs text-ink-500">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-ink-600">© {new Date().getFullYear()} PULSE. All rights reserved.</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#06b6d4] grid place-items-center shadow-glow"><Activity className="text-white" /></div>
            <div><div className="font-display text-2xl font-bold">PULSE</div><div className="text-[10px] uppercase tracking-[.25em] text-ink-500">Decision OS</div></div>
          </div>

          <h1 className="font-display text-3xl font-semibold">
            {mode === 'login' ? <>Welcome back <span aria-hidden>👋</span></> : 'Create your account'}
          </h1>
          <p className="mt-2 text-sm text-ink-400">
            {mode === 'login' ? 'Sign in to your PULSE account' : 'Start making better decisions with your team'}
          </p>

          {!configured && (
            <div className="mt-4 rounded-xl border border-alert-500/30 bg-alert-500/10 p-3 text-xs text-alert-300">
              Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, and enable Google/Microsoft/Apple providers in Supabase Auth settings, before these buttons will work.
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="text-xs font-medium text-ink-400">Full name</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Johnson" className="field mt-1.5" />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-ink-400">Email address</label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="field pl-10" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-ink-400">Password</label>
                {mode === 'login' && <button type="button" className="text-xs font-medium text-pulse-300">Forgot password?</button>}
              </div>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
                <input required minLength={8} type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="field pl-10 pr-10" />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-ember-400">{error}</p>}
            {notice && <p className="text-sm text-flux-400">{notice}</p>}

            <button disabled={busy || !configured} className="w-full rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#a855f7] py-3 font-semibold text-white transition-opacity disabled:opacity-40">
              {busy ? 'Working…' : mode === 'login' ? 'Sign in →' : 'Create account →'}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-ink-600">
            <div className="h-px flex-1 bg-white/10" /> OR <div className="h-px flex-1 bg-white/10" />
          </div>

          <div className="space-y-2.5">
            <button onClick={() => oauth('google')} disabled={!configured || oauthBusy !== null} className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white/[.03] py-2.5 text-sm font-medium text-ink-100 disabled:opacity-40">
              <GoogleMark /> {oauthBusy === 'google' ? 'Redirecting…' : 'Continue with Google'}
            </button>
            <button onClick={() => oauth('azure')} disabled={!configured || oauthBusy !== null} className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white/[.03] py-2.5 text-sm font-medium text-ink-100 disabled:opacity-40">
              <MicrosoftMark /> {oauthBusy === 'azure' ? 'Redirecting…' : 'Continue with Microsoft'}
            </button>
            <button onClick={() => oauth('apple')} disabled={!configured || oauthBusy !== null} className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-black py-2.5 text-sm font-medium text-white disabled:opacity-40">
              <AppleMark /> {oauthBusy === 'apple' ? 'Redirecting…' : 'Continue with Apple'}
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-ink-500">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setNotice(''); }} className="font-medium text-pulse-300">
              {mode === 'login' ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
