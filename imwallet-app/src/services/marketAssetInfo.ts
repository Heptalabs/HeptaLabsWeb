import type { MarketSymbol } from './marketPrice';
import { resolveBackendBaseUrl } from './backendBaseUrl';

export type MarketAssetInfoPoint = {
  marketCapUsd?: number | null;
  volume24hUsd?: number | null;
  circulatingSupply?: number | null;
  totalSupply?: number | null;
  maxSupply?: number | null;
  liquidityUsd?: number | null;
  launchedAt?: string | null;
};

export type MarketAssetInfoMap = Partial<Record<MarketSymbol, MarketAssetInfoPoint>>;

type MarketAssetInfoApiResponse = {
  itemsBySymbol?: Record<string, MarketAssetInfoPoint>;
};

const toPositiveNumberOrNull = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

export const fetchMarketAssetInfoMap = async (symbols: MarketSymbol[], signal?: AbortSignal): Promise<MarketAssetInfoMap | null> => {
  const requested = [
    ...new Set(
      symbols
        .map((symbol) => String(symbol).trim().toUpperCase())
        .filter((value): value is string => Boolean(value))
    )
  ] as MarketSymbol[];
  if (!requested.length) return null;

  const endpoint = `${resolveBackendBaseUrl()}/api/v1/market/asset-info?symbols=${requested.join(',')}`;
  const response = await fetch(endpoint, { signal });
  if (!response.ok) {
    throw new Error(`market asset-info api status ${response.status}`);
  }

  const payload = (await response.json()) as MarketAssetInfoApiResponse;
  if (!payload.itemsBySymbol || typeof payload.itemsBySymbol !== 'object') return null;

  const next: MarketAssetInfoMap = {};
  requested.forEach((symbol) => {
    const row = payload.itemsBySymbol?.[symbol];
    if (!row) return;

    next[symbol] = {
      marketCapUsd: toPositiveNumberOrNull(row.marketCapUsd),
      volume24hUsd: toPositiveNumberOrNull(row.volume24hUsd),
      circulatingSupply: toPositiveNumberOrNull(row.circulatingSupply),
      totalSupply: toPositiveNumberOrNull(row.totalSupply),
      maxSupply: toPositiveNumberOrNull(row.maxSupply),
      liquidityUsd: toPositiveNumberOrNull(row.liquidityUsd),
      launchedAt: typeof row.launchedAt === 'string' && row.launchedAt.trim() ? row.launchedAt.trim().slice(0, 10) : null
    };
  });

  return Object.keys(next).length ? next : null;
};
