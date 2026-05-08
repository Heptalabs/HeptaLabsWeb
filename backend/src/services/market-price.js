import { config } from '../config.js';

const MARKET_SYMBOL_TO_PROVIDER_ID = Object.freeze({
  BTC: 'bitcoin',
  ETH: 'ethereum',
  XRP: 'ripple',
  BNB: 'binancecoin',
  SOL: 'solana',
  TRX: 'tron',
  FIL: 'filecoin',
  USDT: 'tether'
});

export const SUPPORTED_MARKET_SYMBOLS = Object.freeze(Object.keys(MARKET_SYMBOL_TO_PROVIDER_ID));
const MARKET_SYMBOL_TO_CMC_ID = Object.freeze({
  BTC: 1,
  ETH: 1027,
  XRP: 52,
  BNB: 1839,
  SOL: 5426,
  TRX: 1958,
  FIL: 2280,
  USDT: 825
});
const CMC_MARKET_CONVERTS = Object.freeze(['USD', 'CNY', 'KRW']);
const CMC_DEFAULT_CNY_RATE = 7.2;
const CMC_DEFAULT_KRW_RATE = 1370;
const MARKET_LAUNCHED_FALLBACK_BY_SYMBOL = Object.freeze({
  BTC: '2009-01-03',
  ETH: '2015-07-30',
  XRP: '2012-06-02',
  BNB: '2017-07-14',
  SOL: '2020-03-16',
  TRX: '2018-06-25',
  FIL: '2020-10-15',
  USDT: '2014-10-06'
});

const marketCache = new Map();
const marketPopularCache = new Map();
const marketFxCache = new Map();
const marketTokenIconMapCache = new Map();
const marketTokenIconBinaryCache = new Map();
const marketAssetInfoCache = new Map();
const marketHoldersCache = new Map();
const MARKET_POPULAR_DEFAULT_LIMIT = 10;
const MARKET_POPULAR_MAX_LIMIT = 100;
const NAVER_MARKETINDEX_URL = 'https://finance.naver.com/marketindex/';
const USDT_CONTRACT_BY_CHAIN = Object.freeze({
  ETH: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  BSC: '0x55d398326f99059fF775485246999027B3197955',
  TRX: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
});
const HOLDER_METRIC_ADR_BAL_CNT = 'AdrBalCnt';
const COINMETRICS_ASSET_BY_ASSET_AND_CHAIN = Object.freeze({
  BTC: Object.freeze({ BTC: 'btc' }),
  ETH: Object.freeze({ ETH: 'eth' }),
  XRP: Object.freeze({ XRP: 'xrp' }),
  BNB: Object.freeze({ BSC: 'bnb' }),
  SOL: Object.freeze({ SOL: 'sol' }),
  TRX: Object.freeze({ TRX: 'trx' }),
  FIL: Object.freeze({ FIL: 'fil' })
});

const resolveAssetContractAddress = (asset, chain) => {
  const normalizedAsset = String(asset || '').trim().toUpperCase();
  const normalizedChain = String(chain || '').trim().toUpperCase();
  if (normalizedAsset === 'USDT') {
    return USDT_CONTRACT_BY_CHAIN[normalizedChain] ?? null;
  }
  return null;
};

const normalizeSymbols = (symbols) =>
  [...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))].sort();

const buildCacheKey = (symbols) => normalizeSymbols(symbols).join(',');

const parseUsd = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseUsdChange = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parsePositiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const parsePositiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
};

const parsePositiveIntegerLoose = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const cleaned = value.replaceAll(',', '').trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
  }
  return parsePositiveInteger(value);
};

const toCmcIconUrl = (rawId) => {
  const parsed = Number(rawId);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return `https://s2.coinmarketcap.com/static/img/coins/64x64/${Math.floor(parsed)}.png`;
};

const parseIconId = (rawId) => {
  const parsed = Number(rawId);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
};

const normalizeDateOnly = (value) => {
  if (!value) return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const day = String(parsed.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseRequestedMarketSymbols = (rawSymbols) => {
  if (rawSymbols === undefined || rawSymbols === null || rawSymbols === '') {
    return {
      symbols: [...SUPPORTED_MARKET_SYMBOLS],
      invalidSymbols: []
    };
  }

  const mergedInput = Array.isArray(rawSymbols) ? rawSymbols.join(',') : String(rawSymbols);
  const requested = [...new Set(mergedInput.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean))];
  if (!requested.length) {
    return {
      symbols: [...SUPPORTED_MARKET_SYMBOLS],
      invalidSymbols: []
    };
  }

  const invalidSymbols = requested.filter((symbol) => !SUPPORTED_MARKET_SYMBOLS.includes(symbol));
  const symbols = requested.filter((symbol) => SUPPORTED_MARKET_SYMBOLS.includes(symbol));

  return {
    symbols: symbols.length ? normalizeSymbols(symbols) : [...SUPPORTED_MARKET_SYMBOLS],
    invalidSymbols
  };
};

export const parseRequestedMarketPopularLimit = (rawLimit) => {
  if (rawLimit === undefined || rawLimit === null || rawLimit === '') {
    return MARKET_POPULAR_DEFAULT_LIMIT;
  }

  const candidate = Array.isArray(rawLimit) ? rawLimit[0] : rawLimit;
  const parsed = Number(candidate);
  if (!Number.isFinite(parsed)) {
    return MARKET_POPULAR_DEFAULT_LIMIT;
  }

  const normalized = Math.floor(parsed);
  if (normalized < 1) return 1;
  if (normalized > MARKET_POPULAR_MAX_LIMIT) return MARKET_POPULAR_MAX_LIMIT;
  return normalized;
};

const fetchPricesFromCoinGecko = async (symbols) => {
  const ids = symbols.map((symbol) => MARKET_SYMBOL_TO_PROVIDER_ID[symbol]).join(',');
  const endpoint = new URL('https://api.coingecko.com/api/v3/simple/price');
  endpoint.searchParams.set('ids', ids);
  endpoint.searchParams.set('vs_currencies', 'usd');
  endpoint.searchParams.set('include_24hr_change', 'true');

  const controller = new AbortController();
  const timeoutMs = Math.max(500, config.marketPriceTimeoutMs);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        accept: 'application/json'
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`market provider returned ${response.status}`);
    }

    const payload = await response.json();
    const prices = {};
    symbols.forEach((symbol) => {
      const providerId = MARKET_SYMBOL_TO_PROVIDER_ID[symbol];
      const item = payload?.[providerId];
      const priceUsd = parseUsd(item?.usd);
      if (priceUsd === null) return;
      prices[symbol] = {
        priceUsd,
        change24h: parseUsdChange(item?.usd_24h_change)
      };
    });

    if (!Object.keys(prices).length) {
      throw new Error('market provider returned empty price payload');
    }

    return {
      source: config.marketPriceProvider,
      fetchedAt: new Date().toISOString(),
      prices
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

const fetchJsonWithTimeout = async (endpoint, headers = {}) => {
  const controller = new AbortController();
  const timeoutMs = Math.max(500, config.marketPriceTimeoutMs);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const endpointUrl = endpoint instanceof URL ? endpoint : new URL(String(endpoint));
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        ...headers
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`${endpointUrl.hostname} returned ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
};

const fetchHtmlWithTimeout = async (endpoint, headers = {}, customTimeoutMs = null) => {
  const controller = new AbortController();
  const timeoutMs = Math.max(500, Number(customTimeoutMs || config.marketPriceTimeoutMs));
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_2_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        ...headers
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`naver marketindex returned ${response.status}`);
    }

    return response.text();
  } finally {
    clearTimeout(timeoutId);
  }
};

const parseCmcQuoteEntry = (entry) => {
  if (!entry || typeof entry !== 'object') return null;
  const usd = parsePositiveNumber(entry?.quote?.USD?.price);
  const cny = parsePositiveNumber(entry?.quote?.CNY?.price);
  const krw = parsePositiveNumber(entry?.quote?.KRW?.price);
  const change24h = parseUsdChange(entry?.quote?.USD?.percent_change_24h);
  if (!usd && !cny && !krw) return null;

  return {
    usd,
    cny,
    krw,
    change24h
  };
};

const fetchPricesFromCoinMarketCapPro = async (symbols) => {
  if (!config.coinMarketCapApiKey) {
    throw new Error('coinmarketcap api key is not configured');
  }

  const endpoint = new URL('https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest');
  endpoint.searchParams.set('symbol', symbols.join(','));
  endpoint.searchParams.set('convert', CMC_MARKET_CONVERTS.join(','));

  const payload = await fetchJsonWithTimeout(endpoint, {
    'X-CMC_PRO_API_KEY': config.coinMarketCapApiKey
  });

  const prices = {};
  symbols.forEach((symbol) => {
    const dataRow = payload?.data?.[symbol];
    const entry = Array.isArray(dataRow) ? dataRow[0] : dataRow;
    const parsed = parseCmcQuoteEntry(entry);
    if (!parsed) return;
    prices[symbol] = parsed;
  });

  if (!Object.keys(prices).length) {
    throw new Error('coinmarketcap returned empty price payload');
  }

  return {
    source: 'coinmarketcap-pro',
    fetchedAt: new Date().toISOString(),
    prices
  };
};

const fetchPricesFromCoinoneKrw = async (symbols) => {
  const endpoint = new URL('https://api.coinone.co.kr/public/v2/ticker_new/KRW');
  endpoint.searchParams.set('additional_data', 'true');

  const payload = await fetchJsonWithTimeout(endpoint);
  const rows = Array.isArray(payload?.tickers) ? payload.tickers : [];
  const symbolSet = new Set(symbols);

  const prices = {};
  rows.forEach((row) => {
    const symbol = String(row?.target_currency ?? '')
      .trim()
      .toUpperCase();
    if (!symbol || !symbolSet.has(symbol)) return;
    const last = parsePositiveNumber(row?.last);
    if (!last) return;
    const first = parsePositiveNumber(row?.first);
    const change24h = first && first > 0 ? ((last - first) / first) * 100 : 0;
    prices[symbol] = {
      krw: last,
      change24h
    };
  });

  return {
    source: 'coinone-public',
    fetchedAt: new Date().toISOString(),
    prices
  };
};

const parseRateValue = (raw) => {
  const normalized = String(raw ?? '').replace(/[^0-9.]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractNaverRateByCode = (html, marketCode) => {
  const pattern = new RegExp(`marketindexCd=${marketCode}[\\s\\S]{0,2200}?<span class="value">\\s*([^<]+)\\s*</span>`, 'i');
  const matched = html.match(pattern);
  if (!matched) return null;
  return parseRateValue(matched[1]);
};

const fetchFxRatesFromNaver = async () => {
  const html = await fetchHtmlWithTimeout(NAVER_MARKETINDEX_URL);
  const usdKrw = extractNaverRateByCode(html, 'FX_USDKRW');
  const cnyKrw = extractNaverRateByCode(html, 'FX_CNYKRW');
  if (!usdKrw || !cnyKrw || usdKrw <= 0 || cnyKrw <= 0) {
    throw new Error('failed to parse naver fx rates');
  }

  const usdToCny = usdKrw / cnyKrw;

  return {
    source: 'naver-marketindex',
    fetchedAt: new Date().toISOString(),
    base: 'USD',
    rates: {
      USD: 1,
      KRW: usdKrw,
      CNY: usdToCny
    },
    refs: {
      usdKrw,
      cnyKrw
    }
  };
};

const normalizePopularTokens = (rows, mapper, limit) => {
  const tokens = rows
    .map((item, index) => mapper(item, index))
    .filter((row) => Boolean(row))
    .slice(0, limit);

  if (!tokens.length) {
    throw new Error('coinmarketcap returned empty popular token payload');
  }

  return tokens;
};

const mapPopularFromCmcPro = (item, index) => {
  const symbol = String(item?.symbol ?? '')
    .trim()
    .toUpperCase();
  if (!symbol) return null;

  const quote = item?.quote?.USD;
  const priceUsd = parseUsd(quote?.price);
  const volume24hUsd = parseUsd(quote?.volume_24h);
  if (priceUsd === null || volume24hUsd === null) return null;

  const marketCapUsd = parseUsd(quote?.market_cap) ?? 0;
  const rank = Number(item?.cmc_rank);

  const iconId = parseIconId(item?.id);
  return {
    id: `cmc-${item?.id ?? symbol}-${index + 1}`,
    rank: Number.isFinite(rank) ? rank : index + 1,
    symbol,
    name: String(item?.name ?? symbol).trim() || symbol,
    iconId,
    iconUrl: toCmcIconUrl(iconId),
    priceUsd,
    change24h: parseUsdChange(quote?.percent_change_24h),
    marketCapUsd,
    volume24hUsd
  };
};

const mapAssetInfoFromCmcEntry = (entry) => {
  if (!entry || typeof entry !== 'object') return null;
  const quoteUsd = entry?.quote?.USD;
  const marketCapUsd = parsePositiveNumber(quoteUsd?.market_cap);
  const volume24hUsd = parsePositiveNumber(quoteUsd?.volume_24h);
  const circulatingSupply = parsePositiveNumber(entry?.circulating_supply);
  const totalSupply = parsePositiveNumber(entry?.total_supply);
  const maxSupply = parsePositiveNumber(entry?.max_supply);

  if (!marketCapUsd && !volume24hUsd && !circulatingSupply && !totalSupply && !maxSupply) {
    return null;
  }

  return {
    marketCapUsd: marketCapUsd ?? null,
    volume24hUsd: volume24hUsd ?? null,
    circulatingSupply: circulatingSupply ?? null,
    totalSupply: totalSupply ?? null,
    maxSupply: maxSupply ?? null,
    liquidityUsd: volume24hUsd ?? null,
    launchedAt: normalizeDateOnly(entry?.date_added)
  };
};

const parseHolderCountFromExplorerHtml = (html) => {
  if (typeof html !== 'string' || !html.trim()) return null;

  const patterns = [
    /Holders:\s*([\d,]+)/i,
    /Token Holders?:\s*([\d,]+)/i,
    /holders_count["']?\s*[:=]\s*["']?([\d,]+)/i,
    /####\s*Holders[\s\S]{0,120}?([\d,]+)/i,
    /Holders\s*\n+\s*([\d,]+)/i
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const count = parsePositiveIntegerLoose(match?.[1]);
    if (count) return count;
  }
  return null;
};

const fetchHolderCountFromEthplorer = async (contractAddress) => {
  const endpoint = new URL(`https://api.ethplorer.io/getTokenInfo/${contractAddress}`);
  endpoint.searchParams.set('apiKey', 'freekey');
  const payload = await fetchJsonWithTimeout(endpoint);
  return parsePositiveIntegerLoose(payload?.holdersCount);
};

const fetchHolderCountFromExplorerTokenPage = async (chainId, contractAddress) => {
  const hostByChain = {
    1: 'https://etherscan.io',
    56: 'https://bscscan.com'
  };
  const host = hostByChain[Number(chainId)];
  if (!host) return null;

  try {
    const endpoint = new URL(`/token/${contractAddress}`, host);
    const html = await fetchHtmlWithTimeout(endpoint, {}, Math.max(8000, config.marketPriceTimeoutMs * 2));
    const parsed = parseHolderCountFromExplorerHtml(html);
    if (parsed) return parsed;
  } catch {
    // Fallback to Jina proxy below.
  }

  // Backup path: read explorer page through text proxy.
  const base = host.replace(/^https?:\/\//i, '');
  const proxyEndpoint = new URL(`https://r.jina.ai/http://${base}/token/${contractAddress}`);
  const proxyText = await fetchHtmlWithTimeout(proxyEndpoint, {
    accept: 'text/plain,text/markdown,text/html'
  }, Math.max(12000, config.marketPriceTimeoutMs * 3));
  return parseHolderCountFromExplorerHtml(proxyText);
};

const fetchHolderCountFromEtherscan = async (chainId, contractAddress) => {
  if (config.etherscanApiKey) {
    try {
      const endpoint = new URL('https://api.etherscan.io/v2/api');
      endpoint.searchParams.set('chainid', String(chainId));
      endpoint.searchParams.set('module', 'token');
      endpoint.searchParams.set('action', 'tokenholdercount');
      endpoint.searchParams.set('contractaddress', contractAddress);
      endpoint.searchParams.set('apikey', config.etherscanApiKey);

      const payload = await fetchJsonWithTimeout(endpoint);
      const count = parsePositiveIntegerLoose(payload?.result);
      if (count) {
        return { count, source: 'etherscan-api' };
      }
    } catch {
      // Fallbacks below keep the endpoint resilient without paid keys.
    }
  }

  if (Number(chainId) === 1) {
    try {
      const count = await fetchHolderCountFromEthplorer(contractAddress);
      if (count) {
        return { count, source: 'ethplorer' };
      }
    } catch {
      // Continue to html scraping fallback.
    }
  }

  try {
    const count = await fetchHolderCountFromExplorerTokenPage(chainId, contractAddress);
    if (count) {
      return {
        count,
        source: Number(chainId) === 56 ? 'bscscan-html' : 'etherscan-html'
      };
    }
  } catch {
    // Final fallback: unavailable.
  }

  return { count: null, source: null };
};

const fetchHolderCountFromTronscan = async (contractAddress) => {
  const endpoint = new URL('https://apilist.tronscanapi.com/api/token_trc20');
  endpoint.searchParams.set('contract', contractAddress);
  const headers = config.tronscanApiKey ? { 'TRON-PRO-API-KEY': config.tronscanApiKey } : {};
  const payload = await fetchJsonWithTimeout(endpoint, headers);
  const token = Array.isArray(payload?.trc20_tokens) ? payload.trc20_tokens[0] : null;
  const count = parsePositiveInteger(token?.holders_count);
  if (!count) return null;
  return count;
};

const fetchHolderCountFromTronscanAccounts = async () => {
  const endpoint = new URL('https://apilist.tronscanapi.com/api/account/list');
  endpoint.searchParams.set('start', '0');
  endpoint.searchParams.set('limit', '1');
  endpoint.searchParams.set('sort', '-balance');
  const headers = config.tronscanApiKey ? { 'TRON-PRO-API-KEY': config.tronscanApiKey } : {};
  const payload = await fetchJsonWithTimeout(endpoint, headers);
  const count = parsePositiveInteger(payload?.account_number);
  if (!count) return null;
  return count;
};

const fetchHolderCountFromFilfoxOverview = async () => {
  const endpoint = new URL('https://filfox.info/api/v1/overview');
  const payload = await fetchJsonWithTimeout(endpoint);
  const count = parsePositiveInteger(payload?.accounts);
  if (!count) return null;
  return count;
};

const fetchHolderCountFromSolscan = async () => {
  if (!config.solscanApiKey) return null;
  const endpoint = new URL('https://pro-api.solscan.io/v2.0/account/total');
  const payload = await fetchJsonWithTimeout(endpoint, {
    token: config.solscanApiKey
  });
  const count = parsePositiveInteger(payload?.data?.total ?? payload?.total);
  if (!count) return null;
  return count;
};

const fetchHolderCountFromCoinCarp = async (coinCode) => {
  const endpoint = new URL('https://sapi.coincarp.com/api/v1/market/chain/holdersummary');
  endpoint.searchParams.set('code', coinCode);
  endpoint.searchParams.set('platform', '');

  const payload = await fetchJsonWithTimeout(endpoint);
  if (Number(payload?.code) !== 200) return null;
  const count = parsePositiveIntegerLoose(payload?.data?.addrcount);
  if (!count) return null;
  return count;
};

const fetchHolderCountFromCoinMetrics = async (coinmetricsAsset) => {
  const endpoint = new URL('https://community-api.coinmetrics.io/v4/timeseries/asset-metrics');
  endpoint.searchParams.set('assets', coinmetricsAsset);
  endpoint.searchParams.set('metrics', HOLDER_METRIC_ADR_BAL_CNT);
  endpoint.searchParams.set('frequency', '1d');
  endpoint.searchParams.set('page_size', '1');
  if (config.coinmetricsApiKey) {
    endpoint.searchParams.set('api_key', config.coinmetricsApiKey);
  }

  const payload = await fetchJsonWithTimeout(endpoint);
  if (payload?.error) return null;

  const row = Array.isArray(payload?.data) ? payload.data[0] : null;
  const count = parsePositiveInteger(row?.[HOLDER_METRIC_ADR_BAL_CNT]);
  if (!count) return null;
  return count;
};

const fetchHolderCountFromBlockchairBitcoin = async () => {
  const endpoint = new URL('https://api.blockchair.com/bitcoin/stats');
  const payload = await fetchJsonWithTimeout(endpoint);
  const count = parsePositiveInteger(payload?.data?.hodling_addresses);
  if (!count) return null;
  return count;
};

const fetchAssetInfosFromCoinMarketCapPro = async (symbols) => {
  if (!config.coinMarketCapApiKey) {
    throw new Error('coinmarketcap api key is not configured');
  }

  const endpoint = new URL('https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest');
  endpoint.searchParams.set('symbol', symbols.join(','));
  endpoint.searchParams.set('convert', 'USD');

  const payload = await fetchJsonWithTimeout(endpoint, {
    'X-CMC_PRO_API_KEY': config.coinMarketCapApiKey
  });

  const itemsBySymbol = {};
  symbols.forEach((symbol) => {
    const dataRow = payload?.data?.[symbol];
    const entry = Array.isArray(dataRow) ? dataRow[0] : dataRow;
    const parsed = mapAssetInfoFromCmcEntry(entry);
    if (!parsed) return;
    itemsBySymbol[symbol] = parsed;
  });

  if (!Object.keys(itemsBySymbol).length) {
    throw new Error('coinmarketcap returned empty asset info payload');
  }

  return {
    source: 'coinmarketcap-pro',
    fetchedAt: new Date().toISOString(),
    symbols,
    itemsBySymbol
  };
};

const fetchAssetInfosFromCoinGecko = async (symbols) => {
  const ids = symbols.map((symbol) => MARKET_SYMBOL_TO_PROVIDER_ID[symbol]).filter(Boolean);
  if (!ids.length) {
    throw new Error('coingecko provider ids are empty');
  }

  const endpoint = new URL('https://api.coingecko.com/api/v3/coins/markets');
  endpoint.searchParams.set('vs_currency', 'usd');
  endpoint.searchParams.set('ids', ids.join(','));
  endpoint.searchParams.set('per_page', String(Math.max(1, ids.length)));
  endpoint.searchParams.set('page', '1');
  endpoint.searchParams.set('sparkline', 'false');

  const payload = await fetchJsonWithTimeout(endpoint);
  const rows = Array.isArray(payload) ? payload : [];
  const symbolByProviderId = new Map(Object.entries(MARKET_SYMBOL_TO_PROVIDER_ID).map(([symbol, providerId]) => [providerId, symbol]));

  const itemsBySymbol = {};
  rows.forEach((row) => {
    const providerId = String(row?.id ?? '').trim().toLowerCase();
    const symbol = symbolByProviderId.get(providerId);
    if (!symbol) return;

    const marketCapUsd = parsePositiveNumber(row?.market_cap);
    const volume24hUsd = parsePositiveNumber(row?.total_volume);
    const circulatingSupply = parsePositiveNumber(row?.circulating_supply);
    const totalSupply = parsePositiveNumber(row?.total_supply);
    const maxSupply = parsePositiveNumber(row?.max_supply);

    itemsBySymbol[symbol] = {
      marketCapUsd: marketCapUsd ?? null,
      volume24hUsd: volume24hUsd ?? null,
      circulatingSupply: circulatingSupply ?? null,
      totalSupply: totalSupply ?? null,
      maxSupply: maxSupply ?? null,
      liquidityUsd: volume24hUsd ?? null,
      launchedAt: MARKET_LAUNCHED_FALLBACK_BY_SYMBOL[symbol] ?? null
    };
  });

  if (!Object.keys(itemsBySymbol).length) {
    throw new Error('coingecko returned empty asset info payload');
  }

  return {
    source: 'coingecko',
    fetchedAt: new Date().toISOString(),
    symbols,
    itemsBySymbol
  };
};

const mapPopularFromCmcPublic = (item, index) => {
  const symbol = String(item?.symbol ?? '')
    .trim()
    .toUpperCase();
  if (!symbol) return null;

  const usdQuote = Array.isArray(item?.quotes) ? item.quotes.find((quote) => String(quote?.name ?? '').toUpperCase() === 'USD') : null;
  const priceUsd = parseUsd(usdQuote?.price);
  const volume24hUsd = parseUsd(usdQuote?.volume24h);
  if (priceUsd === null || volume24hUsd === null) return null;

  const marketCapUsd = parseUsd(usdQuote?.marketCap) ?? 0;
  const rank = Number(item?.cmcRank);

  const iconId = parseIconId(item?.id);
  return {
    id: `cmc-public-${item?.id ?? symbol}-${index + 1}`,
    rank: Number.isFinite(rank) ? rank : index + 1,
    symbol,
    name: String(item?.name ?? symbol).trim() || symbol,
    iconId,
    iconUrl: toCmcIconUrl(iconId),
    priceUsd,
    change24h: parseUsdChange(usdQuote?.percentChange24h),
    marketCapUsd,
    volume24hUsd
  };
};

const fetchPopularTokensFromCoinMarketCap = async (limit) => {
  const buildSnapshot = (tokens, source) => ({
    source,
    fetchedAt: new Date().toISOString(),
    sort: 'volume_24h_desc',
    limit,
    tokens
  });

  const tryProApi = async () => {
    const endpoint = new URL('https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest');
    endpoint.searchParams.set('start', '1');
    endpoint.searchParams.set('limit', String(limit));
    endpoint.searchParams.set('convert', 'USD');
    endpoint.searchParams.set('sort', 'volume_24h');
    endpoint.searchParams.set('sort_dir', 'desc');

    const payload = await fetchJsonWithTimeout(endpoint, {
      'X-CMC_PRO_API_KEY': config.coinMarketCapApiKey
    });
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    const tokens = normalizePopularTokens(rows, mapPopularFromCmcPro, limit);
    return buildSnapshot(tokens, 'coinmarketcap-pro');
  };

  const tryPublicApi = async () => {
    const endpoint = new URL('https://api.coinmarketcap.com/data-api/v3/cryptocurrency/listing');
    endpoint.searchParams.set('start', '1');
    endpoint.searchParams.set('limit', String(limit));
    endpoint.searchParams.set('sortBy', 'volume_24h');
    endpoint.searchParams.set('sortType', 'desc');
    endpoint.searchParams.set('convert', 'USD');
    endpoint.searchParams.set('cryptoType', 'all');
    endpoint.searchParams.set('tagType', 'all');

    const payload = await fetchJsonWithTimeout(endpoint);
    const rows = Array.isArray(payload?.data?.cryptoCurrencyList) ? payload.data.cryptoCurrencyList : [];
    const tokens = normalizePopularTokens(rows, mapPopularFromCmcPublic, limit);
    return buildSnapshot(tokens, 'coinmarketcap-public');
  };

  if (config.coinMarketCapApiKey) {
    try {
      return await tryProApi();
    } catch (error) {
      return tryPublicApi();
    }
  }

  return tryPublicApi();
};

const parseRankForMapPriority = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return Number.MAX_SAFE_INTEGER;
  return parsed;
};

const fetchTokenIconMapFromCoinMarketCap = async () => {
  const endpoint = new URL('https://api.coinmarketcap.com/data-api/v3/map/all');
  endpoint.searchParams.set('listing_status', 'active,untracked');

  const payload = await fetchJsonWithTimeout(endpoint);
  const rows = Array.isArray(payload?.data?.cryptoCurrencyMap) ? payload.data.cryptoCurrencyMap : [];
  if (!rows.length) {
    throw new Error('coinmarketcap returned empty token map payload');
  }

  const bySymbol = new Map();
  rows.forEach((row) => {
    const symbol = String(row?.symbol ?? '')
      .trim()
      .toUpperCase();
    if (!symbol) return;

    const id = Number(row?.id);
    if (!Number.isFinite(id) || id <= 0) return;

    const iconUrl = toCmcIconUrl(id);
    if (!iconUrl) return;

    const rank = parseRankForMapPriority(row?.rank);
    const candidate = {
      symbol,
      id: Math.floor(id),
      name: String(row?.name ?? symbol).trim() || symbol,
      rank,
      iconUrl
    };

    const prev = bySymbol.get(symbol);
    if (!prev || candidate.rank < prev.rank || (candidate.rank === prev.rank && candidate.id < prev.id)) {
      bySymbol.set(symbol, candidate);
    }
  });

  const itemsBySymbol = {};
  bySymbol.forEach((value, key) => {
    itemsBySymbol[key] = {
      symbol: value.symbol,
      id: value.id,
      name: value.name,
      iconUrl: value.iconUrl
    };
  });

  return {
    source: 'coinmarketcap-public-map',
    fetchedAt: new Date().toISOString(),
    itemsBySymbol
  };
};

export const getMarketPriceSnapshot = async (requestedSymbols) => {
  const symbols = normalizeSymbols(requestedSymbols.length ? requestedSymbols : [...SUPPORTED_MARKET_SYMBOLS]);
  const cacheKey = buildCacheKey(symbols);
  const now = Date.now();
  const cached = marketCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return {
      ...cached.snapshot,
      symbols,
      stale: false
    };
  }

  try {
    const cmcSymbols = symbols.filter((symbol) => Number.isFinite(MARKET_SYMBOL_TO_CMC_ID[symbol]));

    const safeLoad = async (loader) => {
      try {
        return await loader();
      } catch (error) {
        return null;
      }
    };

    const [cmcSnapshot, coinoneSnapshot, fxSnapshot] = await Promise.all([
      cmcSymbols.length ? safeLoad(() => fetchPricesFromCoinMarketCapPro(cmcSymbols)) : Promise.resolve(null),
      safeLoad(() => fetchPricesFromCoinoneKrw(symbols)),
      safeLoad(() => fetchFxRatesFromNaver())
    ]);

    const usdKrwRate =
      parsePositiveNumber(fxSnapshot?.refs?.usdKrw) ?? parsePositiveNumber(fxSnapshot?.rates?.KRW) ?? CMC_DEFAULT_KRW_RATE;
    const naverUsdKrw = parsePositiveNumber(fxSnapshot?.refs?.usdKrw);
    const naverCnyKrw = parsePositiveNumber(fxSnapshot?.refs?.cnyKrw);
    const derivedUsdCny = naverUsdKrw && naverCnyKrw ? naverUsdKrw / naverCnyKrw : null;
    const usdCnyRate = parsePositiveNumber(fxSnapshot?.rates?.CNY) ?? derivedUsdCny ?? CMC_DEFAULT_CNY_RATE;

    const missingUsdSymbols = symbols.filter((symbol) => {
      const cmcUsd = parsePositiveNumber(cmcSnapshot?.prices?.[symbol]?.usd);
      if (cmcUsd) return false;
      const coinoneKrw = parsePositiveNumber(coinoneSnapshot?.prices?.[symbol]?.krw);
      if (coinoneKrw && usdKrwRate > 0) return false;
      return true;
    });

    const geckoSnapshot = missingUsdSymbols.length
      ? await safeLoad(() => fetchPricesFromCoinGecko(missingUsdSymbols))
      : null;

    const prices = {};
    symbols.forEach((symbol) => {
      const cmc = cmcSnapshot?.prices?.[symbol];
      const coinone = coinoneSnapshot?.prices?.[symbol];
      const gecko = geckoSnapshot?.prices?.[symbol];

      const cmcUsd = parsePositiveNumber(cmc?.usd);
      const coinoneKrw = parsePositiveNumber(coinone?.krw);
      const cmcKrw = parsePositiveNumber(cmc?.krw);
      const cmcCny = parsePositiveNumber(cmc?.cny);
      const geckoUsd = parsePositiveNumber(gecko?.priceUsd);

      const priceUsdFromCoinone = coinoneKrw && usdKrwRate > 0 ? coinoneKrw / usdKrwRate : null;
      const priceUsd = cmcUsd ?? priceUsdFromCoinone ?? geckoUsd;
      if (!priceUsd) return;

      const priceKrw = coinoneKrw ?? cmcKrw ?? priceUsd * usdKrwRate;
      const priceCny = cmcCny ?? priceUsd * usdCnyRate;

      const change24h = Number.isFinite(cmc?.change24h)
        ? Number(cmc.change24h)
        : Number.isFinite(coinone?.change24h)
          ? Number(coinone.change24h)
          : parseUsdChange(gecko?.change24h);

      prices[symbol] = {
        priceUsd,
        change24h,
        priceKrw,
        priceCny,
        sourceUsd: cmcUsd ? 'coinmarketcap-pro' : priceUsdFromCoinone ? 'coinone-public' : 'coingecko',
        sourceKrw: coinoneKrw ? 'coinone-public' : cmcKrw ? 'coinmarketcap-pro' : 'derived',
        sourceCny: cmcCny ? 'coinmarketcap-pro' : 'derived'
      };
    });

    if (!Object.keys(prices).length) {
      throw new Error('market providers returned empty price payload');
    }

    const snapshot = {
      source: 'hybrid-cmc-coinone',
      fetchedAt: new Date().toISOString(),
      symbols,
      stale: false,
      policy: {
        USD: cmcSnapshot ? 'coinmarketcap-pro' : coinoneSnapshot ? 'coinone-public -> coingecko' : 'coingecko',
        CNY: cmcSnapshot ? 'coinmarketcap-pro' : 'derived from USD x FX',
        KRW: 'coinone-public -> coinmarketcap-pro -> derived'
      },
      refs: {
        usdKrw: usdKrwRate,
        usdCny: usdCnyRate
      },
      prices
    };

    marketCache.set(cacheKey, {
      snapshot,
      expiresAt: now + Math.max(1000, config.marketPriceTtlMs)
    });
    return {
      ...snapshot,
      symbols,
      stale: false
    };
  } catch (error) {
    if (cached?.snapshot) {
      return {
        ...cached.snapshot,
        symbols,
        stale: true
      };
    }
    throw error;
  }
};

export const getMarketPopularTokensSnapshot = async (requestedLimit = MARKET_POPULAR_DEFAULT_LIMIT) => {
  const limit = parseRequestedMarketPopularLimit(requestedLimit);
  const cacheKey = `popular:${limit}`;
  const now = Date.now();
  const cached = marketPopularCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return {
      ...cached.snapshot,
      stale: false
    };
  }

  try {
    const snapshot = await fetchPopularTokensFromCoinMarketCap(limit);
    marketPopularCache.set(cacheKey, {
      snapshot,
      expiresAt: now + Math.max(1000, config.marketPopularTtlMs)
    });
    return {
      ...snapshot,
      stale: false
    };
  } catch (error) {
    if (cached?.snapshot) {
      return {
        ...cached.snapshot,
        stale: true
      };
    }
    throw error;
  }
};

export const getMarketTokenIconsSnapshot = async (requestedSymbols) => {
  const symbols = normalizeSymbols(Array.isArray(requestedSymbols) ? requestedSymbols : []);
  if (!symbols.length) {
    return {
      source: 'coinmarketcap-public-map',
      fetchedAt: new Date().toISOString(),
      symbols: [],
      tokens: [],
      missingSymbols: [],
      stale: false
    };
  }

  const cacheKey = 'token-icon-map:all';
  const now = Date.now();
  const cached = marketTokenIconMapCache.get(cacheKey);

  const pickRows = (snapshot) => {
    const map = snapshot?.itemsBySymbol || {};
    const tokens = symbols.map((symbol) => map[symbol]).filter((row) => Boolean(row));
    const existingSet = new Set(tokens.map((row) => row.symbol));
    const missingSymbols = symbols.filter((symbol) => !existingSet.has(symbol));
    return {
      source: snapshot?.source || 'coinmarketcap-public-map',
      fetchedAt: snapshot?.fetchedAt || new Date().toISOString(),
      symbols,
      tokens,
      missingSymbols
    };
  };

  if (cached && cached.expiresAt > now) {
    return {
      ...pickRows(cached.snapshot),
      stale: false
    };
  }

  try {
    const snapshot = await fetchTokenIconMapFromCoinMarketCap();
    marketTokenIconMapCache.set(cacheKey, {
      snapshot,
      expiresAt: now + Math.max(1000, config.marketPopularTtlMs)
    });
    return {
      ...pickRows(snapshot),
      stale: false
    };
  } catch (error) {
    if (cached?.snapshot) {
      return {
        ...pickRows(cached.snapshot),
        stale: true
      };
    }
    throw error;
  }
};

const fetchTokenIconBinaryFromCmc = async (iconId, size = 64) => {
  const endpoint = `https://s2.coinmarketcap.com/static/img/coins/${size}x${size}/${iconId}.png`;
  const controller = new AbortController();
  const timeoutMs = Math.max(500, config.marketPriceTimeoutMs);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        accept: 'image/png,image/*'
      },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`cmc icon returned ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const body = Buffer.from(arrayBuffer);
    if (!body.length) {
      throw new Error('cmc icon payload is empty');
    }
    return body;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const getMarketTokenIconBinary = async (rawIconId) => {
  const iconId = parseIconId(rawIconId);
  if (!iconId) {
    throw new Error('invalid icon id');
  }

  const cacheKey = `token-icon-binary:${iconId}`;
  const now = Date.now();
  const cached = marketTokenIconBinaryCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return {
      iconId,
      contentType: 'image/png',
      body: cached.body,
      stale: false
    };
  }

  try {
    let body = null;
    try {
      body = await fetchTokenIconBinaryFromCmc(iconId, 64);
    } catch {
      body = await fetchTokenIconBinaryFromCmc(iconId, 128);
    }

    marketTokenIconBinaryCache.set(cacheKey, {
      body,
      expiresAt: now + Math.max(1000, config.marketPopularTtlMs)
    });

    return {
      iconId,
      contentType: 'image/png',
      body,
      stale: false
    };
  } catch (error) {
    if (cached?.body) {
      return {
        iconId,
        contentType: 'image/png',
        body: cached.body,
        stale: true
      };
    }
    throw error;
  }
};

export const getMarketAssetInfoSnapshot = async (requestedSymbols) => {
  const symbols = normalizeSymbols(requestedSymbols.length ? requestedSymbols : [...SUPPORTED_MARKET_SYMBOLS]);
  const cacheKey = `asset-info:${buildCacheKey(symbols)}`;
  const now = Date.now();
  const cached = marketAssetInfoCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return {
      ...cached.snapshot,
      symbols,
      stale: false
    };
  }

  try {
    const snapshot = await (async () => {
      try {
        return await fetchAssetInfosFromCoinMarketCapPro(symbols);
      } catch (error) {
        return await fetchAssetInfosFromCoinGecko(symbols);
      }
    })();

    marketAssetInfoCache.set(cacheKey, {
      snapshot,
      expiresAt: now + Math.max(1000, config.marketPopularTtlMs)
    });
    return {
      ...snapshot,
      symbols,
      stale: false
    };
  } catch (error) {
    if (cached?.snapshot) {
      return {
        ...cached.snapshot,
        symbols,
        stale: true
      };
    }
    throw error;
  }
};

export const getMarketHolderCountSnapshot = async (asset, chain) => {
  const normalizedAsset = String(asset || '').trim().toUpperCase();
  const normalizedChain = String(chain || '').trim().toUpperCase();
  const cacheKey = `${normalizedAsset}:${normalizedChain}`;
  const now = Date.now();
  const cached = marketHoldersCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return {
      ...cached.snapshot,
      stale: false
    };
  }

  try {
    let holderCount = null;
    let source = 'unsupported';
    let metricType = 'unsupported';
    const contractAddress = resolveAssetContractAddress(normalizedAsset, normalizedChain);

    if (normalizedAsset === 'USDT' && contractAddress) {
      metricType = 'token_holders';
      if (normalizedChain === 'ETH') {
        const holderResult = await fetchHolderCountFromEtherscan(1, contractAddress);
        holderCount = holderResult.count;
        source = holderCount ? holderResult.source : 'etherscan-unavailable';
      } else if (normalizedChain === 'BSC') {
        const holderResult = await fetchHolderCountFromEtherscan(56, contractAddress);
        holderCount = holderResult.count;
        source = holderCount ? holderResult.source : 'etherscan-unavailable';
      } else if (normalizedChain === 'TRX') {
        holderCount = await fetchHolderCountFromTronscan(contractAddress);
        source = holderCount ? 'tronscan' : 'tronscan-unavailable';
      }
    } else {
      metricType = 'addresses_with_balance';
      if (normalizedAsset === 'TRX' && normalizedChain === 'TRX') {
        try {
          holderCount = await fetchHolderCountFromTronscanAccounts();
        } catch {
          holderCount = null;
        }
        source = holderCount ? 'tronscan-accounts' : 'tronscan-accounts-unavailable';
      } else if (normalizedAsset === 'FIL' && normalizedChain === 'FIL') {
        try {
          holderCount = await fetchHolderCountFromFilfoxOverview();
        } catch {
          holderCount = null;
        }
        source = holderCount ? 'filfox' : 'filfox-unavailable';
      } else if (normalizedAsset === 'SOL' && normalizedChain === 'SOL') {
        try {
          holderCount = await fetchHolderCountFromSolscan();
        } catch {
          holderCount = null;
        }
        source = holderCount ? 'solscan' : 'solscan-unavailable';

        // Public fallback when Solscan Pro key is unavailable.
        if (!holderCount) {
          try {
            holderCount = await fetchHolderCountFromCoinCarp('solana');
          } catch {
            holderCount = null;
          }
          source = holderCount ? 'coincarp' : source;
        }
      }

      const chainMap = COINMETRICS_ASSET_BY_ASSET_AND_CHAIN[normalizedAsset];
      const coinmetricsAsset = chainMap?.[normalizedChain];
      if (!holderCount && coinmetricsAsset) {
        try {
          holderCount = await fetchHolderCountFromCoinMetrics(coinmetricsAsset);
        } catch {
          holderCount = null;
        }
        source = holderCount ? 'coinmetrics' : 'coinmetrics-unavailable';

        // BTC only: keep an additional public fallback for resilience.
        if (!holderCount && normalizedAsset === 'BTC' && normalizedChain === 'BTC') {
          try {
            holderCount = await fetchHolderCountFromBlockchairBitcoin();
          } catch {
            holderCount = null;
          }
          source = holderCount ? 'blockchair' : source;
        }
      }
    }

    const snapshot = {
      source,
      fetchedAt: new Date().toISOString(),
      asset: normalizedAsset,
      chain: normalizedChain,
      contractAddress,
      holderCount,
      metricType
    };

    if (holderCount) {
      marketHoldersCache.set(cacheKey, {
        snapshot,
        expiresAt: now + Math.max(1000, config.marketPopularTtlMs)
      });
    } else {
      marketHoldersCache.delete(cacheKey);
    }
    return {
      ...snapshot,
      stale: false
    };
  } catch (error) {
    if (cached?.snapshot) {
      return {
        ...cached.snapshot,
        stale: true
      };
    }
    throw error;
  }
};

export const getMarketFxSnapshot = async () => {
  const cacheKey = 'fx:usd';
  const now = Date.now();
  const cached = marketFxCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return {
      ...cached.snapshot,
      stale: false
    };
  }

  try {
    const snapshot = await fetchFxRatesFromNaver();
    marketFxCache.set(cacheKey, {
      snapshot,
      expiresAt: now + Math.max(1000, config.marketFxTtlMs)
    });
    return {
      ...snapshot,
      stale: false
    };
  } catch (error) {
    if (cached?.snapshot) {
      return {
        ...cached.snapshot,
        stale: true
      };
    }
    throw error;
  }
};
