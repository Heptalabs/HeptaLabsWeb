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

export const wallets: WalletAccount[] = [
  {
    id: 'wallet-main',
    name: '메인 지갑',
    address: '0xA6aB5D51c40F9A7b5D6B5A3D4D97fA6f2272A9c7',
    isPrimary: true,
    nameMode: 'auto',
    autoNameIndex: 0
  },
  {
    id: 'wallet-defi',
    name: '메인 지갑 1',
    address: '0x4f6F8C1Dc9A11b8e6B6fA4D2A955E2d31A34C2e9',
    isPrimary: false,
    nameMode: 'auto',
    autoNameIndex: 1
  },
  {
    id: 'wallet-cold',
    name: '메인 지갑 2',
    address: 'bc1q9mmywx2uz3m3qj2ejmkcv9f2u9q9y0vk8n2l56',
    isPrimary: false,
    nameMode: 'auto',
    autoNameIndex: 2
  }
];

export const initialTokens: TokenItem[] = [
  {
    id: 'btc',
    symbol: 'BTC',
    name: 'Bitcoin',
    network: 'Bitcoin',
    balance: 0.1582,
    priceUsd: 84500,
    change24h: 2.87,
    iconBg: '#f7931a',
    verified: true
  },
  {
    id: 'eth',
    symbol: 'ETH',
    name: 'Ethereum',
    network: 'Ethereum',
    balance: 1.92,
    priceUsd: 3550,
    change24h: -1.34,
    iconBg: '#627eea',
    verified: true
  },
  {
    id: 'bnb',
    symbol: 'BNB',
    name: 'BNB',
    network: 'BNB Smart Chain',
    balance: 14.8,
    priceUsd: 612,
    change24h: 1.96,
    iconBg: '#f3ba2f',
    verified: true
  },
  {
    id: 'sol',
    symbol: 'SOL',
    name: 'Solana',
    network: 'Solana',
    balance: 35.44,
    priceUsd: 178,
    change24h: 6.42,
    iconBg: '#8b5cf6',
    verified: true
  },
  {
    id: 'usdt',
    symbol: 'USDT',
    name: 'Tether USD',
    network: 'TRON (TRC-20)',
    balance: 1430,
    priceUsd: 1,
    change24h: 0.01,
    iconBg: '#26a17b',
    verified: true
  },
  {
    id: 'trx',
    symbol: 'TRX',
    name: 'TRON',
    network: 'TRON',
    balance: 2250.5,
    priceUsd: 0.14,
    change24h: 4.21,
    iconBg: '#ef4444',
    verified: true
  }
];

export const initialCollectibles: CollectibleItem[] = [
  {
    id: 'nft-1',
    name: 'Blue Ape #2041',
    collection: 'Blue Ape Society',
    network: 'Ethereum',
    tokenId: '2041',
    contractAddress: '0x8A2d5C0f42f95C6D9A8F9b450f1dbe7c2E39Fa17',
    imageUrl: 'https://picsum.photos/seed/imwallet-nft-1/420/420',
    owned: 1,
    floorPriceUsd: 2840,
    accent: '#4f46e5'
  },
  {
    id: 'nft-2',
    name: 'Sol Pixel #88',
    collection: 'Sol Pixel World',
    network: 'Solana',
    tokenId: '88',
    contractAddress: '9xn7z8W9j7x8HnQYqLh2A7m3x8L9Pn1sA1v2Qw5e',
    imageUrl: 'https://picsum.photos/seed/imwallet-nft-2/420/420',
    owned: 2,
    floorPriceUsd: 460,
    accent: '#0891b2'
  },
  {
    id: 'nft-3',
    name: 'BSC Dragon #319',
    collection: 'Dragon Guild',
    network: 'BNB Smart Chain',
    tokenId: '319',
    contractAddress: '0x93dCB8A1a84dB3A0A5f37b7f8E4517e0BfA2f912',
    imageUrl: 'https://picsum.photos/seed/imwallet-nft-3/420/420',
    owned: 1,
    floorPriceUsd: 190,
    accent: '#d97706'
  },
  {
    id: 'nft-4',
    name: 'Tron Relic #12',
    collection: 'Relic Vault',
    network: 'TRON',
    tokenId: '12',
    contractAddress: 'TVmP3mU93mN6x4eRjP7f8vK7sY6n4WQzJa',
    imageUrl: 'https://picsum.photos/seed/imwallet-nft-4/420/420',
    owned: 1,
    floorPriceUsd: 130,
    accent: '#ef4444'
  }
];

export const initialTransactions: TxItem[] = [
  {
    id: 'tx-2001',
    tokenSymbol: 'ETH',
    network: 'Ethereum',
    type: 'send',
    status: 'completed',
    amount: 0.12,
    usdValue: 426,
    counterparty: '0x7A6131A4A6Ddb1Ff52C8f2C6fF9a24336aD93cE2',
    createdAt: '2026-04-14 21:04'
  },
  {
    id: 'tx-2002',
    tokenSymbol: 'USDT',
    network: 'TRON',
    type: 'receive',
    status: 'completed',
    amount: 300,
    usdValue: 300,
    counterparty: 'TD53rVfBvCJpYvL6Q5fK9VJ4UFs9gx8SgA',
    createdAt: '2026-04-15 09:31'
  },
  {
    id: 'tx-2003',
    tokenSymbol: 'SOL',
    network: 'Solana',
    type: 'swap',
    status: 'pending',
    amount: 2.6,
    usdValue: 463,
    counterparty: 'Jupiter Router',
    createdAt: '2026-04-15 12:09'
  },
  {
    id: 'tx-2004',
    tokenSymbol: 'BTC',
    network: 'Bitcoin',
    type: 'buy',
    status: 'completed',
    amount: 0.01,
    usdValue: 845,
    counterparty: 'MoonPay',
    createdAt: '2026-04-15 14:22'
  }
];

export const discoverTokens: DiscoverToken[] = [
  {
    id: 'coin-btc',
    symbol: 'BTC',
    name: 'Bitcoin',
    priceUsd: 84500,
    change24h: 2.87,
    marketCapUsd: 1670000000000
  },
  {
    id: 'coin-eth',
    symbol: 'ETH',
    name: 'Ethereum',
    priceUsd: 3550,
    change24h: -1.34,
    marketCapUsd: 426000000000
  },
  {
    id: 'coin-sol',
    symbol: 'SOL',
    name: 'Solana',
    priceUsd: 178,
    change24h: 6.42,
    marketCapUsd: 82000000000
  },
  {
    id: 'coin-bnb',
    symbol: 'BNB',
    name: 'BNB',
    priceUsd: 612,
    change24h: 1.96,
    marketCapUsd: 94000000000
  }
];

export const dapps: DappItem[] = [
  {
    id: 'dapp-1',
    name: 'PancakeSwap',
    category: 'DeFi',
    description: 'Swap, LP, farm and earn in BNB Chain.',
    url: 'https://pancakeswap.finance',
    featured: true
  },
  {
    id: 'dapp-2',
    name: 'Uniswap',
    category: 'DeFi',
    description: 'Swap and provide liquidity on Ethereum.',
    url: 'https://app.uniswap.org',
    featured: true
  },
  {
    id: 'dapp-3',
    name: 'OpenSea',
    category: 'NFT',
    description: 'Explore, buy and sell NFTs.',
    url: 'https://opensea.io',
    featured: true
  },
  {
    id: 'dapp-4',
    name: 'Aave',
    category: 'Lending',
    description: 'Deposit and borrow assets.',
    url: 'https://app.aave.com',
    featured: false
  },
  {
    id: 'dapp-5',
    name: 'Lido',
    category: 'Staking',
    description: 'Liquid staking for major assets.',
    url: 'https://stake.lido.fi',
    featured: false
  },
  {
    id: 'dapp-6',
    name: 'Galxe',
    category: 'Community',
    description: 'Onchain quests and campaigns.',
    url: 'https://galxe.com',
    featured: false
  }
];

export const learnCards: LearnCard[] = [
  {
    id: 'learn-1',
    title: 'What Is Self-Custody?',
    summary: 'Control your private keys and wallet security basics.',
    tag: 'Security'
  },
  {
    id: 'learn-2',
    title: 'How Token Swaps Work',
    summary: 'Understand routing, slippage and network fee.',
    tag: 'DeFi'
  },
  {
    id: 'learn-3',
    title: 'Avoid Common Scams',
    summary: 'Check contract addresses and verify dApps before signing.',
    tag: 'Safety'
  }
];
