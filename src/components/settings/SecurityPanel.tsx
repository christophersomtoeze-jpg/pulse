import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound, LogOut, Monitor, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { changeMyPassword, listLoginHistory, sendPasswordResetEmail, signOutOtherDevices } from '@/lib/pulseApi';
import { supabase } from '@/lib/supabase';
import type { LoginHistoryEntry } from '@/types';

function PasswordSection() {
  const { user } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) { setError('Use at least 8 characters.'); return; }
    setBusy(true); setError(''); setNotice('');
    try { await changeMyPassword(newPassword); setNewPassword(''); setNotice('Password updated.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not change password'); }
    finally { setBusy(false); }
  };

  const sendReset = async () => {
    if (!user?.email) return;
    setResetBusy(true); setError(''); setNotice('');
    try { await sendPasswordResetEmail(user.email); setNotice('Password reset link sent to your email.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not send reset email'); }
    finally { setResetBusy(false); }
  };

  return (
    <section className="glass rounded-2xl p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold"><KeyRound className="h-3.5 w-3.5 text-pulse-300" /> Password</h2>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password (8+ characters)" className="field flex-1" />
        <button disabled={busy || newPassword.length < 8} className="primary-btn shrink-0 disabled:opacity-40">{busy ? 'Saving…' : 'Update'}</button>
      </form>
      <button onClick={sendReset} disabled={resetBusy} className="mt-2 text-xs font-medium text-pulse-300 disabled:opacity-40">{resetBusy ? 'Sending…' : 'Email me a password reset link instead'}</button>
      {error && <p className="mt-2 text-xs text-ember-400">{error}</p>}
      {notice && <p className="mt-2 text-xs text-flux-400">{notice}</p>}
    </section>
  );
}

function TwoFactorSection() {
  const [factors, setFactors] = useState<{ id: string; status: string }[]>([]);
  const [enrolling, setEnrolling] = useState<{ factorId: string; qr: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp ?? []).map((f) => ({ id: f.id, status: f.status })));
  };
  useEffect(() => { refresh(); }, []);

  const startEnroll = async () => {
    if (!supabase) return;
    setBusy(true); setError('');
    const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setEnrolling({ factorId: data.id, qr: data.totp.qr_code });
  };

  const verifyEnroll = async () => {
    if (!supabase || !enrolling) return;
    setBusy(true); setError('');
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: enrolling.factorId });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: enrolling.factorId, challengeId: challenge.id, code });
      if (verifyError) throw verifyError;
      setNotice('Two-factor authentication enabled.');
      setEnrolling(null); setCode('');
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Invalid code'); }
    finally { setBusy(false); }
  };

  const remove = async (factorId: string) => {
    if (!supabase) return;
    await supabase.auth.mfa.unenroll({ factorId });
    await refresh();
  };

  return (
    <section className="glass rounded-2xl p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold"><ShieldCheck className="h-3.5 w-3.5 text-pulse-300" /> Two-factor authentication</h2>

      {factors.filter((f) => f.status === 'verified').map((f) => (
        <div key={f.id} className="mt-3 flex items-center justify-between rounded-xl border border-flux-500/20 bg-flux-500/5 px-3 py-2">
          <span className="text-xs text-flux-300">Authenticator app enabled</span>
          <button onClick={() => remove(f.id)} className="text-xs font-medium text-ember-300">Remove</button>
        </div>
      ))}

      {factors.filter((f) => f.status === 'verified').length === 0 && !enrolling && (
        <button onClick={startEnroll} disabled={busy} className="primary-btn mt-3 disabled:opacity-40">{busy ? 'Starting…' : 'Enable with an authenticator app'}</button>
      )}

      {enrolling && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-ink-400">Scan this with Google Authenticator, 1Password, or any TOTP app, then enter the 6-digit code.</p>
          <img src={enrolling.qr} alt="2FA QR code" className="h-40 w-40 rounded-xl bg-white p-2" />
          <div className="flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" maxLength={6} className="field flex-1" />
            <button onClick={verifyEnroll} disabled={busy || code.length !== 6} className="primary-btn shrink-0 disabled:opacity-40">{busy ? 'Verifying…' : 'Verify'}</button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-ember-400">{error}</p>}
      {notice && <p className="mt-2 text-xs text-flux-400">{notice}</p>}
    </section>
  );
}

function SessionsSection() {
  const { user } = useAuth();
  const [history, setHistory] = useState<LoginHistoryEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { if (user) listLoginHistory(user.id).then(setHistory).catch(() => {}); }, [user]);

  const logOutOthers = async () => {
    setBusy(true); setError(''); setNotice('');
    try { await signOutOtherDevices(); setNotice('Every other device has been signed out.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not sign out other devices'); }
    finally { setBusy(false); }
  };

  return (
    <section className="glass rounded-2xl p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Monitor className="h-3.5 w-3.5 text-pulse-300" /> Sessions</h2>
      <button onClick={logOutOthers} disabled={busy} className="mt-3 flex items-center gap-2 rounded-xl border border-ember-500/30 bg-ember-500/10 px-3 py-2 text-xs font-medium text-ember-300 disabled:opacity-40">
        <LogOut className="h-3.5 w-3.5" /> {busy ? 'Signing out…' : 'Log out of all other devices'}
      </button>
      {error && <p className="mt-2 text-xs text-ember-400">{error}</p>}
      {notice && <p className="mt-2 text-xs text-flux-400">{notice}</p>}

      <p className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-ink-600">Recent logins</p>
      <div className="mt-1.5 space-y-1.5">
        {history.map((h) => (
          <div key={h.id} className="text-xs text-ink-400">{new Date(h.createdAt).toLocaleString()} <span className="text-ink-600">— {h.userAgent ? h.userAgent.slice(0, 60) : 'Unknown device'}</span></div>
        ))}
        {history.length === 0 && <p className="text-xs text-ink-500">No login history recorded yet.</p>}
      </div>
    </section>
  );
}

export function SecurityPanel() {
  return (
    <div className="space-y-5">
      <PasswordSection />
      <TwoFactorSection />
      <SessionsSection />
    </div>
  );
}
