import { ChainCode } from '../domain/wallet-domain';

export type AmountValidationCode = 'invalid_amount' | 'insufficient_balance';

export const parseAmountInput = (raw: string) => Number(raw.replace(/,/g, '.'));

export const validateSendAmount = (rawAmount: string, balance: number): AmountValidationCode | null => {
  if (!rawAmount.trim()) return 'invalid_amount';
  const amount = parseAmountInput(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) return 'invalid_amount';
  if (amount > balance) return 'insufficient_balance';
  return null;
};

export type SendDraftInput = {
  tokenId: string;
  tokenSymbol: string;
  chainCode: ChainCode;
  network: string;
  recipient: string;
  recipientLabel?: string;
  amount: number;
  memo?: string;
  priceUsd: number;
  feeUsd: number;
  feeNative: number;
  gas: {
    gasPrice: string;
    gasLimit: string;
    txData: string;
    nonce: string;
  };
};

export const buildSendDraftFromInput = (input: SendDraftInput) => ({
  tokenId: input.tokenId,
  tokenSymbol: input.tokenSymbol,
  chainCode: input.chainCode,
  network: input.network,
  recipient: input.recipient.trim(),
  recipientLabel: input.recipientLabel?.trim() || undefined,
  amount: input.amount,
  memo: input.memo?.trim() || undefined,
  usdValue: input.amount * input.priceUsd,
  feeUsd: input.feeUsd,
  feeNative: input.feeNative,
  gas: input.gas
});
