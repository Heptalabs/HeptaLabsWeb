import { resolveBackendBaseUrl } from './backendBaseUrl';

export type DiscoverCategoryId = 'featured' | 'dex' | 'lending' | 'yield' | 'solana' | 'market' | 'social' | 'games';
export type DiscoverKind = 'manual' | 'auto';
export type DiscoverSectionId = 'feature' | 'earn' | 'dapps' | 'watchlist' | 'sites' | 'latest';
export type DiscoverActionType = 'external' | 'internal' | 'none';

export type DiscoverFeedItem = {
  id: string;
  kind: DiscoverKind;
  category: DiscoverCategoryId;
  section: DiscoverSectionId;
  pinned: boolean;
  priority: number;
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  imageUrl: string;
  ctaLabel: string;
  ctaUrl: string;
  actionType: DiscoverActionType;
  internalTarget: string;
  tags: string[];
  publishedAt: string;
};

export type DiscoverFeedPayload = {
  fetchedAt: string;
  source: string;
  stale: boolean;
  categories: string[];
  sections: string[];
  items: DiscoverFeedItem[];
};

export type DiscoverClickLogPayload = {
  itemId: string;
  itemTitle: string;
  category: string;
  section: string;
  declaredActionType: DiscoverActionType;
  resolvedActionType: DiscoverActionType;
  internalTarget: string;
  externalUrl: string;
  success: boolean;
  reason: string;
  platform: string;
  lang: 'ko' | 'en' | 'zh';
};

const validCategories = new Set<DiscoverCategoryId>(['featured', 'dex', 'lending', 'yield', 'solana', 'market', 'social', 'games']);
const validSections = new Set<DiscoverSectionId>(['feature', 'earn', 'dapps', 'watchlist', 'sites', 'latest']);
const validActionTypes = new Set<DiscoverActionType>(['external', 'internal', 'none']);

const fallbackSectionByCategory: Record<DiscoverCategoryId, DiscoverSectionId> = {
  featured: 'feature',
  dex: 'dapps',
  lending: 'dapps',
  yield: 'dapps',
  solana: 'dapps',
  market: 'latest',
  social: 'latest',
  games: 'latest'
};

const toSafeText = (value: unknown) => String(value ?? '').trim();
const toSafeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const fetchDiscoverFeed = async (lang: 'ko' | 'en' | 'zh', signal?: AbortSignal): Promise<DiscoverFeedPayload | null> => {
  const endpoint = `${resolveBackendBaseUrl()}/api/v1/content/discover?lang=${lang}&limit=60`;
  const response = await fetch(endpoint, { signal });
  if (!response.ok) {
    throw new Error(`discover api status ${response.status}`);
  }

  const payload = (await response.json()) as Partial<DiscoverFeedPayload>;
  if (!Array.isArray(payload?.items)) return null;

  const items = payload.items
    .map((item): DiscoverFeedItem | null => {
      const category = toSafeText(item?.category).toLowerCase() as DiscoverCategoryId;
      if (!validCategories.has(category)) return null;
      const sectionRaw = toSafeText(item?.section).toLowerCase();
      const section = validSections.has(sectionRaw as DiscoverSectionId)
        ? (sectionRaw as DiscoverSectionId)
        : fallbackSectionByCategory[category];
      const sourceUrl = toSafeText(item?.sourceUrl);
      const ctaUrl = toSafeText(item?.ctaUrl);
      const internalTarget = toSafeText(item?.internalTarget).toLowerCase();
      const actionTypeRaw = toSafeText(item?.actionType).toLowerCase();
      const actionTypeCandidate = validActionTypes.has(actionTypeRaw as DiscoverActionType)
        ? (actionTypeRaw as DiscoverActionType)
        : 'external';
      const hasExternalUrl = Boolean(sourceUrl || ctaUrl);
      const actionType: DiscoverActionType =
        actionTypeCandidate === 'internal'
          ? internalTarget
            ? 'internal'
            : hasExternalUrl
              ? 'external'
              : 'none'
          : actionTypeCandidate === 'external'
            ? hasExternalUrl
              ? 'external'
              : internalTarget
                ? 'internal'
                : 'none'
            : internalTarget
              ? 'internal'
              : hasExternalUrl
                ? 'external'
                : 'none';

      return {
        id: toSafeText(item?.id),
        kind: item?.kind === 'auto' ? 'auto' : 'manual',
        category,
        section,
        pinned: item?.pinned === true,
        priority: toSafeNumber(item?.priority, 0),
        title: toSafeText(item?.title),
        summary: toSafeText(item?.summary),
        sourceName: toSafeText(item?.sourceName),
        sourceUrl,
        imageUrl: toSafeText(item?.imageUrl),
        ctaLabel: toSafeText(item?.ctaLabel),
        ctaUrl,
        actionType,
        internalTarget: actionType === 'internal' ? internalTarget : '',
        tags: Array.isArray(item?.tags) ? item.tags.map((tag) => toSafeText(tag)).filter(Boolean) : [],
        publishedAt: toSafeText(item?.publishedAt)
      };
    })
    .filter((item): item is DiscoverFeedItem => Boolean(item && item.title));

  if (!items.length) return null;

  return {
    fetchedAt: toSafeText(payload?.fetchedAt),
    source: toSafeText(payload?.source),
    stale: payload?.stale === true,
    categories: Array.isArray(payload?.categories) ? payload.categories.map((entry) => toSafeText(entry)).filter(Boolean) : [],
    sections: Array.isArray(payload?.sections) ? payload.sections.map((entry) => toSafeText(entry)).filter(Boolean) : [],
    items
  };
};

export const logDiscoverClick = async (payload: DiscoverClickLogPayload): Promise<void> => {
  const endpoint = `${resolveBackendBaseUrl()}/api/v1/content/discover/click`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`discover click api status ${response.status}`);
  }
};
