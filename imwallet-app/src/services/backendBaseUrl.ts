import { Platform } from 'react-native';

const trimTrailingSlash = (input: string) => input.replace(/\/+$/, '');

const isLocalWebHost = (hostname: string) => {
  const normalized = hostname.trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '0.0.0.0';
};

export const resolveBackendBaseUrl = () => {
  const fromEnv = process.env.EXPO_PUBLIC_BACKEND_BASE_URL?.trim();
  if (fromEnv) return trimTrailingSlash(fromEnv);

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const hostname = window.location.hostname || 'localhost';
    if (isLocalWebHost(hostname)) {
      return `${protocol}//${hostname}:4000`;
    }
    return trimTrailingSlash(window.location.origin);
  }

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return 'http://localhost:4000';
  }

  return 'https://download.imwallet.app';
};
