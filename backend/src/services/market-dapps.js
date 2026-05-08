import { config } from '../config.js';

const marketDappCache = new Map();
const MARKET_DAPP_DEFAULT_LIMIT = 10;
const MARKET_DAPP_MAX_LIMIT = 100;
const SUPPORTED_MARKET_DAPP_PROVIDERS = new Set(['dappradar', 'defillama']);
const DAPP_CATEGORY_FILTERS = ['all', 'defi', 'exchanges', 'collectibles', 'social', 'games'];
const MARKET_DAPP_LOG_THROTTLE_MS = 5 * 60 * 1000;
const marketDappIssueLogTimestamps = new Map();

const logMarketDappIssue = (level, event, details = {}) => {
  const cacheKey = `${event}:${JSON.stringify(details)}`;
  const now = Date.now();
  const lastLoggedAt = marketDappIssueLogTimestamps.get(cacheKey) || 0;
  if (now - lastLoggedAt < MARKET_DAPP_LOG_THROTTLE_MS) return;
  marketDappIssueLogTimestamps.set(cacheKey, now);

  const payload = Object.entries(details)
    .map(([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join(' ');
  const message = `[market-dapps] ${event}${payload ? ` ${payload}` : ''}`;
  if (level === 'error') {
    console.error(message);
    return;
  }
  console.warn(message);
};

const parseRequestedMarketDappLimit = (rawLimit) => {
  if (rawLimit === undefined || rawLimit === null || rawLimit === '') {
    return MARKET_DAPP_DEFAULT_LIMIT;
  }

  const candidate = Array.isArray(rawLimit) ? rawLimit[0] : rawLimit;
  const parsed = Number(candidate);
  if (!Number.isFinite(parsed)) return MARKET_DAPP_DEFAULT_LIMIT;

  const normalized = Math.floor(parsed);
  if (normalized < 1) return 1;
  if (normalized > MARKET_DAPP_MAX_LIMIT) return MARKET_DAPP_MAX_LIMIT;
  return normalized;
};

const trim = (value, limit = 0) => {
  const text = String(value ?? '').trim();
  return limit > 0 ? text.slice(0, limit) : text;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toPositiveNumberOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const toPositiveInt = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.floor(parsed);
  return normalized > 0 ? normalized : fallback;
};

const normalizeHttpUrl = (value) => {
  const text = trim(value, 1200);
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

const normalizeUrlPathPart = (value) => trim(value, 320).replace(/^\/+/, '').replace(/\/+$/, '');

const fetchJsonWithTimeout = async (endpoint, headers = {}, sourceName = 'provider') => {
  const controller = new AbortController();
  const timeoutMs = Math.max(500, config.marketPriceTimeoutMs);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        ...headers
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`${sourceName} returned ${response.status}`);
    }
    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
};

const parseConfiguredProviders = () => {
  const raw = String(config.marketDappProviders || '')
    .split(',')
    .map((entry) => trim(entry, 40).toLowerCase())
    .filter(Boolean);

  const deduped = [];
  for (const provider of raw) {
    if (!SUPPORTED_MARKET_DAPP_PROVIDERS.has(provider)) continue;
    if (deduped.includes(provider)) continue;
    deduped.push(provider);
  }

  if (!deduped.length) return ['defillama'];
  return deduped;
};

const formatCompactUsd = (value) => {
  const parsed = toPositiveNumberOrNull(value);
  if (!parsed) return '--';
  const formatter = Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1
  });
  return `$${formatter.format(parsed)}`;
};

const toSummary = ({ tvlUsd, change1d, chains }) => {
  const tvlLabel = formatCompactUsd(tvlUsd);
  const changeLabel = Number.isFinite(change1d)
    ? `${change1d >= 0 ? '+' : ''}${change1d.toFixed(2)}%`
    : '--';
  const chainLabel = Array.isArray(chains) && chains.length ? chains.slice(0, 3).join(', ') : '--';
  return `TVL ${tvlLabel} · 1D ${changeLabel} · ${chainLabel}`;
};

const classifyDappFilter = (row) => {
  const haystack = [row?.category, row?.name, row?.summary, ...(Array.isArray(row?.chains) ? row.chains : [])]
    .join(' ')
    .toLowerCase();

  if (/(game|gaming|metaverse|quest|arcade|play|splinterlands|axie|sandbox)/i.test(haystack)) return 'games';
  if (/(social|community|chat|lens|farcaster|guild|mirror|deso|dscvr)/i.test(haystack)) return 'social';
  if (/(nft|collectible|marketplace|opensea|magic eden|blur|rarible|x2y2|looksrare|tensor)/i.test(haystack)) {
    return 'collectibles';
  }
  if (/(dex|swap|exchange|amm|orderbook|aggregator|bridge|trade|trading|uniswap|pancakeswap|1inch|raydium|jupiter)/i.test(haystack)) {
    return 'exchanges';
  }
  return 'defi';
};

const toDappRowsFromPayload = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.rows)) return payload.rows;
  if (Array.isArray(payload.dapps)) return payload.dapps;
  if (Array.isArray(payload.rankings)) return payload.rankings;
  if (Array.isArray(payload.data?.items)) return payload.data.items;
  if (Array.isArray(payload.data?.results)) return payload.data.results;
  if (Array.isArray(payload.data?.dapps)) return payload.data.dapps;
  if (Array.isArray(payload.result?.items)) return payload.result.items;
  return [];
};

const normalizeChains = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => trim(entry, 32)).filter(Boolean);
  }
  const text = trim(value, 320);
  if (!text) return [];
  if (text.includes(',')) {
    return text
      .split(',')
      .map((entry) => trim(entry, 32))
      .filter(Boolean);
  }
  return [text];
};

const mapDefiLlamaDappRow = (row, index) => {
  const name = trim(row?.name, 160);
  if (!name) return null;

  const slug = trim(row?.slug, 160).toLowerCase();
  const id = trim(row?.id, 200) || slug || `defillama-${index + 1}`;
  const url =
    normalizeHttpUrl(row?.url) ||
    normalizeHttpUrl(row?.website) ||
    (slug ? `https://defillama.com/protocol/${slug}` : 'https://defillama.com');
  const logoUrl = normalizeHttpUrl(row?.logo);
  const category = trim(row?.category, 80) || 'DeFi';
  const tvlUsd = toPositiveNumberOrNull(row?.tvl) ?? 0;
  const change1d = toNumber(row?.change_1d, 0);
  const change7d = toNumber(row?.change_7d, 0);
  const chains = Array.isArray(row?.chains) ? row.chains.map((entry) => trim(entry, 32)).filter(Boolean) : [];

  return {
    id,
    sourceRank: index + 1,
    name,
    slug,
    category,
    url,
    logoUrl,
    tvlUsd,
    change1d,
    change7d,
    chains,
    summary: toSummary({ tvlUsd, change1d, chains })
  };
};

const mapDappRadarDappRow = (row, index) => {
  const name = trim(row?.name || row?.title || row?.dappName, 160);
  if (!name) return null;

  const slug = trim(row?.slug || row?.nameSlug, 160).toLowerCase();
  const id = trim(row?.id || row?.dappId, 200) || slug || `dappradar-${index + 1}`;
  const url =
    normalizeHttpUrl(row?.url) ||
    normalizeHttpUrl(row?.link) ||
    normalizeHttpUrl(row?.website) ||
    normalizeHttpUrl(row?.dappUrl) ||
    (slug ? `https://dappradar.com/dapp/${slug}` : '');
  if (!url) return null;

  const logoUrl =
    normalizeHttpUrl(row?.logoUrl) ||
    normalizeHttpUrl(row?.logo) ||
    normalizeHttpUrl(row?.iconUrl) ||
    normalizeHttpUrl(row?.icon) ||
    normalizeHttpUrl(row?.image);
  const category = trim(row?.category || row?.genre || row?.type, 80) || 'Dapp';
  const tvlUsd = toPositiveNumberOrNull(row?.tvlUsd ?? row?.tvl ?? row?.metrics?.tvl) ?? 0;
  const change1d = toNumber(row?.change1d ?? row?.change_1d ?? row?.metrics?.change1d, 0);
  const change7d = toNumber(row?.change7d ?? row?.change_7d ?? row?.metrics?.change7d, 0);
  const chains = normalizeChains(row?.chains || row?.chain || row?.blockchain);
  const sourceRank = toPositiveInt(row?.rank ?? row?.position ?? row?.ranking ?? row?.index, index + 1);

  return {
    id,
    sourceRank,
    name,
    slug,
    category,
    url,
    logoUrl,
    tvlUsd,
    change1d,
    change7d,
    chains,
    summary: toSummary({ tvlUsd, change1d, chains })
  };
};

const fetchPopularDappsFromDefiLlama = async (limit) => {
  const endpoint = new URL('https://api.llama.fi/protocols');
  const payload = await fetchJsonWithTimeout(endpoint, {}, 'defillama');
  const rows = Array.isArray(payload) ? payload : [];

  const mapped = rows
    .map((row, index) => mapDefiLlamaDappRow(row, index))
    .filter((row) => Boolean(row))
    .sort((a, b) => {
      if (b.tvlUsd !== a.tvlUsd) return b.tvlUsd - a.tvlUsd;
      return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
    })
    .slice(0, limit)
    .map((row, index) => ({ ...row, rank: index + 1, provider: 'defillama' }));

  return mapped;
};

const resolveDappRadarEndpoint = (limit) => {
  const explicit = normalizeHttpUrl(config.dappRadarEndpoint);
  const limitValue = String(Math.max(10, limit));
  const rangeValue = trim(config.dappRadarTopRange, 40) || '30d';
  const limitParam = trim(config.dappRadarTopLimitParam, 40) || 'top';

  if (explicit) {
    const url = new URL(explicit);
    if (!url.searchParams.has(limitParam) && !url.searchParams.has('limit')) {
      url.searchParams.set(limitParam, limitValue);
    }
    if (!url.searchParams.has('range') && rangeValue) {
      url.searchParams.set('range', rangeValue);
    }
    return {
      endpoint: url.toString(),
      source: 'explicit',
      reason: null
    };
  }

  const baseUrl = normalizeHttpUrl(config.dappRadarBaseUrl);
  const projectId = normalizeUrlPathPart(config.dappRadarProjectId);
  const topPath = normalizeUrlPathPart(config.dappRadarTopPath) || 'dapps/top/uaw';

  if (!baseUrl) {
    return {
      endpoint: '',
      source: 'derived',
      reason: 'base_url_missing'
    };
  }

  if (!projectId) {
    return {
      endpoint: '',
      source: 'derived',
      reason: 'project_id_missing'
    };
  }

  const url = new URL(`${projectId}/${topPath}`, `${baseUrl.replace(/\/+$/, '')}/`);
  if (!url.searchParams.has(limitParam) && !url.searchParams.has('limit')) {
    url.searchParams.set(limitParam, limitValue);
  }
  if (!url.searchParams.has('range') && rangeValue) {
    url.searchParams.set('range', rangeValue);
  }

  return {
    endpoint: url.toString(),
    source: 'derived',
    reason: null
  };
};

const createDappRadarHeaders = () => {
  const apiKey = trim(config.dappRadarApiKey, 500);
  if (!apiKey) return {};

  const headerName = trim(config.dappRadarAuthHeader, 80) || 'X-BLOBR-KEY';
  const prefix = trim(config.dappRadarAuthPrefix, 40);
  const value = prefix ? `${prefix} ${apiKey}` : apiKey;
  return { [headerName]: value };
};

const fetchPopularDappsFromDappRadar = async (limit) => {
  const endpointInfo = resolveDappRadarEndpoint(limit);
  if (!endpointInfo.endpoint) {
    logMarketDappIssue('warn', 'provider_not_configured', {
      provider: 'dappradar',
      reason: endpointInfo.reason || 'endpoint_missing'
    });
    throw new Error(`dappradar endpoint is not configured (${endpointInfo.reason || 'endpoint_missing'})`);
  }

  const headers = createDappRadarHeaders();
  if (!Object.keys(headers).length) {
    logMarketDappIssue('warn', 'provider_not_configured', {
      provider: 'dappradar',
      reason: 'api_key_missing'
    });
    throw new Error('dappradar api key is not configured');
  }

  const url = new URL(endpointInfo.endpoint);
  const payload = await fetchJsonWithTimeout(url, headers, 'dappradar');
  const rows = toDappRowsFromPayload(payload);

  const mapped = rows
    .map((row, index) => mapDappRadarDappRow(row, index))
    .filter((row) => Boolean(row))
    .sort((a, b) => {
      if (a.sourceRank !== b.sourceRank) return a.sourceRank - b.sourceRank;
      if (b.tvlUsd !== a.tvlUsd) return b.tvlUsd - a.tvlUsd;
      return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
    })
    .slice(0, limit)
    .map((row, index) => ({ ...row, rank: index + 1, provider: 'dappradar' }));

  return mapped;
};

const resolveMergeKey = (row) => {
  const slug = trim(row?.slug, 200).toLowerCase();
  if (slug) return `slug:${slug}`;

  const url = normalizeHttpUrl(row?.url);
  if (url) {
    try {
      const parsed = new URL(url);
      const host = trim(parsed.hostname, 120).toLowerCase();
      const path = trim(parsed.pathname, 240).toLowerCase();
      if (host) return `url:${host}${path}`;
    } catch {
      // no-op
    }
  }

  const name = trim(row?.name, 200).toLowerCase();
  if (name) return `name:${name}`;
  return '';
};

const mergeProviderRows = (providerRows, limit) => {
  const merged = new Map();

  providerRows.forEach((entry, providerIndex) => {
    entry.rows.forEach((row, rowIndex) => {
      const key = resolveMergeKey(row);
      if (!key) return;

      const existing = merged.get(key);
      const base = existing || {
        ...row,
        sourceRanks: {},
        sourceCount: 0,
        mergeScore: 0
      };

      base.sourceRanks[entry.provider] = row.rank || rowIndex + 1;
      base.sourceCount = Object.keys(base.sourceRanks).length;
      base.mergeScore += 1 / (1 + rowIndex + providerIndex * 0.15);

      if (!base.logoUrl && row.logoUrl) base.logoUrl = row.logoUrl;
      if (!base.category && row.category) base.category = row.category;
      if ((!base.chains || !base.chains.length) && row.chains?.length) base.chains = row.chains;
      if (!base.summary && row.summary) base.summary = row.summary;
      if ((!base.url || base.url.includes('defillama.com/protocol/')) && row.url) base.url = row.url;
      if (toPositiveNumberOrNull(row.tvlUsd) && row.tvlUsd > base.tvlUsd) base.tvlUsd = row.tvlUsd;
      base.change1d = Number.isFinite(row.change1d) ? row.change1d : base.change1d;
      base.change7d = Number.isFinite(row.change7d) ? row.change7d : base.change7d;

      merged.set(key, base);
    });
  });

  return Array.from(merged.values())
    .sort((a, b) => {
      if (b.mergeScore !== a.mergeScore) return b.mergeScore - a.mergeScore;
      if (b.sourceCount !== a.sourceCount) return b.sourceCount - a.sourceCount;
      if (b.tvlUsd !== a.tvlUsd) return b.tvlUsd - a.tvlUsd;
      return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
    })
    .slice(0, limit)
    .map((row, index) => ({
      id: row.id,
      rank: index + 1,
      name: row.name,
      slug: row.slug,
      category: row.category,
      url: row.url,
      logoUrl: row.logoUrl,
      tvlUsd: row.tvlUsd,
      change1d: row.change1d,
      change7d: row.change7d,
      chains: Array.isArray(row.chains) ? row.chains : [],
      summary: row.summary || toSummary({ tvlUsd: row.tvlUsd, change1d: row.change1d, chains: row.chains }),
      providers: Object.keys(row.sourceRanks)
    }));
};

const buildCategoryBuckets = (rows, perCategoryLimit) => {
  const safeLimit = Math.max(1, Math.min(MARKET_DAPP_MAX_LIMIT, Math.floor(perCategoryLimit)));
  const buckets = {
    all: [],
    defi: [],
    exchanges: [],
    collectibles: [],
    social: [],
    games: []
  };

  for (const row of rows) {
    if (buckets.all.length < safeLimit) buckets.all.push(row);
    const filter = classifyDappFilter(row);
    if (buckets[filter].length < safeLimit) {
      buckets[filter].push(row);
    }

    const done = DAPP_CATEGORY_FILTERS.every((key) => buckets[key].length >= safeLimit);
    if (done) break;
  }

  return buckets;
};

const fetchRowsByProvider = async (provider, limit) => {
  let rows = [];
  if (provider === 'dappradar') {
    rows = await fetchPopularDappsFromDappRadar(limit);
  } else if (provider === 'defillama') {
    rows = await fetchPopularDappsFromDefiLlama(limit);
  } else {
    throw new Error(`unsupported provider: ${provider}`);
  }

  if (!Array.isArray(rows) || !rows.length) {
    throw new Error(`${provider} returned empty rows`);
  }
  return rows;
};

const fetchMergedProviderRows = async (configuredProviders, limit) => {
  const providerSnapshots = [];
  const failedProviders = [];
  const providerDiagnostics = [];

  for (const provider of configuredProviders) {
    try {
      const rows = await fetchRowsByProvider(provider, limit);
      providerSnapshots.push({
        provider,
        rows
      });
      providerDiagnostics.push({
        provider,
        status: 'ok',
        rows: rows.length
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      failedProviders.push({
        provider,
        reason
      });
      providerDiagnostics.push({
        provider,
        status: 'failed',
        reason,
        rows: 0
      });
      logMarketDappIssue('warn', 'provider_fetch_failed', {
        provider,
        reason
      });
    }
  }

  if (failedProviders.length && providerSnapshots.length) {
    logMarketDappIssue('warn', 'provider_fallback_applied', {
      configuredProviders,
      providersUsed: providerSnapshots.map((entry) => entry.provider),
      failedProviders
    });
  }

  if (!providerSnapshots.length) {
    const details = failedProviders.map((entry) => `${entry.provider}: ${entry.reason}`).join(' | ');
    logMarketDappIssue('error', 'provider_all_failed', {
      configuredProviders,
      details: details || 'no provider snapshot'
    });
    throw new Error(details || 'no provider snapshot');
  }

  return {
    providerSnapshots,
    failedProviders,
    providerDiagnostics,
    mergedRows: mergeProviderRows(providerSnapshots, limit)
  };
};

export const getMarketPopularDappsSnapshot = async (requestedLimit = MARKET_DAPP_DEFAULT_LIMIT) => {
  const limit = parseRequestedMarketDappLimit(requestedLimit);
  const configuredProviders = parseConfiguredProviders();
  const providerKey = configuredProviders.join(',');
  const cacheKey = `popular-dapps:${limit}:${providerKey}`;
  const now = Date.now();
  const cached = marketDappCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return {
      ...cached.snapshot,
      stale: false
    };
  }

  try {
    const { providerSnapshots, failedProviders, providerDiagnostics, mergedRows } = await fetchMergedProviderRows(configuredProviders, limit);
    const snapshot = {
      source: providerSnapshots.length > 1 ? 'multi' : providerSnapshots[0].provider,
      providersConfigured: configuredProviders,
      providersUsed: providerSnapshots.map((entry) => entry.provider),
      failedProviders,
      providerDiagnostics,
      fetchedAt: new Date().toISOString(),
      sort: 'consensus_rank',
      limit,
      dapps: mergedRows
    };

    marketDappCache.set(cacheKey, {
      snapshot,
      expiresAt: now + Math.max(1000, config.marketPopularTtlMs)
    });
    return {
      ...snapshot,
      stale: false
    };
  } catch (error) {
    if (cached?.snapshot) {
      logMarketDappIssue('warn', 'snapshot_stale_fallback', {
        kind: 'popular-dapps',
        limit,
        reason: error instanceof Error ? error.message : 'unknown error'
      });
      return {
        ...cached.snapshot,
        stale: true
      };
    }
    throw error;
  }
};

export const getMarketPopularDappsByCategorySnapshot = async (requestedLimit = MARKET_DAPP_DEFAULT_LIMIT) => {
  const perCategoryLimit = parseRequestedMarketDappLimit(requestedLimit);
  const configuredProviders = parseConfiguredProviders();
  const providerKey = configuredProviders.join(',');
  const cacheKey = `popular-dapps:by-category:${perCategoryLimit}:${providerKey}`;
  const now = Date.now();
  const cached = marketDappCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return {
      ...cached.snapshot,
      stale: false
    };
  }

  try {
    const candidateLimit = Math.max(200, perCategoryLimit * 40);
    const { providerSnapshots, failedProviders, providerDiagnostics, mergedRows } = await fetchMergedProviderRows(
      configuredProviders,
      candidateLimit
    );
    const dappsByCategory = buildCategoryBuckets(mergedRows, perCategoryLimit);

    const snapshot = {
      source: providerSnapshots.length > 1 ? 'multi' : providerSnapshots[0].provider,
      providersConfigured: configuredProviders,
      providersUsed: providerSnapshots.map((entry) => entry.provider),
      failedProviders,
      providerDiagnostics,
      fetchedAt: new Date().toISOString(),
      sort: 'consensus_rank',
      limit: perCategoryLimit,
      dappsByCategory
    };

    marketDappCache.set(cacheKey, {
      snapshot,
      expiresAt: now + Math.max(1000, config.marketPopularTtlMs)
    });
    return {
      ...snapshot,
      stale: false
    };
  } catch (error) {
    if (cached?.snapshot) {
      logMarketDappIssue('warn', 'snapshot_stale_fallback', {
        kind: 'popular-dapps-by-category',
        limit: perCategoryLimit,
        reason: error instanceof Error ? error.message : 'unknown error'
      });
      return {
        ...cached.snapshot,
        stale: true
      };
    }
    throw error;
  }
};

export { parseRequestedMarketDappLimit };
