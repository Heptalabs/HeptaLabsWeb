import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import { AppError } from '../utils/errors.js';

const DISCOVER_CATEGORIES = ['featured', 'dex', 'lending', 'yield', 'solana', 'market', 'social', 'games'];
const DISCOVER_CATEGORY_SET = new Set(DISCOVER_CATEGORIES);
const DISCOVER_STATUS_SET = new Set(['draft', 'published']);
const DISCOVER_SECTIONS = ['feature', 'earn', 'dapps', 'watchlist', 'sites', 'latest'];
const DISCOVER_SECTION_SET = new Set(DISCOVER_SECTIONS);
const DISCOVER_ACTION_TYPES = ['external', 'internal', 'none'];
const DISCOVER_ACTION_TYPE_SET = new Set(DISCOVER_ACTION_TYPES);
const SUPPORTED_LANGS = ['ko', 'en', 'zh'];
const AUTO_CACHE_TTL_MS = 5 * 60 * 1000;
export const WEEKLY_BRIEFING_ITEM_ID = 'imwallet-weekly-briefing';

const DEFAULT_SECTION_BY_CATEGORY = {
  featured: 'feature',
  dex: 'dapps',
  lending: 'dapps',
  yield: 'dapps',
  solana: 'dapps',
  market: 'latest',
  social: 'latest',
  games: 'latest'
};

const SECTION_ACTION_FALLBACK_BY_SECTION = {
  feature: 'external',
  earn: 'internal',
  dapps: 'external',
  watchlist: 'none',
  sites: 'external',
  latest: 'external'
};

const serviceDir = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.resolve(serviceDir, '..', 'data', 'discover-content.store.json');
const CLICK_STORE_PATH = path.resolve(serviceDir, '..', 'data', 'discover-clicks.store.json');
export const discoverUploadsDirPath = path.resolve(serviceDir, '..', 'data', 'uploads', 'discover');

const DEFAULT_ALLOWED_EXTERNAL_HOSTS = [
  'coingecko.com',
  'coinmarketcap.com',
  'defillama.com',
  'dune.com',
  'tradingview.com',
  'coindesk.com',
  'aave.com',
  'lido.fi',
  'galxe.com',
  'pancakeswap.finance',
  'uniswap.org',
  'opensea.io',
  'localhost',
  '127.0.0.1'
];

const ENV_ALLOWED_EXTERNAL_HOSTS = (process.env.DISCOVER_ALLOWED_URL_HOSTS || '')
  .split(',')
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);

const ALLOWED_EXTERNAL_HOSTS = new Set([...DEFAULT_ALLOWED_EXTERNAL_HOSTS, ...ENV_ALLOWED_EXTERNAL_HOSTS]);
const ENFORCE_DISCOVER_HTTPS =
  String(process.env.DISCOVER_ENFORCE_HTTPS || '').trim() === 'true' || config.nodeEnv === 'production';

const IMAGE_MIME_EXT_MAP = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp'
};

const MAX_IMAGE_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_CLICK_LOG_ITEMS = 5000;

const nowIso = () => new Date().toISOString();

const toTrimmedString = (value, maxLength = 0) => {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  if (!maxLength) return text;
  return text.slice(0, maxLength);
};

const toBool = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  if (typeof value === 'number') return value === 1;
  return fallback;
};

const toSafeUrl = (value) => {
  const text = toTrimmedString(value, 900);
  if (!text) return '';
  try {
    return normalizeValidatedExternalUrl(text);
  } catch {
    return '';
  }
};

const isAllowedExternalHost = (hostname) => {
  const safeHost = toTrimmedString(hostname, 253).toLowerCase();
  if (!safeHost) return false;
  if (ALLOWED_EXTERNAL_HOSTS.has(safeHost)) return true;
  return Array.from(ALLOWED_EXTERNAL_HOSTS).some((allowed) => safeHost.endsWith(`.${allowed}`));
};

const normalizeValidatedExternalUrl = (value, fieldName = 'url') => {
  const text = toTrimmedString(value, 900);
  if (!text) return '';

  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    throw new AppError(400, `${fieldName} must be a valid URL.`);
  }

  const protocol = parsed.protocol.toLowerCase();
  const host = parsed.hostname.toLowerCase();
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  const httpsAllowed = protocol === 'https:';
  const localHttpAllowed = protocol === 'http:' && isLocal;
  const relaxedHttpAllowed = !ENFORCE_DISCOVER_HTTPS && protocol === 'http:';

  if (!httpsAllowed && !localHttpAllowed && !relaxedHttpAllowed) {
    throw new AppError(400, `${fieldName} must use HTTPS.`);
  }

  if (!isAllowedExternalHost(host)) {
    throw new AppError(400, `${fieldName} host is not allowed.`);
  }

  return parsed.toString();
};

const sanitizeImageUrlInput = (value, fieldName = 'imageUrl') => {
  const text = toTrimmedString(value, 900);
  if (!text) return '';
  if (text.startsWith('/api/v1/content/uploads/')) return text;
  return normalizeValidatedExternalUrl(text, fieldName);
};

const toLocalizedText = (value, fallback = '') => {
  if (typeof value === 'string') {
    const text = toTrimmedString(value, 2000);
    return { ko: text || fallback, en: text || fallback, zh: text || fallback };
  }

  const record = typeof value === 'object' && value ? value : {};
  const ko = toTrimmedString(record.ko, 2000);
  const en = toTrimmedString(record.en, 2000);
  const zh = toTrimmedString(record.zh, 2000);
  const first = ko || en || zh || fallback;
  return {
    ko: ko || first,
    en: en || first,
    zh: zh || first
  };
};

const pickLocalizedText = (record, lang) => {
  if (!record || typeof record !== 'object') return '';
  const preferred = toTrimmedString(record[lang], 2000);
  if (preferred) return preferred;
  const fallback = toTrimmedString(record.en || record.ko || record.zh, 2000);
  return fallback;
};

const parseIsoOrNull = (value) => {
  const text = toTrimmedString(value, 64);
  if (!text) return null;
  const time = Date.parse(text);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
};

const sanitizeScheduleRange = (startsAtRaw, endsAtRaw, { strict = false } = {}) => {
  const startsAt = parseIsoOrNull(startsAtRaw);
  const endsAt = parseIsoOrNull(endsAtRaw);

  if (startsAt && endsAt) {
    const startsTs = Date.parse(startsAt);
    const endsTs = Date.parse(endsAt);
    if (startsTs > endsTs) {
      if (strict) {
        throw new AppError(400, 'startsAt must be earlier than or equal to endsAt.');
      }
      return { startsAt, endsAt: null };
    }
  }

  return { startsAt, endsAt };
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const sanitizeCategory = (value, fallback = 'featured') => {
  const normalized = toTrimmedString(value, 64).toLowerCase();
  if (DISCOVER_CATEGORY_SET.has(normalized)) return normalized;
  return fallback;
};

const sanitizeStatus = (value, fallback = 'draft') => {
  const normalized = toTrimmedString(value, 24).toLowerCase();
  if (DISCOVER_STATUS_SET.has(normalized)) return normalized;
  return fallback;
};

const inferSectionFromCategory = (category) => DEFAULT_SECTION_BY_CATEGORY[category] || 'latest';

const sanitizeSection = (value, fallback = 'latest') => {
  const normalized = toTrimmedString(value, 40).toLowerCase();
  if (DISCOVER_SECTION_SET.has(normalized)) return normalized;
  return fallback;
};

const sanitizeActionType = (value, fallback = 'external') => {
  const normalized = toTrimmedString(value, 24).toLowerCase();
  if (DISCOVER_ACTION_TYPE_SET.has(normalized)) return normalized;
  return fallback;
};

const sanitizeInternalTarget = (value) => toTrimmedString(value, 160).toLowerCase();

const sanitizeTags = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => toTrimmedString(entry, 24))
    .filter(Boolean)
    .slice(0, 8);
};

const resolveActionFields = ({ actionType, sourceUrl, ctaUrl, internalTarget }, fallback = 'none') => {
  const safeInternalTarget = sanitizeInternalTarget(internalTarget);
  const hasExternalUrl = Boolean(sourceUrl || ctaUrl);
  const requested = sanitizeActionType(actionType, fallback);

  if (requested === 'internal') {
    if (safeInternalTarget) {
      return { actionType: 'internal', internalTarget: safeInternalTarget };
    }
    if (hasExternalUrl) {
      return { actionType: 'external', internalTarget: '' };
    }
    return { actionType: 'none', internalTarget: '' };
  }

  if (requested === 'external') {
    if (hasExternalUrl) {
      return { actionType: 'external', internalTarget: '' };
    }
    if (safeInternalTarget) {
      return { actionType: 'internal', internalTarget: safeInternalTarget };
    }
    return { actionType: 'none', internalTarget: '' };
  }

  if (safeInternalTarget) {
    return { actionType: 'internal', internalTarget: safeInternalTarget };
  }
  if (hasExternalUrl) {
    return { actionType: 'external', internalTarget: '' };
  }
  return { actionType: 'none', internalTarget: '' };
};

const enforceSectionActionPolicy = (section, actionFields, sourceUrl, ctaUrl) => {
  const normalizedSection = sanitizeSection(section, 'latest');
  const safeInternalTarget = sanitizeInternalTarget(actionFields?.internalTarget);
  const hasExternalUrl = Boolean(sourceUrl || ctaUrl);

  // Feature and sites are external-link only to keep behavior predictable in app.
  if (normalizedSection === 'feature' || normalizedSection === 'sites') {
    if (!hasExternalUrl) return { actionType: 'none', internalTarget: '' };
    return { actionType: 'external', internalTarget: '' };
  }

  // Earn section is in-app navigation only.
  if (normalizedSection === 'earn') {
    return { actionType: 'internal', internalTarget: safeInternalTarget || 'home' };
  }

  return actionFields;
};

const resolveActionFieldsBySection = ({ section, actionType, sourceUrl, ctaUrl, internalTarget }, fallback = 'none') => {
  const normalizedSection = sanitizeSection(section, 'latest');
  const sectionFallback = SECTION_ACTION_FALLBACK_BY_SECTION[normalizedSection] || fallback;
  const resolved = resolveActionFields({ actionType, sourceUrl, ctaUrl, internalTarget }, sectionFallback);
  return enforceSectionActionPolicy(normalizedSection, resolved, sourceUrl, ctaUrl);
};

const seedManualItems = () => {
  const createdAt = nowIso();
  return [
    {
      id: WEEKLY_BRIEFING_ITEM_ID,
      kind: 'manual',
      status: 'published',
      category: 'market',
      section: 'latest',
      pinned: true,
      priority: 90,
      title: {
        ko: 'IMWallet 주간 브리핑',
        en: 'IMWallet Weekly Brief',
        zh: 'IMWallet 每周简报'
      },
      summary: {
        ko: '이번 주 핵심 시장 움직임과 보안 공지, 신규 체인 업데이트를 한 번에 확인하세요.',
        en: 'Catch weekly market moves, security notices, and new chain updates in one view.',
        zh: '一页查看本周市场动态、安全公告与新链更新。'
      },
      sourceName: 'IMWallet Research',
      sourceUrl: '',
      imageUrl: '',
      ctaLabel: {
        ko: '브리핑 열기',
        en: 'Open briefing',
        zh: '打开简报'
      },
      ctaUrl: '',
      actionType: 'internal',
      internalTarget: 'discover:briefing',
      tags: ['briefing', 'weekly', 'imwallet'],
      startsAt: null,
      endsAt: null,
      publishedAt: createdAt,
      createdAt,
      updatedAt: createdAt
    }
  ];
};

const defaultStore = () => {
  const updatedAt = nowIso();
  return {
    version: 1,
    updatedAt,
    items: seedManualItems()
  };
};

let storeState = null;
let storeLoadPromise = null;
let clickStoreState = null;
let clickStoreLoadPromise = null;

let autoCache = {
  items: [],
  fetchedAt: '',
  source: 'fallback',
  stale: true,
  expiresAt: 0
};

const ICON_VERIFY_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const ICON_VERIFY_TIMEOUT_MS = 3500;
const discoverIconVerifyCache = new Map();

const ICON_HOST_OVERRIDE_MAP = Object.freeze({
  'app.1inch.io': 'https://assets.coingecko.com/coins/images/13469/large/1inch-token.png',
  '1inch.io': 'https://assets.coingecko.com/coins/images/13469/large/1inch-token.png',
  'app.compound.finance': 'https://assets.coingecko.com/coins/images/10775/large/COMP.png',
  'compound.finance': 'https://assets.coingecko.com/coins/images/10775/large/COMP.png'
});

const normalizePublicImageUrl = (value) => {
  const text = toTrimmedString(value, 900);
  if (!text) return '';
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
    return parsed.toString();
  } catch {
    return '';
  }
};

const buildDiscoverIconCandidates = (entry) => {
  const candidates = [];
  const directImageUrl = normalizePublicImageUrl(entry?.imageUrl);
  if (directImageUrl) candidates.push(directImageUrl);

  const safeSourceUrl = normalizePublicImageUrl(entry?.sourceUrl);
  if (safeSourceUrl) {
    try {
      const host = new URL(safeSourceUrl).hostname.toLowerCase();
      const override = ICON_HOST_OVERRIDE_MAP[host];
      if (override) candidates.push(override);
      candidates.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`);
      candidates.push(`https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`);
      candidates.push(`https://${host}/favicon.ico`);
    } catch {
      // ignore malformed source url
    }
  }

  const deduped = [];
  const seen = new Set();
  candidates.forEach((url) => {
    const key = String(url).trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    deduped.push(url);
  });
  return deduped;
};

const verifyDiscoverIconUrl = async (url) => {
  const safeUrl = normalizePublicImageUrl(url);
  if (!safeUrl) return false;

  const now = Date.now();
  const cached = discoverIconVerifyCache.get(safeUrl);
  if (cached && cached.expiresAt > now) return cached.ok;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ICON_VERIFY_TIMEOUT_MS);
  let ok = false;

  try {
    const response = await fetch(safeUrl, {
      method: 'GET',
      headers: {
        accept: 'image/*'
      },
      signal: controller.signal
    });

    if (response.ok) {
      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      const contentLength = Number(response.headers.get('content-length') || 0);
      ok = contentType.startsWith('image/') && (contentLength === 0 || contentLength >= 128);
    }
  } catch {
    ok = false;
  } finally {
    clearTimeout(timer);
  }

  discoverIconVerifyCache.set(safeUrl, {
    ok,
    expiresAt: now + ICON_VERIFY_CACHE_TTL_MS
  });
  return ok;
};

const resolveVerifiedDiscoverIconUrl = async (entry) => {
  const candidates = buildDiscoverIconCandidates(entry);
  for (const candidate of candidates) {
    // eslint-disable-next-line no-await-in-loop
    const verified = await verifyDiscoverIconUrl(candidate);
    if (verified) return candidate;
  }
  return '';
};

const saveStore = async () => {
  const dir = path.dirname(STORE_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(storeState, null, 2), 'utf-8');
};

const defaultClickStore = () => ({
  version: 1,
  updatedAt: nowIso(),
  items: []
});

const saveClickStore = async () => {
  const dir = path.dirname(CLICK_STORE_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(CLICK_STORE_PATH, JSON.stringify(clickStoreState, null, 2), 'utf-8');
};

const normalizeStoredItem = (raw) => {
  const now = nowIso();
  const status = sanitizeStatus(raw?.status, 'draft');
  const category = sanitizeCategory(raw?.category, 'featured');
  const section = sanitizeSection(raw?.section, inferSectionFromCategory(category));
  const sourceUrl = toSafeUrl(raw?.sourceUrl);
  const ctaUrl = toSafeUrl(raw?.ctaUrl);
  const actionFields = resolveActionFieldsBySection(
    {
      section,
      actionType: raw?.actionType,
      sourceUrl,
      ctaUrl,
      internalTarget: raw?.internalTarget
    },
    SECTION_ACTION_FALLBACK_BY_SECTION[section] || 'none'
  );
  const schedule = sanitizeScheduleRange(raw?.startsAt, raw?.endsAt, { strict: false });
  const publishedAt = status === 'published' ? parseIsoOrNull(raw?.publishedAt) || now : parseIsoOrNull(raw?.publishedAt);
  return {
    id: toTrimmedString(raw?.id, 128) || randomUUID(),
    kind: 'manual',
    status,
    category,
    section,
    pinned: toBool(raw?.pinned, false),
    priority: Math.max(0, Math.min(100, toNumber(raw?.priority, 0))),
    title: toLocalizedText(raw?.title, 'Untitled'),
    summary: toLocalizedText(raw?.summary, ''),
    sourceName: toTrimmedString(raw?.sourceName, 120),
    sourceUrl,
    imageUrl: toSafeUrl(raw?.imageUrl),
    ctaLabel: toLocalizedText(raw?.ctaLabel, 'Open'),
    ctaUrl,
    actionType: actionFields.actionType,
    internalTarget: actionFields.internalTarget,
    tags: sanitizeTags(raw?.tags),
    startsAt: schedule.startsAt,
    endsAt: schedule.endsAt,
    publishedAt,
    createdAt: parseIsoOrNull(raw?.createdAt) || now,
    updatedAt: parseIsoOrNull(raw?.updatedAt) || now
  };
};

const isWeeklyBriefingCandidate = (raw) => {
  const tags = Array.isArray(raw?.tags) ? raw.tags.map((entry) => toTrimmedString(entry, 80).toLowerCase()) : [];
  const tagMatched = tags.some((entry) => entry === 'weekly' || entry === 'briefing' || entry === 'imwallet');
  const source = toTrimmedString(raw?.sourceName, 120).toLowerCase();
  const titleKo = toTrimmedString(raw?.title?.ko, 2000).toLowerCase();
  const titleEn = toTrimmedString(raw?.title?.en, 2000).toLowerCase();
  const titleZh = toTrimmedString(raw?.title?.zh, 2000).toLowerCase();
  const titleMatched = titleKo.includes('브리핑') || titleEn.includes('brief') || titleZh.includes('简报');
  return tagMatched || (source.includes('imwallet') && titleMatched);
};

const normalizeWeeklyBriefingItem = (raw) => {
  const seed = seedManualItems()[0];
  const normalized = normalizeStoredItem({
    ...(raw || {}),
    id: WEEKLY_BRIEFING_ITEM_ID,
    kind: 'manual',
    status: 'published',
    category: 'market',
    section: 'latest',
    pinned: true,
    priority: 90,
    sourceUrl: '',
    ctaUrl: '',
    actionType: 'internal',
    internalTarget: 'discover:briefing'
  });
  return {
    ...normalized,
    id: WEEKLY_BRIEFING_ITEM_ID,
    kind: 'manual',
    status: 'published',
    category: 'market',
    section: 'latest',
    pinned: true,
    priority: 90,
    title: toLocalizedText(normalized.title, pickLocalizedText(seed.title, 'en')),
    summary: toLocalizedText(normalized.summary, pickLocalizedText(seed.summary, 'en')),
    sourceName: toTrimmedString(normalized.sourceName, 120) || seed.sourceName,
    sourceUrl: '',
    ctaLabel: toLocalizedText(normalized.ctaLabel, pickLocalizedText(seed.ctaLabel, 'en')),
    ctaUrl: '',
    actionType: 'internal',
    internalTarget: 'discover:briefing',
    tags: Array.from(new Set([...(normalized.tags || []), 'briefing', 'weekly', 'imwallet']))
  };
};

const canonicalizeManualItems = (items) => {
  const sourceItems = Array.isArray(items) ? items : [];
  const candidate =
    sourceItems.find((entry) => toTrimmedString(entry?.id, 128) === WEEKLY_BRIEFING_ITEM_ID) ||
    sourceItems.find((entry) => isWeeklyBriefingCandidate(entry)) ||
    sourceItems[0] ||
    null;
  return [normalizeWeeklyBriefingItem(candidate)];
};

const ensureStoreLoaded = async () => {
  if (storeState) return storeState;
  if (storeLoadPromise) return storeLoadPromise;

  storeLoadPromise = (async () => {
    try {
      const payload = await fs.readFile(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(payload);
      const parsedItems = Array.isArray(parsed?.items) ? parsed.items : seedManualItems();
      const items = canonicalizeManualItems(parsedItems);
      storeState = {
        version: 1,
        updatedAt: parseIsoOrNull(parsed?.updatedAt) || nowIso(),
        items
      };
    } catch {
      storeState = defaultStore();
      await saveStore();
    } finally {
      storeLoadPromise = null;
    }

    return storeState;
  })();

  return storeLoadPromise;
};

const normalizeStoredClickLog = (raw) => ({
  id: toTrimmedString(raw?.id, 128) || randomUUID(),
  itemId: toTrimmedString(raw?.itemId, 128),
  itemTitle: toTrimmedString(raw?.itemTitle, 240) || 'Untitled',
  category: toTrimmedString(raw?.category, 40),
  section: toTrimmedString(raw?.section, 40),
  declaredActionType: toTrimmedString(raw?.declaredActionType, 24),
  resolvedActionType: toTrimmedString(raw?.resolvedActionType, 24),
  internalTarget: toTrimmedString(raw?.internalTarget, 180),
  externalUrl: toSafeUrl(raw?.externalUrl),
  success: toBool(raw?.success, false),
  reason: toTrimmedString(raw?.reason, 240),
  platform: toTrimmedString(raw?.platform, 24),
  lang: toTrimmedString(raw?.lang, 8),
  walletId: toTrimmedString(raw?.walletId, 128),
  clickedAt: parseIsoOrNull(raw?.clickedAt) || nowIso()
});

const ensureClickStoreLoaded = async () => {
  if (clickStoreState) return clickStoreState;
  if (clickStoreLoadPromise) return clickStoreLoadPromise;

  clickStoreLoadPromise = (async () => {
    try {
      const payload = await fs.readFile(CLICK_STORE_PATH, 'utf-8');
      const parsed = JSON.parse(payload);
      const items = Array.isArray(parsed?.items) ? parsed.items.map((entry) => normalizeStoredClickLog(entry)) : [];
      clickStoreState = {
        version: 1,
        updatedAt: parseIsoOrNull(parsed?.updatedAt) || nowIso(),
        items
      };
    } catch {
      clickStoreState = defaultClickStore();
      await saveClickStore();
    } finally {
      clickStoreLoadPromise = null;
    }

    return clickStoreState;
  })();

  return clickStoreLoadPromise;
};

const isActiveForNow = (item, now) => {
  if (item.status !== 'published') return false;
  if (item.startsAt && Date.parse(item.startsAt) > now) return false;
  if (item.endsAt && Date.parse(item.endsAt) < now) return false;
  return true;
};

const makePublicItem = (item, lang) => ({
  id: item.id,
  kind: item.kind,
  category: item.category,
  section: sanitizeSection(item.section, inferSectionFromCategory(item.category)),
  pinned: item.pinned,
  priority: item.priority,
  title: pickLocalizedText(item.title, lang),
  summary: pickLocalizedText(item.summary, lang),
  sourceName: item.sourceName,
  sourceUrl: item.sourceUrl,
  imageUrl: item.imageUrl,
  ctaLabel: pickLocalizedText(item.ctaLabel, lang),
  ctaUrl: item.ctaUrl,
  actionType: item.actionType,
  internalTarget: item.internalTarget,
  tags: item.tags,
  publishedAt: item.publishedAt || item.updatedAt
});

const fetchJson = async (url, timeoutMs = 5000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!response.ok) {
      throw new Error(`status:${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

const priceSymbolMap = {
  bitcoin: 'BTC',
  ethereum: 'ETH',
  ripple: 'XRP',
  binancecoin: 'BNB',
  solana: 'SOL',
  tron: 'TRX',
  filecoin: 'FIL',
  tether: 'USDT'
};

const autoReferenceLinks = [
  { sourceName: 'CoinGecko', url: 'https://www.coingecko.com/en' },
  { sourceName: 'CoinMarketCap', url: 'https://coinmarketcap.com/' },
  { sourceName: 'DefiLlama', url: 'https://defillama.com/' },
  { sourceName: 'Dune', url: 'https://dune.com/' },
  { sourceName: 'TradingView', url: 'https://www.tradingview.com/markets/cryptocurrencies/prices-all/' }
];

const pickAutoReference = (index = 0) => autoReferenceLinks[index % autoReferenceLinks.length];

const buildFallbackAutoItems = () => {
  const fetchedAt = nowIso();
  return {
    fetchedAt,
    source: 'fallback',
    stale: true,
    items: [
      {
        id: 'auto-fallback-1',
        kind: 'auto',
        status: 'published',
        category: 'market',
        section: 'feature',
        pinned: true,
        priority: 80,
        title: {
          ko: '시장 브리핑을 준비 중입니다',
          en: 'Preparing market briefing',
          zh: '正在准备市场简报'
        },
        summary: {
          ko: '네트워크 상태를 확인하는 동안 마지막 저장 콘텐츠를 표시합니다.',
          en: 'Showing last saved content while checking live feeds.',
          zh: '正在检查实时源，当前显示最近保存的内容。'
        },
        sourceName: 'IMWallet Feed',
        sourceUrl: '',
        imageUrl: '',
        ctaLabel: {
          ko: '새로고침',
          en: 'Refresh',
          zh: '刷新'
        },
        ctaUrl: '',
        actionType: 'none',
        internalTarget: '',
        tags: ['fallback'],
        startsAt: null,
        endsAt: null,
        publishedAt: fetchedAt,
        createdAt: fetchedAt,
        updatedAt: fetchedAt
      }
    ]
  };
};

const buildAutoItems = ({ trending, prices, fetchedAt }) => {
  const items = [];
  const btc = prices.BTC;
  const eth = prices.ETH;
  const summaryRef = pickAutoReference(5);
  const summaryBits = [];
  if (btc) summaryBits.push(`BTC ${btc.change24h >= 0 ? '+' : ''}${btc.change24h.toFixed(2)}%`);
  if (eth) summaryBits.push(`ETH ${eth.change24h >= 0 ? '+' : ''}${eth.change24h.toFixed(2)}%`);

  items.push({
    id: `auto-summary-${fetchedAt.slice(0, 13)}`,
    kind: 'auto',
    status: 'published',
    category: 'market',
    section: 'feature',
    pinned: true,
    priority: 85,
    title: {
      ko: '실시간 시장 스냅샷',
      en: 'Live market snapshot',
      zh: '实时市场快照'
    },
    summary: {
      ko: summaryBits.length ? `오늘 주요 변동: ${summaryBits.join(' · ')}` : '주요 코인 변동을 업데이트하고 있습니다.',
      en: summaryBits.length ? `Top movers today: ${summaryBits.join(' · ')}` : 'Updating market movers now.',
      zh: summaryBits.length ? `今日主要波动：${summaryBits.join(' · ')}` : '正在更新主要币种波动。'
    },
    sourceName: summaryRef.sourceName,
    sourceUrl: summaryRef.url,
    imageUrl: '',
    ctaLabel: {
      ko: '마켓 보기',
      en: 'Open market',
      zh: '查看市场'
    },
    ctaUrl: summaryRef.url,
    actionType: 'external',
    internalTarget: '',
    tags: ['market'],
    startsAt: null,
    endsAt: null,
    publishedAt: fetchedAt,
    createdAt: fetchedAt,
    updatedAt: fetchedAt
  });

  trending.slice(0, 6).forEach((coin, index) => {
    const symbol = toTrimmedString(coin.symbol, 20).toUpperCase();
    const rank = toNumber(coin.market_cap_rank, 0);
    const price = prices[symbol]?.priceUsd;
    const ref = pickAutoReference(index);
    const priceText = Number.isFinite(price) && price > 0 ? `$${price.toLocaleString(undefined, { maximumFractionDigits: 4 })}` : '';
    items.push({
      id: `auto-trending-${symbol || index + 1}-${fetchedAt.slice(0, 16)}`,
      kind: 'auto',
      status: 'published',
      category: 'featured',
      section: 'latest',
      pinned: false,
      priority: 70 - index,
      title: {
        ko: `${coin.name}`,
        en: `${coin.name}`,
        zh: `${coin.name}`
      },
      summary: {
        ko: `심볼 ${symbol}${rank ? ` · 시총 순위 #${rank}` : ''}${priceText ? ` · 현재가 ${priceText}` : ''}`,
        en: `Symbol ${symbol}${rank ? ` · mcap rank #${rank}` : ''}${priceText ? ` · price ${priceText}` : ''}`,
        zh: `代号 ${symbol}${rank ? ` · 市值排名 #${rank}` : ''}${priceText ? ` · 现价 ${priceText}` : ''}`
      },
      sourceName: ref.sourceName,
      sourceUrl: ref.url,
      imageUrl: coin?.small || '',
      ctaLabel: {
        ko: '코인 보기',
        en: 'View coin',
        zh: '查看币种'
      },
      ctaUrl: ref.url,
      actionType: 'external',
      internalTarget: '',
      tags: ['trending', symbol.toLowerCase()],
      startsAt: null,
      endsAt: null,
      publishedAt: fetchedAt,
      createdAt: fetchedAt,
      updatedAt: fetchedAt
    });
  });

  return items;
};

const fetchAutoDiscoverContent = async () => ({
  fetchedAt: nowIso(),
  source: 'imwallet-internal',
  stale: false,
  items: []
});

export const refreshAutoDiscoverContent = async (force = false) => {
  if (!force && autoCache.items.length && Date.now() < autoCache.expiresAt) {
    return autoCache;
  }

  try {
    const payload = await fetchAutoDiscoverContent();
    autoCache = {
      ...payload,
      expiresAt: Date.now() + AUTO_CACHE_TTL_MS
    };
    return autoCache;
  } catch {
    autoCache = {
      fetchedAt: nowIso(),
      source: 'imwallet-internal-fallback',
      stale: true,
      items: [],
      expiresAt: Date.now() + AUTO_CACHE_TTL_MS
    };
    return autoCache;
  }
};

export const listAdminDiscoverItems = async ({ includeAuto = true } = {}) => {
  await ensureStoreLoaded();
  const manualItems = [...storeState.items];
  if (!includeAuto) {
    return manualItems.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    });
  }

  const auto = await refreshAutoDiscoverContent(false);
  return [...manualItems, ...auto.items].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });
};

export const createAdminDiscoverItem = async (payload) => {
  await ensureStoreLoaded();
  const now = nowIso();
  const status = sanitizeStatus(payload?.status, 'draft');
  const category = sanitizeCategory(payload?.category, 'featured');
  const section = sanitizeSection(payload?.section, inferSectionFromCategory(category));
  const sourceUrl = normalizeValidatedExternalUrl(payload?.sourceUrl, 'sourceUrl');
  const ctaUrl = normalizeValidatedExternalUrl(payload?.ctaUrl, 'ctaUrl');
  const schedule = sanitizeScheduleRange(payload?.startsAt, payload?.endsAt, { strict: true });
  const actionFields = resolveActionFieldsBySection(
    {
      section,
      actionType: payload?.actionType,
      sourceUrl,
      ctaUrl,
      internalTarget: payload?.internalTarget
    },
    SECTION_ACTION_FALLBACK_BY_SECTION[section] || 'none'
  );
  const item = {
    id: randomUUID(),
    kind: 'manual',
    status,
    category,
    section,
    pinned: toBool(payload?.pinned, false),
    priority: Math.max(0, Math.min(100, toNumber(payload?.priority, 40))),
    title: toLocalizedText(payload?.title, 'Untitled'),
    summary: toLocalizedText(payload?.summary, ''),
    sourceName: toTrimmedString(payload?.sourceName, 120),
    sourceUrl,
    imageUrl: sanitizeImageUrlInput(payload?.imageUrl),
    ctaLabel: toLocalizedText(payload?.ctaLabel, 'Open'),
    ctaUrl,
    actionType: actionFields.actionType,
    internalTarget: actionFields.internalTarget,
    tags: sanitizeTags(payload?.tags),
    startsAt: schedule.startsAt,
    endsAt: schedule.endsAt,
    publishedAt: status === 'published' ? parseIsoOrNull(payload?.publishedAt) || now : parseIsoOrNull(payload?.publishedAt),
    createdAt: now,
    updatedAt: now
  };

  storeState.items = [item, ...storeState.items];
  storeState.updatedAt = now;
  await saveStore();
  return item;
};

export const updateAdminDiscoverItem = async (id, patch) => {
  await ensureStoreLoaded();
  const index = storeState.items.findIndex((entry) => entry.id === id);
  if (index < 0) return null;

  const prev = storeState.items[index];
  const nextStatus = patch?.status ? sanitizeStatus(patch.status, prev.status) : prev.status;
  const nextCategory = patch?.category ? sanitizeCategory(patch.category, prev.category) : prev.category;
  const nextSection =
    patch?.section !== undefined
      ? sanitizeSection(patch.section, inferSectionFromCategory(nextCategory))
      : patch?.category !== undefined
        ? inferSectionFromCategory(nextCategory)
        : sanitizeSection(prev.section, inferSectionFromCategory(nextCategory));
  const now = nowIso();
  const nextSourceUrl = patch?.sourceUrl === undefined ? prev.sourceUrl : normalizeValidatedExternalUrl(patch.sourceUrl, 'sourceUrl');
  const nextCtaUrl = patch?.ctaUrl === undefined ? prev.ctaUrl : normalizeValidatedExternalUrl(patch.ctaUrl, 'ctaUrl');
  const nextInternalTarget = patch?.internalTarget === undefined ? prev.internalTarget : sanitizeInternalTarget(patch.internalTarget);
  const nextStartsAtRaw = patch?.startsAt === undefined ? prev.startsAt : patch.startsAt;
  const nextEndsAtRaw = patch?.endsAt === undefined ? prev.endsAt : patch.endsAt;
  const schedule = sanitizeScheduleRange(nextStartsAtRaw, nextEndsAtRaw, { strict: true });
  const actionFields = resolveActionFieldsBySection(
    {
      section: nextSection,
      actionType: patch?.actionType === undefined ? prev.actionType : patch.actionType,
      sourceUrl: nextSourceUrl,
      ctaUrl: nextCtaUrl,
      internalTarget: nextInternalTarget
    },
    SECTION_ACTION_FALLBACK_BY_SECTION[nextSection] || prev.actionType || 'none'
  );
  const next = {
    ...prev,
    status: nextStatus,
    category: nextCategory,
    section: nextSection,
    pinned: patch?.pinned === undefined ? prev.pinned : toBool(patch.pinned, prev.pinned),
    priority: patch?.priority === undefined ? prev.priority : Math.max(0, Math.min(100, toNumber(patch.priority, prev.priority))),
    title: patch?.title === undefined ? prev.title : toLocalizedText(patch.title, pickLocalizedText(prev.title, 'en') || 'Untitled'),
    summary: patch?.summary === undefined ? prev.summary : toLocalizedText(patch.summary, pickLocalizedText(prev.summary, 'en')),
    sourceName: patch?.sourceName === undefined ? prev.sourceName : toTrimmedString(patch.sourceName, 120),
    sourceUrl: nextSourceUrl,
    imageUrl: patch?.imageUrl === undefined ? prev.imageUrl : sanitizeImageUrlInput(patch.imageUrl),
    ctaLabel: patch?.ctaLabel === undefined ? prev.ctaLabel : toLocalizedText(patch.ctaLabel, pickLocalizedText(prev.ctaLabel, 'en') || 'Open'),
    ctaUrl: nextCtaUrl,
    actionType: actionFields.actionType,
    internalTarget: actionFields.internalTarget,
    tags: patch?.tags === undefined ? prev.tags : sanitizeTags(patch.tags),
    startsAt: schedule.startsAt,
    endsAt: schedule.endsAt,
    publishedAt:
      patch?.publishedAt !== undefined
        ? parseIsoOrNull(patch.publishedAt)
        : nextStatus === 'published'
          ? prev.publishedAt || now
          : prev.publishedAt,
    updatedAt: now
  };

  storeState.items[index] = next;
  storeState.updatedAt = now;
  await saveStore();
  return next;
};

export const deleteAdminDiscoverItem = async (id) => {
  await ensureStoreLoaded();
  const before = storeState.items.length;
  storeState.items = storeState.items.filter((entry) => entry.id !== id);
  if (storeState.items.length === before) return false;
  storeState.updatedAt = nowIso();
  await saveStore();
  return true;
};

export const appendDiscoverClickLog = async (payload) => {
  await ensureClickStoreLoaded();

  const externalUrl = toTrimmedString(payload?.externalUrl, 900);
  const safeExternalUrl = externalUrl ? toSafeUrl(externalUrl) : '';
  const item = {
    id: randomUUID(),
    itemId: toTrimmedString(payload?.itemId, 128),
    itemTitle: toTrimmedString(payload?.itemTitle, 240) || 'Untitled',
    category: toTrimmedString(payload?.category, 40),
    section: toTrimmedString(payload?.section, 40),
    declaredActionType: sanitizeActionType(payload?.declaredActionType, 'none'),
    resolvedActionType: sanitizeActionType(payload?.resolvedActionType, 'none'),
    internalTarget: sanitizeInternalTarget(payload?.internalTarget),
    externalUrl: safeExternalUrl,
    success: toBool(payload?.success, false),
    reason: toTrimmedString(payload?.reason, 240),
    platform: toTrimmedString(payload?.platform, 24),
    lang: toTrimmedString(payload?.lang, 8),
    walletId: toTrimmedString(payload?.walletId, 128),
    clickedAt: nowIso()
  };

  clickStoreState.items = [item, ...(clickStoreState.items || [])].slice(0, MAX_CLICK_LOG_ITEMS);
  clickStoreState.updatedAt = nowIso();
  await saveClickStore();
  return item;
};

export const listAdminDiscoverClickLogs = async ({ limit = 50 } = {}) => {
  await ensureClickStoreLoaded();
  const max = Math.max(1, Math.min(200, toNumber(limit, 50)));
  return [...clickStoreState.items]
    .sort((a, b) => Date.parse(b.clickedAt) - Date.parse(a.clickedAt))
    .slice(0, max);
};

export const summarizeAdminDiscoverClickLogs = async ({ days = 7 } = {}) => {
  await ensureClickStoreLoaded();
  const windowDays = Math.max(1, Math.min(90, toNumber(days, 7)));
  const since = Date.now() - windowDays * 24 * 60 * 60 * 1000;

  const scope = (clickStoreState.items || []).filter((row) => Date.parse(row.clickedAt) >= since);
  const totalClicks = scope.length;
  const successClicks = scope.filter((row) => row.success).length;

  const sectionMap = new Map();
  const actionMap = new Map();
  const itemMap = new Map();

  scope.forEach((row) => {
    const sectionKey = row.section || 'unknown';
    sectionMap.set(sectionKey, (sectionMap.get(sectionKey) || 0) + 1);

    const actionKey = row.resolvedActionType || 'none';
    actionMap.set(actionKey, (actionMap.get(actionKey) || 0) + 1);

    const itemKey = row.itemId || 'unknown';
    const current = itemMap.get(itemKey) || { itemId: row.itemId || 'unknown', itemTitle: row.itemTitle || 'Untitled', count: 0 };
    current.count += 1;
    itemMap.set(itemKey, current);
  });

  const toSortedArray = (map) =>
    Array.from(map.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);

  return {
    windowDays,
    totalClicks,
    successClicks,
    bySection: toSortedArray(sectionMap).map((entry) => ({ section: entry.key, count: entry.count })),
    byAction: toSortedArray(actionMap).map((entry) => ({ actionType: entry.key, count: entry.count })),
    topItems: Array.from(itemMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((entry) => ({ itemId: entry.itemId, itemTitle: entry.itemTitle, count: entry.count }))
  };
};

const normalizeUploadBaseName = (value) => {
  const name = toTrimmedString(value, 80).replace(/\.[^/.]+$/, '');
  const safe = name.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_{2,}/g, '_').replace(/^_+|_+$/g, '');
  return safe || 'discover_image';
};

const decodeImageBase64 = (input) => {
  const raw = toTrimmedString(input, 8_000_000);
  if (!raw) {
    throw new AppError(400, 'dataBase64 is required.');
  }
  const payload = raw.includes(',') ? raw.split(',').pop() : raw;
  if (!payload) {
    throw new AppError(400, 'Invalid image payload.');
  }
  const buffer = Buffer.from(payload, 'base64');
  if (!buffer.length) {
    throw new AppError(400, 'Invalid base64 image.');
  }
  if (buffer.length > MAX_IMAGE_UPLOAD_BYTES) {
    throw new AppError(413, 'Image is too large. Max 4MB is allowed.');
  }
  return buffer;
};

export const uploadDiscoverImage = async ({ fileName, mimeType, dataBase64, baseUrl }) => {
  const mime = toTrimmedString(mimeType, 64).toLowerCase();
  const extension = IMAGE_MIME_EXT_MAP[mime];
  if (!extension) {
    throw new AppError(400, 'Unsupported image type. Use png/jpeg/webp.');
  }

  const buffer = decodeImageBase64(dataBase64);
  const name = normalizeUploadBaseName(fileName);
  const generated = `${Date.now()}-${randomUUID().slice(0, 8)}-${name}.${extension}`;

  await fs.mkdir(discoverUploadsDirPath, { recursive: true });
  const absolutePath = path.join(discoverUploadsDirPath, generated);
  await fs.writeFile(absolutePath, buffer);

  const uploadPath = `/api/v1/content/uploads/${generated}`;
  const normalizedBase = toTrimmedString(baseUrl, 300).replace(/\/+$/, '');
  const imageUrl = normalizedBase ? `${normalizedBase}${uploadPath}` : uploadPath;
  return {
    fileName: generated,
    bytes: buffer.length,
    uploadedAt: nowIso(),
    imageUrl
  };
};

export const getDiscoverPublicFeed = async ({ lang = 'ko', category = 'all', section = 'all', limit = 40 } = {}) => {
  await ensureStoreLoaded();
  const normalizedLang = SUPPORTED_LANGS.includes(lang) ? lang : 'ko';
  const normalizedCategory = sanitizeCategory(category, 'featured');
  const useCategoryFilter = toTrimmedString(category, 40).toLowerCase() !== 'all';
  const normalizedSection = sanitizeSection(section, 'latest');
  const useSectionFilter = toTrimmedString(section, 40).toLowerCase() !== 'all';
  const maxItems = Math.max(1, Math.min(100, toNumber(limit, 40)));

  const now = Date.now();
  const manualItems = storeState.items.filter((entry) => isActiveForNow(entry, now));
  const auto = await refreshAutoDiscoverContent(false);

  const mergedRaw = [...manualItems, ...auto.items]
    .filter((entry) => (useCategoryFilter ? entry.category === normalizedCategory : true))
    .filter((entry) => (useSectionFilter ? sanitizeSection(entry.section, inferSectionFromCategory(entry.category)) === normalizedSection : true))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.priority !== b.priority) return b.priority - a.priority;
      return Date.parse(b.publishedAt || b.updatedAt) - Date.parse(a.publishedAt || a.updatedAt);
    })
    .slice(0, maxItems);

  const mergedWithIconGate = await Promise.all(
    mergedRaw.map(async (entry) => {
      const sectionValue = sanitizeSection(entry.section, inferSectionFromCategory(entry.category));
      if (sectionValue !== 'dapps') return entry;
      const verifiedIconUrl = await resolveVerifiedDiscoverIconUrl(entry);
      if (!verifiedIconUrl) return null;
      return {
        ...entry,
        imageUrl: verifiedIconUrl
      };
    })
  );

  const merged = mergedWithIconGate.filter(Boolean);

  const categories = Array.from(new Set(merged.map((entry) => entry.category)));
  const fallbackCategories = categories.length ? categories : DISCOVER_CATEGORIES;
  const sections = Array.from(new Set(merged.map((entry) => sanitizeSection(entry.section, inferSectionFromCategory(entry.category)))));
  const fallbackSections = sections.length ? sections : DISCOVER_SECTIONS;

  return {
    fetchedAt: auto.fetchedAt || nowIso(),
    source: auto.source,
    stale: auto.stale,
    categories: ['all', ...fallbackCategories.filter((entry) => DISCOVER_CATEGORY_SET.has(entry))],
    sections: ['all', ...fallbackSections.filter((entry) => DISCOVER_SECTION_SET.has(entry))],
    items: merged.map((entry) => makePublicItem(entry, normalizedLang))
  };
};
