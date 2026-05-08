import { ChainCode, chainRegexMap } from '../domain/wallet-domain';

type EthLikeChain = 'ETH' | 'BSC';
type UsdtBalanceMap = Partial<Record<EthLikeChain | 'TRX', number>>;

export type OnchainBalanceSnapshot = {
  nativeByChain: Partial<Record<ChainCode, number>>;
  usdtByChain: UsdtBalanceMap;
  fetchedAt: string;
};

const ETH_RPC_URL = 'https://ethereum-rpc.publicnode.com';
const BSC_RPC_URL = 'https://bsc-dataseed.binance.org';
const SOL_RPC_URL = 'https://api.mainnet-beta.solana.com';
const XRP_RPC_URL = 'https://xrplcluster.com';
const FIL_RPC_URL = 'https://api.node.glif.io/rpc/v1';
const TRX_ACCOUNT_URL = 'https://api.trongrid.io/v1/accounts';
const BTC_ADDRESS_URL = 'https://blockstream.info/api/address';
const USDT_ERC20_CONTRACT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const USDT_BEP20_CONTRACT = '0x55d398326f99059fF775485246999027B3197955';
const USDT_TRC20_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const FIL_ATTO_PER_FIL = 1_000_000_000_000_000_000n;

const createAbortableSignal = (signal?: AbortSignal, timeoutMs = 8000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const abortListener = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    signal.addEventListener('abort', abortListener, { once: true });
  }
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener('abort', abortListener);
    }
  };
};

const fetchJson = async <T>(url: string, init: RequestInit = {}, signal?: AbortSignal): Promise<T> => {
  const guard = createAbortableSignal(signal);
  try {
    const response = await fetch(url, { ...init, signal: guard.signal });
    if (!response.ok) throw new Error(`request failed: ${response.status}`);
    return (await response.json()) as T;
  } finally {
    guard.cleanup();
  }
};

const postJsonRpc = async <T>(url: string, method: string, params: unknown[], signal?: AbortSignal): Promise<T> => {
  return fetchJson<T>(
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
    signal
  );
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

const parseNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const bigintToDecimal = (value: bigint, scale: bigint, digits: number) => {
  if (value <= 0n || scale <= 0n) return 0;
  const safeDigits = Math.max(0, Math.min(18, Math.floor(digits)));
  const whole = value / scale;
  const remainder = value % scale;
  if (safeDigits === 0) return Number(whole.toString());
  const fractionScale = 10n ** BigInt(safeDigits);
  let fraction = ((remainder * fractionScale) + scale / 2n) / scale;
  let normalizedWhole = whole;
  if (fraction >= fractionScale) {
    normalizedWhole += 1n;
    fraction -= fractionScale;
  }
  const fractionText = fraction.toString().padStart(safeDigits, '0').replace(/0+$/, '');
  const merged = fractionText ? `${normalizedWhole.toString()}.${fractionText}` : normalizedWhole.toString();
  const parsed = Number(merged);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toErc20BalanceCallData = (address: string) => {
  const normalized = address.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) return null;
  const raw = normalized.slice(2);
  return `0x70a08231${raw.padStart(64, '0')}`;
};

const fetchEthLikeNativeBalance = async (chain: EthLikeChain, address: string, signal?: AbortSignal) => {
  if (!chainRegexMap[chain].test(address.trim())) return 0;
  const rpcUrl = chain === 'ETH' ? ETH_RPC_URL : BSC_RPC_URL;
  const payload = (await postJsonRpc<{ result?: unknown }>(rpcUrl, 'eth_getBalance', [address, 'latest'], signal)) ?? {};
  const value = parseHexBigInt(payload.result);
  if (!value || value < 0n) return 0;
  return bigintToDecimal(value, 1_000_000_000_000_000_000n, 12);
};

const fetchEthLikeUsdtBalance = async (chain: EthLikeChain, address: string, signal?: AbortSignal) => {
  const callData = toErc20BalanceCallData(address);
  if (!callData) return 0;
  const rpcUrl = chain === 'ETH' ? ETH_RPC_URL : BSC_RPC_URL;
  const contract = chain === 'ETH' ? USDT_ERC20_CONTRACT : USDT_BEP20_CONTRACT;
  const payload =
    (await postJsonRpc<{ result?: unknown }>(
      rpcUrl,
      'eth_call',
      [
        {
          to: contract,
          data: callData
        },
        'latest'
      ],
      signal
    )) ?? {};
  const value = parseHexBigInt(payload.result);
  if (!value || value < 0n) return 0;
  return bigintToDecimal(value, 1_000_000n, 6);
};

const fetchBtcBalance = async (address: string, signal?: AbortSignal) => {
  if (!chainRegexMap.BTC.test(address.trim())) return 0;
  const payload = await fetchJson<{
    chain_stats?: { funded_txo_sum?: number; spent_txo_sum?: number };
    mempool_stats?: { funded_txo_sum?: number; spent_txo_sum?: number };
  }>(`${BTC_ADDRESS_URL}/${encodeURIComponent(address)}`, { method: 'GET' }, signal);

  const funded = parseNumber(payload.chain_stats?.funded_txo_sum) + parseNumber(payload.mempool_stats?.funded_txo_sum);
  const spent = parseNumber(payload.chain_stats?.spent_txo_sum) + parseNumber(payload.mempool_stats?.spent_txo_sum);
  const sats = Math.max(0, funded - spent);
  return Number((sats / 100_000_000).toFixed(8));
};

const fetchXrpBalance = async (address: string, signal?: AbortSignal) => {
  if (!chainRegexMap.XRP.test(address.trim())) return 0;
  const payload =
    (await postJsonRpc<{ result?: { account_data?: { Balance?: string | number }; error?: string } }>(
      XRP_RPC_URL,
      'account_info',
      [{ account: address, ledger_index: 'validated' }],
      signal
    )) ?? {};
  const error = String(payload.result?.error ?? '');
  if (error === 'actNotFound') return 0;
  const drops = parseNumber(payload.result?.account_data?.Balance);
  if (!Number.isFinite(drops) || drops <= 0) return 0;
  return Number((drops / 1_000_000).toFixed(6));
};

const fetchSolBalance = async (address: string, signal?: AbortSignal) => {
  if (!chainRegexMap.SOL.test(address.trim())) return 0;
  const payload =
    (await postJsonRpc<{ result?: { value?: number } }>(SOL_RPC_URL, 'getBalance', [address], signal)) ?? {};
  const lamports = parseNumber(payload.result?.value);
  if (!Number.isFinite(lamports) || lamports <= 0) return 0;
  return Number((lamports / 1_000_000_000).toFixed(9));
};

const fetchTrxBalances = async (address: string, signal?: AbortSignal): Promise<{ native: number; usdt: number }> => {
  if (!chainRegexMap.TRX.test(address.trim())) return { native: 0, usdt: 0 };
  const endpoint = `${TRX_ACCOUNT_URL}/${encodeURIComponent(address)}?only_confirmed=true`;
  const payload = await fetchJson<{
    data?: Array<{
      balance?: number;
      trc20?: Array<Record<string, string | number>>;
    }>;
  }>(endpoint, { method: 'GET' }, signal);

  const row = payload.data?.[0];
  const nativeSun = parseNumber(row?.balance);
  const trc20Rows = Array.isArray(row?.trc20) ? row.trc20 : [];
  let usdtRaw = 0;
  for (const entry of trc20Rows) {
    const matchedKey = Object.keys(entry).find((key) => key.toLowerCase() === USDT_TRC20_CONTRACT.toLowerCase());
    if (!matchedKey) continue;
    usdtRaw = parseNumber(entry[matchedKey]);
    break;
  }

  return {
    native: nativeSun > 0 ? Number((nativeSun / 1_000_000).toFixed(6)) : 0,
    usdt: usdtRaw > 0 ? Number((usdtRaw / 1_000_000).toFixed(6)) : 0
  };
};

const fetchFilBalance = async (address: string, signal?: AbortSignal) => {
  if (!chainRegexMap.FIL.test(address.trim().toLowerCase())) return 0;
  const payload =
    (await postJsonRpc<{ result?: { Balance?: unknown } }>(FIL_RPC_URL, 'Filecoin.StateGetActor', [address, []], signal)) ?? {};
  const atto = parseHexBigInt(payload.result?.Balance);
  if (!atto || atto <= 0n) return 0;
  return bigintToDecimal(atto, FIL_ATTO_PER_FIL, 12);
};

const runSafe = async <T>(task: () => Promise<T>, fallback: T) => {
  try {
    return await task();
  } catch {
    return fallback;
  }
};

export const fetchOnchainBalances = async (
  addressByChain: Record<ChainCode, string>,
  signal?: AbortSignal
): Promise<OnchainBalanceSnapshot> => {
  const tasks = await Promise.all([
    runSafe(() => fetchBtcBalance(addressByChain.BTC, signal), 0),
    runSafe(() => fetchEthLikeNativeBalance('ETH', addressByChain.ETH, signal), 0),
    runSafe(() => fetchXrpBalance(addressByChain.XRP, signal), 0),
    runSafe(() => fetchEthLikeNativeBalance('BSC', addressByChain.BSC, signal), 0),
    runSafe(() => fetchSolBalance(addressByChain.SOL, signal), 0),
    runSafe(() => fetchTrxBalances(addressByChain.TRX, signal), { native: 0, usdt: 0 }),
    runSafe(() => fetchFilBalance(addressByChain.FIL, signal), 0),
    runSafe(() => fetchEthLikeUsdtBalance('ETH', addressByChain.ETH, signal), 0),
    runSafe(() => fetchEthLikeUsdtBalance('BSC', addressByChain.BSC, signal), 0)
  ]);

  const [btc, eth, xrp, bsc, sol, trx, fil, usdtEth, usdtBsc] = tasks;

  return {
    nativeByChain: {
      BTC: btc,
      ETH: eth,
      XRP: xrp,
      BSC: bsc,
      SOL: sol,
      TRX: trx.native,
      FIL: fil
    },
    usdtByChain: {
      ETH: usdtEth,
      BSC: usdtBsc,
      TRX: trx.usdt
    },
    fetchedAt: new Date().toISOString()
  };
};
