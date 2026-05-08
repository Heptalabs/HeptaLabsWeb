import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';
const webEphemeralStore = new Map<string, string>();

export const getSecureJson = async <T>(key: string): Promise<T | null> => {
  try {
    if (isWeb) {
      const raw = webEphemeralStore.get(key) ?? null;
      return raw ? (JSON.parse(raw) as T) : null;
    }

    const raw = await SecureStore.getItemAsync(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

export const setSecureJson = async (key: string, value: unknown): Promise<void> => {
  const raw = JSON.stringify(value);
  if (isWeb) {
    webEphemeralStore.set(key, raw);
    return;
  }

  await SecureStore.setItemAsync(key, raw, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  });
};
