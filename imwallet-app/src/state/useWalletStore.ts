import { useEffect, useMemo, useState } from 'react';
import { WalletAccount } from '../data/mockWallet';
import { getSecureJson, setSecureJson } from '../services/secureStore';

const WALLET_STORE_KEY = 'imwallet.store.wallets.v1';

type PersistedWalletStore = {
  wallets: WalletAccount[];
  selectedWalletId: string;
};

const LEGACY_DEMO_WALLET_SIGNATURE: Record<
  string,
  { address: string; isPrimary: boolean; autoNameIndex: number | null }
> = {
  'wallet-main': {
    address: '0xA6aB5D51c40F9A7b5D6B5A3D4D97fA6f2272A9c7',
    isPrimary: true,
    autoNameIndex: 0
  },
  'wallet-defi': {
    address: '0x4f6F8C1Dc9A11b8e6B6fA4D2A955E2d31A34C2e9',
    isPrimary: false,
    autoNameIndex: 1
  },
  'wallet-cold': {
    address: 'bc1q9mmywx2uz3m3qj2ejmkcv9f2u9q9y0vk8n2l56',
    isPrimary: false,
    autoNameIndex: 2
  }
};

const isLegacyDemoWalletStore = (wallets: WalletAccount[]) => {
  const expectedIds = Object.keys(LEGACY_DEMO_WALLET_SIGNATURE);
  if (wallets.length !== expectedIds.length) return false;

  return wallets.every((wallet) => {
    const expected = LEGACY_DEMO_WALLET_SIGNATURE[wallet.id];
    if (!expected) return false;
    return (
      wallet.address.trim().toLowerCase() === expected.address.toLowerCase() &&
      wallet.isPrimary === expected.isPrimary &&
      (wallet.autoNameIndex ?? null) === expected.autoNameIndex
    );
  });
};

export const useWalletStore = (initialWallets: WalletAccount[]) => {
  const [walletAccounts, setWalletAccounts] = useState<WalletAccount[]>(initialWallets);
  const [walletId, setWalletId] = useState(initialWallets[0]?.id ?? '');
  const [walletStoreHydrated, setWalletStoreHydrated] = useState(false);
  const [walletStoreUsesSeedData, setWalletStoreUsesSeedData] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const saved = await getSecureJson<PersistedWalletStore>(WALLET_STORE_KEY);
      if (!mounted || !saved?.wallets?.length) {
        setWalletStoreUsesSeedData(false);
        setWalletStoreHydrated(true);
        return;
      }

      if (isLegacyDemoWalletStore(saved.wallets)) {
        // Rehearsal rollout migration: remove legacy demo wallets from persisted store.
        setWalletAccounts([]);
        setWalletId('');
        setWalletStoreUsesSeedData(false);
        setWalletStoreHydrated(true);
        setSecureJson(WALLET_STORE_KEY, {
          wallets: [],
          selectedWalletId: ''
        }).catch(() => undefined);
        return;
      }

      setWalletStoreUsesSeedData(false);
      setWalletAccounts(saved.wallets);
      setWalletId(saved.selectedWalletId || saved.wallets[0].id);
      setWalletStoreHydrated(true);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!walletStoreHydrated || !walletAccounts.length || !walletId) return;
    setSecureJson(WALLET_STORE_KEY, {
      wallets: walletAccounts,
      selectedWalletId: walletId
    }).catch(() => undefined);
  }, [walletAccounts, walletId, walletStoreHydrated]);

  const activeWallet = useMemo(
    () => walletAccounts.find((item) => item.id === walletId) ?? walletAccounts[0] ?? initialWallets[0],
    [walletAccounts, walletId, initialWallets]
  );

  return {
    walletAccounts,
    setWalletAccounts,
    walletId,
    setWalletId,
    activeWallet,
    walletStoreHydrated,
    walletStoreUsesSeedData
  };
};
