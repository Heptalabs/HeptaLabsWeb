export type QueueStatus = 'pending' | 'manual-review' | 'approved' | 'blocked';
export type WalletFlow = 'send' | 'receive' | 'buy' | 'swap' | 'browser';

export type AdminAsset = {
  symbol: string;
  network: string;
  holders: number;
  walletBalance: number;
  usdExposure: number;
  change24h: number;
  risk: 'low' | 'medium' | 'high';
};

export type QueueItem = {
  id: string;
  user: string;
  tier: 'Basic' | 'Pro' | 'VIP';
  flow: WalletFlow;
  asset: string;
  amount: number;
  usdValue: number;
  network: string;
  status: QueueStatus;
  riskScore: number;
  createdAt: string;
};

export type UserRow = {
  id: string;
  name: string;
  tier: 'Basic' | 'Pro' | 'VIP';
  walletUsd: number;
  lastActive: string;
  kyc: 'verified' | 'pending' | 'restricted';
  sendLimitUsd: number;
};

export type ChainHealth = {
  chain: string;
  rpcHealth: number;
  avgConfirmSec: number;
  queueDepth: number;
  hotWalletRatio: number;
};

export const adminAssets: AdminAsset[] = [
  {
    symbol: 'BTC',
    network: 'Bitcoin',
    holders: 842,
    walletBalance: 42.8,
    usdExposure: 3616600,
    change24h: 2.87,
    risk: 'low'
  },
  {
    symbol: 'ETH',
    network: 'Ethereum',
    holders: 1236,
    walletBalance: 894.2,
    usdExposure: 3174410,
    change24h: -1.34,
    risk: 'medium'
  },
  {
    symbol: 'USDT',
    network: 'TRON + ERC20',
    holders: 2943,
    walletBalance: 1822400,
    usdExposure: 1822400,
    change24h: 0.01,
    risk: 'low'
  },
  {
    symbol: 'SOL',
    network: 'Solana',
    holders: 766,
    walletBalance: 9520,
    usdExposure: 1694560,
    change24h: 6.42,
    risk: 'medium'
  },
  {
    symbol: 'FIL',
    network: 'Filecoin',
    holders: 182,
    walletBalance: 112000,
    usdExposure: 649600,
    change24h: -3.09,
    risk: 'high'
  }
];

export const queueItems: QueueItem[] = [
  {
    id: 'Q-2104',
    user: 'Minji Kim',
    tier: 'VIP',
    flow: 'send',
    asset: 'BTC',
    amount: 0.43,
    usdValue: 36335,
    network: 'Bitcoin',
    status: 'manual-review',
    riskScore: 78,
    createdAt: '2026-04-15 18:22'
  },
  {
    id: 'Q-2105',
    user: 'Yunho Park',
    tier: 'Pro',
    flow: 'receive',
    asset: 'USDT',
    amount: 25000,
    usdValue: 25000,
    network: 'TRON',
    status: 'pending',
    riskScore: 41,
    createdAt: '2026-04-15 18:34'
  },
  {
    id: 'Q-2106',
    user: 'Jisoo Lee',
    tier: 'Basic',
    flow: 'buy',
    asset: 'ETH',
    amount: 2.8,
    usdValue: 9940,
    network: 'Ethereum',
    status: 'approved',
    riskScore: 22,
    createdAt: '2026-04-15 18:45'
  },
  {
    id: 'Q-2107',
    user: 'Seung Woo',
    tier: 'Basic',
    flow: 'swap',
    asset: 'FIL',
    amount: 1200,
    usdValue: 6960,
    network: 'Filecoin',
    status: 'blocked',
    riskScore: 89,
    createdAt: '2026-04-15 18:49'
  },
  {
    id: 'Q-2108',
    user: 'Jiyoung Choi',
    tier: 'Pro',
    flow: 'browser',
    asset: 'SOL',
    amount: 45,
    usdValue: 8010,
    network: 'Solana',
    status: 'pending',
    riskScore: 33,
    createdAt: '2026-04-15 19:03'
  }
];

export const userRows: UserRow[] = [
  {
    id: 'U-1187',
    name: 'Minji Kim',
    tier: 'VIP',
    walletUsd: 581000,
    lastActive: '2 min ago',
    kyc: 'verified',
    sendLimitUsd: 250000
  },
  {
    id: 'U-1188',
    name: 'Yunho Park',
    tier: 'Pro',
    walletUsd: 92040,
    lastActive: '7 min ago',
    kyc: 'verified',
    sendLimitUsd: 50000
  },
  {
    id: 'U-1189',
    name: 'Jisoo Lee',
    tier: 'Basic',
    walletUsd: 12670,
    lastActive: '15 min ago',
    kyc: 'pending',
    sendLimitUsd: 10000
  },
  {
    id: 'U-1190',
    name: 'Seung Woo',
    tier: 'Basic',
    walletUsd: 9540,
    lastActive: '32 min ago',
    kyc: 'restricted',
    sendLimitUsd: 5000
  }
];

export const chainHealthRows: ChainHealth[] = [
  {
    chain: 'Bitcoin',
    rpcHealth: 99,
    avgConfirmSec: 620,
    queueDepth: 6,
    hotWalletRatio: 48
  },
  {
    chain: 'Ethereum',
    rpcHealth: 96,
    avgConfirmSec: 34,
    queueDepth: 19,
    hotWalletRatio: 52
  },
  {
    chain: 'TRON',
    rpcHealth: 98,
    avgConfirmSec: 18,
    queueDepth: 13,
    hotWalletRatio: 44
  },
  {
    chain: 'Solana',
    rpcHealth: 94,
    avgConfirmSec: 4,
    queueDepth: 9,
    hotWalletRatio: 57
  },
  {
    chain: 'Filecoin',
    rpcHealth: 91,
    avgConfirmSec: 47,
    queueDepth: 4,
    hotWalletRatio: 39
  }
];
