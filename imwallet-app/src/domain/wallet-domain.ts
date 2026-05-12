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

export const chainWalletAddresses: Record<ChainCode, string> = {
  BTC: '',
  ETH: '',
  XRP: '',
  BSC: '',
  SOL: '',
  TRX: '',
  FIL: ''
};

export const defaultEnabledTokenIds = ['btc', 'eth', 'xrp', 'bnb', 'sol', 'trx', 'fil', 'usdt-erc', 'usdt-trc', 'usdt-bsc'];
