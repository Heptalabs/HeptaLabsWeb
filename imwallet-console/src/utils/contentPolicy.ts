import type { AdminRole, AdminContentUpsertInput, ContentActionType, ContentSection } from '../types/admin';

export const sectionActionFallback: Record<ContentSection, ContentActionType> = {
  feature: 'external',
  earn: 'internal',
  dapps: 'external',
  watchlist: 'none',
  sites: 'external',
  latest: 'external'
};

export const sectionActionLocked = new Set<ContentSection>(['feature', 'earn', 'sites']);

export const sectionInternalTargetSuggestion: Record<ContentSection, string> = {
  feature: 'discover',
  earn: 'home',
  dapps: 'discover',
  watchlist: '',
  sites: '',
  latest: 'discover'
};

export const INTERNAL_TARGET_OPTIONS = [
  { value: 'home', label: 'Home' },
  { value: 'discover', label: 'Discover' },
  { value: 'send', label: 'Send' },
  { value: 'receive', label: 'Receive' },
  { value: 'history', label: 'History' },
  { value: 'settings', label: 'Settings' },
  { value: 'manageassets', label: 'Manage Assets' },
  { value: 'support', label: 'Support Chat' },
  { value: 'asset:btc', label: 'Asset: BTC' },
  { value: 'asset:eth', label: 'Asset: ETH' },
  { value: 'asset:xrp', label: 'Asset: XRP' },
  { value: 'asset:bnb', label: 'Asset: BNB' },
  { value: 'asset:sol', label: 'Asset: SOL' },
  { value: 'asset:trx', label: 'Asset: TRX' },
  { value: 'asset:fil', label: 'Asset: FIL' }
] as const;

export const applySectionActionPolicy = (section: ContentSection, draft: AdminContentUpsertInput): AdminContentUpsertInput => {
  if (sectionActionLocked.has(section)) {
    const lockedAction = sectionActionFallback[section];
    return {
      ...draft,
      section,
      actionType: lockedAction,
      internalTarget: lockedAction === 'internal' ? draft.internalTarget || sectionInternalTargetSuggestion[section] : ''
    };
  }

  if (draft.actionType === 'none') {
    return {
      ...draft,
      section,
      actionType: sectionActionFallback[section],
      internalTarget:
        sectionActionFallback[section] === 'internal'
          ? draft.internalTarget || sectionInternalTargetSuggestion[section]
          : draft.internalTarget
    };
  }

  if (draft.actionType === 'internal' && !draft.internalTarget.trim()) {
    return {
      ...draft,
      section,
      internalTarget: sectionInternalTargetSuggestion[section]
    };
  }

  return {
    ...draft,
    section
  };
};

export type ContentRolePermissions = {
  canRead: boolean;
  canWrite: boolean;
  canPublish: boolean;
  canDelete: boolean;
  canRefresh: boolean;
  canUpload: boolean;
};

export const contentRolePermissions: Record<AdminRole, ContentRolePermissions> = {
  viewer: {
    canRead: true,
    canWrite: false,
    canPublish: false,
    canDelete: false,
    canRefresh: false,
    canUpload: false
  },
  operator: {
    canRead: true,
    canWrite: true,
    canPublish: false,
    canDelete: false,
    canRefresh: true,
    canUpload: true
  },
  compliance: {
    canRead: true,
    canWrite: true,
    canPublish: true,
    canDelete: false,
    canRefresh: true,
    canUpload: true
  },
  admin: {
    canRead: true,
    canWrite: true,
    canPublish: true,
    canDelete: true,
    canRefresh: true,
    canUpload: true
  }
};
