import { Platform } from 'react-native';

const trimTrailingSlash = (input: string) => input.replace(/\/+$/, '');

const isLocalWebHost = (hostname: string) => {
  const normalized = hostname.trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '0.0.0.0';
};

const ensureSecureOrLocalUrl = (input: string) => {
  const normalized = trimTrailingSlash(input);
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return normalized;
  }

  const localHost = isLocalWebHost(parsed.hostname);
  if (parsed.protocol === 'http:' && !localHost) {
    throw new Error(`Insecure backend url is not allowed: ${normalized}`);
  }
  return normalized;
};

export const resolveBackendBaseUrl = () => {
  const fromEnv = process.env.EXPO_PUBLIC_BACKEND_BASE_URL?.trim();
  if (fromEnv) return ensureSecureOrLocalUrl(fromEnv);

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const hostname = window.location.hostname || 'localhost';
    if (isLocalWebHost(hostname)) {
      return `${protocol}//${hostname}:4000`;
    }
    return ensureSecureOrLocalUrl(`https://${hostname}`);
  }

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return 'http://localhost:4000';
  }

  return 'https://api.imwallet.app';
};
