import { describe, expect, it } from 'vitest';
import { evaluateWithdrawalRisk } from './riskRules';

describe('evaluateWithdrawalRisk', () => {
  it('flags amount over tier limit', () => {
    const result = evaluateWithdrawalRisk({
      chain: 'ETH',
      asset: 'ETH',
      address: '0x7A6131A4A6Ddb1Ff52C8f2C6fF9a24336aD93cE2',
      amount: 20000,
      userTier: 'Basic'
    });

    expect(result.ok).toBe(false);
    expect(result.requiresManualReview).toBe(true);
    expect(result.reason).toBe('Amount exceeds tier limit.');
  });

  it('passes low-risk sample request', () => {
    const result = evaluateWithdrawalRisk({
      chain: 'BTC',
      asset: 'BTC',
      address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      amount: 1000,
      userTier: 'VIP'
    });

    expect(result.ok).toBe(true);
    expect(result.requiresManualReview).toBe(false);
    expect(result.reason).toBe('Pass');
  });
});
