import React, { createContext, useEffect, useMemo, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setAuthToken, setSuspendedHandler, setUnauthorizedHandler } from '../api/client';

type AuthContextType = {
  token: string | null;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  ready: boolean;
  isSuspended: boolean;
  suspensionReason: string | null;
  checkingSuspension: boolean;
  refreshSuspensionStatus: () => Promise<boolean>;
  markSuspended: (reason?: string | null) => void;
};

export const AuthContext = createContext<AuthContextType>({
  token: null,
  signIn: async () => {},
  signOut: async () => {},
  ready: false,
  isSuspended: false,
  suspensionReason: null,
  checkingSuspension: false,
  refreshSuspensionStatus: async () => false,
  markSuspended: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState<string | null>(null);
  const [checkingSuspension, setCheckingSuspension] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem('authToken');
      if (stored) {
        setToken(stored);
        setAuthToken(stored);
      }
      setReady(true);
    })();
  }, []);

  const markSuspended = useCallback((reason?: string | null) => {
    setIsSuspended(true);
    if (typeof reason !== 'undefined') {
      setSuspensionReason(reason || null);
    }
  }, []);

  const refreshSuspensionStatus = useCallback(async (): Promise<boolean> => {
    if (!token) {
      setIsSuspended(false);
      setSuspensionReason(null);
      setCheckingSuspension(false);
      return false;
    }

    setCheckingSuspension(true);
    try {
      const resp = await api.get('/users/profiles/me/');
      const suspended = resp.data?.is_active === false;
      setIsSuspended(suspended);
      setSuspensionReason(suspended ? (resp.data?.suspension_reason ?? null) : null);
      return suspended;
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code === 'user_inactive') {
        const reason = err?.response?.data?.suspension_reason || err?.response?.data?.detail || null;
        markSuspended(reason);
        return true;
      }
      setIsSuspended(false);
      setSuspensionReason(null);
      return false;
    } finally {
      setCheckingSuspension(false);
    }
  }, [token, markSuspended]);

  const handleSignIn = useCallback(async (t: string) => {
    setToken(t);
    setAuthToken(t);
    setIsSuspended(false);
    setSuspensionReason(null);
    setCheckingSuspension(false);
    await AsyncStorage.setItem('authToken', t);
  }, []);

  const handleSignOut = useCallback(async () => {
    setToken(null);
    setAuthToken(undefined);
    setIsSuspended(false);
    setSuspensionReason(null);
    setCheckingSuspension(false);
    await AsyncStorage.removeItem('authToken');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(handleSignOut);
    setSuspendedHandler((info) => {
      if (info?.reason) {
        markSuspended(info.reason);
      } else {
        markSuspended(null);
      }
    });
    return () => {
      setUnauthorizedHandler(null);
      setSuspendedHandler(null);
    };
  }, [handleSignOut, markSuspended]);

  const value = useMemo(
    () => ({
      token,
      ready,
      signIn: handleSignIn,
      signOut: handleSignOut,
      isSuspended,
      suspensionReason,
      checkingSuspension,
      refreshSuspensionStatus,
      markSuspended,
    }),
    [
      token,
      ready,
      handleSignIn,
      handleSignOut,
      isSuspended,
      suspensionReason,
      checkingSuspension,
      refreshSuspensionStatus,
      markSuspended,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
