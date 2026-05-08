import { describe, expect, it } from 'vitest';
import { validateTopLabelConstraints } from './layoutConstraints';

describe('layoutConstraints', () => {
  it('passes with compact labels', () => {
    const ok = validateTopLabelConstraints({
      language: 'ko',
      walletTabLabel: '지갑',
      discoverTabLabel: '디스커버',
      settingsLabel: '설정'
    });

    expect(ok).toBe(true);
  });

  it('fails with too long labels', () => {
    const ok = validateTopLabelConstraints({
      language: 'zh',
      walletTabLabel: '钱包钱包钱包钱包钱包',
      discoverTabLabel: '发现',
      settingsLabel: '设置'
    });

    expect(ok).toBe(false);
  });
});
