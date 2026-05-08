import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { adminApiClient } from '../api/client';
import type { AdminRole, AdminSession, MfaChallenge } from '../types/admin';

type AuthContextValue = {
  session: AdminSession | null;
  challenge: MfaChallenge | null;
  authLoading: boolean;
  authError: string;
  login: (email: string, password: string) => Promise<void>;
  verifyMfa: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (roles: AdminRole[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const isSessionPayload = (payload: MfaChallenge | AdminSession): payload is AdminSession => {
  return typeof (payload as AdminSession).token === 'string';
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const login = async (email: string, password: string) => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const payload = await adminApiClient.login(email, password);
      if (isSessionPayload(payload)) {
        setSession(payload);
        setChallenge(null);
      } else {
        setChallenge(payload);
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Failed to login');
    } finally {
      setAuthLoading(false);
    }
  };

  const verifyMfa = async (code: string) => {
    if (!challenge) {
      setAuthError('MFA challenge missing');
      return;
    }

    setAuthLoading(true);
    setAuthError('');
    try {
      const nextSession = await adminApiClient.verifyMfa(challenge.id, code);
      setSession(nextSession);
      setChallenge(null);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Failed to verify MFA');
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = async () => {
    if (session) {
      await adminApiClient.logout(session.token);
    }
    setSession(null);
    setChallenge(null);
  };

  const hasRole = (roles: AdminRole[]) => {
    if (!session) return false;
    return roles.includes(session.role);
  };

  const value = useMemo(
    () => ({
      session,
      challenge,
      authLoading,
      authError,
      login,
      verifyMfa,
      logout,
      hasRole
    }),
    [session, challenge, authLoading, authError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAdminAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within AuthProvider');
  }
  return context;
};
