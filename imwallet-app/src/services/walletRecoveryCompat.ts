import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { HDKey } from '@scure/bip32';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { ripemd160 } from '@noble/hashes/legacy.js';
import { sha256 } from '@noble/hashes/sha2.js';
import * as secp from '@noble/secp256k1';
import { bech32 } from 'bech32';
import bs58check from 'bs58check';
import bs58 from 'bs58';
import { derivePath } from 'ed25519-hd-key';
import nacl from 'tweetnacl';
import { deriveAddress as deriveXrpAddress } from 'ripple-keypairs';
import { newSecp256k1Address } from '@glif/filecoin-address';

export type CompatChainCode = 'BTC' | 'ETH' | 'XRP' | 'BSC' | 'SOL' | 'TRX' | 'FIL';
export type RecoveryWordCount = 12 | 24;

export const TRUST_DERIVATION_PATH_BY_CHAIN: Record<CompatChainCode, string> = {
  BTC: "m/84'/0'/0'/0/{index}",
  ETH: "m/44'/60'/0'/0/{index}",
  XRP: "m/44'/144'/0'/0/{index}",
  BSC: "m/44'/60'/0'/0/{index}",
  SOL: "m/44'/501'/{index}'/0'",
  TRX: "m/44'/195'/0'/0/{index}",
  FIL: "m/44'/461'/0'/0/{index}"
};

const normalizeSeedWord = (raw: string) => raw.trim().toLowerCase().replace(/\s+/g, '');

const bytesToHex = (value: Uint8Array) => Array.from(value).map((byte) => byte.toString(16).padStart(2, '0')).join('');

const sliceLast = (value: Uint8Array, length: number) => value.slice(Math.max(0, value.length - length));

const toUint8 = (value: Uint8Array | Buffer): Uint8Array => new Uint8Array(value.buffer, value.byteOffset, value.byteLength);

const toPath = (template: string, index: number) => template.replaceAll('{index}', String(Math.max(0, Math.floor(index))));
const normalizePassphrase = (raw?: string) => (raw ?? '').normalize('NFKD');
const isSupportedRecoveryWordCount = (value: number): value is RecoveryWordCount => value === 12 || value === 24;

const toChecksumEvmAddress = (rawHexAddress: string) => {
  const normalized = rawHexAddress.trim().toLowerCase().replace(/^0x/i, '');
  if (!/^[0-9a-f]{40}$/.test(normalized)) return `0x${normalized}`;
  const hash = bytesToHex(keccak_256(new TextEncoder().encode(normalized)));
  const checksummed = normalized
    .split('')
    .map((char, idx) => (parseInt(hash[idx], 16) >= 8 ? char.toUpperCase() : char))
    .join('');
  return `0x${checksummed}`;
};

const deriveEvmAddressFromNode = (node: HDKey) => {
  if (!node.privateKey) throw new Error('missing private key for evm derivation');
  const uncompressed = secp.getPublicKey(toUint8(node.privateKey), false).slice(1);
  const hashed = keccak_256(uncompressed);
  return toChecksumEvmAddress(bytesToHex(sliceLast(hashed, 20)));
};

const deriveBtcAddressFromNode = (node: HDKey) => {
  if (!node.privateKey) throw new Error('missing private key for btc derivation');
  const compressed = secp.getPublicKey(toUint8(node.privateKey), true);
  const witnessProgram = ripemd160(sha256(compressed));
  return bech32.encode('bc', [0, ...bech32.toWords(witnessProgram)]);
};

const deriveTrxAddressFromNode = (node: HDKey) => {
  if (!node.privateKey) throw new Error('missing private key for trx derivation');
  const uncompressed = secp.getPublicKey(toUint8(node.privateKey), false).slice(1);
  const hashed = sliceLast(keccak_256(uncompressed), 20);
  const prefixed = new Uint8Array(21);
  prefixed[0] = 0x41;
  prefixed.set(hashed, 1);
  return bs58check.encode(prefixed);
};

const deriveXrpAddressFromNode = (node: HDKey) => {
  if (!node.privateKey) throw new Error('missing private key for xrp derivation');
  const compressed = secp.getPublicKey(toUint8(node.privateKey), true);
  return deriveXrpAddress(bytesToHex(compressed).toUpperCase());
};

const deriveSolAddressFromSeed = (seed: Uint8Array, index: number) => {
  const path = toPath(TRUST_DERIVATION_PATH_BY_CHAIN.SOL, index);
  const derived = derivePath(path, bytesToHex(toUint8(seed as Uint8Array | Buffer)));
  const keyPair = nacl.sign.keyPair.fromSeed(toUint8(derived.key as Uint8Array | Buffer));
  return bs58.encode(keyPair.publicKey);
};

const deriveFilAddressFromNode = (node: HDKey) => {
  if (!node.privateKey) throw new Error('missing private key for fil derivation');
  const extended = secp.getPublicKey(toUint8(node.privateKey), false);
  return newSecp256k1Address(extended).toString();
};

const deriveChainAddressFromSeed = (seed: Uint8Array, root: HDKey, chain: CompatChainCode, index: number) => {
  if (chain === 'SOL') return deriveSolAddressFromSeed(seed, index);
  const path = toPath(TRUST_DERIVATION_PATH_BY_CHAIN[chain], index);
  const node = root.derive(path);
  if (chain === 'ETH' || chain === 'BSC') return deriveEvmAddressFromNode(node);
  if (chain === 'BTC') return deriveBtcAddressFromNode(node);
  if (chain === 'TRX') return deriveTrxAddressFromNode(node);
  if (chain === 'XRP') return deriveXrpAddressFromNode(node);
  if (chain === 'FIL') return deriveFilAddressFromNode(node);
  throw new Error(`unsupported chain ${chain}`);
};

export const normalizeSeedWords = (words: string[]) => words.map((word) => normalizeSeedWord(word));

export const isValidRecoverySeedWords = (words: string[]) => {
  const normalized = normalizeSeedWords(words);
  if (!isSupportedRecoveryWordCount(normalized.length) || normalized.some((word) => !word)) return false;
  return validateMnemonic(normalized.join(' '), wordlist);
};

export const generateRecoverySeedWords = (wordCount: RecoveryWordCount = 12) =>
  generateMnemonic(wordlist, wordCount === 24 ? 256 : 128)
    .split(' ')
    .map((word) => normalizeSeedWord(word));

export const deriveTrustCompatibleChainAddresses = (
  words: string[],
  accountIndex = 0,
  passphrase = ''
): Record<CompatChainCode, string> => {
  const normalized = normalizeSeedWords(words);
  if (!isValidRecoverySeedWords(normalized)) {
    throw new Error('invalid BIP39 recovery words');
  }
  const mnemonic = normalized.join(' ');
  const seed = mnemonicToSeedSync(mnemonic, normalizePassphrase(passphrase));
  const root = HDKey.fromMasterSeed(seed);
  const index = Math.max(0, Math.floor(accountIndex));

  return {
    BTC: deriveChainAddressFromSeed(seed, root, 'BTC', index),
    ETH: deriveChainAddressFromSeed(seed, root, 'ETH', index),
    XRP: deriveChainAddressFromSeed(seed, root, 'XRP', index),
    BSC: deriveChainAddressFromSeed(seed, root, 'BSC', index),
    SOL: deriveChainAddressFromSeed(seed, root, 'SOL', index),
    TRX: deriveChainAddressFromSeed(seed, root, 'TRX', index),
    FIL: deriveChainAddressFromSeed(seed, root, 'FIL', index)
  };
};

export const deriveTrustCompatiblePrimaryAddress = (words: string[], accountIndex = 0, passphrase = '') =>
  deriveTrustCompatibleChainAddresses(words, accountIndex, passphrase).ETH;

export const DEFAULT_COMPAT_SEEDS: string[][] = [
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'.split(' '),
  'legal winner thank year wave sausage worth useful legal winner thank yellow'.split(' '),
  'letter advice cage absurd amount doctor acoustic avoid letter advice cage above'.split(' ')
];
