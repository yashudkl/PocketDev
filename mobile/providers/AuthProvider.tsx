import * as SecureStore from 'expo-secure-store';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { setApiAccessToken, setUnauthorizedHandler } from '@/api/axios';
import { authApi } from '@/api/pocketdev';
import { hydrateApiUrl } from '@/services/apiSettings';
import type { User } from '@/types/api';

const SESSION_KEY = 'pocketdev.session.v1';

interface StoredSession {
  accessToken: string;
  user: User;
}

interface AuthContextValue {
  accessToken: string | null;
  user: User | null;
  isBootstrapping: boolean;
  isAuthenticated: boolean;
  login(email: string, password: string): Promise<void>;
  register(input: { name?: string; email: string; password: string }): Promise<void>;
  logout(): Promise<void>;
  refreshProfile(): Promise<User>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function persistSession(session: StoredSession | null): Promise<void> {
  if (!session) {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return;
  }
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const clearSession = useCallback(async () => {
    queryClient.clear();
    setApiAccessToken(null);
    setAccessToken(null);
    setUser(null);
    await persistSession(null);
  }, [queryClient]);

  const applySession = useCallback(async (session: StoredSession) => {
    setApiAccessToken(session.accessToken);
    setAccessToken(session.accessToken);
    setUser(session.user);
    await persistSession(session);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await hydrateApiUrl();
        const raw = await SecureStore.getItemAsync(SESSION_KEY);
        if (!raw || !active) return;
        const session = JSON.parse(raw) as StoredSession;
        if (!session.accessToken || !session.user) return;
        setApiAccessToken(session.accessToken);
        setAccessToken(session.accessToken);
        setUser(session.user);

        try {
          const profile = await authApi.profile();
          if (active) {
            setUser(profile);
            await persistSession({ accessToken: session.accessToken, user: profile });
          }
        } catch {
          // Keep the cached session when offline. A real 401 invokes the global handler.
        }
      } catch {
        await clearSession();
      } finally {
        if (active) setIsBootstrapping(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [clearSession]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void clearSession();
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  const completeAuth = useCallback(
    async (session: StoredSession) => {
      queryClient.clear();
      setApiAccessToken(session.accessToken);
      let profile = session.user;
      try {
        profile = await authApi.profile();
      } catch {
        // The token response has enough identity data to enter the app.
      }
      await applySession({ accessToken: session.accessToken, user: profile });
    },
    [applySession, queryClient],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      await completeAuth(await authApi.login(email.trim().toLowerCase(), password));
    },
    [completeAuth],
  );

  const register = useCallback(
    async (input: { name?: string; email: string; password: string }) => {
      await completeAuth(
        await authApi.register({
          email: input.email.trim().toLowerCase(),
          password: input.password,
          name: input.name?.trim() || undefined,
        }),
      );
    },
    [completeAuth],
  );

  const refreshProfile = useCallback(async () => {
    const profile = await authApi.profile();
    setUser(profile);
    if (accessToken) {
      await persistSession({ accessToken, user: profile });
    }
    return profile;
  }, [accessToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      user,
      isBootstrapping,
      isAuthenticated: Boolean(accessToken && user),
      login,
      register,
      logout: clearSession,
      refreshProfile,
    }),
    [accessToken, clearSession, isBootstrapping, login, refreshProfile, register, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}
