'use client';

import { useEffect, useCallback } from 'react';
import { createContext, useContext, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuizStore } from '@/store/quiz-store';
import { loadFromCloud, mergeLocalAndCloud, syncStatsToCloud } from '@/lib/cloud-sync';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [synced, setSynced] = useState(false);

  const syncFromCloud = useCallback(async (userId: string) => {
    if (synced) return;
    try {
      const cloudData = await loadFromCloud(userId);
      if (!cloudData) return;

      const store = useQuizStore.getState();
      const merged = mergeLocalAndCloud(
        store.statsPerMateria,
        cloudData.statsPerMateria,
        store.quizCompletati,
        cloudData.quizCompletati,
        store.quizSbagliati,
        cloudData.quizSbagliati,
      );

      // Aggiorna store locale con dati merged
      const totalRisposte = Object.values(merged.statsPerMateria).reduce((s, m) => s + m.totale, 0);
      const totalCorrette = Object.values(merged.statsPerMateria).reduce((s, m) => s + m.corrette, 0);

      useQuizStore.setState({
        quizCompletati: merged.quizCompletati,
        quizSbagliati: merged.quizSbagliati,
        statsPerMateria: merged.statsPerMateria,
        simulazioniCount: Math.max(store.simulazioniCount, cloudData.simulazioniCount),
      });

      // Aggiorna anche il cloud con i dati merged
      syncStatsToCloud(userId, merged.statsPerMateria, totalRisposte, totalCorrette);

      setSynced(true);
      console.log('[Sync] Dati sincronizzati dal cloud');
    } catch (err) {
      console.error('[Sync] Errore sync dal cloud:', err);
    }
  }, [synced]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      const u = session?.user ?? null;
      setUser(u);
      setLoading(false);

      if (u) {
        useQuizStore.setState({ userId: u.id, isLoggedIn: true });
        syncFromCloud(u.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        const u = session?.user ?? null;
        setUser(u);
        setLoading(false);

        if (u) {
          useQuizStore.setState({ userId: u.id, isLoggedIn: true });
          syncFromCloud(u.id);
        } else {
          useQuizStore.setState({ userId: null, isLoggedIn: false });
          setSynced(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [syncFromCloud]);

  const signIn = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => {
          console.log('SW registered:', reg.scope);
          reg.addEventListener('updatefound', () => {
            const installing = reg.installing;
            if (installing) {
              installing.addEventListener('statechange', () => {
                if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('Nuova versione disponibile');
                }
              });
            }
          });
        })
        .catch(err => console.error('SW error:', err));
    }
  }, []);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ServiceWorkerRegistration />
      {children}
    </AuthProvider>
  );
}
