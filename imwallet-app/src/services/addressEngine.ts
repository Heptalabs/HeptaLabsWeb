import { ChainCode, chainRegexMap } from '../domain/wallet-domain';

export type AddressValidationCode = 'invalid_format' | 'chain_mismatch';

export type AddressValidationResult =
  | { ok: true; normalized: string }
  | { ok: false; code: AddressValidationCode };

export const normalizeAddress = (chain: ChainCode, address: string) => {
  if (chain === 'ETH' || chain === 'BSC' || chain === 'FIL') return address.toLowerCase();
  return address;
};

export const detectAddressChains = (address: string): ChainCode[] => {
  const trimmed = address.trim();
  return (Object.keys(chainRegexMap) as ChainCode[]).filter((chain) => chainRegexMap[chain].test(trimmed));
};

export const validateAddressForChain = (chain: ChainCode, rawAddress: string): AddressValidationResult => {
  const address = rawAddress.trim();
  const matchedChains = detectAddressChains(address);
  if (!matchedChains.length) {
    return { ok: false, code: 'invalid_format' };
  }

  if (chain !== 'ETH' && chain !== 'BSC') {
    if (!matchedChains.includes(chain)) {
      return { ok: false, code: 'chain_mismatch' };
    }
    return { ok: true, normalized: normalizeAddress(chain, address) };
  }

  if (!chainRegexMap[chain].test(address)) {
    return { ok: false, code: 'invalid_format' };
  }

  return { ok: true, normalized: normalizeAddress(chain, address) };
};
