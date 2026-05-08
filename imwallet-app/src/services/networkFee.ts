export type FeeChainCode = 'BTC' | 'ETH' | 'XRP' | 'BSC' | 'SOL' | 'TRX' | 'FIL';

export type LiveNetworkFeeSnapshot = {
  chain: FeeChainCode;
  nativeFee: number;
  source: string;
  fetchedAt: string;
  stale?: boolean;
  gasPriceGwei?: number;
  gasLimit?: number;
  feeRateSatVb?: number;
};

export type LiveNetworkFeeRequest = {
  fromAddress?: string;
  toAddress?: string;
  amountNative?: number;
};

const DEFAULT_NATIVE_FEE_BY_CHAIN: Record<FeeChainCode, number> = {
  BTC: 0.00004,
  ETH: 0.00012,
  XRP: 0.00012,
  BSC: 0.0000021,
  SOL: 0.000005,
  TRX: 1.2,
  FIL: 0.0003
};

const DEFAULT_EVM_GAS_LIMIT = 21000;
const BTC_TRANSFER_VBYTES = 140;
const TRX_TRANSFER_BYTES = 250;
const SOL_BASE_LAMPORTS_PER_SIGNATURE = 5000;
const SOL_DEFAULT_COMPUTE_UNITS = 200000;
const FIL_RPC_URL = 'https://api.node.glif.io';
const FIL_ATTO_PER_FIL = 1_000_000_000_000_000_000n;
const FIL_DEFAULT_TRANSFER_GAS_LIMIT = 100_000_000n;
const FIL_GAS_PREMIUM_TARGET_EPOCHS = 10;
const FIL_GAS_PREMIUM_ESTIMATE_SENDER = 'f01234';
const FIL_MAINNET_ADDRESS_REGEX = /^f[1-3][a-z2-7]{20,120}$/;
const FIL_DELEGATED_ADDRESS_REGEX = /^f4\d+[a-z2-7]+$/;
const FIL_ID_ADDRESS_REGEX = /^f0\d+$/;

const createFallbackSnapshot = (chain: FeeChainCode, source: string): LiveNetworkFeeSnapshot => ({
  chain,
  nativeFee: DEFAULT_NATIVE_FEE_BY_CHAIN[chain],
  source,
  fetchedAt: new Date().toISOString(),
  stale: true
});

const toFixedNumber = (value: number, digits: number) => Number(value.toFixed(digits));

const toPositiveNumberOrNull = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const parseHexInteger = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (!/^0x/i.test(raw)) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Number.parseInt(raw, 16);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseBigIntInteger = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  if (/^0x[0-9a-f]+$/i.test(raw)) {
    try {
      return BigInt(raw);
    } catch {
      return null;
    }
  }

  if (!/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
};

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

const toAttoFilString = (nativeAmount?: number) => {
  const amount = Number(nativeAmount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return '0';
  const normalized = amount.toFixed(18);
  const [wholeText, fractionTextRaw = ''] = normalized.split('.');
  const whole = /^\d+$/.test(wholeText) ? BigInt(wholeText) : 0n;
  const fractionText = fractionTextRaw.padEnd(18, '0').slice(0, 18);
  const fraction = /^\d{18}$/.test(fractionText) ? BigInt(fractionText) : 0n;
  return (whole * FIL_ATTO_PER_FIL + fraction).toString();
};

const parseGasLimitBigInt = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return BigInt(Math.floor(value));
  }
  return parseBigIntInteger(value);
};

const isValidFilecoinAddressForEstimate = (value: string) => {
  const address = value.trim().toLowerCase();
  if (!address) return false;
  return FIL_ID_ADDRESS_REGEX.test(address) || FIL_MAINNET_ADDRESS_REGEX.test(address) || FIL_DELEGATED_ADDRESS_REGEX.test(address);
};

const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs: number, signal?: AbortSignal) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const abortListener = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    signal.addEventListener('abort', abortListener, { once: true });
  }

  try {
    return await fetch(url, { ...init, signal: controller.signal });
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
    5000,
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

const fetchEthLikeFee = async (chain: 'ETH' | 'BSC', signal?: AbortSignal): Promise<LiveNetworkFeeSnapshot> => {
  const rpcUrl = chain === 'ETH' ? 'https://eth.llamarpc.com' : 'https://bsc-dataseed.binance.org';
  const result = await requestJsonRpc(rpcUrl, 'eth_gasPrice', [], signal);
  const gasPriceWei = parseHexInteger(result);
  if (!gasPriceWei || gasPriceWei <= 0) {
    throw new Error('invalid gas price');
  }

  const gasPriceGwei = gasPriceWei / 1_000_000_000;
  const nativeFee = (gasPriceWei * DEFAULT_EVM_GAS_LIMIT) / 1_000_000_000_000_000_000;

  return {
    chain,
    nativeFee: toFixedNumber(nativeFee, 12),
    gasPriceGwei: toFixedNumber(gasPriceGwei, 9),
    gasLimit: DEFAULT_EVM_GAS_LIMIT,
    source: `${chain.toLowerCase()}-jsonrpc:eth_gasPrice`,
    fetchedAt: new Date().toISOString()
  };
};

const fetchBitcoinFee = async (signal?: AbortSignal): Promise<LiveNetworkFeeSnapshot> => {
  const response = await fetchWithTimeout('https://mempool.space/api/v1/fees/recommended', { method: 'GET' }, 5000, signal);
  if (!response.ok) {
    throw new Error(`btc fee status ${response.status}`);
  }
  const payload = (await response.json()) as {
    fastestFee?: number;
    halfHourFee?: number;
    hourFee?: number;
  };

  const satPerVb =
    toPositiveNumberOrNull(payload?.halfHourFee) ?? toPositiveNumberOrNull(payload?.hourFee) ?? toPositiveNumberOrNull(payload?.fastestFee);
  if (!satPerVb) {
    throw new Error('invalid btc fee payload');
  }

  const nativeFee = (satPerVb * BTC_TRANSFER_VBYTES) / 100_000_000;

  return {
    chain: 'BTC',
    nativeFee: toFixedNumber(nativeFee, 8),
    feeRateSatVb: toFixedNumber(satPerVb, 2),
    source: 'mempool.space:fees/recommended',
    fetchedAt: new Date().toISOString()
  };
};

const fetchXrpFee = async (signal?: AbortSignal): Promise<LiveNetworkFeeSnapshot> => {
  const result = (await requestJsonRpc('https://xrplcluster.com', 'fee', [{}], signal)) as {
    drops?: { open_ledger_fee?: string };
  };

  const openLedgerDrops = toPositiveNumberOrNull(result?.drops?.open_ledger_fee);
  if (!openLedgerDrops) {
    throw new Error('invalid xrp fee payload');
  }

  const nativeFee = openLedgerDrops / 1_000_000;
  return {
    chain: 'XRP',
    nativeFee: toFixedNumber(nativeFee, 8),
    source: 'xrplcluster:fee.open_ledger_fee',
    fetchedAt: new Date().toISOString()
  };
};

const fetchTrxFee = async (signal?: AbortSignal): Promise<LiveNetworkFeeSnapshot> => {
  const response = await fetchWithTimeout(
    'https://api.trongrid.io/wallet/getchainparameters',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    },
    5000,
    signal
  );

  if (!response.ok) {
    throw new Error(`trx chain params status ${response.status}`);
  }

  const payload = (await response.json()) as {
    chainParameter?: Array<{ key?: string; value?: number | string }>;
  };
  const txFeeSunPerByte = toPositiveNumberOrNull(
    (payload.chainParameter || []).find((item) => item.key === 'getTransactionFee')?.value
  );
  if (!txFeeSunPerByte) {
    throw new Error('invalid trx fee payload');
  }

  const nativeFee = (txFeeSunPerByte * TRX_TRANSFER_BYTES) / 1_000_000;
  return {
    chain: 'TRX',
    nativeFee: toFixedNumber(nativeFee, 6),
    source: 'trongrid:getchainparameters.getTransactionFee',
    fetchedAt: new Date().toISOString()
  };
};

const fetchSolFee = async (signal?: AbortSignal): Promise<LiveNetworkFeeSnapshot> => {
  const result = (await requestJsonRpc('https://api.mainnet-beta.solana.com', 'getRecentPrioritizationFees', [], signal)) as Array<{
    prioritizationFee?: number;
  }>;

  const feeRows = Array.isArray(result) ? result : [];
  const priorities = feeRows
    .map((row) => Number(row?.prioritizationFee ?? 0))
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b);

  const medianMicroLamports = priorities.length ? priorities[Math.floor(priorities.length / 2)] : 0;
  const priorityLamports = Math.ceil((medianMicroLamports * SOL_DEFAULT_COMPUTE_UNITS) / 1_000_000);
  const totalLamports = SOL_BASE_LAMPORTS_PER_SIGNATURE + Math.max(0, priorityLamports);
  const nativeFee = totalLamports / 1_000_000_000;

  return {
    chain: 'SOL',
    nativeFee: toFixedNumber(nativeFee, 9),
    source: 'solana:getRecentPrioritizationFees',
    fetchedAt: new Date().toISOString()
  };
};

const estimateFilMessageFee = async (request: LiveNetworkFeeRequest | undefined, signal?: AbortSignal) => {
  const fromAddress = String(request?.fromAddress ?? '').trim().toLowerCase();
  const toAddress = String(request?.toAddress ?? '').trim().toLowerCase();
  if (!isValidFilecoinAddressForEstimate(fromAddress) || !isValidFilecoinAddressForEstimate(toAddress)) {
    return null;
  }

  const estimateMessageGas = async (valueAtto: string) =>
    (await requestJsonRpc(
      FIL_RPC_URL,
      'Filecoin.GasEstimateMessageGas',
      [
        {
          Version: 0,
          To: toAddress,
          From: fromAddress,
          Nonce: 0,
          Value: valueAtto,
          GasLimit: 0,
          GasFeeCap: '0',
          GasPremium: '0',
          Method: 0,
          Params: ''
        },
        { MaxFee: '0' },
        []
      ],
      signal
    )) as {
      GasLimit?: unknown;
      GasFeeCap?: unknown;
      GasPremium?: unknown;
    };

  const amountAtto = toAttoFilString(request?.amountNative);
  let estimatedMessage: {
    GasLimit?: unknown;
    GasFeeCap?: unknown;
    GasPremium?: unknown;
  };
  try {
    estimatedMessage = await estimateMessageGas(amountAtto);
  } catch {
    // Gas for FIL transfer is mostly value-independent.
    // Retry with zero value to keep estimation available.
    estimatedMessage = await estimateMessageGas('0');
  }

  const gasLimit = parseGasLimitBigInt(estimatedMessage?.GasLimit);
  const gasFeeCap = parseBigIntInteger(estimatedMessage?.GasFeeCap) ?? 0n;
  const gasPremium = parseBigIntInteger(estimatedMessage?.GasPremium) ?? 0n;
  if (!gasLimit || gasLimit <= 0n) return null;
  if (gasFeeCap <= 0n && gasPremium <= 0n) return null;

  const chainHead = (await requestJsonRpc(FIL_RPC_URL, 'Filecoin.ChainHead', [], signal)) as {
    Blocks?: Array<{ ParentBaseFee?: unknown }>;
  };
  const baseFee = parseBigIntInteger(chainHead?.Blocks?.[0]?.ParentBaseFee) ?? 0n;
  const effectiveAttoPerGasBase = baseFee + gasPremium;
  const effectiveAttoPerGas = gasFeeCap > 0n && effectiveAttoPerGasBase > gasFeeCap ? gasFeeCap : effectiveAttoPerGasBase;
  const attoTotal = effectiveAttoPerGas > 0n ? effectiveAttoPerGas * gasLimit : gasFeeCap * gasLimit;
  if (attoTotal <= 0n) return null;

  return {
    nativeFee: toFixedNumber(bigintRatioToNumber(attoTotal, FIL_ATTO_PER_FIL, 12), 12),
    gasLimit: Number(gasLimit),
    source: 'filecoin:GasEstimateMessageGas'
  };
};

const fetchFilFee = async (signal?: AbortSignal, request?: LiveNetworkFeeRequest): Promise<LiveNetworkFeeSnapshot> => {
  const estimatedMessageFee = await estimateFilMessageFee(request, signal);
  if (estimatedMessageFee) {
    return {
      chain: 'FIL',
      nativeFee: estimatedMessageFee.nativeFee,
      gasLimit: estimatedMessageFee.gasLimit,
      source: estimatedMessageFee.source,
      fetchedAt: new Date().toISOString()
    };
  }

  const [gasPremiumResult, chainHeadResult] = await Promise.all([
    requestJsonRpc(
      FIL_RPC_URL,
      'Filecoin.GasEstimateGasPremium',
      [FIL_GAS_PREMIUM_TARGET_EPOCHS, FIL_GAS_PREMIUM_ESTIMATE_SENDER, 0, null],
      signal
    ),
    requestJsonRpc(FIL_RPC_URL, 'Filecoin.ChainHead', [], signal)
  ]);

  const gasPremiumAtto = parseBigIntInteger(gasPremiumResult);
  if (!gasPremiumAtto || gasPremiumAtto <= 0n) {
    throw new Error('invalid fil gas premium');
  }

  const parentBaseFeeRaw = (chainHeadResult as { Blocks?: Array<{ ParentBaseFee?: unknown }> })?.Blocks?.[0]?.ParentBaseFee;
  const parentBaseFeeAtto = parseBigIntInteger(parentBaseFeeRaw) ?? 0n;
  const attoPerGas = gasPremiumAtto + (parentBaseFeeAtto > 0n ? parentBaseFeeAtto : 0n);
  const estimatedAtto = attoPerGas * FIL_DEFAULT_TRANSFER_GAS_LIMIT;
  const nativeFee = bigintRatioToNumber(estimatedAtto, FIL_ATTO_PER_FIL, 12);

  return {
    chain: 'FIL',
    nativeFee: toFixedNumber(nativeFee, 12),
    gasLimit: Number(FIL_DEFAULT_TRANSFER_GAS_LIMIT),
    source: 'filecoin:GasEstimateGasPremium+ChainHead',
    fetchedAt: new Date().toISOString()
  };
};

export const fetchLiveNetworkFee = async (
  chain: FeeChainCode,
  signal?: AbortSignal,
  request?: LiveNetworkFeeRequest
): Promise<LiveNetworkFeeSnapshot> => {
  try {
    if (chain === 'ETH' || chain === 'BSC') return await fetchEthLikeFee(chain, signal);
    if (chain === 'BTC') return await fetchBitcoinFee(signal);
    if (chain === 'XRP') return await fetchXrpFee(signal);
    if (chain === 'TRX') return await fetchTrxFee(signal);
    if (chain === 'SOL') return await fetchSolFee(signal);
    if (chain === 'FIL') return await fetchFilFee(signal, request);
    return createFallbackSnapshot(chain, 'fallback:unsupported-chain');
  } catch (error) {
    return createFallbackSnapshot(chain, error instanceof Error ? `fallback:${error.message}` : 'fallback:network-error');
  }
};
