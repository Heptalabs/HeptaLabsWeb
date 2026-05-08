import { resolveBackendBaseUrl } from './backendBaseUrl';

type FxRatesApiResponse = {
  source?: string;
  fetchedAt?: string;
  rates?: {
    USD?: number;
    KRW?: number;
    CNY?: number;
  };
};

export type FxRatesSnapshot = {
  source: string;
  fetchedAt: string;
  rates: {
    KRW: number;
    CNY: number;
  };
};

const toPositiveFinite = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const fetchFxRates = async (signal?: AbortSignal): Promise<FxRatesSnapshot | null> => {
  const endpoint = `${resolveBackendBaseUrl()}/api/v1/market/fx-rates`;
  const response = await fetch(endpoint, { signal });
  if (!response.ok) {
    throw new Error(`fx api status ${response.status}`);
  }

  const payload = (await response.json()) as FxRatesApiResponse;
  const krw = toPositiveFinite(payload?.rates?.KRW, NaN);
  const cny = toPositiveFinite(payload?.rates?.CNY, NaN);
  if (!Number.isFinite(krw) || !Number.isFinite(cny)) return null;

  return {
    source: String(payload?.source ?? 'naver-marketindex'),
    fetchedAt: String(payload?.fetchedAt ?? new Date().toISOString()),
    rates: {
      KRW: krw,
      CNY: cny
    }
  };
};
