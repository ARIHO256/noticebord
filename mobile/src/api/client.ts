import axios, { AxiosError } from 'axios';
import Constants from 'expo-constants';

const DEFAULT_PORT = process.env.EXPO_PUBLIC_API_PORT || '8000';

type ExpoConfigWithDebugger = (typeof Constants.expoConfig) & { debuggerHost?: string } | undefined;

const resolveBaseURL = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }

  const extra = Constants.expoConfig?.extra || Constants.manifest?.extra;
  const extraUrl = extra?.apiUrl || extra?.api_url || extra?.API_URL;
  if (typeof extraUrl === 'string' && extraUrl.length > 0) {
    return extraUrl.replace(/\/$/, '');
  }

  const expoConfig = Constants.expoConfig as ExpoConfigWithDebugger;
  const hostUri =
    expoConfig?.hostUri ||
    expoConfig?.debuggerHost ||
    Constants.manifest2?.debuggerHost ||
    Constants.manifest?.debuggerHost;

  if (hostUri) {
    const [host] = hostUri.split(':');
    if (host) {
      return `http://${host}:${DEFAULT_PORT}`;
    }
  }

  return `http://198.168.0.18:${DEFAULT_PORT}`;
};

export const API_BASE_URL = resolveBaseURL();

type UnauthorizedHandler = () => Promise<void> | void;
type SuspendedHandler = (info?: { reason?: string | null }) => Promise<void> | void;

let unauthorizedHandler: UnauthorizedHandler | null = null;
let handlingUnauthorized = false;
let suspendedHandler: SuspendedHandler | null = null;
let handlingSuspension = false;

const notifyUnauthorized = () => {
  if (!unauthorizedHandler || handlingUnauthorized) return;
  handlingUnauthorized = true;
  Promise.resolve(unauthorizedHandler())
    .catch(() => { })
    .finally(() => {
      handlingUnauthorized = false;
    });
};

const notifySuspended = (info?: { reason?: string | null }) => {
  if (!suspendedHandler || handlingSuspension) return;
  handlingSuspension = true;
  Promise.resolve(suspendedHandler(info))
    .catch(() => { })
    .finally(() => {
      handlingSuspension = false;
    });
};

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    Accept: 'application/json',
  },
  timeout: 10000, // 10 seconds - prevents infinite hangs
});

export const setAuthToken = (token?: string) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

export const setUnauthorizedHandler = (handler?: UnauthorizedHandler | null) => {
  unauthorizedHandler = handler ?? null;
};

export const setSuspendedHandler = (handler?: SuspendedHandler | null) => {
  suspendedHandler = handler ?? null;
};

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    const isSuspensionCheck = url.includes('/users/profiles/me/') || url.includes('/users/appeal/');

    const data = error.response?.data as any;
    const errorCode = data?.code || data?.error || null;
    const detailText = typeof data?.detail === 'string' ? data.detail.toLowerCase() : '';
    const containsSuspensionKeywords = detailText.includes('suspend');
    const containsAccountInactive =
      detailText.includes('inactive') && (detailText.includes('account') || detailText.includes('user'));
    const isSuspensionError =
      ['user_inactive', 'account_suspended'].includes(errorCode) ||
      containsSuspensionKeywords ||
      containsAccountInactive;

    if (isSuspensionError) {
      notifySuspended({ reason: data?.detail || data?.message || null });
    }

    if (status === 401 && !isSuspensionCheck) {
      if (!isSuspensionError) {
        notifyUnauthorized();
      }
    }

    // Enhance error with user-friendly message
    if (error.response) {
      const message = data?.detail || data?.message || data?.error || 'An error occurred';
      (error as any).userMessage = message;
    } else if (error.request) {
      (error as any).userMessage = 'Network error. Please check your connection and try again.';
    } else {
      (error as any).userMessage = 'An unexpected error occurred. Please try again.';
    }

    return Promise.reject(error);
  },
);
