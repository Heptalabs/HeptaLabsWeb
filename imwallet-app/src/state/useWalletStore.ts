import { useEffect, useMemo, useState } from 'react';
import { WalletAccount } from '../data/appCatalog';
import { getSecureJson, setSecureJson } from '../services/secureStore';

const WALLET_STORE_KEY = 'imwallet.store.wallets.v1';

type PersistedWalletStore = {
  wallets: WalletAccount[];
  selectedWalletId: string;
};

const LEGACY_DEMO_WALLET_IDS = new Set(['wallet-main', 'wallet-defi', 'wallet-cold']);

const isLegacyDemoWalletStore = (wallets: WalletAccount[]) => {
  const expectedIds = [...LEGACY_DEMO_WALLET_IDS];
  if (wallets.length !== expectedIds.length) return false;

  return wallets.every((wallet) => LEGACY_DEMO_WALLET_IDS.has(wallet.id));
};

export const useWalletStore = (initialWallets: WalletAccount[]) => {
  const [walletAccounts, setWalletAccounts] = useState<WalletAccount[]>(initialWallets);
  const [walletId, setWalletId] = useState(initialWallets[0]?.id ?? '');
  const [walletStoreHydrated, setWalletStoreHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const saved = await getSecureJson<PersistedWalletStore>(WALLET_STORE_KEY);
      if (!mounted || !saved?.wallets?.length) {
        setWalletStoreHydrated(true);
        return;
      }

      if (isLegacyDemoWalletStore(saved.wallets)) {
        // One-time cleanup: remove legacy placeholder wallets from persisted store.
        setWalletAccounts([]);
        setWalletId('');
        setWalletStoreHydrated(true);
        setSecureJson(WALLET_STORE_KEY, {
          wallets: [],
          selectedWalletId: ''
        }).catch(() => undefined);
        return;
      }

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
    walletStoreHydrated
  };
};
