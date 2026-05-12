import { resolveBackendBaseUrl } from './backendBaseUrl';
import { withRpcProxyAuthHeaders } from './rpcProxyAuth';

export type TxFeeChainCode = 'BTC' | 'ETH' | 'XRP' | 'BSC' | 'SOL' | 'TRX' | 'FIL';

export type ActualNetworkFeeSnapshot = {
  chain: TxFeeChainCode;
  hash: string;
  feeNative: number;
  source: string;
  confirmedAt: string;
};

const RPC_PROXY_BASE = `${resolveBackendBaseUrl()}/api/v1/rpc`;
const ETH_RPC_URL = `${RPC_PROXY_BASE}/eth`;
const BSC_RPC_URL = `${RPC_PROXY_BASE}/bsc`;
const XRP_RPC_URL = `${RPC_PROXY_BASE}/xrp`;
const SOL_RPC_URL = `${RPC_PROXY_BASE}/sol`;
const TRON_RPC_URL = `${RPC_PROXY_BASE}/trx/wallet/gettransactioninfobyid`;
const BTC_TX_API_URL = `${RPC_PROXY_BASE}/btc/tx/`;
const FIL_RPC_URL = `${RPC_PROXY_BASE}/fil`;
const FIL_ATTO_PER_FIL = 1_000_000_000_000_000_000n;

const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs: number, signal?: AbortSignal) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const abortListener = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    signal.addEventListener('abort', abortListener, { once: true });
  }

  try {
    return await fetch(url, {
      ...init,
      headers: withRpcProxyAuthHeaders(init.headers),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener('abort', abortListener);
  }
};

const requestJsonRpc = async (url: string, method: string, params: unknown[], signal?: AbortSignal) => {
  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: method,
        method,
        params
      })
    },
    7000,
    signal
  );

  if (!response.ok) {
    throw new Error(`json rpc ${method} failed: ${response.status}`);
  }

  const payload = (await response.json()) as { result?: unknown; error?: { message?: string } };
  if (payload?.error) {
    throw new Error(payload.error.message || `${method} rpc error`);
  }
  return payload.result;
};

const parseHexBigInt = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  try {
    if (/^0x[0-9a-f]+$/i.test(raw)) return BigInt(raw);
    if (/^\d+$/.test(raw)) return BigInt(raw);
  } catch {
    return null;
  }
  return null;
};

const parsePositiveNumber = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const toFixedNumber = (value: number, digits: number) => Number(value.toFixed(digits));

const bigintRatioToNumber = (numerator: bigint, denominator: bigint, fractionDigits: number) => {
  if (denominator <= 0n || numerator < 0n) return 0;
  const safeDigits = Math.max(0, Math.min(18, Math.floor(fractionDigits)));
  const whole = numerator / denominator;
  const remainder = numerator % denominator;

  if (safeDigits === 0) {
    const wholeAsNumber = Number(whole.toString());
    return Number.isFinite(wholeAsNumber) ? wholeAsNumber : 0;
  }

  const fractionScale = 10n ** BigInt(safeDigits);
  let fraction = ((remainder * fractionScale) + denominator / 2n) / denominator;
  let normalizedWhole = whole;
  if (fraction >= fractionScale) {
    normalizedWhole += 1n;
    fraction -= fractionScale;
  }

  const fractionText = fraction.toString().padStart(safeDigits, '0').replace(/0+$/, '');
  const decimalText = fractionText ? `${normalizedWhole.toString()}.${fractionText}` : normalizedWhole.toString();
  const parsed = Number(decimalText);
  if (Number.isFinite(parsed)) return parsed;
  const wholeAsNumber = Number(normalizedWhole.toString());
  return Number.isFinite(wholeAsNumber) ? wholeAsNumber : 0;
};

const resolveEthLikeActualFee = async (chain: 'ETH' | 'BSC', hash: string, signal?: AbortSignal) => {
  const rpcUrl = chain === 'ETH' ? ETH_RPC_URL : BSC_RPC_URL;
  const receipt = (await requestJsonRpc(rpcUrl, 'eth_getTransactionReceipt', [hash], signal)) as
    | {
        gasUsed?: unknown;
        effectiveGasPrice?: unknown;
        blockNumber?: unknown;
      }
    | null;
  if (!receipt) return null;

  const gasUsed = parseHexBigInt(receipt.gasUsed);
  let gasPriceWei = parseHexBigInt(receipt.effectiveGasPrice);
  if (!gasUsed || gasUsed <= 0n) return null;

  if (!gasPriceWei || gasPriceWei <= 0n) {
    const tx = (await requestJsonRpc(rpcUrl, 'eth_getTransactionByHash', [hash], signal)) as { gasPrice?: unknown } | null;
    gasPriceWei = parseHexBigInt(tx?.gasPrice);
  }
  if (!gasPriceWei || gasPriceWei <= 0n) return null;

  const feeWei = gasUsed * gasPriceWei;
  return {
    chain,
    hash,
    feeNative: toFixedNumber(bigintRatioToNumber(feeWei, 1_000_000_000_000_000_000n, 12), 12),
    source: `${chain.toLowerCase()}-receipt`,
    confirmedAt: new Date().toISOString()
  } satisfies ActualNetworkFeeSnapshot;
};

const resolveBtcActualFee = async (hash: string, signal?: AbortSignal) => {
  const normalized = hash.replace(/^0x/i, '').trim();
  if (!/^[a-fA-F0-9]{64}$/.test(normalized)) return null;
  const response = await fetchWithTimeout(`${BTC_TX_API_URL}${normalized}`, { method: 'GET' }, 7000, signal);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`btc tx lookup failed: ${response.status}`);

  const payload = (await response.json()) as { fee?: unknown };
  const feeSat = parsePositiveNumber(payload?.fee);
  if (!feeSat) return null;
  return {
    chain: 'BTC',
    hash: normalized,
    feeNative: toFixedNumber(feeSat / 100_000_000, 8),
    source: 'blockstream:tx.fee',
    confirmedAt: new Date().toISOString()
  } satisfies ActualNetworkFeeSnapshot;
};

const resolveXrpActualFee = async (hash: string, signal?: AbortSignal) => {
  const normalized = hash.replace(/^0x/i, '').trim().toUpperCase();
  if (!normalized) return null;
  const tx = (await requestJsonRpc(
    XRP_RPC_URL,
    'tx',
    [
      {
        transaction: normalized,
        binary: false
      }
    ],
    signal
  )) as { Fee?: unknown; fee?: unknown; validated?: boolean };

  if (tx?.validated === false) return null;
  const feeDrops = parsePositiveNumber(tx?.Fee ?? tx?.fee);
  if (!feeDrops) return null;
  return {
    chain: 'XRP',
    hash: normalized,
    feeNative: toFixedNumber(feeDrops / 1_000_000, 8),
    source: 'xrpl:tx.Fee',
    confirmedAt: new Date().toISOString()
  } satisfies ActualNetworkFeeSnapshot;
};

const resolveSolActualFee = async (hash: string, signal?: AbortSignal) => {
  const tx = (await requestJsonRpc(
    SOL_RPC_URL,
    'getTransaction',
    [hash, { encoding: 'json', maxSupportedTransactionVersion: 0 }],
    signal
  )) as { meta?: { fee?: unknown } } | null;
  if (!tx?.meta) return null;

  const lamportsFee = parsePositiveNumber(tx.meta.fee);
  if (!lamportsFee) return null;
  return {
    chain: 'SOL',
    hash,
    feeNative: toFixedNumber(lamportsFee / 1_000_000_000, 9),
    source: 'solana:getTransaction.meta.fee',
    confirmedAt: new Date().toISOString()
  } satisfies ActualNetworkFeeSnapshot;
};

const resolveTrxActualFee = async (hash: string, signal?: AbortSignal) => {
  const normalized = hash.replace(/^0x/i, '').trim();
  if (!normalized) return null;

  const response = await fetchWithTimeout(
    TRON_RPC_URL,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: normalized })
    },
    7000,
    signal
  );
  if (!response.ok) {
    throw new Error(`trx tx lookup failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    fee?: unknown;
    receipt?: { energy_fee?: unknown; net_fee?: unknown };
  };
  const feeSun =
    parsePositiveNumber(payload.fee) ??
    (() => {
      const energy = Number(payload?.receipt?.energy_fee ?? 0);
      const net = Number(payload?.receipt?.net_fee ?? 0);
      const total = energy + net;
      return Number.isFinite(total) && total > 0 ? total : null;
    })();

  if (!feeSun) return null;
  return {
    chain: 'TRX',
    hash,
    feeNative: toFixedNumber(feeSun / 1_000_000, 6),
    source: 'trongrid:gettransactioninfobyid.fee',
    confirmedAt: new Date().toISOString()
  } satisfies ActualNetworkFeeSnapshot;
};

const resolveFilActualFee = async (hash: string, signal?: AbortSignal) => {
  if (!hash || hash.startsWith('0x')) return null;
  const messageCid = { '/': hash };

  const found = (await requestJsonRpc(FIL_RPC_URL, 'Filecoin.StateSearchMsg', [null, messageCid, 2000, false], signal)) as
    | {
        Receipt?: { GasUsed?: unknown };
        TipSet?: unknown[];
      }
    | null;
  if (!found?.Receipt?.GasUsed || !Array.isArray(found.TipSet) || !found.TipSet.length) return null;

  const message = (await requestJsonRpc(FIL_RPC_URL, 'Filecoin.ChainGetMessage', [messageCid], signal)) as {
    GasFeeCap?: unknown;
    GasPremium?: unknown;
  };
  const tipSet = (await requestJsonRpc(FIL_RPC_URL, 'Filecoin.ChainGetTipSet', [found.TipSet], signal)) as {
    Blocks?: Array<{ ParentBaseFee?: unknown }>;
  };

  const gasUsed = parseHexBigInt(found.Receipt.GasUsed);
  const gasFeeCap = parseHexBigInt(message.GasFeeCap) ?? 0n;
  const gasPremium = parseHexBigInt(message.GasPremium) ?? 0n;
  const baseFee = parseHexBigInt(tipSet?.Blocks?.[0]?.ParentBaseFee) ?? 0n;
  if (!gasUsed || gasUsed <= 0n) return null;

  const effective = gasFeeCap > 0n ? (baseFee + gasPremium > gasFeeCap ? gasFeeCap : baseFee + gasPremium) : baseFee + gasPremium;
  if (effective <= 0n) return null;

  const attoFee = gasUsed * effective;
  return {
    chain: 'FIL',
    hash,
    feeNative: toFixedNumber(bigintRatioToNumber(attoFee, FIL_ATTO_PER_FIL, 12), 12),
    source: 'filecoin:StateSearchMsg+ChainGetMessage',
    confirmedAt: new Date().toISOString()
  } satisfies ActualNetworkFeeSnapshot;
};

export const resolveActualNetworkFee = async (
  chain: TxFeeChainCode,
  hash: string,
  signal?: AbortSignal
): Promise<ActualNetworkFeeSnapshot | null> => {
  let normalizedHash = String(hash || '').trim();
  if (!normalizedHash) return null;
  if ((chain === 'ETH' || chain === 'BSC') && !normalizedHash.startsWith('0x')) {
    normalizedHash = `0x${normalizedHash}`;
  }

  if (chain === 'ETH' || chain === 'BSC') return resolveEthLikeActualFee(chain, normalizedHash, signal);
  if (chain === 'BTC') return resolveBtcActualFee(normalizedHash, signal);
  if (chain === 'XRP') return resolveXrpActualFee(normalizedHash, signal);
  if (chain === 'SOL') return resolveSolActualFee(normalizedHash, signal);
  if (chain === 'TRX') return resolveTrxActualFee(normalizedHash, signal);
  if (chain === 'FIL') return resolveFilActualFee(normalizedHash, signal);
  return null;
};
