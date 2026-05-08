import { resolveBackendBaseUrl } from './backendBaseUrl';

export type MarketTokenIconItem = {
  symbol: string;
  id: number;
  name: string;
  iconUrl: string;
  iconProxyUrl?: string;
};

type MarketTokenIconApiResponse = {
  tokens?: Array<Partial<MarketTokenIconItem>>;
};

export const fetchTokenIconsBySymbols = async (symbols: string[], signal?: AbortSignal): Promise<MarketTokenIconItem[] | null> => {
  const normalized = [...new Set((symbols || []).map((item) => String(item || '').trim().toUpperCase()).filter(Boolean))].slice(0, 300);
  if (!normalized.length) return null;

  const endpoint = `${resolveBackendBaseUrl()}/api/v1/market/token-icons?symbols=${encodeURIComponent(normalized.join(','))}`;
  const response = await fetch(endpoint, { signal });
  if (!response.ok) {
    throw new Error(`market token icon api status ${response.status}`);
  }

  const payload = (await response.json()) as MarketTokenIconApiResponse;
  if (!Array.isArray(payload.tokens) || !payload.tokens.length) return null;

  const rows = payload.tokens
    .map((row): MarketTokenIconItem | null => {
      const symbol = String(row?.symbol ?? '').trim().toUpperCase();
      const id = Number(row?.id);
      const name = String(row?.name ?? '').trim();
      const iconUrl = String(row?.iconUrl ?? '').trim();
      const iconProxyUrl = String(row?.iconProxyUrl ?? '').trim();
      if (!symbol || !Number.isFinite(id) || id <= 0 || !iconUrl) return null;
      return {
        symbol,
        id: Math.floor(id),
        name: name || symbol,
        iconUrl,
        iconProxyUrl: iconProxyUrl || undefined
      };
    })
    .filter((item): item is MarketTokenIconItem => Boolean(item));

  return rows.length ? rows : null;
};
