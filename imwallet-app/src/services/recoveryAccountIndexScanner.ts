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

const requestWithTimeout = async (url: string, init?: RequestInit, timeoutMs = 2600) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const requestJsonRpc = async (url: string, method: string, params: unknown[]) => {
  const response = await requestWithTimeout(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: method,
        method,
        params
      })
    },
    3000
  );
  if (!response.ok) return null;
  return (await response.json()) as { result?: unknown; error?: unknown };
};

const parseHexInteger = (value: unknown) => {
  const raw = String(value ?? '');
  if (!raw) return 0;
  if (/^0x/i.test(raw)) {
    const parsed = parseInt(raw, 16);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const probeBtcAddress = async (address: string) => {
  try {
    const response = await requestWithTimeout(`https://blockstream.info/api/address/${encodeURIComponent(address)}`);
    if (!response.ok) return 0;
    const payload = (await response.json()) as {
      chain_stats?: { tx_count?: number };
      mempool_stats?: { tx_count?: number };
    };
    const chainCount = Number(payload?.chain_stats?.tx_count ?? 0);
    const mempoolCount = Number(payload?.mempool_stats?.tx_count ?? 0);
    return Math.max(0, chainCount) + Math.max(0, mempoolCount);
  } catch {
    return 0;
  }
};

const probeEthLikeAddress = async (rpcUrl: string, address: string) => {
  try {
    const payload = await requestJsonRpc(rpcUrl, 'eth_getTransactionCount', [address, 'latest']);
    if (!payload || payload.error) return 0;
    return parseHexInteger(payload.result);
  } catch {
    return 0;
  }
};

const probeXrpAddress = async (address: string) => {
  try {
    const payload = await requestJsonRpc('https://s1.ripple.com:51234/', 'account_info', [
      {
        account: address,
        ledger_index: 'validated',
        strict: true
      }
    ]);
    if (!payload || payload.error || !payload.result) return 0;
    return 1;
  } catch {
    return 0;
  }
};

const probeSolAddress = async (address: string) => {
  try {
    const payload = await requestJsonRpc('https://api.mainnet-beta.solana.com', 'getSignaturesForAddress', [
      address,
      { limit: 1 }
    ]);
    if (!payload || payload.error) return 0;
    const list = Array.isArray(payload.result) ? payload.result : [];
    return list.length ? 1 : 0;
  } catch {
    return 0;
  }
};

const probeTrxAddress = async (address: string) => {
  try {
    const response = await requestWithTimeout(`https://api.trongrid.io/v1/accounts/${encodeURIComponent(address)}`, undefined, 3000);
    if (!response.ok) return 0;
    const payload = (await response.json()) as { data?: Array<{ create_time?: number; balance?: number }> };
    const row = Array.isArray(payload.data) ? payload.data[0] : undefined;
    if (!row) return 0;
    if (Number(row.create_time ?? 0) > 0) return 1;
    if (Number(row.balance ?? 0) > 0) return 1;
    return 0;
  } catch {
    return 0;
  }
};

const probeFilAddress = async (address: string) => {
  try {
    const payload = await requestJsonRpc('https://api.node.glif.io/rpc/v1', 'Filecoin.StateGetActor', [address, []]);
    if (!payload || payload.error || !payload.result) return 0;
    return 1;
  } catch {
    return 0;
  }
};

const probeAddressActivity = async (chain: CompatChainCode, address: string) => {
  if (chain === 'BTC') return probeBtcAddress(address);
  if (chain === 'ETH') return probeEthLikeAddress('https://cloudflare-eth.com', address);
  if (chain === 'BSC') return probeEthLikeAddress('https://bsc-dataseed.binance.org', address);
  if (chain === 'XRP') return probeXrpAddress(address);
  if (chain === 'SOL') return probeSolAddress(address);
  if (chain === 'TRX') return probeTrxAddress(address);
  if (chain === 'FIL') return probeFilAddress(address);
  return 0;
};

export const scanRecoveryAccountIndex = async (params: {
  words: string[];
  passphrase?: string;
  chain: CompatChainCode;
  maxIndex?: number;
}): Promise<RecoveryAccountIndexScanResult> => {
  const upper = Math.max(0, Math.min(40, Math.floor(params.maxIndex ?? 20)));
  const candidates: ScanCandidate[] = [];

  for (let start = 0; start <= upper; start += 5) {
    const batchIndices = Array.from({ length: Math.min(5, upper - start + 1) }, (_, offset) => start + offset);
    const batchResults = await Promise.all(
      batchIndices.map(async (index) => {
        const derived = deriveTrustCompatibleChainAddresses(params.words, index, params.passphrase ?? '');
        const address = derived[params.chain];
        const activity = await probeAddressActivity(params.chain, address);
        return { index, address, activity };
      })
    );
    candidates.push(...batchResults);
  }

  let bestIndex = 0;
  let bestActivity = -1;
  candidates.forEach((candidate) => {
    if (candidate.activity > bestActivity) {
      bestActivity = candidate.activity;
      bestIndex = candidate.index;
      return;
    }
    if (candidate.activity === bestActivity && candidate.index < bestIndex) {
      bestIndex = candidate.index;
    }
  });

  return {
    bestIndex: Math.max(0, bestIndex),
    bestActivity: Math.max(0, bestActivity),
    candidates
  };
};

