import { describe, expect, it } from 'vitest';
import { buildSendDraftFromInput, validateSendAmount } from './sendFlowEngine';

describe('sendFlowEngine', () => {
  it('validates amount range', () => {
    expect(validateSendAmount('', 10)).toBe('invalid_amount');
    expect(validateSendAmount('11', 10)).toBe('insufficient_balance');
    expect(validateSendAmount('1.25', 10)).toBeNull();
  });

  it('builds draft with usd value', () => {
    const draft = buildSendDraftFromInput({
      tokenId: 'eth',
      tokenSymbol: 'ETH',
      chainCode: 'ETH',
      network: 'Ethereum',
      recipient: '0x7A6131A4A6Ddb1Ff52C8f2C6fF9a24336aD93cE2',
      amount: 2,
      memo: 'test',
      priceUsd: 3500,
      feeUsd: 5,
      feeNative: 0.001,
      gas: { gasPrice: '1', gasLimit: '21000', txData: '', nonce: '2' }
    });

    expect(draft.usdValue).toBe(7000);
    expect(draft.recipient.startsWith('0x')).toBe(true);
  });
});
