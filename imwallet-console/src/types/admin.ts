import type { AdminAsset, ChainHealth, QueueItem, UserRow } from '../data/mockAdmin';

export type AdminRole = 'viewer' | 'operator' | 'compliance' | 'admin';

export type AdminSession = {
  token: string;
  userId: string;
  email: string;
  role: AdminRole;
  displayName: string;
  issuedAt: string;
};

export type MfaChallenge = {
  id: string;
  email: string;
  expiresAt: string;
  maskedTo: string;
};

export type PolicySetting = {
  key: string;
  value: string;
  updatedAt: string;
  updatedBy: string;
};

export type AuditLogItem = {
  id: string;
  action: string;
  actor: string;
  scope: string;
  summary: string;
  createdAt: string;
};

export type DashboardPayload = {
  assets: AdminAsset[];
  queue: QueueItem[];
  chainHealth: ChainHealth[];
  users: UserRow[];
  policies: PolicySetting[];
  auditLogs: AuditLogItem[];
};

export type WithdrawalValidationRequest = {
  chain: 'BTC' | 'ETH' | 'XRP' | 'BSC' | 'SOL' | 'TRX' | 'FIL';
  asset: string;
  address: string;
  amount: number;
  userTier: 'Basic' | 'Pro' | 'VIP';
};

export type WithdrawalValidationResult = {
  ok: boolean;
  riskScore: number;
  reason: string;
  requiresManualReview: boolean;
};

export type LocalizedText = {
  ko: string;
  en: string;
  zh: string;
};

export type ContentStatus = 'draft' | 'published';
export type ContentCategory = 'featured' | 'dex' | 'lending' | 'yield' | 'solana' | 'market' | 'social' | 'games';
export type ContentSection = 'feature' | 'earn' | 'dapps' | 'watchlist' | 'sites' | 'latest';
export type ContentActionType = 'external' | 'internal' | 'none';

export type AdminContentItem = {
  id: string;
  kind: 'manual' | 'auto';
  status: ContentStatus;
  category: ContentCategory;
  section: ContentSection;
  pinned: boolean;
  priority: number;
  title: LocalizedText;
  summary: LocalizedText;
  sourceName: string;
  sourceUrl: string;
  imageUrl: string;
  ctaLabel: LocalizedText;
  ctaUrl: string;
  actionType: ContentActionType;
  internalTarget: string;
  tags: string[];
  startsAt: string | null;
  endsAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminContentUpsertInput = {
  status: ContentStatus;
  category: ContentCategory;
  section: ContentSection;
  pinned: boolean;
  priority: number;
  title: LocalizedText;
  summary: LocalizedText;
  sourceName: string;
  sourceUrl: string;
  imageUrl: string;
  ctaLabel: LocalizedText;
  ctaUrl: string;
  actionType: ContentActionType;
  internalTarget: string;
  tags: string[];
  startsAt: string | null;
  endsAt: string | null;
  publishedAt: string | null;
};

export type DiscoverClickLogItem = {
  id: string;
  itemId: string;
  itemTitle: string;
  category: ContentCategory | string;
  section: ContentSection | string;
  declaredActionType: ContentActionType | string;
  resolvedActionType: ContentActionType | string;
  internalTarget: string;
  externalUrl: string;
  success: boolean;
  reason: string;
  platform: string;
  lang: string;
  walletId: string;
  clickedAt: string;
};

export type DiscoverClickSummary = {
  windowDays: number;
  totalClicks: number;
  successClicks: number;
  bySection: Array<{ section: string; count: number }>;
  byAction: Array<{ actionType: string; count: number }>;
  topItems: Array<{ itemId: string; itemTitle: string; count: number }>;
};
