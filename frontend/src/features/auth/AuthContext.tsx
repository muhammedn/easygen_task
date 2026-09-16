import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as authApi from '@/features/auth/api';
import type { SignInValues, SignUpValues } from '@/features/auth/schemas';
import type { PublicUser } from '@/features/auth/types';
import { onUnauthorized } from '@/lib/auth-events';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

type AuthContextValue = {
  user: PublicUser | null;
  status: AuthStatus;
  signUp: (values: SignUpValues) => Promise<void>;
  signIn: (values: SignInValues) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const { user: currentUser } = await authApi.me();
        if (!cancelled) {
          setUser(currentUser);
          setStatus('authenticated');
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setStatus('anonymous');
        }
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return onUnauthorized(() => {
      setUser(null);
      setStatus('anonymous');
    });
  }, []);

  const signUp = useCallback(async (values: SignUpValues) => {
    const { user: nextUser } = await authApi.signup(values);
    setUser(nextUser);
    setStatus('authenticated');
  }, []);

  const signIn = useCallback(async (values: SignInValues) => {
    const { user: nextUser } = await authApi.signin(values);
    setUser(nextUser);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      signUp,
      signIn,
      logout,
    }),
    [user, status, signUp, signIn, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
