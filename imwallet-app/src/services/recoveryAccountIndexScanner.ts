import {
  deriveTrustCompatibleChainAddresses,
  type CompatChainCode
} from './walletRecoveryCompat';

type ScanCandidate = {
  index: number;
  address: string;
  activity: number;
};

export type RecoveryAccountIndexScanResult = {
  bestIndex: number;
  bestActivity: number;
  candidates: ScanCandidate[];
};

const buildLocalFallback = (words: string[], passphrase: string | undefined, chain: CompatChainCode): RecoveryAccountIndexScanResult => {
  const derived = deriveTrustCompatibleChainAddresses(words, 0, passphrase ?? '');
  return {
    bestIndex: 0,
    bestActivity: 0,
    candidates: [
      {
        index: 0,
        address: derived[chain],
        activity: 0
      }
    ]
  };
};

export const scanRecoveryAccountIndex = async (params: {
  words: string[];
  passphrase?: string;
  chain: CompatChainCode;
  maxIndex?: number;
}): Promise<RecoveryAccountIndexScanResult> => {
  void params.maxIndex;
  return buildLocalFallback(params.words, params.passphrase, params.chain);
};
