import { useEffect, useState } from 'react';
import { getSecureJson, setSecureJson } from '../services/secureStore';

const ASSET_STORE_KEY = 'imwallet.store.enabled-assets.v1';

type PersistedAssetStore = {
  enabledTokenIds: string[];
};

export const useAssetToggleStore = (defaultEnabledTokenIds: string[]) => {
  const [enabledTokenIds, setEnabledTokenIds] = useState<string[]>(defaultEnabledTokenIds);
  const [assetStoreHydrated, setAssetStoreHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const saved = await getSecureJson<PersistedAssetStore>(ASSET_STORE_KEY);
      if (mounted && saved?.enabledTokenIds?.length) {
        setEnabledTokenIds(saved.enabledTokenIds);
      }
      if (mounted) setAssetStoreHydrated(true);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!assetStoreHydrated || !enabledTokenIds.length) return;
    setSecureJson(ASSET_STORE_KEY, { enabledTokenIds }).catch(() => undefined);
  }, [enabledTokenIds, assetStoreHydrated]);

  const toggleEnabledToken = (tokenId: string) => {
    let blocked = false;

    setEnabledTokenIds((prev) => {
      if (prev.includes(tokenId)) {
        if (prev.length <= 1) {
          blocked = true;
          return prev;
        }
        return prev.filter((id) => id !== tokenId);
      }

      return [...prev, tokenId];
    });

    return { blocked };
  };

  return {
    enabledTokenIds,
    setEnabledTokenIds,
    toggleEnabledToken,
    assetStoreHydrated
  };
};
