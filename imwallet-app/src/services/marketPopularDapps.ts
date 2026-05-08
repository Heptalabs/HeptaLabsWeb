import { resolveBackendBaseUrl } from './backendBaseUrl';

export type PopularDappItem = {
  id: string;
  rank: number;
  name: string;
  slug?: string;
  category?: string;
  url: string;
  logoUrl?: string;
  tvlUsd: number;
  change1d: number;
  change7d: number;
  chains: string[];
  summary?: string;
};

export const popularDappFilterKeys = ['all', 'defi', 'exchanges', 'collectibles', 'social', 'games'] as const;
export type PopularDappFilterKey = (typeof popularDappFilterKeys)[number];
export type PopularDappCategoryBuckets = Record<PopularDappFilterKey, PopularDappItem[]>;

type PopularDappApiResponse = {
  dapps?: Array<Partial<PopularDappItem>>;
};

type PopularDappByCategoryApiResponse = {
  dappsByCategory?: Partial<Record<PopularDappFilterKey, Array<Partial<PopularDappItem>>>>;
};

const toSafeText = (value: unknown) => String(value ?? '').trim();

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeHttpUrl = (value: unknown) => {
  const text = toSafeText(value);
  if (!text) return '';
  const source = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const parsed = new URL(source);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
    return parsed.toString();
  } catch {
    return '';
  }
};

const normalizePopularDappRows = (rawRows: Array<Partial<PopularDappItem>>, safeLimit: number) => {
  return rawRows
    .map((row, index): PopularDappItem | null => {
      const name = toSafeText(row?.name);
      const url = normalizeHttpUrl(row?.url);
      if (!name || !url) return null;

      const tvlUsd = Math.max(0, toFiniteNumber(row?.tvlUsd, 0));
      const rankCandidate = Math.max(1, Math.floor(toFiniteNumber(row?.rank, index + 1)));
      const chains = Array.isArray(row?.chains) ? row.chains.map((entry) => toSafeText(entry)).filter(Boolean) : [];

      return {
        id: toSafeText(row?.id) || `popular-dapp-${rankCandidate}-${name.toLowerCase()}`,
        rank: rankCandidate,
        name,
        slug: toSafeText(row?.slug) || undefined,
        category: toSafeText(row?.category) || undefined,
        url,
        logoUrl: normalizeHttpUrl(row?.logoUrl) || undefined,
        tvlUsd,
        change1d: toFiniteNumber(row?.change1d, 0),
        change7d: toFiniteNumber(row?.change7d, 0),
        chains,
        summary: toSafeText(row?.summary) || undefined
      };
    })
    .filter((row): row is PopularDappItem => Boolean(row))
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (b.tvlUsd !== a.tvlUsd) return b.tvlUsd - a.tvlUsd;
      return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
    })
    .slice(0, safeLimit);
};

export const fetchPopularDappsRanking = async (limit = 50, signal?: AbortSignal): Promise<PopularDappItem[] | null> => {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const endpoint = `${resolveBackendBaseUrl()}/api/v1/market/popular-dapps?limit=${safeLimit}`;
  const response = await fetch(endpoint, { signal });
  if (!response.ok) {
    throw new Error(`popular dapps api status ${response.status}`);
  }

  const payload = (await response.json()) as PopularDappApiResponse;
  if (!Array.isArray(payload.dapps) || !payload.dapps.length) return null;
  const rows = normalizePopularDappRows(payload.dapps, safeLimit);

  return rows.length ? rows : null;
};

export const fetchPopularDappsByCategory = async (
  limit = 10,
  signal?: AbortSignal
): Promise<PopularDappCategoryBuckets | null> => {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const endpoint = `${resolveBackendBaseUrl()}/api/v1/market/popular-dapps/by-category?limit=${safeLimit}`;
  const response = await fetch(endpoint, { signal });
  if (!response.ok) {
    throw new Error(`popular dapps by category api status ${response.status}`);
  }

  const payload = (await response.json()) as PopularDappByCategoryApiResponse;
  const rawBuckets = payload.dappsByCategory;
  if (!rawBuckets || typeof rawBuckets !== 'object') return null;

  const buckets = popularDappFilterKeys.reduce<PopularDappCategoryBuckets>((acc, key) => {
    const rows = Array.isArray(rawBuckets[key]) ? rawBuckets[key] : [];
    acc[key] = normalizePopularDappRows(rows, safeLimit);
    return acc;
  }, {
    all: [],
    defi: [],
    exchanges: [],
    collectibles: [],
    social: [],
    games: []
  });

  const hasAnyRows = popularDappFilterKeys.some((key) => buckets[key].length > 0);
  if (!hasAnyRows) return null;
  return buckets;
};
