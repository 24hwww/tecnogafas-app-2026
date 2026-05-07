import React, { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { apiService } from '../services/apiService';
import type { Seller, SupabaseUser } from '../types';

interface AuthContextType {
  globalPin: string | null;
  currentSeller: Seller | null;
  supabaseUser: SupabaseUser | null;
  setGlobalPin: (pin: string | null) => Promise<void>;
  setCurrentSeller: (seller: Seller | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [globalPin, setGlobalPinState] = useState<string | null>(null);
  const [currentSeller, setCurrentSeller] = useState<Seller | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);

  useEffect(() => {
    const savedPin = localStorage.getItem('tecnogafas_pin');
    if (savedPin) {
      setGlobalPinState(savedPin);
      apiService.syncSupabaseAuth(savedPin);
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'START_POLLING', pin: savedPin });
      }
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller && savedPin) {
          navigator.serviceWorker.controller.postMessage({ type: 'APP_INACTIVE', pin: savedPin });
        }
      } else {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'APP_ACTIVE' });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    let authSubscription: any = null;

    const initAuth = async () => {
      const { supabase } = await import('../modules/chat/lib/supabase');

      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSupabaseUser(session?.user ?? null);

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setSupabaseUser(session?.user ?? null);
      });
      authSubscription = subscription;
    };

    initAuth();

    return () => {
      if (authSubscription) authSubscription.unsubscribe();
    };
  }, []);

  const setGlobalPin = async (pin: string | null) => {
    setGlobalPinState(pin);
    if (pin) {
      localStorage.setItem('tecnogafas_pin', pin);
      try {
        await apiService.syncSupabaseAuth(pin);
      } catch (err) {
        console.error('Error in Supabase Auth sync:', err);
      }

      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'START_POLLING', pin: pin });
        navigator.serviceWorker.controller.postMessage({ type: 'APP_ACTIVE' });
      }
    } else {
      localStorage.removeItem('tecnogafas_pin');
      try {
        const { supabase } = await import('../modules/chat/lib/supabase');
        await supabase.auth.signOut();
        setSupabaseUser(null);
      } catch (err) {
        console.error('Error signing out from Supabase:', err);
      }

      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'STOP_POLLING' });
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        globalPin,
        currentSeller,
        supabaseUser,
        setGlobalPin,
        setCurrentSeller,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
