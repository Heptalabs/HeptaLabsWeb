import { describe, expect, it } from 'vitest';
import { validateAddressForChain } from './addressEngine';

describe('addressEngine', () => {
  it('accepts valid btc address format', () => {
    const result = validateAddressForChain('BTC', 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh');
    expect(result.ok).toBe(true);
  });

  it('returns invalid format on malformed evm address', () => {
    const result = validateAddressForChain('ETH', '0x1234');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('invalid_format');
    }
  });
});
