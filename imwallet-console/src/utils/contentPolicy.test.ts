import { describe, expect, it } from 'vitest';
import { applySectionActionPolicy, contentRolePermissions, sectionActionFallback } from './contentPolicy';
import type { AdminContentUpsertInput } from '../types/admin';

const makeDraft = (): AdminContentUpsertInput => ({
  status: 'draft',
  category: 'featured',
  section: 'feature',
  pinned: false,
  priority: 10,
  title: { ko: 't', en: 't', zh: 't' },
  summary: { ko: '', en: '', zh: '' },
  sourceName: '',
  sourceUrl: '',
  imageUrl: '',
  ctaLabel: { ko: '', en: '', zh: '' },
  ctaUrl: '',
  actionType: 'none',
  internalTarget: '',
  tags: [],
  startsAt: null,
  endsAt: null,
  publishedAt: null
});

describe('contentPolicy', () => {
  it('locks feature section to external action', () => {
    const next = applySectionActionPolicy('feature', {
      ...makeDraft(),
      actionType: 'internal',
      internalTarget: 'home'
    });

    expect(next.actionType).toBe(sectionActionFallback.feature);
    expect(next.internalTarget).toBe('');
  });

  it('keeps earn section as internal and applies fallback target', () => {
    const next = applySectionActionPolicy('earn', {
      ...makeDraft(),
      section: 'dapps',
      actionType: 'internal',
      internalTarget: ''
    });

    expect(next.section).toBe('earn');
    expect(next.actionType).toBe('internal');
    expect(next.internalTarget).toBe('home');
  });

  it('grants expected role permissions', () => {
    expect(contentRolePermissions.viewer.canRead).toBe(true);
    expect(contentRolePermissions.viewer.canWrite).toBe(false);
    expect(contentRolePermissions.operator.canUpload).toBe(true);
    expect(contentRolePermissions.compliance.canPublish).toBe(true);
    expect(contentRolePermissions.admin.canDelete).toBe(true);
  });
});
