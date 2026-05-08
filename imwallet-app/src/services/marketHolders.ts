import { resolveBackendBaseUrl } from './backendBaseUrl';

export type MarketHoldersSnapshot = {
  source?: string;
  fetchedAt?: string;
  asset?: string;
  chain?: string;
  contractAddress?: string | null;
  holderCount?: number | null;
  metricType?: 'token_holders' | 'addresses_with_balance' | 'unsupported' | string;
  stale?: boolean;
};

const toPositiveIntegerOrNull = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
};

export const fetchMarketHolderCount = async (
  asset: string,
  chain: string,
  signal?: AbortSignal
): Promise<MarketHoldersSnapshot | null> => {
  const endpoint = `${resolveBackendBaseUrl()}/api/v1/market/holders?asset=${String(asset).toUpperCase()}&chain=${String(chain).toUpperCase()}`;
  const response = await fetch(endpoint, { signal });
  if (!response.ok) {
    throw new Error(`market holders api status ${response.status}`);
  }

  const payload = (await response.json()) as MarketHoldersSnapshot;
  return {
    ...payload,
    holderCount: toPositiveIntegerOrNull(payload?.holderCount)
  };
};
