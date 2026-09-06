import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Camera, Mail } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { changeMyEmail, getMyProfile, updateMyProfile, uploadMedia } from '@/lib/pulseApi';
import type { ProfileDetails } from '@/types';

export function ProfilePanel() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileDetails | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [email, setEmail] = useState('');
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    getMyProfile(user.id).then((p) => {
      if (!p) return;
      setProfile(p); setFullName(p.fullName); setPhone(p.phone); setBio(p.bio); setEmail(p.email);
    });
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setBusy(true); setError(''); setNotice('');
    try { await updateMyProfile(user.id, { fullName, phone, bio }); setNotice('Profile updated.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update profile'); }
    finally { setBusy(false); }
  };

  const saveEmail = async () => {
    if (!email.trim() || email === profile?.email) return;
    setEmailBusy(true); setError(''); setNotice('');
    try { await changeMyEmail(email.trim()); setNotice('Check your inbox to confirm your new email address.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not change email'); }
    finally { setEmailBusy(false); }
  };

  const onPickPhoto = () => fileRef.current?.click();
  const onPhotoChosen = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    setUploading(true); setError('');
    try {
      const url = await uploadMedia(file, 'image', user.id);
      await updateMyProfile(user.id, { avatarUrl: url });
      setProfile((p) => (p ? { ...p, avatarUrl: url } : p));
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not upload photo'); }
    finally { setUploading(false); }
  };

  return (
    <div className="space-y-5">
      <section className="glass rounded-2xl p-4">
        <h2 className="text-sm font-semibold">Profile photo</h2>
        <div className="mt-3 flex items-center gap-4">
          <button onClick={onPickPhoto} className="relative">
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt="Avatar" className="h-16 w-16 rounded-2xl object-cover" />
            ) : (
              <div className="avatar h-16 w-16 text-xl">{fullName.slice(0, 1).toUpperCase() || 'A'}</div>
            )}
            <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-[#7c3aed] text-white"><Camera className="h-3 w-3" /></span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoChosen} />
          <p className="text-xs text-ink-500">{uploading ? 'Uploading…' : 'Click your photo to change it.'}</p>
        </div>
      </section>

      <section className="glass rounded-2xl p-4">
        <h2 className="text-sm font-semibold">Personal info</h2>
        <div className="mt-3 space-y-3">
          <div><label className="text-xs font-medium text-ink-400">Full name</label><input value={fullName} onChange={(e) => setFullName(e.target.value)} className="field mt-1.5" /></div>
          <div><label className="text-xs font-medium text-ink-400">Phone number</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" className="field mt-1.5" /></div>
          <div><label className="text-xs font-medium text-ink-400">Bio</label><textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A short line about you" className="field mt-1.5 min-h-16 resize-none" /></div>
        </div>
        {error && <p className="mt-2 text-xs text-ember-400">{error}</p>}
        {notice && <p className="mt-2 text-xs text-flux-400">{notice}</p>}
        <button onClick={saveProfile} disabled={busy} className="primary-btn mt-3 disabled:opacity-40">{busy ? 'Saving…' : 'Save changes'}</button>
      </section>

      <section className="glass rounded-2xl p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Mail className="h-3.5 w-3.5 text-pulse-300" /> Email address</h2>
        <div className="mt-3 flex gap-2">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field flex-1" />
          <button onClick={saveEmail} disabled={emailBusy || email === profile?.email} className="primary-btn shrink-0 disabled:opacity-40">{emailBusy ? 'Sending…' : 'Change'}</button>
        </div>
        <p className="mt-2 text-[11px] text-ink-500">Changing your email sends a confirmation link to the new address before it takes effect.</p>
      </section>
    </div>
  );
}
