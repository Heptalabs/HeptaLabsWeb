import { resolveBackendBaseUrl } from './backendBaseUrl';

export type PopularTokenItem = {
  id: string;
  rank: number;
  symbol: string;
  name: string;
  iconId?: number;
  iconUrl?: string;
  iconProxyUrl?: string;
  priceUsd: number;
  change24h: number;
  marketCapUsd: number;
  volume24hUsd: number;
};

type PopularTokenApiResponse = {
  tokens?: Array<Partial<PopularTokenItem>>;
};

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toSafeText = (value: unknown) => String(value ?? '').trim();

export const fetchPopularTokensByVolume = async (limit = 8, signal?: AbortSignal): Promise<PopularTokenItem[] | null> => {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const endpoint = `${resolveBackendBaseUrl()}/api/v1/market/popular-tokens?limit=${safeLimit}`;
  const response = await fetch(endpoint, { signal });
  if (!response.ok) {
    throw new Error(`popular market api status ${response.status}`);
  }

  const payload = (await response.json()) as PopularTokenApiResponse;
  if (!Array.isArray(payload.tokens) || !payload.tokens.length) return null;

  const items = payload.tokens
    .map((row, index): PopularTokenItem | null => {
      const symbol = toSafeText(row?.symbol).toUpperCase();
      if (!symbol) return null;
      const priceUsd = toFiniteNumber(row?.priceUsd, NaN);
      const volume24hUsd = toFiniteNumber(row?.volume24hUsd, NaN);
      if (!Number.isFinite(priceUsd) || !Number.isFinite(volume24hUsd)) return null;

      return {
        id: toSafeText(row?.id) || `popular-${symbol}-${index + 1}`,
        rank: Math.max(1, Math.floor(toFiniteNumber(row?.rank, index + 1))),
        symbol,
        name: toSafeText(row?.name) || symbol,
        iconId: Math.max(0, Math.floor(toFiniteNumber((row as { iconId?: unknown })?.iconId, 0))) || undefined,
        iconUrl: toSafeText((row as { iconUrl?: unknown })?.iconUrl) || undefined,
        iconProxyUrl: toSafeText((row as { iconProxyUrl?: unknown })?.iconProxyUrl) || undefined,
        priceUsd,
        change24h: toFiniteNumber(row?.change24h, 0),
        marketCapUsd: Math.max(0, toFiniteNumber(row?.marketCapUsd, 0)),
        volume24hUsd: Math.max(0, volume24hUsd)
      };
    })
    .filter((entry): entry is PopularTokenItem => Boolean(entry))
    .sort((a, b) => b.volume24hUsd - a.volume24hUsd)
    .slice(0, safeLimit);

  return items.length ? items : null;
};
