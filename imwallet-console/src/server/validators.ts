import type { WithdrawalValidationRequest } from '../types/admin';

const chainRegexMap: Record<WithdrawalValidationRequest['chain'], RegExp> = {
  BTC: /^(bc1[a-z0-9]{25,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/,
  ETH: /^0x[a-fA-F0-9]{40}$/,
  XRP: /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/,
  BSC: /^0x[a-fA-F0-9]{40}$/,
  SOL: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  TRX: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
  FIL: /^f[1-4][a-z0-9]{20,120}$/
};

export const validateWithdrawalRequest = (request: WithdrawalValidationRequest): string | null => {
  if (!request.address.trim()) return 'Recipient address required.';
  if (!Number.isFinite(request.amount) || request.amount <= 0) return 'Invalid amount.';
  if (!chainRegexMap[request.chain].test(request.address.trim())) return 'Address format does not match selected chain.';

  if ((request.chain === 'ETH' || request.chain === 'BSC') && !request.address.startsWith('0x')) {
    return 'EVM chain address must start with 0x.';
  }

  return null;
};
