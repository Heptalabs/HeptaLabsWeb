import { Buffer } from 'buffer';
import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { blake2b } from '@noble/hashes/blake2.js';
import * as secp from '@noble/secp256k1';
import { derivePath } from 'ed25519-hd-key';
import nacl from 'tweetnacl';
import * as btc from '@scure/btc-signer';
import { pubECDSA } from '@scure/btc-signer/utils.js';
import { encode as encodeDagCbor } from '@ipld/dag-cbor';
import { encode as encodeXrpTx, encodeForSigning as encodeXrpForSigning } from 'ripple-binary-codec';
import { deriveAddress as deriveXrpAddress, sign as signXrp } from 'ripple-keypairs';
import {
  Connection as SolConnection,
  Keypair as SolKeypair,
  PublicKey as SolPublicKey,
  SystemProgram as SolSystemProgram,
  Transaction as SolTransaction,
  TransactionInstruction as SolTransactionInstruction
} from '@solana/web3.js';
import { TronWeb } from 'tronweb';
import { newFromString as parseFilecoinAddress, newSecp256k1Address } from '@glif/filecoin-address';
import { chainRegexMap } from '../domain/wallet-domain';
import {
  TRUST_DERIVATION_PATH_BY_CHAIN,
  isValidRecoverySeedWords,
  normalizeSeedWords,
  type CompatChainCode
} from './walletRecoveryCompat';
import { resolveBackendBaseUrl } from './backendBaseUrl';
import { withRpcProxyAuthHeaders } from './rpcProxyAuth';

export type OnchainSendChain = 'BTC' | 'ETH' | 'XRP' | 'BSC' | 'SOL' | 'TRX' | 'FIL';
export type OnchainSendAsset = 'NATIVE' | 'USDT';

export type EvmSendChain = 'ETH' | 'BSC';
export type EvmSendAsset = 'NATIVE' | 'USDT';
export type OnchainNftSendChain = 'ETH' | 'BSC' | 'SOL' | 'TRX';

export type OnchainSendInput = {
  chain: OnchainSendChain;
  asset: OnchainSendAsset;
  amountText: string;
  fromAddress: string;
  toAddress: string;
  seedWords: string[];
  accountIndex?: number;
  passphrase?: string;
  manualGasPriceGwei?: number;
  manualGasLimit?: number;
  manualNonce?: number;
  txDataHex?: string;
};

export type EvmOnchainSendInput = Omit<OnchainSendInput, 'chain'> & {
  chain: EvmSendChain;
  asset: EvmSendAsset;
};

export type OnchainNftSendInput = {
  chain: OnchainNftSendChain;
  contractAddress: string;
  tokenId: string;
  fromAddress: string;
  toAddress: string;
  seedWords: string[];
  accountIndex?: number;
  passphrase?: string;
  manualGasPriceGwei?: number;
  manualGasLimit?: number;
  manualNonce?: number;
};

export type OnchainSendResult = {
  chain: OnchainSendChain;
  txHash: string;
  asset: OnchainSendAsset;
  nonce?: number;
  gasLimit?: number;
  gasPriceWei?: string;
};

export type EvmOnchainSendResult = {
  chain: EvmSendChain;
  txHash: string;
  nonce: number;
  gasLimit: number;
  gasPriceWei: string;
  maxFeePerGasWei: string;
  maxPriorityFeePerGasWei: string;
  asset: EvmSendAsset;
};

export type OnchainNftSendResult = {
  chain: OnchainNftSendChain;
  txHash: string;
  nonce?: number;
  gasLimit?: number;
  gasPriceWei?: string;
  maxFeePerGasWei?: string;
  maxPriorityFeePerGasWei?: string;
};

export type OnchainNftOwnershipTarget = {
  id: string;
  chain: OnchainNftSendChain;
  contractAddress: string;
  tokenId: string;
};

export type OnchainNftOwnershipSnapshot = {
  fetchedAt: string;
  ownedById: Record<string, number>;
};

export type OnchainSendErrorCode =
  | 'unsupported_chain'
  | 'unsupported_asset'
  | 'invalid_seed'
  | 'missing_private_key'
  | 'sender_mismatch'
  | 'invalid_recipient'
  | 'invalid_token'
  | 'invalid_amount'
  | 'insufficient_balance'
  | 'invalid_rpc_response'
  | 'rpc_error'
  | 'broadcast_failed';

export class OnchainSendError extends Error {
  code: OnchainSendErrorCode;

  constructor(code: OnchainSendErrorCode, message: string) {
    super(message);
    this.name = 'OnchainSendError';
    this.code = code;
  }
}

const RPC_PROXY_BASE = `${resolveBackendBaseUrl()}/api/v1/rpc`;
const ETH_RPC_URL = `${RPC_PROXY_BASE}/eth`;
const BSC_RPC_URL = `${RPC_PROXY_BASE}/bsc`;
const XRP_RPC_URL = `${RPC_PROXY_BASE}/xrp`;
const SOL_RPC_URL = `${RPC_PROXY_BASE}/sol`;
const TRX_FULL_HOST = `${RPC_PROXY_BASE}/trx`;
const FIL_RPC_URL = `${RPC_PROXY_BASE}/fil`;
const BTC_ADDRESS_API = `${RPC_PROXY_BASE}/btc/address`;
const BTC_BROADCAST_API = `${RPC_PROXY_BASE}/btc/tx`;
const BTC_FEE_API = `${RPC_PROXY_BASE}/btc/fees/recommended`;

const USDT_ERC20_CONTRACT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const USDT_BEP20_CONTRACT = '0x55d398326f99059fF775485246999027B3197955';
const USDT_TRC20_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const SOL_TOKEN_PROGRAM_ID = new SolPublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const SOL_ASSOCIATED_TOKEN_PROGRAM_ID = new SolPublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

const DEFAULT_NATIVE_GAS_LIMIT = 21000n;
const DEFAULT_USDT_GAS_LIMIT = 75000n;
const DEFAULT_EVM_NFT_GAS_LIMIT = 130000n;
const DEFAULT_BTC_FEE_PER_VBYTE = 5n;
const DEFAULT_TRX_USDT_FEE_LIMIT_SUN = 100_000_000;
const DEFAULT_TRX_NFT_FEE_LIMIT_SUN = 120_000_000;

const EVM_18_DECIMALS = 18;
const USDT_DECIMALS = 6;
const BTC_DECIMALS = 8;
const XRP_DECIMALS = 6;
const SOL_DECIMALS = 9;
const TRX_DECIMALS = 6;
const FIL_DECIMALS = 18;

const XRP_FULLY_CANONICAL_SIG_FLAG = 0x80000000;
const FIL_MAINNET_SEC_PREFIX = 'f';
const FIL_SECP256K1_SIGNATURE_TYPE = 1;
const FIL_CID_PREFIX = Uint8Array.from([0x01, 0x71, 0xa0, 0xe4, 0x02, 0x20]);
const EIP1559_TX_TYPE = 0x02;

let secpHashHooksInitialized = false;
const ensureSecpHashHooks = () => {
  if (secpHashHooksInitialized) return;
  if (!secp.hashes.sha256) {
    secp.hashes.sha256 = sha256;
  }
  if (!secp.hashes.hmacSha256) {
    secp.hashes.hmacSha256 = (key, message) => hmac(sha256, key, message);
  }
  secpHashHooksInitialized = true;
};

const toCompatPath = (template: string, index: number) => template.replaceAll('{index}', String(Math.max(0, Math.floor(index))));

const hexToBytes = (hex: string): Uint8Array => {
  const normalized = hex.trim().replace(/^0x/i, '');
  if (normalized.length === 0) return new Uint8Array();
  if (!/^[0-9a-f]+$/i.test(normalized)) throw new Error('invalid hex string');
  const even = normalized.length % 2 === 0 ? normalized : `0${normalized}`;
  const out = new Uint8Array(even.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(even.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
};

const bytesToHex = (value: Uint8Array) => Array.from(value).map((byte) => byte.toString(16).padStart(2, '0')).join('');

const concatBytes = (...chunks: Uint8Array[]) => {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  chunks.forEach((chunk) => {
    out.set(chunk, offset);
    offset += chunk.length;
  });
  return out;
};

const bigintToMinimalBytes = (value: bigint): Uint8Array => {
  if (value <= 0n) return new Uint8Array();
  const hex = value.toString(16);
  return hexToBytes(hex.length % 2 === 0 ? hex : `0${hex}`);
};

type RlpNode = Uint8Array | bigint | number | string | RlpNode[];

const rlpEncodeBytes = (bytes: Uint8Array): Uint8Array => {
  if (bytes.length === 1 && bytes[0] < 0x80) return bytes;
  if (bytes.length <= 55) return concatBytes(Uint8Array.from([0x80 + bytes.length]), bytes);
  const lengthBytes = bigintToMinimalBytes(BigInt(bytes.length));
  return concatBytes(Uint8Array.from([0xb7 + lengthBytes.length]), lengthBytes, bytes);
};

const toRlpBytes = (node: Exclude<RlpNode, RlpNode[]>) => {
  if (node instanceof Uint8Array) return node;
  if (typeof node === 'bigint') return bigintToMinimalBytes(node);
  if (typeof node === 'number') return bigintToMinimalBytes(BigInt(Math.max(0, Math.floor(node))));
  if (typeof node === 'string') {
    if (node.startsWith('0x') || node.startsWith('0X')) return hexToBytes(node);
    if (!node.trim()) return new Uint8Array();
    if (/^\d+$/.test(node.trim())) return bigintToMinimalBytes(BigInt(node.trim()));
    return new TextEncoder().encode(node);
  }
  return new Uint8Array();
};

const rlpEncode = (node: RlpNode): Uint8Array => {
  if (Array.isArray(node)) {
    const encodedItems = node.map((item) => rlpEncode(item));
    const payload = concatBytes(...encodedItems);
    if (payload.length <= 55) return concatBytes(Uint8Array.from([0xc0 + payload.length]), payload);
    const lengthBytes = bigintToMinimalBytes(BigInt(payload.length));
    return concatBytes(Uint8Array.from([0xf7 + lengthBytes.length]), lengthBytes, payload);
  }
  return rlpEncodeBytes(toRlpBytes(node));
};

const parseHexBigInt = (value: unknown): bigint | null => {
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

const parsePositiveInteger = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
};

const parseAmountToUnits = (amountText: string, decimals: number): bigint => {
  const raw = amountText.trim();
  if (!raw) return 0n;

  const normalized = raw.replace(/,/g, '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return 0n;
  }

  const [wholeRaw, fractionRaw = ''] = normalized.split('.');
  const whole = wholeRaw ? BigInt(wholeRaw) : 0n;
  const paddedFraction = (fractionRaw + '0'.repeat(decimals)).slice(0, decimals);
  const fraction = paddedFraction ? BigInt(paddedFraction) : 0n;
  return whole * (10n ** BigInt(decimals)) + fraction;
};

const parseUnsignedDecimalBigInt = (value: string): bigint => {
  const raw = String(value ?? '').trim();
  if (!/^\d+$/.test(raw)) {
    throw new OnchainSendError('invalid_rpc_response', `invalid decimal amount: ${raw || '(empty)'}`);
  }
  try {
    return BigInt(raw);
  } catch {
    throw new OnchainSendError('invalid_rpc_response', `invalid decimal amount: ${raw}`);
  }
};

const parseUnsignedTokenId = (value: string): bigint => {
  const raw = String(value ?? '').trim();
  if (!/^\d+$/.test(raw)) {
    throw new OnchainSendError('invalid_token', `invalid NFT token id: ${raw || '(empty)'}`);
  }
  try {
    return BigInt(raw);
  } catch {
    throw new OnchainSendError('invalid_token', `invalid NFT token id: ${raw}`);
  }
};

const serializeFilBigNum = (value: string): Uint8Array => {
  const amount = parseUnsignedDecimalBigInt(value);
  if (amount === 0n) return new Uint8Array();
  return concatBytes(Uint8Array.from([0x00]), bigintToMinimalBytes(amount));
};

const toFilAddressBytes = (address: string): Uint8Array => {
  try {
    return new Uint8Array(parseFilecoinAddress(address).bytes);
  } catch {
    throw new OnchainSendError('invalid_recipient', `invalid FIL address: ${address}`);
  }
};

type FilUnsignedMessage = {
  To: string;
  From: string;
  Nonce: number;
  Value: string;
  GasLimit: number;
  GasFeeCap: string;
  GasPremium: string;
  Method: number;
  Params: string;
};

const encodeFilUnsignedMessage = (message: FilUnsignedMessage): Uint8Array => {
  const paramsBytes = message.Params ? new Uint8Array(Buffer.from(message.Params, 'base64')) : new Uint8Array();
  const tuple = [
    0,
    toFilAddressBytes(message.To),
    toFilAddressBytes(message.From),
    Math.max(0, Math.floor(message.Nonce)),
    serializeFilBigNum(message.Value),
    Math.max(0, Math.floor(message.GasLimit)),
    serializeFilBigNum(message.GasFeeCap),
    serializeFilBigNum(message.GasPremium),
    Math.max(0, Math.floor(message.Method)),
    paramsBytes
  ] as const;
  return new Uint8Array(encodeDagCbor(tuple));
};

const buildFilMessageDigest = (encodedMessage: Uint8Array): Uint8Array => {
  const cborHash = blake2b(encodedMessage, { dkLen: 32 });
  return blake2b(concatBytes(FIL_CID_PREFIX, cborHash), { dkLen: 32 });
};

const signFilUnsignedMessage = (message: FilUnsignedMessage, privateKey: Uint8Array) => {
  ensureSecpHashHooks();
  const encoded = encodeFilUnsignedMessage(message);
  const digest = buildFilMessageDigest(encoded);
  const signature = secp.sign(digest, privateKey, {
    prehash: false,
    format: 'recovered',
    lowS: true
  });

  if (signature.length !== 65) {
    throw new OnchainSendError('broadcast_failed', 'invalid FIL signature length');
  }

  return {
    Type: FIL_SECP256K1_SIGNATURE_TYPE,
    Data: Buffer.from(signature).toString('base64')
  };
};

const toLowerHexAddress = (address: string) => `0x${address.trim().replace(/^0x/i, '').toLowerCase()}`;
const normalizeHexAddress = (address: string) => `0x${address.trim().replace(/^0x/i, '')}`;
const assertHexAddress = (address: string) => /^0x[a-fA-F0-9]{40}$/.test(address.trim());

const normalizeAndValidateSeedWords = (words: string[]) => {
  const normalized = normalizeSeedWords(words);
  if (!isValidRecoverySeedWords(normalized)) {
    throw new OnchainSendError('invalid_seed', 'invalid BIP39 recovery words');
  }
  return normalized;
};

const deriveSecpPrivateKey = (chain: Exclude<OnchainSendChain, 'SOL'>, words: string[], accountIndex = 0, passphrase = '') => {
  const normalized = normalizeAndValidateSeedWords(words);
  const template = TRUST_DERIVATION_PATH_BY_CHAIN[chain as CompatChainCode];
  const path = toCompatPath(template, accountIndex);
  const seed = mnemonicToSeedSync(normalized.join(' '), (passphrase ?? '').normalize('NFKD'));
  const root = HDKey.fromMasterSeed(seed);
  const node = root.derive(path);
  if (!node.privateKey) {
    throw new OnchainSendError('missing_private_key', `missing private key for ${chain} derivation path`);
  }
  return new Uint8Array(node.privateKey.buffer, node.privateKey.byteOffset, node.privateKey.byteLength);
};

const deriveSolSeed = (words: string[], accountIndex = 0, passphrase = '') => {
  const normalized = normalizeAndValidateSeedWords(words);
  const path = toCompatPath(TRUST_DERIVATION_PATH_BY_CHAIN.SOL, accountIndex);
  const seed = mnemonicToSeedSync(normalized.join(' '), (passphrase ?? '').normalize('NFKD'));
  const derived = derivePath(path, bytesToHex(new Uint8Array(seed.buffer, seed.byteOffset, seed.byteLength)));
  const derivedSeed = new Uint8Array(derived.key.buffer, derived.key.byteOffset, derived.key.byteLength);
  if (derivedSeed.length !== 32) {
    throw new OnchainSendError('missing_private_key', 'invalid derived seed length for SOL account');
  }
  return derivedSeed;
};

const deriveEvmAddressFromPrivateKey = (privateKey: Uint8Array) => {
  ensureSecpHashHooks();
  const uncompressed = secp.getPublicKey(privateKey, false).slice(1);
  const hashed = keccak_256(uncompressed);
  return `0x${bytesToHex(hashed.slice(hashed.length - 20))}`;
};

const deriveBtcAddressFromPrivateKey = (privateKey: Uint8Array) => {
  const pubKey = pubECDSA(privateKey);
  const payment = btc.p2wpkh(pubKey);
  if (!payment.address) throw new OnchainSendError('missing_private_key', 'failed to derive BTC P2WPKH address');
  return payment.address;
};

const deriveXrpAddressFromPrivateKey = (privateKey: Uint8Array) => {
  ensureSecpHashHooks();
  const compressed = secp.getPublicKey(privateKey, true);
  return deriveXrpAddress(bytesToHex(compressed).toUpperCase());
};

const deriveTrxAddressFromPrivateKey = (privateKey: Uint8Array) => {
  const keyHex = bytesToHex(privateKey);
  const address = TronWeb.address.fromPrivateKey(keyHex);
  if (!address) throw new OnchainSendError('missing_private_key', 'failed to derive TRX address from private key');
  return address;
};

const deriveFilAddressFromPrivateKey = (privateKey: Uint8Array) => {
  ensureSecpHashHooks();
  const extended = secp.getPublicKey(privateKey, false);
  return newSecp256k1Address(extended).toString();
};

const deriveSolKeypairFromSeed = (seed32: Uint8Array) => {
  const keyPair = nacl.sign.keyPair.fromSeed(seed32);
  return SolKeypair.fromSecretKey(keyPair.secretKey);
};

const assertAddressForChain = (chain: OnchainSendChain, address: string) => {
  const normalized = address.trim();
  if (!chainRegexMap[chain].test(normalized)) {
    throw new OnchainSendError('invalid_recipient', `invalid ${chain} address format`);
  }
  return normalized;
};

const rpcUrlByChain = (chain: EvmSendChain) => (chain === 'ETH' ? ETH_RPC_URL : BSC_RPC_URL);

const postJsonRpc = async <T>(rpcUrl: string, method: string, params: unknown[]) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: withRpcProxyAuthHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: method,
        method,
        params
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new OnchainSendError('rpc_error', `json rpc ${method} failed: ${response.status}`);
    }

    const payload = (await response.json()) as { result?: T; error?: { message?: string } };
    if (payload.error) {
      throw new OnchainSendError('rpc_error', payload.error.message || `${method} rpc error`);
    }
    return payload.result;
  } finally {
    clearTimeout(timeoutId);
  }
};

const fetchJson = async <T>(url: string, init?: RequestInit, timeoutMs = 12000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...(init || {}),
      headers: withRpcProxyAuthHeaders(init?.headers),
      signal: controller.signal
    });
    if (!response.ok) {
      throw new OnchainSendError('rpc_error', `request failed (${response.status}) for ${url}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
};

const postPlainText = async (url: string, body: string, timeoutMs = 12000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: withRpcProxyAuthHeaders({ 'content-type': 'text/plain' }),
      body,
      signal: controller.signal
    });

    const text = await response.text();
    if (!response.ok) {
      throw new OnchainSendError('broadcast_failed', text || `broadcast failed (${response.status})`);
    }
    return text;
  } finally {
    clearTimeout(timeoutId);
  }
};

const getTokenContract = (chain: EvmSendChain, asset: EvmSendAsset) => {
  if (asset !== 'USDT') return null;
  return chain === 'ETH' ? USDT_ERC20_CONTRACT : USDT_BEP20_CONTRACT;
};

const toErc20TransferData = (recipient: string, amountUnits: bigint) => {
  const to = recipient.trim().replace(/^0x/i, '').toLowerCase();
  const amountHex = amountUnits.toString(16).padStart(64, '0');
  const paddedTo = to.padStart(64, '0');
  return `0xa9059cbb${paddedTo}${amountHex}`;
};

const toErc721TransferFromData = (fromAddress: string, recipient: string, tokenId: bigint) => {
  const from = fromAddress.trim().replace(/^0x/i, '').toLowerCase();
  const to = recipient.trim().replace(/^0x/i, '').toLowerCase();
  const tokenHex = tokenId.toString(16).padStart(64, '0');
  return `0x23b872dd${from.padStart(64, '0')}${to.padStart(64, '0')}${tokenHex}`;
};

const toErc721OwnerOfData = (tokenId: bigint) => `0x6352211e${tokenId.toString(16).padStart(64, '0')}`;

const parseEvmOwnerOfResult = (raw: unknown) => {
  const normalized = String(raw ?? '').trim().replace(/^0x/i, '').toLowerCase();
  if (!normalized || !/^[0-9a-f]+$/.test(normalized)) return null;
  if (normalized.length < 40) return null;
  return `0x${normalized.slice(-40)}`;
};

const buildEip1559SigningPayload = (params: {
  nonce: bigint;
  maxPriorityFeePerGasWei: bigint;
  maxFeePerGasWei: bigint;
  gasLimit: bigint;
  to: string;
  valueWei: bigint;
  dataHex: string;
  chainId: bigint;
}) =>
  concatBytes(
    Uint8Array.from([EIP1559_TX_TYPE]),
    rlpEncode([
      params.chainId,
      params.nonce,
      params.maxPriorityFeePerGasWei,
      params.maxFeePerGasWei,
      params.gasLimit,
      hexToBytes(params.to),
      params.valueWei,
      hexToBytes(params.dataHex),
      []
    ])
  );

const buildEip1559RawTx = (params: {
  chainId: bigint;
  nonce: bigint;
  maxPriorityFeePerGasWei: bigint;
  maxFeePerGasWei: bigint;
  gasLimit: bigint;
  to: string;
  valueWei: bigint;
  dataHex: string;
  yParity: bigint;
  r: Uint8Array;
  s: Uint8Array;
}) =>
  concatBytes(
    Uint8Array.from([EIP1559_TX_TYPE]),
    rlpEncode([
      params.chainId,
      params.nonce,
      params.maxPriorityFeePerGasWei,
      params.maxFeePerGasWei,
      params.gasLimit,
      hexToBytes(params.to),
      params.valueWei,
      hexToBytes(params.dataHex),
      [],
      params.yParity,
      params.r,
      params.s
    ])
  );

const resolveEip1559Fees = async (rpcUrl: string, manualGasPriceGwei?: number) => {
  const manual = Number(manualGasPriceGwei);
  if (Number.isFinite(manual) && manual > 0) {
    const manualWei = BigInt(Math.round(manual * 1_000_000_000));
    return {
      maxPriorityFeePerGasWei: manualWei,
      maxFeePerGasWei: manualWei
    };
  }

  const [priorityRaw, blockRaw] = await Promise.all([
    postJsonRpc<string>(rpcUrl, 'eth_maxPriorityFeePerGas', []).catch(() => null),
    postJsonRpc<{ baseFeePerGas?: string }>(rpcUrl, 'eth_getBlockByNumber', ['pending', false]).catch(() => null)
  ]);

  const priorityFeeWei = parseHexBigInt(priorityRaw ?? '') ?? 2_000_000_000n;
  const baseFeeWei = parseHexBigInt(blockRaw?.baseFeePerGas ?? '') ?? 0n;
  const maxPriorityFeePerGasWei = priorityFeeWei > 0n ? priorityFeeWei : 2_000_000_000n;
  const maxFeePerGasWei = baseFeeWei > 0n ? baseFeeWei * 2n + maxPriorityFeePerGasWei : maxPriorityFeePerGasWei * 2n;

  if (maxPriorityFeePerGasWei <= 0n || maxFeePerGasWei <= 0n || maxFeePerGasWei < maxPriorityFeePerGasWei) {
    throw new OnchainSendError('invalid_rpc_response', 'invalid EIP-1559 fee values');
  }
  return {
    maxPriorityFeePerGasWei,
    maxFeePerGasWei
  };
};

const resolveNonce = async (rpcUrl: string, fromAddress: string, manualNonce?: number) => {
  const manual = Number(manualNonce);
  if (Number.isFinite(manual) && manual >= 0) {
    return BigInt(Math.floor(manual));
  }

  const result = await postJsonRpc<string>(rpcUrl, 'eth_getTransactionCount', [fromAddress, 'pending']);
  const nonce = parseHexBigInt(result);
  if (nonce === null || nonce < 0n) {
    throw new OnchainSendError('invalid_rpc_response', 'invalid nonce response');
  }
  return nonce;
};

const resolveGasLimit = async (params: {
  rpcUrl: string;
  fromAddress: string;
  to: string;
  valueWei: bigint;
  dataHex: string;
  manualGasLimit?: number;
  asset: EvmSendAsset;
}) => {
  const manual = Number(params.manualGasLimit);
  if (Number.isFinite(manual) && manual > 0) {
    return BigInt(Math.floor(manual));
  }

  const defaultLimit = params.asset === 'USDT' ? DEFAULT_USDT_GAS_LIMIT : DEFAULT_NATIVE_GAS_LIMIT;
  try {
    const estimate = await postJsonRpc<string>(params.rpcUrl, 'eth_estimateGas', [
      {
        from: params.fromAddress,
        to: params.to,
        value: `0x${params.valueWei.toString(16)}`,
        data: params.dataHex
      }
    ]);
    const estimateBigInt = parseHexBigInt(estimate);
    if (!estimateBigInt || estimateBigInt <= 0n) return defaultLimit;
    const buffered = estimateBigInt + estimateBigInt / 10n;
    return buffered > defaultLimit ? buffered : defaultLimit;
  } catch {
    return defaultLimit;
  }
};

const resolveNftGasLimit = async (params: {
  rpcUrl: string;
  fromAddress: string;
  to: string;
  dataHex: string;
  manualGasLimit?: number;
}) => {
  const manual = Number(params.manualGasLimit);
  if (Number.isFinite(manual) && manual > 0) {
    return BigInt(Math.floor(manual));
  }

  try {
    const estimate = await postJsonRpc<string>(params.rpcUrl, 'eth_estimateGas', [
      {
        from: params.fromAddress,
        to: params.to,
        value: '0x0',
        data: params.dataHex
      }
    ]);
    const estimateBigInt = parseHexBigInt(estimate);
    if (!estimateBigInt || estimateBigInt <= 0n) return DEFAULT_EVM_NFT_GAS_LIMIT;
    const buffered = estimateBigInt + estimateBigInt / 5n;
    return buffered > DEFAULT_EVM_NFT_GAS_LIMIT ? buffered : DEFAULT_EVM_NFT_GAS_LIMIT;
  } catch {
    return DEFAULT_EVM_NFT_GAS_LIMIT;
  }
};

const sendEvm = async (input: EvmOnchainSendInput): Promise<EvmOnchainSendResult> => {
  if (input.chain !== 'ETH' && input.chain !== 'BSC') {
    throw new OnchainSendError('unsupported_chain', `unsupported EVM chain: ${input.chain}`);
  }

  const from = input.fromAddress.trim();
  const toRaw = input.toAddress.trim();
  if (!assertHexAddress(from) || !assertHexAddress(toRaw)) {
    throw new OnchainSendError('invalid_recipient', 'invalid sender or recipient address');
  }

  if (input.asset === 'USDT' && input.chain !== 'ETH' && input.chain !== 'BSC') {
    throw new OnchainSendError('unsupported_asset', `USDT on ${input.chain} is not supported in EVM engine`);
  }

  const decimals = input.asset === 'USDT' ? USDT_DECIMALS : EVM_18_DECIMALS;
  const amountUnits = parseAmountToUnits(input.amountText, decimals);
  if (amountUnits <= 0n) {
    throw new OnchainSendError('invalid_amount', 'invalid transfer amount');
  }

  const privateKey = deriveSecpPrivateKey(input.chain, input.seedWords, input.accountIndex ?? 0, input.passphrase ?? '');
  const derivedAddress = toLowerHexAddress(deriveEvmAddressFromPrivateKey(privateKey));
  const normalizedFrom = toLowerHexAddress(from);
  if (derivedAddress !== normalizedFrom) {
    throw new OnchainSendError('sender_mismatch', 'derived wallet address does not match sender address');
  }

  const contract = getTokenContract(input.chain, input.asset);
  const txTo = contract ? contract : toRaw;
  const txData = contract
    ? toErc20TransferData(toRaw, amountUnits)
    : input.txDataHex && /^0x[0-9a-f]*$/i.test(input.txDataHex.trim())
      ? input.txDataHex.trim()
      : '0x';
  const txValueWei = contract ? 0n : amountUnits;

  const rpcUrl = rpcUrlByChain(input.chain);
  const chainIdRaw = await postJsonRpc<string>(rpcUrl, 'eth_chainId', []);
  const chainId = parseHexBigInt(chainIdRaw);
  if (!chainId || chainId <= 0n) {
    throw new OnchainSendError('invalid_rpc_response', 'invalid chain id');
  }

  const [nonce, eip1559Fees] = await Promise.all([
    resolveNonce(rpcUrl, from, input.manualNonce),
    resolveEip1559Fees(rpcUrl, input.manualGasPriceGwei)
  ]);

  const gasLimit = await resolveGasLimit({
    rpcUrl,
    fromAddress: from,
    to: txTo,
    valueWei: txValueWei,
    dataHex: txData,
    manualGasLimit: input.manualGasLimit,
    asset: input.asset
  });

  const signingPayload = buildEip1559SigningPayload({
    nonce,
    maxPriorityFeePerGasWei: eip1559Fees.maxPriorityFeePerGasWei,
    maxFeePerGasWei: eip1559Fees.maxFeePerGasWei,
    gasLimit,
    to: normalizeHexAddress(txTo),
    valueWei: txValueWei,
    dataHex: txData,
    chainId
  });

  const msgHash = keccak_256(signingPayload);
  ensureSecpHashHooks();
  const signature = secp.sign(msgHash, privateKey, {
    prehash: false,
    format: 'recovered',
    lowS: true
  });

  if (signature.length !== 65) {
    throw new OnchainSendError('broadcast_failed', 'unexpected signature length');
  }

  const yParity = BigInt(signature[64]);
  const r = signature.slice(0, 32);
  const s = signature.slice(32, 64);

  const rawTx = buildEip1559RawTx({
    chainId,
    nonce,
    maxPriorityFeePerGasWei: eip1559Fees.maxPriorityFeePerGasWei,
    maxFeePerGasWei: eip1559Fees.maxFeePerGasWei,
    gasLimit,
    to: normalizeHexAddress(txTo),
    valueWei: txValueWei,
    dataHex: txData,
    yParity,
    r,
    s
  });

  const rawTxHex = `0x${bytesToHex(rawTx)}`;
  const txHash = await postJsonRpc<string>(rpcUrl, 'eth_sendRawTransaction', [rawTxHex]);
  const hashNormalized = String(txHash ?? '').trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(hashNormalized)) {
    throw new OnchainSendError('broadcast_failed', 'invalid tx hash response');
  }

  return {
    chain: input.chain,
    txHash: hashNormalized,
    nonce: Number(nonce),
    gasLimit: Number(gasLimit),
    gasPriceWei: eip1559Fees.maxFeePerGasWei.toString(),
    maxFeePerGasWei: eip1559Fees.maxFeePerGasWei.toString(),
    maxPriorityFeePerGasWei: eip1559Fees.maxPriorityFeePerGasWei.toString(),
    asset: input.asset
  };
};

const sendEvmNft = async (
  input: OnchainNftSendInput & { chain: EvmSendChain }
): Promise<OnchainNftSendResult> => {
  const from = input.fromAddress.trim();
  const to = input.toAddress.trim();
  const contract = input.contractAddress.trim();
  if (!assertHexAddress(from) || !assertHexAddress(to) || !assertHexAddress(contract)) {
    throw new OnchainSendError('invalid_recipient', 'invalid sender/recipient/contract address');
  }

  const tokenId = parseUnsignedTokenId(input.tokenId);
  const privateKey = deriveSecpPrivateKey(input.chain, input.seedWords, input.accountIndex ?? 0, input.passphrase ?? '');
  const derivedAddress = toLowerHexAddress(deriveEvmAddressFromPrivateKey(privateKey));
  const normalizedFrom = toLowerHexAddress(from);
  if (derivedAddress !== normalizedFrom) {
    throw new OnchainSendError('sender_mismatch', 'derived wallet address does not match sender address');
  }

  const rpcUrl = rpcUrlByChain(input.chain);
  const ownerRaw = await postJsonRpc<string>(rpcUrl, 'eth_call', [
    {
      to: normalizeHexAddress(contract),
      data: toErc721OwnerOfData(tokenId)
    },
    'latest'
  ]);
  const owner = parseEvmOwnerOfResult(ownerRaw);
  if (!owner || owner !== normalizedFrom) {
    throw new OnchainSendError('insufficient_balance', 'sender does not own this NFT token');
  }

  const txData = toErc721TransferFromData(from, to, tokenId);
  const chainIdRaw = await postJsonRpc<string>(rpcUrl, 'eth_chainId', []);
  const chainId = parseHexBigInt(chainIdRaw);
  if (!chainId || chainId <= 0n) {
    throw new OnchainSendError('invalid_rpc_response', 'invalid chain id');
  }

  const [nonce, eip1559Fees] = await Promise.all([
    resolveNonce(rpcUrl, from, input.manualNonce),
    resolveEip1559Fees(rpcUrl, input.manualGasPriceGwei)
  ]);
  const gasLimit = await resolveNftGasLimit({
    rpcUrl,
    fromAddress: from,
    to: contract,
    dataHex: txData,
    manualGasLimit: input.manualGasLimit
  });

  const signingPayload = buildEip1559SigningPayload({
    nonce,
    maxPriorityFeePerGasWei: eip1559Fees.maxPriorityFeePerGasWei,
    maxFeePerGasWei: eip1559Fees.maxFeePerGasWei,
    gasLimit,
    to: normalizeHexAddress(contract),
    valueWei: 0n,
    dataHex: txData,
    chainId
  });

  const msgHash = keccak_256(signingPayload);
  ensureSecpHashHooks();
  const signature = secp.sign(msgHash, privateKey, {
    prehash: false,
    format: 'recovered',
    lowS: true
  });
  if (signature.length !== 65) {
    throw new OnchainSendError('broadcast_failed', 'unexpected signature length');
  }

  const yParity = BigInt(signature[64]);
  const r = signature.slice(0, 32);
  const s = signature.slice(32, 64);
  const rawTx = buildEip1559RawTx({
    chainId,
    nonce,
    maxPriorityFeePerGasWei: eip1559Fees.maxPriorityFeePerGasWei,
    maxFeePerGasWei: eip1559Fees.maxFeePerGasWei,
    gasLimit,
    to: normalizeHexAddress(contract),
    valueWei: 0n,
    dataHex: txData,
    yParity,
    r,
    s
  });

  const rawTxHex = `0x${bytesToHex(rawTx)}`;
  const txHash = await postJsonRpc<string>(rpcUrl, 'eth_sendRawTransaction', [rawTxHex]);
  const hashNormalized = String(txHash ?? '').trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(hashNormalized)) {
    throw new OnchainSendError('broadcast_failed', 'invalid tx hash response');
  }

  return {
    chain: input.chain,
    txHash: hashNormalized,
    nonce: Number(nonce),
    gasLimit: Number(gasLimit),
    gasPriceWei: eip1559Fees.maxFeePerGasWei.toString(),
    maxFeePerGasWei: eip1559Fees.maxFeePerGasWei.toString(),
    maxPriorityFeePerGasWei: eip1559Fees.maxPriorityFeePerGasWei.toString()
  };
};

type BtcUtxoRow = {
  txid: string;
  vout: number;
  value: number;
};

const resolveBtcFeePerVbyte = async () => {
  try {
    const payload = await fetchJson<{ halfHourFee?: number; hourFee?: number; fastestFee?: number }>(BTC_FEE_API);
    const candidate =
      parsePositiveInteger(payload?.halfHourFee) ?? parsePositiveInteger(payload?.hourFee) ?? parsePositiveInteger(payload?.fastestFee);
    if (!candidate) return DEFAULT_BTC_FEE_PER_VBYTE;
    return BigInt(candidate);
  } catch {
    return DEFAULT_BTC_FEE_PER_VBYTE;
  }
};

const sendBtc = async (input: OnchainSendInput): Promise<OnchainSendResult> => {
  if (input.asset !== 'NATIVE') {
    throw new OnchainSendError('unsupported_asset', 'BTC supports native transfer only');
  }

  const from = assertAddressForChain('BTC', input.fromAddress);
  const to = assertAddressForChain('BTC', input.toAddress);
  const amountSats = parseAmountToUnits(input.amountText, BTC_DECIMALS);
  if (amountSats <= 0n) {
    throw new OnchainSendError('invalid_amount', 'invalid BTC transfer amount');
  }

  const privateKey = deriveSecpPrivateKey('BTC', input.seedWords, input.accountIndex ?? 0, input.passphrase ?? '');
  const derivedAddress = deriveBtcAddressFromPrivateKey(privateKey);
  if (derivedAddress.toLowerCase() !== from.toLowerCase()) {
    throw new OnchainSendError('sender_mismatch', 'derived BTC address does not match sender address');
  }

  const utxoRows = await fetchJson<BtcUtxoRow[]>(`${BTC_ADDRESS_API}/${encodeURIComponent(from)}/utxo`);
  const usable = Array.isArray(utxoRows)
    ? utxoRows.filter((row) => typeof row.txid === 'string' && Number.isFinite(row.vout) && Number.isFinite(row.value) && row.value > 0)
    : [];
  if (!usable.length) {
    throw new OnchainSendError('insufficient_balance', 'no spendable BTC UTXO found');
  }

  const pubKey = pubECDSA(privateKey);
  const payment = btc.p2wpkh(pubKey);
  if (!payment.address || payment.address.toLowerCase() !== from.toLowerCase()) {
    throw new OnchainSendError('sender_mismatch', 'BTC input script does not match sender address');
  }

  const inputs = usable.map((utxo) => ({
    ...payment,
    txid: hexToBytes(utxo.txid),
    index: utxo.vout,
    witnessUtxo: {
      amount: BigInt(Math.floor(utxo.value)),
      script: payment.script
    }
  }));

  const selection = btc.selectUTXO(
    inputs,
    [{ address: to, amount: amountSats }],
    'default',
    {
      feePerByte: await resolveBtcFeePerVbyte(),
      changeAddress: from,
      createTx: true,
      network: btc.NETWORK,
      allowSameUtxo: false
    }
  );

  if (!selection?.tx) {
    throw new OnchainSendError('insufficient_balance', 'insufficient BTC balance including fee');
  }

  selection.tx.sign(privateKey);
  selection.tx.finalize();
  const rawHex = selection.tx.hex;
  if (!rawHex || !/^[0-9a-f]+$/i.test(rawHex)) {
    throw new OnchainSendError('broadcast_failed', 'failed to build signed BTC transaction');
  }

  const txHash = (await postPlainText(BTC_BROADCAST_API, rawHex)).trim();
  if (!/^[0-9a-fA-F]{64}$/.test(txHash)) {
    throw new OnchainSendError('broadcast_failed', 'invalid BTC tx hash response');
  }

  return {
    chain: 'BTC',
    txHash,
    asset: 'NATIVE'
  };
};

const sendXrp = async (input: OnchainSendInput): Promise<OnchainSendResult> => {
  if (input.asset !== 'NATIVE') {
    throw new OnchainSendError('unsupported_asset', 'XRP supports native transfer only');
  }

  const from = assertAddressForChain('XRP', input.fromAddress);
  const to = assertAddressForChain('XRP', input.toAddress);
  const amountDrops = parseAmountToUnits(input.amountText, XRP_DECIMALS);
  if (amountDrops <= 0n) {
    throw new OnchainSendError('invalid_amount', 'invalid XRP transfer amount');
  }

  const privateKey = deriveSecpPrivateKey('XRP', input.seedWords, input.accountIndex ?? 0, input.passphrase ?? '');
  const derivedAddress = deriveXrpAddressFromPrivateKey(privateKey);
  if (derivedAddress !== from) {
    throw new OnchainSendError('sender_mismatch', 'derived XRP address does not match sender address');
  }

  const accountInfo = await postJsonRpc<{
    account_data?: { Sequence?: number; sequence?: number };
    ledger_current_index?: number;
    validated_ledger?: { seq?: number };
  }>(XRP_RPC_URL, 'account_info', [{ account: from, ledger_index: 'current', strict: true }]);

  const sequence = Number(accountInfo?.account_data?.Sequence ?? accountInfo?.account_data?.sequence ?? NaN);
  if (!Number.isFinite(sequence) || sequence < 0) {
    throw new OnchainSendError('invalid_rpc_response', 'invalid XRP sequence');
  }

  const feeResponse = await postJsonRpc<{ drops?: { open_ledger_fee?: string }; validated_ledger?: { seq?: number } }>(
    XRP_RPC_URL,
    'fee',
    [{}]
  );
  const feeDrops = parsePositiveInteger(feeResponse?.drops?.open_ledger_fee) ?? 12;
  const validatedLedgerIndex = parsePositiveInteger(
    feeResponse?.validated_ledger?.seq ?? accountInfo?.validated_ledger?.seq ?? accountInfo?.ledger_current_index
  );
  if (!validatedLedgerIndex || validatedLedgerIndex <= 0) {
    throw new OnchainSendError('invalid_rpc_response', 'invalid XRP ledger index');
  }

  ensureSecpHashHooks();
  const signingPubKey = bytesToHex(secp.getPublicKey(privateKey, true)).toUpperCase();
  const tx = {
    TransactionType: 'Payment',
    Account: from,
    Destination: to,
    Amount: amountDrops.toString(),
    Fee: String(feeDrops),
    Sequence: Math.floor(sequence),
    Flags: XRP_FULLY_CANONICAL_SIG_FLAG,
    SigningPubKey: signingPubKey,
    LastLedgerSequence: validatedLedgerIndex + 20
  } as Record<string, unknown>;

  const signingBlob = encodeXrpForSigning(tx);
  const signature = signXrp(signingBlob, bytesToHex(privateKey));
  const txBlob = encodeXrpTx({
    ...tx,
    TxnSignature: signature
  });

  const submitResult = await postJsonRpc<{
    engine_result?: string;
    engine_result_message?: string;
    tx_json?: { hash?: string };
  }>(XRP_RPC_URL, 'submit', [{ tx_blob: txBlob }]);

  const engine = String(submitResult?.engine_result ?? '').trim();
  if (!engine.startsWith('tes')) {
    const message = String(submitResult?.engine_result_message ?? '').trim();
    throw new OnchainSendError('broadcast_failed', message || `xrp engine result: ${engine || 'unknown'}`);
  }

  const txHash = String(submitResult?.tx_json?.hash ?? '').trim();
  if (!/^[0-9A-Fa-f]{64}$/.test(txHash)) {
    throw new OnchainSendError('broadcast_failed', 'invalid XRP tx hash response');
  }

  return {
    chain: 'XRP',
    txHash,
    asset: 'NATIVE'
  };
};

const sendSol = async (input: OnchainSendInput): Promise<OnchainSendResult> => {
  if (input.asset !== 'NATIVE') {
    throw new OnchainSendError('unsupported_asset', 'SOL supports native transfer only');
  }

  const from = assertAddressForChain('SOL', input.fromAddress);
  const to = assertAddressForChain('SOL', input.toAddress);
  const amountLamports = parseAmountToUnits(input.amountText, SOL_DECIMALS);
  if (amountLamports <= 0n) {
    throw new OnchainSendError('invalid_amount', 'invalid SOL transfer amount');
  }

  if (amountLamports > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new OnchainSendError('invalid_amount', 'SOL amount is too large');
  }

  const derivedSeed = deriveSolSeed(input.seedWords, input.accountIndex ?? 0, input.passphrase ?? '');
  const senderKeypair = deriveSolKeypairFromSeed(derivedSeed);
  const derivedAddress = senderKeypair.publicKey.toBase58();
  if (derivedAddress !== from) {
    throw new OnchainSendError('sender_mismatch', 'derived SOL address does not match sender address');
  }

  const connection = new SolConnection(SOL_RPC_URL, 'confirmed');
  const latest = await connection.getLatestBlockhash('confirmed');

  const tx = new SolTransaction({
    feePayer: senderKeypair.publicKey,
    recentBlockhash: latest.blockhash
  }).add(
    SolSystemProgram.transfer({
      fromPubkey: senderKeypair.publicKey,
      toPubkey: new SolPublicKey(to),
      lamports: Number(amountLamports)
    })
  );

  tx.sign(senderKeypair);
  const raw = tx.serialize();
  const signature = await connection.sendRawTransaction(raw, {
    skipPreflight: false,
    maxRetries: 3
  });

  if (!signature || typeof signature !== 'string') {
    throw new OnchainSendError('broadcast_failed', 'invalid SOL signature response');
  }

  return {
    chain: 'SOL',
    txHash: signature,
    asset: 'NATIVE'
  };
};

const buildSolAtaAddress = (owner: SolPublicKey, mint: SolPublicKey) => {
  const [address] = SolPublicKey.findProgramAddressSync(
    [owner.toBuffer(), SOL_TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    SOL_ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return address;
};

const createSolAtaIx = (payer: SolPublicKey, associatedToken: SolPublicKey, owner: SolPublicKey, mint: SolPublicKey) => {
  return new SolTransactionInstruction({
    programId: SOL_ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: associatedToken, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SolSystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SOL_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }
    ],
    data: Buffer.from([1])
  });
};

const createSolTransferCheckedIx = (source: SolPublicKey, mint: SolPublicKey, destination: SolPublicKey, owner: SolPublicKey) => {
  const data = Buffer.alloc(10);
  data[0] = 12;
  data.writeBigUInt64LE(1n, 1);
  data[9] = 0;

  return new SolTransactionInstruction({
    programId: SOL_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false }
    ],
    data
  });
};

const parseParsedTokenAmount = (entry: unknown) => {
  if (!entry || typeof entry !== 'object') return 0n;
  const accountData = (entry as { account?: { data?: { parsed?: { info?: { tokenAmount?: { amount?: unknown } } } } } }).account?.data;
  const amountRaw = String(accountData?.parsed?.info?.tokenAmount?.amount ?? '0').trim();
  if (!/^\d+$/.test(amountRaw)) return 0n;
  try {
    return BigInt(amountRaw);
  } catch {
    return 0n;
  }
};

const sendSolNft = async (input: OnchainNftSendInput & { chain: 'SOL' }): Promise<OnchainNftSendResult> => {
  const from = assertAddressForChain('SOL', input.fromAddress);
  const to = assertAddressForChain('SOL', input.toAddress);
  const mintAddress = assertAddressForChain('SOL', input.contractAddress);

  const derivedSeed = deriveSolSeed(input.seedWords, input.accountIndex ?? 0, input.passphrase ?? '');
  const senderKeypair = deriveSolKeypairFromSeed(derivedSeed);
  const derivedAddress = senderKeypair.publicKey.toBase58();
  if (derivedAddress !== from) {
    throw new OnchainSendError('sender_mismatch', 'derived SOL address does not match sender address');
  }

  const connection = new SolConnection(SOL_RPC_URL, 'confirmed');
  const ownerKey = new SolPublicKey(from);
  const recipientKey = new SolPublicKey(to);
  const mintKey = new SolPublicKey(mintAddress);

  const sourceTokenAccounts = await connection.getParsedTokenAccountsByOwner(ownerKey, { mint: mintKey }, 'confirmed');
  const sourceEntry = sourceTokenAccounts.value.find((entry) => parseParsedTokenAmount(entry) > 0n);
  if (!sourceEntry) {
    throw new OnchainSendError('insufficient_balance', 'sender does not own this SOL NFT token');
  }

  const sourceTokenAccount = sourceEntry.pubkey;
  const destinationAta = buildSolAtaAddress(recipientKey, mintKey);
  const destinationInfo = await connection.getAccountInfo(destinationAta, 'confirmed');

  const tx = new SolTransaction();
  if (!destinationInfo) {
    tx.add(createSolAtaIx(senderKeypair.publicKey, destinationAta, recipientKey, mintKey));
  }
  tx.add(createSolTransferCheckedIx(sourceTokenAccount, mintKey, destinationAta, senderKeypair.publicKey));

  const latest = await connection.getLatestBlockhash('confirmed');
  tx.feePayer = senderKeypair.publicKey;
  tx.recentBlockhash = latest.blockhash;
  tx.sign(senderKeypair);

  const raw = tx.serialize();
  const signature = await connection.sendRawTransaction(raw, {
    skipPreflight: false,
    maxRetries: 3
  });

  if (!signature || typeof signature !== 'string') {
    throw new OnchainSendError('broadcast_failed', 'invalid SOL signature response');
  }

  return {
    chain: 'SOL',
    txHash: signature
  };
};

const sendTrx = async (input: OnchainSendInput): Promise<OnchainSendResult> => {
  const from = assertAddressForChain('TRX', input.fromAddress);
  const to = assertAddressForChain('TRX', input.toAddress);
  const privateKey = deriveSecpPrivateKey('TRX', input.seedWords, input.accountIndex ?? 0, input.passphrase ?? '');
  const privateKeyHex = bytesToHex(privateKey);

  const derivedAddress = deriveTrxAddressFromPrivateKey(privateKey);
  if (derivedAddress !== from) {
    throw new OnchainSendError('sender_mismatch', 'derived TRX address does not match sender address');
  }

  const tronWeb = new TronWeb({ fullHost: TRX_FULL_HOST });

  if (input.asset === 'NATIVE') {
    const amountSun = parseAmountToUnits(input.amountText, TRX_DECIMALS);
    if (amountSun <= 0n) {
      throw new OnchainSendError('invalid_amount', 'invalid TRX transfer amount');
    }
    if (amountSun > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new OnchainSendError('invalid_amount', 'TRX amount is too large');
    }

    const unsignedTx = await tronWeb.transactionBuilder.sendTrx(to, Number(amountSun), from);
    const signedTx = await tronWeb.trx.sign(unsignedTx, privateKeyHex);
    const broadcast = await tronWeb.trx.sendRawTransaction(signedTx);
    if (!broadcast?.result) {
      const message = String((broadcast as { message?: string }).message ?? 'TRX broadcast failed');
      throw new OnchainSendError('broadcast_failed', message);
    }

    const txHash = String((broadcast as { txid?: string }).txid ?? '').trim();
    if (!/^[0-9a-fA-F]{64}$/.test(txHash)) {
      throw new OnchainSendError('broadcast_failed', 'invalid TRX tx hash response');
    }

    return {
      chain: 'TRX',
      txHash,
      asset: 'NATIVE'
    };
  }

  if (input.asset !== 'USDT') {
    throw new OnchainSendError('unsupported_asset', 'unsupported TRX transfer asset');
  }

  const amountUnits = parseAmountToUnits(input.amountText, USDT_DECIMALS);
  if (amountUnits <= 0n) {
    throw new OnchainSendError('invalid_amount', 'invalid USDT(TRC20) transfer amount');
  }

  const feeLimit =
    Number.isFinite(input.manualGasLimit) && Number(input.manualGasLimit) > 0
      ? Math.floor(Number(input.manualGasLimit))
      : DEFAULT_TRX_USDT_FEE_LIMIT_SUN;

  const txWrap = await tronWeb.transactionBuilder.triggerSmartContract(
    USDT_TRC20_CONTRACT,
    'transfer(address,uint256)',
    {
      feeLimit,
      callValue: 0
    },
    [
      { type: 'address', value: to },
      { type: 'uint256', value: amountUnits.toString() }
    ],
    from
  );

  if (!txWrap?.result?.result || !txWrap.transaction) {
    throw new OnchainSendError('broadcast_failed', 'failed to build TRC20 transfer transaction');
  }

  const signedTx = await tronWeb.trx.sign(txWrap.transaction, privateKeyHex);
  const broadcast = await tronWeb.trx.sendRawTransaction(signedTx);
  if (!broadcast?.result) {
    const message = String((broadcast as { message?: string }).message ?? 'TRC20 broadcast failed');
    throw new OnchainSendError('broadcast_failed', message);
  }

  const txHash = String((broadcast as { txid?: string }).txid ?? '').trim();
  if (!/^[0-9a-fA-F]{64}$/.test(txHash)) {
    throw new OnchainSendError('broadcast_failed', 'invalid TRC20 tx hash response');
  }

  return {
    chain: 'TRX',
    txHash,
    asset: 'USDT'
  };
};

const normalizeTrxHexAddress = (raw: string) => {
  const normalized = raw.trim().replace(/^0x/i, '').toLowerCase();
  if (!/^[0-9a-f]+$/.test(normalized) || normalized.length < 40) return null;
  return `41${normalized.slice(-40)}`;
};

const sendTrxNft = async (input: OnchainNftSendInput & { chain: 'TRX' }): Promise<OnchainNftSendResult> => {
  const from = assertAddressForChain('TRX', input.fromAddress);
  const to = assertAddressForChain('TRX', input.toAddress);
  const contract = assertAddressForChain('TRX', input.contractAddress);
  const tokenId = parseUnsignedTokenId(input.tokenId);

  const privateKey = deriveSecpPrivateKey('TRX', input.seedWords, input.accountIndex ?? 0, input.passphrase ?? '');
  const privateKeyHex = bytesToHex(privateKey);
  const derivedAddress = deriveTrxAddressFromPrivateKey(privateKey);
  if (derivedAddress !== from) {
    throw new OnchainSendError('sender_mismatch', 'derived TRX address does not match sender address');
  }

  const tronWeb = new TronWeb({ fullHost: TRX_FULL_HOST });

  const ownerCall = await tronWeb.transactionBuilder.triggerConstantContract(
    contract,
    'ownerOf(uint256)',
    {},
    [{ type: 'uint256', value: tokenId.toString() }],
    from
  );
  const ownerRaw = Array.isArray((ownerCall as { constant_result?: string[] }).constant_result)
    ? (ownerCall as { constant_result: string[] }).constant_result[0]
    : '';
  const ownerHex = normalizeTrxHexAddress(ownerRaw ?? '');
  if (!ownerHex) {
    throw new OnchainSendError('invalid_rpc_response', 'invalid TRX ownerOf response');
  }
  const ownerAddress = TronWeb.address.fromHex(ownerHex);
  if (!ownerAddress || ownerAddress !== from) {
    throw new OnchainSendError('insufficient_balance', 'sender does not own this TRX NFT token');
  }

  const feeLimit =
    Number.isFinite(input.manualGasLimit) && Number(input.manualGasLimit) > 0
      ? Math.floor(Number(input.manualGasLimit))
      : DEFAULT_TRX_NFT_FEE_LIMIT_SUN;

  const txWrap = await tronWeb.transactionBuilder.triggerSmartContract(
    contract,
    'transferFrom(address,address,uint256)',
    {
      feeLimit,
      callValue: 0
    },
    [
      { type: 'address', value: from },
      { type: 'address', value: to },
      { type: 'uint256', value: tokenId.toString() }
    ],
    from
  );

  if (!txWrap?.result?.result || !txWrap.transaction) {
    throw new OnchainSendError('broadcast_failed', 'failed to build TRC721 transfer transaction');
  }

  const signedTx = await tronWeb.trx.sign(txWrap.transaction, privateKeyHex);
  const broadcast = await tronWeb.trx.sendRawTransaction(signedTx);
  if (!broadcast?.result) {
    const message = String((broadcast as { message?: string }).message ?? 'TRC721 broadcast failed');
    throw new OnchainSendError('broadcast_failed', message);
  }

  const txHash = String((broadcast as { txid?: string }).txid ?? '').trim();
  if (!/^[0-9a-fA-F]{64}$/.test(txHash)) {
    throw new OnchainSendError('broadcast_failed', 'invalid TRC721 tx hash response');
  }

  return {
    chain: 'TRX',
    txHash
  };
};

const sendFil = async (input: OnchainSendInput): Promise<OnchainSendResult> => {
  if (input.asset !== 'NATIVE') {
    throw new OnchainSendError('unsupported_asset', 'FIL supports native transfer only');
  }

  const from = assertAddressForChain('FIL', input.fromAddress).toLowerCase();
  const to = assertAddressForChain('FIL', input.toAddress).toLowerCase();
  if (!from.startsWith(FIL_MAINNET_SEC_PREFIX) || !to.startsWith(FIL_MAINNET_SEC_PREFIX)) {
    throw new OnchainSendError('invalid_recipient', 'invalid FIL mainnet address');
  }

  const valueAtto = parseAmountToUnits(input.amountText, FIL_DECIMALS);
  if (valueAtto <= 0n) {
    throw new OnchainSendError('invalid_amount', 'invalid FIL transfer amount');
  }

  const privateKey = deriveSecpPrivateKey('FIL', input.seedWords, input.accountIndex ?? 0, input.passphrase ?? '');
  const derivedAddress = deriveFilAddressFromPrivateKey(privateKey).toLowerCase();
  if (derivedAddress !== from) {
    throw new OnchainSendError('sender_mismatch', 'derived FIL address does not match sender address');
  }

  const nonceRaw = await postJsonRpc<number>(FIL_RPC_URL, 'Filecoin.MpoolGetNonce', [from]);
  const nonce = Number(nonceRaw);
  if (!Number.isFinite(nonce) || nonce < 0) {
    throw new OnchainSendError('invalid_rpc_response', 'invalid FIL nonce');
  }

  const baseMessage = {
    To: to,
    From: from,
    Nonce: Math.floor(nonce),
    Value: valueAtto.toString(),
    GasLimit: 0,
    GasFeeCap: '0',
    GasPremium: '0',
    Method: 0,
    Params: ''
  };

  const estimate = await postJsonRpc<{
    GasLimit?: number;
    GasFeeCap?: string;
    GasPremium?: string;
  }>(FIL_RPC_URL, 'Filecoin.GasEstimateMessageGas', [baseMessage, { MaxFee: '0' }, []]);

  const gasLimit = parsePositiveInteger(estimate?.GasLimit) ?? 0;
  const gasFeeCap = String(estimate?.GasFeeCap ?? '0');
  const gasPremium = String(estimate?.GasPremium ?? '0');

  if (gasLimit <= 0) {
    throw new OnchainSendError('invalid_rpc_response', 'invalid FIL gas estimate response');
  }
  parseUnsignedDecimalBigInt(gasFeeCap);
  parseUnsignedDecimalBigInt(gasPremium);

  const message = {
    ...baseMessage,
    GasLimit: gasLimit,
    GasFeeCap: gasFeeCap,
    GasPremium: gasPremium
  };

  const signed = signFilUnsignedMessage(message, privateKey);
  const pushResult = await postJsonRpc<{ '/': string }>(FIL_RPC_URL, 'Filecoin.MpoolPush', [
    {
      Message: message,
      Signature: signed
    }
  ]);

  const txHash = String(pushResult?.['/'] ?? '').trim();
  if (!txHash) {
    throw new OnchainSendError('broadcast_failed', 'invalid FIL message cid response');
  }

  return {
    chain: 'FIL',
    txHash,
    asset: 'NATIVE'
  };
};

const fetchOwnedEvmNft = async (
  chain: Extract<OnchainNftSendChain, 'ETH' | 'BSC'>,
  ownerAddress: string,
  contractAddress: string,
  tokenId: string
) => {
  if (!assertHexAddress(ownerAddress) || !assertHexAddress(contractAddress)) return 0;
  const token = parseUnsignedTokenId(tokenId);
  const ownerRaw = await postJsonRpc<string>(rpcUrlByChain(chain), 'eth_call', [
    {
      to: normalizeHexAddress(contractAddress),
      data: toErc721OwnerOfData(token)
    },
    'latest'
  ]);
  const resolvedOwner = parseEvmOwnerOfResult(ownerRaw);
  if (!resolvedOwner) return 0;
  return resolvedOwner === toLowerHexAddress(ownerAddress) ? 1 : 0;
};

const fetchOwnedSolNft = async (ownerAddress: string, mintAddress: string) => {
  if (!chainRegexMap.SOL.test(ownerAddress.trim()) || !chainRegexMap.SOL.test(mintAddress.trim())) return 0;
  const connection = new SolConnection(SOL_RPC_URL, 'confirmed');
  const owner = new SolPublicKey(ownerAddress);
  const mint = new SolPublicKey(mintAddress);
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, { mint }, 'confirmed');
  const total = tokenAccounts.value.reduce((sum, entry) => sum + parseParsedTokenAmount(entry), 0n);
  return total > 0n ? Number(total > 9999n ? 9999n : total) : 0;
};

const fetchOwnedTrxNft = async (ownerAddress: string, contractAddress: string, tokenId: string) => {
  if (!chainRegexMap.TRX.test(ownerAddress.trim()) || !chainRegexMap.TRX.test(contractAddress.trim())) return 0;
  const token = parseUnsignedTokenId(tokenId);
  const tronWeb = new TronWeb({ fullHost: TRX_FULL_HOST });
  const ownerCall = await tronWeb.transactionBuilder.triggerConstantContract(
    contractAddress,
    'ownerOf(uint256)',
    {},
    [{ type: 'uint256', value: token.toString() }],
    ownerAddress
  );
  const ownerRaw = Array.isArray((ownerCall as { constant_result?: string[] }).constant_result)
    ? (ownerCall as { constant_result: string[] }).constant_result[0]
    : '';
  const ownerHex = normalizeTrxHexAddress(ownerRaw ?? '');
  if (!ownerHex) return 0;
  const resolvedOwner = TronWeb.address.fromHex(ownerHex);
  return resolvedOwner && resolvedOwner === ownerAddress ? 1 : 0;
};

const runSafe = async <T>(task: () => Promise<T>, fallback: T) => {
  try {
    return await task();
  } catch {
    return fallback;
  }
};

export const fetchOnchainNftOwnership = async (params: {
  addressByChain: Record<OnchainNftSendChain, string>;
  targets: OnchainNftOwnershipTarget[];
}): Promise<OnchainNftOwnershipSnapshot> => {
  const ownedById: Record<string, number> = {};

  await Promise.all(
    params.targets.map(async (target) => {
      const ownerAddress = params.addressByChain[target.chain];
      if (!ownerAddress) {
        ownedById[target.id] = 0;
        return;
      }
      if (target.chain === 'ETH' || target.chain === 'BSC') {
        const evmChain = target.chain;
        ownedById[target.id] = await runSafe(
          () => fetchOwnedEvmNft(evmChain, ownerAddress, target.contractAddress, target.tokenId),
          0
        );
        return;
      }
      if (target.chain === 'SOL') {
        ownedById[target.id] = await runSafe(() => fetchOwnedSolNft(ownerAddress, target.contractAddress), 0);
        return;
      }
      if (target.chain === 'TRX') {
        ownedById[target.id] = await runSafe(
          () => fetchOwnedTrxNft(ownerAddress, target.contractAddress, target.tokenId),
          0
        );
        return;
      }
      ownedById[target.id] = 0;
    })
  );

  return {
    fetchedAt: new Date().toISOString(),
    ownedById
  };
};

export const sendOnchainNftTransaction = async (input: OnchainNftSendInput): Promise<OnchainNftSendResult> => {
  if (!['ETH', 'BSC', 'SOL', 'TRX'].includes(input.chain)) {
    throw new OnchainSendError('unsupported_chain', `unsupported NFT chain: ${String(input.chain)}`);
  }
  if (input.chain === 'ETH' || input.chain === 'BSC') {
    return sendEvmNft(input as OnchainNftSendInput & { chain: EvmSendChain });
  }
  if (input.chain === 'SOL') {
    return sendSolNft(input as OnchainNftSendInput & { chain: 'SOL' });
  }
  if (input.chain === 'TRX') {
    return sendTrxNft(input as OnchainNftSendInput & { chain: 'TRX' });
  }
  throw new OnchainSendError('unsupported_chain', `unsupported NFT chain: ${String(input.chain)}`);
};

const assertSupportedAssetByChain = (chain: OnchainSendChain, asset: OnchainSendAsset) => {
  if (asset === 'NATIVE') return;
  if (asset === 'USDT' && (chain === 'ETH' || chain === 'BSC' || chain === 'TRX')) return;
  throw new OnchainSendError('unsupported_asset', `asset ${asset} is not supported on ${chain}`);
};

export const sendOnchainTransaction = async (input: OnchainSendInput): Promise<OnchainSendResult> => {
  const chain = input.chain;
  if (!['BTC', 'ETH', 'XRP', 'BSC', 'SOL', 'TRX', 'FIL'].includes(chain)) {
    throw new OnchainSendError('unsupported_chain', `unsupported chain: ${String(chain)}`);
  }
  assertSupportedAssetByChain(chain, input.asset);

  if (chain === 'ETH' || chain === 'BSC') {
    return sendEvm(input as EvmOnchainSendInput);
  }
  if (chain === 'BTC') {
    return sendBtc(input);
  }
  if (chain === 'XRP') {
    return sendXrp(input);
  }
  if (chain === 'SOL') {
    return sendSol(input);
  }
  if (chain === 'TRX') {
    return sendTrx(input);
  }
  if (chain === 'FIL') {
    return sendFil(input);
  }

  throw new OnchainSendError('unsupported_chain', `unsupported chain: ${chain}`);
};

export const sendEvmOnchainTransaction = async (input: EvmOnchainSendInput): Promise<EvmOnchainSendResult> => {
  const result = await sendEvm(input);
  return result;
};
