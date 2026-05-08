import { resolveBackendBaseUrl } from './backendBaseUrl';

export type MarketSymbol = 'BTC' | 'ETH' | 'XRP' | 'BNB' | 'SOL' | 'TRX' | 'FIL' | 'USDT';

export type MarketPricePoint = {
  priceUsd: number;
  change24h: number;
};

export type MarketPriceMap = Partial<Record<MarketSymbol, MarketPricePoint>>;

type MarketPriceApiResponse = {
  prices?: Record<string, { priceUsd?: number; change24h?: number }>;
};

export const DEFAULT_MARKET_SYMBOLS: MarketSymbol[] = ['BTC', 'ETH', 'XRP', 'BNB', 'SOL', 'TRX', 'FIL', 'USDT'];

const parseFiniteNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const fetchMarketPriceMap = async (
  symbols: MarketSymbol[] = DEFAULT_MARKET_SYMBOLS,
  signal?: AbortSignal
): Promise<MarketPriceMap | null> => {
  const requested = [...new Set(symbols)];
  if (!requested.length) return null;

  const endpoint = `${resolveBackendBaseUrl()}/api/v1/market/prices?symbols=${requested.join(',')}`;
  const response = await fetch(endpoint, { signal });
  if (!response.ok) {
    throw new Error(`market api status ${response.status}`);
  }

  const payload = (await response.json()) as MarketPriceApiResponse;
  if (!payload.prices || typeof payload.prices !== 'object') return null;

  const prices: MarketPriceMap = {};
  requested.forEach((symbol) => {
    const row = payload.prices?.[symbol];
    if (!row) return;
    const priceUsd = parseFiniteNumber(row.priceUsd, NaN);
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) return;
    prices[symbol] = {
      priceUsd,
      change24h: parseFiniteNumber(row.change24h, 0)
    };
  });

  return Object.keys(prices).length ? prices : null;
};
