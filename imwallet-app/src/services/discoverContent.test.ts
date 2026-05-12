import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));
import { fetchDiscoverFeed, logDiscoverClick } from './discoverContent';

describe('discoverContent service', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: any;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('normalizes invalid internal action to external when URL exists', async () => {
    const mockedPayload = {
      fetchedAt: '2026-04-18T00:00:00.000Z',
      source: 'test',
      stale: false,
      categories: ['all', 'featured'],
      sections: ['all', 'feature'],
      items: [
        {
          id: 'item-1',
          kind: 'manual',
          category: 'featured',
          section: 'feature',
          pinned: true,
          priority: 10,
          title: 'headline',
          summary: 'summary',
          sourceName: 'source',
          sourceUrl: '',
          imageUrl: '',
          ctaLabel: 'open',
          ctaUrl: 'https://www.coingecko.com',
          actionType: 'internal',
          internalTarget: '',
          tags: [],
          publishedAt: '2026-04-18T00:00:00.000Z'
        }
      ]
    };

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => mockedPayload
    });

    const result = await fetchDiscoverFeed('ko');
    expect(result).not.toBeNull();
    expect(result?.items[0]?.actionType).toBe('external');
  });

  it('posts discover click log to backend', async () => {
    fetchMock.mockResolvedValue({ ok: true });

    await logDiscoverClick({
      itemId: 'item-1',
      itemTitle: 'item',
      category: 'featured',
      section: 'feature',
      declaredActionType: 'external',
      resolvedActionType: 'external',
      internalTarget: '',
      externalUrl: 'https://www.coingecko.com',
      success: true,
      reason: 'external_opened',
      platform: 'web',
      lang: 'ko'
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/content/discover/click');
    expect(init?.method).toBe('POST');
  });
});
