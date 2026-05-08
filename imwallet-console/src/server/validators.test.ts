import { describe, expect, it } from 'vitest';
import { validateWithdrawalRequest } from './validators';

describe('validateWithdrawalRequest', () => {
  it('returns null for a valid request', () => {
    const result = validateWithdrawalRequest({
      chain: 'ETH',
      asset: 'ETH',
      address: '0x7A6131A4A6Ddb1Ff52C8f2C6fF9a24336aD93cE2',
      amount: 120.5,
      userTier: 'Pro'
    });

    expect(result).toBeNull();
  });

  it('rejects invalid amount', () => {
    const result = validateWithdrawalRequest({
      chain: 'BTC',
      asset: 'BTC',
      address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      amount: 0,
      userTier: 'Basic'
    });

    expect(result).toBe('Invalid amount.');
  });

  it('rejects chain-address mismatch format', () => {
    const result = validateWithdrawalRequest({
      chain: 'TRX',
      asset: 'USDT',
      address: '0x7A6131A4A6Ddb1Ff52C8f2C6fF9a24336aD93cE2',
      amount: 10,
      userTier: 'Basic'
    });

    expect(result).toBe('Address format does not match selected chain.');
  });
});
