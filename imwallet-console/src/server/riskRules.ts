import type { WithdrawalValidationRequest, WithdrawalValidationResult } from '../types/admin';

const tierLimit: Record<WithdrawalValidationRequest['userTier'], number> = {
  Basic: 10000,
  Pro: 50000,
  VIP: 250000
};

const chainRiskWeight: Record<WithdrawalValidationRequest['chain'], number> = {
  BTC: 18,
  ETH: 28,
  XRP: 14,
  BSC: 24,
  SOL: 19,
  TRX: 16,
  FIL: 26
};

export const evaluateWithdrawalRisk = (request: WithdrawalValidationRequest): WithdrawalValidationResult => {
  const maxTierLimit = tierLimit[request.userTier];
  const amountRatio = request.amount / Math.max(maxTierLimit, 1);
  const amountWeight = Math.min(45, Math.floor(amountRatio * 60));
  const chainWeight = chainRiskWeight[request.chain];
  const addressLengthWeight = request.address.length < 30 ? 16 : 8;
  const stableAssetWeight = request.asset.toUpperCase().includes('USDT') ? 6 : 12;

  const riskScore = Math.min(99, amountWeight + chainWeight + addressLengthWeight + stableAssetWeight);

  if (request.amount > maxTierLimit) {
    return {
      ok: false,
      riskScore,
      reason: 'Amount exceeds tier limit.',
      requiresManualReview: true
    };
  }

  if (riskScore >= 70) {
    return {
      ok: false,
      riskScore,
      reason: 'High risk score, manual review required.',
      requiresManualReview: true
    };
  }

  return {
    ok: true,
    riskScore,
    reason: 'Pass',
    requiresManualReview: false
  };
};
