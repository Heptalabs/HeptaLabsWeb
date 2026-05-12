import { getAddress as toChecksumEvmAddress } from 'ethers';
import bs58check from 'bs58check';
import { bech32 } from 'bech32';
import { PublicKey as SolPublicKey } from '@solana/web3.js';
import { isValidClassicAddress as isValidXrpClassicAddress } from 'ripple-address-codec';
import { validateAddressString as isValidFilecoinAddressString } from '@glif/filecoin-address';
import { ChainCode } from '../domain/wallet-domain';

export type AddressValidationCode = 'invalid_format' | 'chain_mismatch';

export type AddressValidationResult =
  | { ok: true; normalized: string }
  | { ok: false; code: AddressValidationCode };

const isValidEvmAddress = (address: string) => {
  try {
    return Boolean(toChecksumEvmAddress(address));
  } catch {
    return false;
  }
};

const isValidTronAddress = (address: string) => {
  try {
    const decoded = bs58check.decode(address);
    return decoded.length === 21 && decoded[0] === 0x41;
  } catch {
    return false;
  }
};

const isValidBitcoinAddress = (address: string) => {
  const trimmed = String(address || '').trim();
  if (!trimmed) return false;

  if (/^(bc1|tb1)/i.test(trimmed)) {
    try {
      const decoded = bech32.decode(trimmed, 1500);
      const hasValidPrefix = decoded.prefix === 'bc' || decoded.prefix === 'tb';
      return hasValidPrefix && Array.isArray(decoded.words) && decoded.words.length > 1;
    } catch {
      return false;
    }
  }

  if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(trimmed)) {
    try {
      const decoded = bs58check.decode(trimmed);
      return decoded.length >= 21 && decoded.length <= 34;
    } catch {
      return false;
    }
  }

  return false;
};

const isValidSolanaAddress = (address: string) => {
  try {
    const pubkey = new SolPublicKey(address);
    return pubkey.toBase58() === address;
  } catch {
    return false;
  }
};

const isValidXrpAddress = (address: string) => {
  try {
    return isValidXrpClassicAddress(address);
  } catch {
    return false;
  }
};

const isValidFilAddress = (address: string) => {
  try {
    return isValidFilecoinAddressString(address);
  } catch {
    return false;
  }
};

const validateByChain = (chain: ChainCode, address: string) => {
  if (chain === 'BTC') return isValidBitcoinAddress(address);
  if (chain === 'ETH' || chain === 'BSC') return isValidEvmAddress(address);
  if (chain === 'XRP') return isValidXrpAddress(address);
  if (chain === 'SOL') return isValidSolanaAddress(address);
  if (chain === 'TRX') return isValidTronAddress(address);
  if (chain === 'FIL') return isValidFilAddress(address);
  return false;
};

export const normalizeAddress = (chain: ChainCode, address: string) => {
  const trimmed = address.trim();
  if (chain === 'ETH' || chain === 'BSC') {
    try {
      return toChecksumEvmAddress(trimmed);
    } catch {
      return trimmed;
    }
  }
  return trimmed;
};

export const detectAddressChains = (address: string): ChainCode[] => {
  const trimmed = address.trim();
  if (!trimmed) return [];
  const chains: ChainCode[] = ['BTC', 'ETH', 'XRP', 'BSC', 'SOL', 'TRX', 'FIL'];
  return chains.filter((chain) => validateByChain(chain, trimmed));
};

export const validateAddressForChain = (chain: ChainCode, rawAddress: string): AddressValidationResult => {
  const address = rawAddress.trim();
  if (!address) return { ok: false, code: 'invalid_format' };

  if (validateByChain(chain, address)) {
    return { ok: true, normalized: normalizeAddress(chain, address) };
  }

  const matchedChains = detectAddressChains(address);
  if (matchedChains.length) {
    if (chain === 'ETH' || chain === 'BSC') {
      const isOtherEvmChain = matchedChains.some((matched) => matched === 'ETH' || matched === 'BSC');
      if (isOtherEvmChain) {
        return { ok: false, code: 'chain_mismatch' };
      }
    } else {
      return { ok: false, code: 'chain_mismatch' };
    }
  }

  return { ok: false, code: 'invalid_format' };
};
