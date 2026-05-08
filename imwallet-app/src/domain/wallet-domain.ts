export type AssetKey = 'BTC' | 'ETH' | 'XRP' | 'BNB' | 'SOL' | 'TRX' | 'FIL' | 'USDT';
export type ChainCode = 'BTC' | 'ETH' | 'XRP' | 'BSC' | 'SOL' | 'TRX' | 'FIL';

export const chainLabelMap: Record<ChainCode, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  XRP: 'XRP Ledger',
  BSC: 'BNB Smart Chain',
  SOL: 'Solana',
  TRX: 'TRON',
  FIL: 'Filecoin'
};

export const chainTickerMap: Record<ChainCode, string> = {
  BTC: 'BTC',
  ETH: 'ETH',
  XRP: 'XRP',
  BSC: 'BNB',
  SOL: 'SOL',
  TRX: 'TRX',
  FIL: 'FIL'
};

export const chainNativeAssetMap: Record<ChainCode, AssetKey> = {
  BTC: 'BTC',
  ETH: 'ETH',
  XRP: 'XRP',
  BSC: 'BNB',
  SOL: 'SOL',
  TRX: 'TRX',
  FIL: 'FIL'
};

export const chainOrder: ChainCode[] = ['BTC', 'ETH', 'XRP', 'BSC', 'SOL', 'TRX', 'FIL'];

export const chainRegexMap: Record<ChainCode, RegExp> = {
  BTC: /^(bc1[a-z0-9]{25,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/,
  ETH: /^0x[a-fA-F0-9]{40}$/,
  XRP: /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/,
  BSC: /^0x[a-fA-F0-9]{40}$/,
  SOL: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  TRX: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
  FIL: /^f[1-4][a-z0-9]{20,120}$/
};

const withLastCharVariants = (base: string, suffixes: string[]) =>
  suffixes.map((suffix, idx) => (idx === 0 ? base : `${base.slice(0, -1)}${suffix}`));

export const chainDemoAddressPool: Record<ChainCode, string[]> = {
  BTC: withLastCharVariants('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', ['h', 'j', 'k', 'm', 'n', 'p', 'q', 'r', 's', 't']),
  ETH: withLastCharVariants('0x7A6131A4A6Ddb1Ff52C8f2C6fF9a24336aD93cE2', ['2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b']),
  XRP: withLastCharVariants('rG1QQv2nh2gr7RCZ1P8YYcBUKCCN633jCn', ['n', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x']),
  BSC: withLastCharVariants('0x55d398326f99059fF775485246999027B3197955', ['5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e']),
  SOL: withLastCharVariants('9wFFmGZkYh9M7m1Ak5s9Y9ycYzaPt6F6DRKCVhcdtrEN', ['N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X']),
  TRX: withLastCharVariants('TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE', ['E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P']),
  FIL: withLastCharVariants('f1w76m6jlr6cyqp4f6m2zhv7h6m5a9d8e0r2x5f2q', ['q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'])
};

export const chainWalletAddresses: Record<ChainCode, string> = {
  BTC: 'bc1q9mmywx2uz3m3qj2ejmkcv9f2u9q9y0vk8n2l56',
  ETH: '0xA6aB5D51c40F9A7b5D6B5A3D4D97fA6f2272A9c7',
  XRP: 'rL6f4e6Vf6fK8g4oKf31n4BrkQ2YbEm3B9',
  BSC: '0x4f6F8C1Dc9A11b8e6B6fA4D2A955E2d31A34C2e9',
  SOL: '7w2fFr8h2Qq7x5yVfZ2AnHf6JdVQzwJfYf4p3W3J1Y3b',
  TRX: 'TD53rVfBvCJpYvL6Q5fK9VJ4UFs9gx8SgA',
  FIL: 'f1nkb3w2x7cp2q9z0h6gr0a9m3y8t5z2h8f3t8xya'
};

export const defaultEnabledTokenIds = ['btc', 'eth', 'xrp', 'bnb', 'sol', 'trx', 'fil', 'usdt-erc', 'usdt-trc', 'usdt-bsc'];
