export type WalletAccount = {
  id: string;
  name: string;
  address: string;
  isPrimary: boolean;
  nameMode?: 'auto' | 'custom';
  autoNameIndex?: number;
};

export type TokenItem = {
  id: string;
  symbol: string;
  name: string;
  network: string;
  balance: number;
  priceUsd: number;
  change24h: number;
  iconBg: string;
  verified: boolean;
};

export type CollectibleItem = {
  id: string;
  name: string;
  collection: string;
  network: string;
  tokenId: string;
  contractAddress: string;
  imageUrl: string;
  owned: number;
  floorPriceUsd: number;
  accent: string;
};

export type TxType = 'send' | 'receive' | 'swap' | 'buy' | 'sell';

export type TxItem = {
  id: string;
  tokenSymbol: string;
  network: string;
  type: TxType;
  status: 'completed' | 'pending' | 'failed';
  amount: number;
  usdValue: number;
  counterparty: string;
  createdAt: string;
  chain?: string;
  memo?: string;
};

export type DiscoverToken = {
  id: string;
  symbol: string;
  name: string;
  priceUsd: number;
  change24h: number;
  marketCapUsd: number;
};

export type DappItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  url: string;
  featured: boolean;
};

export type LearnCard = {
  id: string;
  title: string;
  summary: string;
  tag: string;
};

export const wallets: WalletAccount[] = [];

export const initialTokens: TokenItem[] = [];

export const initialCollectibles: CollectibleItem[] = [];

export const initialTransactions: TxItem[] = [];

export const discoverTokens: DiscoverToken[] = [];

export const dapps: DappItem[] = [];

export const learnCards: LearnCard[] = [];
