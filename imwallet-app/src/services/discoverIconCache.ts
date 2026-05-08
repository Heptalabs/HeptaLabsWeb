import { resolveBackendBaseUrl } from './backendBaseUrl';

export type DiscoverIconCacheTokenPayload = {
  symbol: string;
  iconId?: number;
  iconUrl?: string;
  iconProxyUrl?: string;
  candidates?: string[];
};

export type DiscoverIconCacheDappPayload = {
  key: string;
  title?: string;
  url?: string;
  imageUrl?: string;
  candidates?: string[];
};

export type DiscoverIconCacheSitePayload = {
  key: string;
  domain?: string;
  url?: string;
  candidates?: string[];
};

export type DiscoverIconCacheSyncPayload = {
  tokens?: DiscoverIconCacheTokenPayload[];
  dapps?: DiscoverIconCacheDappPayload[];
  sites?: DiscoverIconCacheSitePayload[];
};

export type DiscoverIconCacheSyncResponse = {
  updatedAt: string;
  tokens: Record<string, string>;
  dapps: Record<string, string>;
  sites: Record<string, string>;
  stats?: {
    requested?: { tokens?: number; dapps?: number; sites?: number };
    cached?: { tokens?: number; dapps?: number; sites?: number };
  };
};

const toUrlMap = (value: unknown) => {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const next: Record<string, string> = {};
  Object.entries(raw).forEach(([key, url]) => {
    const safeKey = String(key || '').trim();
    const safeUrl = String(url || '').trim();
    if (!safeKey || !/^https?:\/\//i.test(safeUrl)) return;
    next[safeKey] = safeUrl;
  });
  return next;
};

export const syncDiscoverIconCache = async (
  payload: DiscoverIconCacheSyncPayload,
  options?: {
    limit?: number;
    force?: boolean;
    signal?: AbortSignal;
  }
): Promise<DiscoverIconCacheSyncResponse | null> => {
  const safeLimit = Math.max(1, Math.min(50, Math.floor(Number(options?.limit ?? 50) || 50)));
  const force = Boolean(options?.force);
  const endpoint = `${resolveBackendBaseUrl()}/api/v1/content/discover/icon-cache/sync?limit=${safeLimit}${force ? '&force=true' : ''}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ payload }),
    signal: options?.signal
  });

  if (!response.ok) {
    throw new Error(`discover icon cache sync api status ${response.status}`);
  }

  const raw = (await response.json()) as Partial<DiscoverIconCacheSyncResponse> | null;
  if (!raw || typeof raw !== 'object') return null;

  return {
    updatedAt: String(raw.updatedAt || ''),
    tokens: toUrlMap(raw.tokens),
    dapps: toUrlMap(raw.dapps),
    sites: toUrlMap(raw.sites),
    stats: raw.stats
  };
};
