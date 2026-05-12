import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { discoverUploadsDirPath } from './discover-content.js';

const serviceDir = path.dirname(fileURLToPath(import.meta.url));
const ICON_CACHE_MANIFEST_PATH = path.resolve(serviceDir, '..', 'data', 'discover-icon-cache.manifest.json');
const ICON_CACHE_ROOT_RELATIVE = 'icons-cache';
const ICON_CACHE_DIR = path.join(discoverUploadsDirPath, ICON_CACHE_ROOT_RELATIVE);
const ICON_FETCH_TIMEOUT_MS = 5000;
const ICON_FETCH_MAX_BYTES = 2 * 1024 * 1024;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SECTION_KEYS = ['tokens', 'dapps', 'sites'];
const SYNC_CONCURRENCY = 8;

const CONTENT_TYPE_EXTENSION_MAP = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'image/ico': 'ico'
};

const defaultManifest = () => ({
  version: 1,
  updatedAt: new Date(0).toISOString(),
  sections: {
    tokens: {},
    dapps: {},
    sites: {}
  }
});

const trim = (value, limit = 0) => {
  const text = String(value ?? '').trim();
  return limit > 0 ? text.slice(0, limit) : text;
};

const nowIso = () => new Date().toISOString();
const isHttpUrl = (value) => /^https?:\/\//i.test(trim(value));
const LOCAL_MANIFEST_SOURCE_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

const normalizeUrl = (value) => {
  const text = trim(value, 1200);
  if (!isHttpUrl(text)) return '';
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
    return parsed.toString();
  } catch {
    return '';
  }
};

const normalizeHostFromUrl = (value) => {
  const text = normalizeUrl(value);
  if (!text) return '';
  try {
    return trim(new URL(text).hostname.toLowerCase());
  } catch {
    return '';
  }
};

const normalizeManifestSourceUrl = (value) => {
  const text = trim(value, 1200);
  if (!text) return '';
  if (!isHttpUrl(text)) return text;
  try {
    const parsed = new URL(text);
    const compactPath = `${parsed.pathname}${parsed.search || ''}`;
    if (parsed.pathname.startsWith('/api/v1/market/token-icon/')) {
      return compactPath;
    }
    if (LOCAL_MANIFEST_SOURCE_HOSTS.has(parsed.hostname.toLowerCase())) {
      return compactPath;
    }
    return parsed.toString();
  } catch {
    return text;
  }
};

const safeKey = (value) =>
  trim(value, 200)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

const safeRelativeToAbsolute = (relativePath) => path.join(discoverUploadsDirPath, relativePath);

const fileExists = async (targetPath) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const loadManifest = async () => {
  try {
    const raw = await fs.readFile(ICON_CACHE_MANIFEST_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaultManifest();
    const next = defaultManifest();
    SECTION_KEYS.forEach((sectionKey) => {
      const sectionRaw = parsed?.sections?.[sectionKey];
      if (!sectionRaw || typeof sectionRaw !== 'object') return;
      Object.entries(sectionRaw).forEach(([key, entry]) => {
        if (!entry || typeof entry !== 'object') return;
        const rel = trim(entry.relativePath, 500);
        if (!rel) return;
        next.sections[sectionKey][safeKey(key)] = {
          relativePath: rel,
          updatedAt: trim(entry.updatedAt, 64) || new Date(0).toISOString(),
          sourceUrl: normalizeManifestSourceUrl(entry.sourceUrl)
        };
      });
    });
    next.updatedAt = trim(parsed.updatedAt, 64) || new Date(0).toISOString();
    return next;
  } catch {
    return defaultManifest();
  }
};

const saveManifest = async (manifest) => {
  SECTION_KEYS.forEach((sectionKey) => {
    const section = manifest?.sections?.[sectionKey];
    if (!section || typeof section !== 'object') return;
    Object.entries(section).forEach(([key, entry]) => {
      if (!entry || typeof entry !== 'object') return;
      section[key] = {
        ...entry,
        sourceUrl: normalizeManifestSourceUrl(entry.sourceUrl)
      };
    });
  });

  const dir = path.dirname(ICON_CACHE_MANIFEST_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(ICON_CACHE_MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
};

const getExtensionFromUrl = (value) => {
  try {
    const pathname = new URL(value).pathname.toLowerCase();
    if (pathname.endsWith('.png')) return 'png';
    if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'jpg';
    if (pathname.endsWith('.webp')) return 'webp';
    if (pathname.endsWith('.ico')) return 'ico';
    return '';
  } catch {
    return '';
  }
};

const fetchIconBinary = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ICON_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { accept: 'image/*' }
    });
    if (!response.ok) return null;
    const contentTypeRaw = trim(response.headers.get('content-type')).split(';')[0].toLowerCase();
    if (contentTypeRaw.includes('svg')) return null;
    const extension = CONTENT_TYPE_EXTENSION_MAP[contentTypeRaw] || getExtensionFromUrl(url);
    if (!extension) return null;
    const arrayBuffer = await response.arrayBuffer();
    const bytes = Buffer.from(arrayBuffer);
    if (!bytes.length || bytes.length > ICON_FETCH_MAX_BYTES) return null;
    return { bytes, extension };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

const buildSiteCandidates = (domainOrUrl) => {
  const host = normalizeHostFromUrl(domainOrUrl) || trim(domainOrUrl).toLowerCase();
  if (!host) return [];
  return [
    `https://icons.duckduckgo.com/ip3/${host}.ico`,
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=256`,
    `https://${host}/favicon.ico`
  ];
};

const buildDappCandidates = (entry) => {
  const candidates = [];
  const imageUrl = normalizeUrl(entry?.imageUrl);
  if (imageUrl) candidates.push(imageUrl);
  const sourceUrl = normalizeUrl(entry?.url || entry?.sourceUrl);
  if (sourceUrl) {
    candidates.push(...buildSiteCandidates(sourceUrl));
  }
  if (Array.isArray(entry?.candidates)) {
    entry.candidates.forEach((item) => {
      const normalized = normalizeUrl(item);
      if (normalized) candidates.push(normalized);
    });
  }
  return Array.from(new Set(candidates));
};

const buildTokenCandidates = (entry) => {
  const candidates = [];
  const iconProxyUrl = normalizeUrl(entry?.iconProxyUrl);
  const iconUrl = normalizeUrl(entry?.iconUrl);
  if (iconProxyUrl) candidates.push(iconProxyUrl);
  if (iconUrl) candidates.push(iconUrl);
  const iconId = Number(entry?.iconId);
  if (Number.isFinite(iconId) && iconId > 0) {
    const safeId = Math.floor(iconId);
    candidates.push(`https://s2.coinmarketcap.com/static/img/coins/64x64/${safeId}.png`);
    candidates.push(`https://s2.coinmarketcap.com/static/img/coins/128x128/${safeId}.png`);
  }
  if (Array.isArray(entry?.candidates)) {
    entry.candidates.forEach((item) => {
      const normalized = normalizeUrl(item);
      if (normalized) candidates.push(normalized);
    });
  }
  return Array.from(new Set(candidates));
};

const makePublicUrl = (origin, relativePath) => `${String(origin || '').replace(/\/+$/, '')}/api/v1/content/uploads/${relativePath}`;

const resolveCachedEntry = async ({ section, key, manifest, origin, force }) => {
  const safeSection = SECTION_KEYS.includes(section) ? section : null;
  if (!safeSection) return '';
  const safeItemKey = safeKey(key);
  if (!safeItemKey) return '';
  const record = manifest.sections[safeSection][safeItemKey];
  if (!record) return '';
  if (force) return '';
  const isFresh = Date.now() - Date.parse(record.updatedAt || 0) < CACHE_TTL_MS;
  if (!isFresh) return '';
  const absolute = safeRelativeToAbsolute(record.relativePath);
  const exists = await fileExists(absolute);
  if (!exists) return '';
  return makePublicUrl(origin, record.relativePath);
};

const storeIcon = async ({ section, key, sourceUrl, binary, manifest, origin }) => {
  const safeSection = SECTION_KEYS.includes(section) ? section : null;
  if (!safeSection) return '';
  const safeItemKey = safeKey(key);
  if (!safeItemKey) return '';
  const extension = binary.extension || 'png';
  const fileName = `${safeItemKey}.${extension}`;
  const relativePath = path.posix.join(ICON_CACHE_ROOT_RELATIVE, safeSection, fileName);
  const absolutePath = safeRelativeToAbsolute(relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, binary.bytes);
  manifest.sections[safeSection][safeItemKey] = {
    relativePath,
    updatedAt: nowIso(),
    sourceUrl: normalizeManifestSourceUrl(sourceUrl)
  };
  manifest.updatedAt = nowIso();
  return makePublicUrl(origin, relativePath);
};

const ensureIcon = async ({ section, key, candidates, manifest, origin, force }) => {
  const cached = await resolveCachedEntry({ section, key, manifest, origin, force });
  if (cached) return cached;
  for (const candidate of candidates) {
    // eslint-disable-next-line no-await-in-loop
    const binary = await fetchIconBinary(candidate);
    if (!binary) continue;
    // eslint-disable-next-line no-await-in-loop
    const stored = await storeIcon({
      section,
      key,
      sourceUrl: candidate,
      binary,
      manifest,
      origin
    });
    if (stored) return stored;
  }
  return '';
};

const toTokenRequestRows = (payload, limit) => {
  const rows = Array.isArray(payload?.tokens) ? payload.tokens : [];
  return rows
    .map((row) => ({
      symbol: trim(row?.symbol, 32).toUpperCase(),
      iconId: Number(row?.iconId),
      iconUrl: trim(row?.iconUrl, 1200),
      iconProxyUrl: trim(row?.iconProxyUrl, 1200),
      candidates: Array.isArray(row?.candidates) ? row.candidates : []
    }))
    .filter((row) => row.symbol)
    .slice(0, limit);
};

const toDappRequestRows = (payload, limit) => {
  const rows = Array.isArray(payload?.dapps) ? payload.dapps : [];
  return rows
    .map((row) => ({
      key: trim(row?.key, 120) || trim(row?.title, 120),
      title: trim(row?.title, 160),
      url: trim(row?.url || row?.sourceUrl, 1200),
      imageUrl: trim(row?.imageUrl, 1200),
      candidates: Array.isArray(row?.candidates) ? row.candidates : []
    }))
    .filter((row) => row.key)
    .slice(0, limit);
};

const toSiteRequestRows = (payload, limit) => {
  const rows = Array.isArray(payload?.sites) ? payload.sites : [];
  return rows
    .map((row) => ({
      key: trim(row?.key, 120) || trim(row?.domain, 240),
      domain: trim(row?.domain, 240),
      url: trim(row?.url, 1200),
      candidates: Array.isArray(row?.candidates) ? row.candidates : []
    }))
    .filter((row) => row.key)
    .slice(0, limit);
};

export const syncDiscoverIconCache = async ({ payload = {}, origin, limit = 50, force = false } = {}) => {
  const safeLimit = Math.max(1, Math.min(50, Math.floor(Number(limit) || 50)));
  const manifest = await loadManifest();
  const tokens = toTokenRequestRows(payload, safeLimit);
  const dapps = toDappRequestRows(payload, safeLimit);
  const sites = toSiteRequestRows(payload, safeLimit);

  const result = {
    updatedAt: manifest.updatedAt,
    tokens: {},
    dapps: {},
    sites: {},
    stats: {
      requested: { tokens: tokens.length, dapps: dapps.length, sites: sites.length },
      cached: { tokens: 0, dapps: 0, sites: 0 }
    }
  };

  const runWithConcurrency = async (rows, worker) => {
    if (!Array.isArray(rows) || rows.length === 0) return;
    const workerCount = Math.max(1, Math.min(SYNC_CONCURRENCY, rows.length));
    let cursor = 0;

    const runner = async () => {
      while (true) {
        const index = cursor;
        cursor += 1;
        if (index >= rows.length) return;
        // eslint-disable-next-line no-await-in-loop
        await worker(rows[index], index);
      }
    };

    await Promise.all(Array.from({ length: workerCount }, () => runner()));
  };

  await runWithConcurrency(tokens, async (row) => {
    const iconUrl = await ensureIcon({
      section: 'tokens',
      key: row.symbol,
      candidates: buildTokenCandidates(row),
      manifest,
      origin,
      force
    });
    if (!iconUrl) return;
    result.tokens[row.symbol] = iconUrl;
    result.stats.cached.tokens += 1;
  });

  await runWithConcurrency(dapps, async (row) => {
    const iconUrl = await ensureIcon({
      section: 'dapps',
      key: row.key,
      candidates: buildDappCandidates(row),
      manifest,
      origin,
      force
    });
    if (!iconUrl) return;
    result.dapps[safeKey(row.key)] = iconUrl;
    result.stats.cached.dapps += 1;
  });

  await runWithConcurrency(sites, async (row) => {
    const candidates = Array.from(
      new Set([
        ...buildSiteCandidates(row.url || row.domain),
        ...(Array.isArray(row.candidates) ? row.candidates.map((item) => normalizeUrl(item)).filter(Boolean) : [])
      ])
    );
    const iconUrl = await ensureIcon({
      section: 'sites',
      key: row.key,
      candidates,
      manifest,
      origin,
      force
    });
    if (!iconUrl) return;
    result.sites[safeKey(row.key)] = iconUrl;
    result.stats.cached.sites += 1;
  });

  await saveManifest(manifest);
  result.updatedAt = manifest.updatedAt;
  return result;
};
