import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { recordLogin } from '@/lib/pulseApi';

export type OAuthProvider = 'google' | 'azure' | 'apple';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation?: boolean }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null; needsConfirmation?: boolean }>;
  signInWithOAuth: (provider: OAuthProvider) => Promise<{ error: string | null }>;
  signInWithSSO: (domain: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      if (event === 'SIGNED_IN' && nextSession?.user) recordLogin(nextSession.user.id);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    configured: isSupabaseConfigured,
    signIn: async (email, password) => {
      if (!supabase) return { error: 'Supabase is not configured yet. Add your VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.' };
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    signUp: async (email, password, name) => {
      if (!supabase) return { error: 'Supabase is not configured yet.' };
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      return { error: error?.message ?? null, needsConfirmation: !data.session };
    },
    signInWithOAuth: async (provider) => {
      if (!supabase) return { error: 'Supabase is not configured yet.' };
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      });
      return { error: error?.message ?? null };
    },
    signInWithSSO: async (domain) => {
      if (!supabase) return { error: 'Supabase is not configured yet.' };
      // Real call to Supabase Auth's own public SSO API. Works once your
      // Supabase project has the SAML SSO add-on enabled and a provider
      // registered for this domain via `supabase sso add` — see
      // SUPABASE_SETUP.md for the exact steps.
      const { data, error } = await supabase.auth.signInWithSSO({ domain });
      if (error) return { error: error.message };
      if (data?.url) window.location.assign(data.url);
      return { error: null };
    },
    signOut: async () => {
      if (supabase) await supabase.auth.signOut();
    },
  }), [loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
