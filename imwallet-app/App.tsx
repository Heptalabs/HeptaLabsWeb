import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import React, { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './src/polyfills/runtime';
import {
  AppState,
  Animated,
  BackHandler,
  useWindowDimensions,
  Easing,
  Image,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Linking,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import type { AppStateStatus, ImageSourcePropType, KeyboardEvent } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';
import { Camera, CameraView, type BarcodeScanningResult, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import {
  CollectibleItem,
  initialCollectibles,
  TokenItem,
  TxItem,
  WalletAccount
} from './src/data/appCatalog';
import { validateAddressForChain as validateAddressWithEngine } from './src/services/addressEngine';
import { buildSendDraftFromInput, parseAmountInput, validateSendAmount } from './src/services/sendFlowEngine';
import { DEFAULT_MARKET_SYMBOLS, fetchMarketPriceMap, type MarketPriceMap } from './src/services/marketPrice';
import { fetchPopularTokensByVolume, type PopularTokenItem } from './src/services/marketPopular';
import {
  fetchPopularDappsByCategory,
  fetchPopularDappsRanking,
  popularDappFilterKeys,
  type PopularDappCategoryBuckets,
  type PopularDappItem
} from './src/services/marketPopularDapps';
import { fetchTokenIconsBySymbols } from './src/services/marketTokenIcons';
import { fetchFxRates } from './src/services/fxRates';
import { fetchMarketAssetInfoMap, type MarketAssetInfoMap } from './src/services/marketAssetInfo';
import { fetchMarketHolderCount } from './src/services/marketHolders';
import { fetchLiveNetworkFee, type LiveNetworkFeeRequest, type LiveNetworkFeeSnapshot } from './src/services/networkFee';
import { resolveActualNetworkFee, type TxFeeChainCode } from './src/services/txActualFee';
import { fetchOnchainBalances } from './src/services/walletOnchain';
import {
  OnchainSendError,
  fetchOnchainNftOwnership,
  sendOnchainNftTransaction,
  sendOnchainTransaction
} from './src/services/onchainSend';
import {
  deriveTrustCompatibleChainAddresses,
  deriveTrustCompatiblePrimaryAddress,
  generateRecoverySeedWords,
  isValidRecoverySeedWords,
  normalizeSeedWords,
  type RecoveryWordCount
} from './src/services/walletRecoveryCompat';
import { scanRecoveryAccountIndex, type RecoveryAccountIndexScanResult } from './src/services/recoveryAccountIndexScanner';
import {
  fetchDiscoverFeed,
  logDiscoverClick,
  type DiscoverActionType,
  type DiscoverFeedItem,
  type DiscoverFeedPayload,
  type DiscoverSectionId
} from './src/services/discoverContent';
import {
  syncDiscoverIconCache as syncDiscoverIconCacheRemote,
  type DiscoverIconCacheSyncPayload
} from './src/services/discoverIconCache';
import { useWalletStore } from './src/state/useWalletStore';
import { useAssetToggleStore } from './src/state/useAssetToggleStore';
import { createReceiveShareText } from './src/services/qrShare';
import { logEvent } from './src/services/logger';
import { trackError, trackPerformance } from './src/services/monitoring';
import { ReceiveQrCard } from './src/components/receive/ReceiveQrCard';

const GlobalText = Text as typeof Text & { defaultProps?: Record<string, unknown> };
try {
  GlobalText.defaultProps = GlobalText.defaultProps ?? {};
  (GlobalText.defaultProps as { allowFontScaling?: boolean }).allowFontScaling = false;
  (GlobalText.defaultProps as { maxFontSizeMultiplier?: number }).maxFontSizeMultiplier = 1;
} catch {
  // Web runtimes can expose readonly defaultProps on host components.
}

const launchIntroLogoSource = require('./assets/launch-logo.png');
const onboardingSymbolSource = require('./assets/icon.png');
const appConfig = require('./app.json') as {
  expo?: {
    name?: string;
    version?: string;
    android?: { versionCode?: number };
  };
};
const appVersionName = appConfig?.expo?.version?.trim() || '0.0.0';
const appInfoVersionLabel = `IMWallet ${appVersionName}`;

type Language = 'ko' | 'en' | 'zh';
type ThemeMode = 'light' | 'dark';
type WalletSegment = 'crypto' | 'nft';
type AddressBookScope = 'asset' | 'nft';
type HomeAssetLayout = 1 | 2 | 3;
type MainTab = 'home' | 'earn' | 'discover';
type AssetChartRange = '1H' | '1D' | '1W' | '1M' | '1Y' | 'ALL';
type AssetKey = 'BTC' | 'ETH' | 'XRP' | 'BNB' | 'SOL' | 'TRX' | 'FIL' | 'USDT';
type ChainCode = 'BTC' | 'ETH' | 'XRP' | 'BSC' | 'SOL' | 'TRX' | 'FIL';
type WalletToken = TokenItem & {
  assetKey: AssetKey;
  chainCode: ChainCode;
  chainLabel: string;
  chainBadge?: string;
  iconGlyph?: string;
  walletAddress: string;
  iconSource?: ImageSourcePropType;
  chainIconSource?: ImageSourcePropType;
};

type AddressBookEntry = {
  id: string;
  chain: ChainCode;
  assetKey?: AssetKey;
  address: string;
  label: string;
  createdAt: string;
  memo?: string;
};

type SupportChatMessage = {
  id: string;
  role: 'agent' | 'user';
  text?: string;
  imageUri?: string;
  createdAt: string;
};

type DiscoverBrowserTab = {
  id: string;
  title: string;
  url: string;
  openedAt: string;
  lastVisitedAt: string;
  sourceItemId?: string;
};

type DiscoverUrlSecurityLevel = 'safe' | 'caution' | 'high' | 'blocked';

type AppErrorBoundaryState = {
  error: Error | null;
};

const USER_SAFE_FATAL_ERROR_MESSAGE = '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';

class AppErrorBoundary extends Component<{ children: React.ReactNode }, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    trackError('app.error_boundary_crash', error, { componentStack: errorInfo.componentStack });
  }

  render() {
    if (this.state.error) {
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: '#0a0f1a',
            paddingHorizontal: 24,
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '800', textAlign: 'center' }}>IMWallet Error</Text>
          <Text style={{ color: '#ff7842', fontSize: 13, fontWeight: '700', marginTop: 10, textAlign: 'center' }}>
            {USER_SAFE_FATAL_ERROR_MESSAGE}
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

type DiscoverUrlSecurityCheck = {
  level: DiscoverUrlSecurityLevel;
  host: string;
  reason:
    | 'trusted'
    | 'user-allowed'
    | 'unknown'
    | 'punycode'
    | 'ip-host'
    | 'suspicious-tld'
    | 'blocked-host'
    | 'invalid-url'
    | 'insecure-protocol';
};

type DiscoverSecurityPrompt = {
  url: string;
  title: string;
  sourceItemId?: string;
  host: string;
  reason: DiscoverUrlSecurityCheck['reason'];
  source: 'open' | 'navigation';
};

type DiscoverTrustedHostEntry = {
  id: string;
  host: string;
  memo: string;
  createdAt: string;
  expiresAt: string;
};

type SendAuthMethod = 'password' | 'fingerprint' | 'face';
type AutoLockOption = 'IMMEDIATE' | '1M' | '5M' | '1H' | '5H';

type SendGasSettings = {
  gasPrice: string;
  gasLimit: string;
  txData: string;
  nonce: string;
};

type SendDraft = {
  tokenId: string;
  tokenSymbol: string;
  chainCode: ChainCode;
  network: string;
  assetType?: 'asset' | 'nft';
  nftId?: string;
  nftName?: string;
  recipient: string;
  recipientLabel?: string;
  amount: number;
  memo?: string;
  usdValue: number;
  feeUsd: number;
  feeNative: number;
  gas: SendGasSettings;
};

type TxFeeStatus = 'estimated' | 'confirmed';
type WalletTxItem = TxItem & {
  hash?: string;
  feeNative?: number;
  feeUsd?: number;
  feeStatus?: TxFeeStatus;
  feeConfirmedAt?: string;
};

type TxDetailData = {
  txId?: string;
  hash: string;
  txType: TxItem['type'];
  tokenSymbol: string;
  chainCode: ChainCode;
  network: string;
  amount: number;
  usdValue: number;
  createdAt: string;
  recipient: string;
  recipientLabel?: string;
  status: 'completed' | 'pending' | 'failed';
  feeNative: number;
  feeUsd: number;
  feeStatus?: TxFeeStatus;
  feeConfirmedAt?: string;
  gas: SendGasSettings;
  memo?: string;
};
type TxDetailHeaderMode = 'history' | 'postSend';

type HistoryDateFilter = 'ALL' | 'TODAY' | '7D' | '30D' | 'RANGE';
type HistoryScopeFilter = 'ALL' | 'ASSET' | 'NFT';
type AddressBookDateFilter = 'ALL' | 'TODAY' | '7D' | '30D';
const DEFAULT_RECOVERY_WORD_COUNT: RecoveryWordCount = 12;
const APP_PASSWORD_STORE_KEY = 'imwallet.app.password';
const AUTH_METHOD_STORE_KEY = 'imwallet.app.auth_method';
const PRIVACY_POLICY_URL = 'https://download.imwallet.app/download/privacy.html';
const DISCOVER_TRUSTED_HOSTS_STORE_KEY = 'imwallet.discover.trusted_hosts.v1';
const WALLET_SEED_MAP_STORE_KEY = 'imwallet.wallet.seed_map.v1';
const WALLET_SEED_PASSPHRASE_MAP_STORE_KEY = 'imwallet.wallet.seed_passphrase_map.v1';
const WALLET_ACCOUNT_INDEX_MAP_STORE_KEY = 'imwallet.wallet.account_index_map.v1';
const TX_HISTORY_STORE_KEY = 'imwallet.store.tx_history.v1';
const ADDRESS_BOOK_STORE_KEY = 'imwallet.store.address_book.v1';
const NFT_ADDRESS_BOOK_STORE_KEY = 'imwallet.store.nft_address_book.v1';
const APP_PASSWORD_LENGTH = 6;
const PASSWORD_AUTH_BACKOFF_BASE_MS = 1500;
const PASSWORD_AUTH_BACKOFF_MAX_MS = 5 * 60 * 1000;
const SEED_CLIPBOARD_CLEAR_DELAY_MS = 60_000;
const DISCOVER_TRUSTED_HOST_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const webTransientStore = new Map<string, string>();

const normalizeSeedWord = (raw: string) => raw.trim().toLowerCase().replace(/\s+/g, '');
const normalizePassword = (raw: string) => raw.replace(/\D/g, '').slice(0, APP_PASSWORD_LENGTH);
const isValidAppPassword = (raw: string) => new RegExp(`^\\d{${APP_PASSWORD_LENGTH}}$`).test(raw);
const isSupportedRecoveryWordCount = (value: number): value is RecoveryWordCount => value === 12 || value === 24;
const toRecoveryWordCount = (value: number): RecoveryWordCount => (value === 24 ? 24 : 12);
const createEmptySeedWords = (wordCount: number) => Array.from({ length: toRecoveryWordCount(wordCount) }, () => '');
const normalizeAccountIndex = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
};
const normalizeAccountIndexInput = (raw: string) => {
  const trimmed = raw.replace(/[^\d]/g, '').slice(0, 6);
  return trimmed.length ? String(normalizeAccountIndex(Number(trimmed))) : '0';
};
const toIsoOrNow = (raw: string, fallbackMs = Date.now()) => {
  const parsed = new Date(String(raw || '').trim());
  if (Number.isNaN(parsed.getTime())) return new Date(fallbackMs).toISOString();
  return parsed.toISOString();
};
const computeTrustedHostExpiresAt = (createdAtIso: string, rawExpiresAt?: string) => {
  const parsedExpiresAt = new Date(String(rawExpiresAt || '').trim());
  if (!Number.isNaN(parsedExpiresAt.getTime())) return parsedExpiresAt.toISOString();
  const createdAtTs = Date.parse(createdAtIso);
  const fallbackBaseTs = Number.isFinite(createdAtTs) ? createdAtTs : Date.now();
  return new Date(fallbackBaseTs + DISCOVER_TRUSTED_HOST_TTL_MS).toISOString();
};

const safeGenerateRecoverySeedWords = (wordCount: RecoveryWordCount = DEFAULT_RECOVERY_WORD_COUNT) => {
  try {
    return generateRecoverySeedWords(wordCount);
  } catch (error) {
    trackError('recovery_seed_generate_failed', error);
    throw new Error('recovery_seed_generation_unavailable');
  }
};

const fillSecureRandomBytes = (bytes: Uint8Array) => {
  const cryptoApi = (globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array } }).crypto;
  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
    return bytes;
  }
  let seed = (Date.now() ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < bytes.length; i += 1) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    bytes[i] = seed & 0xff;
  }
  return bytes;
};

const randomHexString = (hexLength: number) => {
  const byteLength = Math.max(1, Math.ceil(hexLength / 2));
  const bytes = fillSecureRandomBytes(new Uint8Array(byteLength));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, hexLength);
};

const randomBase36String = (length: number) => {
  const bytes = fillSecureRandomBytes(new Uint8Array(Math.max(1, length)));
  return Array.from(bytes, (value) => (value % 36).toString(36))
    .join('')
    .slice(0, length);
};

const randomIntExclusive = (maxExclusive: number) => {
  if (!Number.isFinite(maxExclusive) || maxExclusive <= 1) return 0;
  const bytes = fillSecureRandomBytes(new Uint8Array(4));
  const raw = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  return raw % Math.floor(maxExclusive);
};

const loadSecureValue = async (key: string) => {
  if (Platform.OS === 'web') {
    // Never persist sensitive wallet/auth secrets in browser storage.
    return null;
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
};

const saveSecureValue = async (key: string, value: string) => {
  if (Platform.OS === 'web') {
    // Skip persisting secrets on web runtime for security hardening.
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // no-op on unsupported runtime
  }
};

const loadStoredJson = async <T,>(key: string): Promise<T | null> => {
  if (Platform.OS === 'web') {
    try {
      const raw = webTransientStore.get(key) ?? null;
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  const raw = await loadSecureValue(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const saveStoredJson = async (key: string, value: unknown) => {
  const serialized = JSON.stringify(value);
  if (Platform.OS === 'web') {
    webTransientStore.set(key, serialized);
    return;
  }
  await saveSecureValue(key, serialized);
};

type Screen =
  | MainTab
  | 'assetDetail'
  | 'nftDetail'
  | 'manageAssets'
  | 'settings'
  | 'settingsTheme'
  | 'settingsSecurity'
  | 'settingsNotifications'
  | 'settingsDappSecurity'
  | 'settingsWalletsAuth'
  | 'settingsWallets'
  | 'settingsHelp'
  | 'settingsPrivacy'
  | 'settingsSupport'
  | 'settingsAbout'
  | 'addressBookSelect'
  | 'addressBook'
  | 'send'
  | 'sendConfirm'
  | 'sendAdvanced'
  | 'sendAuth'
  | 'sendProcessing'
  | 'sendTxDetail'
  | 'nftSend'
  | 'receive'
  | 'nftReceive'
  | 'history'
  | 'discoverDappBrowser'
  | 'discoverHistory'
  | 'discoverFavorite'
  | 'discoverNoTabs'
  | 'discoverEarn'
  | 'discoverExploreDapps'
  | 'discoverWatchlist'
  | 'discoverSites'
  | 'discoverLatest'
  | 'discoverPopularRanking'
  | 'discoverBriefingBoard'
  | 'onboardingWelcome'
  | 'onboardingCreateCheck'
  | 'onboardingCreateBackup'
  | 'onboardingCreatePhrase'
  | 'onboardingCreateConfirm'
  | 'onboardingCreateDone'
  | 'onboardingSetPassword'
  | 'onboardingAddExisting'
  | 'onboardingAddAdvanced'
  | 'onboardingAddNetwork'
  | 'onboardingAddDone'
  | 'walletDeleteCheck'
  | 'walletDeletePhrase'
  | 'walletDeleteAuth'
  | 'noWalletHome'
  | 'noWalletSettings';

type Copy = {
  locale: string;
  home: string;
  swap: string;
  hotTokens: string;
  earn: string;
  discover: string;
  settings: string;
  wallet: string;
  totalBalance: string;
  send: string;
  receive: string;
  buy: string;
  sell: string;
  history: string;
  historyFilterType: string;
  historyTypeAsset: string;
  historyTypeNft: string;
  historyTypeNftHint: string;
  historyFilterChain: string;
  historyFilterAsset: string;
  historyFilterAssetHint: string;
  receiveFilterAddressHint: string;
  historyFilterDate: string;
  historyFilterAll: string;
  historyDateToday: string;
  historyDate7d: string;
  historyDate30d: string;
  historyDateRange: string;
  historyNoResult: string;
  historyRangeTitle: string;
  historyRangePreset3m: string;
  historyRangePreset6m: string;
  historyRangePreset1y: string;
  historyRangeStart: string;
  historyRangeEnd: string;
  historyRangeApply: string;
  historyRangeReset: string;
  historyRangeCancel: string;
  historyRangePickHint: string;
  crypto: string;
  nfts: string;
  noNftTitle: string;
  noNftBody: string;
  receiveNft: string;
  tokenSearch: string;
  from: string;
  to: string;
  continue: string;
  latest: string;
  topDappTokens: string;
  discoverDapp: string;
  featured: string;
  dex: string;
  lending: string;
  yield: string;
  solana: string;
  market: string;
  social: string;
  games: string;
  theme: string;
  language: string;
  light: string;
  dark: string;
  wallets: string;
  security: string;
  notifications: string;
  helpCenter: string;
  privacyPolicy: string;
  support: string;
  about: string;
  preferences: string;
  allowPush: string;
  sendReceiveNoti: string;
  announcements: string;
  biometric: string;
  confirmSign: string;
  passwordLock: string;
  autoLock: string;
  lockMethod: string;
  biometricType: string;
  transactionSigning: string;
  transactionSigningHint: string;
  autoLockImmediate: string;
  autoLock1m: string;
  autoLock5m: string;
  autoLock1h: string;
  autoLock5h: string;
  biometricUnavailable: string;
  biometricNotEnrolled: string;
  biometricFingerprintNotEnrolled: string;
  biometricFaceNotEnrolled: string;
  biometricFingerprintUnavailable: string;
  biometricFaceUnavailable: string;
  appVersion: string;
  onboardingTitle: string;
  onboardingBody: string;
  createWallet: string;
  addExisting: string;
  securityCheck: string;
  backupTitle: string;
  backupBody: string;
  backupWarning: string;
  securityChecklistBackup: string;
  securityChecklistNoShare: string;
  securityChecklistNoRecovery: string;
  phraseTitle: string;
  phraseGuide: string;
  phraseGuideSub: string;
  confirmTitle: string;
  confirmSeedGuide: string;
  doneTitle: string;
  doneBody: string;
  goToWallet: string;
  secretPhrase: string;
  phrasePlaceholder: string;
  selectNetwork: string;
  noWalletTitle: string;
  noWalletBody: string;
  previewOnboarding: string;
  previewNoWallet: string;
  backToWallet: string;
  invalidAmount: string;
  recipientRequired: string;
  sameToken: string;
  insufficientBalance: string;
  addressInvalid: string;
  addressMismatch: string;
  addressNotFound: string;
  addressCopied: string;
  phraseCopied: string;
  copyAddress: string;
  copyPhrase: string;
  shareImage: string;
  sendSuccess: string;
  buySuccess: string;
  sellSuccess: string;
  swapSuccess: string;
  startBrowsing: string;
  discoverHistoryEmpty: string;
  discoverFavoriteEmpty: string;
  discoverTabsEmpty: string;
  network: string;
  amount: string;
  availableBalance: string;
  recipient: string;
  recipientPlaceholder: string;
  memo: string;
  memoPlaceholder: string;
  selectAsset: string;
  selectChain: string;
  selectChainAssetFirst: string;
  feeEstimate: string;
  manageAssets: string;
  assetLayout: string;
  addAsset: string;
  removeAsset: string;
  noAssetEnabled: string;
  quickAddress: string;
  addressBook: string;
  recentSends: string;
  noAddressBook: string;
  noRecentSends: string;
  saveAddress: string;
  addressSaved: string;
  addressExists: string;
  max: string;
  supportChatGreeting: string;
  supportChatInputPlaceholder: string;
  supportChatAttachImage: string;
  supportChatSend: string;
  supportChatOnlyImages: string;
  supportChatUploadFailed: string;
  supportChatAgentAutoReply: string;
};

type AppPalette = {
  bg: string;
  card: string;
  panel: string;
  chip: string;
  line: string;
  text: string;
  muted: string;
  accent: string;
  accentSoft: string;
  positive: string;
  negative: string;
  overlay: string;
};

const languageLabel: Record<Language, string> = {
  ko: 'KO',
  en: 'EN',
  zh: '中文'
};

const discoverCategoryIds = ['featured', 'dex', 'lending', 'yield', 'solana', 'market', 'social', 'games'] as const;
type DiscoverCategoryId = (typeof discoverCategoryIds)[number];
const MIN_DISCOVER_DAPP_ITEMS_PER_CATEGORY = 3;
const discoverDappFilterIds = ['all', 'defi', 'exchanges', 'collectibles', 'social', 'games'] as const;
type DiscoverDappFilterId = (typeof discoverDappFilterIds)[number];
const MAX_DISCOVER_DAPP_ITEMS_PER_CATEGORY = 10;
const discoverTokenCategoryIds = ['all', 'layer1', 'defi', 'stablecoin', 'exchange', 'meme'] as const;
type DiscoverTokenCategoryId = (typeof discoverTokenCategoryIds)[number];
const discoverSiteCategoryIds = ['all', 'market', 'analytics', 'news', 'security', 'tools', 'learn'] as const;
type DiscoverSiteCategoryId = (typeof discoverSiteCategoryIds)[number];

const mapLegacyDappCategoryToDiscoverCategory = (rawCategory: string, featured: boolean): DiscoverCategoryId => {
  if (featured) return 'featured';
  const category = rawCategory.trim().toLowerCase();
  if (category.includes('dex') || category.includes('defi') || category.includes('swap')) return 'dex';
  if (category.includes('lend')) return 'lending';
  if (category.includes('stake') || category.includes('yield')) return 'yield';
  if (category.includes('sol')) return 'solana';
  if (category.includes('nft') || category.includes('market')) return 'market';
  if (category.includes('social') || category.includes('community')) return 'social';
  if (category.includes('game')) return 'games';
  return 'social';
};

const resolveDiscoverDappFilter = (item: Pick<DiscoverFeedItem, 'category' | 'title' | 'summary' | 'sourceName' | 'tags'>): Exclude<DiscoverDappFilterId, 'all'> => {
  const haystack = [item.title, item.summary, item.sourceName, ...(item.tags ?? [])].join(' ').toLowerCase();

  if (item.category === 'games' || /(game|gaming|play|metaverse|quest|arcade|sandbox|splinterlands|axie)/i.test(haystack)) {
    return 'games';
  }
  if (item.category === 'social' || /(social|community|chat|lens|farcaster|guild|zealy|galxe|mirror)/i.test(haystack)) {
    return 'social';
  }
  if (item.category === 'market' || /(nft|collectible|marketplace|opensea|magic eden|blur|rarible|x2y2|looksrare)/i.test(haystack)) {
    return 'collectibles';
  }
  if (item.category === 'dex' || /(exchange|swap|dex|amm|orderbook|trade|trading|bridge|aggregator|uniswap|pancakeswap|1inch)/i.test(haystack)) {
    return 'exchanges';
  }
  return 'defi';
};

const mapPopularDappCategoryToDiscoverFilter = (
  categoryRaw: string,
  nameRaw: string,
  summaryRaw: string
): Exclude<DiscoverDappFilterId, 'all'> => {
  const haystack = [categoryRaw, nameRaw, summaryRaw].join(' ').toLowerCase();
  if (/(game|gaming|metaverse|quest|arcade|play)/i.test(haystack)) return 'games';
  if (/(social|community|chat|lens|farcaster|guild|mirror)/i.test(haystack)) return 'social';
  if (/(nft|collectible|marketplace|opensea|magic eden|blur|rarible|x2y2|looksrare)/i.test(haystack)) return 'collectibles';
  if (/(dex|swap|exchange|amm|orderbook|aggregator|bridge|trade|trading|uniswap|pancakeswap|1inch)/i.test(haystack)) return 'exchanges';
  return 'defi';
};

const mapPopularDappCategoryToDiscoverCategory = (
  categoryRaw: string,
  nameRaw: string,
  summaryRaw: string
): DiscoverCategoryId => {
  const filter = mapPopularDappCategoryToDiscoverFilter(categoryRaw, nameRaw, summaryRaw);
  if (filter === 'games') return 'games';
  if (filter === 'social') return 'social';
  if (filter === 'collectibles') return 'market';
  if (filter === 'exchanges') return 'dex';
  return 'yield';
};

const resolveDiscoverTokenCategory = (symbolRaw: string, nameRaw: string): Exclude<DiscoverTokenCategoryId, 'all'> => {
  const symbol = symbolRaw.trim().toUpperCase();
  const name = nameRaw.trim().toLowerCase();

  if (['USDT', 'USDC', 'DAI', 'FDUSD', 'TUSD', 'USDE', 'USDD'].includes(symbol)) return 'stablecoin';
  if (['BNB', 'OKB', 'BGB', 'LEO', 'GT', 'KCS', 'CRO', 'HTX'].includes(symbol)) return 'exchange';
  if (['DOGE', 'SHIB', 'PEPE', 'WIF', 'BONK', 'FLOKI', 'MEME'].includes(symbol)) return 'meme';
  if (['AAVE', 'UNI', 'MKR', 'ONDO', 'CRV', 'LDO', 'COMP', 'SNX', 'PENDLE', 'MORPHO'].includes(symbol)) return 'defi';

  if (/(usd|stable)/i.test(name)) return 'stablecoin';
  if (/(exchange|token)/i.test(name) && ['BNB', 'OKB', 'BGB', 'LEO', 'GT', 'KCS', 'CRO', 'HTX'].includes(symbol)) return 'exchange';
  if (/(dog|shib|pepe|meme|inu|bonk|floki|wif)/i.test(name)) return 'meme';
  if (/(finance|swap|protocol|defi|dao|lending|staking)/i.test(name)) return 'defi';

  return 'layer1';
};

type DiscoverTokenTopupSeed = {
  symbol: string;
  name: string;
  marketCapUsd: number;
};

const discoverTokenTopupSeedMap: Record<Exclude<DiscoverTokenCategoryId, 'all'>, DiscoverTokenTopupSeed[]> = {
  layer1: [],
  defi: [],
  stablecoin: [],
  exchange: [],
  meme: []
};

const discoverTokenTopupSeedSymbols = Object.freeze(
  Array.from(
    new Set(
      Object.values(discoverTokenTopupSeedMap)
        .flatMap((rows) => rows.map((row) => row.symbol.trim().toUpperCase()))
        .filter(Boolean)
    )
  )
);

const discoverTokenLocalizedNameMap: Record<string, { ko: string; zh: string }> = Object.freeze({
  BTC: { ko: '비트코인', zh: '比特币' },
  ETH: { ko: '이더리움', zh: '以太坊' },
  XRP: { ko: '리플', zh: '瑞波币' },
  BNB: { ko: '비앤비', zh: '币安币' },
  SOL: { ko: '솔라나', zh: '索拉纳' },
  ADA: { ko: '카르다노', zh: '艾达币' },
  TRX: { ko: '트론', zh: '波场' },
  TON: { ko: '톤코인', zh: '开放网络币' },
  AVAX: { ko: '아발란체', zh: '雪崩' },
  SUI: { ko: '수이', zh: '隋币' },
  UNI: { ko: '유니스왑', zh: '优尼交换' },
  AAVE: { ko: '아베', zh: '阿维' },
  MKR: { ko: '메이커', zh: '创客' },
  ONDO: { ko: '온도', zh: '昂多' },
  LDO: { ko: '리도 다오', zh: '丽都DAO' },
  CRV: { ko: '커브 다오', zh: '曲线DAO' },
  PENDLE: { ko: '펜들', zh: '潘德尔' },
  COMP: { ko: '컴파운드', zh: '复合协议' },
  SNX: { ko: '신세틱스', zh: '合成资产' },
  MORPHO: { ko: '모르포', zh: '莫福' },
  USDT: { ko: '테더', zh: '泰达币' },
  USDC: { ko: '유에스디코인', zh: '美元币' },
  DAI: { ko: '다이', zh: '代稳定币' },
  FDUSD: { ko: '퍼스트디지털USD', zh: '第一数字美元' },
  TUSD: { ko: '트루USD', zh: '真实美元' },
  USDE: { ko: '에테나 USDe', zh: '合成美元' },
  USDD: { ko: '유에스디디', zh: '波场美元' },
  FRAX: { ko: '프랙스', zh: '分数稳定币' },
  PYUSD: { ko: '페이팔 USD', zh: '贝宝美元' },
  GUSD: { ko: '제미니 달러', zh: '双子星美元' },
  OKB: { ko: '오케이비', zh: '欧易平台币' },
  BGB: { ko: '비트겟 토큰', zh: '比特给平台币' },
  LEO: { ko: '레오', zh: '狮子币' },
  GT: { ko: '게이트토큰', zh: '芝麻开门平台币' },
  KCS: { ko: '쿠코인 토큰', zh: '库币平台币' },
  CRO: { ko: '크로노스', zh: '克罗诺斯' },
  WBT: { ko: '화이트빗 코인', zh: '白比特代币' },
  HTX: { ko: '에이치티엑스', zh: '火币平台币' },
  MX: { ko: '엠엑스 토큰', zh: '抹茶平台币' },
  DOGE: { ko: '도지코인', zh: '狗狗币' },
  SHIB: { ko: '시바이누', zh: '柴犬币' },
  PEPE: { ko: '페페', zh: '佩佩币' },
  WIF: { ko: '도그위프햇', zh: '狗帽币' },
  BONK: { ko: '봉크', zh: '邦克币' },
  FLOKI: { ko: '플로키', zh: '弗洛基' },
  BRETT: { ko: '브렛', zh: '布雷特' },
  MEME: { ko: '밈코인', zh: '模因币' },
  MOG: { ko: '모그코인', zh: '莫格币' },
  TURBO: { ko: '터보', zh: '涡轮币' }
});

const discoverSiteLocalizedNameMap: Record<string, { ko: string; zh: string }> = Object.freeze({
  'site-coinmarketcap': { ko: '코인마켓캡', zh: '币市值' },
  'site-coingecko': { ko: '코인게코', zh: '币虎' },
  'site-livecoinwatch': { ko: '라이브코인워치', zh: '实时币价' },
  'site-coinpaprika': { ko: '코인파프리카', zh: '币椒' },
  'site-cryptocompare': { ko: '크립토컴페어', zh: '加密比较' },
  'site-defillama': { ko: '디파이라마', zh: '去中心化骆马' },
  'site-dune': { ko: '듄', zh: '沙丘数据' },
  'site-glassnode': { ko: '글래스노드', zh: '玻璃节点' },
  'site-cryptoquant': { ko: '크립토퀀트', zh: '加密量化' },
  'site-artemis': { ko: '아르테미스', zh: '阿耳忒弥斯' },
  'site-coindesk': { ko: '코인데스크', zh: '币桌' },
  'site-cointelegraph': { ko: '코인텔레그래프', zh: '区块链电报' },
  'site-theblock': { ko: '더블록', zh: '区块快报' },
  'site-decrypt': { ko: '디크립트', zh: '解密财经' },
  'site-blockworks': { ko: '블록웍스', zh: '区块工坊' },
  'site-chainalysis': { ko: '체이널리시스', zh: '链上分析' },
  'site-slowmist': { ko: '슬로우미스트', zh: '慢雾' },
  'site-certik': { ko: '서틱', zh: '赛蒂克' },
  'site-revoke': { ko: '리보크', zh: '授权撤销' },
  'site-scamsniffer': { ko: '스캠스니퍼', zh: '诈骗嗅探' },
  'site-etherscan': { ko: '이더스캔', zh: '以太坊浏览器' },
  'site-mempool': { ko: '멤풀', zh: '比特币内存池' },
  'site-blockchain-explorer': { ko: '블록체인닷컴 익스플로러', zh: '区块链浏览器' },
  'site-bscscan': { ko: '비에스씨스캔', zh: '币安链浏览器' },
  'site-solscan': { ko: '솔스캔', zh: '索拉纳浏览器' },
  'site-arkham': { ko: '아컴', zh: '阿卡姆' },
  'site-tokenterminal': { ko: '토큰터미널', zh: '代币终端' },
  'site-binance-academy': { ko: '바이낸스 아카데미', zh: '币安学院' },
  'site-coinbase-learn': { ko: '코인베이스 러닝', zh: '币库学习' },
  'site-bankless': { ko: '뱅크리스', zh: '无银行化' },
  'site-coinbureau': { ko: '코인뷰로', zh: '币圈观察' },
  'site-a16z-crypto': { ko: 'a16z 크립토', zh: '安德森加密风投' },
  'site-messari': { ko: '메사리', zh: '梅萨里' },
  'site-cryptorank': { ko: '크립토랭크', zh: '加密排行' },
  'site-coincodex': { ko: '코인코덱스', zh: '币典' },
  'site-coin360': { ko: '코인360', zh: '币360' },
  'site-coinstats': { ko: '코인스탯츠', zh: '币统计' },
  'site-nansen': { ko: '난센', zh: '南森' },
  'site-intotheblock': { ko: '인트더블록', zh: '链上洞察' },
  'site-santiment': { ko: '산티먼트', zh: '市场情绪' },
  'site-tokenunlocks': { ko: '토큰언락스', zh: '代币解锁' },
  'site-footprint': { ko: '풋프린트 애널리틱스', zh: '足迹分析' },
  'site-bitcoinmagazine': { ko: '비트코인 매거진', zh: '比特币杂志' },
  'site-thedefiant': { ko: '더 디파이언트', zh: '无畏者' },
  'site-wublockchain': { ko: '우 블록체인', zh: '吴说区块链' },
  'site-cryptoslate': { ko: '크립토슬레이트', zh: '加密石板' },
  'site-dlnews': { ko: 'DL 뉴스', zh: '深链新闻' },
  'site-immunefi': { ko: '이뮤니파이', zh: '免疫赏金' },
  'site-peckshield': { ko: '펙쉴드', zh: '派盾' },
  'site-hacken': { ko: '해큰', zh: '黑肯安全' },
  'site-blocksec': { ko: '블록섹', zh: '链上护盾' },
  'site-phishfort': { ko: '피시포트', zh: '防钓鱼堡垒' },
  'site-dexscreener': { ko: '덱스스크리너', zh: '去中心化行情筛选' },
  'site-geckoterminal': { ko: '게코터미널', zh: '壁虎终端' },
  'site-chainlist': { ko: '체인리스트', zh: '链列表' },
  'site-debank': { ko: '디뱅크', zh: '链上资产总览' },
  'site-zapper': { ko: '재퍼', zh: '资产聚合器' },
  'site-ethereum-org': { ko: '이더리움 공식 사이트', zh: '以太坊官网' },
  'site-bybit-learn': { ko: '바이비트 러닝', zh: '拜比特学院' },
  'site-kraken-learn': { ko: '크라켄 러닝', zh: '海妖学院' },
  'site-ledger-academy': { ko: '레저 아카데미', zh: '冷钱包学院' },
  'site-bitget-academy': { ko: '비트겟 아카데미', zh: '比特给学院' }
});

const normalizeNameForCompare = (value: string) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

const resolveLocalizedDiscoverAlias = (baseName: string, aliasMapValue: { ko: string; zh: string } | undefined, lang: Language) => {
  if (lang === 'en' || !aliasMapValue) return '';
  const alias = (lang === 'ko' ? aliasMapValue.ko : aliasMapValue.zh).trim();
  if (!alias) return '';
  if (normalizeNameForCompare(alias) === normalizeNameForCompare(baseName)) return '';
  return alias;
};

const resolveDiscoverTokenDisplayName = (symbol: string, baseName: string, lang: Language) => ({
  primary: baseName,
  secondary: resolveLocalizedDiscoverAlias(baseName, discoverTokenLocalizedNameMap[symbol.trim().toUpperCase()], lang)
});

const resolveDiscoverSiteDisplayName = (siteId: string, baseName: string, lang: Language) => ({
  primary: baseName,
  secondary: resolveLocalizedDiscoverAlias(baseName, discoverSiteLocalizedNameMap[siteId], lang)
});

const discoverSiteSummaryByCategory = Object.freeze({
  market: {
    en: 'Track market cap, volume, and listed asset data.',
    zh: '追踪市值、成交量与上币数据。'
  },
  analytics: {
    en: 'Analyze on-chain and protocol growth metrics.',
    zh: '分析链上与协议增长指标。'
  },
  news: {
    en: 'Read key crypto market news and research updates.',
    zh: '查看加密市场重点新闻与研究更新。'
  },
  security: {
    en: 'Monitor security risks, approvals, and threat signals.',
    zh: '监控安全风险、授权状态与威胁信号。'
  },
  tools: {
    en: 'Use practical tools for wallets and on-chain workflows.',
    zh: '使用钱包与链上操作的实用工具。'
  },
  learn: {
    en: 'Learn crypto concepts, market structure, and strategy.',
    zh: '学习加密概念、市场结构与策略。'
  }
} as const);

const hasHangul = (value: string) => /[\u3131-\u318E\uAC00-\uD7A3]/.test(value);

const resolveDiscoverSiteSummary = (site: DiscoverSiteItem, lang: Language) => {
  if (lang === 'ko') return site.summary;
  const localized = discoverSiteSummaryByCategory[site.category];
  if (!localized) return site.summary;
  if (lang === 'en') {
    return hasHangul(site.summary) ? localized.en : site.summary;
  }
  if (lang === 'zh') {
    return hasHangul(site.summary) ? localized.zh : site.summary;
  }
  return site.summary;
};

type LocalizedLabel = {
  ko: string;
  en: string;
  zh: string;
};

type DiscoverWatchItem = {
  id: string;
  symbol: string;
  name: LocalizedLabel;
  capLabel: string;
  volumeLabel: string;
  priceUsd: number | null;
  marketCapUsd: number | null;
  leverage: string;
  kind: 'asset' | 'dapp';
  iconSource?: ImageSourcePropType;
  iconUri?: string;
  rightPrimary?: string;
  rightPrimaryHint?: string;
  rightSecondary?: string;
};

type DiscoverSiteItem = {
  id: string;
  name: string;
  summary: string;
  category: Exclude<DiscoverSiteCategoryId, 'all'>;
  domain: string;
  url: string;
};

type DiscoverQuickSection = 'earn' | 'exploreDapps' | 'popularTokens' | 'watchlist' | 'sites';
type DiscoverFullSection = 'earn' | 'dapps' | 'watchlist' | 'sites' | 'latest';

const discoverWatchlistSeed: DiscoverWatchItem[] = [
  {
    id: 'watch-amc',
    symbol: 'AMC',
    name: {
      ko: 'AMC 엔터테인먼트',
      en: 'AMC Entertainment',
      zh: 'AMC Entertainment'
    },
    capLabel: '$938.3M',
    volumeLabel: '$69.2M',
    priceUsd: 1.91,
    marketCapUsd: 938_300_000,
    leverage: '5x',
    kind: 'asset'
  },
  {
    id: 'watch-mstr',
    symbol: 'MSTR',
    name: {
      ko: '마이크로스트래티지',
      en: 'MicroStrategy',
      zh: 'MicroStrategy'
    },
    capLabel: '$52B',
    volumeLabel: '$38.6M',
    priceUsd: 165.43,
    marketCapUsd: 52_000_000_000,
    leverage: '3x',
    kind: 'asset'
  },
  {
    id: 'watch-ondo',
    symbol: 'ONDO',
    name: {
      ko: 'Ondo 파이낸스',
      en: 'Ondo Finance',
      zh: 'Ondo Finance'
    },
    capLabel: '$1.8B',
    volumeLabel: '$43.1M',
    priceUsd: 0.88,
    marketCapUsd: 1_800_000_000,
    leverage: '10x',
    kind: 'asset'
  }
];

const discoverSiteSeed: DiscoverSiteItem[] = [
  {
    id: 'site-coinmarketcap',
    name: 'CoinMarketCap',
    summary: '시가총액, 거래량, 상장 코인 데이터를 확인합니다.',
    category: 'market',
    domain: 'coinmarketcap.com',
    url: 'https://coinmarketcap.com'
  },
  {
    id: 'site-coingecko',
    name: 'CoinGecko',
    summary: '실시간 코인 가격과 거래소/시장 데이터를 제공합니다.',
    category: 'market',
    domain: 'coingecko.com',
    url: 'https://www.coingecko.com'
  },
  {
    id: 'site-livecoinwatch',
    name: 'Live Coin Watch',
    summary: '코인 시세/시총/볼륨을 빠르게 모니터링합니다.',
    category: 'market',
    domain: 'livecoinwatch.com',
    url: 'https://www.livecoinwatch.com'
  },
  {
    id: 'site-coinpaprika',
    name: 'CoinPaprika',
    summary: '토큰 메타데이터와 가격 지표를 제공합니다.',
    category: 'market',
    domain: 'coinpaprika.com',
    url: 'https://coinpaprika.com'
  },
  {
    id: 'site-cryptocompare',
    name: 'CryptoCompare',
    summary: '시세 비교와 포트폴리오 트래킹 기능을 제공합니다.',
    category: 'market',
    domain: 'cryptocompare.com',
    url: 'https://www.cryptocompare.com'
  },
  {
    id: 'site-defillama',
    name: 'DefiLlama',
    summary: '체인별 TVL과 DeFi 지표를 집계합니다.',
    category: 'analytics',
    domain: 'defillama.com',
    url: 'https://defillama.com'
  },
  {
    id: 'site-dune',
    name: 'Dune',
    summary: '온체인 SQL 쿼리 기반 커스텀 대시보드를 제공합니다.',
    category: 'analytics',
    domain: 'dune.com',
    url: 'https://dune.com'
  },
  {
    id: 'site-glassnode',
    name: 'Glassnode',
    summary: '비트코인/이더리움 온체인 지표를 분석합니다.',
    category: 'analytics',
    domain: 'glassnode.com',
    url: 'https://glassnode.com'
  },
  {
    id: 'site-cryptoquant',
    name: 'CryptoQuant',
    summary: '거래소 유입/유출과 온체인 흐름을 추적합니다.',
    category: 'analytics',
    domain: 'cryptoquant.com',
    url: 'https://cryptoquant.com'
  },
  {
    id: 'site-artemis',
    name: 'Artemis',
    summary: '체인/프로토콜의 성장 지표를 비교 분석합니다.',
    category: 'analytics',
    domain: 'artemis.xyz',
    url: 'https://www.artemis.xyz'
  },
  {
    id: 'site-coindesk',
    name: 'CoinDesk',
    summary: '암호화폐 산업 뉴스와 리서치를 제공합니다.',
    category: 'news',
    domain: 'coindesk.com',
    url: 'https://www.coindesk.com'
  },
  {
    id: 'site-cointelegraph',
    name: 'Cointelegraph',
    summary: '글로벌 코인 뉴스/정책/시장 이슈를 다룹니다.',
    category: 'news',
    domain: 'cointelegraph.com',
    url: 'https://cointelegraph.com'
  },
  {
    id: 'site-theblock',
    name: 'The Block',
    summary: '리서치 중심의 산업 분석 기사와 브리핑을 제공합니다.',
    category: 'news',
    domain: 'theblock.co',
    url: 'https://www.theblock.co'
  },
  {
    id: 'site-decrypt',
    name: 'Decrypt',
    summary: 'Web3 뉴스와 프로젝트 동향을 다룹니다.',
    category: 'news',
    domain: 'decrypt.co',
    url: 'https://decrypt.co'
  },
  {
    id: 'site-blockworks',
    name: 'Blockworks',
    summary: '시장 인사이트와 기관/정책 뉴스를 제공합니다.',
    category: 'news',
    domain: 'blockworks.co',
    url: 'https://blockworks.co'
  },
  {
    id: 'site-chainalysis',
    name: 'Chainalysis',
    summary: '블록체인 포렌식과 규제 컴플라이언스 도구를 제공합니다.',
    category: 'security',
    domain: 'chainalysis.com',
    url: 'https://www.chainalysis.com'
  },
  {
    id: 'site-slowmist',
    name: 'SlowMist',
    summary: '보안 감사 및 위협 인텔리전스를 제공합니다.',
    category: 'security',
    domain: 'slowmist.com',
    url: 'https://www.slowmist.com'
  },
  {
    id: 'site-certik',
    name: 'CertiK',
    summary: '스마트컨트랙트 보안 감사와 실시간 모니터링을 제공합니다.',
    category: 'security',
    domain: 'certik.com',
    url: 'https://www.certik.com'
  },
  {
    id: 'site-revoke',
    name: 'Revoke.cash',
    summary: '지갑의 토큰 승인 권한을 점검/철회합니다.',
    category: 'security',
    domain: 'revoke.cash',
    url: 'https://revoke.cash'
  },
  {
    id: 'site-scamsniffer',
    name: 'Scam Sniffer',
    summary: '피싱/악성 링크 경고와 지갑 보호 기능을 제공합니다.',
    category: 'security',
    domain: 'scamsniffer.io',
    url: 'https://www.scamsniffer.io'
  },
  {
    id: 'site-etherscan',
    name: 'Etherscan',
    summary: '이더리움 트랜잭션/주소/컨트랙트 조회 도구입니다.',
    category: 'tools',
    domain: 'etherscan.io',
    url: 'https://etherscan.io'
  },
  {
    id: 'site-mempool',
    name: 'mempool.space',
    summary: '비트코인 블록/트랜잭션/수수료를 실시간으로 확인하는 대표 탐색기입니다.',
    category: 'tools',
    domain: 'mempool.space',
    url: 'https://mempool.space'
  },
  {
    id: 'site-blockchain-explorer',
    name: 'Blockchain.com Explorer',
    summary: '비트코인 주소/트랜잭션을 조회할 수 있는 대중적인 블록체인 탐색기입니다.',
    category: 'tools',
    domain: 'blockchain.com',
    url: 'https://www.blockchain.com/explorer'
  },
  {
    id: 'site-bscscan',
    name: 'BscScan',
    summary: 'BNB 체인 트랜잭션/컨트랙트 탐색기입니다.',
    category: 'tools',
    domain: 'bscscan.com',
    url: 'https://bscscan.com'
  },
  {
    id: 'site-solscan',
    name: 'Solscan',
    summary: '솔라나 트랜잭션/주소/프로그램 데이터를 조회합니다.',
    category: 'tools',
    domain: 'solscan.io',
    url: 'https://solscan.io'
  },
  {
    id: 'site-arkham',
    name: 'Arkham',
    summary: '온체인 지갑 추적 및 인텔리전스를 제공합니다.',
    category: 'tools',
    domain: 'arkhamintelligence.com',
    url: 'https://platform.arkhamintelligence.com'
  },
  {
    id: 'site-tokenterminal',
    name: 'Token Terminal',
    summary: '프로토콜 매출/수익 지표를 제공합니다.',
    category: 'tools',
    domain: 'tokenterminal.com',
    url: 'https://tokenterminal.com'
  },
  {
    id: 'site-binance-academy',
    name: 'Binance Academy',
    summary: '블록체인 기초부터 심화까지 학습 콘텐츠를 제공합니다.',
    category: 'learn',
    domain: 'academy.binance.com',
    url: 'https://academy.binance.com'
  },
  {
    id: 'site-coinbase-learn',
    name: 'Coinbase Learn',
    summary: '암호화폐/지갑/보안 개념을 쉽게 학습할 수 있습니다.',
    category: 'learn',
    domain: 'coinbase.com',
    url: 'https://www.coinbase.com/learn'
  },
  {
    id: 'site-bankless',
    name: 'Bankless',
    summary: 'DeFi·이더리움 중심 교육/리서치 콘텐츠를 제공합니다.',
    category: 'learn',
    domain: 'bankless.com',
    url: 'https://www.bankless.com'
  },
  {
    id: 'site-coinbureau',
    name: 'Coin Bureau',
    summary: '프로젝트 리서치와 교육형 콘텐츠를 제공합니다.',
    category: 'learn',
    domain: 'coinbureau.com',
    url: 'https://www.coinbureau.com'
  },
  {
    id: 'site-a16z-crypto',
    name: 'a16z crypto',
    summary: '암호화폐 기술/시장/정책 관련 리서치를 제공합니다.',
    category: 'learn',
    domain: 'a16zcrypto.com',
    url: 'https://a16zcrypto.com'
  },
  {
    id: 'site-messari',
    name: 'Messari',
    summary: '자산별 리서치와 시장 지표를 제공합니다.',
    category: 'market',
    domain: 'messari.io',
    url: 'https://messari.io'
  },
  {
    id: 'site-cryptorank',
    name: 'CryptoRank',
    summary: '토큰 랭킹과 프로젝트 데이터를 제공합니다.',
    category: 'market',
    domain: 'cryptorank.io',
    url: 'https://cryptorank.io'
  },
  {
    id: 'site-coincodex',
    name: 'CoinCodex',
    summary: '코인 시세와 차트/프로젝트 정보를 제공합니다.',
    category: 'market',
    domain: 'coincodex.com',
    url: 'https://coincodex.com'
  },
  {
    id: 'site-coin360',
    name: 'Coin360',
    summary: '히트맵 기반 시장 흐름 시각화를 제공합니다.',
    category: 'market',
    domain: 'coin360.com',
    url: 'https://coin360.com'
  },
  {
    id: 'site-coinstats',
    name: 'CoinStats',
    summary: '포트폴리오와 실시간 자산 추적 기능을 제공합니다.',
    category: 'market',
    domain: 'coinstats.app',
    url: 'https://coinstats.app'
  },
  {
    id: 'site-nansen',
    name: 'Nansen',
    summary: '스마트머니 지갑과 온체인 흐름을 분석합니다.',
    category: 'analytics',
    domain: 'nansen.ai',
    url: 'https://www.nansen.ai'
  },
  {
    id: 'site-intotheblock',
    name: 'IntoTheBlock',
    summary: '온체인·파생·시계열 기반 지표를 제공합니다.',
    category: 'analytics',
    domain: 'intotheblock.com',
    url: 'https://app.intotheblock.com'
  },
  {
    id: 'site-santiment',
    name: 'Santiment',
    summary: '소셜/온체인 데이터 기반 트레이딩 인사이트를 제공합니다.',
    category: 'analytics',
    domain: 'santiment.net',
    url: 'https://santiment.net'
  },
  {
    id: 'site-tokenunlocks',
    name: 'Token Unlocks',
    summary: '토큰 락업 해제 캘린더와 일정 데이터를 제공합니다.',
    category: 'analytics',
    domain: 'token.unlocks.app',
    url: 'https://token.unlocks.app'
  },
  {
    id: 'site-footprint',
    name: 'Footprint Analytics',
    summary: '웹3 데이터 대시보드와 분석 템플릿을 제공합니다.',
    category: 'analytics',
    domain: 'footprint.network',
    url: 'https://www.footprint.network'
  },
  {
    id: 'site-bitcoinmagazine',
    name: 'Bitcoin Magazine',
    summary: '비트코인 중심 뉴스와 해설 콘텐츠를 제공합니다.',
    category: 'news',
    domain: 'bitcoinmagazine.com',
    url: 'https://bitcoinmagazine.com'
  },
  {
    id: 'site-thedefiant',
    name: 'The Defiant',
    summary: 'DeFi/온체인 시장 뉴스와 분석을 제공합니다.',
    category: 'news',
    domain: 'thedefiant.io',
    url: 'https://thedefiant.io'
  },
  {
    id: 'site-wublockchain',
    name: 'Wu Blockchain',
    summary: '거래소/정책/시장 단신 업데이트를 제공합니다.',
    category: 'news',
    domain: 'wublockchain.com',
    url: 'https://wublockchain.com'
  },
  {
    id: 'site-cryptoslate',
    name: 'CryptoSlate',
    summary: '시장 뉴스와 프로젝트 인사이트를 제공합니다.',
    category: 'news',
    domain: 'cryptoslate.com',
    url: 'https://cryptoslate.com'
  },
  {
    id: 'site-dlnews',
    name: 'DL News',
    summary: '디지털자산 산업 이슈와 속보를 다룹니다.',
    category: 'news',
    domain: 'dlnews.com',
    url: 'https://www.dlnews.com'
  },
  {
    id: 'site-immunefi',
    name: 'Immunefi',
    summary: '버그바운티와 보안 리포트 플랫폼입니다.',
    category: 'security',
    domain: 'immunefi.com',
    url: 'https://immunefi.com'
  },
  {
    id: 'site-peckshield',
    name: 'PeckShield',
    summary: '보안 감사와 인시던트 알림을 제공합니다.',
    category: 'security',
    domain: 'peckshield.com',
    url: 'https://peckshield.com'
  },
  {
    id: 'site-hacken',
    name: 'Hacken',
    summary: '프로젝트 보안 진단과 감사 서비스를 제공합니다.',
    category: 'security',
    domain: 'hacken.io',
    url: 'https://hacken.io'
  },
  {
    id: 'site-blocksec',
    name: 'BlockSec',
    summary: '온체인 공격 탐지와 실시간 대응 도구를 제공합니다.',
    category: 'security',
    domain: 'blocksec.com',
    url: 'https://blocksec.com'
  },
  {
    id: 'site-phishfort',
    name: 'PhishFort',
    summary: '피싱 도메인 탐지 및 브랜드 보호를 지원합니다.',
    category: 'security',
    domain: 'phishfort.com',
    url: 'https://www.phishfort.com'
  },
  {
    id: 'site-dexscreener',
    name: 'DEX Screener',
    summary: 'DEX 종목 실시간 차트와 체결 흐름을 제공합니다.',
    category: 'tools',
    domain: 'dexscreener.com',
    url: 'https://dexscreener.com'
  },
  {
    id: 'site-geckoterminal',
    name: 'GeckoTerminal',
    summary: '온체인 페어/풀 분석과 차트를 제공합니다.',
    category: 'tools',
    domain: 'geckoterminal.com',
    url: 'https://www.geckoterminal.com'
  },
  {
    id: 'site-chainlist',
    name: 'Chainlist',
    summary: 'EVM 네트워크 정보를 확인/연결할 수 있습니다.',
    category: 'tools',
    domain: 'chainlist.org',
    url: 'https://chainlist.org'
  },
  {
    id: 'site-debank',
    name: 'DeBank',
    summary: '지갑 기반 포트폴리오와 DeFi 포지션을 조회합니다.',
    category: 'tools',
    domain: 'debank.com',
    url: 'https://debank.com'
  },
  {
    id: 'site-zapper',
    name: 'Zapper',
    summary: '지갑/프로토콜 포트폴리오 뷰를 제공합니다.',
    category: 'tools',
    domain: 'zapper.xyz',
    url: 'https://zapper.xyz'
  },
  {
    id: 'site-ethereum-org',
    name: 'Ethereum.org',
    summary: '이더리움 공식 문서와 학습 자료를 제공합니다.',
    category: 'learn',
    domain: 'ethereum.org',
    url: 'https://ethereum.org'
  },
  {
    id: 'site-bybit-learn',
    name: 'Bybit Learn',
    summary: '거래/파생/블록체인 학습 콘텐츠를 제공합니다.',
    category: 'learn',
    domain: 'learn.bybit.com',
    url: 'https://learn.bybit.com'
  },
  {
    id: 'site-kraken-learn',
    name: 'Kraken Learn',
    summary: '기초부터 심화까지 암호화폐 학습 콘텐츠를 제공합니다.',
    category: 'learn',
    domain: 'kraken.com',
    url: 'https://www.kraken.com/learn'
  },
  {
    id: 'site-ledger-academy',
    name: 'Ledger Academy',
    summary: '지갑 보안과 온체인 사용법을 학습할 수 있습니다.',
    category: 'learn',
    domain: 'ledger.com',
    url: 'https://www.ledger.com/academy'
  },
  {
    id: 'site-bitget-academy',
    name: 'Bitget Academy',
    summary: '시장/거래 전략/프로젝트 이해를 돕는 자료를 제공합니다.',
    category: 'learn',
    domain: 'bitget.com',
    url: 'https://www.bitget.com/academy'
  }
];

type DiscoverDappLocalizationEntry = {
  koName: string;
  zhName: string;
  koSummary: string;
  zhSummary: string;
};

const discoverDappLocalizationMap: Record<string, DiscoverDappLocalizationEntry> = {
  'aave': { koName: '에이브', zhName: '阿维', koSummary: '온체인 유동성을 기반으로 자산을 예치·대출할 수 있습니다.', zhSummary: '基于链上流动性提供资产存借服务。' },
  'compound': { koName: '컴파운드', zhName: '复合协议', koSummary: '주요 자산을 담보로 예치하고 대출하는 머니마켓입니다.', zhSummary: '支持主流资产抵押与借贷的货币市场。' },
  'lido': { koName: '리도', zhName: '丽都', koSummary: 'ETH 등 자산의 유동성 스테이킹을 지원합니다.', zhSummary: '提供 ETH 等资产的流动性质押服务。' },
  'morpho': { koName: '모르포', zhName: '莫福', koSummary: '효율적인 금리 구조의 대출 시장을 제공합니다.', zhSummary: '提供更高效率的借贷利率市场。' },
  'sky / maker': { koName: '메이커다오', zhName: '创客DAO', koSummary: '스테이블코인 및 담보 대출 포지션을 운영합니다.', zhSummary: '提供稳定币与抵押借贷相关功能。' },
  'pendle': { koName: '펜들', zhName: '潘德尔', koSummary: '수익 토큰화와 고정 수익 거래를 지원합니다.', zhSummary: '支持收益代币化与固定收益交易。' },
  'eigenlayer': { koName: '아이겐레이어', zhName: '特征层', koSummary: '리스테이킹 기반 네트워크 참여를 제공합니다.', zhSummary: '提供基于再质押的网络参与能力。' },
  'yearn': { koName: '이어른 파이낸스', zhName: '渴望金融', koSummary: '자동화된 볼트 전략으로 수익 최적화를 지원합니다.', zhSummary: '通过自动化金库策略优化收益。' },
  'convex': { koName: '컨벡스 파이낸스', zhName: '凸面金融', koSummary: 'Curve 연계 보상 최적화 서비스를 제공합니다.', zhSummary: '提供 Curve 生态收益增强服务。' },
  'curve': { koName: '커브', zhName: '曲线金融', koSummary: '스테이블 자산 중심의 유동성 풀을 제공합니다.', zhSummary: '提供稳定资产为主的流动性池。' },
  'uniswap': { koName: '유니스왑', zhName: '优尼交换', koSummary: '대표적인 멀티체인 AMM 스왑 거래소입니다.', zhSummary: '主流多链 AMM 兑换平台。' },
  'pancakeswap': { koName: '팬케이크스왑', zhName: '薄饼交换', koSummary: 'BNB 체인 중심의 DEX 거래를 지원합니다.', zhSummary: '以 BNB 链为核心的去中心化交易平台。' },
  '1inch': { koName: '1인치', zhName: '一英寸', koSummary: '여러 거래소 경로를 집계해 최적 스왑을 제공합니다.', zhSummary: '聚合多交易路径以优化兑换价格。' },
  'jupiter': { koName: '주피터', zhName: '木星聚合', koSummary: '솔라나 생태계의 대표 스왑 라우팅 허브입니다.', zhSummary: 'Solana 生态主流兑换路由平台。' },
  'cow swap': { koName: '카우 스왑', zhName: '奶牛交换', koSummary: '의도 기반 거래와 MEV 완화 기능을 제공합니다.', zhSummary: '提供意图交易与 MEV 缓解机制。' },
  'kyberswap': { koName: '카이버스왑', zhName: '凯伯交换', koSummary: '유동성 집계와 DEX 스왑 기능을 지원합니다.', zhSummary: '提供流动性聚合与去中心化兑换。' },
  'odos': { koName: '오도스', zhName: '奥多斯', koSummary: '다중 토큰 스왑 최적 경로를 계산합니다.', zhSummary: '提供多代币兑换的最优路由。' },
  'paraswap': { koName: '파라스왑', zhName: '帕拉交换', koSummary: '다양한 소스의 스왑 체결을 집계합니다.', zhSummary: '聚合多个流动性来源执行兑换。' },
  'raydium': { koName: '레이디움', zhName: '雷迪姆', koSummary: '솔라나 기반 DEX 및 유동성 서비스를 제공합니다.', zhSummary: '提供 Solana 生态 DEX 与流动性服务。' },
  'trader joe': { koName: '트레이더조', zhName: '乔交易所', koSummary: 'Avalanche 중심의 DEX 거래 플랫폼입니다.', zhSummary: '以 Avalanche 为主的去中心化交易平台。' },
  'opensea': { koName: '오픈씨', zhName: '开放海', koSummary: '대표적인 NFT 컬렉션 마켓플레이스입니다.', zhSummary: '主流 NFT 交易与收藏市场。' },
  'blur': { koName: '블러', zhName: '模糊市场', koSummary: '고급 트레이딩 중심의 NFT 거래 플랫폼입니다.', zhSummary: '面向专业用户的 NFT 交易平台。' },
  'magic eden': { koName: '매직에덴', zhName: '魔法伊甸', koSummary: '멀티체인 NFT 거래 및 컬렉션 탐색을 지원합니다.', zhSummary: '支持多链 NFT 交易与收藏探索。' },
  'rarible': { koName: '라리블', zhName: '稀有宝', koSummary: '크리에이터 중심 NFT 발행·거래를 제공합니다.', zhSummary: '面向创作者的 NFT 发行与交易平台。' },
  'tensor': { koName: '텐서', zhName: '张量', koSummary: '솔라나 NFT 거래와 데이터 분석을 제공합니다.', zhSummary: '提供 Solana NFT 交易与数据分析。' },
  'x2y2': { koName: '엑스투와이투', zhName: '双二双二', koSummary: '이더리움 기반 NFT 마켓 기능을 제공합니다.', zhSummary: '以太坊生态 NFT 交易平台。' },
  'looksrare': { koName: '룩스레어', zhName: '稀有观', koSummary: '커뮤니티 중심 NFT 거래소입니다.', zhSummary: '社区驱动型 NFT 交易平台。' },
  'element': { koName: '엘리먼트', zhName: '元素市场', koSummary: '멀티체인 NFT 마켓 인프라를 지원합니다.', zhSummary: '提供多链 NFT 市场基础设施。' },
  'foundation': { koName: '파운데이션', zhName: '基金会市场', koSummary: '디지털 아트 중심의 NFT 큐레이션 마켓입니다.', zhSummary: '聚焦数字艺术的 NFT 平台。' },
  'superrare': { koName: '슈퍼레어', zhName: '超稀有', koSummary: '고품질 단일 에디션 아트 NFT 거래를 지원합니다.', zhSummary: '面向高质量单版艺术 NFT 的交易平台。' },
  'lens': { koName: '렌즈', zhName: '透镜协议', koSummary: '온체인 소셜 그래프 기반 커뮤니티를 제공합니다.', zhSummary: '基于链上社交图谱的社区协议。' },
  'farcaster': { koName: '파캐스터', zhName: '远播', koSummary: '분산형 소셜 네트워크 생태계를 제공합니다.', zhSummary: '去中心化社交网络生态。' },
  'galxe': { koName: '갈크스', zhName: '银河任务', koSummary: '캠페인 참여와 온체인 신원 기능을 제공합니다.', zhSummary: '提供任务活动与链上身份服务。' },
  'guild': { koName: '길드', zhName: '公会', koSummary: '토큰 게이팅 커뮤니티 권한 관리를 지원합니다.', zhSummary: '支持代币门槛社区与权限管理。' },
  'zealy': { koName: '질리', zhName: '齐利', koSummary: '커뮤니티 퀘스트 및 참여 운영에 특화되어 있습니다.', zhSummary: '专注社区任务与增长运营。' },
  'cyberconnect': { koName: '사이버커넥트', zhName: '赛博连接', koSummary: '웹3 소셜 프로필과 관계망을 제공합니다.', zhSummary: '提供 Web3 社交身份与关系网络。' },
  'poap': { koName: '포앱', zhName: '出席证明', koSummary: '이벤트 참여를 온체인 배지로 기록합니다.', zhSummary: '用链上徽章记录活动参与。' },
  'mirror': { koName: '미러', zhName: '镜像', koSummary: '웹3 콘텐츠 발행 및 크리에이터 도구를 제공합니다.', zhSummary: '提供 Web3 内容发布与创作者工具。' },
  'deso': { koName: '디소', zhName: '去社交', koSummary: '분산형 소셜 애플리케이션 생태계를 지원합니다.', zhSummary: '去中心化社交应用生态。' },
  'dscvr': { koName: '디스커버', zhName: '发现者', koSummary: '포럼형 커뮤니티와 소셜 채널을 제공합니다.', zhSummary: '提供论坛式社区与社交频道。' },
  'axie infinity': { koName: '엑시 인피니티', zhName: '阿蟹无限', koSummary: 'NFT 캐릭터 수집·전투형 게임입니다.', zhSummary: 'NFT 角色收集与对战游戏。' },
  'pixels': { koName: '픽셀즈', zhName: '像素世界', koSummary: '소셜 농장형 웹3 게임 경험을 제공합니다.', zhSummary: '社交农场风格的 Web3 游戏。' },
  'splinterlands': { koName: '스플린터랜드', zhName: '裂隙之地', koSummary: '카드 전략과 NFT 덱 거래를 지원합니다.', zhSummary: '卡牌策略与 NFT 卡组交易。' },
  'alien worlds': { koName: '에일리언 월즈', zhName: '异星世界', koSummary: '메타버스 채굴 및 전략형 게임입니다.', zhSummary: '元宇宙挖矿与策略玩法。' },
  'gods unchained': { koName: '갓즈 언체인드', zhName: '众神解放', koSummary: 'NFT 카드 기반 전술 대전 게임입니다.', zhSummary: '基于 NFT 卡牌的战术对战游戏。' },
  'illuvium': { koName: '일루비움', zhName: '伊露维姆', koSummary: '오픈월드 RPG와 배틀 콘텐츠를 제공합니다.', zhSummary: '开放世界 RPG 与战斗生态。' },
  'parallel': { koName: '패러럴', zhName: '平行世界', koSummary: 'SF 카드게임 기반 웹3 진행 시스템입니다.', zhSummary: '科幻卡牌题材的 Web3 游戏。' },
  'the sandbox': { koName: '더샌드박스', zhName: '沙盒', koSummary: '유저 제작형 메타버스 월드를 제공합니다.', zhSummary: '用户创作型元宇宙平台。' },
  'decentraland': { koName: '디센트럴랜드', zhName: '去中心化乐园', koSummary: '가상 월드 기반 소셜·게임 환경을 지원합니다.', zhSummary: '虚拟世界中的社交与互动体验。' },
  'big time': { koName: '빅타임', zhName: '大时代', koSummary: '액션 RPG와 자산 거래형 경제를 제공합니다.', zhSummary: '动作 RPG 与资产交易经济系统。' }
};

const hasKorean = (value: string) => /[가-힣]/.test(value);
const hasChinese = (value: string) => /[\u4e00-\u9fff]/.test(value);

const localizeDiscoverDappText = (title: string, summary: string, lang: Language) => {
  if (lang === 'en') return { titlePrimary: title, titleSecondary: '', summary };
  const entry = discoverDappLocalizationMap[title.trim().toLowerCase()];
  const titleSecondary = lang === 'ko' ? entry?.koName ?? '' : entry?.zhName ?? '';

  let localizedSummary = summary;
  if (lang === 'ko') {
    if (!hasKorean(summary)) {
      localizedSummary = entry?.koSummary || `${title} 관련 주요 기능을 확인할 수 있습니다.`;
    }
  } else if (lang === 'zh') {
    if (!hasChinese(summary)) {
      localizedSummary = entry?.zhSummary || `可查看 ${title} 的核心功能信息。`;
    }
  }

  return {
    titlePrimary: title,
    titleSecondary,
    summary: localizedSummary
  };
};

const discoverDappIconOverrideMap: Record<string, ImageSourcePropType> = {
  '1inch': require('./assets/dapps/1inch.png'),
  'compound': require('./assets/dapps/compound.png'),
  // Stable explicit overrides for hosts that can return inconsistent favicon payloads.
  'looksrare': { uri: 'https://icons.duckduckgo.com/ip3/looksrare.org.ico' },
  'defillama': { uri: 'https://icons.duckduckgo.com/ip3/defillama.com.ico' }
};

type DiscoverDappIconInput = {
  title?: string;
  imageUrl?: string;
  sourceUrl?: string;
  ctaUrl?: string;
};

const resolveDiscoverDappIconSource = (item: DiscoverDappIconInput): ImageSourcePropType | undefined => {
  const byTitle = discoverDappIconOverrideMap[String(item.title || '').trim().toLowerCase()];
  if (byTitle) return byTitle;

  const imageUrl = String(item.imageUrl || '').trim();
  if (/^https?:\/\//i.test(imageUrl)) return { uri: imageUrl };

  const sourceCandidates = [String(item.ctaUrl || '').trim(), String(item.sourceUrl || '').trim()].filter(Boolean);
  for (const sourceUrl of sourceCandidates) {
    try {
      const host = new URL(sourceUrl).hostname;
      if (!host) continue;
      // Clearbit is blocked in many environments; use stable favicon providers first.
      return { uri: `https://icons.duckduckgo.com/ip3/${host}.ico` };
    } catch {
      // no-op
    }
  }
  return undefined;
};

const buildDiscoverDappIconCandidates = (item: DiscoverDappIconInput, preferredIconUrl?: string): string[] => {
  const byTitle = discoverDappIconOverrideMap[String(item.title || '').trim().toLowerCase()];
  const candidates: string[] = [];
  const preferredUrl = String(preferredIconUrl || '').trim();
  if (isRasterRemoteIconUrl(preferredUrl)) {
    candidates.push(preferredUrl);
  }
  if (byTitle && typeof byTitle === 'object' && 'uri' in byTitle && typeof byTitle.uri === 'string') {
    candidates.push(byTitle.uri);
  }

  const imageUrl = String(item.imageUrl || '').trim();
  if (/^https?:\/\//i.test(imageUrl)) candidates.push(imageUrl);

  const sourceCandidates = [String(item.ctaUrl || '').trim(), String(item.sourceUrl || '').trim()].filter(Boolean);
  sourceCandidates.forEach((sourceUrl) => {
    try {
      const host = new URL(sourceUrl).hostname.trim().toLowerCase();
      if (host) {
        candidates.push(`https://icons.duckduckgo.com/ip3/${host}.ico`);
        candidates.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=256`);
        candidates.push(`https://${host}/favicon.ico`);
      }
    } catch {
      // no-op
    }
  });

  return Array.from(new Set(candidates.filter((uri) => /^https?:\/\//i.test(String(uri).trim()))));
};

type WeeklyBriefingSeedItem = {
  id: string;
  publishedAt: string;
  title: LocalizedLabel;
  summary: LocalizedLabel;
  sources?: {
    label: LocalizedLabel;
    url: string;
  }[];
  points: {
    ko: string[];
    en: string[];
    zh: string[];
  };
};

type WeeklyBriefingPost = {
  id: string;
  publishedAt: string;
  title: string;
  summary: string;
  sources: {
    label: string;
    url: string;
  }[];
  points: string[];
};

type WeeklyBriefingWeekGroup = {
  weekKey: string;
  referenceDate: string;
  label: string;
  posts: WeeklyBriefingPost[];
};

const weeklyBriefingSeed: WeeklyBriefingSeedItem[] = [
  {
    id: 'briefing-2026-05-11-1',
    publishedAt: '2026-05-11',
    title: {
      ko: 'IMWallet 전용 레포와 배포 워크플로 정리',
      en: 'IMWallet Repo Scope and Delivery Workflows Tightened',
      zh: 'IMWallet 仓库范围与交付流程已收敛'
    },
    summary: {
      ko: '2026년 5월 8일 커밋에서 레포를 IMWallet 중심 구조로 정리하고, 앱 네이티브 빌드·OTA·백엔드 배포·공통 CI용 GitHub Actions 워크플로를 전용 경로로 추가했습니다. 이번 변경으로 제품 코드와 운영 경로가 한 축으로 정렬돼 릴리즈 준비와 변경 추적이 훨씬 단순해졌습니다.',
      en: 'On May 8, 2026, the repository was pruned down to an IMWallet-first structure and gained dedicated GitHub Actions workflows for native app builds, OTA delivery, backend deployment, and shared CI. That narrows the operational surface area and makes release ownership easier to track across the product stack.',
      zh: '在 2026 年 5 月 8 日的提交中，仓库被收敛为以 IMWallet 为中心的结构，并新增了原生 App 构建、OTA、后端部署与通用 CI 的专用 GitHub Actions 工作流。这让产品代码与交付路径更加一致，也更容易追踪发布责任。'
    },
    points: {
      ko: [
        '레포 정리: 비IMWallet 자산과 흐름을 줄이고 제품 중심 파일셋으로 재정렬했습니다.',
        '배포 경로: `imwallet-app-native-build`, `imwallet-app-ota`, `imwallet-backend-cd`, `imwallet-ci` 워크플로가 추가됐습니다.',
        '체크 포인트: 다음 주에는 실제 시크릿 주입과 워크플로 실행 결과가 안정적으로 연결되는지 확인해야 합니다.'
      ],
      en: [
        'Repo focus: non-IMWallet surface area was removed so the codebase now tracks the product more directly.',
        'Delivery path: dedicated workflows now exist for `imwallet-app-native-build`, `imwallet-app-ota`, `imwallet-backend-cd`, and `imwallet-ci`.',
        'What to watch: the next step is validating secrets and first-run workflow health in the real delivery environment.'
      ],
      zh: [
        '仓库聚焦：已去掉非 IMWallet 相关表面，代码库现在更直接映射产品本身。',
        '交付路径：现已具备 `imwallet-app-native-build`、`imwallet-app-ota`、`imwallet-backend-cd` 与 `imwallet-ci` 专用流程。',
        '关注点：下周应确认真实环境中的密钥注入与首次工作流执行是否稳定。'
      ]
    }
  },
  {
    id: 'briefing-2026-05-11-2',
    publishedAt: '2026-05-11',
    title: {
      ko: 'Discover 브리핑 고정과 DApp 데이터 경로 강화',
      en: 'Discover Briefing Pinning and DApp Data Resilience Improved',
      zh: 'Discover 简报固定逻辑与 DApp 数据韧性增强'
    },
    summary: {
      ko: '같은 주 변경에서 앱 `App.tsx`, 백엔드 `discover-content`, `market-dapps` 경로가 함께 정리되며 IMWallet 주간 브리핑 카드의 우선 노출 규칙과 DApp 랭킹 공급자 fallback 구조가 강화됐습니다. 사용자는 Discover 상단에서 내부 브리핑을 더 일관되게 보게 되고, 데이터 공급자가 흔들릴 때도 카테고리 피드가 더 안정적으로 유지됩니다.',
      en: 'The same update tightened the connection between the app’s Discover surface and backend content services, hardening the IMWallet weekly-briefing priority while improving fallback behavior for DApp ranking providers. In practice, the top Discover card becomes more predictable and category feeds stay more resilient when one upstream source is weak.',
      zh: '同一批更新同时整理了 App 的 Discover 界面与后端 `discover-content`、`market-dapps` 路径，强化了 IMWallet 周简报卡片的优先展示规则，也提升了 DApp 排名数据源的回退能力。实际效果是顶部卡片更稳定，分类内容在单一上游异常时也更不容易失效。'
    },
    points: {
      ko: [
        '브리핑 고정: Discover 상단 카드가 IMWallet 주간 브리핑을 우선/기본값으로 유지하도록 경로가 단단해졌습니다.',
        '데이터 fallback: DappRadar 미설정 또는 실패 시 DefiLlama 중심의 대체 경로와 진단 정보가 함께 제공됩니다.',
        '사용자 영향: 상단 카드 일관성과 DApp 카테고리 안정성이 동시에 개선됐습니다.'
      ],
      en: [
        'Briefing priority: the top Discover card is now more reliably anchored to the IMWallet weekly briefing.',
        'Provider fallback: when DappRadar is unavailable or not configured, the stack falls back with diagnostics instead of failing silently.',
        'User impact: Discover becomes more consistent at the top and more stable across DApp category feeds.'
      ],
      zh: [
        '简报优先级：Discover 顶部卡片现在更稳定地锚定到 IMWallet 每周简报。',
        '数据回退：当 DappRadar 不可用或未配置时，系统会带诊断信息地切换到备用来源，而不是静默失败。',
        '用户影响：顶部内容一致性与 DApp 分类稳定性同步提升。'
      ]
    }
  },
  {
    id: 'briefing-2026-05-11-3',
    publishedAt: '2026-05-11',
    title: {
      ko: '운영 실행 가이드와 프로덕션 프리플라이트 문서 확장',
      en: 'Run Guides and Production Preflight Docs Expanded',
      zh: '运行指南与生产预检文档已扩展'
    },
    summary: {
      ko: '이번 주에는 `IMWALLET_RUN_GUIDE.md`, `backend/README.md`, 컷오버·스모크·키 주입 스크립트 문서가 함께 추가되며 앱, 콘솔, 백엔드를 한 흐름으로 실행·검증하는 기준이 정리됐습니다. 제품 자체 기능 추가만큼이나 운영 재현성과 배포 전 점검 절차가 구체화된 것이 이번 주의 핵심 진전입니다.',
      en: 'This week also added a fuller operating layer through `IMWALLET_RUN_GUIDE.md`, the backend README, and preflight/key-injection/smoke documentation. The result is a clearer path to run, validate, and cut over the app, console, and backend as one system rather than as disconnected pieces.',
      zh: '本周还补齐了 `IMWALLET_RUN_GUIDE.md`、后端 README 以及预检、密钥注入、冒烟检查相关文档，把 App、Console 与 Backend 作为一个系统来运行与验收的路径写清楚了。对本周来说，这种可复现的运营基线与功能更新同样重要。'
    },
    points: {
      ko: [
        '실행 기준: Expo 앱, 콘솔, 백엔드, 홀더 스모크, 프리플라이트 명령이 한 문서 흐름으로 정리됐습니다.',
        '운영 체크: `.env.production.keys`, 키체인 연동, DB 백업/복구 리허설 절차가 문서화됐습니다.',
        '체크 포인트: 다음 단계는 문서 기준으로 실제 컷오버 리허설을 한 번 끝까지 돌려 보는 것입니다.'
      ],
      en: [
        'Execution baseline: app, console, backend, holder smoke, and preflight commands now live in one documented flow.',
        'Ops coverage: production key files, keychain sync, and DB backup/restore rehearsal steps are now spelled out.',
        'What to watch: the next milestone is a full cutover rehearsal strictly following the new runbook.'
      ],
      zh: [
        '执行基线：App、Console、Backend、holder 冒烟与 preflight 命令现已汇总到同一套流程文档中。',
        '运维覆盖：生产密钥文件、钥匙串同步以及数据库备份/恢复演练步骤都已明确写出。',
        '关注点：下一步应严格按新 runbook 完成一次完整 cutover 演练。'
      ]
    }
  },
  {
    id: 'briefing-2026-05-04-1',
    publishedAt: '2026-05-04',
    title: {
      ko: '비트코인 ETF 순유입 9일 연속 종료, 연준 앞두고 관망 전환',
      en: 'Bitcoin ETF Inflow Streak Ends Before the Fed, Shifting Markets Into Wait Mode',
      zh: '比特币 ETF 九连增流入告终，市场在美联储前转入观望'
    },
    summary: {
      ko: '2026년 4월 28일 미국 현물 비트코인 ETF는 9거래일 연속 순유입 뒤 2억6320만달러 순유출로 돌아섰고, 시장은 같은 주 FOMC를 앞두고 빠르게 관망 모드로 이동했습니다. 가격이 한 달 기준으로는 여전히 강했지만, 이번 주 초 흐름은 상승 추세의 방향성보다 매크로 이벤트 직전 포지션 조정이 더 큰 힘으로 작동한다는 점을 보여줬습니다.',
      en: 'On April 28, 2026, U.S. spot bitcoin ETFs flipped to $263.2 million in net outflows after a nine-session inflow streak, and the market moved into a more tactical wait-and-see stance ahead of that week’s FOMC meeting. Bitcoin still held up well on a one-month view, but early-week price action showed that pre-macro positioning mattered more than broad risk appetite.',
      zh: '2026 年 4 月 28 日，美国现货比特币 ETF 在连续 9 个交易日净流入后转为净流出 2.632 亿美元，市场也在同周 FOMC 会议前迅速进入观望模式。虽然比特币按月看仍然偏强，但周初走势说明，在宏观事件前，仓位调整的影响大于全面风险偏好回升。'
    },
    sources: [
      {
        label: {
          ko: 'The Block 보도 (4월 28일)',
          en: 'The Block coverage (Apr 28)',
          zh: 'The Block 报道（4 月 28 日）'
        },
        url: 'https://www.theblock.co/post/399129/bitcoin-etf-outflows-snap-nine-day-streak-ahead-of-fomc-as-market-tests-resolve-near-77000'
      }
    ],
    points: {
      ko: [
        '왜 중요한가: 최근 반등장이 이어져도 ETF 자금이 꺾이면 단기 심리는 빠르게 보수적으로 돌아설 수 있습니다.',
        '시장 포인트: 이번 주 초 핵심 변수는 가격 자체보다 연준 전후의 자금 방향과 위험자산 포지셔닝이었습니다.',
        '체크 포인트: 다음 주에도 ETF 일간 유입·유출과 비트코인 7만7000달러 안착 여부를 함께 봐야 합니다.'
      ],
      en: [
        'Why it matters: even during a rebound, ETF flow reversals can quickly turn short-term sentiment defensive.',
        'Market signal: early this week, the key variable was not price alone but flow direction and risk positioning around the Fed.',
        'What to watch: daily ETF prints and whether bitcoin can stay established around the $77,000 zone.'
      ],
      zh: [
        '为何重要：即使反弹仍在继续，只要 ETF 资金流转弱，短线情绪就可能迅速转向保守。',
        '市场信号：本周初真正主导市场的不是价格本身，而是美联储前后的资金方向与风险仓位。',
        '关注点：下周要继续观察 ETF 日度流向，以及比特币能否稳住 7.7 万美元区域。'
      ]
    }
  },
  {
    id: 'briefing-2026-05-04-2',
    publishedAt: '2026-05-04',
    title: {
      ko: '4월 해킹 건수 사상 최고, 강세장 속 보안 리스크 재부각',
      en: 'April Sets a Record for Crypto Hacks, Repricing Security Risk During the Rally',
      zh: '4 月加密黑客事件创纪录，反弹行情中安全风险重新定价'
    },
    summary: {
      ko: '2026년 4월 30일 기준 DeFiLlama 집계에서 4월은 사고 건수 기준 역대 가장 많이 해킹이 발생한 달로 정리됐습니다. 총 피해액이 사상 최대는 아니더라도, 사건 수가 20건을 크게 넘기며 시장의 관심이 다시 수익률보다 보안 품질과 자산 보관 구조로 이동했고, 강세장 기대감과 별개로 체인 사용 리스크는 여전히 높다는 점이 확인됐습니다.',
      en: 'As of April 30, 2026, DeFiLlama data showed April becoming the most-hacked month in crypto history by incident count. Even without a record dollar loss total, the number of exploits moved well past 20, shifting attention away from upside narratives and back toward custody quality, protocol hygiene, and the still-elevated operational risk of using onchain products.',
      zh: '截至 2026 年 4 月 30 日，DeFiLlama 数据显示 4 月按事件数量计算已成为加密史上黑客攻击最多的月份。即使损失金额并非历史最高，事故数量仍明显超过 20 起，市场关注点也从上涨叙事重新回到托管质量、协议卫生以及链上产品仍然偏高的操作风险。'
    },
    sources: [
      {
        label: {
          ko: 'The Block 보도 (4월 30일)',
          en: 'The Block coverage (Apr 30)',
          zh: 'The Block 报道（4 月 30 日）'
        },
        url: 'https://www.theblock.co/amp/post/399666/crypto-hacks-hit-record-high-in-april-as-exploits-kept-piling-up'
      }
    ],
    points: {
      ko: [
        '왜 중요한가: 가격 반등 구간에서도 해킹이 늘어나면 위험자산 선호가 확산되기보다 사용자 보수성이 먼저 커질 수 있습니다.',
        '시장 포인트: 이번 주 브리핑에서 보안은 주변 이슈가 아니라 참여 심리와 자금 회전에 직접 연결된 변수였습니다.',
        '체크 포인트: 신규 자금이 DeFi로 확산되는지 보려면 TVL보다도 보안 사고 빈도와 사고 후 회복 속도를 같이 봐야 합니다.'
      ],
      en: [
        'Why it matters: during a rally, rising hack frequency can make user behavior more defensive before capital broadens out.',
        'Market signal: security was not a side story this week; it directly affected confidence and the willingness to rotate into higher-risk onchain activity.',
        'What to watch: beyond TVL, track exploit frequency and recovery quality to judge whether fresh capital will keep moving into DeFi.'
      ],
      zh: [
        '为何重要：即使价格回暖，黑客事件增多也会先提升用户的防御性，而不是扩大风险偏好。',
        '市场信号：本周安全并非边缘议题，而是直接影响信心与资金是否愿意轮动至更高风险链上活动的核心变量。',
        '关注点：判断新资金会否继续流向 DeFi，除了看 TVL，也要同时看事故频率与事后恢复质量。'
      ]
    }
  },
  {
    id: 'briefing-2026-05-04-3',
    publishedAt: '2026-05-04',
    title: {
      ko: '스테이블코인 보상 절충안 도출, 미국 시장구조 법안 5월 분수령',
      en: 'Stablecoin Rewards Compromise Puts U.S. Crypto Legislation at a May Inflection Point',
      zh: '稳定币奖励折中方案落地，美国加密立法进入 5 月关键窗口'
    },
    summary: {
      ko: '2026년 5월 2일 보도에 따르면 미국 상원 논의에서 스테이블코인 보상 조항 절충안이 정리되며 CLARITY Act 마크업 재개 기대가 다시 살아났습니다. 이번 이슈는 단기 가격보다도 중기 시장 구조에 더 중요한데, 규제 해석이 명확해질수록 스테이블코인 유통, 거래소 유동성, 온체인 서비스 확장에 대한 할인율이 낮아질 수 있기 때문입니다.',
      en: 'Reporting on May 2, 2026 showed lawmakers reaching a compromise on the stablecoin rewards language that had stalled the CLARITY Act, reviving expectations for Senate markup. The importance here is more structural than immediate price action: clearer rules can lower the market’s discount on stablecoin distribution, exchange liquidity, and broader onchain product expansion.',
      zh: '根据 2026 年 5 月 2 日的报道，美国参议院围绕稳定币奖励条款达成折中方案，之前被其卡住的 CLARITY Act 因此重新获得推进预期。这个主题的重要性更多体现在中期市场结构上，而非短线价格，因为规则越清晰，市场对稳定币流通、交易所流动性与链上服务扩张的折价就越可能下降。'
    },
    sources: [
      {
        label: {
          ko: 'The Block 보도 (5월 2일)',
          en: 'The Block coverage (May 2)',
          zh: 'The Block 报道（5 月 2 日）'
        },
        url: 'https://www.theblock.co/post/399780/coinbase-says-deal-reached-on-clarity-act-stablecoin-yield-clearing-path-to-long-stalled-senate-markup'
      }
    ],
    points: {
      ko: [
        '왜 중요한가: 정책 명확성은 단기 펌프보다 오래가는 유동성 프리미엄을 만들 수 있는 변수입니다.',
        '시장 포인트: 이번 주 규제 이슈의 핵심은 법안 통과 자체보다 스테이블코인 보상과 활동성 인센티브가 어디까지 허용되는지였습니다.',
        '체크 포인트: 5월 상원 마크업 일정과 후속 문구가 거래소·스테이블코인 관련 섹터 심리에 직접 영향을 줄 가능성이 큽니다.'
      ],
      en: [
        'Why it matters: policy clarity can create a more durable liquidity premium than a short-lived headline rally.',
        'Market signal: the key question this week was not only whether a bill advances, but how far stablecoin rewards and usage-based incentives remain permitted.',
        'What to watch: the Senate markup calendar and follow-on bill text could directly shape sentiment across exchange and stablecoin-related sectors.'
      ],
      zh: [
        '为何重要：政策清晰度往往比短暂拉升更能带来持续性的流动性溢价。',
        '市场信号：本周监管主题的关键不只是法案是否推进，而是稳定币奖励与基于活动的激励究竟能保留到什么程度。',
        '关注点：5 月参议院审议时间表与后续文本，很可能直接影响交易所和稳定币相关板块的情绪。'
      ]
    }
  },
  {
    id: 'briefing-2026-04-20-1',
    publishedAt: '2026-04-20',
    title: {
      ko: '주소록 관리 입력 문구/딤 동작 정리',
      en: 'Address Book Copy and Dim Behavior Aligned',
      zh: '地址簿输入文案与暗层行为统一'
    },
    summary: {
      ko: '주소록 관리 화면에서 받는 주소/라벨 입력 문구를 통일하고, 수정 모달의 딤 처리 방식을 단일 오버레이 규칙으로 재정렬했습니다. 사용자가 화면별로 다른 표현과 상호작용을 겪지 않도록 기준을 맞췄습니다.',
      en: 'In Address Book Management, recipient/label placeholders were unified and edit-modal dim behavior was aligned to a single overlay rule. This removes copy and interaction inconsistencies across related screens.',
      zh: '在地址簿管理中，我们统一了收款地址/标签占位文案，并将编辑弹层暗化方式调整为单一覆盖层规则，减少页面间文案和交互不一致。'
    },
    points: {
      ko: [
        '문구 통일: 받는 주소를 입력하세요 / 라벨을 입력하세요.',
        '수정 모달 오버레이: 배경 단일 딤 + 비활성 영역 클릭 차단.',
        '다국어 반영: 한국어/영어/중국어 모두 동일 의미로 동기화.'
      ],
      en: [
        'Copy unified: “Please enter recipient address” and “Please enter label.”',
        'Edit modal overlay: single dim with blocked interaction on background.',
        'Localization synced across Korean, English, and Chinese.'
      ],
      zh: [
        '文案统一为“请输入收款地址”“请输入标签”。',
        '编辑弹层采用单一暗层并阻断背景交互。',
        '韩/英/中三语语义保持一致。'
      ]
    }
  },
  {
    id: 'briefing-2026-04-20-2',
    publishedAt: '2026-04-20',
    title: {
      ko: '보내기 화면 하단 네비게이션 가시성 복구',
      en: 'Bottom Navigation Restored on Send Screens',
      zh: '发送页底部导航显示已恢复'
    },
    summary: {
      ko: '보내기 화면에서 하단 네비게이션이 숨겨져 흐름 전환이 불편하다는 피드백에 대응해, 자산/NFT 보내기 상태에서도 하단 도크가 일관되게 노출되도록 복구했습니다.',
      en: 'Following feedback about hidden navigation on Send flows, we restored consistent bottom dock visibility for both Asset and NFT Send states to improve movement across tabs.',
      zh: '针对发送流程中底部导航消失导致切换不便的问题，我们已恢复资产/NFT发送状态下的一致底部导航显示。'
    },
    points: {
      ko: [
        '적용 화면: 자산 보내기, NFT 보내기.',
        '효과: 화면 전환 비용 감소 및 탭 이동 일관성 개선.',
        '검증: 상태 전환 후에도 도크 노출 유지 여부 체크 완료.'
      ],
      en: [
        'Applied to: Asset Send and NFT Send screens.',
        'Impact: lower navigation friction and better tab consistency.',
        'Validation: confirmed dock remains visible across send-state transitions.'
      ],
      zh: [
        '应用范围：资产发送与 NFT 发送页面。',
        '效果：降低页面切换成本，提升标签切换一致性。',
        '验证：已确认状态切换后底部导航持续可见。'
      ]
    }
  },
  {
    id: 'briefing-2026-04-20-3',
    publishedAt: '2026-04-20',
    title: {
      ko: '기록 페이지 기간 필터 상호작용 기준화',
      en: 'History Date-Range Interaction Standardized',
      zh: '记录页日期筛选交互标准化'
    },
    summary: {
      ko: '기록 화면의 기간 필터 모달에서 헤더·본문 딤, 트리거 예외 처리, 닫힘 동작을 공통 기준에 맞췄습니다. 사용자가 다른 화면과 동일한 규칙으로 기간을 선택할 수 있도록 정리했습니다.',
      en: 'The History range-filter modal now follows shared rules for header/body dimming, trigger exceptions, and close behavior. Users can interact with date range controls using the same pattern as other dropdown surfaces.',
      zh: '记录页日期区间筛选弹层现已对齐统一规则：头部/正文暗化、触发器例外与关闭行为一致，用户可按与其他下拉相同的模式操作。'
    },
    points: {
      ko: [
        '기간 버튼 활성 상태와 모달 노출 상태를 일관된 시각 규칙으로 정리.',
        '닫기 버튼/배경 탭 모두 동일한 종료 경로로 통합.',
        '다른 드롭다운과 충돌하지 않도록 우선순위 및 스크롤 잠금 기준 정렬.'
      ],
      en: [
        'Period-trigger active style and modal visibility now share one visual rule.',
        'Close button and backdrop tap converge on the same dismiss path.',
        'Priority and scroll-lock behavior aligned to avoid collisions with other dropdowns.'
      ],
      zh: [
        '周期按钮激活态与弹层展示状态已统一视觉规则。',
        '关闭按钮与背景点击共用同一关闭路径。',
        '优先级与滚动锁定规则已对齐，避免与其他下拉冲突。'
      ]
    }
  }
];

const HTTP_URL_REGEX = /^https?:\/\//i;

const TRUSTED_DISCOVER_DAPP_HOSTS = [
  'pancakeswap.finance',
  'app.uniswap.org',
  'opensea.io',
  'app.aave.com',
  'stake.lido.fi',
  'galxe.com',
  'defillama.com',
  'dune.com',
  'coingecko.com',
  'coinmarketcap.com',
  'metamask.io',
  'mempool.space',
  'blockchain.com'
] as const;

const BLOCKED_DISCOVER_DAPP_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '::1'] as const;
const SUSPICIOUS_DISCOVER_TLDS = ['zip', 'mov', 'country', 'gq', 'tk', 'cf', 'ml'] as const;

const isHttpUrl = (value: string) => HTTP_URL_REGEX.test(value.trim());

const resolveDiscoverExternalUrl = (item: Pick<DiscoverFeedItem, 'sourceUrl' | 'ctaUrl'>) => {
  const ctaUrl = item.ctaUrl.trim();
  if (isHttpUrl(ctaUrl)) return ctaUrl;
  const sourceUrl = item.sourceUrl.trim();
  if (isHttpUrl(sourceUrl)) return sourceUrl;
  return '';
};

const normalizeDiscoverActionType = (
  actionType: DiscoverActionType,
  internalTarget: string,
  externalUrl: string
): DiscoverActionType => {
  const hasInternalTarget = Boolean(internalTarget.trim());
  const hasExternalUrl = Boolean(externalUrl);

  if (actionType === 'internal') {
    if (hasInternalTarget) return 'internal';
    return hasExternalUrl ? 'external' : 'none';
  }
  if (actionType === 'external') {
    if (hasExternalUrl) return 'external';
    return hasInternalTarget ? 'internal' : 'none';
  }
  if (hasInternalTarget) return 'internal';
  if (hasExternalUrl) return 'external';
  return 'none';
};

const normalizeHost = (hostRaw: string) => hostRaw.trim().toLowerCase().replace(/\.$/, '');

const isIpv4Host = (host: string) => {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  return host.split('.').every((chunk) => {
    const num = Number(chunk);
    return Number.isInteger(num) && num >= 0 && num <= 255;
  });
};

const isIpv6Host = (host: string) => host.includes(':');

const hostMatchesDomain = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

const normalizeDiscoverTrustedHost = (raw: string) => {
  const source = String(raw ?? '').trim().toLowerCase();
  if (!source) return '';

  let host = '';
  try {
    const parsed = new URL(/^https?:\/\//i.test(source) ? source : `https://${source}`);
    host = normalizeHost(parsed.hostname).replace(/^\*\./, '');
  } catch {
    return '';
  }

  if (!host) return '';
  if (isIpv4Host(host) || isIpv6Host(host)) return '';
  if (!host.includes('.')) return '';
  if (host.startsWith('.') || host.endsWith('.') || host.includes('..')) return '';
  if (!/^[a-z0-9.-]+$/.test(host)) return '';

  const labels = host.split('.');
  if (
    labels.some(
      (label) => !label || label.length > 63 || label.startsWith('-') || label.endsWith('-')
    )
  ) {
    return '';
  }
  return host;
};

const getDiscoverUrlSecurityCheck = (normalizedUrl: string): DiscoverUrlSecurityCheck => {
  try {
    const parsed = new URL(normalizedUrl);
    const host = normalizeHost(parsed.hostname);

    if (!host) return { level: 'blocked', host: '', reason: 'invalid-url' };
    if (parsed.protocol !== 'https:') return { level: 'blocked', host, reason: 'insecure-protocol' };
    if (BLOCKED_DISCOVER_DAPP_HOSTS.some((blocked) => hostMatchesDomain(host, blocked))) {
      return { level: 'blocked', host, reason: 'blocked-host' };
    }
    if (host.startsWith('xn--') || host.includes('.xn--')) return { level: 'high', host, reason: 'punycode' };
    if (isIpv4Host(host) || isIpv6Host(host)) return { level: 'high', host, reason: 'ip-host' };

    const tld = host.split('.').pop() ?? '';
    if (SUSPICIOUS_DISCOVER_TLDS.includes(tld as (typeof SUSPICIOUS_DISCOVER_TLDS)[number])) {
      return { level: 'high', host, reason: 'suspicious-tld' };
    }
    if (TRUSTED_DISCOVER_DAPP_HOSTS.some((trusted) => hostMatchesDomain(host, trusted))) {
      return { level: 'safe', host, reason: 'trusted' };
    }
    return { level: 'caution', host, reason: 'unknown' };
  } catch {
    return { level: 'blocked', host: '', reason: 'invalid-url' };
  }
};

const chainLabelMap: Record<ChainCode, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  XRP: 'XRP Ledger',
  BSC: 'BNB Smart Chain',
  SOL: 'Solana',
  TRX: 'TRON',
  FIL: 'Filecoin'
};

const ONBOARDING_NETWORK_OPTIONS: Array<{ label: string; chainCode: ChainCode }> = [
  { label: 'Ethereum', chainCode: 'ETH' },
  { label: 'BNB Smart Chain', chainCode: 'BSC' },
  { label: 'Solana', chainCode: 'SOL' },
  { label: 'Bitcoin', chainCode: 'BTC' },
  { label: 'TRON', chainCode: 'TRX' },
  { label: 'XRP Ledger', chainCode: 'XRP' },
  { label: 'Filecoin', chainCode: 'FIL' }
];

const resolveOnboardingNetworkChainCode = (networkLabel: string): ChainCode =>
  ONBOARDING_NETWORK_OPTIONS.find((item) => item.label === networkLabel)?.chainCode ?? 'ETH';

const coinIconMap: Record<AssetKey, ImageSourcePropType> = {
  BTC: require('./assets/coins/btc.png'),
  ETH: require('./assets/coins/eth.png'),
  XRP: require('./assets/coins/xrp.png'),
  BNB: require('./assets/coins/bnb.png'),
  SOL: require('./assets/coins/sol.png'),
  TRX: require('./assets/coins/trx.png'),
  FIL: require('./assets/coins/fil.png'),
  USDT: require('./assets/coins/usdt.png')
};

const discoverPopularLocalIconMap: Record<string, ImageSourcePropType> = {
  BTC: coinIconMap.BTC,
  ETH: coinIconMap.ETH,
  XRP: coinIconMap.XRP,
  BNB: coinIconMap.BNB,
  SOL: coinIconMap.SOL,
  TRX: coinIconMap.TRX,
  FIL: coinIconMap.FIL,
  USDT: coinIconMap.USDT,
  USDC: require('./assets/coins/usdc.png')
};

const isRasterRemoteIconUrl = (value: string) => {
  const normalized = String(value || '').trim();
  if (!/^https?:\/\//i.test(normalized)) return false;
  const lowered = normalized.toLowerCase();
  if (lowered.includes('.svg')) return false;
  return true;
};

const toDiscoverIconCacheKey = (value: string) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

const getDiscoverIconHostFromUrl = (urlRaw: string) => {
  const normalizedUrl = String(urlRaw || '').trim();
  if (!isHttpUrl(normalizedUrl)) return '';
  try {
    return normalizeHost(new URL(normalizedUrl).hostname).replace(/^www\./, '');
  } catch {
    return '';
  }
};

const getDiscoverDappIconCacheKey = (item: {
  id?: string;
  title?: string;
  sourceUrl?: string;
  ctaUrl?: string;
  url?: string;
}) => {
  const ctaUrl = String(item.ctaUrl || '').trim();
  const sourceUrl = String(item.sourceUrl || item.url || '').trim();
  const preferredUrl = isHttpUrl(ctaUrl) ? ctaUrl : sourceUrl;
  const hostKey = getDiscoverIconHostFromUrl(preferredUrl);
  return toDiscoverIconCacheKey(hostKey || String(item.id || '').trim() || String(item.title || '').trim());
};

const getDiscoverSiteIconCacheKey = (item: { id?: string; domain?: string; url?: string }) => {
  const domainKey = normalizeDiscoverTrustedHost(String(item.domain || '').trim());
  if (domainKey) return toDiscoverIconCacheKey(domainKey);
  const hostKey = getDiscoverIconHostFromUrl(String(item.url || '').trim());
  return toDiscoverIconCacheKey(hostKey || String(item.id || '').trim());
};

const buildDiscoverPopularIconCandidates = (_symbol: string, iconUrl?: string, preferredIconUrl?: string): string[] => {
  const candidates: string[] = [];
  const normalizedPreferredUrl = String(preferredIconUrl || '').trim();
  const normalizedIconUrl = String(iconUrl || '').trim();

  if (isRasterRemoteIconUrl(normalizedPreferredUrl)) {
    candidates.push(normalizedPreferredUrl);
  }

  if (isRasterRemoteIconUrl(normalizedIconUrl)) {
    candidates.push(normalizedIconUrl);
  }

  if (normalizedIconUrl) {
    const proxyMatch = normalizedIconUrl.match(/token-icon\/(\d+)/i);
    const staticMatch = normalizedIconUrl.match(/\/(\d+)\.png(?:\?.*)?$/i);
    const iconIdRaw = proxyMatch?.[1] ?? staticMatch?.[1] ?? '';
    const iconId = Number(iconIdRaw);
    if (Number.isFinite(iconId) && iconId > 0) {
      const safeId = Math.floor(iconId);
      candidates.push(`https://s2.coinmarketcap.com/static/img/coins/64x64/${safeId}.png`);
      candidates.push(`https://s2.coinmarketcap.com/static/img/coins/128x128/${safeId}.png`);
    }
  }

  return Array.from(new Set(candidates));
};

const buildDiscoverSiteIconCandidates = (domainRaw: string, preferredIconUrl?: string): string[] => {
  const domain = domainRaw.trim().toLowerCase();
  const preferredUrl = String(preferredIconUrl || '').trim();
  if (!domain && !isRasterRemoteIconUrl(preferredUrl)) return [];
  const explicitOverrides: Record<string, string> = {
    'defillama.com': 'https://defillama.com/favicon.ico',
    'looksrare.org': 'https://icons.duckduckgo.com/ip3/looksrare.org.ico'
  };
  const override = explicitOverrides[domain];
  return Array.from(
    new Set([
      ...(isRasterRemoteIconUrl(preferredUrl) ? [preferredUrl] : []),
      ...(override ? [override] : []),
      `https://icons.duckduckgo.com/ip3/${domain}.ico`,
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=256`,
      `https://${domain}/favicon.ico`
    ].filter(Boolean))
  );
};

const chainIconMap: Record<ChainCode, ImageSourcePropType> = {
  BTC: require('./assets/coins/btc.png'),
  ETH: require('./assets/coins/eth.png'),
  XRP: require('./assets/coins/xrp.png'),
  BSC: require('./assets/coins/bnb.png'),
  SOL: require('./assets/coins/sol.png'),
  TRX: require('./assets/coins/trx.png'),
  FIL: require('./assets/coins/fil.png')
};

const chainTickerMap: Record<ChainCode, string> = {
  BTC: 'BTC',
  ETH: 'ETH',
  XRP: 'XRP',
  BSC: 'BNB',
  SOL: 'SOL',
  TRX: 'TRX',
  FIL: 'FIL'
};

const chainNativeAssetMap: Record<ChainCode, AssetKey> = {
  BTC: 'BTC',
  ETH: 'ETH',
  XRP: 'XRP',
  BSC: 'BNB',
  SOL: 'SOL',
  TRX: 'TRX',
  FIL: 'FIL'
};

const chainOrder: ChainCode[] = ['BTC', 'ETH', 'XRP', 'BSC', 'SOL', 'TRX', 'FIL'];

const chainWalletAddresses: Record<ChainCode, string> = {
  BTC: '',
  ETH: '',
  XRP: '',
  BSC: '',
  SOL: '',
  TRX: '',
  FIL: ''
};

const chainRegexMap: Record<ChainCode, RegExp> = {
  BTC: /^(bc1[a-z0-9]{25,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/,
  ETH: /^0x[a-fA-F0-9]{40}$/,
  XRP: /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/,
  BSC: /^0x[a-fA-F0-9]{40}$/,
  SOL: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  TRX: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
  FIL: /^f[1-4][a-z0-9]{20,120}$/
};

type RecentSendItem = {
  address: string;
  chain: ChainCode;
  amount: number;
  symbol: string;
  date: string;
  label?: string;
  memo?: string;
};

type RecentNftSendItem = {
  address: string;
  date: string;
  nftTitle: string;
  tokenId?: string;
  label?: string;
  memo?: string;
  chain: ChainCode;
};

const tokenCatalog: WalletToken[] = [
  {
    id: 'btc',
    assetKey: 'BTC',
    symbol: 'BTC',
    name: 'Bitcoin',
    network: 'Bitcoin',
    chainCode: 'BTC',
    chainLabel: chainLabelMap.BTC,
    walletAddress: chainWalletAddresses.BTC,
    balance: 0,
    priceUsd: 84500,
    change24h: 2.87,
    iconBg: '#f7931a',
    iconGlyph: 'B',
    iconSource: coinIconMap.BTC,
    chainIconSource: chainIconMap.BTC,
    verified: true
  },
  {
    id: 'eth',
    assetKey: 'ETH',
    symbol: 'ETH',
    name: 'Ethereum',
    network: 'Ethereum',
    chainCode: 'ETH',
    chainLabel: chainLabelMap.ETH,
    walletAddress: chainWalletAddresses.ETH,
    balance: 0,
    priceUsd: 3550,
    change24h: -1.34,
    iconBg: '#627eea',
    iconGlyph: 'E',
    iconSource: coinIconMap.ETH,
    chainIconSource: chainIconMap.ETH,
    verified: true
  },
  {
    id: 'xrp',
    assetKey: 'XRP',
    symbol: 'XRP',
    name: 'Ripple',
    network: 'XRP Ledger',
    chainCode: 'XRP',
    chainLabel: chainLabelMap.XRP,
    walletAddress: chainWalletAddresses.XRP,
    balance: 0,
    priceUsd: 0.64,
    change24h: 1.12,
    iconBg: '#0f172a',
    iconGlyph: 'X',
    iconSource: coinIconMap.XRP,
    chainIconSource: chainIconMap.XRP,
    verified: true
  },
  {
    id: 'bnb',
    assetKey: 'BNB',
    symbol: 'BNB',
    name: 'BNB',
    network: 'BNB Smart Chain',
    chainCode: 'BSC',
    chainLabel: chainLabelMap.BSC,
    walletAddress: chainWalletAddresses.BSC,
    balance: 0,
    priceUsd: 612,
    change24h: 1.96,
    iconBg: '#f3ba2f',
    iconGlyph: 'B',
    iconSource: coinIconMap.BNB,
    chainIconSource: chainIconMap.BSC,
    verified: true
  },
  {
    id: 'sol',
    assetKey: 'SOL',
    symbol: 'SOL',
    name: 'Solana',
    network: 'Solana',
    chainCode: 'SOL',
    chainLabel: chainLabelMap.SOL,
    walletAddress: chainWalletAddresses.SOL,
    balance: 0,
    priceUsd: 178,
    change24h: 6.42,
    iconBg: '#00d1ff',
    iconGlyph: 'S',
    iconSource: coinIconMap.SOL,
    chainIconSource: chainIconMap.SOL,
    verified: true
  },
  {
    id: 'trx',
    assetKey: 'TRX',
    symbol: 'TRX',
    name: 'TRON',
    network: 'TRON',
    chainCode: 'TRX',
    chainLabel: chainLabelMap.TRX,
    walletAddress: chainWalletAddresses.TRX,
    balance: 0,
    priceUsd: 0.14,
    change24h: 4.21,
    iconBg: '#ef4444',
    iconGlyph: 'T',
    iconSource: coinIconMap.TRX,
    chainIconSource: chainIconMap.TRX,
    verified: true
  },
  {
    id: 'fil',
    assetKey: 'FIL',
    symbol: 'FIL',
    name: 'Filecoin',
    network: 'Filecoin',
    chainCode: 'FIL',
    chainLabel: chainLabelMap.FIL,
    walletAddress: chainWalletAddresses.FIL,
    balance: 0,
    priceUsd: 5.9,
    change24h: -0.88,
    iconBg: '#0090ff',
    iconGlyph: 'F',
    iconSource: coinIconMap.FIL,
    chainIconSource: chainIconMap.FIL,
    verified: true
  },
  {
    id: 'usdt-erc',
    assetKey: 'USDT',
    symbol: 'USDT',
    name: 'Tether',
    network: 'Ethereum (ERC-20)',
    chainCode: 'ETH',
    chainLabel: chainLabelMap.ETH,
    chainBadge: 'E',
    walletAddress: chainWalletAddresses.ETH,
    balance: 0,
    priceUsd: 1,
    change24h: 0,
    iconBg: '#26a17b',
    iconGlyph: 'T',
    iconSource: coinIconMap.USDT,
    chainIconSource: chainIconMap.ETH,
    verified: true
  },
  {
    id: 'usdt-trc',
    assetKey: 'USDT',
    symbol: 'USDT',
    name: 'Tether',
    network: 'TRON (TRC-20)',
    chainCode: 'TRX',
    chainLabel: chainLabelMap.TRX,
    chainBadge: 'T',
    walletAddress: chainWalletAddresses.TRX,
    balance: 0,
    priceUsd: 1,
    change24h: 0,
    iconBg: '#26a17b',
    iconGlyph: 'T',
    iconSource: coinIconMap.USDT,
    chainIconSource: chainIconMap.TRX,
    verified: true
  },
  {
    id: 'usdt-bsc',
    assetKey: 'USDT',
    symbol: 'USDT',
    name: 'Tether',
    network: 'BNB Smart Chain (BEP-20)',
    chainCode: 'BSC',
    chainLabel: chainLabelMap.BSC,
    chainBadge: 'B',
    walletAddress: chainWalletAddresses.BSC,
    balance: 0,
    priceUsd: 1,
    change24h: 0,
    iconBg: '#26a17b',
    iconGlyph: 'T',
    iconSource: coinIconMap.USDT,
    chainIconSource: chainIconMap.BSC,
    verified: true
  }
];

const defaultEnabledTokenIds = ['btc', 'eth', 'xrp', 'bnb', 'sol', 'trx', 'fil', 'usdt-erc', 'usdt-trc', 'usdt-bsc'];

const DEFAULT_SEND_GAS_SETTINGS: SendGasSettings = {
  gasPrice: '0.1',
  gasLimit: '21000',
  txData: '',
  nonce: '3'
};

const copy: Record<Language, Copy> = {
  ko: {
    locale: 'ko-KR',
    home: '지갑',
    swap: '스왑',
    hotTokens: '핫 토큰',
    earn: '수익',
    discover: '둘러보기',
    settings: '설정',
    wallet: '지갑',
    totalBalance: '총 잔액',
    send: '보내기',
    receive: '받기',
    buy: '구매',
    sell: '판매',
    history: '기록',
    historyFilterType: '구분',
    historyTypeAsset: '자산',
    historyTypeNft: 'NFT',
    historyTypeNftHint: 'NFT 기록은 자산 필터를 사용하지 않습니다.',
    historyFilterChain: '체인',
    historyFilterAsset: '자산',
    historyFilterAssetHint: '체인을 선택하면 자산이 표시됩니다.',
    receiveFilterAddressHint: '체인을 선택하면 주소가 표시됩니다.',
    historyFilterDate: '날짜',
    historyFilterAll: '전체',
    historyDateToday: '오늘',
    historyDate7d: '7일',
    historyDate30d: '30일',
    historyDateRange: '기간',
    historyNoResult: '조건에 맞는 기록이 없습니다.',
    historyRangeTitle: '날짜 기간 선택',
    historyRangePreset3m: '3개월',
    historyRangePreset6m: '6개월',
    historyRangePreset1y: '1년',
    historyRangeStart: '시작일',
    historyRangeEnd: '마감일',
    historyRangeApply: '적용',
    historyRangeReset: '초기화',
    historyRangeCancel: '취소',
    historyRangePickHint: '날짜를 선택하세요',
    crypto: 'Crypto',
    nfts: 'NFTs',
    noNftTitle: '아직 NFT가 없습니다',
    noNftBody: '구매하거나 받은 NFT가 여기에 표시됩니다.',
    receiveNft: 'NFT 받기',
    tokenSearch: '토큰 검색',
    from: 'From',
    to: 'To',
    continue: '계속',
    latest: 'Latest',
    topDappTokens: 'Top DApp tokens',
    discoverDapp: 'Discover DApp',
    featured: 'Featured',
    dex: 'DEX',
    lending: 'Lending',
    yield: 'Yield',
    solana: 'Solana',
    market: 'Market',
    social: 'Social',
    games: 'Games',
    theme: '테마',
    language: '언어',
    light: '라이트',
    dark: '다크',
    wallets: '지갑 관리',
    security: '보안',
    notifications: '알림',
    helpCenter: '도움말',
    privacyPolicy: '개인정보처리방침',
    support: '지원',
    about: '앱 정보',
    preferences: '환경설정',
    allowPush: '푸시 알림 허용',
    sendReceiveNoti: '보내기/받기 알림',
    announcements: '제품 공지',
    biometric: '생체 인증',
    confirmSign: '트랜잭션 서명',
    passwordLock: '비밀번호',
    autoLock: '자동 잠금',
    lockMethod: '잠금 방법',
    biometricType: '생체 인증 방식',
    transactionSigning: '전송 전 서명',
    transactionSigningHint: '자산 전송 전에 비밀번호 승인을 요청합니다.',
    autoLockImmediate: '즉시',
    autoLock1m: '1분',
    autoLock5m: '5분',
    autoLock1h: '1시간',
    autoLock5h: '5시간',
    biometricUnavailable: '생체 인증을 사용할 수 없는 기기입니다.',
    biometricNotEnrolled: '등록된 생체 정보가 없습니다.',
    biometricFingerprintNotEnrolled: '생체인식 정보가 없습니다. 디바이스에 지문을 등록하고 다시 시도해주세요.',
    biometricFaceNotEnrolled: '생체인식 정보가 없습니다. 디바이스에 얼굴을 등록하고 다시 시도해주세요.',
    biometricFingerprintUnavailable: '지문 인증을 사용할 수 없습니다.',
    biometricFaceUnavailable: '얼굴 인증을 사용할 수 없습니다.',
    appVersion: '버전',
    onboardingTitle: 'IMWallet 시작하기',
    onboardingBody: 'Trust Wallet 흐름 기반 온보딩',
    createWallet: '새 지갑 만들기',
    addExisting: '기존 지갑 가져오기',
    securityCheck: '보안 체크',
    backupTitle: '시드 구문 백업',
    backupBody: '시드 구문은 오프라인에 보관하세요. 분실 시 복구할 수 없습니다.',
    backupWarning: '백업 완료 전에는 다음 단계로 진행하지 마세요.',
    securityChecklistBackup: '시드 구문을 안전한 오프라인 장소에 백업합니다.',
    securityChecklistNoShare: '시드 구문을 온라인/메신저에 절대 공유하지 않습니다.',
    securityChecklistNoRecovery: '시드 구문 분실 시 복구가 불가능함을 이해합니다.',
    phraseTitle: '시드 구문 확인',
    phraseGuide: '아래 시드 구문(12/24)을 순서대로 기록하세요.',
    phraseGuideSub: '다음 단계에서 동일한 순서로 다시 입력해야 합니다.',
    confirmTitle: '시드 구문 재입력',
    confirmSeedGuide: '기록한 시드 구문(12/24)을 순서대로 입력하세요.',
    doneTitle: '지갑 준비 완료',
    doneBody: '이제 메인 지갑 화면으로 이동합니다.',
    goToWallet: '지갑으로 이동',
    secretPhrase: '시드 구문',
    phrasePlaceholder: '12/24 단어 또는 프라이빗 키 입력',
    selectNetwork: '네트워크 선택',
    noWalletTitle: '아직 지갑이 없습니다',
    noWalletBody: '새 지갑 생성 또는 기존 지갑 가져오기를 진행하세요.',
    previewOnboarding: '온보딩 미리보기',
    previewNoWallet: 'No-wallet 보기',
    backToWallet: '지갑으로 복귀',
    invalidAmount: '금액을 확인해주세요.',
    recipientRequired: '수신 주소를 입력해주세요.',
    sameToken: '같은 토큰끼리는 스왑할 수 없습니다.',
    insufficientBalance: '잔액이 부족합니다.',
    addressInvalid: '주소 형식이 올바르지 않습니다.',
    addressMismatch: '선택한 체인과 주소 체인이 일치하지 않습니다.',
    addressNotFound: '존재하지 않는 주소입니다.',
    addressCopied: '주소가 복사되었습니다.',
    phraseCopied: '시드 구문이 복사되었습니다.',
    copyAddress: '주소 복사',
    copyPhrase: '시드 구문 복사',
    shareImage: '이미지 공유하기',
    sendSuccess: '송금 요청이 생성되었습니다.',
    buySuccess: '구매 주문이 생성되었습니다.',
    sellSuccess: '판매 주문이 생성되었습니다.',
    swapSuccess: '스왑 요청이 생성되었습니다.',
    startBrowsing: '탐색 시작',
    discoverHistoryEmpty: '히스토리가 비어 있습니다. 먼저 DApp을 탐색해보세요.',
    discoverFavoriteEmpty: '즐겨찾기가 없습니다. DApp/토큰/사이트를 추가해보세요.',
    discoverTabsEmpty: '열린 탭이 없습니다.',
    network: '네트워크',
    amount: '수량',
    availableBalance: '보유',
    recipient: '받는 주소',
    recipientPlaceholder: '받는 주소를 입력하세요',
    memo: '메모',
    memoPlaceholder: '메모를 입력하세요(선택)',
    selectAsset: '자산 선택',
    selectChain: '체인 선택',
    selectChainAssetFirst: '체인과 자산을 선택하세요.',
    feeEstimate: '예상 네트워크 수수료',
    manageAssets: '자산 관리',
    assetLayout: '자산 레이아웃',
    addAsset: '추가',
    removeAsset: '제거',
    noAssetEnabled: '최소 1개 자산은 유지해야 합니다.',
    quickAddress: '빠른 주소',
    addressBook: '주소록',
    recentSends: '최근 자산 전송',
    noAddressBook: '등록된 주소가 없습니다.',
    noRecentSends: '최근 송금 내역이 없습니다.',
    saveAddress: '주소록 저장',
    addressSaved: '주소록에 저장되었습니다.',
    addressExists: '이미 주소록에 있는 주소입니다.',
    max: '최대',
    supportChatGreeting: '안녕하세요, IMWallet 상담 채널입니다. 문의 내용을 남겨주시면 순서대로 도와드릴게요.',
    supportChatInputPlaceholder: '문의 내용을 입력하세요',
    supportChatAttachImage: '이미지',
    supportChatSend: '전송',
    supportChatOnlyImages: '이미지 파일만 업로드할 수 있습니다.',
    supportChatUploadFailed: '이미지를 불러오지 못했습니다.',
    supportChatAgentAutoReply: '문의가 접수되었습니다. 담당자가 확인 후 답변드릴게요.'
  },
  en: {
    locale: 'en-US',
    home: 'Wallet',
    swap: 'Swap',
    hotTokens: 'Hot tokens',
    earn: 'Earn',
    discover: 'Discover',
    settings: 'Settings',
    wallet: 'Wallet',
    totalBalance: 'Total balance',
    send: 'Send',
    receive: 'Receive',
    buy: 'Buy',
    sell: 'Sell',
    history: 'History',
    historyFilterType: 'Type',
    historyTypeAsset: 'Assets',
    historyTypeNft: 'NFT',
    historyTypeNftHint: 'Asset filter is disabled for NFT history.',
    historyFilterChain: 'Chain',
    historyFilterAsset: 'Asset',
    historyFilterAssetHint: 'Select a chain to see assets.',
    receiveFilterAddressHint: 'Select a chain to see address.',
    historyFilterDate: 'Date',
    historyFilterAll: 'All',
    historyDateToday: 'Today',
    historyDate7d: '7D',
    historyDate30d: '30D',
    historyDateRange: 'Range',
    historyNoResult: 'No transactions match the selected filters.',
    historyRangeTitle: 'Select date range',
    historyRangePreset3m: '3M',
    historyRangePreset6m: '6M',
    historyRangePreset1y: '1Y',
    historyRangeStart: 'Start date',
    historyRangeEnd: 'End date',
    historyRangeApply: 'Apply',
    historyRangeReset: 'Reset',
    historyRangeCancel: 'Cancel',
    historyRangePickHint: 'Pick a date',
    crypto: 'Crypto',
    nfts: 'NFTs',
    noNftTitle: 'No NFTs yet',
    noNftBody: 'Purchased or received NFTs will show up here.',
    receiveNft: 'Receive NFTs',
    tokenSearch: 'Search token',
    from: 'From',
    to: 'To',
    continue: 'Continue',
    latest: 'Latest',
    topDappTokens: 'Top DApp tokens',
    discoverDapp: 'Discover DApp',
    featured: 'Featured',
    dex: 'DEX',
    lending: 'Lending',
    yield: 'Yield',
    solana: 'Solana',
    market: 'Market',
    social: 'Social',
    games: 'Games',
    theme: 'Theme',
    language: 'Language',
    light: 'Light',
    dark: 'Dark',
    wallets: 'Wallets',
    security: 'Security',
    notifications: 'Notifications',
    helpCenter: 'Help Center',
    privacyPolicy: 'Privacy Policy',
    support: 'Support',
    about: 'About',
    preferences: 'Preferences',
    allowPush: 'Allow push notifications',
    sendReceiveNoti: 'Send and receive',
    announcements: 'Product announcements',
    biometric: 'Biometric lock',
    confirmSign: 'Transaction signing',
    passwordLock: 'Password',
    autoLock: 'Auto-lock',
    lockMethod: 'Lock method',
    biometricType: 'Biometric type',
    transactionSigning: 'Pre-transfer signing',
    transactionSigningHint: 'Require app password approval before sending assets.',
    autoLockImmediate: 'Immediately',
    autoLock1m: '1 min',
    autoLock5m: '5 min',
    autoLock1h: '1 hour',
    autoLock5h: '5 hours',
    biometricUnavailable: 'Biometric authentication is unavailable on this device.',
    biometricNotEnrolled: 'No biometric credential is enrolled on this device.',
    biometricFingerprintNotEnrolled: 'No biometric information found. Please enroll a fingerprint on your device and try again.',
    biometricFaceNotEnrolled: 'No biometric information found. Please enroll face recognition on your device and try again.',
    biometricFingerprintUnavailable: 'Fingerprint authentication is unavailable.',
    biometricFaceUnavailable: 'Face authentication is unavailable.',
    appVersion: 'Version',
    onboardingTitle: 'Get Started',
    onboardingBody: 'Trust-style onboarding flow',
    createWallet: 'Create new wallet',
    addExisting: 'Add existing wallet',
    securityCheck: 'Security check',
    backupTitle: 'Back up secret phrase',
    backupBody: 'Store your secret phrase offline. Recovery is impossible without it.',
    backupWarning: 'Do not continue until your backup is fully complete.',
    securityChecklistBackup: 'I will back up my phrase in a safe offline place.',
    securityChecklistNoShare: 'I will never share my phrase online or in messaging apps.',
    securityChecklistNoRecovery: 'I understand that I cannot recover assets without this phrase.',
    phraseTitle: 'Secret phrase',
    phraseGuide: 'Write down your 12/24-word seed phrase below in exact order.',
    phraseGuideSub: 'You will need to re-enter them in the next step.',
    confirmTitle: 'Confirm phrase',
    confirmSeedGuide: 'Re-enter the recorded 12/24 words in order.',
    doneTitle: 'Wallet is ready',
    doneBody: 'You can now continue to your main wallet.',
    goToWallet: 'Go to wallet',
    secretPhrase: 'Secret phrase',
    phrasePlaceholder: 'Enter 12/24 words or private key',
    selectNetwork: 'Select network',
    noWalletTitle: 'No wallet yet',
    noWalletBody: 'Create or import a wallet to continue.',
    previewOnboarding: 'Preview onboarding',
    previewNoWallet: 'Preview no-wallet',
    backToWallet: 'Back to wallet',
    invalidAmount: 'Please enter a valid amount.',
    recipientRequired: 'Recipient address is required.',
    sameToken: 'Cannot swap the same token.',
    insufficientBalance: 'Insufficient balance.',
    addressInvalid: 'Invalid address format.',
    addressMismatch: 'Address chain does not match selected chain.',
    addressNotFound: 'Address does not exist.',
    addressCopied: 'Address copied.',
    phraseCopied: 'Secret phrase copied.',
    copyAddress: 'Copy address',
    copyPhrase: 'Copy secret phrase',
    shareImage: 'Share image',
    sendSuccess: 'Send request created.',
    buySuccess: 'Buy order created.',
    sellSuccess: 'Sell order created.',
    swapSuccess: 'Swap request created.',
    startBrowsing: 'Start browsing',
    discoverHistoryEmpty: 'History is empty. Start browsing DApps.',
    discoverFavoriteEmpty: 'No favorites yet. Add DApps, tokens, or sites.',
    discoverTabsEmpty: 'No open tabs.',
    network: 'Network',
    amount: 'Amount',
    availableBalance: 'Available',
    recipient: 'Recipient',
    recipientPlaceholder: 'Enter recipient address',
    memo: 'Memo',
    memoPlaceholder: 'Enter memo (optional)',
    selectAsset: 'Select asset',
    selectChain: 'Select chain',
    selectChainAssetFirst: 'Select chain and asset.',
    feeEstimate: 'Estimated network fee',
    manageAssets: 'Manage assets',
    assetLayout: 'Asset layout',
    addAsset: 'Add',
    removeAsset: 'Remove',
    noAssetEnabled: 'At least one asset is required.',
    quickAddress: 'Quick address',
    addressBook: 'Address book',
    recentSends: 'Recent sends',
    noAddressBook: 'No saved addresses.',
    noRecentSends: 'No recent send history.',
    saveAddress: 'Save to book',
    addressSaved: 'Saved to address book.',
    addressExists: 'Address already exists in book.',
    max: 'Max',
    supportChatGreeting: 'Hi, this is IMWallet support. Leave your message and we will assist you shortly.',
    supportChatInputPlaceholder: 'Type your message',
    supportChatAttachImage: 'Image',
    supportChatSend: 'Send',
    supportChatOnlyImages: 'Only image files can be uploaded.',
    supportChatUploadFailed: 'Failed to load image.',
    supportChatAgentAutoReply: 'Your inquiry has been received. Our team will reply soon.'
  },
  zh: {
    locale: 'zh-CN',
    home: '钱包',
    swap: '兑换',
    hotTokens: '热门代币',
    earn: '收益',
    discover: '发现',
    settings: '设置',
    wallet: '钱包',
    totalBalance: '总资产',
    send: '发送',
    receive: '接收',
    buy: '购买',
    sell: '卖出',
    history: '记录',
    historyFilterType: '类型',
    historyTypeAsset: '资产',
    historyTypeNft: 'NFT',
    historyTypeNftHint: 'NFT 记录不使用资产筛选。',
    historyFilterChain: '链',
    historyFilterAsset: '资产',
    historyFilterAssetHint: '选择链后显示资产。',
    receiveFilterAddressHint: '选择链后显示地址。',
    historyFilterDate: '日期',
    historyFilterAll: '全部',
    historyDateToday: '今天',
    historyDate7d: '7天',
    historyDate30d: '30天',
    historyDateRange: '区间',
    historyNoResult: '没有符合筛选条件的记录。',
    historyRangeTitle: '选择日期范围',
    historyRangePreset3m: '3个月',
    historyRangePreset6m: '6个月',
    historyRangePreset1y: '1年',
    historyRangeStart: '开始日期',
    historyRangeEnd: '结束日期',
    historyRangeApply: '应用',
    historyRangeReset: '重置',
    historyRangeCancel: '取消',
    historyRangePickHint: '请选择日期',
    crypto: 'Crypto',
    nfts: 'NFTs',
    noNftTitle: '暂无 NFT',
    noNftBody: '购买或接收的 NFT 会显示在这里。',
    receiveNft: '接收 NFT',
    tokenSearch: '搜索代币',
    from: 'From',
    to: 'To',
    continue: '继续',
    latest: 'Latest',
    topDappTokens: 'Top DApp tokens',
    discoverDapp: 'Discover DApp',
    featured: 'Featured',
    dex: 'DEX',
    lending: 'Lending',
    yield: 'Yield',
    solana: 'Solana',
    market: 'Market',
    social: 'Social',
    games: 'Games',
    theme: '主题',
    language: '语言',
    light: '浅色',
    dark: '深色',
    wallets: '钱包管理',
    security: '安全',
    notifications: '通知',
    helpCenter: '帮助中心',
    privacyPolicy: '隐私政策',
    support: '支持',
    about: '关于',
    preferences: '偏好设置',
    allowPush: '允许推送通知',
    sendReceiveNoti: '收发提醒',
    announcements: '产品公告',
    biometric: '生物识别',
    confirmSign: '交易签名',
    passwordLock: '密码',
    autoLock: '自动锁定',
    lockMethod: '锁定方式',
    biometricType: '生物识别方式',
    transactionSigning: '转账前签名',
    transactionSigningHint: '资产转账前需要密码确认。',
    autoLockImmediate: '立即',
    autoLock1m: '1分钟',
    autoLock5m: '5分钟',
    autoLock1h: '1小时',
    autoLock5h: '5小时',
    biometricUnavailable: '此设备不支持生物识别认证。',
    biometricNotEnrolled: '此设备未录入生物识别信息。',
    biometricFingerprintNotEnrolled: '未检测到生物识别信息。请先在设备中录入指纹后重试。',
    biometricFaceNotEnrolled: '未检测到生物识别信息。请先在设备中录入面容后重试。',
    biometricFingerprintUnavailable: '无法使用指纹认证。',
    biometricFaceUnavailable: '无法使用面容认证。',
    appVersion: '版本',
    onboardingTitle: '开始使用 IMWallet',
    onboardingBody: '基于 Trust 结构的引导流程',
    createWallet: '创建新钱包',
    addExisting: '导入已有钱包',
    securityCheck: '安全检查',
    backupTitle: '备份助记词',
    backupBody: '请离线保存助记词，丢失后无法恢复资产。',
    backupWarning: '在完成备份前，请不要进入下一步。',
    securityChecklistBackup: '我会将助记词备份到安全的离线位置。',
    securityChecklistNoShare: '我不会在网络或聊天工具中分享助记词。',
    securityChecklistNoRecovery: '我已理解：丢失助记词将无法恢复资产。',
    phraseTitle: '助记词',
    phraseGuide: '请按顺序记录下面的助记词（12/24 个）。',
    phraseGuideSub: '下一步需要按相同顺序重新输入。',
    confirmTitle: '确认助记词',
    confirmSeedGuide: '请按顺序重新输入你记录的助记词（12/24 个）。',
    doneTitle: '钱包已就绪',
    doneBody: '现在可以进入主钱包页面。',
    goToWallet: '进入钱包',
    secretPhrase: '助记词',
    phrasePlaceholder: '输入 12/24 个助记词或私钥',
    selectNetwork: '选择网络',
    noWalletTitle: '还没有钱包',
    noWalletBody: '请先创建或导入钱包。',
    previewOnboarding: '预览引导',
    previewNoWallet: '预览无钱包页',
    backToWallet: '返回钱包',
    invalidAmount: '请输入有效数量。',
    recipientRequired: '请输入接收地址。',
    sameToken: '不能兑换相同代币。',
    insufficientBalance: '余额不足。',
    addressInvalid: '地址格式无效。',
    addressMismatch: '地址链与所选链不一致。',
    addressNotFound: '地址不存在。',
    addressCopied: '地址已复制。',
    phraseCopied: '助记词已复制。',
    copyAddress: '复制地址',
    copyPhrase: '复制助记词',
    shareImage: '分享图片',
    sendSuccess: '发送请求已创建。',
    buySuccess: '购买订单已创建。',
    sellSuccess: '卖出订单已创建。',
    swapSuccess: '兑换请求已创建。',
    startBrowsing: '开始浏览',
    discoverHistoryEmpty: '历史为空，请先浏览 DApp。',
    discoverFavoriteEmpty: '暂无收藏，请添加 DApp、代币或站点。',
    discoverTabsEmpty: '暂无打开的标签页。',
    network: '网络',
    amount: '数量',
    availableBalance: '可用',
    recipient: '接收地址',
    recipientPlaceholder: '请输入接收地址',
    memo: '备注',
    memoPlaceholder: '请输入备注（可选）',
    selectAsset: '选择资产',
    selectChain: '选择链',
    selectChainAssetFirst: '请选择链和资产。',
    feeEstimate: '预计网络手续费',
    manageAssets: '管理资产',
    assetLayout: '资产布局',
    addAsset: '添加',
    removeAsset: '移除',
    noAssetEnabled: '至少保留一个资产。',
    quickAddress: '快捷地址',
    addressBook: '地址簿',
    recentSends: '最近转账',
    noAddressBook: '暂无保存地址。',
    noRecentSends: '暂无最近转账记录。',
    saveAddress: '保存到地址簿',
    addressSaved: '已保存到地址簿。',
    addressExists: '地址簿中已存在该地址。',
    max: '最大',
    supportChatGreeting: '您好，这里是 IMWallet 客服。请留下您的问题，我们会尽快回复。',
    supportChatInputPlaceholder: '请输入咨询内容',
    supportChatAttachImage: '图片',
    supportChatSend: '发送',
    supportChatOnlyImages: '仅支持上传图片文件。',
    supportChatUploadFailed: '图片加载失败。',
    supportChatAgentAutoReply: '已收到您的咨询，客服会尽快回复。'
  }
};

type ExtraCopy = {
  addressBookManage: string;
  addressBookTypeSelect: string;
  assetAddressBook: string;
  nftAddressBook: string;
  addAddress: string;
  editAddress: string;
  deleteAddress: string;
  save: string;
  cancel: string;
  label: string;
  memoOptional: string;
  paste: string;
  scan: string;
  camera: string;
  gallery: string;
  scanMethod: string;
  scanNoQr: string;
  openAddressBook: string;
  noAddressForChain: string;
  addressUpdated: string;
  addressDeleted: string;
};

type WalletUiCopy = {
  walletName: string;
  walletNamePlaceholder: string;
  addWallet: string;
  addWalletFromRecovery: string;
  walletList: string;
  walletAdded: string;
  deleteWallet: string;
  deleteWalletTitle: string;
  deleteTarget: string;
  cannotDeleteLastWallet: string;
  deleteWalletWarning: string;
  deleteWalletAgreeBackup: string;
  deleteWalletAgreeNoRecovery: string;
  deleteWalletAgreeFinal: string;
  deleteWalletSeedTitle: string;
  deleteWalletSeedBody: string;
  deleteWalletSeedMismatch: string;
  deleteWalletAuthHint: string;
  deleteWalletConfirm: string;
  walletDeleted: string;
};

type SendFlowCopy = {
  sendConfirmTitle: string;
  advancedTitle: string;
  gasPrice: string;
  gasLimit: string;
  txData: string;
  nonce: string;
  networkFee: string;
  totalCost: string;
  confirm: string;
  authTitle: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  authContinue: string;
  authInvalid: string;
  fingerprintTitle: string;
  faceTitle: string;
  processingTitle: string;
  processingBody: string;
  processingDoneTitle: string;
  processingDoneBody: string;
  viewTxDetails: string;
  txDetailTitle: string;
  txHash: string;
  status: string;
  completed: string;
  pending: string;
  failed: string;
  nonceLabel: string;
  gasInfo: string;
  saveGasSettings: string;
  authMethod: string;
  passwordMode: string;
  fingerprintMode: string;
  faceMode: string;
  sendPasswordLabel: string;
  sendPasswordHint: string;
  invalidGas: string;
  amountToSend: string;
  recipientWallet: string;
  saveAddressInline: string;
  shareTx: string;
  openExplorer: string;
  txShared: string;
  explorerOpenFailed: string;
  appPasswordSetupTitle: string;
  appPasswordSetupBody: string;
  appPasswordConfirmLabel: string;
  appPasswordMismatch: string;
  appPasswordInvalid: string;
  appPasswordSaved: string;
  appUnlockTitle: string;
  appUnlockBody: string;
  appUnlockButton: string;
  appUnlockWithBiometric: string;
  appUnlockUsePassword: string;
  passcodeInputTitle: string;
  passcodeBiometric: string;
  passcodeDelete: string;
};

const extraCopy: Record<Language, ExtraCopy> = {
  ko: {
    addressBookManage: '주소록 관리',
    addressBookTypeSelect: '구분',
    assetAddressBook: '자산 주소록',
    nftAddressBook: 'NFT 주소록',
    addAddress: '주소 추가',
    editAddress: '수정',
    deleteAddress: '삭제',
    save: '저장',
    cancel: '취소',
    label: '라벨',
    memoOptional: '메모(선택)',
    paste: '붙여넣기',
    scan: '스캔',
    camera: '카메라',
    gallery: '갤러리',
    scanMethod: 'QR 스캔 방식 선택',
    scanNoQr: 'QR 코드에서 주소를 찾지 못했습니다.',
    openAddressBook: '주소록 열기',
    noAddressForChain: '선택한 체인의 주소록이 없습니다.',
    addressUpdated: '주소록이 수정되었습니다.',
    addressDeleted: '주소록이 삭제되었습니다.'
  },
  en: {
    addressBookManage: 'Manage address book',
    addressBookTypeSelect: 'Select address book type',
    assetAddressBook: 'Asset address book',
    nftAddressBook: 'NFT address book',
    addAddress: 'Add address',
    editAddress: 'Edit',
    deleteAddress: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    label: 'Label',
    memoOptional: 'Memo (optional)',
    paste: 'Paste',
    scan: 'Scan',
    camera: 'Camera',
    gallery: 'Gallery',
    scanMethod: 'Select QR scan method',
    scanNoQr: 'No address found from the QR code.',
    openAddressBook: 'Open address book',
    noAddressForChain: 'No address for the selected chain.',
    addressUpdated: 'Address book updated.',
    addressDeleted: 'Address deleted.'
  },
  zh: {
    addressBookManage: '地址簿管理',
    addressBookTypeSelect: '选择地址簿类型',
    assetAddressBook: '资产地址簿',
    nftAddressBook: 'NFT 地址簿',
    addAddress: '添加地址',
    editAddress: '编辑',
    deleteAddress: '删除',
    save: '保存',
    cancel: '取消',
    label: '标签',
    memoOptional: '备注（可选）',
    paste: '粘贴',
    scan: '扫描',
    camera: '相机',
    gallery: '相册',
    scanMethod: '选择二维码扫描方式',
    scanNoQr: '未从二维码中识别到地址。',
    openAddressBook: '打开地址簿',
    noAddressForChain: '所选链暂无地址。',
    addressUpdated: '地址簿已更新。',
    addressDeleted: '地址已删除。'
  }
};

const walletUiCopy: Record<Language, WalletUiCopy> = {
  ko: {
    walletName: '지갑 이름',
    walletNamePlaceholder: '예: 메인 지갑',
    addWallet: '지갑 추가',
    addWalletFromRecovery: '복구 구문으로 지갑 추가',
    walletList: '지갑 목록',
    walletAdded: '새 지갑이 추가되었습니다.',
    deleteWallet: '지갑 삭제',
    deleteWalletTitle: '지갑 삭제',
    deleteTarget: '삭제 대상',
    cannotDeleteLastWallet: '마지막 지갑은 삭제할 수 없습니다.',
    deleteWalletWarning: '시드 구문이 없으면 삭제 후 다시 복구할 수 없습니다.',
    deleteWalletAgreeBackup: '시드 구문을 안전한 장소에 백업했습니다.',
    deleteWalletAgreeNoRecovery: '삭제 후 복구 불가할 수 있음을 이해했습니다.',
    deleteWalletAgreeFinal: '삭제할 지갑이 맞는지 다시 확인했습니다.',
    deleteWalletSeedTitle: '시드 구문 재입력',
    deleteWalletSeedBody: '삭제하려는 지갑의 시드 구문(12/24)을 순서대로 입력하세요.',
    deleteWalletSeedMismatch: '시드 구문이 일치하지 않습니다.',
    deleteWalletAuthHint: '인증이 완료되면 지갑이 즉시 삭제됩니다.',
    deleteWalletConfirm: '인증 후 삭제',
    walletDeleted: '지갑이 삭제되었습니다.'
  },
  en: {
    walletName: 'Wallet name',
    walletNamePlaceholder: 'e.g. Main Wallet',
    addWallet: 'Add wallet',
    addWalletFromRecovery: 'Add wallet from recovery phrase',
    walletList: 'Wallet list',
    walletAdded: 'New wallet added.',
    deleteWallet: 'Delete wallet',
    deleteWalletTitle: 'Delete Wallet',
    deleteTarget: 'Target',
    cannotDeleteLastWallet: 'You cannot delete the last wallet.',
    deleteWalletWarning: 'Without the seed phrase, this wallet cannot be recovered after deletion.',
    deleteWalletAgreeBackup: 'I have backed up the seed phrase in a safe place.',
    deleteWalletAgreeNoRecovery: 'I understand deletion may be irreversible.',
    deleteWalletAgreeFinal: 'I confirmed this is the wallet to delete.',
    deleteWalletSeedTitle: 'Re-enter seed phrase',
    deleteWalletSeedBody: 'Enter the wallet seed phrase (12/24 words) in order.',
    deleteWalletSeedMismatch: 'Seed phrase does not match.',
    deleteWalletAuthHint: 'The wallet will be deleted immediately after authentication.',
    deleteWalletConfirm: 'Authenticate & Delete',
    walletDeleted: 'Wallet deleted.'
  },
  zh: {
    walletName: '钱包名称',
    walletNamePlaceholder: '例如：主钱包',
    addWallet: '添加钱包',
    addWalletFromRecovery: '通过助记词添加钱包',
    walletList: '钱包列表',
    walletAdded: '新钱包已添加。',
    deleteWallet: '删除钱包',
    deleteWalletTitle: '删除钱包',
    deleteTarget: '删除对象',
    cannotDeleteLastWallet: '最后一个钱包不能删除。',
    deleteWalletWarning: '如果没有助记词，删除后将无法恢复钱包。',
    deleteWalletAgreeBackup: '我已将助记词备份到安全位置。',
    deleteWalletAgreeNoRecovery: '我理解删除后可能无法恢复。',
    deleteWalletAgreeFinal: '我已确认这是要删除的钱包。',
    deleteWalletSeedTitle: '重新输入助记词',
    deleteWalletSeedBody: '请输入要删除钱包的助记词（12/24 个，按顺序）。',
    deleteWalletSeedMismatch: '助记词不匹配。',
    deleteWalletAuthHint: '认证完成后将立即删除该钱包。',
    deleteWalletConfirm: '验证并删除',
    walletDeleted: '钱包已删除。'
  }
};

const sendFlowCopy: Record<Language, SendFlowCopy> = {
  ko: {
    sendConfirmTitle: '전송 확인',
    advancedTitle: '고급',
    gasPrice: '가스 가격 (Gwei)',
    gasLimit: '가스 한도',
    txData: '트랜잭션 데이터 (선택 사항)',
    nonce: '논스',
    networkFee: '네트워크 수수료',
    totalCost: '총 비용',
    confirm: '확인',
    authTitle: '보안 확인',
    passwordLabel: '비밀번호',
    passwordPlaceholder: '6자리 비밀번호를 입력하세요',
    authContinue: '인증 후 전송',
    authInvalid: '비밀번호가 틀렸습니다.',
    fingerprintTitle: '지문 인증',
    faceTitle: '얼굴 인증',
    processingTitle: '처리 중...',
    processingBody: '트랜잭션이 진행 중입니다. 블록체인 검증이 진행 중입니다. 이 작업은 몇 분 정도 걸릴 수 있습니다.',
    processingDoneTitle: '전송 완료',
    processingDoneBody: '트랜잭션이 정상적으로 전송되었습니다.',
    viewTxDetails: '트랜잭션 세부 정보',
    txDetailTitle: '전송',
    txHash: '트랜잭션 해시',
    status: '상태',
    completed: '완료',
    pending: '진행 중',
    failed: '실패',
    nonceLabel: '논스',
    gasInfo: '가스 설정',
    saveGasSettings: '저장',
    authMethod: '인증 방식',
    passwordMode: '비밀번호',
    fingerprintMode: '지문',
    faceMode: '얼굴',
    sendPasswordLabel: '앱 비밀번호',
    sendPasswordHint: '앱 잠금 비밀번호를 입력하세요.',
    invalidGas: '가스 설정 값을 확인해주세요.',
    amountToSend: '전송 자산',
    recipientWallet: '수령',
    saveAddressInline: '주소록 저장',
    shareTx: '공유',
    openExplorer: '익스플로러 열기',
    txShared: '트랜잭션 링크를 공유했습니다.',
    explorerOpenFailed: '익스플로러를 열 수 없습니다.',
    appPasswordSetupTitle: '앱 비밀번호 설정',
    appPasswordSetupBody: '앱 잠금 해제를 위해 비밀번호를 설정하세요.',
    appPasswordConfirmLabel: '비밀번호 확인',
    appPasswordMismatch: '비밀번호가 서로 일치하지 않습니다.',
    appPasswordInvalid: '숫자 6자리 비밀번호를 입력해주세요.',
    appPasswordSaved: '앱 비밀번호가 설정되었습니다.',
    appUnlockTitle: '앱 잠금 해제',
    appUnlockBody: '계속하려면 인증을 완료하세요.',
    appUnlockButton: '잠금 해제',
    appUnlockWithBiometric: '생체 인증으로 잠금 해제',
    appUnlockUsePassword: '비밀번호로 잠금 해제',
    passcodeInputTitle: '비밀번호 입력',
    passcodeBiometric: '생체인증',
    passcodeDelete: '지우기'
  },
  en: {
    sendConfirmTitle: 'Send Confirmation',
    advancedTitle: 'Advanced',
    gasPrice: 'Gas price (Gwei)',
    gasLimit: 'Gas limit',
    txData: 'Transaction data (optional)',
    nonce: 'Nonce',
    networkFee: 'Network fee',
    totalCost: 'Total cost',
    confirm: 'Confirm',
    authTitle: 'Security Check',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter 6-digit password',
    authContinue: 'Authenticate & Send',
    authInvalid: 'Incorrect password.',
    fingerprintTitle: 'Fingerprint Authentication',
    faceTitle: 'Face Authentication',
    processingTitle: 'Processing...',
    processingBody: 'Transaction is being processed. Blockchain confirmation is in progress and may take a few minutes.',
    processingDoneTitle: 'Send Completed',
    processingDoneBody: 'Your transaction was sent successfully.',
    viewTxDetails: 'Transaction Details',
    txDetailTitle: 'Send',
    txHash: 'Transaction hash',
    status: 'Status',
    completed: 'Completed',
    pending: 'Pending',
    failed: 'Failed',
    nonceLabel: 'Nonce',
    gasInfo: 'Gas settings',
    saveGasSettings: 'Save',
    authMethod: 'Authentication method',
    passwordMode: 'Password',
    fingerprintMode: 'Fingerprint',
    faceMode: 'Face',
    sendPasswordLabel: 'App password',
    sendPasswordHint: 'Enter your app lock password.',
    invalidGas: 'Please check gas setting values.',
    amountToSend: 'Asset',
    recipientWallet: 'Recipient',
    saveAddressInline: 'Save to address book',
    shareTx: 'Share',
    openExplorer: 'Open Explorer',
    txShared: 'Transaction link shared.',
    explorerOpenFailed: 'Unable to open explorer.',
    appPasswordSetupTitle: 'Set app password',
    appPasswordSetupBody: 'Set a password to unlock the app.',
    appPasswordConfirmLabel: 'Confirm password',
    appPasswordMismatch: 'Passwords do not match.',
    appPasswordInvalid: 'Enter a numeric 6-digit password.',
    appPasswordSaved: 'App password has been set.',
    appUnlockTitle: 'Unlock app',
    appUnlockBody: 'Authenticate to continue.',
    appUnlockButton: 'Unlock',
    appUnlockWithBiometric: 'Unlock with biometric',
    appUnlockUsePassword: 'Use password',
    passcodeInputTitle: 'Enter Password',
    passcodeBiometric: 'Biometric',
    passcodeDelete: 'Delete'
  },
  zh: {
    sendConfirmTitle: '发送确认',
    advancedTitle: '高级',
    gasPrice: 'Gas 价格 (Gwei)',
    gasLimit: 'Gas 上限',
    txData: '交易数据（可选）',
    nonce: 'Nonce',
    networkFee: '网络手续费',
    totalCost: '总费用',
    confirm: '确认',
    authTitle: '安全验证',
    passwordLabel: '密码',
    passwordPlaceholder: '请输入 6 位密码',
    authContinue: '验证并发送',
    authInvalid: '密码错误。',
    fingerprintTitle: '指纹验证',
    faceTitle: '面容验证',
    processingTitle: '处理中...',
    processingBody: '交易正在进行，区块链确认中，可能需要几分钟。',
    processingDoneTitle: '发送完成',
    processingDoneBody: '交易已成功发送。',
    viewTxDetails: '交易详情',
    txDetailTitle: '发送',
    txHash: '交易哈希',
    status: '状态',
    completed: '完成',
    pending: '处理中',
    failed: '失败',
    nonceLabel: 'Nonce',
    gasInfo: 'Gas 设置',
    saveGasSettings: '保存',
    authMethod: '验证方式',
    passwordMode: '密码',
    fingerprintMode: '指纹',
    faceMode: '面容',
    sendPasswordLabel: '应用密码',
    sendPasswordHint: '请输入应用锁定密码。',
    invalidGas: '请检查 Gas 设置数值。',
    amountToSend: '发送资产',
    recipientWallet: '接收方',
    saveAddressInline: '保存到地址簿',
    shareTx: '分享',
    openExplorer: '打开浏览器',
    txShared: '交易链接已分享。',
    explorerOpenFailed: '无法打开区块浏览器。',
    appPasswordSetupTitle: '设置应用密码',
    appPasswordSetupBody: '请设置密码用于解锁应用。',
    appPasswordConfirmLabel: '确认密码',
    appPasswordMismatch: '两次输入的密码不一致。',
    appPasswordInvalid: '请输入 6 位数字密码。',
    appPasswordSaved: '应用密码已设置。',
    appUnlockTitle: '解锁应用',
    appUnlockBody: '请完成认证后继续。',
    appUnlockButton: '解锁',
    appUnlockWithBiometric: '使用生物识别解锁',
    appUnlockUsePassword: '使用密码解锁',
    passcodeInputTitle: '输入密码',
    passcodeBiometric: '生物识别',
    passcodeDelete: '删除'
  }
};

type AssetDetailCopy = {
  totalValue: string;
  info: string;
  about: string;
  recentActivity: string;
  marketCap: string;
  volume24h: string;
  holders: string;
  launched: string;
  circulating: string;
  issued: string;
  liquidity: string;
  risk: string;
  riskLow: string;
  riskMedium: string;
  riskHigh: string;
  networkLabel: string;
  contractAddress: string;
  showMore: string;
  showLess: string;
  marketPulse: string;
  website: string;
  social: string;
  reddit: string;
  whitepaper: string;
  noRecentActivity: string;
};

const assetDetailCopy: Record<Language, AssetDetailCopy> = {
  ko: {
    totalValue: '나의 총 자산',
    info: '정보',
    about: '소개',
    recentActivity: '최근 내역',
    marketCap: '시가 총액',
    volume24h: '24시간 거래량',
    holders: '보유자',
    launched: '출시',
    circulating: '유통량',
    issued: '발행량',
    liquidity: '유동성',
    risk: '보안 위험(내부)',
    riskLow: '낮음',
    riskMedium: '보통',
    riskHigh: '높음',
    networkLabel: '네트워크',
    contractAddress: '컨트랙트 주소',
    showMore: '더보기',
    showLess: '접기',
    marketPulse: '실시간 시장 동향',
    website: '웹사이트',
    social: 'X',
    reddit: 'Reddit',
    whitepaper: 'Whitepaper',
    noRecentActivity: '해당 자산의 최근 내역이 없습니다.'
  },
  en: {
    totalValue: 'My Total Assets',
    info: 'Info',
    about: 'About',
    recentActivity: 'Recent Activity',
    marketCap: 'Market Cap',
    volume24h: '24h Volume',
    holders: 'Holders',
    launched: 'Launched',
    circulating: 'Circulating Supply',
    issued: 'Issued Supply',
    liquidity: 'Liquidity',
    risk: 'Security Risk (Internal)',
    riskLow: 'Low',
    riskMedium: 'Medium',
    riskHigh: 'High',
    networkLabel: 'Network',
    contractAddress: 'Contract Address',
    showMore: 'Show more',
    showLess: 'Show less',
    marketPulse: 'Real-time market pulse',
    website: 'Website',
    social: 'X',
    reddit: 'Reddit',
    whitepaper: 'Whitepaper',
    noRecentActivity: 'No recent activity for this asset.'
  },
  zh: {
    totalValue: '我的总资产',
    info: '信息',
    about: '介绍',
    recentActivity: '最近记录',
    marketCap: '市值',
    volume24h: '24小时交易量',
    holders: '持有者',
    launched: '上线时间',
    circulating: '流通量',
    issued: '发行量',
    liquidity: '流动性',
    risk: '安全风险（内部）',
    riskLow: '低',
    riskMedium: '中',
    riskHigh: '高',
    networkLabel: '网络',
    contractAddress: '合约地址',
    showMore: '查看更多',
    showLess: '收起',
    marketPulse: '实时市场脉冲',
    website: '网站',
    social: 'X',
    reddit: 'Reddit',
    whitepaper: '白皮书',
    noRecentActivity: '该资产暂无最近记录。'
  }
};

type RiskLevel = 'low' | 'medium' | 'high';
type AssetInfoPreset = {
  marketCap: string;
  volume24h: string;
  holders: string;
  launched: string;
  circulating: string;
  issued: string;
  liquidity: string;
  risk: RiskLevel;
  website: string;
  social: string;
  reddit: string;
  whitepaper: string;
};

const assetChartRanges: AssetChartRange[] = ['1H', '1D', '1W', '1M', '1Y', 'ALL'];

const assetInfoCatalog: Record<AssetKey, AssetInfoPreset> = {
  BTC: {
    marketCap: '$1.47T',
    volume24h: '$42.6B',
    holders: '52.1M',
    launched: '2009-01-03',
    circulating: '19.84M',
    issued: '21.00M',
    liquidity: '$17.8B',
    risk: 'low',
    website: 'https://bitcoin.org',
    social: 'https://x.com/bitcoin',
    reddit: 'https://www.reddit.com/r/Bitcoin/',
    whitepaper: 'https://bitcoin.org/bitcoin.pdf'
  },
  ETH: {
    marketCap: '$423.2B',
    volume24h: '$18.5B',
    holders: '132.0M',
    launched: '2015-07-30',
    circulating: '120.12M',
    issued: 'No Max',
    liquidity: '$12.9B',
    risk: 'medium',
    website: 'https://ethereum.org',
    social: 'https://x.com/ethereum',
    reddit: 'https://www.reddit.com/r/ethereum/',
    whitepaper: 'https://ethereum.org/en/whitepaper/'
  },
  XRP: {
    marketCap: '$34.8B',
    volume24h: '$2.1B',
    holders: '5.0M',
    launched: '2012-06-02',
    circulating: '55.9B',
    issued: '100.0B',
    liquidity: '$1.4B',
    risk: 'medium',
    website: 'https://xrpl.org',
    social: 'https://x.com/RippleXDev',
    reddit: 'https://www.reddit.com/r/XRP/',
    whitepaper: 'https://xrpl.org/whitepaper.html'
  },
  BNB: {
    marketCap: '$91.7B',
    volume24h: '$2.9B',
    holders: '2.2M',
    launched: '2017-07-14',
    circulating: '149.5M',
    issued: '200.0M',
    liquidity: '$2.6B',
    risk: 'medium',
    website: 'https://www.bnbchain.org',
    social: 'https://x.com/BNBCHAIN',
    reddit: 'https://www.reddit.com/r/bnbchainofficial/',
    whitepaper: 'https://academy.binance.com/en/articles/what-is-bnb'
  },
  SOL: {
    marketCap: '$78.4B',
    volume24h: '$4.3B',
    holders: '3.7M',
    launched: '2020-03-16',
    circulating: '462.3M',
    issued: 'No Max',
    liquidity: '$3.8B',
    risk: 'high',
    website: 'https://solana.com',
    social: 'https://x.com/solana',
    reddit: 'https://www.reddit.com/r/solana/',
    whitepaper: 'https://solana.com/solana-whitepaper.pdf'
  },
  TRX: {
    marketCap: '$12.8B',
    volume24h: '$1.1B',
    holders: '2.0M',
    launched: '2018-06-25',
    circulating: '88.4B',
    issued: '100.0B',
    liquidity: '$0.9B',
    risk: 'medium',
    website: 'https://tron.network',
    social: 'https://x.com/trondao',
    reddit: 'https://www.reddit.com/r/Tronix/',
    whitepaper: 'https://tron.network/static/doc/white_paper_v_2_0.pdf'
  },
  FIL: {
    marketCap: '$3.6B',
    volume24h: '$0.4B',
    holders: '0.7M',
    launched: '2020-10-15',
    circulating: '566.5M',
    issued: '1.96B',
    liquidity: '$0.28B',
    risk: 'high',
    website: 'https://filecoin.io',
    social: 'https://x.com/Filecoin',
    reddit: 'https://www.reddit.com/r/filecoin/',
    whitepaper: 'https://filecoin.io/filecoin.pdf'
  },
  USDT: {
    marketCap: '$109.6B',
    volume24h: '$53.2B',
    holders: '7.8M',
    launched: '2014-10-06',
    circulating: '109.6B',
    issued: 'Dynamic',
    liquidity: '$24.6B',
    risk: 'medium',
    website: 'https://tether.to',
    social: 'https://x.com/Tether_to',
    reddit: 'https://www.reddit.com/r/Tether/',
    whitepaper: 'https://tether.to/en/whitepaper/'
  }
};

const usdtContractByChain: Partial<Record<ChainCode, string>> = {
  ETH: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  TRX: 'TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj',
  BSC: '0x55d398326f99059fF775485246999027B3197955'
};

const shortAddress = (value: string) => `${value.slice(0, 6)}...${value.slice(-6)}`;
const shortAddressCenter = (value: string, start = 8, end = 6) => {
  if (value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
};

const DEFAULT_FIAT_RATES = Object.freeze({
  KRW: 1370,
  CNY: 7.2
});

type FiatCurrencyCode = 'USD' | 'KRW' | 'CNY';
type FiatRates = {
  KRW: number;
  CNY: number;
};

let currentFiatRates: FiatRates = {
  KRW: DEFAULT_FIAT_RATES.KRW,
  CNY: DEFAULT_FIAT_RATES.CNY
};

const applyLiveFiatRates = (next?: Partial<FiatRates>) => {
  const krw = Number(next?.KRW);
  const cny = Number(next?.CNY);

  if (Number.isFinite(krw) && krw > 0) {
    currentFiatRates.KRW = krw;
  }
  if (Number.isFinite(cny) && cny > 0) {
    currentFiatRates.CNY = cny;
  }
};

const resolveNumberLocale = (locale: string) => {
  const normalized = locale.toLowerCase();
  if (normalized.startsWith('ko')) return 'ko-KR';
  if (normalized.startsWith('zh')) return 'zh-CN';
  return 'en-US';
};

const resolveFiatCurrency = (locale: string): { code: FiatCurrencyCode; usdRate: number } => {
  const normalized = locale.toLowerCase();
  if (normalized.startsWith('ko')) return { code: 'KRW', usdRate: currentFiatRates.KRW };
  if (normalized.startsWith('zh')) return { code: 'CNY', usdRate: currentFiatRates.CNY };
  return { code: 'USD', usdRate: 1 };
};

const convertUsdToFiat = (valueUsd: number, locale: string) => {
  const { usdRate } = resolveFiatCurrency(locale);
  return valueUsd * usdRate;
};

const formatCurrency = (valueUsd: number, locale: string) => {
  const { code } = resolveFiatCurrency(locale);
  const fiatValue = convertUsdToFiat(valueUsd, locale);
  const maxDigits = code === 'KRW' ? 0 : Math.abs(fiatValue) >= 1000 ? 0 : 2;
  return new Intl.NumberFormat(resolveNumberLocale(locale), {
    style: 'currency',
    currency: code,
    maximumFractionDigits: maxDigits
  }).format(fiatValue);
};

const formatAmount = (value: number, locale: string, digits = 4) =>
  new Intl.NumberFormat(resolveNumberLocale(locale), { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(value);

const toTrimmedFixed = (value: number, fractionDigits = 1) => {
  const rounded = Number(value.toFixed(fractionDigits));
  if (!Number.isFinite(rounded)) return '0';
  return Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(fractionDigits);
};

const formatKoreanCompactNumber = (valueKrw: number) => {
  const sign = valueKrw < 0 ? '-' : '';
  const abs = Math.abs(valueKrw);
  if (abs >= 1e12) return `${sign}${toTrimmedFixed(abs / 1e12)}조`;
  if (abs >= 1e8) return `${sign}${toTrimmedFixed(abs / 1e8)}억`;
  if (abs >= 1e4) return `${sign}${toTrimmedFixed(abs / 1e4)}만`;
  return `${sign}${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(abs)}`;
};

const formatChineseCompactNumber = (valueCny: number) => {
  const sign = valueCny < 0 ? '-' : '';
  const abs = Math.abs(valueCny);
  if (abs >= 1e12) return `${sign}¥${toTrimmedFixed(abs / 1e12)}万亿`;
  if (abs >= 1e8) return `${sign}¥${toTrimmedFixed(abs / 1e8)}亿`;
  if (abs >= 1e4) return `${sign}¥${toTrimmedFixed(abs / 1e4)}万`;
  return `${sign}¥${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(abs)}`;
};

const formatCompactCurrency = (valueUsd: number, locale: string) => {
  const { code } = resolveFiatCurrency(locale);
  const fiatValue = convertUsdToFiat(valueUsd, locale);
  if (code === 'KRW') {
    return formatKoreanCompactNumber(fiatValue);
  }
  if (code === 'CNY') {
    return formatChineseCompactNumber(fiatValue);
  }
  return new Intl.NumberFormat(resolveNumberLocale(locale), {
    style: 'currency',
    currency: code,
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(fiatValue);
};

const formatCompactCount = (value: number, locale: string) =>
  new Intl.NumberFormat(resolveNumberLocale(locale), {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value);

const parseUsdCompactValue = (raw: string) => {
  const matched = raw.trim().match(/^\$?\s*([0-9]+(?:\.[0-9]+)?)\s*([KMBT])$/i);
  if (!matched) return null;
  const base = Number(matched[1]);
  if (!Number.isFinite(base)) return null;
  const unit = matched[2].toUpperCase();
  const multiplier = unit === 'K' ? 1e3 : unit === 'M' ? 1e6 : unit === 'B' ? 1e9 : unit === 'T' ? 1e12 : 1;
  return base * multiplier;
};

const localizeUsdCompactLabel = (raw: string, locale: string) => {
  const parsedUsd = parseUsdCompactValue(raw);
  if (parsedUsd === null) return raw;
  return formatCompactCurrency(parsedUsd, locale);
};

const formatMarketSpotPrice = (valueUsd: number, locale: string) => {
  const { code } = resolveFiatCurrency(locale);
  const fiatValue = Math.round(convertUsdToFiat(valueUsd, locale));
  const formattedNumber = new Intl.NumberFormat(resolveNumberLocale(locale), { maximumFractionDigits: 0 }).format(fiatValue);
  if (code === 'KRW') return `${formattedNumber} 원`;
  if (code === 'CNY') return `${formattedNumber} 元`;
  return `${formattedNumber} USD`;
};

const getDomainFromUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const toLocalIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseLocalDate = (isoDate: string) => new Date(`${isoDate}T00:00:00`);

const getBriefingWeekStartKey = (publishedAt: string) => {
  const date = parseLocalDate(publishedAt);
  if (Number.isNaN(date.getTime())) return publishedAt;
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() + diffToMonday);
  return toLocalIsoDate(weekStart);
};

const getWeekOfMonth = (date: Date) => Math.floor((date.getDate() - 1) / 7) + 1;

const formatBriefingWeekLabel = (referenceDate: string, lang: Language, locale: string) => {
  const date = parseLocalDate(referenceDate);
  if (Number.isNaN(date.getTime())) return referenceDate;
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const weekIndex = getWeekOfMonth(date);

  if (lang === 'ko') return `${year}년${month}월 ${weekIndex}주차`;
  if (lang === 'zh') return `${year}年${month}月 第${weekIndex}周`;
  const monthLabel = date.toLocaleDateString(locale, { month: 'short' });
  return `${year} ${monthLabel} W${weekIndex}`;
};

const buildBriefingLongParagraphs = (post: WeeklyBriefingPost, lang: Language): string[] => {
  const primary = post.points[0] ?? '';
  const secondary = post.points[1] ?? '';
  const tertiary = post.points[2] ?? '';

  if (lang === 'ko') {
    return [
      `이번 주 브리핑의 핵심 맥락은 "${post.title}" 입니다. ${post.summary} 특히 ${primary} 관점에서 보면, 단기 지표 변동보다 사용자 행동 패턴 변화가 더 빠르게 나타나고 있다는 점이 중요합니다. 실사용 구간에서는 체감 속도, 실패율, 안내 문구의 이해도 같은 운영형 지표가 실제 전환율과 재방문율을 좌우하는 흐름이 이어지고 있습니다.`,
      `실무 대응에서는 ${secondary || primary} 항목을 우선순위 1로 보고, ${tertiary || secondary || primary} 항목을 보완 과제로 묶어 운영하는 전략이 유효합니다. 또한 기능 구현 이후에는 이벤트 로그 기반으로 클릭-진입-완료 전환 퍼널을 주차 단위로 점검해, 개선 효과를 숫자로 확인하는 운영 루프를 함께 설계하는 것이 좋습니다.`
    ];
  }

  if (lang === 'zh') {
    return [
      `本周简报的核心语境是“${post.title}”。${post.summary} 从 ${primary} 的角度看，短期行情波动并不是唯一重点，用户行为变化（点击、放弃、重试）往往更早反映真实需求。在真实使用场景中，速度感知、失败率与提示可理解性，通常会直接影响转化与留存。`,
      `在执行层面，建议先把“${secondary || primary}”作为第一优先级，再将“${tertiary || secondary || primary}”纳入第二阶段优化。功能上线后应配套按周复盘的指标闭环（点击-进入-完成漏斗），用数据验证调整是否真正改善体验与业务结果。`
    ];
  }

  return [
    `This week’s briefing centers on "${post.title}". ${post.summary} From the perspective of ${primary}, the biggest signal is not only market movement but the speed of user-behavior shifts. In real product usage, perceived speed, failure rate, and message clarity tend to influence conversion and return rate more directly than headline metrics.`,
    `For execution, prioritize "${secondary || primary}" first, then run "${tertiary || secondary || primary}" as a second-track optimization. After shipping, keep a weekly operating loop that reviews click-to-enter-to-complete funnel metrics so each UX change can be validated with measurable impact.`
  ];
};

const hashSeed = (input: string) =>
  Array.from(input).reduce((acc, char) => ((acc * 31 + char.charCodeAt(0)) >>> 0), 2166136261);

const createSeededRandom = (seedInput: string) => {
  let seed = hashSeed(seedInput) || 123456789;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
};

const buildDappWatchMetrics = (seedInput: string) => {
  const random = createSeededRandom(`dapp-watch-${seedInput}`);
  const uaw = Math.round(2_000 + random() * 320_000);
  const dau = Math.round(uaw * (2.2 + random() * 5.8));
  const volume24hUsd = Math.round((150_000 + random() * 210_000_000) * 100) / 100;
  return {
    uaw,
    dau,
    volume24hUsd
  };
};

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const buildAssetChartSeries = (tokenId: string, range: AssetChartRange, count = 44) => {
  const random = createSeededRandom(`${tokenId}-${range}`);
  const volatilityMap: Record<AssetChartRange, number> = {
    '1H': 0.05,
    '1D': 0.09,
    '1W': 0.11,
    '1M': 0.12,
    '1Y': 0.13,
    ALL: 0.15
  };
  const driftMap: Record<AssetChartRange, number> = {
    '1H': 0.004,
    '1D': 0.008,
    '1W': 0.012,
    '1M': 0.016,
    '1Y': 0.02,
    ALL: 0.024
  };
  const volatility = volatilityMap[range];
  const drift = driftMap[range];

  let cursor = 0.52 + (random() - 0.5) * 0.12;
  const values: number[] = [clampNumber(cursor, 0.08, 0.92)];

  for (let idx = 1; idx < count; idx += 1) {
    const noise = (random() - 0.5) * volatility;
    const trend = (random() - 0.44) * drift;
    cursor = clampNumber(cursor + noise + trend, 0.06, 0.94);
    values.push(cursor);
  }

  return values;
};

const MARKET_PRICE_REFRESH_MS = 15000;
const MARKET_POPULAR_REFRESH_MS = 30000;
const MARKET_FX_REFRESH_MS = 300000;
const LIVE_NETWORK_FEE_REFRESH_MS = 30000;
const ONCHAIN_BALANCE_REFRESH_MS = 30000;
const ONCHAIN_NFT_REFRESH_MS = 45000;

const cloneToken = (token: WalletToken): WalletToken => ({ ...token });

const applyMarketPriceToToken = (token: WalletToken, marketPrices: MarketPriceMap): WalletToken => {
  const market = marketPrices[token.assetKey];
  if (!market) return token;

  const samePrice = Math.abs(token.priceUsd - market.priceUsd) < 0.0000001;
  const sameChange = Math.abs(token.change24h - market.change24h) < 0.0000001;
  if (samePrice && sameChange) return token;

  return {
    ...token,
    priceUsd: market.priceUsd,
    change24h: market.change24h
  };
};

const sortByCatalogOrder = (items: WalletToken[]) => {
  const orderMap = new Map(tokenCatalog.map((item, idx) => [item.id, idx]));
  return [...items].sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999));
};

const normalizeAddress = (chain: ChainCode, address: string) => {
  if (chain === 'ETH' || chain === 'BSC') return address.toLowerCase();
  if (chain === 'FIL') return address.toLowerCase();
  return address;
};

const detectAddressChains = (address: string): ChainCode[] => {
  const trimmed = address.trim();
  return (Object.keys(chainRegexMap) as ChainCode[]).filter((chain) => chainRegexMap[chain].test(trimmed));
};

const estimateNetworkFee = (chain: ChainCode) => {
  if (chain === 'BTC') return '$1.20';
  if (chain === 'ETH') return '$2.90';
  if (chain === 'BSC') return '$0.08';
  if (chain === 'TRX') return '$0.04';
  if (chain === 'SOL') return '$0.01';
  if (chain === 'XRP') return '$0.02';
  return '$0.05';
};

const parseUsdNumber = (value: string) => Number(value.replace(/[^0-9.]/g, '')) || 0;

const estimateNativeFee = (chain: ChainCode, gasPriceInput: string, gasLimitInput: string) => {
  const gasPrice = Number(gasPriceInput);
  const gasLimit = Number(gasLimitInput);
  if (chain === 'ETH' || chain === 'BSC') {
    const fallback = chain === 'ETH' ? 0.00012 : 0.0000021;
    if (!Number.isFinite(gasPrice) || !Number.isFinite(gasLimit) || gasPrice <= 0 || gasLimit <= 0) return fallback;
    return Number(((gasPrice * gasLimit) / 1_000_000_000).toFixed(9));
  }
  if (chain === 'BTC') return 0.00004;
  if (chain === 'TRX') return 1.2;
  if (chain === 'SOL') return 0.000005;
  if (chain === 'XRP') return 0.00012;
  return 0.0003;
};

const generateTxHash = (chain: ChainCode) => {
  const base = randomHexString(64);
  if (chain === 'SOL') return `${base.slice(0, 44)}`;
  if (chain === 'TRX') return `0x${base}`;
  return `0x${base}`;
};

const txExplorerUrlBuilder: Record<ChainCode, (hash: string) => string> = {
  BTC: (hash) => `https://www.blockchain.com/explorer/transactions/btc/${encodeURIComponent(hash)}`,
  ETH: (hash) => `https://etherscan.io/tx/${encodeURIComponent(hash)}`,
  XRP: (hash) => `https://xrpscan.com/tx/${encodeURIComponent(hash)}`,
  BSC: (hash) => `https://bscscan.com/tx/${encodeURIComponent(hash)}`,
  SOL: (hash) => `https://solscan.io/tx/${encodeURIComponent(hash)}`,
  TRX: (hash) => `https://tronscan.org/#/transaction/${encodeURIComponent(hash)}`,
  FIL: (hash) => `https://filfox.info/en/message/${encodeURIComponent(hash)}`
};

const buildTxExplorerUrl = (chain: ChainCode, hash: string) => txExplorerUrlBuilder[chain](hash.trim());

function normalizeChainCode(raw?: string): ChainCode | null {
  if (!raw) return null;
  const value = raw.trim().toUpperCase();
  if (value === 'BTC' || value.includes('BITCOIN')) return 'BTC';
  if (value === 'ETH' || value.includes('ETHEREUM') || value.includes('ERC')) return 'ETH';
  if (value === 'XRP') return 'XRP';
  if (value === 'BSC' || value.includes('BNB') || value.includes('BEP')) return 'BSC';
  if (value === 'SOL' || value.includes('SOLANA')) return 'SOL';
  if (value === 'TRX' || value.includes('TRON') || value.includes('TRC')) return 'TRX';
  if (value === 'FIL' || value.includes('FILECOIN')) return 'FIL';
  return null;
}

const normalizeAssetKey = (raw?: string): AssetKey | null => {
  if (!raw) return null;
  const value = raw.trim().toUpperCase();
  if (value === 'BTC' || value === 'ETH' || value === 'XRP' || value === 'BNB' || value === 'SOL' || value === 'TRX' || value === 'FIL' || value === 'USDT') {
    return value;
  }
  return null;
};

const normalizeTxTypeToWalletMode = (raw: unknown): TxItem['type'] => {
  if (raw === 'receive' || raw === 'buy') return 'receive';
  return 'send';
};

const normalizeStoredTransactions = (raw: unknown): WalletTxItem[] | null => {
  if (!Array.isArray(raw)) return null;
  const normalized: WalletTxItem[] = [];

  raw.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return;
    const row = entry as Record<string, unknown>;
    const rowId = String(row.id ?? `restored-tx-${index}`).trim();
    if (rowId.startsWith('seed-')) return;
    const tokenSymbol = String(row.tokenSymbol ?? '').trim().toUpperCase();
    const assetKey = normalizeAssetKey(tokenSymbol);
    if (!assetKey) return;
    const chain = normalizeChainCode(String(row.chain ?? row.network ?? '')) ?? (assetKey === 'BNB' ? 'BSC' : assetKey === 'USDT' ? 'ETH' : (assetKey as ChainCode));
    const amount = Number(row.amount ?? 0);
    const usdValue = Number(row.usdValue ?? 0);
    const feeNative = Number(row.feeNative ?? 0);
    const feeUsd = Number(row.feeUsd ?? 0);
    const counterparty = String(row.counterparty ?? '').trim();
    const createdAtRaw = String(row.createdAt ?? '').trim();
    const createdAtDate = new Date(createdAtRaw.replace(' ', 'T'));
    const hash = String(row.hash ?? '').trim();
    const normalizedFeeNative = Number.isFinite(feeNative) && feeNative > 0 ? feeNative : undefined;
    const normalizedFeeUsd = Number.isFinite(feeUsd) && feeUsd > 0 ? feeUsd : undefined;
    const feeStatus =
      row.feeStatus === 'confirmed'
        ? 'confirmed'
        : row.feeStatus === 'estimated'
          ? 'estimated'
          : normalizedFeeNative
            ? 'estimated'
            : undefined;
    const feeConfirmedAtRaw = String(row.feeConfirmedAt ?? '').trim();
    if (!counterparty) return;

    normalized.push({
      id: rowId || `restored-tx-${index}`,
      tokenSymbol,
      network: String(row.network ?? chainLabelMap[chain]).trim() || chainLabelMap[chain],
      type: normalizeTxTypeToWalletMode(row.type),
      status: row.status === 'pending' || row.status === 'failed' ? row.status : 'completed',
      amount: Number.isFinite(amount) ? amount : 0,
      usdValue: Number.isFinite(usdValue) ? usdValue : 0,
      counterparty,
      createdAt: Number.isNaN(createdAtDate.getTime()) ? nowStamp() : createdAtRaw,
      chain,
      memo: String(row.memo ?? '').trim() || undefined,
      hash: hash || undefined,
      feeNative: normalizedFeeNative,
      feeUsd: normalizedFeeUsd,
      feeStatus,
      feeConfirmedAt: feeConfirmedAtRaw || undefined
    });
  });

  if (!normalized.length) return null;
  return normalized.sort((a, b) => parseTxDate(b.createdAt).getTime() - parseTxDate(a.createdAt).getTime());
};

const normalizeStoredAddressBookEntries = (raw: unknown): AddressBookEntry[] | null => {
  if (!Array.isArray(raw)) return null;
  const normalized: AddressBookEntry[] = [];
  const dedupe = new Set<string>();

  raw.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return;
    const row = entry as Record<string, unknown>;
    const rowId = String(row.id ?? `restored-book-${index}`).trim();
    const chain = normalizeChainCode(String(row.chain ?? ''));
    if (!chain) return;
    const address = String(row.address ?? '').trim();
    const label = String(row.label ?? '').trim();
    if (!address || !label) return;
    const normalizedAddress = normalizeAddress(chain, address);
    const dedupeKey = `${chain}:${normalizedAddress}`;
    if (dedupe.has(dedupeKey)) return;
    dedupe.add(dedupeKey);

    const assetKey = normalizeAssetKey(String(row.assetKey ?? '')) ?? chainNativeAssetMap[chain];
    const createdAtRaw = String(row.createdAt ?? '').trim();
    const createdAtDate = new Date(createdAtRaw.replace(' ', 'T'));

    normalized.push({
      id: rowId || `restored-book-${index}`,
      chain,
      assetKey,
      address,
      label,
      createdAt: Number.isNaN(createdAtDate.getTime()) ? nowStamp() : createdAtRaw,
      memo: String(row.memo ?? '').trim() || undefined
    });
  });

  if (!normalized.length) return null;
  return normalized.sort((a, b) => parseTxDate(b.createdAt).getTime() - parseTxDate(a.createdAt).getTime());
};

const resolveTokenIdFromChainAsset = (chain: ChainCode, assetKey: AssetKey) =>
  tokenCatalog.find((token) => token.chainCode === chain && token.assetKey === assetKey)?.id ?? null;

const resolveTokenIdFromTx = (tx: TxItem) => {
  const assetKey = normalizeAssetKey(tx.tokenSymbol);
  if (!assetKey) return null;
  return resolveTokenIdFromChainAsset(inferChainFromTx(tx), assetKey);
};

const mergeTransactionsWithSeed = (stored: WalletTxItem[] | null) => {
  const base = stored ?? [];
  return [...base].sort((a, b) => parseTxDate(b.createdAt).getTime() - parseTxDate(a.createdAt).getTime());
};

const mergeAddressBookWithSeed = (stored: AddressBookEntry[] | null) => {
  const base = stored ?? [];
  return [...base].sort((a, b) => parseTxDate(b.createdAt).getTime() - parseTxDate(a.createdAt).getTime());
};

const mergeNftAddressBookWithSeed = (stored: AddressBookEntry[] | null) => {
  const base = stored ?? [];
  return [...base].sort((a, b) => parseTxDate(b.createdAt).getTime() - parseTxDate(a.createdAt).getTime());
};

const inferChainFromTx = (tx: TxItem): ChainCode => {
  const direct = normalizeChainCode(tx.chain);
  if (direct) return direct;

  const byNetwork = normalizeChainCode(tx.network);
  if (byNetwork) return byNetwork;

  const symbol = tx.tokenSymbol.toUpperCase();
  if (symbol === 'BTC') return 'BTC';
  if (symbol === 'ETH') return 'ETH';
  if (symbol === 'XRP') return 'XRP';
  if (symbol === 'BNB') return 'BSC';
  if (symbol === 'SOL') return 'SOL';
  if (symbol === 'TRX') return 'TRX';
  if (symbol === 'FIL') return 'FIL';
  if (symbol === 'USDT') {
    if (tx.network.toUpperCase().includes('TRON') || tx.network.toUpperCase().includes('TRC')) return 'TRX';
    if (tx.network.toUpperCase().includes('BNB') || tx.network.toUpperCase().includes('BEP')) return 'BSC';
    return 'ETH';
  }

  return 'ETH';
};

const parseTxDate = (createdAt: string) => {
  const parsed = new Date(createdAt.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
};

const formatDateYmd = (date: Date) => {
  const yyyy = `${date.getFullYear()}`;
  const mm = `${date.getMonth() + 1}`.padStart(2, '0');
  const dd = `${date.getDate()}`.padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const parseYmdDate = (ymd: string) => {
  const parts = ymd.split('-').map((value) => Number(value));
  if (parts.length !== 3 || parts.some((value) => !Number.isFinite(value))) return null;
  const [year, month, day] = parts;
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
const endOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const buildMockHashFromSeed = (chain: ChainCode, seed: string) => {
  const encoded = Array.from(seed)
    .map((char) => char.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');
  const hashCore = (encoded + 'a1b2c3d4e5f60789').repeat(8).slice(0, 64);
  if (chain === 'SOL') return hashCore.slice(0, 44);
  return `0x${hashCore}`;
};

const formatNativeFee = (value: number) => {
  if (value === 0) return '0';
  if (value >= 1) return value.toFixed(2);
  if (value >= 0.01) return value.toFixed(4);
  return value.toFixed(8);
};

const nowStamp = () => {
  const date = new Date();
  const yyyy = `${date.getFullYear()}`;
  const mm = `${date.getMonth() + 1}`.padStart(2, '0');
  const dd = `${date.getDate()}`.padStart(2, '0');
  const hh = `${date.getHours()}`.padStart(2, '0');
  const min = `${date.getMinutes()}`.padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
};

const unnamedWalletBaseByLang: Record<Language, string> = {
  ko: '메인 지갑',
  en: 'Main Wallet',
  zh: '主钱包'
};

const formatAutoWalletName = (index: number, lang: Language) => {
  const base = unnamedWalletBaseByLang[lang];
  return index <= 0 ? base : `${base} ${index}`;
};

const parseAutoWalletNameIndex = (rawName: string): number | null => {
  const value = rawName.trim();
  const patterns = [/^메인\s*지갑(?:\s+(\d+))?$/i, /^main\s*wallet(?:\s+(\d+))?$/i, /^主钱包(?:\s*(\d+))?$/i];

  for (const pattern of patterns) {
    const matched = value.match(pattern);
    if (!matched) continue;
    const parsed = Number.parseInt(matched[1] ?? '0', 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
  }
  return null;
};

const resolveWalletDisplayName = (wallet: WalletAccount, lang: Language) => {
  if (wallet.nameMode === 'auto' && Number.isFinite(wallet.autoNameIndex)) {
    return formatAutoWalletName(Math.max(0, Math.floor(Number(wallet.autoNameIndex))), lang);
  }
  return wallet.name;
};

const buildNextAutoWalletName = (existing: WalletAccount[], lang: Language) => {
  const lowerSet = new Set(existing.map((item) => resolveWalletDisplayName(item, lang).trim().toLowerCase()));
  let idx = 0;
  let candidate = formatAutoWalletName(idx, lang);
  while (lowerSet.has(candidate.toLowerCase())) {
    idx += 1;
    candidate = formatAutoWalletName(idx, lang);
  }
  return { label: candidate, index: idx };
};

const buildUniqueWalletName = (
  rawName: string,
  existing: WalletAccount[],
  lang: Language
): { name: string; nameMode: 'auto' | 'custom'; autoNameIndex?: number } => {
  const normalizedInput = rawName.trim();
  const lowerSet = new Set(existing.map((item) => resolveWalletDisplayName(item, lang).trim().toLowerCase()));

  if (!normalizedInput) {
    const nextAuto = buildNextAutoWalletName(existing, lang);
    return {
      name: nextAuto.label,
      nameMode: 'auto',
      autoNameIndex: nextAuto.index
    };
  }

  if (!lowerSet.has(normalizedInput.toLowerCase())) {
    return { name: normalizedInput, nameMode: 'custom' };
  }
  let idx = 2;
  while (lowerSet.has(`${normalizedInput} ${idx}`.toLowerCase())) idx += 1;
  return { name: `${normalizedInput} ${idx}`, nameMode: 'custom' };
};

const isLegacyAutoWalletName = (rawName: string) => {
  const value = rawName.trim();
  return (
    /^main wallet$/i.test(value) ||
    /^defi wallet$/i.test(value) ||
    /^cold wallet$/i.test(value) ||
    /^wallet\s+\d+$/i.test(value) ||
    /^main wallet\s+\d+$/i.test(value)
  );
};

const ASSET_SWITCH_TRACK_WIDTH = 64;
const ASSET_SWITCH_TRACK_HEIGHT = 34;
const ASSET_SWITCH_THUMB_SIZE = 22;
const ASSET_SWITCH_INSET = Math.max(Math.round((ASSET_SWITCH_TRACK_HEIGHT - ASSET_SWITCH_THUMB_SIZE) / 2), 0);
const ASSET_SWITCH_TRAVEL = Math.max(ASSET_SWITCH_TRACK_WIDTH - ASSET_SWITCH_THUMB_SIZE - ASSET_SWITCH_INSET * 2, 0);
const ASSET_SWITCH_LABEL_INSET = ASSET_SWITCH_INSET + 3;
const ASSET_SWITCH_LEFT_OFFSET = -2;
const ASSET_SWITCH_TOP_OFFSET = -1;

const THEME_SWITCH_TRACK_WIDTH = 124;
const THEME_SWITCH_TRACK_HEIGHT = 36;
const THEME_SWITCH_INSET = 2;
const THEME_SWITCH_INNER_WIDTH = Math.max(THEME_SWITCH_TRACK_WIDTH - THEME_SWITCH_INSET * 2, 0);
const THEME_SWITCH_PILL_WIDTH = Math.max(THEME_SWITCH_INNER_WIDTH / 2, 0);

const DISCOVER_QUICK_SCROLL_OFFSET = 8;

const HEADER_OVERLAY_HEIGHT = 56;
const HEADER_BUTTON_HIT_SLOP = { top: 22, bottom: 14, left: 14, right: 14 } as const;

type AssetSwitchToggleProps = {
  enabled: boolean;
  onToggle: () => void;
  styles: any;
};

const AssetSwitchToggle = ({ enabled, onToggle, styles }: AssetSwitchToggleProps) => {
  const toggleAnim = useRef(new Animated.Value(enabled ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(toggleAnim, {
      toValue: enabled ? 1 : 0,
      duration: 190,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false
    }).start(({ finished }) => {
      if (finished) toggleAnim.setValue(enabled ? 1 : 0);
    });
  }, [enabled, toggleAnim]);

  const thumbLeft = toggleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [ASSET_SWITCH_INSET + ASSET_SWITCH_LEFT_OFFSET, ASSET_SWITCH_INSET + ASSET_SWITCH_TRAVEL]
  });

  return (
    <Pressable style={[styles.assetSwitchTrack, enabled ? styles.assetSwitchTrackOn : styles.assetSwitchTrackOff]} onPress={onToggle}>
      <View style={styles.assetSwitchLabelWrap}>
        <Text style={enabled ? styles.assetSwitchLabelOn : styles.assetSwitchLabelOff}>{enabled ? 'ON' : 'OFF'}</Text>
      </View>
      <Animated.View
        style={[
          styles.assetSwitchThumb,
          {
            top: ASSET_SWITCH_INSET + ASSET_SWITCH_TOP_OFFSET,
            left: thumbLeft
          }
        ]}
      />
    </Pressable>
  );
};

function AppInner() {
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const appBootStartedAtRef = useRef(Date.now());
  const sendFlowStartedAtRef = useRef<number | null>(null);
  const [showLaunchIntro, setShowLaunchIntro] = useState(true);
  const launchIntroProgress = useRef(new Animated.Value(0)).current;
  const launchIntroAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const launchIntroLogoOpacity = useMemo(
    () =>
      launchIntroProgress.interpolate({
        inputRange: [0, 0.2667, 0.7333, 1],
        outputRange: [0, 1, 1, 0],
        extrapolate: 'clamp'
      }),
    [launchIntroProgress]
  );
  const [lang, setLang] = useState<Language>('ko');
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [walletSegment, setWalletSegment] = useState<WalletSegment>('crypto');
  const [segmentTrackWidth, setSegmentTrackWidth] = useState(0);
  const [segmentLayout, setSegmentLayout] = useState<{ firstX: number; secondX: number; firstWidth: number }>({
    firstX: 2,
    secondX: 2,
    firstWidth: 0
  });
  const [stack, setStack] = useState<Screen[]>(['home']);
  const { walletAccounts, setWalletAccounts, walletId, setWalletId, activeWallet, walletStoreHydrated } = useWalletStore([]);
  const { enabledTokenIds, toggleEnabledToken } = useAssetToggleStore(defaultEnabledTokenIds);
  const [tokens, setTokens] = useState<WalletToken[]>(() =>
    sortByCatalogOrder(tokenCatalog.filter((token) => enabledTokenIds.includes(token.id)).map(cloneToken))
  );
  const [, forceFxRender] = useState(0);
  const [marketPrices, setMarketPrices] = useState<MarketPriceMap>({});
  const [marketAssetInfoMap, setMarketAssetInfoMap] = useState<MarketAssetInfoMap>({});
  const [assetLiveHolderCount, setAssetLiveHolderCount] = useState<number | null>(null);
  const [popularMarketTokens, setPopularMarketTokens] = useState<PopularTokenItem[] | null>(null);
  const [popularMarketDapps, setPopularMarketDapps] = useState<PopularDappItem[] | null>(null);
  const [popularMarketDappsByCategory, setPopularMarketDappsByCategory] = useState<PopularDappCategoryBuckets | null>(null);
  const [discoverTokenIconUrlBySymbol, setDiscoverTokenIconUrlBySymbol] = useState<Record<string, string>>({});
  const [discoverCachedTokenIconUrlBySymbol, setDiscoverCachedTokenIconUrlBySymbol] = useState<Record<string, string>>({});
  const [discoverCachedDappIconUrlByKey, setDiscoverCachedDappIconUrlByKey] = useState<Record<string, string>>({});
  const [discoverCachedSiteIconUrlByKey, setDiscoverCachedSiteIconUrlByKey] = useState<Record<string, string>>({});
  const [collectibles, setCollectibles] = useState<CollectibleItem[]>(() =>
    initialCollectibles.map((item) => ({
      ...item,
      owned: 0
    }))
  );
  const [txs, setTxs] = useState<WalletTxItem[]>([]);
  const [txStoreHydrated, setTxStoreHydrated] = useState(false);
  const [historyScopeFilter, setHistoryScopeFilter] = useState<HistoryScopeFilter>('ALL');
  const [historyChainFilter, setHistoryChainFilter] = useState<'ALL' | ChainCode>('ALL');
  const [historyAssetFilter, setHistoryAssetFilter] = useState<'ALL' | AssetKey>('ALL');
  const [historyPage, setHistoryPage] = useState(1);
  const [manageChainFilter, setManageChainFilter] = useState<'ALL' | ChainCode>('ALL');
  const [manageAssetFilter, setManageAssetFilter] = useState<'ALL' | AssetKey>('ALL');
  const [historyDateFilter, setHistoryDateFilter] = useState<HistoryDateFilter>('ALL');
  const [historyRangeStart, setHistoryRangeStart] = useState<string | null>(null);
  const [historyRangeEnd, setHistoryRangeEnd] = useState<string | null>(null);
  const [historyRangeDraftStart, setHistoryRangeDraftStart] = useState<string | null>(null);
  const [historyRangeDraftEnd, setHistoryRangeDraftEnd] = useState<string | null>(null);
  const [historyRangePresetDraft, setHistoryRangePresetDraft] = useState<3 | 6 | 12 | null>(null);
  const [showHistoryDateRangeModal, setShowHistoryDateRangeModal] = useState(false);
  const [showHistoryDateCalendarModal, setShowHistoryDateCalendarModal] = useState(false);
  const [addressBookScope, setAddressBookScope] = useState<AddressBookScope>('asset');
  const addressBookScopeRef = useRef<AddressBookScope>('asset');
  const [showHomeAssetLayoutModal, setShowHomeAssetLayoutModal] = useState(false);
  const [homeAssetLayout, setHomeAssetLayout] = useState<HomeAssetLayout>(1);
  const [homeAssetLayoutDraft, setHomeAssetLayoutDraft] = useState<HomeAssetLayout>(1);
  const [historyCalendarTarget, setHistoryCalendarTarget] = useState<'start' | 'end'>('start');
  const [addressBookChainFilter, setAddressBookChainFilter] = useState<'ALL' | ChainCode>('ALL');
  const [addressBookAssetFilter, setAddressBookAssetFilter] = useState<'ALL' | AssetKey>('ALL');
  const [addressBookDateFilter, setAddressBookDateFilter] = useState<AddressBookDateFilter>('ALL');
  const [addressBookPage, setAddressBookPage] = useState(1);
  const [historyCalendarMonth, setHistoryCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [showBalance, setShowBalance] = useState(true);
  const [assetDetailTokenId, setAssetDetailTokenId] = useState<string>('btc');
  const [assetRecentPage, setAssetRecentPage] = useState(1);
  const [assetChartRange, setAssetChartRange] = useState<AssetChartRange>('1D');
  const [assetInfoExpanded, setAssetInfoExpanded] = useState(false);
  const [assetChartWidth, setAssetChartWidth] = useState(0);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showWalletMenu, setShowWalletMenu] = useState(false);
  const [walletMenuAnchorRect, setWalletMenuAnchorRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [homeScanTriggerRect, setHomeScanTriggerRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [homeLayoutTriggerRect, setHomeLayoutTriggerRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [historyRangeTriggerRect, setHistoryRangeTriggerRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [settingsLangTriggerRect, setSettingsLangTriggerRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [securityAutoLockTriggerRect, setSecurityAutoLockTriggerRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [securityLockMethodTriggerRect, setSecurityLockMethodTriggerRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [securityBiometricTypeTriggerRect, setSecurityBiometricTypeTriggerRect] = useState<{ x: number; y: number; width: number; height: number } | null>(
    null
  );
  const [discoverBriefingWeekTriggerRect, setDiscoverBriefingWeekTriggerRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [sendRecentAnchorRect, setSendRecentAnchorRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [nftRecentAnchorRect, setNftRecentAnchorRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [assetRecipientActionAnchorRectMap, setAssetRecipientActionAnchorRectMap] = useState<{
    scan: { x: number; y: number; width: number; height: number } | null;
    book: { x: number; y: number; width: number; height: number } | null;
    save: { x: number; y: number; width: number; height: number } | null;
  }>({
    scan: null,
    book: null,
    save: null
  });
  const [nftRecipientActionAnchorRectMap, setNftRecipientActionAnchorRectMap] = useState<{
    scan: { x: number; y: number; width: number; height: number } | null;
    book: { x: number; y: number; width: number; height: number } | null;
    save: { x: number; y: number; width: number; height: number } | null;
  }>({
    scan: null,
    book: null,
    save: null
  });
  const [discoverCategory, setDiscoverCategory] = useState<DiscoverDappFilterId>('all');
  const [discoverTokenCategory, setDiscoverTokenCategory] = useState<DiscoverTokenCategoryId>('all');
  const [discoverSiteCategory, setDiscoverSiteCategory] = useState<DiscoverSiteCategoryId>('all');
  const [discoverQuickActive, setDiscoverQuickActive] = useState<DiscoverQuickSection | null>(null);
  const [discoverQuickArmed, setDiscoverQuickArmed] = useState(false);
  const [discoverPopularPage, setDiscoverPopularPage] = useState(1);
  const [discoverWatchlistPage, setDiscoverWatchlistPage] = useState(1);
  const [discoverBriefingWeekKey, setDiscoverBriefingWeekKey] = useState<string | null>(null);
  const [discoverBriefingExpandedId, setDiscoverBriefingExpandedId] = useState<string | null>(null);
  const [showDiscoverBriefingWeekMenu, setShowDiscoverBriefingWeekMenu] = useState(false);
  const [discoverSearchInput, setDiscoverSearchInput] = useState('');
  const [discoverFeed, setDiscoverFeed] = useState<DiscoverFeedPayload | null>(null);
  const [discoverFeedLoading, setDiscoverFeedLoading] = useState(false);
  const [discoverFeedError, setDiscoverFeedError] = useState('');
  const [discoverDataBootReady, setDiscoverDataBootReady] = useState(false);
  const [discoverBrokenIconUris, setDiscoverBrokenIconUris] = useState<Record<string, number>>({});
  const [discoverOpenTabs, setDiscoverOpenTabs] = useState<DiscoverBrowserTab[]>([]);
  const [discoverHistoryTabs, setDiscoverHistoryTabs] = useState<DiscoverBrowserTab[]>([]);
  const [discoverFavoriteTabs, setDiscoverFavoriteTabs] = useState<DiscoverBrowserTab[]>([]);
  const [discoverActiveTabId, setDiscoverActiveTabId] = useState<string | null>(null);
  const [discoverBrowserDraftUrl, setDiscoverBrowserDraftUrl] = useState('');
  const [discoverBrowserRefreshKey, setDiscoverBrowserRefreshKey] = useState(0);
  const [discoverSecurityPrompt, setDiscoverSecurityPrompt] = useState<DiscoverSecurityPrompt | null>(null);
  const [discoverTrustedHosts, setDiscoverTrustedHosts] = useState<DiscoverTrustedHostEntry[]>([]);
  const [discoverTrustedHostInput, setDiscoverTrustedHostInput] = useState('');
  const [discoverTrustedHostMemoInput, setDiscoverTrustedHostMemoInput] = useState('');
  const [discoverTrustedEditId, setDiscoverTrustedEditId] = useState<string | null>(null);
  const [discoverWebViewCanGoBack, setDiscoverWebViewCanGoBack] = useState(false);
  const [discoverWebViewCanGoForward, setDiscoverWebViewCanGoForward] = useState(false);
  const hasWallet = walletAccounts.length > 0;
  const lockPreviewMode = useMemo<SendAuthMethod | null>(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
    const rawMode = new URLSearchParams(window.location.search).get('lockPreview');
    if (rawMode === 'password' || rawMode === 'fingerprint' || rawMode === 'face') return rawMode;
    return null;
  }, []);
  const isLockPreviewMode = lockPreviewMode !== null;
  const [allowPush, setAllowPush] = useState(true);
  const [sendReceiveNoti, setSendReceiveNoti] = useState(true);
  const [announcements, setAnnouncements] = useState(false);
  const [passwordLockEnabled, setPasswordLockEnabled] = useState(true);
  const [biometric, setBiometric] = useState(true);
  const [confirmSign, setConfirmSign] = useState(true);
  const [autoLockOption, setAutoLockOption] = useState<AutoLockOption>('IMMEDIATE');
  const [showAutoLockMenu, setShowAutoLockMenu] = useState(false);
  const [showLockMethodMenu, setShowLockMethodMenu] = useState(false);
  const [showBiometricTypeMenu, setShowBiometricTypeMenu] = useState(false);
  const [sendAuthMethod, setSendAuthMethod] = useState<SendAuthMethod>('password');
  const [fingerprintBiometricSupported, setFingerprintBiometricSupported] = useState(true);
  const [faceBiometricSupported, setFaceBiometricSupported] = useState(Platform.OS !== 'android');
  const [settingsAuthTarget, setSettingsAuthTarget] = useState<'wallets' | 'security' | 'addressBook'>('wallets');
  const [sendPassword, setSendPassword] = useState('');
  const [passwordAuthFailureCount, setPasswordAuthFailureCount] = useState(0);
  const [passwordAuthLockUntilMs, setPasswordAuthLockUntilMs] = useState(0);
  const [isSecurityLoaded, setIsSecurityLoaded] = useState(false);
  const [appLocked, setAppLocked] = useState(false);
  const [appUnlockInput, setAppUnlockInput] = useState('');
  const [appUnlockError, setAppUnlockError] = useState('');
  const [appUnlockUsePassword, setAppUnlockUsePassword] = useState(false);
  const [onboardingPasswordInput, setOnboardingPasswordInput] = useState('');
  const [onboardingPasswordConfirmInput, setOnboardingPasswordConfirmInput] = useState('');
  const [onboardingPasswordTarget, setOnboardingPasswordTarget] = useState<'password' | 'confirm'>('password');
  const [onboardingPasswordError, setOnboardingPasswordError] = useState('');
  const [pendingInitialCreateAfterPassword, setPendingInitialCreateAfterPassword] = useState(false);
  const [onboardingDoneGoHomeOnly, setOnboardingDoneGoHomeOnly] = useState(false);
  const [walletSettingsAuthInput, setWalletSettingsAuthInput] = useState('');

  useEffect(() => {
    if (Platform.OS === 'web') {
      setShowLaunchIntro(false);
      return;
    }
    const launchIntroDuration = 1500;
    let isMounted = true;

    launchIntroProgress.setValue(0);
    const animation = Animated.timing(launchIntroProgress, {
      toValue: 1,
      duration: launchIntroDuration,
      easing: Easing.linear,
      useNativeDriver: true,
      isInteraction: false
    });

    launchIntroAnimationRef.current = animation;
    animation.start(({ finished }) => {
      if (!isMounted || !finished) return;
      requestAnimationFrame(() => {
        if (!isMounted) return;
        setShowLaunchIntro(false);
      });
      launchIntroAnimationRef.current = null;
    });

    return () => {
      isMounted = false;
      launchIntroAnimationRef.current?.stop();
      launchIntroAnimationRef.current = null;
    };
  }, [launchIntroProgress]);
  const [walletSettingsAuthError, setWalletSettingsAuthError] = useState('');
  const [authPasswordInput, setAuthPasswordInput] = useState('');
  const [authErrorMessage, setAuthErrorMessage] = useState('');
  const walletNameMigrationDoneRef = useRef(false);
  const discoverIconCacheSyncSignatureRef = useRef('');
  const seedClipboardClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const shouldLockOnActiveRef = useRef(false);
  const appLockBiometricAutoRequestedRef = useRef(false);
  const lastBackgroundAtRef = useRef<number | null>(null);
  const persistedSendPasswordRef = useRef('');
  const [walletSeedMap, setWalletSeedMap] = useState<Record<string, string[]>>({});
  const [walletSeedPassphraseMap, setWalletSeedPassphraseMap] = useState<Record<string, string>>({});
  const [walletAccountIndexMap, setWalletAccountIndexMap] = useState<Record<string, number>>({});
  const [recoveryWordCount, setRecoveryWordCount] = useState<RecoveryWordCount>(DEFAULT_RECOVERY_WORD_COUNT);
  const [seedPassphraseInput, setSeedPassphraseInput] = useState('');
  const [seedAccountIndexInput, setSeedAccountIndexInput] = useState('0');
  const [onboardingSeedWords, setOnboardingSeedWords] = useState<string[]>(() => createEmptySeedWords(DEFAULT_RECOVERY_WORD_COUNT));
  const [agreeBackup, setAgreeBackup] = useState(false);
  const [agreeNeverShare, setAgreeNeverShare] = useState(false);
  const [agreeNoRecover, setAgreeNoRecover] = useState(false);
  const [deleteWalletId, setDeleteWalletId] = useState<string | null>(null);
  const [deleteAgreeBackup, setDeleteAgreeBackup] = useState(false);
  const [deleteAgreeNoRecovery, setDeleteAgreeNoRecovery] = useState(false);
  const [deleteAgreeFinal, setDeleteAgreeFinal] = useState(false);
  const [deleteSeedWords, setDeleteSeedWords] = useState<string[]>([]);
  const [deleteSeedTouched, setDeleteSeedTouched] = useState(false);
  const [deleteAuthPasswordInput, setDeleteAuthPasswordInput] = useState('');
  const [deleteAuthErrorMessage, setDeleteAuthErrorMessage] = useState('');
  const [onboardingWalletName, setOnboardingWalletName] = useState('');
  const [phraseInput, setPhraseInput] = useState('');
  const [seedWords, setSeedWords] = useState<string[]>(() => createEmptySeedWords(DEFAULT_RECOVERY_WORD_COUNT));
  const [selectedNetwork, setSelectedNetwork] = useState('Ethereum');
  const [recoveryIndexScanLoading, setRecoveryIndexScanLoading] = useState(false);
  const [recoveryIndexScanResult, setRecoveryIndexScanResult] = useState<RecoveryAccountIndexScanResult | null>(null);
  const [bannerMessage, setBannerMessage] = useState('');
  const [recipientInput, setRecipientInput] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [sendTokenId, setSendTokenId] = useState('btc');
  const [receiveTokenId, setReceiveTokenId] = useState('btc');
  const [sendChainCode, setSendChainCode] = useState<ChainCode>('BTC');
  const [receiveChainCode, setReceiveChainCode] = useState<ChainCode>('BTC');
  const [sendChainFilter, setSendChainFilter] = useState<'ALL' | ChainCode>('ALL');
  const [receiveChainFilter, setReceiveChainFilter] = useState<'ALL' | ChainCode>('ALL');
  const [sendAssetFilterTokenId, setSendAssetFilterTokenId] = useState<string | 'ALL'>('ALL');
  const [receiveAssetFilterTokenId, setReceiveAssetFilterTokenId] = useState<string | 'ALL'>('ALL');
  const [sendMemoInput, setSendMemoInput] = useState('');
  const [nftSendCollectibleId, setNftSendCollectibleId] = useState<string | null>(null);
  const [receiveNftChainFilter, setReceiveNftChainFilter] = useState<'ALL' | ChainCode>('ALL');
  const [nftDetailCollectibleId, setNftDetailCollectibleId] = useState<string | null>(null);
  const [nftSendRecipientInput, setNftSendRecipientInput] = useState('');
  const [nftSendMemoInput, setNftSendMemoInput] = useState('');
  const [nftSendRecipientTouched, setNftSendRecipientTouched] = useState(false);
  const [nftSendRecipientFocused, setNftSendRecipientFocused] = useState(false);
  const [addressBook, setAddressBook] = useState<AddressBookEntry[]>([]);
  const [addressBookStoreHydrated, setAddressBookStoreHydrated] = useState(false);
  const [nftAddressBook, setNftAddressBook] = useState<AddressBookEntry[]>([]);
  const [nftAddressBookStoreHydrated, setNftAddressBookStoreHydrated] = useState(false);
  const [addressLabelInput, setAddressLabelInput] = useState('');
  const [addressValueInput, setAddressValueInput] = useState('');
  const [addressFormChain, setAddressFormChain] = useState<ChainCode>('ETH');
  const [addressFormAssetKey, setAddressFormAssetKey] = useState<AssetKey>(chainNativeAssetMap.ETH);
  const [showAddressBookEditModal, setShowAddressBookEditModal] = useState(false);
  const [addressEditScope, setAddressEditScope] = useState<AddressBookScope>('asset');
  const [addressEditTargetId, setAddressEditTargetId] = useState<string | null>(null);
  const [addressEditChain, setAddressEditChain] = useState<ChainCode>('ETH');
  const [addressEditAssetKey, setAddressEditAssetKey] = useState<AssetKey>(chainNativeAssetMap.ETH);
  const [addressEditLabelInput, setAddressEditLabelInput] = useState('');
  const [addressEditValueInput, setAddressEditValueInput] = useState('');
  const [showRecipientBookModal, setShowRecipientBookModal] = useState(false);
  const [recipientBookScope, setRecipientBookScope] = useState<AddressBookScope>('asset');
  const [recipientBookChainFilter, setRecipientBookChainFilter] = useState<'ALL' | ChainCode>('ALL');
  const [recipientBookAssetFilter, setRecipientBookAssetFilter] = useState<'ALL' | AssetKey>('ALL');
  const [recipientBookPage, setRecipientBookPage] = useState(1);
  const [showSaveRecipientModal, setShowSaveRecipientModal] = useState(false);
  const [saveRecipientScope, setSaveRecipientScope] = useState<AddressBookScope>('asset');
  const [saveRecipientLabelInput, setSaveRecipientLabelInput] = useState('');
  const [showScanMethodModal, setShowScanMethodModal] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [scanEntryPoint, setScanEntryPoint] = useState<'send' | 'nftSend' | 'home'>('send');
  const [showRecentSendDropdown, setShowRecentSendDropdown] = useState(false);
  const [showNftRecentSendDropdown, setShowNftRecentSendDropdown] = useState(false);
  const [supportMessages, setSupportMessages] = useState<SupportChatMessage[]>([]);
  const [supportComposerText, setSupportComposerText] = useState('');
  const [supportComposerImageUri, setSupportComposerImageUri] = useState<string | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [recipientTouched, setRecipientTouched] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);
  const [recipientFocused, setRecipientFocused] = useState(false);
  const [amountFocused, setAmountFocused] = useState(false);
  const [memoFocused, setMemoFocused] = useState(false);
  const [favoriteTokenIds, setFavoriteTokenIds] = useState<string[]>([]);
  const [discoverFavoriteDappIds, setDiscoverFavoriteDappIds] = useState<string[]>([]);
  const [discoverFavoriteTokenSymbols, setDiscoverFavoriteTokenSymbols] = useState<string[]>([]);
  const [discoverFavoriteSiteIds, setDiscoverFavoriteSiteIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState('');
  const toastTranslateY = useRef(new Animated.Value(-22)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomSheetAnim = useRef(new Animated.Value(0)).current;
  const walletMenuAnim = useRef(new Animated.Value(0)).current;
  const recentSendDropdownAnim = useRef(new Animated.Value(0)).current;
  const nftRecentSendDropdownAnim = useRef(new Animated.Value(0)).current;
  const discoverBriefingWeekMenuAnim = useRef(new Animated.Value(0)).current;
  const segmentAnim = useRef(new Animated.Value(walletSegment === 'crypto' ? 0 : 1)).current;
  const langMenuAnim = useRef(new Animated.Value(0)).current;
  const autoLockMenuAnim = useRef(new Animated.Value(0)).current;
  const lockMethodMenuAnim = useRef(new Animated.Value(0)).current;
  const biometricTypeMenuAnim = useRef(new Animated.Value(0)).current;
  const settingThemeAnim = useRef(new Animated.Value(themeMode === 'light' ? 0 : 1)).current;
  const discoverScrollRef = useRef<ScrollView | null>(null);
  const discoverPopularScrollRef = useRef<ScrollView | null>(null);
  const discoverSectionScrollRef = useRef<ScrollView | null>(null);
  const discoverTabListScrollRef = useRef<ScrollView | null>(null);
  const nftSendScrollRef = useRef<ScrollView | null>(null);
  const nftReceiveScrollRef = useRef<ScrollView | null>(null);
  const nftDetailScrollRef = useRef<ScrollView | null>(null);
  const phoneShellRef = useRef<View | null>(null);
  const homeWalletAnchorRef = useRef<View | null>(null);
  const homeScanTriggerRef = useRef<View | null>(null);
  const homeLayoutTriggerRef = useRef<View | null>(null);
  const historyRangeTriggerRef = useRef<View | null>(null);
  const settingsLangTriggerRef = useRef<View | null>(null);
  const securityAutoLockTriggerRef = useRef<View | null>(null);
  const securityLockMethodTriggerRef = useRef<View | null>(null);
  const securityBiometricTypeTriggerRef = useRef<View | null>(null);
  const discoverBriefingWeekTriggerRef = useRef<View | null>(null);
  const sendRecentAnchorRef = useRef<View | null>(null);
  const nftRecentAnchorRef = useRef<View | null>(null);
  const assetSaveActionRef = useRef<View | null>(null);
  const assetBookActionRef = useRef<View | null>(null);
  const assetScanActionRef = useRef<View | null>(null);
  const nftSaveActionRef = useRef<View | null>(null);
  const nftBookActionRef = useRef<View | null>(null);
  const nftScanActionRef = useRef<View | null>(null);
  const discoverWebViewRef = useRef<WebView | null>(null);
  const discoverSecurityAllowHostsRef = useRef<Set<string>>(new Set());
  const discoverSectionOffsetsRef = useRef<Record<DiscoverQuickSection, number>>({
    earn: 0,
    exploreDapps: 0,
    popularTokens: 0,
    watchlist: 0,
    sites: 0
  });
  const supportChatScrollRef = useRef<ScrollView | null>(null);
  const supportReplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [settingThemeLayout, setSettingThemeLayout] = useState<{ firstX: number; secondX: number; firstWidth: number }>({
    firstX: THEME_SWITCH_INSET,
    secondX: THEME_SWITCH_INSET + THEME_SWITCH_PILL_WIDTH,
    firstWidth: THEME_SWITCH_PILL_WIDTH
  });
  const [liveNetworkFeeMap, setLiveNetworkFeeMap] = useState<Partial<Record<ChainCode, LiveNetworkFeeSnapshot>>>({});
  const [sendGasSettings, setSendGasSettings] = useState<SendGasSettings>({ ...DEFAULT_SEND_GAS_SETTINGS });
  const [sendDraft, setSendDraft] = useState<SendDraft | null>(null);
  const [sendIsProcessing, setSendIsProcessing] = useState(false);
  const [sendIsDone, setSendIsDone] = useState(false);
  const [txDetailData, setTxDetailData] = useState<TxDetailData | null>(null);
  const [txDetailHeaderMode, setTxDetailHeaderMode] = useState<TxDetailHeaderMode>('history');
  const [scanLocked, setScanLocked] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const skipNextSendResetRef = useRef(false);
  const skipNextReceiveResetRef = useRef(false);
  const skipNextHistoryResetRef = useRef(false);
  const discoverIconCacheSyncedStageRef = useRef<{ seed: boolean; live: boolean }>({ seed: false, live: false });

  const measureWalletMenuAnchor = useCallback(() => {
    const shellNode = phoneShellRef.current;
    const anchorNode = homeWalletAnchorRef.current;
    if (!shellNode || !anchorNode || typeof anchorNode.measureLayout !== 'function') {
      return;
    }
    anchorNode.measureLayout(
      shellNode,
      (x, y, width, height) => {
        setWalletMenuAnchorRect({ x, y, width, height });
      },
      () => {}
    );
  }, []);

  const measureHomeLayoutTriggerAnchor = useCallback(() => {
    const shellNode = phoneShellRef.current;
    const anchorNode = homeLayoutTriggerRef.current;
    if (!shellNode || !anchorNode || typeof anchorNode.measureLayout !== 'function') {
      return;
    }
    anchorNode.measureLayout(
      shellNode,
      (x, y, width, height) => {
        setHomeLayoutTriggerRect({ x, y, width, height });
      },
      () => {}
    );
  }, []);

  const measureHomeScanTriggerAnchor = useCallback(() => {
    const shellNode = phoneShellRef.current;
    const anchorNode = homeScanTriggerRef.current;
    if (!shellNode || !anchorNode || typeof anchorNode.measureLayout !== 'function') {
      return;
    }
    anchorNode.measureLayout(
      shellNode,
      (x, y, width, height) => {
        setHomeScanTriggerRect({ x, y, width, height });
      },
      () => {}
    );
  }, []);

  const measureHistoryRangeTriggerAnchor = useCallback(() => {
    const shellNode = phoneShellRef.current;
    const anchorNode = historyRangeTriggerRef.current;
    if (!shellNode || !anchorNode || typeof anchorNode.measureLayout !== 'function') {
      return;
    }
    anchorNode.measureLayout(
      shellNode,
      (x, y, width, height) => {
        setHistoryRangeTriggerRect({ x, y, width, height });
      },
      () => {}
    );
  }, []);

  const measureSettingsLangTriggerAnchor = useCallback(() => {
    const shellNode = phoneShellRef.current;
    const anchorNode = settingsLangTriggerRef.current;
    if (!shellNode || !anchorNode || typeof anchorNode.measureLayout !== 'function') {
      return;
    }
    anchorNode.measureLayout(
      shellNode,
      (x, y, width, height) => {
        setSettingsLangTriggerRect({ x, y, width, height });
      },
      () => {}
    );
  }, []);

  const measureSecurityAutoLockTriggerAnchor = useCallback(() => {
    const shellNode = phoneShellRef.current;
    const anchorNode = securityAutoLockTriggerRef.current;
    if (!shellNode || !anchorNode || typeof anchorNode.measureLayout !== 'function') {
      return;
    }
    anchorNode.measureLayout(
      shellNode,
      (x, y, width, height) => {
        setSecurityAutoLockTriggerRect({ x, y, width, height });
      },
      () => {}
    );
  }, []);

  const measureSecurityLockMethodTriggerAnchor = useCallback(() => {
    const shellNode = phoneShellRef.current;
    const anchorNode = securityLockMethodTriggerRef.current;
    if (!shellNode || !anchorNode || typeof anchorNode.measureLayout !== 'function') {
      return;
    }
    anchorNode.measureLayout(
      shellNode,
      (x, y, width, height) => {
        setSecurityLockMethodTriggerRect({ x, y, width, height });
      },
      () => {}
    );
  }, []);

  const measureSecurityBiometricTypeTriggerAnchor = useCallback(() => {
    const shellNode = phoneShellRef.current;
    const anchorNode = securityBiometricTypeTriggerRef.current;
    if (!shellNode || !anchorNode || typeof anchorNode.measureLayout !== 'function') {
      return;
    }
    anchorNode.measureLayout(
      shellNode,
      (x, y, width, height) => {
        setSecurityBiometricTypeTriggerRect({ x, y, width, height });
      },
      () => {}
    );
  }, []);

  const measureDiscoverBriefingWeekTriggerAnchor = useCallback(() => {
    const shellNode = phoneShellRef.current;
    const anchorNode = discoverBriefingWeekTriggerRef.current;
    if (!shellNode || !anchorNode || typeof anchorNode.measureLayout !== 'function') {
      return;
    }
    anchorNode.measureLayout(
      shellNode,
      (x, y, width, height) => {
        setDiscoverBriefingWeekTriggerRect({ x, y, width, height });
      },
      () => {}
    );
  }, []);

  const measureRecentAnchor = useCallback((scope: 'asset' | 'nft') => {
    const shellNode = phoneShellRef.current;
    const anchorNode = scope === 'nft' ? nftRecentAnchorRef.current : sendRecentAnchorRef.current;
    if (!shellNode || !anchorNode || typeof anchorNode.measureLayout !== 'function') {
      return;
    }
    anchorNode.measureLayout(
      shellNode,
      (x, y, width, height) => {
        const rect = { x, y, width, height };
        if (scope === 'nft') {
          setNftRecentAnchorRect(rect);
        } else {
          setSendRecentAnchorRect(rect);
        }
      },
      () => {}
    );
  }, []);

  const measureRecipientActionAnchor = useCallback((scope: 'asset' | 'nft', action: 'scan' | 'book' | 'save') => {
    const shellNode = phoneShellRef.current;
    const anchorNode =
      scope === 'asset'
        ? action === 'scan'
          ? assetScanActionRef.current
          : action === 'book'
            ? assetBookActionRef.current
            : assetSaveActionRef.current
        : action === 'scan'
          ? nftScanActionRef.current
          : action === 'book'
            ? nftBookActionRef.current
            : nftSaveActionRef.current;

    if (!shellNode || !anchorNode || typeof anchorNode.measureLayout !== 'function') {
      return;
    }

    anchorNode.measureLayout(
      shellNode,
      (x, y, width, height) => {
        const rect = { x, y, width, height };
        if (scope === 'asset') {
          setAssetRecipientActionAnchorRectMap((prev) => ({ ...prev, [action]: rect }));
        } else {
          setNftRecipientActionAnchorRectMap((prev) => ({ ...prev, [action]: rect }));
        }
      },
      () => {}
    );
  }, []);

  const text = copy[lang];
  const extra = extraCopy[lang];
  const walletUi = walletUiCopy[lang];
  const flow = sendFlowCopy[lang];
  const nftUi = useMemo(
    () =>
      lang === 'ko'
        ? {
            sendTitle: '보내기',
            sendConfirmTitle: '확인',
            selectNft: 'NFT 선택',
            recipientPlaceholder: '받는 주소를 입력하세요',
            memoPlaceholder: '메모를 입력하세요(선택)',
            noNftOwned: '보유 중인 NFT가 없습니다.',
            sent: 'NFT 전송이 완료되었습니다.',
            receiveButton: 'NFT 받기',
            sendButton: '보내기',
            detailTitle: 'NFT 상세',
            contractAddress: '컨트랙트 주소',
            tokenId: '토큰 ID',
            owned: '보유 수량',
            floorPrice: '평가 가치'
          }
        : lang === 'zh'
          ? {
              sendTitle: '发送',
              sendConfirmTitle: '确认',
              selectNft: '选择 NFT',
              recipientPlaceholder: '请输入接收地址',
              memoPlaceholder: '请输入备注（可选）',
              noNftOwned: '暂无可发送的 NFT。',
              sent: 'NFT 发送已完成。',
              receiveButton: '接收 NFT',
              sendButton: '发送',
              detailTitle: 'NFT 详情',
              contractAddress: '合约地址',
              tokenId: '代币 ID',
              owned: '持有数量',
              floorPrice: '估值'
            }
          : {
              sendTitle: 'Send',
              sendConfirmTitle: 'Confirm',
              selectNft: 'Select NFT',
              recipientPlaceholder: 'Enter recipient address',
              memoPlaceholder: 'Enter memo (optional)',
              noNftOwned: 'No NFTs available to send.',
              sent: 'NFT transfer completed.',
              receiveButton: 'Receive NFT',
              sendButton: 'Send',
              detailTitle: 'NFT Detail',
              contractAddress: 'Contract Address',
              tokenId: 'Token ID',
              owned: 'Owned',
              floorPrice: 'Estimated Value'
            },
    [lang]
  );

  useEffect(() => {
    if (supportMessages.length > 0) return;
    setSupportMessages([
      {
        id: `support-agent-${Date.now()}`,
        role: 'agent',
        text: text.supportChatGreeting,
        createdAt: new Date().toISOString()
      }
    ]);
  }, [supportMessages.length, text.supportChatGreeting]);
  const assetText = assetDetailCopy[lang];
  const getWalletDisplayName = useCallback((wallet: WalletAccount) => resolveWalletDisplayName(wallet, lang), [lang]);
  const nextAutoWalletName = useMemo(() => buildNextAutoWalletName(walletAccounts, lang).label, [walletAccounts, lang]);
  const walletNamePlaceholder = useMemo(
    () => {
      const suggestedName = nextAutoWalletName || unnamedWalletBaseByLang[lang];
      return lang === 'ko' ? `예: ${suggestedName}` : lang === 'zh' ? `例如：${suggestedName}` : `e.g. ${suggestedName}`;
    },
    [lang, nextAutoWalletName]
  );
  const currentScreen = stack[stack.length - 1];
  const discoverDataScreens: Screen[] = [
    'discover',
    'discoverEarn',
    'discoverExploreDapps',
    'discoverWatchlist',
    'discoverSites',
    'discoverLatest',
    'discoverPopularRanking',
    'discoverBriefingBoard',
    'discoverFavorite',
    'discoverHistory',
    'discoverNoTabs',
    'discoverDappBrowser'
  ];
  const shouldLoadDiscoverData =
    discoverDataBootReady || currentScreen === 'assetDetail' || discoverDataScreens.includes(currentScreen);
  const refreshBiometricSupport = useCallback(async () => {
    if (Platform.OS === 'web') {
      setFingerprintBiometricSupported(true);
      setFaceBiometricSupported(true);
      return;
    }
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        setFingerprintBiometricSupported(false);
        setFaceBiometricSupported(false);
        return;
      }
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const irisType = (LocalAuthentication.AuthenticationType as { IRIS?: number }).IRIS;
      const supportsFingerprint = supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
      const supportsFace =
        supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) ||
        (typeof irisType === 'number' && supportedTypes.includes(irisType));
      if (Platform.OS === 'android') {
        // Android BiometricPrompt is modality-agnostic in many OEM implementations.
        // Prefer one stable option to avoid exposing non-actionable "face" entries.
        const preferFingerprint = supportsFingerprint;
        setFingerprintBiometricSupported((prev) => (prev === supportsFingerprint ? prev : supportsFingerprint));
        setFaceBiometricSupported((prev) => {
          const next = !preferFingerprint && supportsFace;
          return prev === next ? prev : next;
        });
        return;
      }
      setFingerprintBiometricSupported((prev) => (prev === supportsFingerprint ? prev : supportsFingerprint));
      setFaceBiometricSupported((prev) => (prev === supportsFace ? prev : supportsFace));
    } catch {
      setFingerprintBiometricSupported(false);
      setFaceBiometricSupported(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDiscoverDataBootReady(true), 12000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(
    () => () => {
      if (seedClipboardClearTimerRef.current) {
        clearTimeout(seedClipboardClearTimerRef.current);
        seedClipboardClearTimerRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    void refreshBiometricSupport();
  }, [refreshBiometricSupport]);

  useEffect(() => {
    if (currentScreen !== 'settingsSecurity' && !showBiometricTypeMenu) return;
    void refreshBiometricSupport();
  }, [currentScreen, showBiometricTypeMenu, refreshBiometricSupport]);

  useEffect(() => {
    if (sendAuthMethod === 'face' && !faceBiometricSupported) {
      setSendAuthMethod(fingerprintBiometricSupported ? 'fingerprint' : 'password');
      return;
    }
    if (sendAuthMethod === 'fingerprint' && !fingerprintBiometricSupported) {
      setSendAuthMethod(faceBiometricSupported ? 'face' : 'password');
    }
  }, [sendAuthMethod, faceBiometricSupported, fingerprintBiometricSupported]);

  const discoverActiveTab = useMemo(
    () => (discoverActiveTabId ? discoverOpenTabs.find((tab) => tab.id === discoverActiveTabId) ?? null : null),
    [discoverActiveTabId, discoverOpenTabs]
  );
  const discoverTrustedHostEntries = useMemo(() => {
    const seen = new Set<string>();
    const next: DiscoverTrustedHostEntry[] = [];
    const nowTs = Date.now();

    discoverTrustedHosts.forEach((entry, index) => {
      const host = normalizeDiscoverTrustedHost(entry.host);
      if (!host || seen.has(host)) return;
      const createdAt = toIsoOrNow(String(entry.createdAt ?? '').trim(), nowTs);
      const expiresAt = computeTrustedHostExpiresAt(createdAt, entry.expiresAt);
      const expiresAtTs = Date.parse(expiresAt);
      if (!Number.isFinite(expiresAtTs) || expiresAtTs <= nowTs) return;
      seen.add(host);

      const stableId = String(entry.id ?? '').trim() || `trusted-${host}-${index}`;

      next.push({
        id: stableId,
        host,
        memo: String(entry.memo ?? '').trim(),
        createdAt,
        expiresAt
      });
    });

    return next;
  }, [discoverTrustedHosts]);
  const discoverTrustedHostsNormalized = useMemo(
    () => discoverTrustedHostEntries.map((entry) => entry.host),
    [discoverTrustedHostEntries]
  );
  const discoverTrustedHostSet = useMemo(
    () => new Set(discoverTrustedHostsNormalized),
    [discoverTrustedHostsNormalized]
  );
  const discoverTrustedEditEntry = useMemo(
    () => (discoverTrustedEditId ? discoverTrustedHostEntries.find((entry) => entry.id === discoverTrustedEditId) ?? null : null),
    [discoverTrustedEditId, discoverTrustedHostEntries]
  );
  const discoverActiveHost = useMemo(() => {
    if (!discoverActiveTab) return '';
    try {
      return normalizeHost(new URL(discoverActiveTab.url).hostname);
    } catch {
      return '';
    }
  }, [discoverActiveTab]);
  const isDiscoverActiveTabFavorite = useMemo(
    () => Boolean(discoverActiveTab && discoverFavoriteTabs.some((tab) => tab.url === discoverActiveTab.url)),
    [discoverActiveTab, discoverFavoriteTabs]
  );
  const toFallbackChainAddresses = (walletAddress?: string): Record<ChainCode, string> => {
    const fallbackEvmAddress = walletAddress && /^0x[a-fA-F0-9]{40}$/.test(walletAddress) ? walletAddress : chainWalletAddresses.ETH;
    return {
      BTC: chainWalletAddresses.BTC,
      ETH: fallbackEvmAddress,
      XRP: chainWalletAddresses.XRP,
      BSC: fallbackEvmAddress,
      SOL: chainWalletAddresses.SOL,
      TRX: chainWalletAddresses.TRX,
      FIL: chainWalletAddresses.FIL
    };
  };
  const isSameChainAddressMap = (nextMap: Record<ChainCode, string>, prevMap: Record<ChainCode, string>) =>
    chainOrder.every((chain) => nextMap[chain] === prevMap[chain]);
  const [activeWalletChainAddresses, setActiveWalletChainAddresses] = useState<Record<ChainCode, string>>(chainWalletAddresses);

  useEffect(() => {
    let mounted = true;
    let interactionTask: { cancel?: () => void } | null = null;
    const selectedWallet = walletAccounts.find((wallet) => wallet.id === walletId) ?? activeWallet ?? walletAccounts[0] ?? null;

    if (!selectedWallet) {
      setActiveWalletChainAddresses((prev) => (isSameChainAddressMap(chainWalletAddresses, prev) ? prev : chainWalletAddresses));
      return () => {
        mounted = false;
        interactionTask?.cancel?.();
      };
    }

    const fallbackAddressMap = toFallbackChainAddresses(selectedWallet.address);
    setActiveWalletChainAddresses((prev) => (isSameChainAddressMap(fallbackAddressMap, prev) ? prev : fallbackAddressMap));

    interactionTask = InteractionManager.runAfterInteractions(() => {
      if (!mounted) return;
      const seedWords = walletSeedMap[selectedWallet.id];
      const passphrase = walletSeedPassphraseMap[selectedWallet.id] ?? '';
      const accountIndex = normalizeAccountIndex(walletAccountIndexMap[selectedWallet.id] ?? 0);
      if (!Array.isArray(seedWords) || !isValidRecoverySeedWords(seedWords)) return;

      try {
        const derived = deriveTrustCompatibleChainAddresses(seedWords, accountIndex, passphrase);
        const nextMap: Record<ChainCode, string> = {
          BTC: derived.BTC,
          ETH: derived.ETH,
          XRP: derived.XRP,
          BSC: derived.BSC,
          SOL: derived.SOL,
          TRX: derived.TRX,
          FIL: derived.FIL
        };
        if (!mounted) return;
        setActiveWalletChainAddresses((prev) => (isSameChainAddressMap(nextMap, prev) ? prev : nextMap));
      } catch {
        // keep fallback addresses when derivation fails
      }
    });

    return () => {
      mounted = false;
      interactionTask?.cancel?.();
    };
  }, [activeWallet, walletAccounts, walletAccountIndexMap, walletId, walletSeedMap, walletSeedPassphraseMap]);
  const deleteTargetWallet = deleteWalletId ? walletAccounts.find((wallet) => wallet.id === deleteWalletId) ?? null : null;
  const expectedDeleteSeedWords = useMemo(() => {
    if (!deleteWalletId) return null;
    const mapped = walletSeedMap[deleteWalletId];
    if (mapped && isValidRecoverySeedWords(mapped)) return mapped;
    return null;
  }, [deleteWalletId, walletSeedMap]);
  const hasDeleteSeedVerification = Array.isArray(expectedDeleteSeedWords) && expectedDeleteSeedWords.some((word) => normalizeSeedWord(word).length > 0);
  const expectedDeleteSeedWordCount = expectedDeleteSeedWords?.length ?? 0;
  const isDeleteSeedWordsComplete =
    hasDeleteSeedVerification &&
    deleteSeedWords.length === expectedDeleteSeedWordCount &&
    deleteSeedWords.every((word) => normalizeSeedWord(word).length > 0);
  const doesDeleteSeedMatch =
    isDeleteSeedWordsComplete &&
    deleteSeedWords.every((word, index) => normalizeSeedWord(word) === normalizeSeedWord(expectedDeleteSeedWords?.[index] ?? ''));

  const palette: AppPalette = useMemo(
    () =>
      themeMode === 'dark'
        ? {
            bg: '#000000',
            card: '#0f1012',
            panel: '#17191c',
            chip: '#131519',
            line: '#2a2d33',
            text: '#f5f7f8',
            muted: '#8a9299',
            accent: '#ff7842',
            accentSoft: '#cfd6e2',
            positive: '#38c172',
            negative: '#ff5b5b',
            overlay: 'rgba(0, 0, 0, 0.72)'
          }
        : {
            bg: '#f5f7f9',
            card: '#ffffff',
            panel: '#ffffff',
            chip: '#eef1f4',
            line: '#dce2e8',
            text: '#0d1317',
            muted: '#6f7a85',
            accent: '#ff7842',
            accentSoft: '#e9eef5',
            positive: '#16a34a',
            negative: '#dc2626',
            overlay: 'rgba(15, 23, 42, 0.42)'
          },
    [themeMode]
  );

  const insets = useSafeAreaInsets();
  const topSafeInset = Platform.OS === 'android' ? Math.max(insets.top, NativeStatusBar.currentHeight ?? 0, 24) : insets.top;
  const headerOverlayHeightValue = HEADER_OVERLAY_HEIGHT + topSafeInset;
  const headerContentTopPadValue = headerOverlayHeightValue + 4;
  const effectiveBottomInset = Platform.OS === 'android' ? Math.max(insets.bottom, 24) : insets.bottom;
  const supportComposerBottomPad = isKeyboardVisible ? 0 : effectiveBottomInset + 12;
  const onboardingKeyboardPad = isKeyboardVisible ? Math.max(effectiveBottomInset + 16, keyboardHeight + 20) : effectiveBottomInset + 12;
  const styles = useMemo(
    () => createStyles(palette, themeMode, insets, viewportWidth),
    [insets.bottom, insets.left, insets.right, insets.top, palette, themeMode, viewportWidth]
  );
  const headerGradientColors = useMemo<readonly [string, string, ...string[]]>(
    () =>
      themeMode === 'dark'
        ? [
            'rgba(0, 0, 0, 0.86)',
            'rgba(0, 0, 0, 0.78)',
            'rgba(0, 0, 0, 0.68)',
            'rgba(0, 0, 0, 0.57)',
            'rgba(0, 0, 0, 0.44)',
            'rgba(0, 0, 0, 0.31)',
            'rgba(0, 0, 0, 0.20)',
            'rgba(0, 0, 0, 0.10)',
            'rgba(0, 0, 0, 0.00)'
          ]
        : [
            'rgba(255, 255, 255, 0.92)',
            'rgba(255, 255, 255, 0.82)',
            'rgba(255, 255, 255, 0.71)',
            'rgba(255, 255, 255, 0.58)',
            'rgba(255, 255, 255, 0.43)',
            'rgba(255, 255, 255, 0.30)',
            'rgba(255, 255, 255, 0.19)',
            'rgba(255, 255, 255, 0.09)',
            'rgba(255, 255, 255, 0.00)'
          ],
    [themeMode]
  );
  const bottomSystemGradientColors = useMemo<readonly [string, string, ...string[]]>(
    () =>
      themeMode === 'dark'
        ? [
            'rgba(0, 0, 0, 0.76)',
            'rgba(0, 0, 0, 0.62)',
            'rgba(0, 0, 0, 0.45)',
            'rgba(0, 0, 0, 0.26)',
            'rgba(0, 0, 0, 0.10)',
            'rgba(0, 0, 0, 0.00)'
          ]
        : [
            'rgba(255, 255, 255, 0.86)',
            'rgba(255, 255, 255, 0.72)',
            'rgba(255, 255, 255, 0.53)',
            'rgba(255, 255, 255, 0.31)',
            'rgba(255, 255, 255, 0.12)',
            'rgba(255, 255, 255, 0.00)'
          ],
    [themeMode]
  );
  const renderHeaderBackdrop = () => (
    <View pointerEvents="none" style={styles.headerBackdrop}>
      <LinearGradient colors={headerGradientColors} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.headerGradientLayer} />
    </View>
  );
  const ThemedIonicons = ({ style, ...props }: React.ComponentProps<typeof Ionicons>) => (
    <Ionicons {...props} style={[styles.iconGlyphContrast, style]} />
  );
  const normalizeAuthMethodForPlatform = (method: SendAuthMethod): SendAuthMethod => method;
  const hasAppPassword = isValidAppPassword(normalizePassword(persistedSendPasswordRef.current));

  useEffect(() => {
    if (!isLockPreviewMode || !lockPreviewMode) return;
    setShowLaunchIntro(false);
    setAppLocked(true);
    setPasswordLockEnabled(true);
    setBiometric(lockPreviewMode !== 'password');
    setSendAuthMethod(normalizeAuthMethodForPlatform(lockPreviewMode));
    setAppUnlockInput('');
    setAppUnlockError('');
  }, [isLockPreviewMode, lockPreviewMode]);

  useEffect(() => {
    let isMounted = true;
    let interactionTask: { cancel?: () => void } | null = null;

    const bootstrapSecurity = async () => {
      const [
        savedPassword,
        savedAuthMethod,
        savedTrustedHostsRaw,
        savedWalletSeedMapRaw,
        savedWalletSeedPassphraseMapRaw,
        savedWalletAccountIndexMapRaw
      ] = await Promise.all([
        loadSecureValue(APP_PASSWORD_STORE_KEY),
        loadSecureValue(AUTH_METHOD_STORE_KEY),
        loadSecureValue(DISCOVER_TRUSTED_HOSTS_STORE_KEY),
        loadSecureValue(WALLET_SEED_MAP_STORE_KEY),
        loadSecureValue(WALLET_SEED_PASSPHRASE_MAP_STORE_KEY),
        loadSecureValue(WALLET_ACCOUNT_INDEX_MAP_STORE_KEY)
      ]);
      if (!isMounted) return;

      const normalizedSavedPassword = normalizePassword(savedPassword ?? '');
      if (isValidAppPassword(normalizedSavedPassword)) {
        setSendPassword(normalizedSavedPassword);
        persistedSendPasswordRef.current = normalizedSavedPassword;
        if (hasWallet) setAppLocked(true);
      }

      if (savedAuthMethod === 'password' || savedAuthMethod === 'fingerprint' || savedAuthMethod === 'face') {
        setSendAuthMethod(normalizeAuthMethodForPlatform(savedAuthMethod));
      }

      if (savedTrustedHostsRaw) {
        try {
          const parsed = JSON.parse(savedTrustedHostsRaw) as unknown;
          if (Array.isArray(parsed)) {
            const seen = new Set<string>();
            const parsedEntries: DiscoverTrustedHostEntry[] = [];
            const nowTs = Date.now();

            parsed.forEach((entry, index) => {
              if (typeof entry === 'string') {
                const host = normalizeDiscoverTrustedHost(entry);
                if (!host || seen.has(host)) return;
                const createdAt = new Date(nowTs).toISOString();
                const expiresAt = new Date(nowTs + DISCOVER_TRUSTED_HOST_TTL_MS).toISOString();
                if (Date.parse(expiresAt) <= nowTs) return;
                seen.add(host);
                parsedEntries.push({
                  id: `trusted-${host}-${index}`,
                  host,
                  memo: '',
                  createdAt,
                  expiresAt
                });
                return;
              }

              if (entry && typeof entry === 'object') {
                const host = normalizeDiscoverTrustedHost(String((entry as { host?: string }).host ?? ''));
                if (!host || seen.has(host)) return;
                const createdAt = toIsoOrNow(String((entry as { createdAt?: string }).createdAt ?? '').trim(), nowTs);
                const expiresAt = computeTrustedHostExpiresAt(createdAt, String((entry as { expiresAt?: string }).expiresAt ?? '').trim());
                const expiresAtTs = Date.parse(expiresAt);
                if (!Number.isFinite(expiresAtTs) || expiresAtTs <= nowTs) return;
                seen.add(host);

                const id = String((entry as { id?: string }).id ?? '').trim() || `trusted-${host}-${index}`;
                const memo = String((entry as { memo?: string }).memo ?? '').trim();

                parsedEntries.push({
                  id,
                  host,
                  memo,
                  createdAt,
                  expiresAt
                });
              }
            });

            setDiscoverTrustedHosts(parsedEntries);
          }
        } catch {
          // ignore malformed host list
        }
      }

      if (savedWalletSeedMapRaw) {
        try {
          const parsed = JSON.parse(savedWalletSeedMapRaw) as unknown;
          if (parsed && typeof parsed === 'object') {
            const next: Record<string, string[]> = {};
            const nextPassphrases: Record<string, string> = {};
            const nextAccountIndexes: Record<string, number> = {};
            Object.entries(parsed as Record<string, unknown>).forEach(([walletKey, value]) => {
              const seedWordsValue = Array.isArray(value)
                ? value
                : value && typeof value === 'object' && Array.isArray((value as { seedWords?: unknown }).seedWords)
                  ? ((value as { seedWords: unknown[] }).seedWords as unknown[])
                  : null;
              if (!seedWordsValue) return;
              const normalized = normalizeSeedWords(seedWordsValue.map((word) => String(word ?? '')));
              if (!isValidRecoverySeedWords(normalized)) return;
              next[walletKey] = normalized;

              if (value && typeof value === 'object' && !Array.isArray(value)) {
                const passphraseRaw = (value as { passphrase?: unknown }).passphrase;
                if (typeof passphraseRaw === 'string') {
                  nextPassphrases[walletKey] = passphraseRaw.normalize('NFKD');
                }
                const accountIndexRaw = (value as { accountIndex?: unknown }).accountIndex;
                const accountIndexCandidate =
                  typeof accountIndexRaw === 'number' ? accountIndexRaw : Number(String(accountIndexRaw ?? ''));
                if (Number.isFinite(accountIndexCandidate)) {
                  nextAccountIndexes[walletKey] = normalizeAccountIndex(accountIndexCandidate);
                }
              }
            });
            setWalletSeedMap(next);
            if (Object.keys(nextPassphrases).length) setWalletSeedPassphraseMap((prev) => ({ ...prev, ...nextPassphrases }));
            if (Object.keys(nextAccountIndexes).length) setWalletAccountIndexMap((prev) => ({ ...prev, ...nextAccountIndexes }));
          }
        } catch {
          // ignore malformed seed map payload
        }
      }

      if (savedWalletSeedPassphraseMapRaw) {
        try {
          const parsed = JSON.parse(savedWalletSeedPassphraseMapRaw) as unknown;
          if (parsed && typeof parsed === 'object') {
            const next: Record<string, string> = {};
            Object.entries(parsed as Record<string, unknown>).forEach(([walletKey, value]) => {
              if (typeof value !== 'string') return;
              next[walletKey] = value.normalize('NFKD');
            });
            setWalletSeedPassphraseMap(next);
          }
        } catch {
          // ignore malformed passphrase payload
        }
      }

      if (savedWalletAccountIndexMapRaw) {
        try {
          const parsed = JSON.parse(savedWalletAccountIndexMapRaw) as unknown;
          if (parsed && typeof parsed === 'object') {
            const next: Record<string, number> = {};
            Object.entries(parsed as Record<string, unknown>).forEach(([walletKey, value]) => {
              const parsedValue = typeof value === 'number' ? value : Number(String(value ?? ''));
              if (!Number.isFinite(parsedValue)) return;
              next[walletKey] = normalizeAccountIndex(parsedValue);
            });
            setWalletAccountIndexMap(next);
          }
        } catch {
          // ignore malformed account index payload
        }
      }

      setIsSecurityLoaded(true);
    };

    interactionTask = InteractionManager.runAfterInteractions(() => {
      void bootstrapSecurity();
    });

    return () => {
      isMounted = false;
      interactionTask?.cancel?.();
    };
  }, [hasWallet]);

  useEffect(() => {
    let mounted = true;
    let interactionTask: { cancel?: () => void } | null = null;
    const restoreWalletData = async () => {
      const [storedTxRows, storedAddressBookRows, storedNftAddressBookRows] = await Promise.all([
        loadStoredJson<unknown>(TX_HISTORY_STORE_KEY),
        loadStoredJson<unknown>(ADDRESS_BOOK_STORE_KEY),
        loadStoredJson<unknown>(NFT_ADDRESS_BOOK_STORE_KEY)
      ]);
      if (!mounted) return;

      const normalizedTxRows = normalizeStoredTransactions(storedTxRows);
      setTxs(normalizedTxRows ?? []);
      setTxStoreHydrated(true);

      const normalizedAddressBook = normalizeStoredAddressBookEntries(storedAddressBookRows);
      setAddressBook(normalizedAddressBook ?? []);
      setAddressBookStoreHydrated(true);

      const normalizedNftAddressBook = normalizeStoredAddressBookEntries(storedNftAddressBookRows);
      setNftAddressBook(normalizedNftAddressBook ?? []);
      setNftAddressBookStoreHydrated(true);
    };

    interactionTask = InteractionManager.runAfterInteractions(() => {
      void restoreWalletData();
    });
    return () => {
      mounted = false;
      interactionTask?.cancel?.();
    };
  }, []);

  useEffect(() => {
    if (!txStoreHydrated) return;
    void saveStoredJson(TX_HISTORY_STORE_KEY, txs);
  }, [txStoreHydrated, txs]);

  useEffect(() => {
    if (!addressBookStoreHydrated) return;
    void saveStoredJson(ADDRESS_BOOK_STORE_KEY, addressBook);
  }, [addressBookStoreHydrated, addressBook]);

  useEffect(() => {
    if (!nftAddressBookStoreHydrated) return;
    void saveStoredJson(NFT_ADDRESS_BOOK_STORE_KEY, nftAddressBook);
  }, [nftAddressBookStoreHydrated, nftAddressBook]);

  useEffect(() => {
    if (walletNameMigrationDoneRef.current) return;
    if (!walletStoreHydrated || !walletAccounts.length) return;
    let mutated = false;
    const usedAutoIndexes = new Set<number>();
    let autoSequence = 0;

    const reserveNextAutoIndex = () => {
      while (usedAutoIndexes.has(autoSequence)) autoSequence += 1;
      const next = autoSequence;
      usedAutoIndexes.add(next);
      autoSequence += 1;
      return next;
    };
    const claimAutoIndex = (preferred: number | null | undefined) => {
      if (Number.isFinite(preferred)) {
        const normalized = Math.max(0, Math.floor(Number(preferred)));
        if (!usedAutoIndexes.has(normalized)) {
          usedAutoIndexes.add(normalized);
          if (autoSequence <= normalized) autoSequence = normalized + 1;
          return normalized;
        }
      }
      return reserveNextAutoIndex();
    };

    const nextWallets: WalletAccount[] = walletAccounts.map((wallet): WalletAccount => {
      const normalizedMode = wallet.nameMode === 'auto' || wallet.nameMode === 'custom' ? wallet.nameMode : undefined;
      const parsedAutoIndex = parseAutoWalletNameIndex(wallet.name);

      if (normalizedMode === 'auto' && Number.isFinite(wallet.autoNameIndex)) {
        const normalizedIndex = claimAutoIndex(wallet.autoNameIndex);
        if (normalizedIndex !== wallet.autoNameIndex) {
          mutated = true;
          return { ...wallet, autoNameIndex: normalizedIndex };
        }
        return wallet;
      }

      if (normalizedMode === 'auto') {
        const inferredIndex = claimAutoIndex(parsedAutoIndex);
        mutated = true;
        return {
          ...wallet,
          autoNameIndex: inferredIndex
        };
      }

      if (normalizedMode === 'custom') return wallet;

      if (parsedAutoIndex !== null) {
        const inferredIndex = claimAutoIndex(parsedAutoIndex);
        mutated = true;
        return {
          ...wallet,
          nameMode: 'auto',
          autoNameIndex: inferredIndex
        };
      }

      if (isLegacyAutoWalletName(wallet.name)) {
        const inferredIndex = reserveNextAutoIndex();
        mutated = true;
        return {
          ...wallet,
          nameMode: 'auto',
          autoNameIndex: inferredIndex
        };
      }

      mutated = true;
      return {
        ...wallet,
        nameMode: 'custom'
      };
    });

    walletNameMigrationDoneRef.current = true;
    if (!mutated) return;
    setWalletAccounts(nextWallets);
  }, [walletAccounts, walletStoreHydrated, setWalletAccounts]);

  useEffect(() => {
    if (!isSecurityLoaded) return;
    void saveSecureValue(AUTH_METHOD_STORE_KEY, sendAuthMethod);
  }, [isSecurityLoaded, sendAuthMethod]);

  useEffect(() => {
    if (!isSecurityLoaded) return;
    void saveSecureValue(DISCOVER_TRUSTED_HOSTS_STORE_KEY, JSON.stringify(discoverTrustedHostEntries));
  }, [discoverTrustedHostEntries, isSecurityLoaded]);

  useEffect(() => {
    if (!isSecurityLoaded) return;
    void saveSecureValue(WALLET_SEED_MAP_STORE_KEY, JSON.stringify(walletSeedMap));
  }, [isSecurityLoaded, walletSeedMap]);

  useEffect(() => {
    if (!isSecurityLoaded) return;
    void saveSecureValue(WALLET_SEED_PASSPHRASE_MAP_STORE_KEY, JSON.stringify(walletSeedPassphraseMap));
  }, [isSecurityLoaded, walletSeedPassphraseMap]);

  useEffect(() => {
    if (!isSecurityLoaded) return;
    void saveSecureValue(WALLET_ACCOUNT_INDEX_MAP_STORE_KEY, JSON.stringify(walletAccountIndexMap));
  }, [isSecurityLoaded, walletAccountIndexMap]);

  useEffect(() => {
    discoverSecurityAllowHostsRef.current = new Set(discoverTrustedHostsNormalized);
  }, [discoverTrustedHostsNormalized]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (prevState === 'active' && (nextState === 'inactive' || nextState === 'background')) {
        lastBackgroundAtRef.current = Date.now();
        shouldLockOnActiveRef.current = true;
        return;
      }

      if ((prevState === 'inactive' || prevState === 'background') && nextState === 'active') {
        void refreshBiometricSupport();
        if (shouldLockOnActiveRef.current && hasWallet && hasAppPassword && passwordLockEnabled) {
          const elapsedMs = lastBackgroundAtRef.current ? Date.now() - lastBackgroundAtRef.current : 0;
          const thresholdMs =
            autoLockOption === 'IMMEDIATE'
              ? 0
              : autoLockOption === '1M'
                ? 60_000
                : autoLockOption === '5M'
                  ? 300_000
                  : autoLockOption === '1H'
                    ? 3_600_000
                    : 18_000_000;
          const shouldLock = autoLockOption === 'IMMEDIATE' || elapsedMs >= thresholdMs;
          if (shouldLock) {
            setAppLocked(true);
            setAppUnlockInput('');
            setAppUnlockError('');
            setAppUnlockUsePassword(false);
          }
        }
        if (shouldLockOnActiveRef.current) {
          lastBackgroundAtRef.current = null;
        }
        shouldLockOnActiveRef.current = false;
      }
    });

    return () => subscription.remove();
  }, [hasWallet, hasAppPassword, passwordLockEnabled, autoLockOption, refreshBiometricSupport]);

  useEffect(() => {
    if (isLockPreviewMode) return;
    if (!hasWallet) {
      setAppLocked(false);
      setAppUnlockInput('');
      setAppUnlockError('');
      setAppUnlockUsePassword(false);
    }
  }, [hasWallet, isLockPreviewMode]);

  useEffect(() => {
    if (isLockPreviewMode) return;
    if (passwordLockEnabled) return;
    setAppLocked(false);
    setAppUnlockInput('');
    setAppUnlockError('');
    setAppUnlockUsePassword(false);
  }, [passwordLockEnabled, isLockPreviewMode]);

  useEffect(() => {
    trackPerformance('app.mount', appBootStartedAtRef.current, { platform: Platform.OS });

    const errorUtils = (globalThis as unknown as { ErrorUtils?: any }).ErrorUtils;
    const originalHandler = errorUtils?.getGlobalHandler?.();
    if (!errorUtils?.setGlobalHandler) return;

    errorUtils.setGlobalHandler((error: unknown, isFatal: boolean) => {
      trackError('global.error', error, { isFatal, platform: Platform.OS });
      if (typeof originalHandler === 'function') {
        originalHandler(error, isFatal);
      }
    });

    return () => {
      if (typeof originalHandler === 'function') {
        errorUtils.setGlobalHandler(originalHandler);
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let interactionTask: { cancel?: () => void } | null = null;

    const refresh = async () => {
      const startedAt = Date.now();
      try {
        const nextPrices = await fetchMarketPriceMap(DEFAULT_MARKET_SYMBOLS);
        if (!isMounted || !nextPrices) return;
        setMarketPrices(nextPrices);
        trackPerformance('market.price.refresh', startedAt, {
          symbols: Object.keys(nextPrices).length,
          platform: Platform.OS
        });
      } catch (error) {
        if (!isMounted) return;
        trackError('market.price.refresh_failed', error, { platform: Platform.OS });
      } finally {
        if (!isMounted) return;
        timer = setTimeout(refresh, MARKET_PRICE_REFRESH_MS);
      }
    };

    interactionTask = InteractionManager.runAfterInteractions(() => {
      void refresh();
    });

    return () => {
      isMounted = false;
      interactionTask?.cancel?.();
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!shouldLoadDiscoverData) return;
    let isMounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let interactionTask: { cancel?: () => void } | null = null;

    const refresh = async () => {
      try {
        const nextInfoMap = await fetchMarketAssetInfoMap(DEFAULT_MARKET_SYMBOLS);
        if (!isMounted || !nextInfoMap) return;
        setMarketAssetInfoMap(nextInfoMap);
      } catch (error) {
        if (!isMounted) return;
        trackError('market.asset_info.refresh_failed', error, { platform: Platform.OS });
      } finally {
        if (!isMounted) return;
        timer = setTimeout(refresh, MARKET_POPULAR_REFRESH_MS);
      }
    };

    interactionTask = InteractionManager.runAfterInteractions(() => {
      void refresh();
    });

    return () => {
      isMounted = false;
      interactionTask?.cancel?.();
      if (timer) clearTimeout(timer);
    };
  }, [shouldLoadDiscoverData]);

  const discoverTokenIconRequestSymbols = useMemo(() => {
    const liveSymbols = (popularMarketTokens ?? []).map((row) => row.symbol.trim().toUpperCase()).filter(Boolean);
    return Array.from(new Set([...discoverTokenTopupSeedSymbols, ...liveSymbols])).sort();
  }, [popularMarketTokens]);

  useEffect(() => {
    if (!shouldLoadDiscoverData) return;
    if (!discoverTokenIconRequestSymbols.length) return;
    let cancelled = false;
    const controller = new AbortController();

    const refresh = async () => {
      try {
        const rows = await fetchTokenIconsBySymbols(discoverTokenIconRequestSymbols, controller.signal);
        if (cancelled || !rows?.length) return;
        setDiscoverTokenIconUrlBySymbol((prev) => {
          const next = { ...prev };
          rows.forEach((row) => {
            const symbol = String(row.symbol || '').trim().toUpperCase();
            const iconUrl = String(row.iconProxyUrl || row.iconUrl || '').trim();
            if (!symbol || !iconUrl) return;
            next[symbol] = iconUrl;
          });
          return next;
        });
      } catch (error) {
        if (cancelled) return;
        trackError('market.token_icons.refresh_failed', error, { platform: Platform.OS });
      }
    };

    void refresh();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [discoverTokenIconRequestSymbols, shouldLoadDiscoverData]);

  useEffect(() => {
    let isMounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let interactionTask: { cancel?: () => void } | null = null;

    const refresh = async () => {
      const startedAt = Date.now();
      try {
        const snapshot = await fetchFxRates();
        if (!isMounted || !snapshot) return;
        applyLiveFiatRates(snapshot.rates);
        forceFxRender((prev) => prev + 1);
        trackPerformance('market.fx.refresh', startedAt, {
          source: snapshot.source,
          platform: Platform.OS
        });
      } catch (error) {
        if (!isMounted) return;
        trackError('market.fx.refresh_failed', error, { platform: Platform.OS });
      } finally {
        if (!isMounted) return;
        timer = setTimeout(refresh, MARKET_FX_REFRESH_MS);
      }
    };

    interactionTask = InteractionManager.runAfterInteractions(() => {
      void refresh();
    });

    return () => {
      isMounted = false;
      interactionTask?.cancel?.();
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!shouldLoadDiscoverData) return;
    let isMounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const refresh = async () => {
      try {
        const nextRows = await fetchPopularTokensByVolume(50);
        if (!isMounted || !nextRows?.length) return;
        setPopularMarketTokens(nextRows);
      } catch (error) {
        if (!isMounted) return;
        trackError('market.popular.refresh_failed', error, { platform: Platform.OS });
      } finally {
        if (!isMounted) return;
        timer = setTimeout(refresh, MARKET_POPULAR_REFRESH_MS);
      }
    };

    void refresh();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [shouldLoadDiscoverData]);

  useEffect(() => {
    if (!shouldLoadDiscoverData) return;
    let isMounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const refresh = async () => {
      try {
        const [nextByCategory, nextRows] = await Promise.all([
          fetchPopularDappsByCategory(10),
          fetchPopularDappsRanking(50)
        ]);
        if (!isMounted) return;

        if (nextByCategory) {
          setPopularMarketDappsByCategory(nextByCategory);
          const mergedFromBuckets = Array.from(
            new Map(
              popularDappFilterKeys
                .flatMap((key) => nextByCategory[key] || [])
                .map((row) => [String(row.url).trim().toLowerCase() || row.id, row] as const)
            ).values()
          ).slice(0, 50);
          if (mergedFromBuckets.length) {
            setPopularMarketDapps(mergedFromBuckets);
          }
        }

        if (nextRows?.length) {
          setPopularMarketDapps(nextRows);
        }
      } catch (error) {
        if (!isMounted) return;
        trackError('market.popular_dapps.refresh_failed', error, { platform: Platform.OS });
      } finally {
        if (!isMounted) return;
        timer = setTimeout(refresh, MARKET_POPULAR_REFRESH_MS);
      }
    };

    void refresh();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [shouldLoadDiscoverData]);

  useEffect(() => {
    if (!shouldLoadDiscoverData) return;
    let isMounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const refresh = async () => {
      if (!isMounted) return;
      setDiscoverFeedLoading(true);
      try {
        const payload = await fetchDiscoverFeed(lang);
        if (!isMounted) return;
        if (payload?.items?.length) {
          setDiscoverFeed(payload);
          setDiscoverFeedError('');
        } else {
          setDiscoverFeed(null);
          setDiscoverFeedError(
            lang === 'ko'
              ? '브리핑 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
              : lang === 'zh'
                ? '无法加载简报数据，请稍后重试。'
                : 'Failed to load briefing data. Please try again shortly.'
          );
          trackError('discover.feed.empty_payload', new Error('discover feed payload empty'), { platform: Platform.OS });
        }
      } catch (error) {
        if (!isMounted) return;
        setDiscoverFeed(null);
        setDiscoverFeedError(
          lang === 'ko'
            ? '브리핑 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
            : lang === 'zh'
              ? '无法加载简报数据，请稍后重试。'
              : 'Failed to load briefing data. Please try again shortly.'
        );
        trackError('discover.feed.refresh_failed', error, { platform: Platform.OS });
      } finally {
        if (!isMounted) return;
        setDiscoverFeedLoading(false);
        timer = setTimeout(refresh, 120_000);
      }
    };

    refresh().catch(() => undefined);

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [lang, shouldLoadDiscoverData]);

  useEffect(() => {
    setDiscoverBrokenIconUris({});
  }, [discoverFeed?.fetchedAt, discoverCategory, discoverTokenCategory, discoverSiteCategory, discoverSearchInput]);

  const totalBalance = useMemo(() => tokens.reduce((sum, token) => sum + token.balance * token.priceUsd, 0), [tokens]);
  const filteredTokens = tokens;
  const favoriteTokenIdSet = useMemo(() => new Set(favoriteTokenIds), [favoriteTokenIds]);
  const discoverFavoriteDappIdSet = useMemo(() => new Set(discoverFavoriteDappIds), [discoverFavoriteDappIds]);
  const discoverFavoriteTokenSymbolSet = useMemo(
    () => new Set(discoverFavoriteTokenSymbols.map((symbol) => symbol.toUpperCase())),
    [discoverFavoriteTokenSymbols]
  );
  const discoverFavoriteSiteIdSet = useMemo(() => new Set(discoverFavoriteSiteIds), [discoverFavoriteSiteIds]);
  const homeDisplayTokens = useMemo(() => {
    const favorites = filteredTokens
      .filter((token) => favoriteTokenIdSet.has(token.id))
      .sort((a, b) => {
        const symbolDiff = a.symbol.localeCompare(b.symbol, 'en', { sensitivity: 'base' });
        if (symbolDiff !== 0) return symbolDiff;
        return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
      });
    const normal = filteredTokens.filter((token) => !favoriteTokenIdSet.has(token.id));
    return [...favorites, ...normal];
  }, [filteredTokens, favoriteTokenIdSet]);
  const ownedCollectibles = useMemo(() => collectibles.filter((item) => item.owned > 0), [collectibles]);
  const nftDetailItem = useMemo(
    () => collectibles.find((item) => item.id === nftDetailCollectibleId) ?? collectibles[0] ?? null,
    [collectibles, nftDetailCollectibleId]
  );
  const selectedNftForSend = useMemo(
    () => ownedCollectibles.find((item) => item.id === nftSendCollectibleId) ?? ownedCollectibles[0] ?? null,
    [ownedCollectibles, nftSendCollectibleId]
  );
  const layoutPreviewToken = homeDisplayTokens[0] ?? filteredTokens[0] ?? tokens[0] ?? tokenCatalog[0];
  const layoutPreviewUsd = layoutPreviewToken.balance * layoutPreviewToken.priceUsd;
  const layoutPreviewDeltaUsd = layoutPreviewUsd * (layoutPreviewToken.change24h / 100);
  const layoutPreviewUp = layoutPreviewToken.change24h >= 0;
  const layoutPreviewAmountText = formatAmount(layoutPreviewToken.balance, text.locale, 6);
  const layoutPreviewBalanceText = `${layoutPreviewAmountText} ${layoutPreviewToken.symbol}`;
  const layoutPreviewUsdText = formatCurrency(layoutPreviewUsd, text.locale);
  const layoutPreviewPriceText = formatCurrency(layoutPreviewToken.priceUsd, text.locale);

  const discoverCategories = useMemo<Record<DiscoverDappFilterId, string>>(
    () =>
      lang === 'ko'
        ? {
            all: '전체',
            defi: '디파이',
            exchanges: '거래소',
            collectibles: 'NFT 컬렉션',
            social: '소셜',
            games: '게임'
          }
        : lang === 'zh'
          ? {
              all: '全部',
              defi: 'DeFi',
              exchanges: '交易所',
              collectibles: 'NFT 收藏品',
              social: '社交',
              games: '游戏'
            }
          : {
              all: 'All',
              defi: 'DeFi',
              exchanges: 'Exchanges',
              collectibles: 'NFT Collectibles',
              social: 'Social',
              games: 'Games'
            },
    [lang]
  );
  const discoverTokenCategories = useMemo<Record<DiscoverTokenCategoryId, string>>(
    () =>
      lang === 'ko'
        ? {
            all: '전체',
            layer1: '레이어1',
            defi: '디파이',
            stablecoin: '스테이블',
            exchange: '거래소',
            meme: '밈'
          }
        : lang === 'zh'
          ? {
              all: '全部',
              layer1: '公链',
              defi: 'DeFi',
              stablecoin: '稳定币',
              exchange: '交易所',
              meme: '迷因'
            }
          : {
              all: 'All',
              layer1: 'Layer1',
              defi: 'DeFi',
              stablecoin: 'Stablecoin',
              exchange: 'Exchange',
              meme: 'Meme'
            },
    [lang]
  );
  const discoverSiteCategories = useMemo<Record<DiscoverSiteCategoryId, string>>(
    () =>
      lang === 'ko'
        ? {
            all: '전체',
            market: '마켓',
            analytics: '분석',
            news: '뉴스',
            security: '보안',
            tools: '도구',
            learn: '학습'
          }
        : lang === 'zh'
          ? {
              all: '全部',
              market: '行情',
              analytics: '分析',
              news: '新闻',
              security: '安全',
              tools: '工具',
              learn: '学习'
            }
          : {
              all: 'All',
              market: 'Market',
              analytics: 'Analytics',
              news: 'News',
              security: 'Security',
              tools: 'Tools',
              learn: 'Learn'
            },
    [lang]
  );

  const discoverItemsSource = useMemo(() => {
    const liveItems = discoverFeed?.items?.length ? discoverFeed.items : [];
    if (!liveItems.length) return [];

    const dedup = new Set<string>();
    const dedupedLive: DiscoverFeedItem[] = [];
    liveItems.forEach((item) => {
      const key = resolveDiscoverExternalUrl(item).toLowerCase() || String(item.id || '').trim().toLowerCase();
      if (!key || dedup.has(key)) return;
      dedup.add(key);
      dedupedLive.push(item);
    });
    return dedupedLive;
  }, [discoverFeed]);
  const sortDiscoverItems = (a: DiscoverFeedItem, b: DiscoverFeedItem) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.priority !== b.priority) return b.priority - a.priority;
    return new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime();
  };

  const discoverFilteredItems = useMemo(() => {
    const normalizedQuery = discoverSearchInput.trim().toLowerCase();
    return discoverItemsSource
      .filter((item) => {
        if (!normalizedQuery) return true;
        const haystack = [item.title, item.summary, item.sourceName, ...(item.tags || [])].join(' ').toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .sort(sortDiscoverItems);
  }, [discoverItemsSource, discoverSearchInput]);

  const discoverSectionItems = useMemo<Record<DiscoverSectionId, DiscoverFeedItem[]>>(() => {
    const normalizedQuery = discoverSearchInput.trim().toLowerCase();
    const sectionMap: Record<DiscoverSectionId, DiscoverFeedItem[]> = {
      feature: [],
      earn: [],
      dapps: [],
      watchlist: [],
      sites: [],
      latest: []
    };

    discoverItemsSource
      .filter((item) => {
        if (!normalizedQuery) return true;
        const haystack = [item.title, item.summary, item.sourceName, ...(item.tags || [])].join(' ').toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .sort(sortDiscoverItems)
      .forEach((item) => {
        sectionMap[item.section].push(item);
      });

    return sectionMap;
  }, [discoverItemsSource, discoverSearchInput]);

  const discoverHeroItems = useMemo(() => discoverFilteredItems.filter((item) => item.pinned).slice(0, 4), [discoverFilteredItems]);
  const discoverListItems = useMemo(
    () => discoverFilteredItems.filter((item) => !discoverHeroItems.some((hero) => hero.id === item.id)).slice(0, 30),
    [discoverFilteredItems, discoverHeroItems]
  );

  const discoverBlendText = useMemo(
    () =>
          lang === 'ko'
        ? {
            searchPlaceholder: '토큰, 사이트 및 URL 검색',
            quickEarn: '수익',
            quickExploreDapps: 'DApps',
            quickTokens: '인기 토큰',
            quickWatch: '즐겨찾기',
            quickSites: '사이트',
            earn: '수익',
            portfolio: '내 수익 포트폴리오',
            exploreDapps: 'DApps',
            popularTokens: '인기 토큰',
            watchlist: '즐겨찾기',
            sites: '사이트',
            latestUpdates: 'Latest',
            viewAll: '전체 보기',
            open: '열기'
          }
        : lang === 'zh'
          ? {
              searchPlaceholder: '搜索代币、站点或 URL',
              quickEarn: '收益',
              quickExploreDapps: 'DApps',
              quickTokens: '热门代币',
              quickWatch: '收藏',
              quickSites: '站点',
              earn: '收益',
              portfolio: '我的收益组合',
              exploreDapps: 'DApps',
              popularTokens: '热门代币',
              watchlist: '收藏',
              sites: '站点',
              latestUpdates: 'Latest',
              viewAll: '查看全部',
              open: '打开'
            }
          : {
              searchPlaceholder: 'Search token, site or URL',
              quickEarn: 'Earn',
              quickExploreDapps: 'DApps',
              quickTokens: 'Popular',
              quickWatch: 'Favorites',
              quickSites: 'Sites',
              earn: 'Earn',
              portfolio: 'My earn portfolio',
              exploreDapps: 'DApps',
              popularTokens: 'Popular tokens',
              watchlist: 'Favorites',
              sites: 'Sites',
              latestUpdates: 'Latest',
              viewAll: 'View all',
              open: 'Open'
            },
    [lang]
  );
  const discoverCapShortLabel = lang === 'ko' ? '시총' : lang === 'zh' ? '市值' : 'cap';
  const discoverVolShortLabel = lang === 'ko' ? '거래량' : lang === 'zh' ? '交易量' : 'vol';

  const discoverDappItems = useMemo(() => {
    const dedupKey = (item: DiscoverFeedItem) => String(item.ctaUrl || item.sourceUrl || item.id).trim().toLowerCase();

    const buildLiveFeedRows = (rows: PopularDappItem[]) =>
      rows.reduce<DiscoverFeedItem[]>((acc, row) => {
        const url = String(row.url || '').trim();
        if (!isHttpUrl(url)) return acc;
        const summary = String(row.summary || '').trim();
        const category = mapPopularDappCategoryToDiscoverCategory(String(row.category || ''), row.name, summary);
        const filterCategory = mapPopularDappCategoryToDiscoverFilter(String(row.category || ''), row.name, summary);
        const tags = Array.from(
          new Set(
            [
              String(row.category || '').trim().toLowerCase(),
              filterCategory,
              ...(Array.isArray(row.chains) ? row.chains.map((chain) => String(chain || '').trim().toLowerCase()) : []),
              'live-ranking'
            ].filter(Boolean)
          )
        );

        acc.push({
          id: `live-dapp-${String(row.id || row.name).trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-')}`,
          kind: 'auto' as const,
          category,
          section: 'dapps' as const,
          pinned: false,
          priority: Math.max(1, 1000 - Math.max(1, Number(row.rank) || 1)),
          title: row.name,
          summary,
          sourceName: String(row.category || '').trim() || 'DeFiLlama',
          sourceUrl: url,
          imageUrl: String(row.logoUrl || '').trim(),
          ctaLabel: text.continue,
          ctaUrl: url,
          actionType: 'external' as const,
          internalTarget: '',
          tags,
          publishedAt: new Date().toISOString()
        } satisfies DiscoverFeedItem);
        return acc;
      }, []);

    const topupToRequiredCount = (rows: DiscoverFeedItem[], _filter: DiscoverDappFilterId) => {
      const deduped: DiscoverFeedItem[] = [];
      const seen = new Set<string>();

      rows.forEach((item) => {
        if (deduped.length >= MAX_DISCOVER_DAPP_ITEMS_PER_CATEGORY) return;
        const key = dedupKey(item);
        if (!key || seen.has(key)) return;
        deduped.push(item);
        seen.add(key);
      });

      return deduped.slice(0, MAX_DISCOVER_DAPP_ITEMS_PER_CATEGORY);
    };

    if (popularMarketDappsByCategory) {
      const bucketRows = popularMarketDappsByCategory[discoverCategory] || [];
      const liveRows = buildLiveFeedRows(bucketRows);
      return topupToRequiredCount(liveRows, discoverCategory);
    }

    if (popularMarketDapps?.length) {
      const liveRows = buildLiveFeedRows(popularMarketDapps.slice(0, 50));
      const filteredLiveRows = liveRows.filter((item) =>
        discoverCategory === 'all' ? true : resolveDiscoverDappFilter(item) === discoverCategory
      );
      return topupToRequiredCount(filteredLiveRows, discoverCategory);
    }

    const sourceCandidates = (discoverSectionItems.dapps.length
      ? discoverSectionItems.dapps
      : discoverFilteredItems.filter((item) => item.section === 'dapps'))
      .filter((item) => !(Array.isArray(item.tags) && item.tags.some((tag) => tag.toLowerCase() === 'trending')));

    const matchesFilter = (item: DiscoverFeedItem) =>
      discoverCategory === 'all' ? true : resolveDiscoverDappFilter(item) === discoverCategory;

    const rows = sourceCandidates.filter(matchesFilter).sort(sortDiscoverItems);
    return topupToRequiredCount(rows, discoverCategory);
  }, [
    discoverCategory,
    discoverFilteredItems,
    discoverSectionItems,
    popularMarketDapps,
    popularMarketDappsByCategory,
    sortDiscoverItems,
    text.continue
  ]);
  const discoverPopularTokenPool = useMemo(() => {
    type DiscoverPopularSourceRow = {
      id: string;
      symbol: string;
      name: string;
      iconUrl?: string;
      priceUsd: number;
      change24h: number;
      marketCapUsd: number;
      volume24hUsd: number;
    };

    const sourceRows: DiscoverPopularSourceRow[] = (popularMarketTokens?.length
      ? popularMarketTokens
      : []
    ).slice(0, 50).map((row) => ({
      id: row.id,
      symbol: row.symbol,
      name: row.name,
      iconUrl:
        discoverCachedTokenIconUrlBySymbol[row.symbol.toUpperCase()] ??
        row.iconProxyUrl ??
        row.iconUrl ??
        discoverTokenIconUrlBySymbol[row.symbol.toUpperCase()],
      priceUsd: row.priceUsd,
      change24h: row.change24h,
      marketCapUsd: row.marketCapUsd,
      volume24hUsd: row.volume24hUsd
    }));

    return sourceRows
      .slice(0, 50)
      .map((row) => {
        const symbol = row.symbol.toUpperCase();
        const pricePoint = marketPrices[symbol as keyof MarketPriceMap];
        return {
          ...row,
          symbol,
          priceUsd: pricePoint?.priceUsd ?? row.priceUsd,
          change24h: pricePoint?.change24h ?? row.change24h
        };
      })
      .sort((a, b) => b.marketCapUsd - a.marketCapUsd);
  }, [discoverCachedTokenIconUrlBySymbol, discoverTokenIconUrlBySymbol, marketPrices, popularMarketTokens]);
  const discoverPopularTokenFilteredRows = useMemo(() => {
    const normalizedQuery = currentScreen === 'discover' ? discoverSearchInput.trim().toLowerCase() : '';
    const liveFilteredRows = discoverPopularTokenPool.filter((row) => {
      const tokenCategory = resolveDiscoverTokenCategory(row.symbol, row.name);
      const categoryMatch = discoverTokenCategory === 'all' ? true : tokenCategory === discoverTokenCategory;
      if (!categoryMatch) return false;
      if (!normalizedQuery) return true;
      const haystack = [row.name, row.symbol].join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    });
    return liveFilteredRows;
  }, [
    currentScreen,
    discoverPopularTokenPool,
    discoverSearchInput,
    discoverTokenCategory,
    marketPrices
  ]);
  const discoverPopularTokenRows = useMemo(() => discoverPopularTokenFilteredRows.slice(0, 3), [discoverPopularTokenFilteredRows]);
  const discoverPopularTopRows = useMemo(() => discoverPopularTokenFilteredRows.slice(0, 10), [discoverPopularTokenFilteredRows]);
  const weeklyBriefingPosts = useMemo<WeeklyBriefingPost[]>(
    () =>
      weeklyBriefingSeed
        .map((item) => ({
          id: item.id,
          publishedAt: item.publishedAt,
          title: item.title[lang],
          summary: item.summary[lang],
          sources: (item.sources ?? []).map((source) => ({
            label: source.label[lang],
            url: source.url
          })),
          points: item.points[lang]
        }))
        .sort((a, b) => parseLocalDate(b.publishedAt).getTime() - parseLocalDate(a.publishedAt).getTime()),
    [lang]
  );

  const discoverPinnedPrimary = useMemo<DiscoverFeedItem | null>(() => {
    const liveItems = discoverFeed?.items?.length ? discoverFeed.items : [];
    const briefingFirst = liveItems.find((item) => isWeeklyBriefingItem(item));
    if (briefingFirst) return briefingFirst;

    const latestWeeklyPost = weeklyBriefingPosts[0];
    if (!latestWeeklyPost) return null;

    return {
      id: 'imwallet-weekly-briefing',
      kind: 'manual',
      category: 'featured',
      section: 'feature',
      pinned: true,
      priority: 1000,
      title: lang === 'ko' ? 'IMWallet 주간 브리핑' : lang === 'zh' ? 'IMWallet 每周简报' : 'IMWallet Weekly Briefing',
      summary: latestWeeklyPost.summary,
      sourceName: 'IMWallet Research',
      sourceUrl: '',
      imageUrl: '',
      ctaLabel: lang === 'ko' ? '브리핑 열기' : lang === 'zh' ? '打开简报' : 'Open Briefing',
      ctaUrl: '',
      actionType: 'internal',
      internalTarget: 'discover:briefing',
      tags: ['imwallet', 'weekly', 'briefing'],
      publishedAt: latestWeeklyPost.publishedAt
    };
  }, [discoverFeed, lang, weeklyBriefingPosts]);

  const weeklyBriefingWeekGroups = useMemo<WeeklyBriefingWeekGroup[]>(() => {
    const grouped = new Map<string, WeeklyBriefingPost[]>();
    weeklyBriefingPosts.forEach((post) => {
      const weekKey = getBriefingWeekStartKey(post.publishedAt);
      const bucket = grouped.get(weekKey) ?? [];
      bucket.push(post);
      grouped.set(weekKey, bucket);
    });

    return Array.from(grouped.entries())
      .sort((a, b) => parseLocalDate(b[0]).getTime() - parseLocalDate(a[0]).getTime())
      .map(([weekKey, posts]) => {
        const sortedPosts = [...posts].sort((a, b) => parseLocalDate(b.publishedAt).getTime() - parseLocalDate(a.publishedAt).getTime());
        const referenceDate = sortedPosts[0]?.publishedAt ?? weekKey;
        return {
          weekKey,
          referenceDate,
          label: formatBriefingWeekLabel(referenceDate, lang, text.locale),
          posts: sortedPosts
        };
      });
  }, [lang, text.locale, weeklyBriefingPosts]);

  const activeBriefingWeekGroup = useMemo(() => {
    if (weeklyBriefingWeekGroups.length === 0) return null;
    if (!discoverBriefingWeekKey) return weeklyBriefingWeekGroups[0];
    return weeklyBriefingWeekGroups.find((group) => group.weekKey === discoverBriefingWeekKey) ?? weeklyBriefingWeekGroups[0];
  }, [discoverBriefingWeekKey, weeklyBriefingWeekGroups]);

  const discoverWatchRows = useMemo(() => {
    const dappFavoriteLabel = lang === 'ko' ? '즐겨찾기 DApp' : lang === 'zh' ? '收藏 DApp' : 'Favorite DApp';
    const dappFavoriteBadge = lang === 'ko' ? 'DApp★' : lang === 'zh' ? 'DApp★' : 'DApp★';
    const tokenFavoriteLabel = lang === 'ko' ? '즐겨찾기 토큰' : lang === 'zh' ? '收藏代币' : 'Favorite token';
    const tokenFavoriteBadge = lang === 'ko' ? '토큰★' : lang === 'zh' ? '代币★' : 'Token★';
    const siteFavoriteLabel = lang === 'ko' ? '즐겨찾기 사이트' : lang === 'zh' ? '收藏站点' : 'Favorite site';
    const siteFavoriteBadge = lang === 'ko' ? '사이트★' : lang === 'zh' ? '站点★' : 'Site★';
    const dappMetricsHint =
      lang === 'ko'
        ? '활성지갑 / 활성사용자'
        : lang === 'zh'
          ? '活跃钱包 / 活跃用户'
          : 'UAW / DAU';
    const marketCapBySymbol = new Map(discoverPopularTokenPool.map((row) => [row.symbol.toUpperCase(), row.marketCapUsd]));

    const dappFavoriteRowsByFeedId = discoverFavoriteDappIds.reduce<DiscoverWatchItem[]>((acc, itemId, index) => {
        const sourceItem = discoverItemsSource.find((item) => item.id === itemId);
        if (!sourceItem) return acc;
        const dappCacheKey = getDiscoverDappIconCacheKey(sourceItem);
        const preferredIconUrl = discoverCachedDappIconUrlByKey[dappCacheKey];
        const fixedSource = resolveDiscoverDappIconSource(sourceItem);
        const fixedUri =
          fixedSource && typeof fixedSource === 'object' && 'uri' in fixedSource ? String(fixedSource.uri || '').trim() : '';
        const dappIconResolved = fixedSource && !(fixedUri && isUriRecentlyBroken(fixedUri))
          ? { source: fixedSource, activeUri: fixedUri }
          : resolveIconFromUriCandidates(buildDiscoverDappIconCandidates(sourceItem, preferredIconUrl));
        const iconSource = dappIconResolved.source;
        const iconUri = dappIconResolved.activeUri;
        const normalizedUrl = String(sourceItem.ctaUrl || sourceItem.sourceUrl || '').trim();
        const domain = getDomainFromUrl(normalizedUrl) || normalizedUrl.replace(/^https?:\/\//i, '').split('/')[0];
        const compactSymbolFromTitle = sourceItem.title.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase();
        const compactSymbolFromDomain = (domain || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase();
        const metrics = buildDappWatchMetrics(normalizedUrl || sourceItem.id);
        acc.push({
          id: `watch-dapp-feed-${sourceItem.id}`,
          symbol: compactSymbolFromTitle || compactSymbolFromDomain || `D${index + 1}`,
          name: {
            ko: sourceItem.title,
            en: sourceItem.title,
            zh: sourceItem.title
          },
          capLabel: domain || '--',
          volumeLabel: dappFavoriteLabel,
          priceUsd: null,
          marketCapUsd: null,
          leverage: dappFavoriteBadge,
          kind: 'dapp',
          iconSource,
          iconUri,
          rightPrimary: `${formatCompactCount(metrics.uaw, text.locale)} / ${formatCompactCount(metrics.dau, text.locale)}`,
          rightPrimaryHint: dappMetricsHint,
          rightSecondary: `${discoverVolShortLabel} ${formatCompactCurrency(metrics.volume24hUsd, text.locale)}`
        } satisfies DiscoverWatchItem);
        return acc;
      }, []);

    const dappFavoriteRowsByTab: DiscoverWatchItem[] = discoverFavoriteTabs.map((tab, index) => {
      const sourceItem =
        discoverItemsSource.find((item) => item.id === tab.sourceItemId) ??
        discoverItemsSource.find((item) => {
          const itemUrl = String(item.ctaUrl || item.sourceUrl || '').trim();
          return itemUrl && itemUrl === tab.url;
        });
      const iconItem = sourceItem ?? { title: tab.title, imageUrl: '', sourceUrl: tab.url };
      const dappCacheKey = getDiscoverDappIconCacheKey({
        id: sourceItem?.id || tab.id,
        title: iconItem.title,
        sourceUrl: sourceItem?.sourceUrl || tab.url,
        ctaUrl: sourceItem?.ctaUrl
      });
      const preferredIconUrl = discoverCachedDappIconUrlByKey[dappCacheKey];
      const fixedSource = resolveDiscoverDappIconSource(iconItem);
      const fixedUri =
        fixedSource && typeof fixedSource === 'object' && 'uri' in fixedSource ? String(fixedSource.uri || '').trim() : '';
      const dappIconResolved = fixedSource && !(fixedUri && isUriRecentlyBroken(fixedUri))
        ? { source: fixedSource, activeUri: fixedUri }
        : resolveIconFromUriCandidates(buildDiscoverDappIconCandidates(iconItem, preferredIconUrl));
      const iconSource = dappIconResolved.source;
      const iconUri = dappIconResolved.activeUri;
      const domain = getDomainFromUrl(tab.url) || tab.url.replace(/^https?:\/\//i, '').split('/')[0];
      const compactSymbolFromTitle = tab.title.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase();
      const compactSymbolFromDomain = (domain || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase();
      const metrics = buildDappWatchMetrics(tab.url || tab.id);
      return {
        id: `watch-dapp-${tab.id}`,
        symbol: compactSymbolFromTitle || compactSymbolFromDomain || `D${index + 1}`,
        name: {
          ko: tab.title,
          en: tab.title,
          zh: tab.title
        },
        capLabel: domain || '--',
        volumeLabel: dappFavoriteLabel,
        priceUsd: null,
        marketCapUsd: null,
        leverage: dappFavoriteBadge,
        kind: 'dapp',
        iconSource,
        iconUri,
        rightPrimary: `${formatCompactCount(metrics.uaw, text.locale)} / ${formatCompactCount(metrics.dau, text.locale)}`,
        rightPrimaryHint: dappMetricsHint,
        rightSecondary: `${discoverVolShortLabel} ${formatCompactCurrency(metrics.volume24hUsd, text.locale)}`
      };
    });

    const tokenFavoritesRows = discoverFavoriteTokenSymbols.reduce<DiscoverWatchItem[]>((acc, symbolRaw) => {
        const symbol = symbolRaw.trim().toUpperCase();
        const marketRow = discoverPopularTokenPool.find((row) => row.symbol.toUpperCase() === symbol);
        if (!marketRow) return acc;
        const { source: iconSource, activeUri: iconUri } = resolveDiscoverPopularIconWithFallback(marketRow.symbol, marketRow.iconUrl);
        acc.push({
          id: `watch-token-${marketRow.symbol.toLowerCase()}`,
          symbol: marketRow.symbol.toUpperCase(),
          name: {
            ko: marketRow.name,
            en: marketRow.name,
            zh: marketRow.name
          },
          capLabel: `${discoverCapShortLabel} ${formatCompactCurrency(marketRow.marketCapUsd, text.locale)}`,
          volumeLabel: tokenFavoriteLabel,
          priceUsd: marketRow.priceUsd,
          marketCapUsd: marketCapBySymbol.get(marketRow.symbol.toUpperCase()) ?? marketRow.marketCapUsd ?? null,
          leverage: tokenFavoriteBadge,
          kind: 'asset',
          iconSource,
          iconUri,
          rightSecondary: `${discoverVolShortLabel} ${formatCompactCurrency(marketRow.volume24hUsd ?? marketRow.marketCapUsd * 0.03, text.locale)}`
        } satisfies DiscoverWatchItem);
        return acc;
      }, []);

    const siteFavoritesRows = discoverFavoriteSiteIds.reduce<DiscoverWatchItem[]>((acc, siteId) => {
        const site = discoverSiteSeed.find((entry) => entry.id === siteId);
        if (!site) return acc;
        const siteCacheKey = getDiscoverSiteIconCacheKey(site);
        const preferredIconUrl = discoverCachedSiteIconUrlByKey[siteCacheKey];
        const iconCandidates = buildDiscoverSiteIconCandidates(site.domain, preferredIconUrl);
        const iconUri = iconCandidates.find((uri) => !isUriRecentlyBroken(uri)) ?? '';
        const iconSource = iconUri ? ({ uri: iconUri } as ImageSourcePropType) : undefined;
        acc.push({
          id: `watch-site-${site.id}`,
          symbol: site.name.slice(0, 4).toUpperCase(),
          name: {
            ko: site.name,
            en: site.name,
            zh: site.name
          },
          capLabel: site.domain,
          volumeLabel: siteFavoriteLabel,
          priceUsd: null,
          marketCapUsd: null,
          leverage: siteFavoriteBadge,
          kind: 'dapp',
          iconSource,
          iconUri,
          rightPrimary: '--',
          rightSecondary: site.domain
        } satisfies DiscoverWatchItem);
        return acc;
      }, []);

    const mergedRows = [...dappFavoriteRowsByFeedId, ...dappFavoriteRowsByTab, ...tokenFavoritesRows, ...siteFavoritesRows];
    const dedup = new Set<string>();
    return mergedRows.filter((row) => {
      if (dedup.has(row.id)) return false;
      dedup.add(row.id);
      return true;
    });
  }, [
    discoverFavoriteDappIds,
    discoverFavoriteSiteIds,
    discoverFavoriteTabs,
    discoverFavoriteTokenSymbols,
    discoverCachedDappIconUrlByKey,
    discoverCachedSiteIconUrlByKey,
    discoverItemsSource,
    discoverPopularTokenPool,
    discoverBrokenIconUris,
    lang,
    text.locale
  ]);

  const discoverSiteRows = useMemo(() => {
    const normalizedQuery = currentScreen === 'discover' ? discoverSearchInput.trim().toLowerCase() : '';
    return discoverSiteSeed.filter((entry) => {
      const categoryMatch = discoverSiteCategory === 'all' ? true : entry.category === discoverSiteCategory;
      if (!categoryMatch) return false;
      if (!normalizedQuery) return true;
      const haystack = [entry.name, entry.summary, entry.domain, entry.category].join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [currentScreen, discoverSearchInput, discoverSiteCategory]);

  const discoverLatestItems = useMemo(() => {
    const sectionLatest = discoverSectionItems.latest;
    return sectionLatest.length ? sectionLatest : discoverFilteredItems;
  }, [discoverSectionItems, discoverFilteredItems]);
  const discoverWatchPreviewRows = useMemo(() => discoverWatchRows.slice(0, 3), [discoverWatchRows]);
  const discoverWatchlistTotalPages = Math.max(1, Math.ceil(discoverWatchRows.length / 10));
  const discoverWatchlistCurrentPage = Math.min(discoverWatchlistPage, discoverWatchlistTotalPages);
  const discoverWatchlistPagedRows = useMemo(() => {
    const startIndex = (discoverWatchlistCurrentPage - 1) * 10;
    return discoverWatchRows.slice(startIndex, startIndex + 10);
  }, [discoverWatchRows, discoverWatchlistCurrentPage]);
  const discoverSitePreviewRows = useMemo(() => discoverSiteRows.slice(0, 3), [discoverSiteRows]);
  const discoverSiteTopRows = useMemo(() => discoverSiteRows.slice(0, 10), [discoverSiteRows]);
  const discoverLatestPreviewItems = useMemo(() => discoverLatestItems.slice(0, 3), [discoverLatestItems]);

  const discoverIconCacheSyncPayload = useMemo<DiscoverIconCacheSyncPayload>(() => {
    const tokenRowsSource = (popularMarketTokens?.length ? popularMarketTokens.slice(0, 50) : discoverPopularTokenPool.slice(0, 50)) as Array<{
      id?: string;
      symbol: string;
      iconId?: number;
      iconUrl?: string;
      iconProxyUrl?: string;
    }>;

    const tokens = tokenRowsSource
      .map((row) => {
        const symbol = String(row.symbol || '')
          .trim()
          .toUpperCase();
        if (!symbol) return null;
        const iconIdRaw = Number.isFinite(Number(row.iconId)) ? Number(row.iconId) : Number(row.id);
        const iconId = Number.isFinite(iconIdRaw) && iconIdRaw > 0 ? Math.floor(iconIdRaw) : undefined;
        const iconUrl = String(row.iconUrl || '').trim() || undefined;
        const iconProxyUrl = String(row.iconProxyUrl || '').trim() || undefined;
        const preferredIconUrl = discoverCachedTokenIconUrlBySymbol[symbol];
        const candidates = buildDiscoverPopularIconCandidates(symbol, iconUrl, preferredIconUrl).slice(0, 6);
        return {
          symbol,
          iconId,
          iconUrl,
          iconProxyUrl,
          candidates
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .slice(0, 50);

    const liveDappItems = discoverItemsSource
      .filter((item) => item.section === 'dapps' || item.section === 'feature')
      .filter((item) => !isWeeklyBriefingItem(item))
      .filter((item) => Boolean(resolveDiscoverExternalUrl(item)));
    const dappItemsSource = [...liveDappItems];
    const dappByKey = new Map<
      string,
      {
        key: string;
        title: string;
        url: string;
        imageUrl: string;
        candidates: string[];
      }
    >();

    (popularMarketDapps ?? []).slice(0, 50).forEach((row) => {
      if (dappByKey.size >= 50) return;
      const url = String(row.url || '').trim();
      if (!isHttpUrl(url)) return;
      const key = toDiscoverIconCacheKey(getDiscoverIconHostFromUrl(url) || row.id || row.name);
      if (!key || dappByKey.has(key)) return;
      const preferredIconUrl = discoverCachedDappIconUrlByKey[key];
      dappByKey.set(key, {
        key,
        title: row.name,
        url,
        imageUrl: String(row.logoUrl || '').trim(),
        candidates: buildDiscoverDappIconCandidates(
          {
            title: row.name,
            imageUrl: String(row.logoUrl || '').trim(),
            sourceUrl: url,
            ctaUrl: url
          },
          preferredIconUrl
        ).slice(0, 6)
      });
    });

    dappItemsSource.forEach((item) => {
      if (dappByKey.size >= 50) return;
      const url = resolveDiscoverExternalUrl(item);
      if (!url) return;
      const key = getDiscoverDappIconCacheKey(item);
      if (!key || dappByKey.has(key)) return;
      const preferredIconUrl = discoverCachedDappIconUrlByKey[key];
      dappByKey.set(key, {
        key,
        title: item.title,
        url,
        imageUrl: item.imageUrl,
        candidates: buildDiscoverDappIconCandidates(item, preferredIconUrl).slice(0, 6)
      });
    });
    const dapps = Array.from(dappByKey.values()).slice(0, 50);

    const siteByKey = new Map<
      string,
      {
        key: string;
        domain: string;
        url: string;
        candidates: string[];
      }
    >();
    discoverSiteSeed.forEach((site) => {
      if (siteByKey.size >= 50) return;
      const key = getDiscoverSiteIconCacheKey(site);
      if (!key || siteByKey.has(key)) return;
      const preferredIconUrl = discoverCachedSiteIconUrlByKey[key];
      siteByKey.set(key, {
        key,
        domain: site.domain,
        url: site.url,
        candidates: buildDiscoverSiteIconCandidates(site.domain, preferredIconUrl).slice(0, 6)
      });
    });
    const siteFeedItems = [...discoverItemsSource]
      .filter((item) => item.section === 'sites')
      .filter((item) => !isWeeklyBriefingItem(item));
    siteFeedItems.forEach((item) => {
      if (siteByKey.size >= 50) return;
      const url = resolveDiscoverExternalUrl(item);
      const domain = getDiscoverIconHostFromUrl(url);
      if (!domain) return;
      const key = toDiscoverIconCacheKey(domain);
      if (!key || siteByKey.has(key)) return;
      const preferredIconUrl = discoverCachedSiteIconUrlByKey[key];
      siteByKey.set(key, {
        key,
        domain,
        url,
        candidates: buildDiscoverSiteIconCandidates(domain, preferredIconUrl).slice(0, 6)
      });
    });
    const sites = Array.from(siteByKey.values()).slice(0, 50);

    return { tokens, dapps, sites };
  }, [
    discoverCachedDappIconUrlByKey,
    discoverCachedSiteIconUrlByKey,
    discoverCachedTokenIconUrlBySymbol,
    discoverItemsSource,
    popularMarketDapps,
    discoverPopularTokenPool,
    popularMarketTokens
  ]);

  useEffect(() => {
    if (!shouldLoadDiscoverData) return;
    const payload = discoverIconCacheSyncPayload;
    const requestedCount =
      (payload.tokens?.length ?? 0) +
      (payload.dapps?.length ?? 0) +
      (payload.sites?.length ?? 0);
    if (requestedCount <= 0) return;

    const signature = JSON.stringify(payload);
    if (!signature || discoverIconCacheSyncSignatureRef.current === signature) return;
    discoverIconCacheSyncSignatureRef.current = signature;

    let cancelled = false;
    const syncCachedIcons = async () => {
      try {
        const snapshot = await syncDiscoverIconCacheRemote(payload, { limit: 50 });
        if (cancelled || !snapshot) return;

        const tokenNext: Record<string, string> = {};
        Object.entries(snapshot.tokens || {}).forEach(([symbolRaw, urlRaw]) => {
          const symbol = String(symbolRaw || '')
            .trim()
            .toUpperCase();
          const url = String(urlRaw || '').trim();
          if (!symbol || !isHttpUrl(url)) return;
          tokenNext[symbol] = url;
        });
        if (Object.keys(tokenNext).length) {
          setDiscoverCachedTokenIconUrlBySymbol((prev) => ({ ...prev, ...tokenNext }));
        }

        const dappNext: Record<string, string> = {};
        Object.entries(snapshot.dapps || {}).forEach(([keyRaw, urlRaw]) => {
          const key = toDiscoverIconCacheKey(keyRaw);
          const url = String(urlRaw || '').trim();
          if (!key || !isHttpUrl(url)) return;
          dappNext[key] = url;
        });
        if (Object.keys(dappNext).length) {
          setDiscoverCachedDappIconUrlByKey((prev) => ({ ...prev, ...dappNext }));
        }

        const siteNext: Record<string, string> = {};
        Object.entries(snapshot.sites || {}).forEach(([keyRaw, urlRaw]) => {
          const key = toDiscoverIconCacheKey(keyRaw);
          const url = String(urlRaw || '').trim();
          if (!key || !isHttpUrl(url)) return;
          siteNext[key] = url;
        });
        if (Object.keys(siteNext).length) {
          setDiscoverCachedSiteIconUrlByKey((prev) => ({ ...prev, ...siteNext }));
        }
      } catch (error) {
        if (cancelled) return;
        discoverIconCacheSyncSignatureRef.current = '';
        trackError('discover.icon_cache.sync_failed', error, { platform: Platform.OS });
      }
    };

    void syncCachedIcons();

    return () => {
      cancelled = true;
    };
  }, [discoverIconCacheSyncPayload, shouldLoadDiscoverData]);

  const discoverQuickChips = useMemo(
    () => [
      {
        key: 'quick-earn' as const,
        section: 'earn' as const,
        icon: 'sparkles-outline' as const,
        label: discoverBlendText.quickEarn
      },
      {
        key: 'quick-dapps' as const,
        section: 'exploreDapps' as const,
        icon: 'apps-outline' as const,
        label: discoverBlendText.quickExploreDapps
      },
      {
        key: 'quick-token' as const,
        section: 'popularTokens' as const,
        icon: 'flame-outline' as const,
        label: discoverBlendText.quickTokens
      },
      {
        key: 'quick-sites' as const,
        section: 'sites' as const,
        icon: 'globe-outline' as const,
        label: discoverBlendText.quickSites
      },
      {
        key: 'quick-watch' as const,
        section: 'watchlist' as const,
        icon: 'bar-chart-outline' as const,
        label: discoverBlendText.quickWatch
      }
    ],
    [discoverBlendText]
  );
  const discoverQuickSectionOrder: DiscoverQuickSection[] = ['earn', 'exploreDapps', 'popularTokens', 'sites', 'watchlist'];

  useEffect(() => {
    if (currentScreen !== 'discover') return;
    setDiscoverQuickActive(null);
    setDiscoverQuickArmed(false);
  }, [currentScreen]);

  useEffect(() => {
    if (weeklyBriefingWeekGroups.length === 0) {
      if (discoverBriefingWeekKey !== null) setDiscoverBriefingWeekKey(null);
      return;
    }
    const hasSelection = Boolean(discoverBriefingWeekKey) && weeklyBriefingWeekGroups.some((group) => group.weekKey === discoverBriefingWeekKey);
    if (!hasSelection) {
      setDiscoverBriefingWeekKey(weeklyBriefingWeekGroups[0].weekKey);
    }
  }, [discoverBriefingWeekKey, weeklyBriefingWeekGroups]);

  useEffect(() => {
    if (currentScreen !== 'discoverBriefingBoard') {
      if (discoverBriefingExpandedId !== null) setDiscoverBriefingExpandedId(null);
      if (showDiscoverBriefingWeekMenu) setShowDiscoverBriefingWeekMenu(false);
      return;
    }
    if (!discoverBriefingExpandedId) return;
    const existsInActiveWeek = activeBriefingWeekGroup?.posts.some((post) => post.id === discoverBriefingExpandedId) ?? false;
    if (!existsInActiveWeek) setDiscoverBriefingExpandedId(null);
  }, [activeBriefingWeekGroup, currentScreen, discoverBriefingExpandedId, showDiscoverBriefingWeekMenu]);

  const scrollDiscoverPopularToTop = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const scrollViewAny = discoverPopularScrollRef.current as any;
        if (scrollViewAny && typeof scrollViewAny.scrollTo === 'function') {
          try {
            scrollViewAny.scrollTo({ x: 0, y: 0, animated: false });
            return;
          } catch {
            // fallback below
          }
        }
        if (Platform.OS === 'web' && typeof document !== 'undefined') {
          const root = document.querySelector('[data-testid="discover-popular-scroll"]') as HTMLElement | null;
          if (root) root.scrollTop = 0;
        }
      });
    });
  };

  const scrollDiscoverSectionListToTop = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const scrollViewAny = discoverSectionScrollRef.current as any;
        if (scrollViewAny && typeof scrollViewAny.scrollTo === 'function') {
          try {
            scrollViewAny.scrollTo({ x: 0, y: 0, animated: false });
            return;
          } catch {
            // fallback below
          }
        }
        if (Platform.OS === 'web' && typeof document !== 'undefined') {
          const root = document.querySelector('[data-testid="discover-section-list-scroll"]') as HTMLElement | null;
          if (root) root.scrollTop = 0;
        }
      });
    });
  };

  const scrollDiscoverTabListToTop = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const scrollViewAny = discoverTabListScrollRef.current as any;
        if (scrollViewAny && typeof scrollViewAny.scrollTo === 'function') {
          try {
            scrollViewAny.scrollTo({ x: 0, y: 0, animated: false });
            return;
          } catch {
            // fallback below
          }
        }
        if (Platform.OS === 'web' && typeof document !== 'undefined') {
          const root = document.querySelector('[data-testid="discover-tab-list-scroll"]') as HTMLElement | null;
          if (root) root.scrollTop = 0;
        }
      });
    });
  };

  useEffect(() => {
    if (currentScreen !== 'discoverPopularRanking') return;
    scrollDiscoverPopularToTop();
  }, [currentScreen]);

  useEffect(() => {
    if (
      currentScreen !== 'discoverEarn' &&
      currentScreen !== 'discoverExploreDapps' &&
      currentScreen !== 'discoverWatchlist' &&
      currentScreen !== 'discoverFavorite' &&
      currentScreen !== 'discoverSites' &&
      currentScreen !== 'discoverLatest'
    ) {
      return;
    }
    scrollDiscoverSectionListToTop();
  }, [currentScreen]);

  useEffect(() => {
    if (currentScreen !== 'discoverHistory' && currentScreen !== 'discoverNoTabs') return;
    scrollDiscoverTabListToTop();
  }, [currentScreen]);

  const setDiscoverSectionOffset = (section: DiscoverQuickSection, y: number) => {
    discoverSectionOffsetsRef.current[section] = y;
  };
  const discoverSectionDomIdByKey: Record<DiscoverQuickSection, string> = {
    earn: 'discover-section-earn',
    exploreDapps: 'discover-section-explore-dapps',
    popularTokens: 'discover-section-popular-tokens',
    watchlist: 'discover-section-watchlist',
    sites: 'discover-section-sites'
  };

  const getOffsetTopWithinContainer = (element: any, container: any) => {
    let total = 0;
    let node = element;
    while (node && node !== container) {
      total += Number(node.offsetTop || 0);
      node = node.offsetParent;
    }
    return total;
  };

  const scrollDiscoverToY = (targetY: number) => {
    const y = Math.max(targetY, 0);
    const scrollViewAny = discoverScrollRef.current as any;
    if (!scrollViewAny) return false;

    const scrollDomNode = (node: any) => {
      if (!node || typeof node.scrollTo !== 'function') return false;
      try {
        node.scrollTo({ top: y, left: 0, behavior: 'smooth' });
        return true;
      } catch {
        // fallback below
      }
      try {
        node.scrollTop = y;
        return true;
      } catch {
        return false;
      }
    };

    // React Native Web path
    const webNode =
      (typeof scrollViewAny.getScrollableNode === 'function' ? scrollViewAny.getScrollableNode() : null) ??
      (typeof scrollViewAny.getInnerViewNode === 'function' ? scrollViewAny.getInnerViewNode() : null);
    if (scrollDomNode(webNode)) return true;

    // React Native Web deep fallback via data-testid
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const root = document.querySelector('[data-testid="discover-scroll"]') as HTMLElement | null;
      if (root) {
        const candidates = [root, ...Array.from(root.querySelectorAll('*'))] as HTMLElement[];
        const scrollable = candidates.find((el) => el.scrollHeight > el.clientHeight + 2);
        if (scrollDomNode(scrollable)) return true;
      }
    }

    // Native path
    if (typeof scrollViewAny.scrollTo === 'function') {
      try {
        scrollViewAny.scrollTo({ x: 0, y, animated: true });
        return true;
      } catch {
        // fallback below
      }
      try {
        scrollViewAny.scrollTo(0, y, true);
        return true;
      } catch {
        // fallback below
      }
    }

    const responder = scrollViewAny.getScrollResponder?.();
    if (responder?.scrollResponderScrollTo) {
      responder.scrollResponderScrollTo({ x: 0, y, animated: true });
      return true;
    }

    return false;
  };

  const scrollToDiscoverSection = (section: DiscoverQuickSection) => {
    setDiscoverQuickArmed(true);
    setDiscoverQuickActive(section);

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const targetId = discoverSectionDomIdByKey[section];
      const targetById = document.getElementById(targetId) as any;
      const targetByTestId = document.querySelector(`[data-testid="${targetId}"]`) as any;
      const targetNode = targetById ?? targetByTestId;
      if (targetNode && typeof targetNode.scrollIntoView === 'function') {
        try {
          targetNode.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          return;
        } catch {
          // fallback below
        }
      }

      const container =
        (document.getElementById('discover-scroll') as any) ??
        (document.querySelector('[data-testid="discover-scroll"]') as any) ??
        (Array.from(document.querySelectorAll('div')).find(
          (el) => (el as any).scrollHeight > (el as any).clientHeight + 120
        ) as any);
      const target =
        (document.getElementById(discoverSectionDomIdByKey[section]) as any) ??
        (document.querySelector(`[data-testid="${discoverSectionDomIdByKey[section]}"]`) as any);
      if (container && target && typeof container.scrollTo === 'function') {
        const rawOffset = getOffsetTopWithinContainer(target, container);
        const rectOffset = (() => {
          try {
            const containerTop = Number(container.getBoundingClientRect?.().top ?? 0);
            const targetTop = Number(target.getBoundingClientRect?.().top ?? 0);
            return targetTop - containerTop + Number(container.scrollTop || 0);
          } catch {
            return rawOffset;
          }
        })();
        const y = Math.max((Number.isFinite(rectOffset) ? rectOffset : rawOffset) - DISCOVER_QUICK_SCROLL_OFFSET, 0);
        try {
          container.scrollTo({ top: y, left: 0, behavior: 'smooth' });
        } catch {
          container.scrollTop = y;
        }
        return;
      }
    }

    const fallbackYMap: Record<DiscoverQuickSection, number> = {
      earn: 380,
      exploreDapps: 520,
      popularTokens: 640,
      sites: 920,
      watchlist: 1200
    };

    const attemptScroll = (attempt = 0) => {
      const measuredY = discoverSectionOffsetsRef.current[section];
      const y = Math.max((measuredY > 0 ? measuredY : fallbackYMap[section]) - DISCOVER_QUICK_SCROLL_OFFSET, 0);
      const moved = scrollDiscoverToY(y);

      if (!moved && attempt < 3) {
        setTimeout(() => attemptScroll(attempt + 1), 90);
      }
    };

    // layout settle + deterministic behavior on web
    requestAnimationFrame(() => attemptScroll(0));
  };

  const syncDiscoverQuickActiveByScroll = (offsetY: number) => {
    if (!discoverQuickArmed) return;
    const probeY = offsetY + DISCOVER_QUICK_SCROLL_OFFSET + 8;

    let nextActive: DiscoverQuickSection = discoverQuickSectionOrder[0] ?? 'earn';
    for (const section of discoverQuickSectionOrder) {
      const y = discoverSectionOffsetsRef.current[section];
      if (probeY >= y) {
        nextActive = section;
      }
    }

    if (nextActive !== discoverQuickActive && discoverQuickSectionOrder.includes(nextActive)) {
      setDiscoverQuickActive(nextActive);
    }
  };

  useEffect(() => {
    if (discoverPopularPage <= 1) return;
    setDiscoverPopularPage(1);
  }, [discoverPopularPage]);

  useEffect(() => {
    if (discoverWatchlistPage <= discoverWatchlistTotalPages) return;
    setDiscoverWatchlistPage(discoverWatchlistTotalPages);
  }, [discoverWatchlistPage, discoverWatchlistTotalPages]);

  useEffect(() => {
    setDiscoverPopularPage(1);
  }, [discoverTokenCategory]);

  const fallbackToken = tokens[0] ?? tokenCatalog[0];
  const assetDetailToken = tokens.find((token) => token.id === assetDetailTokenId) ?? fallbackToken;
  const assetInfoPreset = assetInfoCatalog[assetDetailToken.assetKey];
  const assetChartSeries = useMemo(() => buildAssetChartSeries(assetDetailToken.id, assetChartRange), [assetDetailToken.id, assetChartRange]);
  const assetChartTrend = useMemo(() => {
    if (assetChartSeries.length < 2) return { up: true, percent: 0, usd: 0 };
    const first = assetChartSeries[0];
    const last = assetChartSeries[assetChartSeries.length - 1];
    const percent = ((last - first) / Math.max(first, 0.01)) * 100;
    const usd = (assetDetailToken.priceUsd * percent) / 100;
    return { up: percent >= 0, percent, usd };
  }, [assetChartSeries, assetDetailToken.priceUsd]);
  const assetDetailTotalUsd = assetDetailToken.balance * assetDetailToken.priceUsd;
  const assetNativeNoContractLabel =
    lang === 'ko' ? '네이티브 자산 (컨트랙트 없음)' : lang === 'zh' ? '原生资产（无合约地址）' : 'Native asset (no contract)';
  const assetContractAddress =
    assetDetailToken.assetKey === 'USDT' ? usdtContractByChain[assetDetailToken.chainCode] ?? '--' : assetNativeNoContractLabel;
  const recentAssetTxs = useMemo(
    () =>
      txs
        .filter((tx) => {
          const symbol = tx.tokenSymbol.toUpperCase();
          if (symbol === assetDetailToken.symbol.toUpperCase()) return true;
          if (assetDetailToken.assetKey === 'USDT' && symbol === 'USDT') return true;
          return false;
        }),
    [txs, assetDetailToken]
  );
  const assetRecentTotalPages = Math.max(1, Math.ceil(recentAssetTxs.length / 5));
  const assetRecentCurrentPage = Math.min(assetRecentPage, assetRecentTotalPages);
  const assetRecentPagedTxs = useMemo(() => {
    const startIndex = (assetRecentCurrentPage - 1) * 5;
    return recentAssetTxs.slice(startIndex, startIndex + 5);
  }, [recentAssetTxs, assetRecentCurrentPage]);
  const assetChartSegments = useMemo(() => {
    const width = Math.max(assetChartWidth - 8, 0);
    const height = 176;
    const lineThickness = 2;
    if (width <= 0 || assetChartSeries.length < 2) return [];
    const maxIndex = assetChartSeries.length - 1;

    return assetChartSeries.slice(1).map((value, idx) => {
      const prev = assetChartSeries[idx];
      const x1 = (idx / maxIndex) * width;
      const x2 = ((idx + 1) / maxIndex) * width;
      const y1 = (1 - prev) * height;
      const y2 = (1 - value) * height;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);

      // RN View rotation is centered by default.
      // Adjust left/top so each segment still starts exactly at (x1, y1),
      // preventing visible gaps between short segments.
      const left = x1 + (length * 0.5) * (Math.cos(angle) - 1);
      const top = y1 + (length * 0.5) * Math.sin(angle) - lineThickness / 2;

      return { left, top, width: Math.max(length + 0.8, 1), angle };
    });
  }, [assetChartSeries, assetChartWidth]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setAssetLiveHolderCount(null);

    const refresh = async () => {
      try {
        const snapshot = await fetchMarketHolderCount(assetDetailToken.assetKey, assetDetailToken.chainCode, controller.signal);
        if (cancelled) return;
        setAssetLiveHolderCount(Number.isFinite(snapshot?.holderCount) ? Number(snapshot?.holderCount) : null);
      } catch {
        if (cancelled) return;
        setAssetLiveHolderCount(null);
      }
    };

    void refresh();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [assetDetailToken.assetKey, assetDetailToken.chainCode]);
  const visibleChainCodes = useMemo(
    () => chainOrder.filter((chain) => tokens.some((token) => token.chainCode === chain)),
    [tokens]
  );
  const allFilterTokens = useMemo(() => {
    const enabledTokenMap = new Map(tokens.map((token) => [token.id, token]));
    return tokenCatalog.map((catalogToken) => enabledTokenMap.get(catalogToken.id) ?? catalogToken);
  }, [tokens]);
  const filterChainCodes = useMemo(
    () => chainOrder.filter((chain) => allFilterTokens.some((token) => token.chainCode === chain)),
    [allFilterTokens]
  );
  const sendAssetOptions = useMemo(
    () => (sendChainFilter === 'ALL' ? [] : allFilterTokens.filter((token) => token.chainCode === sendChainFilter)),
    [allFilterTokens, sendChainFilter]
  );
  const receiveAssetOptions = useMemo(
    () => (receiveChainFilter === 'ALL' ? [] : allFilterTokens.filter((token) => token.chainCode === receiveChainFilter)),
    [allFilterTokens, receiveChainFilter]
  );
  const selectedSendToken =
    sendAssetFilterTokenId === 'ALL' ? null : sendAssetOptions.find((token) => token.id === sendAssetFilterTokenId) ?? null;
  const selectedReceiveToken =
    receiveAssetFilterTokenId === 'ALL' ? null : receiveAssetOptions.find((token) => token.id === receiveAssetFilterTokenId) ?? null;
  const liveNetworkFeeTargets = useMemo(() => {
    const targetSet = new Set<ChainCode>();
    if (selectedSendToken?.chainCode) targetSet.add(selectedSendToken.chainCode);
    if (selectedNftForSend) targetSet.add(getCollectibleChainCode(selectedNftForSend));
    return chainOrder.filter((chain) => targetSet.has(chain));
  }, [selectedSendToken?.chainCode, selectedNftForSend]);
  const liveNetworkFeeTargetKey = liveNetworkFeeTargets.join(',');
  const liveNetworkFeeRequests = useMemo(() => {
    const requestMap: Partial<Record<ChainCode, LiveNetworkFeeRequest>> = {};

    if (selectedSendToken?.chainCode === 'FIL') {
      const toAddress = recipientInput.trim();
      if (toAddress) {
        requestMap.FIL = {
          fromAddress: selectedSendToken.walletAddress,
          toAddress,
          amountNative: parseAmountInput(amountInput)
        };
      }
    }

    if (selectedNftForSend && getCollectibleChainCode(selectedNftForSend) === 'FIL') {
      const toAddress = nftSendRecipientInput.trim();
      if (toAddress) {
        requestMap.FIL = {
          fromAddress: activeWalletChainAddresses.FIL,
          toAddress,
          amountNative: 0
        };
      }
    }

    return requestMap;
  }, [
    selectedSendToken?.chainCode,
    selectedSendToken?.walletAddress,
    recipientInput,
    amountInput,
    selectedNftForSend,
    nftSendRecipientInput,
    activeWalletChainAddresses.FIL
  ]);
  const liveNetworkFeeRequestKey = useMemo(() => JSON.stringify(liveNetworkFeeRequests), [liveNetworkFeeRequests]);

  useEffect(() => {
    if (!liveNetworkFeeTargets.length) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();

    const refresh = async () => {
      try {
        const snapshots = await Promise.all(
          liveNetworkFeeTargets.map(async (chain) => {
            const snapshot = await fetchLiveNetworkFee(chain, controller.signal, liveNetworkFeeRequests[chain]);
            return [chain, snapshot] as const;
          })
        );
        if (cancelled) return;
        setLiveNetworkFeeMap((prev) => {
          const next = { ...prev };
          snapshots.forEach(([chain, snapshot]) => {
            next[chain] = snapshot;
          });
          return next;
        });
      } catch (error) {
        if (cancelled) return;
        trackError('send.network_fee.refresh_failed', error, {
          chains: liveNetworkFeeTargets.join(','),
          requestKey: liveNetworkFeeRequestKey,
          platform: Platform.OS
        });
      } finally {
        if (cancelled) return;
        timer = setTimeout(() => {
          void refresh();
        }, LIVE_NETWORK_FEE_REFRESH_MS);
      }
    };

    void refresh();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      controller.abort();
    };
  }, [liveNetworkFeeTargetKey, liveNetworkFeeRequestKey]);

  const isSendSelectionComplete = sendChainFilter !== 'ALL' && Boolean(selectedSendToken);
  const isReceiveSelectionComplete = receiveChainFilter !== 'ALL' && Boolean(selectedReceiveToken);
  const sendToken =
    selectedSendToken ??
    tokens.find((token) => token.id === sendTokenId && token.chainCode === sendChainCode) ??
    sendAssetOptions[0] ??
    fallbackToken;
  const receiveToken =
    selectedReceiveToken ??
    tokens.find((token) => token.id === receiveTokenId && token.chainCode === receiveChainCode) ??
    receiveAssetOptions[0] ??
    fallbackToken;
  const activeManagerAddressBook = addressBookScope === 'nft' ? nftAddressBook : addressBook;
  const recipientBookEntries = recipientBookScope === 'nft' ? nftAddressBook : addressBook;
  const addressBookChainOptions = useMemo(
    () => chainOrder.filter((chain) => activeManagerAddressBook.some((entry) => entry.chain === chain)),
    [activeManagerAddressBook]
  );
  const recipientBookChainOptions = useMemo(
    () => chainOrder.filter((chain) => recipientBookEntries.some((entry) => entry.chain === chain)),
    [recipientBookEntries]
  );
  const recipientBookAssetOptions = useMemo(() => {
    const set = new Set<AssetKey>();
    recipientBookEntries.forEach((entry) => {
      if (recipientBookChainFilter !== 'ALL' && entry.chain !== recipientBookChainFilter) return;
      set.add(entry.assetKey ?? chainNativeAssetMap[entry.chain]);
    });
    const assetOrder: AssetKey[] = ['BTC', 'ETH', 'XRP', 'BNB', 'SOL', 'TRX', 'FIL', 'USDT'];
    return assetOrder.filter((asset) => set.has(asset));
  }, [recipientBookEntries, recipientBookChainFilter]);
  const filteredRecipientBookEntries = useMemo(() => {
    return [...recipientBookEntries]
      .filter((entry) => {
        const entryAssetKey = entry.assetKey ?? chainNativeAssetMap[entry.chain];
        if (recipientBookChainFilter !== 'ALL' && entry.chain !== recipientBookChainFilter) return false;
        if (recipientBookAssetFilter !== 'ALL' && entryAssetKey !== recipientBookAssetFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
  }, [recipientBookEntries, recipientBookChainFilter, recipientBookAssetFilter]);
  const recipientBookTotalPages = Math.max(1, Math.ceil(filteredRecipientBookEntries.length / 3));
  const recipientBookCurrentPage = Math.min(recipientBookPage, recipientBookTotalPages);
  const recipientBookPagedEntries = useMemo(() => {
    const startIndex = (recipientBookCurrentPage - 1) * 3;
    return filteredRecipientBookEntries.slice(startIndex, startIndex + 3);
  }, [filteredRecipientBookEntries, recipientBookCurrentPage]);
  const addressBookLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    addressBook.forEach((entry) => {
      const label = entry.label.trim();
      if (!label) return;
      const normalized = normalizeAddress(entry.chain, entry.address.trim());
      map.set(`${entry.chain}:${normalized}`, label);
    });
    return map;
  }, [addressBook]);
  const findAddressBookLabel = (chain: ChainCode, address: string) => {
    const normalized = normalizeAddress(chain, address.trim());
    return addressBookLabelMap.get(`${chain}:${normalized}`);
  };
  const nftAddressBookLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    nftAddressBook.forEach((entry) => {
      const label = entry.label.trim();
      if (!label) return;
      const normalized = normalizeAddress(entry.chain, entry.address.trim());
      map.set(`${entry.chain}:${normalized}`, label);
    });
    return map;
  }, [nftAddressBook]);
  const findNftAddressBookLabel = (chain: ChainCode, address: string) => {
    const normalized = normalizeAddress(chain, address.trim());
    return nftAddressBookLabelMap.get(`${chain}:${normalized}`);
  };
  const filteredAddressBookEntries = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return [...activeManagerAddressBook]
      .filter((entry) => {
        if (addressBookChainFilter !== 'ALL' && entry.chain !== addressBookChainFilter) return false;
        const entryAssetKey = entry.assetKey ?? chainNativeAssetMap[entry.chain];
        if (addressBookAssetFilter !== 'ALL' && entryAssetKey !== addressBookAssetFilter) return false;
        const createdAt = parseTxDate(entry.createdAt);
        if (addressBookDateFilter === 'TODAY' && createdAt < todayStart) return false;
        if (addressBookDateFilter === '7D' && createdAt < sevenDaysAgo) return false;
        if (addressBookDateFilter === '30D' && createdAt < thirtyDaysAgo) return false;
        return true;
      })
      .sort((a, b) => parseTxDate(b.createdAt).getTime() - parseTxDate(a.createdAt).getTime());
  }, [activeManagerAddressBook, addressBookAssetFilter, addressBookChainFilter, addressBookDateFilter]);
  const addressBookTotalPages = Math.max(1, Math.ceil(filteredAddressBookEntries.length / 5));
  const addressBookCurrentPage = Math.min(addressBookPage, addressBookTotalPages);
  const addressBookPagedEntries = useMemo(() => {
    const startIndex = (addressBookCurrentPage - 1) * 5;
    return filteredAddressBookEntries.slice(startIndex, startIndex + 5);
  }, [filteredAddressBookEntries, addressBookCurrentPage]);
  const recentSendTargets = useMemo(() => {
    const limit = 5;

    if (!isSendSelectionComplete || !selectedSendToken) {
      if (sendChainFilter !== 'ALL') {
        const list: RecentSendItem[] = [];
        const seen = new Set<string>();

        for (const tx of txs) {
          if (tx.type !== 'send') continue;
          if (tx.tokenSymbol.toUpperCase() === 'NFT') continue;
          const txChain = inferChainFromTx(tx);
          if (txChain !== sendChainFilter) continue;

          const key = `${txChain}:${normalizeAddress(txChain, tx.counterparty)}`;
          if (seen.has(key)) continue;
          seen.add(key);

          list.push({
            address: tx.counterparty,
            chain: txChain,
            amount: tx.amount,
            symbol: tx.tokenSymbol,
            date: tx.createdAt,
            label: findAddressBookLabel(txChain, tx.counterparty),
            memo: tx.memo?.trim() || undefined
          });
          if (list.length >= limit) break;
        }

        return list;
      }

      const list: RecentSendItem[] = [];
      const seen = new Set<string>();
      for (const tx of txs) {
        if (tx.type !== 'send') continue;
        if (tx.tokenSymbol.toUpperCase() === 'NFT') continue;
        const txChain = inferChainFromTx(tx);
        const key = `${txChain}:${normalizeAddress(txChain, tx.counterparty)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        list.push({
          address: tx.counterparty,
          chain: txChain,
          amount: tx.amount,
          symbol: tx.tokenSymbol,
          date: tx.createdAt,
          label: findAddressBookLabel(txChain, tx.counterparty),
          memo: tx.memo?.trim() || undefined
        });
        if (list.length >= limit) break;
      }
      return list;
    }

    const list: RecentSendItem[] = [];
    const seen = new Set<string>();
    for (const tx of txs) {
      if (tx.type !== 'send') continue;
      if (!tx.chain || tx.chain !== selectedSendToken.chainCode) continue;
      if (tx.tokenSymbol !== selectedSendToken.symbol) continue;
      const key = normalizeAddress(selectedSendToken.chainCode, tx.counterparty);
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({
        address: tx.counterparty,
        chain: selectedSendToken.chainCode,
        amount: tx.amount,
        symbol: tx.tokenSymbol,
        date: tx.createdAt,
        label: findAddressBookLabel(selectedSendToken.chainCode, tx.counterparty),
        memo: tx.memo?.trim() || undefined
      });
      if (list.length >= limit) break;
    }

    return list;
  }, [txs, isSendSelectionComplete, selectedSendToken, sendChainFilter, addressBookLabelMap]);

  const latestRecentSend = recentSendTargets[0] ?? null;
  function getCollectibleChainCode(item: CollectibleItem): ChainCode {
    return normalizeChainCode(item.network) ?? 'ETH';
  }

  const nftRecentSendTitle =
    lang === 'ko' ? '최근 NFT 전송' : lang === 'zh' ? '最近 NFT 转账' : 'Recent NFT Transfers';
  const nftRecentSendEmptyText =
    lang === 'ko' ? '최근 NFT 전송 내역이 없습니다.' : lang === 'zh' ? '暂无最近 NFT 转账记录。' : 'No recent NFT transfer history.';

  const recentNftSendTargets = useMemo(() => {
    const limit = 5;
    if (!selectedNftForSend) return [];
    const selectedChain = getCollectibleChainCode(selectedNftForSend);
    const selectedTokenId = selectedNftForSend.tokenId;
    const list: RecentNftSendItem[] = [];

    for (const tx of txs) {
      if (tx.type !== 'send') continue;
      if (tx.tokenSymbol.toUpperCase() !== 'NFT') continue;
      if (inferChainFromTx(tx) !== selectedChain) continue;

      const rawMemo = tx.memo?.trim() ?? '';
      const [memoHead, memoTail] = rawMemo.split('/').map((part) => part.trim());
      let parsedTokenId = selectedTokenId;
      const tokenIdMatch = memoHead?.match(/#([A-Za-z0-9_-]+)/);
      if (tokenIdMatch?.[1]) parsedTokenId = tokenIdMatch[1];
      const nftTitle = memoHead ? memoHead.replace(/\s*#([A-Za-z0-9_-]+)\s*$/, '').trim() : selectedNftForSend.name;

      list.push({
        address: tx.counterparty,
        date: tx.createdAt,
        nftTitle: nftTitle || selectedNftForSend.name,
        tokenId: parsedTokenId,
        label: findNftAddressBookLabel(selectedChain, tx.counterparty),
        memo: memoTail || undefined,
        chain: selectedChain
      });
      if (list.length >= limit) break;
    }

    return list.slice(0, limit);
  }, [txs, selectedNftForSend, nftAddressBookLabelMap]);

  const latestRecentNftSend = recentNftSendTargets[0] ?? null;

  const historyChainOptions = useMemo(() => {
    if (historyScopeFilter !== 'NFT') return filterChainCodes;

    const nftChains = new Set<ChainCode>();
    collectibles.forEach((item) => {
      const chain = normalizeChainCode(item.network);
      if (chain) nftChains.add(chain);
    });
    txs.forEach((tx) => {
      if (tx.tokenSymbol.toUpperCase() !== 'NFT') return;
      nftChains.add(inferChainFromTx(tx));
    });

    const ordered = chainOrder.filter((chain) => nftChains.has(chain));
    return ordered;
  }, [collectibles, txs, filterChainCodes, historyScopeFilter]);

  const historyAssetOptions = useMemo(() => {
    if (historyScopeFilter === 'NFT') return [];
    const set = new Set<AssetKey>();
    allFilterTokens.forEach((token) => {
      if (historyChainFilter !== 'ALL' && token.chainCode !== historyChainFilter) return;
      set.add(token.assetKey);
    });
    const assetOrder: AssetKey[] = ['BTC', 'ETH', 'XRP', 'BNB', 'SOL', 'TRX', 'FIL', 'USDT'];
    return assetOrder.filter((asset) => set.has(asset));
  }, [allFilterTokens, historyChainFilter, historyScopeFilter]);

  const nftReceiveChainOptions = useMemo(() => {
    const nftChains = new Set<ChainCode>();
    collectibles.forEach((item) => {
      const chain = normalizeChainCode(item.network);
      if (chain) nftChains.add(chain);
    });
    nftAddressBook.forEach((entry) => {
      nftChains.add(entry.chain);
    });
    txs.forEach((tx) => {
      if (tx.tokenSymbol.toUpperCase() !== 'NFT') return;
      nftChains.add(inferChainFromTx(tx));
    });
    return chainOrder.filter((chain) => nftChains.has(chain));
  }, [collectibles, nftAddressBook, txs]);

  const manageChainOptions = useMemo(
    () => chainOrder.filter((chain) => tokenCatalog.some((token) => token.chainCode === chain)),
    []
  );

  const addressBookAssetOptions = useMemo(() => {
    const set = new Set<AssetKey>();
    if (addressBookScope === 'asset') {
      tokens.forEach((token) => {
        if (addressBookChainFilter !== 'ALL' && token.chainCode !== addressBookChainFilter) return;
        set.add(token.assetKey);
      });
    } else {
      collectibles.forEach((item) => {
        const chain = normalizeChainCode(item.network) ?? 'ETH';
        if (addressBookChainFilter !== 'ALL' && chain !== addressBookChainFilter) return;
        set.add(chainNativeAssetMap[chain]);
      });
    }
    activeManagerAddressBook.forEach((entry) => {
      if (addressBookChainFilter !== 'ALL' && entry.chain !== addressBookChainFilter) return;
      set.add(entry.assetKey ?? chainNativeAssetMap[entry.chain]);
    });
    const assetOrder: AssetKey[] = ['BTC', 'ETH', 'XRP', 'BNB', 'SOL', 'TRX', 'FIL', 'USDT'];
    return assetOrder.filter((asset) => set.has(asset));
  }, [tokens, collectibles, activeManagerAddressBook, addressBookChainFilter, addressBookScope]);

  const addressFormAssetOptions = useMemo(() => {
    const set = new Set<AssetKey>();
    tokenCatalog.forEach((token) => {
      if (token.chainCode !== addressFormChain) return;
      set.add(token.assetKey);
    });
    const assetOrder: AssetKey[] = ['BTC', 'ETH', 'XRP', 'BNB', 'SOL', 'TRX', 'FIL', 'USDT'];
    return assetOrder.filter((asset) => set.has(asset));
  }, [addressFormChain]);

  const manageAssetOptions = useMemo(() => {
    const set = new Set<AssetKey>();
    tokenCatalog.forEach((token) => {
      if (manageChainFilter !== 'ALL' && token.chainCode !== manageChainFilter) return;
      set.add(token.assetKey);
    });
    const assetOrder: AssetKey[] = ['BTC', 'ETH', 'XRP', 'BNB', 'SOL', 'TRX', 'FIL', 'USDT'];
    return assetOrder.filter((asset) => set.has(asset));
  }, [manageChainFilter]);

  const filteredManageTokens = useMemo(
    () => {
      const filtered = tokenCatalog.filter((token) => {
        if (manageChainFilter !== 'ALL' && token.chainCode !== manageChainFilter) return false;
        if (manageAssetFilter !== 'ALL' && token.assetKey !== manageAssetFilter) return false;
        return true;
      });

      const favorites = filtered
        .filter((token) => favoriteTokenIdSet.has(token.id))
        .sort((a, b) => {
          const symbolDiff = a.symbol.localeCompare(b.symbol, 'en', { sensitivity: 'base' });
          if (symbolDiff !== 0) return symbolDiff;
          return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
        });
      const normal = filtered.filter((token) => !favoriteTokenIdSet.has(token.id));
      return [...favorites, ...normal];
    },
    [favoriteTokenIdSet, manageChainFilter, manageAssetFilter]
  );

  useEffect(() => {
    setHistoryAssetFilter('ALL');
  }, [historyChainFilter]);

  useEffect(() => {
    if (historyScopeFilter === 'NFT') {
      if (historyAssetFilter !== 'ALL') setHistoryAssetFilter('ALL');
      return;
    }
    if (historyAssetFilter === 'ALL') return;
    if (!historyAssetOptions.includes(historyAssetFilter)) {
      setHistoryAssetFilter('ALL');
    }
  }, [historyAssetFilter, historyAssetOptions, historyScopeFilter]);

  useEffect(() => {
    if (historyChainFilter === 'ALL') return;
    if (!historyChainOptions.includes(historyChainFilter)) {
      setHistoryChainFilter('ALL');
    }
  }, [historyChainFilter, historyChainOptions]);

  useEffect(() => {
    addressBookScopeRef.current = addressBookScope;
  }, [addressBookScope]);

  useEffect(() => {
    setManageAssetFilter('ALL');
  }, [manageChainFilter]);

  useEffect(() => {
    if (manageAssetFilter === 'ALL') return;
    if (!manageAssetOptions.includes(manageAssetFilter)) {
      setManageAssetFilter('ALL');
    }
  }, [manageAssetFilter, manageAssetOptions]);

  useEffect(() => {
    if (addressBookScope === 'nft') {
      if (addressBookAssetFilter !== 'ALL') setAddressBookAssetFilter('ALL');
      return;
    }
    if (addressBookAssetFilter === 'ALL') return;
    if (!addressBookAssetOptions.includes(addressBookAssetFilter)) {
      setAddressBookAssetFilter('ALL');
    }
  }, [addressBookAssetFilter, addressBookAssetOptions, addressBookScope]);

  useEffect(() => {
    if (addressBookPage <= addressBookTotalPages) return;
    setAddressBookPage(addressBookTotalPages);
  }, [addressBookPage, addressBookTotalPages]);

  useEffect(() => {
    setAddressBookPage(1);
  }, [addressBookChainFilter, addressBookAssetFilter, addressBookDateFilter]);

  useEffect(() => {
    if (recipientBookScope === 'nft') {
      if (recipientBookAssetFilter !== 'ALL') setRecipientBookAssetFilter('ALL');
      return;
    }
    if (recipientBookAssetFilter === 'ALL') return;
    if (!recipientBookAssetOptions.includes(recipientBookAssetFilter)) {
      setRecipientBookAssetFilter('ALL');
    }
  }, [recipientBookAssetFilter, recipientBookAssetOptions, recipientBookScope]);

  useEffect(() => {
    if (recipientBookPage <= recipientBookTotalPages) return;
    setRecipientBookPage(recipientBookTotalPages);
  }, [recipientBookPage, recipientBookTotalPages]);

  useEffect(() => {
    setRecipientBookPage(1);
  }, [recipientBookChainFilter, recipientBookAssetFilter]);

  useEffect(() => {
    if (!addressFormAssetOptions.length) {
      setAddressFormAssetKey(chainNativeAssetMap[addressFormChain]);
      return;
    }
    if (!addressFormAssetOptions.includes(addressFormAssetKey)) {
      setAddressFormAssetKey(addressFormAssetOptions[0]);
    }
  }, [addressFormAssetKey, addressFormAssetOptions, addressFormChain]);

  useEffect(() => {
    if (addressBookChainFilter === 'ALL') return;
    setAddressFormChain(addressBookChainFilter);
  }, [addressBookChainFilter]);

  useEffect(() => {
    if (addressBookAssetFilter === 'ALL') return;
    if (!addressFormAssetOptions.includes(addressBookAssetFilter)) return;
    setAddressFormAssetKey(addressBookAssetFilter);
  }, [addressBookAssetFilter, addressFormAssetOptions]);

  const filteredHistoryTxs = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const rangeStart = historyRangeStart ? parseYmdDate(historyRangeStart) : null;
    const rangeEnd = historyRangeEnd ? parseYmdDate(historyRangeEnd) : null;
    const rangeStartAt = rangeStart ? startOfDay(rangeStart) : null;
    const rangeEndAt = rangeEnd ? endOfDay(rangeEnd) : null;

    return [...txs]
      .filter((tx) => {
        const chain = inferChainFromTx(tx);
        const asset = normalizeAssetKey(tx.tokenSymbol);
        const txDate = parseTxDate(tx.createdAt);
        const isNftTx = tx.tokenSymbol === 'NFT';

        if (historyScopeFilter === 'ASSET' && isNftTx) return false;
        if (historyScopeFilter === 'NFT' && !isNftTx) return false;
        if (historyChainFilter !== 'ALL' && chain !== historyChainFilter) return false;
        if (!isNftTx && historyAssetFilter !== 'ALL' && asset !== historyAssetFilter) return false;
        if (historyDateFilter === 'TODAY' && txDate < todayStart) return false;
        if (historyDateFilter === '7D' && txDate < sevenDaysAgo) return false;
        if (historyDateFilter === '30D' && txDate < thirtyDaysAgo) return false;
        if (historyDateFilter === 'RANGE') {
          if (rangeStartAt && txDate < rangeStartAt) return false;
          if (rangeEndAt && txDate > rangeEndAt) return false;
        }
        return true;
      })
      .sort((a, b) => parseTxDate(b.createdAt).getTime() - parseTxDate(a.createdAt).getTime());
  }, [txs, historyScopeFilter, historyChainFilter, historyAssetFilter, historyDateFilter, historyRangeStart, historyRangeEnd]);
  const historyTotalPages = Math.max(1, Math.ceil(filteredHistoryTxs.length / 20));
  const historyCurrentPage = Math.min(historyPage, historyTotalPages);
  const historyPagedTxs = useMemo(() => {
    const startIndex = (historyCurrentPage - 1) * 20;
    return filteredHistoryTxs.slice(startIndex, startIndex + 20);
  }, [filteredHistoryTxs, historyCurrentPage]);

  useEffect(() => {
    if (assetRecentPage <= assetRecentTotalPages) return;
    setAssetRecentPage(assetRecentTotalPages);
  }, [assetRecentPage, assetRecentTotalPages]);

  useEffect(() => {
    if (historyPage <= historyTotalPages) return;
    setHistoryPage(historyTotalPages);
  }, [historyPage, historyTotalPages]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historyScopeFilter, historyChainFilter, historyAssetFilter, historyDateFilter, historyRangeStart, historyRangeEnd]);

  const formatHistoryRangeLabel = (ymd: string | null) => {
    if (!ymd) return text.historyRangePickHint;
    const parsed = parseYmdDate(ymd);
    if (!parsed) return text.historyRangePickHint;
    return parsed.toLocaleDateString(text.locale, { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const openHistoryDateRangeModal = () => {
    measureHistoryRangeTriggerAnchor();
    setHistoryRangeDraftStart(historyRangeStart);
    setHistoryRangeDraftEnd(historyRangeEnd);
    setHistoryRangePresetDraft(null);
    setShowHistoryDateRangeModal(true);
  };

  const applyHistoryPresetRange = (months: 3 | 6 | 12) => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - months);
    const startYmd = formatDateYmd(start);
    const endYmd = formatDateYmd(end);
    setHistoryRangeDraftStart(startYmd);
    setHistoryRangeDraftEnd(endYmd);
    setHistoryRangePresetDraft(months);
  };

  const openHistoryRangeCalendar = (target: 'start' | 'end') => {
    setHistoryCalendarTarget(target);
    const sourceYmd = target === 'start' ? historyRangeDraftStart : historyRangeDraftEnd;
    const sourceDate = sourceYmd ? parseYmdDate(sourceYmd) : null;
    const base = sourceDate ?? new Date();
    setHistoryCalendarMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    setHistoryRangePresetDraft(null);
    setShowHistoryDateCalendarModal(true);
  };

  const onPickHistoryCalendarDate = (pickedDate: Date) => {
    const pickedYmd = formatDateYmd(pickedDate);
    if (historyCalendarTarget === 'start') setHistoryRangeDraftStart(pickedYmd);
    else setHistoryRangeDraftEnd(pickedYmd);
    setHistoryRangePresetDraft(null);
    setShowHistoryDateCalendarModal(false);
  };

  const resetHistoryRange = () => {
    setHistoryRangeDraftStart(null);
    setHistoryRangeDraftEnd(null);
    setHistoryRangePresetDraft(null);
  };

  const applyHistoryRange = () => {
    let start = historyRangeDraftStart ? parseYmdDate(historyRangeDraftStart) : null;
    let end = historyRangeDraftEnd ? parseYmdDate(historyRangeDraftEnd) : null;
    if (start && end && start.getTime() > end.getTime()) {
      const temp = start;
      start = end;
      end = temp;
    }
    const startYmd = start ? formatDateYmd(start) : null;
    const endYmd = end ? formatDateYmd(end) : null;
    setHistoryRangeStart(startYmd);
    setHistoryRangeEnd(endYmd);
    setHistoryDateFilter(startYmd || endYmd ? 'RANGE' : 'ALL');
    setShowHistoryDateRangeModal(false);
  };

  const openHomeAssetLayoutModal = () => {
    setHomeAssetLayoutDraft(homeAssetLayout);
    setShowHomeAssetLayoutModal(true);
  };

  const closeHomeAssetLayoutModal = () => {
    setShowHomeAssetLayoutModal(false);
    setHomeAssetLayoutDraft(homeAssetLayout);
  };

  const confirmHomeAssetLayoutModal = () => {
    setHomeAssetLayout(homeAssetLayoutDraft);
    setShowHomeAssetLayoutModal(false);
  };

  const calendarWeekLabels = lang === 'ko' ? ['일', '월', '화', '수', '목', '금', '토'] : lang === 'zh' ? ['日', '一', '二', '三', '四', '五', '六'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const historyCalendarMonthLabel = historyCalendarMonth.toLocaleDateString(text.locale, { year: 'numeric', month: 'long' });
  const selectedHistoryCalendarYmd = historyCalendarTarget === 'start' ? historyRangeDraftStart : historyRangeDraftEnd;
  const todayYmd = formatDateYmd(new Date());
  const historyCalendarCells = useMemo(() => {
    const year = historyCalendarMonth.getFullYear();
    const month = historyCalendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const firstWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ key: string; date: Date | null }> = [];
    for (let idx = 0; idx < firstWeekday; idx += 1) {
      cells.push({ key: `empty-${idx}`, date: null });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      cells.push({ key: formatDateYmd(date), date });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ key: `tail-empty-${cells.length}`, date: null });
    }
    return cells;
  }, [historyCalendarMonth]);

  const resetSendFilterSelection = () => {
    const firstToken = tokens[0];
    if (!firstToken) return;
    const baseChain = firstToken.chainCode;
    const baseToken = tokens.find((token) => token.chainCode === baseChain) ?? firstToken;
    setSendChainFilter('ALL');
    setSendAssetFilterTokenId('ALL');
    setSendChainCode(baseChain);
    setSendTokenId(baseToken.id);
  };

  const resetReceiveFilterSelection = () => {
    const firstToken = tokens[0];
    if (!firstToken) return;
    const baseChain = firstToken.chainCode;
    const baseToken = tokens.find((token) => token.chainCode === baseChain) ?? firstToken;
    setReceiveChainFilter('ALL');
    setReceiveAssetFilterTokenId('ALL');
    setReceiveChainCode(baseChain);
    setReceiveTokenId(baseToken.id);
  };

  const resetHistoryFilterSelection = () => {
    setHistoryScopeFilter('ALL');
    setHistoryChainFilter('ALL');
    setHistoryAssetFilter('ALL');
    setHistoryPage(1);
    setHistoryDateFilter('ALL');
    setHistoryRangeStart(null);
    setHistoryRangeEnd(null);
    setHistoryRangeDraftStart(null);
    setHistoryRangeDraftEnd(null);
    setHistoryRangePresetDraft(null);
  };

  const resetSendValidationState = () => {
    setRecipientTouched(false);
    setAmountTouched(false);
    setRecipientFocused(false);
    setAmountFocused(false);
    setMemoFocused(false);
    setBannerMessage('');
  };

  const resetSendInputState = () => {
    setRecipientInput('');
    setAmountInput('');
    setSendMemoInput('');
    setShowRecentSendDropdown(false);
    setSendDraft(null);
    setSendIsProcessing(false);
    setSendIsDone(false);
    setTxDetailData(null);
    setTxDetailHeaderMode('history');
    setAuthPasswordInput('');
    setAuthErrorMessage('');
    setSendGasSettings({ ...DEFAULT_SEND_GAS_SETTINGS });
  };

  const resetNftSendState = () => {
    setNftSendRecipientInput('');
    setNftSendMemoInput('');
    setNftSendRecipientTouched(false);
    setNftSendRecipientFocused(false);
    setShowNftRecentSendDropdown(false);
    setNftSendCollectibleId((prev) => {
      if (prev && collectibles.some((item) => item.id === prev && item.owned > 0)) return prev;
      return collectibles.find((item) => item.owned > 0)?.id ?? null;
    });
  };

  const resetNftReceiveState = () => {
    setReceiveNftChainFilter('ALL');
  };

  const resetAddressBookFormState = (scope: AddressBookScope = addressBookScope) => {
    setShowAddressBookEditModal(false);
    setAddressEditTargetId(null);
    setAddressEditChain('ETH');
    setAddressEditAssetKey(chainNativeAssetMap.ETH);
    setAddressEditLabelInput('');
    setAddressEditValueInput('');
    setAddressLabelInput('');
    setAddressValueInput('');
    setAddressBookChainFilter('ALL');
    setAddressBookAssetFilter('ALL');
    setAddressBookDateFilter('ALL');
    setAddressBookPage(1);
    if (scope === 'nft') {
      const nftChain = normalizeChainCode(selectedNftForSend?.network ?? collectibles[0]?.network ?? '') ?? 'ETH';
      setAddressFormChain(nftChain);
      setAddressFormAssetKey(chainNativeAssetMap[nftChain]);
      return;
    }
    const firstToken = tokens[0];
    if (!firstToken) return;
    setAddressFormChain(firstToken.chainCode);
    setAddressFormAssetKey(chainNativeAssetMap[firstToken.chainCode]);
  };

  const resetWalletSettingsAuthState = () => {
    setWalletSettingsAuthInput('');
    setWalletSettingsAuthError('');
  };

  const applyEntryResets = (screen: Screen) => {
    if (screen === 'send') {
      if (skipNextSendResetRef.current) skipNextSendResetRef.current = false;
      else resetSendFilterSelection();
      resetSendValidationState();
      resetSendInputState();
      return;
    }
    if (screen === 'receive') {
      if (skipNextReceiveResetRef.current) skipNextReceiveResetRef.current = false;
      else resetReceiveFilterSelection();
      return;
    }
    if (screen === 'nftSend') {
      resetNftSendState();
      return;
    }
    if (screen === 'nftReceive') {
      resetNftReceiveState();
      return;
    }
    if (screen === 'history') {
      if (skipNextHistoryResetRef.current) skipNextHistoryResetRef.current = false;
      else resetHistoryFilterSelection();
      return;
    }
    if (screen === 'discoverPopularRanking') {
      setDiscoverPopularPage(1);
      return;
    }
    if (screen === 'discoverWatchlist' || screen === 'discoverFavorite') {
      setDiscoverWatchlistPage(1);
      return;
    }
    if (screen === 'discoverBriefingBoard') {
      setDiscoverBriefingWeekKey(null);
      setDiscoverBriefingExpandedId(null);
      return;
    }
    if (screen === 'addressBook') {
      resetAddressBookFormState(addressBookScopeRef.current);
      return;
    }
    if (screen === 'settingsWalletsAuth') {
      resetWalletSettingsAuthState();
      return;
    }
    if (screen === 'settingsDappSecurity') {
      setDiscoverTrustedEditId(null);
      setDiscoverTrustedHostInput('');
      setDiscoverTrustedHostMemoInput('');
      setBannerMessage('');
    }
  };

  useEffect(() => {
    if (!bannerMessage) return;

    if (toastHideTimerRef.current) {
      clearTimeout(toastHideTimerRef.current);
      toastHideTimerRef.current = null;
    }

    setToastMessage(bannerMessage);
    toastTranslateY.setValue(-22);
    toastOpacity.setValue(0);
    const toastQuadEasingBase =
      typeof (Easing as unknown as { quad?: unknown }).quad === 'function'
        ? (Easing as unknown as { quad: (value: number) => number }).quad
        : Easing.cubic;

    Animated.parallel([
      Animated.timing(toastTranslateY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(toastQuadEasingBase),
        useNativeDriver: true
      })
    ]).start();

    toastHideTimerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastTranslateY, {
          toValue: -22,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(toastQuadEasingBase),
          useNativeDriver: true
        })
      ]).start(() => {
        setToastMessage('');
      });
      setBannerMessage('');
      toastHideTimerRef.current = null;
    }, 1400);
  }, [bannerMessage, toastOpacity, toastTranslateY]);

  useEffect(
    () => () => {
      if (toastHideTimerRef.current) {
        clearTimeout(toastHideTimerRef.current);
        toastHideTimerRef.current = null;
      }
      if (supportReplyTimerRef.current) {
        clearTimeout(supportReplyTimerRef.current);
        supportReplyTimerRef.current = null;
      }
    },
    [supportReplyTimerRef]
  );

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onKeyboardShow = (event: KeyboardEvent) => {
      setIsKeyboardVisible(true);
      const nextHeight = Math.max(0, Math.round(event?.endCoordinates?.height ?? 0));
      setKeyboardHeight(nextHeight);
    };
    const onKeyboardHide = () => {
      setIsKeyboardVisible(false);
      setKeyboardHeight(0);
    };
    const showSub = Keyboard.addListener(showEvent, onKeyboardShow);
    const hideSub = Keyboard.addListener(hideEvent, onKeyboardHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const isBottomSheetVisible =
    Boolean(discoverSecurityPrompt) ||
    showRecipientBookModal ||
    showAddressBookEditModal ||
    showSaveRecipientModal ||
    showScanMethodModal ||
    showHomeAssetLayoutModal ||
    showHistoryDateRangeModal ||
    showHistoryDateCalendarModal;

  useEffect(() => {
    if (!isBottomSheetVisible) {
      bottomSheetAnim.setValue(0);
      return;
    }
    bottomSheetAnim.setValue(0);
    Animated.timing(bottomSheetAnim, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [isBottomSheetVisible, bottomSheetAnim]);

  useEffect(() => {
    if (!showWalletMenu) {
      walletMenuAnim.setValue(0);
      return;
    }
    walletMenuAnim.setValue(0);
    Animated.timing(walletMenuAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [showWalletMenu, walletMenuAnim]);

  useEffect(() => {
    if (!showWalletMenu) return;
    measureWalletMenuAnchor();
  }, [showWalletMenu, measureWalletMenuAnchor]);

  useEffect(() => {
    if (!showHomeAssetLayoutModal) return;
    measureHomeLayoutTriggerAnchor();
  }, [showHomeAssetLayoutModal, measureHomeLayoutTriggerAnchor]);

  useEffect(() => {
    if (!(showScanMethodModal && scanEntryPoint === 'home')) return;
    measureHomeScanTriggerAnchor();
  }, [showScanMethodModal, scanEntryPoint, measureHomeScanTriggerAnchor]);

  useEffect(() => {
    if (!showHistoryDateRangeModal) return;
    measureHistoryRangeTriggerAnchor();
  }, [showHistoryDateRangeModal, measureHistoryRangeTriggerAnchor]);

  useEffect(() => {
    if (!(showLangMenu && currentScreen === 'settings')) return;
    measureSettingsLangTriggerAnchor();
  }, [showLangMenu, currentScreen, measureSettingsLangTriggerAnchor]);

  useEffect(() => {
    if (!(showAutoLockMenu && currentScreen === 'settingsSecurity')) return;
    measureSecurityAutoLockTriggerAnchor();
  }, [showAutoLockMenu, currentScreen, measureSecurityAutoLockTriggerAnchor]);

  useEffect(() => {
    if (!(showLockMethodMenu && currentScreen === 'settingsSecurity')) return;
    measureSecurityLockMethodTriggerAnchor();
  }, [showLockMethodMenu, currentScreen, measureSecurityLockMethodTriggerAnchor]);

  useEffect(() => {
    if (!(showBiometricTypeMenu && currentScreen === 'settingsSecurity')) return;
    measureSecurityBiometricTypeTriggerAnchor();
  }, [showBiometricTypeMenu, currentScreen, measureSecurityBiometricTypeTriggerAnchor]);

  useEffect(() => {
    if (!(showDiscoverBriefingWeekMenu && currentScreen === 'discoverBriefingBoard')) return;
    measureDiscoverBriefingWeekTriggerAnchor();
  }, [showDiscoverBriefingWeekMenu, currentScreen, measureDiscoverBriefingWeekTriggerAnchor]);

  useEffect(() => {
    if (!showRecentSendDropdown) {
      recentSendDropdownAnim.setValue(0);
      return;
    }
    recentSendDropdownAnim.setValue(0);
    Animated.timing(recentSendDropdownAnim, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [showRecentSendDropdown, recentSendDropdownAnim]);

  useEffect(() => {
    if (!showNftRecentSendDropdown) {
      nftRecentSendDropdownAnim.setValue(0);
      return;
    }
    nftRecentSendDropdownAnim.setValue(0);
    Animated.timing(nftRecentSendDropdownAnim, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [showNftRecentSendDropdown, nftRecentSendDropdownAnim]);

  useEffect(() => {
    if (!showDiscoverBriefingWeekMenu) {
      discoverBriefingWeekMenuAnim.setValue(0);
      return;
    }
    discoverBriefingWeekMenuAnim.setValue(0);
    Animated.timing(discoverBriefingWeekMenuAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [showDiscoverBriefingWeekMenu, discoverBriefingWeekMenuAnim]);

  useEffect(() => {
    if (!showLangMenu) {
      langMenuAnim.setValue(0);
      return;
    }
    langMenuAnim.setValue(0);
    Animated.timing(langMenuAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [showLangMenu, langMenuAnim]);

  useEffect(() => {
    if (!showAutoLockMenu) {
      autoLockMenuAnim.setValue(0);
      return;
    }
    autoLockMenuAnim.setValue(0);
    Animated.timing(autoLockMenuAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [showAutoLockMenu, autoLockMenuAnim]);

  useEffect(() => {
    if (!showLockMethodMenu) {
      lockMethodMenuAnim.setValue(0);
      return;
    }
    lockMethodMenuAnim.setValue(0);
    Animated.timing(lockMethodMenuAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [showLockMethodMenu, lockMethodMenuAnim]);

  useEffect(() => {
    if (!showBiometricTypeMenu) {
      biometricTypeMenuAnim.setValue(0);
      return;
    }
    biometricTypeMenuAnim.setValue(0);
    Animated.timing(biometricTypeMenuAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [showBiometricTypeMenu, biometricTypeMenuAnim]);

  useEffect(() => {
    Animated.timing(segmentAnim, {
      toValue: walletSegment === 'crypto' ? 0 : 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [walletSegment, segmentAnim]);

  useEffect(() => {
    Animated.timing(settingThemeAnim, {
      toValue: themeMode === 'light' ? 0 : 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false
    }).start(({ finished }) => {
      if (finished) settingThemeAnim.setValue(themeMode === 'light' ? 0 : 1);
    });
  }, [themeMode, settingThemeAnim]);

  const modalCardAnimatedStyle = useMemo(
    () => ({
      opacity: bottomSheetAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1]
      }),
      transform: [
        {
          translateY: bottomSheetAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [36, 0]
          })
        },
        {
          scale: bottomSheetAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.985, 1]
          })
        }
      ]
    }),
    [bottomSheetAnim]
  );

  const walletMenuAnimatedStyle = useMemo(
    () => ({
      opacity: walletMenuAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1]
      }),
      transform: [
        {
          translateY: walletMenuAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [-10, 0]
          })
        },
        {
          scaleY: walletMenuAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.92, 1]
          })
        }
      ]
    }),
    [walletMenuAnim]
  );

  const recentSendDropdownAnimatedStyle = useMemo(
    () => ({
      opacity: recentSendDropdownAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1]
      }),
      transform: [
        {
          translateY: recentSendDropdownAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [36, 0]
          })
        },
        {
          scale: recentSendDropdownAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.985, 1]
          })
        }
      ]
    }),
    [recentSendDropdownAnim]
  );

  const nftRecentSendDropdownAnimatedStyle = useMemo(
    () => ({
      opacity: nftRecentSendDropdownAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1]
      }),
      transform: [
        {
          translateY: nftRecentSendDropdownAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [36, 0]
          })
        },
        {
          scale: nftRecentSendDropdownAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.985, 1]
          })
        }
      ]
    }),
    [nftRecentSendDropdownAnim]
  );

  const discoverBriefingWeekMenuAnimatedStyle = useMemo(
    () => ({
      opacity: discoverBriefingWeekMenuAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1]
      }),
      transform: [
        {
          translateY: discoverBriefingWeekMenuAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [-8, 0]
          })
        },
        {
          scaleY: discoverBriefingWeekMenuAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.92, 1]
          })
        }
      ]
    }),
    [discoverBriefingWeekMenuAnim]
  );

  const langMenuAnimatedStyle = useMemo(
    () => ({
      opacity: langMenuAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1]
      }),
      transform: [
        {
          translateY: langMenuAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [-8, 0]
          })
        },
        {
          scaleY: langMenuAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.92, 1]
          })
        }
      ]
    }),
    [langMenuAnim]
  );

  const autoLockMenuAnimatedStyle = useMemo(
    () => ({
      opacity: autoLockMenuAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1]
      }),
      transform: [
        {
          translateY: autoLockMenuAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [-8, 0]
          })
        },
        {
          scaleY: autoLockMenuAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.92, 1]
          })
        }
      ]
    }),
    [autoLockMenuAnim]
  );

  const lockMethodMenuAnimatedStyle = useMemo(
    () => ({
      opacity: lockMethodMenuAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1]
      }),
      transform: [
        {
          translateY: lockMethodMenuAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [-8, 0]
          })
        },
        {
          scaleY: lockMethodMenuAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.92, 1]
          })
        }
      ]
    }),
    [lockMethodMenuAnim]
  );

  const biometricTypeMenuAnimatedStyle = useMemo(
    () => ({
      opacity: biometricTypeMenuAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1]
      }),
      transform: [
        {
          translateY: biometricTypeMenuAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [-8, 0]
          })
        },
        {
          scaleY: biometricTypeMenuAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.92, 1]
          })
        }
      ]
    }),
    [biometricTypeMenuAnim]
  );

  const segmentIndicatorStyle = useMemo(() => {
    const innerWidth = Math.max(segmentTrackWidth - 4, 0);
    const indicatorWidth = segmentLayout.firstWidth > 0 ? segmentLayout.firstWidth : Math.max(innerWidth / 2, 0);
    const maxTranslate =
      segmentLayout.firstWidth > 0 ? Math.max(segmentLayout.secondX - segmentLayout.firstX, 0) : Math.max(innerWidth - indicatorWidth, 0);
    return {
      width: indicatorWidth,
      transform: [
        {
          translateX: segmentAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, maxTranslate]
          })
        }
      ]
    };
  }, [segmentAnim, segmentTrackWidth, segmentLayout]);

  const settingThemeIndicatorStyle = useMemo(() => {
    const indicatorWidth = settingThemeLayout.firstWidth > 0 ? settingThemeLayout.firstWidth : THEME_SWITCH_PILL_WIDTH;
    const startX = settingThemeLayout.firstX;
    const endX = Math.max(settingThemeLayout.secondX - THEME_SWITCH_INSET, startX);
    return {
      width: indicatorWidth,
      left: settingThemeAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [startX, endX]
      })
    };
  }, [settingThemeAnim, settingThemeLayout]);

  useEffect(() => {
    if (!walletAccounts.length) return;
    if (!walletAccounts.some((item) => item.id === walletId)) {
      setWalletId(walletAccounts[0].id);
    }
  }, [walletAccounts, walletId, setWalletId]);

  useEffect(() => {
    if (!walletAccounts.length) return;
    setWalletSeedMap((prev) => {
      let changed = false;
      const next: Record<string, string[]> = {};

      walletAccounts.forEach((wallet) => {
        const existing = prev[wallet.id];
        if (Array.isArray(existing)) {
          const normalized = normalizeSeedWords(existing.map((word) => String(word ?? '')));
          if (isValidRecoverySeedWords(normalized)) {
            next[wallet.id] = normalized;
            return;
          }
        }
        if (prev[wallet.id]) changed = true;
      });

      if (Object.keys(prev).some((walletKey) => !next[walletKey])) changed = true;
      return changed ? next : prev;
    });
  }, [walletAccounts]);

  useEffect(() => {
    if (!walletAccounts.length) return;
    setWalletSeedPassphraseMap((prev) => {
      let changed = false;
      const next: Record<string, string> = {};

      walletAccounts.forEach((wallet) => {
        if (typeof prev[wallet.id] === 'string') {
          next[wallet.id] = prev[wallet.id];
          return;
        }
        changed = true;
        next[wallet.id] = '';
      });

      if (Object.keys(prev).some((walletKey) => !next[walletKey])) changed = true;
      return changed ? next : prev;
    });
  }, [walletAccounts]);

  useEffect(() => {
    if (!walletAccounts.length) return;
    setWalletAccountIndexMap((prev) => {
      let changed = false;
      const next: Record<string, number> = {};

      walletAccounts.forEach((wallet) => {
        if (typeof prev[wallet.id] === 'number' && Number.isFinite(prev[wallet.id])) {
          next[wallet.id] = normalizeAccountIndex(prev[wallet.id]);
          return;
        }
        changed = true;
        next[wallet.id] = 0;
      });

      if (Object.keys(prev).some((walletKey) => next[walletKey] === undefined)) changed = true;
      return changed ? next : prev;
    });
  }, [walletAccounts]);

  useEffect(() => {
    if (!Object.keys(marketPrices).length) return;

    setTokens((prev) => {
      let changed = false;
      const next = prev.map((token) => {
        const updated = applyMarketPriceToToken(token, marketPrices);
        if (updated !== token) changed = true;
        return updated;
      });
      return changed ? next : prev;
    });
  }, [marketPrices]);

  useEffect(() => {
    setTokens((prev) => {
      const idKey = (items: { id: string }[]) => items.map((item) => item.id).join('|');
      if (idKey(prev) === enabledTokenIds.join('|')) return prev;

      const prevById = new Map(prev.map((item) => [item.id, item]));
      const next: WalletToken[] = [];

      enabledTokenIds.forEach((tokenId) => {
        const existing = prevById.get(tokenId);
        if (existing) {
          next.push(existing);
          return;
        }

        const catalogToken = tokenCatalog.find((item) => item.id === tokenId);
        if (catalogToken) {
          next.push(applyMarketPriceToToken(cloneToken(catalogToken), marketPrices));
        }
      });

      return sortByCatalogOrder(next);
    });
  }, [enabledTokenIds, marketPrices]);

  useEffect(() => {
    if (!activeWalletChainAddresses) return;
    setTokens((prev) => {
      let changed = false;
      const next = prev.map((token) => {
        const nextAddress = activeWalletChainAddresses[token.chainCode] || token.walletAddress;
        if (nextAddress === token.walletAddress) return token;
        changed = true;
        return {
          ...token,
          walletAddress: nextAddress
        };
      });
      return changed ? next : prev;
    });
  }, [activeWalletChainAddresses]);

  useEffect(() => {
    if (!walletStoreHydrated || !walletAccounts.length) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const refresh = async () => {
      try {
        const snapshot = await fetchOnchainBalances(activeWalletChainAddresses);
        if (cancelled) return;

        setTokens((prev) => {
          let changed = false;
          const next = prev.map((token) => {
            let nextBalance = token.balance;

            if (token.assetKey === 'USDT') {
              if (token.chainCode === 'ETH') nextBalance = snapshot.usdtByChain.ETH ?? 0;
              if (token.chainCode === 'BSC') nextBalance = snapshot.usdtByChain.BSC ?? 0;
              if (token.chainCode === 'TRX') nextBalance = snapshot.usdtByChain.TRX ?? 0;
            } else {
              nextBalance = snapshot.nativeByChain[token.chainCode] ?? 0;
            }

            if (!Number.isFinite(nextBalance)) nextBalance = 0;
            if (Math.abs(nextBalance - token.balance) < 0.0000000001) return token;
            changed = true;
            return {
              ...token,
              balance: nextBalance
            };
          });
          return changed ? next : prev;
        });
      } catch (error) {
        if (!cancelled) {
          trackError('wallet.onchain_balance.refresh_failed', error, {
            walletId,
            platform: Platform.OS
          });
        }
      } finally {
        if (cancelled) return;
        timer = setTimeout(() => {
          void refresh();
        }, ONCHAIN_BALANCE_REFRESH_MS);
      }
    };

    void refresh();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [walletStoreHydrated, walletAccounts.length, activeWalletChainAddresses, walletId]);

  useEffect(() => {
    if (!walletStoreHydrated || !walletAccounts.length) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const refresh = async () => {
      try {
        const targets = initialCollectibles.flatMap((item) => {
          const chain = normalizeChainCode(item.network);
          if (chain !== 'ETH' && chain !== 'BSC' && chain !== 'SOL' && chain !== 'TRX') return [];
          return [
            {
              id: item.id,
              chain,
              contractAddress: item.contractAddress,
              tokenId: item.tokenId
            }
          ];
        });

        if (!targets.length) {
          if (!cancelled) {
            setCollectibles((prev) => prev.map((item) => (item.owned === 0 ? item : { ...item, owned: 0 })));
          }
          return;
        }

        const snapshot = await fetchOnchainNftOwnership({
          addressByChain: {
            ETH: activeWalletChainAddresses.ETH,
            BSC: activeWalletChainAddresses.BSC,
            SOL: activeWalletChainAddresses.SOL,
            TRX: activeWalletChainAddresses.TRX
          },
          targets
        });
        if (cancelled) return;

        setCollectibles((prev) => {
          let changed = false;
          const next = prev.map((item) => {
            const nextOwnedRaw = snapshot.ownedById[item.id];
            if (typeof nextOwnedRaw !== 'number') return item;
            const nextOwned = Math.max(0, Math.floor(nextOwnedRaw));
            if (nextOwned === item.owned) return item;
            changed = true;
            return {
              ...item,
              owned: nextOwned
            };
          });
          return changed ? next : prev;
        });
      } catch (error) {
        if (!cancelled) {
          trackError('wallet.onchain_nft.refresh_failed', error, {
            walletId,
            platform: Platform.OS
          });
        }
      } finally {
        if (cancelled) return;
        timer = setTimeout(() => {
          void refresh();
        }, ONCHAIN_NFT_REFRESH_MS);
      }
    };

    void refresh();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [walletStoreHydrated, walletAccounts.length, activeWalletChainAddresses, walletId]);

  useEffect(() => {
    if (!tokens.length) return;
    if (!tokens.some((token) => token.chainCode === sendChainCode)) {
      setSendChainCode(tokens[0].chainCode);
    }
    if (!tokens.some((token) => token.chainCode === receiveChainCode)) {
      setReceiveChainCode(tokens[0].chainCode);
    }
    if (!tokens.some((token) => token.chainCode === addressFormChain)) {
      setAddressFormChain(tokens[0].chainCode);
    }
  }, [tokens, sendChainCode, receiveChainCode, addressFormChain]);

  useEffect(() => {
    const target = tokens.find((token) => token.chainCode === sendChainCode);
    if (target && !tokens.some((token) => token.id === sendTokenId && token.chainCode === sendChainCode)) {
      setSendTokenId(target.id);
    }
  }, [tokens, sendChainCode, sendTokenId]);

  useEffect(() => {
    if (sendChainFilter === 'ALL') {
      if (sendAssetFilterTokenId !== 'ALL') setSendAssetFilterTokenId('ALL');
      return;
    }
    if (sendAssetFilterTokenId === 'ALL') return;
    if (!sendAssetOptions.some((token) => token.id === sendAssetFilterTokenId)) {
      setSendAssetFilterTokenId('ALL');
    }
  }, [sendChainFilter, sendAssetFilterTokenId, sendAssetOptions]);

  useEffect(() => {
    setShowRecentSendDropdown(false);
  }, [sendChainFilter, sendAssetFilterTokenId]);

  useEffect(() => {
    setShowNftRecentSendDropdown(false);
  }, [nftSendCollectibleId]);

  useEffect(() => {
    const target = tokens.find((token) => token.chainCode === receiveChainCode);
    if (target && !tokens.some((token) => token.id === receiveTokenId && token.chainCode === receiveChainCode)) {
      setReceiveTokenId(target.id);
    }
  }, [tokens, receiveChainCode, receiveTokenId]);

  useEffect(() => {
    if (receiveChainFilter === 'ALL') {
      if (receiveAssetFilterTokenId !== 'ALL') setReceiveAssetFilterTokenId('ALL');
      return;
    }
    if (receiveAssetFilterTokenId === 'ALL') return;
    if (!receiveAssetOptions.some((token) => token.id === receiveAssetFilterTokenId)) {
      setReceiveAssetFilterTokenId('ALL');
    }
  }, [receiveChainFilter, receiveAssetFilterTokenId, receiveAssetOptions]);

  useEffect(() => {
    if (receiveNftChainFilter === 'ALL') return;
    if (!nftReceiveChainOptions.includes(receiveNftChainFilter)) {
      setReceiveNftChainFilter('ALL');
    }
  }, [receiveNftChainFilter, nftReceiveChainOptions]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const id = 'imwallet-hide-scrollbars-v5';
    const existing = document.getElementById(id) as HTMLStyleElement | null;
    const style = existing ?? document.createElement('style');
    style.id = id;
    style.textContent = `
      html, body, #root {
        height: 100%;
        overflow: hidden;
        margin: 0;
        -webkit-text-size-adjust: 100%;
        text-size-adjust: 100%;
      }
      body, #root, * {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Apple SD Gothic Neo", "PingFang SC", "Noto Sans KR", sans-serif;
      }
      input, textarea {
        outline: none !important;
        box-shadow: none !important;
      }
      input:focus, textarea:focus {
        outline: none !important;
        box-shadow: none !important;
        border-color: ${palette.accent} !important;
      }
      input:focus-visible, textarea:focus-visible {
        outline: none !important;
        box-shadow: none !important;
        border-color: ${palette.accent} !important;
      }
      input:active, textarea:active {
        outline: none !important;
        box-shadow: none !important;
        border-color: ${palette.accent} !important;
      }
      input::-moz-focus-inner, textarea::-moz-focus-inner {
        border: 0 !important;
      }
      * { scrollbar-width: none !important; -ms-overflow-style: none !important; }
      *::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; }
    `;
    if (!existing) document.head.appendChild(style);
  }, [palette.accent]);

  useEffect(() => {
    if (currentScreen === 'nftSend') {
      const run = () => {
        nftSendScrollRef.current?.scrollTo({ y: 0, animated: false });
      };
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => requestAnimationFrame(run));
      } else {
        setTimeout(run, 0);
      }
      return;
    }
    if (currentScreen === 'nftReceive') {
      const run = () => {
        nftReceiveScrollRef.current?.scrollTo({ y: 0, animated: false });
      };
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => requestAnimationFrame(run));
      } else {
        setTimeout(run, 0);
      }
      return;
    }
    if (currentScreen === 'nftDetail') {
      const run = () => {
        nftDetailScrollRef.current?.scrollTo({ y: 0, animated: false });
      };
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => requestAnimationFrame(run));
      } else {
        setTimeout(run, 0);
      }
    }
  }, [currentScreen]);

  const navigate = (screen: Screen) => {
    setShowLangMenu(false);
    setShowWalletMenu(false);
    setShowDiscoverBriefingWeekMenu(false);
    setDiscoverSecurityPrompt(null);
    setShowHomeAssetLayoutModal(false);
    setShowRecipientBookModal(false);
    setShowSaveRecipientModal(false);
    setShowAddressBookEditModal(false);
    setShowScanMethodModal(false);
    setShowHistoryDateRangeModal(false);
    setShowHistoryDateCalendarModal(false);
    setShowRecentSendDropdown(false);
    setShowNftRecentSendDropdown(false);
    setShowAutoLockMenu(false);
    setShowLockMethodMenu(false);
    setShowBiometricTypeMenu(false);
    applyEntryResets(screen);
    setStack((prev) => [...prev, screen]);
  };

  const replaceTopScreen = (screen: Screen) => {
    setShowLangMenu(false);
    setShowWalletMenu(false);
    setShowDiscoverBriefingWeekMenu(false);
    setDiscoverSecurityPrompt(null);
    setShowHomeAssetLayoutModal(false);
    setShowRecipientBookModal(false);
    setShowSaveRecipientModal(false);
    setShowAddressBookEditModal(false);
    setShowScanMethodModal(false);
    setShowHistoryDateRangeModal(false);
    setShowHistoryDateCalendarModal(false);
    setShowRecentSendDropdown(false);
    setShowNftRecentSendDropdown(false);
    setShowAutoLockMenu(false);
    setShowLockMethodMenu(false);
    setShowBiometricTypeMenu(false);
    applyEntryResets(screen);
    setStack((prev) => (prev.length > 0 ? [...prev.slice(0, -1), screen] : [screen]));
  };

  const goBack = () => {
    setShowLangMenu(false);
    setShowWalletMenu(false);
    setShowDiscoverBriefingWeekMenu(false);
    setDiscoverSecurityPrompt(null);
    setShowHomeAssetLayoutModal(false);
    setShowRecipientBookModal(false);
    setShowSaveRecipientModal(false);
    setShowAddressBookEditModal(false);
    setShowScanMethodModal(false);
    setShowHistoryDateRangeModal(false);
    setShowHistoryDateCalendarModal(false);
    setShowCameraScanner(false);
    setShowRecentSendDropdown(false);
    setShowNftRecentSendDropdown(false);
    setShowAutoLockMenu(false);
    setShowLockMethodMenu(false);
    setShowBiometricTypeMenu(false);
    if (currentScreen === 'send') {
      resetSendValidationState();
      resetSendInputState();
    }

    const fallbackRoot: Screen = hasWallet ? 'home' : 'noWalletHome';
    let nextStack: Screen[];
    if (stack.length > 1) {
      const prevScreen = stack[stack.length - 2];
      const isSendNftFilterPair =
        (currentScreen === 'send' && prevScreen === 'nftSend') ||
        (currentScreen === 'nftSend' && prevScreen === 'send');
      const isReceiveNftFilterPair =
        (currentScreen === 'receive' && prevScreen === 'nftReceive') ||
        (currentScreen === 'nftReceive' && prevScreen === 'receive');
      if (isSendNftFilterPair || isReceiveNftFilterPair) {
        nextStack = stack.slice(0, -2);
        if (!nextStack.length) nextStack = [fallbackRoot];
      } else {
        nextStack = stack.slice(0, -1);
      }
    } else {
      const root = stack[0];
      nextStack = root !== fallbackRoot ? [fallbackRoot] : stack;
    }
    const nextScreen = nextStack[nextStack.length - 1];
    if (nextScreen && nextScreen !== currentScreen) {
      applyEntryResets(nextScreen);
    }
    setStack(nextStack);
  };

  const openRoot = (screen: Screen) => {
    setShowLangMenu(false);
    setShowWalletMenu(false);
    setShowDiscoverBriefingWeekMenu(false);
    setDiscoverSecurityPrompt(null);
    setShowHomeAssetLayoutModal(false);
    setShowRecipientBookModal(false);
    setShowSaveRecipientModal(false);
    setShowAddressBookEditModal(false);
    setShowScanMethodModal(false);
    setShowHistoryDateRangeModal(false);
    setShowHistoryDateCalendarModal(false);
    setShowCameraScanner(false);
    setShowRecentSendDropdown(false);
    setShowNftRecentSendDropdown(false);
    setShowAutoLockMenu(false);
    setShowLockMethodMenu(false);
    setShowBiometricTypeMenu(false);
    applyEntryResets(screen);
    setStack([screen]);
  };

  const updateSeedWordAt = (index: number, rawText: string) => {
    const normalized = rawText.trim().toLowerCase();
    const splitWords = normalized.split(/\s+/).filter(Boolean);
    setRecoveryIndexScanResult(null);
    setSeedWords((prev) => {
      const next = [...prev];
      if (splitWords.length <= 1) {
        next[index] = normalized;
        return next;
      }
      splitWords.slice(0, Math.max(0, prev.length - index)).forEach((word, offset) => {
        next[index + offset] = word;
      });
      return next;
    });
  };

  const updateRecoveryWordCount = (wordCount: RecoveryWordCount) => {
    setRecoveryWordCount(wordCount);
    setRecoveryIndexScanResult(null);
    setSeedWords((prev) => {
      const next = createEmptySeedWords(wordCount);
      for (let i = 0; i < Math.min(prev.length, next.length); i += 1) {
        next[i] = prev[i] ?? '';
      }
      return next;
    });
  };

  const clearSeedWords = (wordCount: number = recoveryWordCount) => setSeedWords(createEmptySeedWords(wordCount));
  const clearDeleteSeedWords = (wordCount: number = expectedDeleteSeedWordCount) =>
    setDeleteSeedWords(wordCount > 0 ? createEmptySeedWords(wordCount) : []);

  const updateDeleteSeedWordAt = (index: number, rawText: string) => {
    const normalized = rawText.trim().toLowerCase();
    const splitWords = normalized.split(/\s+/).filter(Boolean);
    setDeleteSeedWords((prev) => {
      const next = [...prev];
      if (splitWords.length <= 1) {
        next[index] = normalized;
        return next;
      }
      splitWords.slice(0, Math.max(0, prev.length - index)).forEach((word, offset) => {
        next[index + offset] = word;
      });
      return next;
    });
  };

  const seedPhraseJoined = seedWords.map((word) => word.trim()).join(' ').trim();
  const currentSeedWordCount = toRecoveryWordCount(seedWords.length);
  const normalizedSeedPassphrase = seedPassphraseInput.normalize('NFKD');
  const normalizedSeedAccountIndex = normalizeAccountIndex(Number(seedAccountIndexInput || '0'));
  const selectedOnboardingChainCode = resolveOnboardingNetworkChainCode(selectedNetwork);
  const isSeedWordsComplete = seedWords.every((word) => word.trim().length > 0);
  const isSeedWordsBip39Valid = isValidRecoverySeedWords(seedWords);
  const normalizedEnteredSeedWords = normalizeSeedWords(seedWords);
  const normalizedOnboardingSeedWords = normalizeSeedWords(onboardingSeedWords);
  const isOnboardingSeedMatch =
    normalizedEnteredSeedWords.length === normalizedOnboardingSeedWords.length &&
    normalizedEnteredSeedWords.every((word, index) => word === normalizedOnboardingSeedWords[index]);
  const invalidSeedPhraseMessage =
    lang === 'ko' ? '유효한 시드 구문을 입력해주세요.' : lang === 'zh' ? '请输入有效的助记词。' : 'Enter a valid recovery phrase.';
  const seedPhraseMismatchMessage =
    lang === 'ko'
      ? '표시된 시드 구문과 입력한 내용이 다릅니다.'
      : lang === 'zh'
        ? '输入的助记词与显示内容不一致。'
        : 'Entered phrase does not match the shown phrase.';

  const scanRecoveryIndexForSelectedNetwork = async () => {
    if (recoveryIndexScanLoading) return;
    if (!isSeedWordsBip39Valid) {
      setBannerMessage(invalidSeedPhraseMessage);
      return;
    }
    setRecoveryIndexScanLoading(true);
    try {
      const result = await scanRecoveryAccountIndex({
        words: normalizeSeedWords(seedWords),
        passphrase: normalizedSeedPassphrase,
        chain: selectedOnboardingChainCode,
        maxIndex: 20
      });
      setRecoveryIndexScanResult(result);
      setSeedAccountIndexInput(String(result.bestIndex));
      if (result.bestActivity > 0) {
        const foundMessage =
          lang === 'ko'
            ? `${selectedNetwork} 활동 내역 기준 계정 인덱스 ${result.bestIndex}를 찾았습니다.`
            : lang === 'zh'
              ? `已按 ${selectedNetwork} 链上活动自动定位到账户索引 ${result.bestIndex}。`
              : `Auto-detected account index ${result.bestIndex} from ${selectedNetwork} activity.`;
        setBannerMessage(foundMessage);
      } else {
        const fallbackMessage =
          lang === 'ko'
            ? `${selectedNetwork} 활동 내역이 없어 기본 인덱스(0)를 권장합니다.`
            : lang === 'zh'
              ? `${selectedNetwork} 暂无链上活动，建议使用默认索引 0。`
              : `No ${selectedNetwork} activity found. Default index 0 is recommended.`;
        setBannerMessage(fallbackMessage);
      }
    } catch (error) {
      trackError('recovery.account_index_scan_failed', error, {
        chain: selectedOnboardingChainCode
      });
      const failedMessage =
        lang === 'ko'
          ? '계정 인덱스 자동 탐색에 실패했습니다. 잠시 후 다시 시도해주세요.'
          : lang === 'zh'
            ? '账户索引自动扫描失败，请稍后重试。'
            : 'Account-index auto scan failed. Please try again.';
      setBannerMessage(failedMessage);
    } finally {
      setRecoveryIndexScanLoading(false);
    }
  };

  const seedInputWebStyle = useMemo(
    () =>
      Platform.OS === 'web'
        ? ({
            outlineStyle: 'none',
            outlineWidth: 0,
            boxShadow: 'none'
          } as any)
        : undefined,
    []
  );

  const startCreateWalletFlow = (options?: { root?: boolean }) => {
    let nextOnboardingSeedWords: string[];
    try {
      nextOnboardingSeedWords = safeGenerateRecoverySeedWords(DEFAULT_RECOVERY_WORD_COUNT);
    } catch (error) {
      const failedMessage =
        lang === 'ko'
          ? '시드 생성에 실패했습니다. 앱을 재시작한 뒤 다시 시도해주세요.'
          : lang === 'zh'
            ? '助记词生成失败。请重启应用后重试。'
            : 'Failed to generate recovery words. Restart the app and try again.';
      setBannerMessage(failedMessage);
      return;
    }
    setAgreeBackup(false);
    setAgreeNeverShare(false);
    setAgreeNoRecover(false);
    setOnboardingWalletName('');
    setPhraseInput('');
    setRecoveryWordCount(toRecoveryWordCount(nextOnboardingSeedWords.length));
    setSeedPassphraseInput('');
    setSeedAccountIndexInput('0');
    setSelectedNetwork('Ethereum');
    setRecoveryIndexScanResult(null);
    setRecoveryIndexScanLoading(false);
    setOnboardingSeedWords(nextOnboardingSeedWords);
    setPendingInitialCreateAfterPassword(false);
    setOnboardingDoneGoHomeOnly(false);
    clearSeedWords(nextOnboardingSeedWords.length);
    if (options?.root) {
      openRoot('onboardingCreateCheck');
      return;
    }
    navigate('onboardingCreateCheck');
  };

  const startAddExistingWalletFlow = (options?: { root?: boolean }) => {
    setOnboardingWalletName('');
    setPhraseInput('');
    setRecoveryWordCount(DEFAULT_RECOVERY_WORD_COUNT);
    setSeedPassphraseInput('');
    setSeedAccountIndexInput('0');
    setSelectedNetwork('Ethereum');
    setRecoveryIndexScanResult(null);
    setRecoveryIndexScanLoading(false);
    clearSeedWords(DEFAULT_RECOVERY_WORD_COUNT);
    setPendingInitialCreateAfterPassword(false);
    setOnboardingDoneGoHomeOnly(false);
    if (options?.root) {
      openRoot('onboardingAddExisting');
      return;
    }
    navigate('onboardingAddExisting');
  };

  const saveAppPassword = async (rawPassword: string, options?: { showSavedBanner?: boolean }) => {
    const normalized = normalizePassword(rawPassword);
    if (!isValidAppPassword(normalized)) {
      return false;
    }

    setSendPassword(normalized);
    persistedSendPasswordRef.current = normalized;
    await saveSecureValue(APP_PASSWORD_STORE_KEY, normalized);
    if (options?.showSavedBanner) setBannerMessage(flow.appPasswordSaved);
    return true;
  };

  const handleSecurityPasswordBlur = async () => {
    if (!isSecurityLoaded) return;
    const normalized = normalizePassword(sendPassword);
    if (!normalized) {
      if (persistedSendPasswordRef.current) setSendPassword(persistedSendPasswordRef.current);
      return;
    }
    if (!isValidAppPassword(normalized)) {
      setBannerMessage(flow.appPasswordInvalid);
      return;
    }
    if (normalized === persistedSendPasswordRef.current) return;
    const saved = await saveAppPassword(normalized, { showSavedBanner: true });
    if (!saved) return;
  };

  const submitOnboardingPasswordSetup = async (options?: { confirmPassword?: string }) => {
    const nextPassword = normalizePassword(onboardingPasswordInput);
    const confirmPassword = normalizePassword(options?.confirmPassword ?? onboardingPasswordConfirmInput);
    if (!isValidAppPassword(nextPassword)) {
      setOnboardingPasswordError(flow.appPasswordInvalid);
      return;
    }
    if (nextPassword !== confirmPassword) {
      setOnboardingPasswordError(flow.appPasswordMismatch);
      setOnboardingPasswordConfirmInput('');
      setOnboardingPasswordTarget('confirm');
      return;
    }

    const saved = await saveAppPassword(nextPassword, { showSavedBanner: true });
    if (!saved) {
      setOnboardingPasswordError(flow.appPasswordInvalid);
      return;
    }

    setOnboardingPasswordError('');
    setOnboardingPasswordInput('');
    setOnboardingPasswordConfirmInput('');
    setOnboardingPasswordTarget('password');
    setAppLocked(false);

    if (pendingInitialCreateAfterPassword) {
      setPendingInitialCreateAfterPassword(false);
      completeWalletCreateFlow({ target: 'onboardingCreateDone', doneGoHomeOnly: true });
      return;
    }

    openRoot('home');
  };

  const ensureBiometricModeAvailable = async (mode: Exclude<SendAuthMethod, 'password'>) => {
    if (Platform.OS === 'web') return true;
    if (mode === 'fingerprint' && !fingerprintBiometricSupported) {
      setBannerMessage(text.biometricFingerprintUnavailable);
      return false;
    }
    if (mode === 'face' && !faceBiometricSupported) {
      setBannerMessage(text.biometricFaceUnavailable);
      return false;
    }
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        setBannerMessage(text.biometricUnavailable);
        return false;
      }
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const irisType = (LocalAuthentication.AuthenticationType as { IRIS?: number }).IRIS;
      const supportsFace =
        supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) ||
        (typeof irisType === 'number' && supportedTypes.includes(irisType));
      if (mode === 'fingerprint' && !supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBannerMessage(text.biometricFingerprintUnavailable);
        return false;
      }
      if (mode === 'face' && !supportsFace) {
        setBannerMessage(text.biometricFaceUnavailable);
        return false;
      }
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!enrolled) {
        setBannerMessage(mode === 'fingerprint' ? text.biometricFingerprintNotEnrolled : text.biometricFaceNotEnrolled);
        return false;
      }
      return true;
    } catch {
      setBannerMessage(text.biometricUnavailable);
      return false;
    }
  };

  const authenticateWithBiometricMode = async (mode: SendAuthMethod, promptMessage: string) => {
    if (mode === 'password') return false;
    if (Platform.OS === 'web') return true;
    try {
      const available = await ensureBiometricModeAvailable(mode);
      if (!available) return false;
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: text.historyRangeCancel,
        fallbackLabel: flow.passwordMode,
        disableDeviceFallback: false
      });
      if (result.success) return true;
      if (result.error !== 'user_cancel' && result.error !== 'system_cancel') {
        setBannerMessage(flow.authInvalid);
      }
      return false;
    } catch {
      setBannerMessage(text.biometricUnavailable);
      return false;
    }
  };

  const openWalletSettingsWithAuth = async () => {
    if (!hasAppPassword) {
      navigate('settingsWallets');
      return;
    }
    if (Platform.OS !== 'web' && biometric && sendAuthMethod !== 'password') {
      const authenticated = await authenticateWithBiometricMode(sendAuthMethod, text.wallets);
      if (authenticated) {
        navigate('settingsWallets');
        return;
      }
    }
    setSettingsAuthTarget('wallets');
    setWalletSettingsAuthInput('');
    setWalletSettingsAuthError('');
    navigate('settingsWalletsAuth');
  };

  const openSecuritySettingsWithAuth = async () => {
    if (!hasAppPassword) {
      navigate('settingsSecurity');
      return;
    }
    if (Platform.OS !== 'web' && biometric && sendAuthMethod !== 'password') {
      const authenticated = await authenticateWithBiometricMode(sendAuthMethod, text.security);
      if (authenticated) {
        navigate('settingsSecurity');
        return;
      }
    }
    setSettingsAuthTarget('security');
    setWalletSettingsAuthInput('');
    setWalletSettingsAuthError('');
    navigate('settingsWalletsAuth');
  };

  const openAddressBookWithAuth = async () => {
    if (!hasAppPassword) {
      openAddressBookTypeSelect();
      return;
    }
    if (Platform.OS !== 'web' && biometric && sendAuthMethod !== 'password') {
      const authenticated = await authenticateWithBiometricMode(sendAuthMethod, extra.addressBookManage);
      if (authenticated) {
        openAddressBookTypeSelect();
        return;
      }
    }
    setSettingsAuthTarget('addressBook');
    setWalletSettingsAuthInput('');
    setWalletSettingsAuthError('');
    navigate('settingsWalletsAuth');
  };

  const openSettingsTargetAfterAuth = (target: 'security' | 'wallets' | 'addressBook') => {
    if (target === 'addressBook') {
      const scope = addressBookScopeRef.current;
      setShowRecipientBookModal(false);
      applyAddressBookScope(scope);
      resetAddressBookFormState(scope);
      applyEntryResets('addressBook');
      setStack((prev) => {
        if (!prev.length) return ['addressBook'];
        if (prev[prev.length - 1] === 'settingsWalletsAuth') {
          return [...prev.slice(0, -1), 'addressBook'];
        }
        return [...prev, 'addressBook'];
      });
      return;
    }
    const targetScreen: Screen = target === 'security' ? 'settingsSecurity' : 'settingsWallets';
    applyEntryResets(targetScreen);
    setStack((prev) => {
      if (!prev.length) return [targetScreen];
      if (prev[prev.length - 1] === 'settingsWalletsAuth') {
        return [...prev.slice(0, -1), targetScreen];
      }
      return [...prev, targetScreen];
    });
  };

  const formatPasswordAuthBackoffLabel = (durationMs: number) => {
    const seconds = Math.max(1, Math.ceil(durationMs / 1000));
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.ceil(seconds / 60);
    return `${minutes}m`;
  };

  const buildPasswordAuthLockedMessage = (durationMs: number) => {
    const waitLabel = formatPasswordAuthBackoffLabel(durationMs);
    if (lang === 'ko') return `시도 제한이 적용되었습니다. ${waitLabel} 후 다시 시도하세요.`;
    if (lang === 'zh') return `尝试次数过多，请在 ${waitLabel} 后重试。`;
    return `Too many attempts. Try again in ${waitLabel}.`;
  };

  const getPasswordAuthRemainingMs = () => Math.max(0, passwordAuthLockUntilMs - Date.now());

  const registerPasswordAuthFailure = () => {
    const nextFailureCount = Math.max(1, passwordAuthFailureCount + 1);
    const backoffMs = Math.min(PASSWORD_AUTH_BACKOFF_BASE_MS * 2 ** (nextFailureCount - 1), PASSWORD_AUTH_BACKOFF_MAX_MS);
    setPasswordAuthFailureCount(nextFailureCount);
    setPasswordAuthLockUntilMs(Date.now() + backoffMs);
    return backoffMs;
  };

  const resetPasswordAuthFailure = () => {
    if (passwordAuthFailureCount !== 0) setPasswordAuthFailureCount(0);
    if (passwordAuthLockUntilMs !== 0) setPasswordAuthLockUntilMs(0);
  };

  const ensurePasswordAuthReady = () => {
    const remainingMs = getPasswordAuthRemainingMs();
    if (remainingMs <= 0) return true;
    setBannerMessage(buildPasswordAuthLockedMessage(remainingMs));
    return false;
  };

  const confirmWalletSettingsAuth = (overrideInput?: string) => {
    if (!ensurePasswordAuthReady()) return;
    const entered = normalizePassword(overrideInput ?? walletSettingsAuthInput);
    if (entered !== normalizePassword(sendPassword)) {
      setWalletSettingsAuthInput('');
      setWalletSettingsAuthError('');
      const backoffMs = registerPasswordAuthFailure();
      setBannerMessage(`${flow.authInvalid} ${buildPasswordAuthLockedMessage(backoffMs)}`);
      return;
    }
    resetPasswordAuthFailure();
    setWalletSettingsAuthError('');
    setWalletSettingsAuthInput('');
    openSettingsTargetAfterAuth(settingsAuthTarget);
  };

  const confirmWalletSettingsWithBiometric = async () => {
    if (sendAuthMethod === 'password') return;
    const promptMessage =
      settingsAuthTarget === 'security' ? text.security : settingsAuthTarget === 'addressBook' ? extra.addressBookManage : text.wallets;
    const authenticated = await authenticateWithBiometricMode(sendAuthMethod, promptMessage);
    if (!authenticated) return;
    setWalletSettingsAuthError('');
    setWalletSettingsAuthInput('');
    openSettingsTargetAfterAuth(settingsAuthTarget);
  };

  const unlockWithPassword = (overrideInput?: string) => {
    const remainingMs = getPasswordAuthRemainingMs();
    if (remainingMs > 0) {
      const lockedMessage = buildPasswordAuthLockedMessage(remainingMs);
      setAppUnlockInput('');
      setAppUnlockError(lockedMessage);
      setBannerMessage(lockedMessage);
      return;
    }

    const entered = normalizePassword(overrideInput ?? appUnlockInput);
    if (entered !== normalizePassword(sendPassword)) {
      setAppUnlockInput('');
      const backoffMs = registerPasswordAuthFailure();
      const message = `${flow.authInvalid} ${buildPasswordAuthLockedMessage(backoffMs)}`;
      setAppUnlockError(message);
      setBannerMessage(message);
      return;
    }
    resetPasswordAuthFailure();
    setAppUnlockError('');
    setAppUnlockInput('');
    setAppUnlockUsePassword(false);
    setAppLocked(false);
  };

  const unlockWithBiometricMode = async () => {
    const mode = sendAuthMethod === 'password' ? 'fingerprint' : sendAuthMethod;
    const authenticated = await authenticateWithBiometricMode(mode, flow.appUnlockTitle);
    if (!authenticated) return;
    setAppUnlockError('');
    setAppUnlockInput('');
    setAppUnlockUsePassword(false);
    setAppLocked(false);
  };

  useEffect(() => {
    if (isLockPreviewMode) return;
    if (!appLocked) {
      appLockBiometricAutoRequestedRef.current = false;
      return;
    }
    const shouldAutoBiometricUnlock = hasWallet && hasAppPassword && passwordLockEnabled && biometric && sendAuthMethod !== 'password';
    if (!shouldAutoBiometricUnlock) return;
    if (appLockBiometricAutoRequestedRef.current) return;

    appLockBiometricAutoRequestedRef.current = true;
    void unlockWithBiometricMode();
  }, [appLocked, hasWallet, hasAppPassword, passwordLockEnabled, biometric, sendAuthMethod, isLockPreviewMode]);

  const pushTx = (item: Omit<WalletTxItem, 'id' | 'createdAt'>) => {
    setTxs((prev) => [{ ...item, id: `tx-${Date.now()}`, createdAt: nowStamp() }, ...prev]);
  };

  const parseAmount = (raw = amountInput) => parseAmountInput(raw);

  const appendPasscodeDigit = (
    current: string,
    setter: (value: string) => void,
    digit: string,
    options?: { onClearError?: () => void; onComplete?: (value: string) => void }
  ) => {
    if (!/^\d$/.test(digit)) return;
    const normalized = normalizePassword(current);
    if (normalized.length >= APP_PASSWORD_LENGTH) return;
    const next = normalizePassword(`${normalized}${digit}`);
    setter(next);
    options?.onClearError?.();
    if (next.length === APP_PASSWORD_LENGTH) options?.onComplete?.(next);
  };

  const deletePasscodeDigit = (current: string, setter: (value: string) => void, options?: { onClearError?: () => void }) => {
    const normalized = normalizePassword(current);
    if (!normalized.length) return;
    setter(normalized.slice(0, -1));
    options?.onClearError?.();
  };

  const renderPasscodeBoxes = (
    value: string,
    options?: {
      active?: boolean;
      error?: boolean;
      onPress?: () => void;
    }
  ) => {
    const normalized = normalizePassword(value);
    const active = options?.active ?? true;
    const activeIndex = active && normalized.length < APP_PASSWORD_LENGTH ? normalized.length : -1;
    return (
      <Pressable style={styles.passcodeBoxesRow} onPress={options?.onPress}>
        {Array.from({ length: APP_PASSWORD_LENGTH }).map((_, index) => {
          const filled = index < normalized.length;
          return (
            <View
              key={`passcode-box-${index}`}
              style={[
                styles.passcodeBox,
                filled ? styles.passcodeBoxFilled : undefined,
                activeIndex === index ? styles.passcodeBoxActive : undefined,
                options?.error ? styles.passcodeBoxError : undefined
              ]}
            >
              {filled ? <View style={styles.passcodeDot} /> : null}
            </View>
          );
        })}
      </Pressable>
    );
  };

  const renderPasscodeKeypad = (config: {
    onDigitPress: (digit: string) => void;
    onDeletePress: () => void;
    onBiometricPress?: () => void;
    biometricEnabled?: boolean;
    biometricLabel?: string;
    deleteLabel?: string;
  }) => {
    const digitRows = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9']
    ];
    const biometricEnabled = Boolean(config.biometricEnabled && config.onBiometricPress);
    return (
      <View style={styles.passcodePad}>
        {digitRows.map((row, rowIndex) => (
          <View key={`passcode-row-${rowIndex}`} style={styles.passcodePadRow}>
            {row.map((digit) => (
              <Pressable key={`passcode-digit-${rowIndex}-${digit}`} style={styles.passcodePadKey} onPress={() => config.onDigitPress(digit)}>
                <Text style={styles.passcodePadKeyText}>{digit}</Text>
              </Pressable>
            ))}
          </View>
        ))}
        <View style={styles.passcodePadRow}>
          <Pressable
            style={[styles.passcodePadKey, !biometricEnabled ? styles.passcodePadKeyDisabled : undefined]}
            onPress={biometricEnabled ? config.onBiometricPress : undefined}
          >
            <Text style={[styles.passcodePadActionText, !biometricEnabled ? styles.passcodePadActionTextDisabled : undefined]}>
              {config.biometricLabel ?? flow.passcodeBiometric}
            </Text>
          </Pressable>
          <Pressable style={styles.passcodePadKey} onPress={() => config.onDigitPress('0')}>
            <Text style={styles.passcodePadKeyText}>0</Text>
          </Pressable>
          <Pressable style={styles.passcodePadKey} onPress={config.onDeletePress}>
            <Text style={styles.passcodePadActionText}>{config.deleteLabel ?? flow.passcodeDelete}</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderPasscodePad = (config: {
    value: string;
    setValue: (value: string) => void;
    error?: string;
    onClearError?: () => void;
    onComplete?: (value: string) => void;
    onSubmit: () => void;
    submitLabel: string;
    onBiometricPress?: () => void;
    biometricEnabled?: boolean;
    biometricLabel?: string;
    title?: string;
    showErrorText?: boolean;
    showSubmitButton?: boolean;
  }) => {
    const biometricEnabled = Boolean(config.biometricEnabled && config.onBiometricPress);
    const showErrorText = config.showErrorText ?? true;
    return (
      <View style={styles.passcodeLayout}>
        <View style={styles.passcodeCenter}>
          <Text style={styles.passcodeTitle}>{config.title ?? flow.passcodeInputTitle}</Text>
          {renderPasscodeBoxes(config.value, { active: true, error: Boolean(config.error) })}
          <View style={[styles.fieldErrorSlot, !showErrorText ? styles.passcodeErrorSlotHidden : undefined]}>
            <Text numberOfLines={1} style={[styles.fieldErrorText, !config.error || !showErrorText ? styles.fieldErrorTextHidden : undefined]}>
              {showErrorText ? config.error ?? ' ' : ' '}
            </Text>
          </View>
        </View>
        <View style={styles.passcodeBottom}>
          {renderPasscodeKeypad({
            biometricEnabled,
            onBiometricPress: config.onBiometricPress,
            biometricLabel: config.biometricLabel,
            onDigitPress: (digit) =>
              appendPasscodeDigit(config.value, config.setValue, digit, {
                onClearError: config.onClearError,
                onComplete: (nextValue) => {
                  if (config.onComplete) {
                    config.onComplete(nextValue);
                    return;
                  }
                  config.onSubmit();
                }
              }),
            onDeletePress: () =>
              deletePasscodeDigit(config.value, config.setValue, {
                onClearError: config.onClearError
              })
          })}
          {config.showSubmitButton === false ? null : (
            <Pressable style={styles.primaryBtn} onPress={config.onSubmit}>
              <Text style={styles.primaryBtnText}>{config.submitLabel}</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  const validateRecipientForChain = (chain: ChainCode, rawAddress: string) => {
    const result = validateAddressWithEngine(chain, rawAddress);
    if (result.ok) return null;
    if (result.code === 'invalid_format') return text.addressInvalid;
    if (result.code === 'chain_mismatch') return text.addressMismatch;
    return text.addressNotFound;
  };

  const addWalletAccount = (
    rawName: string,
    options?: {
      seedWords?: string[];
      passphrase?: string;
      accountIndex?: number;
    }
  ) => {
    const nextName = buildUniqueWalletName(rawName, walletAccounts, lang);
    const normalizedPassphrase = String(options?.passphrase ?? '').normalize('NFKD');
    const normalizedAccountIndex = normalizeAccountIndex(options?.accountIndex ?? 0);
    let normalizedSeedWords =
      options?.seedWords && isValidRecoverySeedWords(options.seedWords)
        ? normalizeSeedWords(options.seedWords.map((word) => String(word ?? '')))
        : createEmptySeedWords(DEFAULT_RECOVERY_WORD_COUNT);
    if (!isValidRecoverySeedWords(normalizedSeedWords)) {
      try {
        normalizedSeedWords = safeGenerateRecoverySeedWords(DEFAULT_RECOVERY_WORD_COUNT);
      } catch {
        setBannerMessage(
          lang === 'ko' ? '시드 생성에 실패했습니다. 다시 시도해주세요.' : lang === 'zh' ? '助记词生成失败，请重试。' : 'Seed generation failed. Please try again.'
        );
        return null;
      }
    }

    if (!isValidRecoverySeedWords(normalizedSeedWords)) {
      setBannerMessage(lang === 'ko' ? '시드 생성에 실패했습니다. 다시 시도해주세요.' : lang === 'zh' ? '助记词生成失败，请重试。' : 'Seed generation failed. Please try again.');
      return null;
    }

    let derivedPrimaryAddress = '';
    try {
      derivedPrimaryAddress = deriveTrustCompatiblePrimaryAddress(normalizedSeedWords, normalizedAccountIndex, normalizedPassphrase);
    } catch (error) {
      trackError('wallet.primary_address_derive_failed', error, { walletName: nextName.name });
      setBannerMessage(lang === 'ko' ? '지갑 주소 파생에 실패했습니다.' : lang === 'zh' ? '钱包地址派生失败。' : 'Failed to derive wallet address.');
      return null;
    }
    const newWallet: WalletAccount = {
      id: `wallet-${Date.now()}-${randomIntExclusive(1000)}`,
      name: nextName.name,
      nameMode: nextName.nameMode,
      autoNameIndex: nextName.autoNameIndex,
      address: derivedPrimaryAddress,
      isPrimary: walletAccounts.length === 0
    };
    setWalletAccounts((prev) => [...prev, newWallet]);
    setWalletSeedMap((prev) => ({ ...prev, [newWallet.id]: normalizedSeedWords }));
    setWalletSeedPassphraseMap((prev) => ({ ...prev, [newWallet.id]: normalizedPassphrase }));
    setWalletAccountIndexMap((prev) => ({ ...prev, [newWallet.id]: normalizedAccountIndex }));
    setWalletId(newWallet.id);
    setOnboardingWalletName('');
    logEvent({ type: 'wallet.added', payload: { walletId: newWallet.id, walletName: nextName.name } });
    setBannerMessage(walletUi.walletAdded);
    return newWallet;
  };

  const completeWalletCreateFlow = (options?: {
    requirePasswordSetup?: boolean;
    target?: 'home' | 'onboardingCreateDone';
    doneGoHomeOnly?: boolean;
  }) => {
    const sourceSeedWords = isSeedWordsComplete ? normalizeSeedWords(seedWords) : [...onboardingSeedWords];
    const sourcePassphrase = normalizedSeedPassphrase;
    const sourceAccountIndex = normalizedSeedAccountIndex;
    const createdWallet = addWalletAccount(onboardingWalletName, {
      seedWords: sourceSeedWords,
      passphrase: sourcePassphrase,
      accountIndex: sourceAccountIndex
    });
    if (!createdWallet) return;
    setPhraseInput('');
    setSeedPassphraseInput('');
    setSeedAccountIndexInput('0');
    setSelectedNetwork('Ethereum');
    setRecoveryIndexScanResult(null);
    setRecoveryIndexScanLoading(false);
    setRecoveryWordCount(DEFAULT_RECOVERY_WORD_COUNT);
    clearSeedWords(DEFAULT_RECOVERY_WORD_COUNT);
    setPendingInitialCreateAfterPassword(false);
    if (options?.requirePasswordSetup) {
      setOnboardingPasswordInput('');
      setOnboardingPasswordConfirmInput('');
      setOnboardingPasswordTarget('password');
      setOnboardingPasswordError('');
      openRoot('onboardingSetPassword');
      return;
    }
    if (options?.target === 'onboardingCreateDone') {
      setOnboardingDoneGoHomeOnly(Boolean(options.doneGoHomeOnly));
      openRoot('onboardingCreateDone');
      return;
    }
    setOnboardingDoneGoHomeOnly(false);
    openRoot('home');
  };

  const startWalletDeleteFlow = (targetWalletId: string) => {
    if (walletAccounts.length <= 1) {
      setBannerMessage(walletUi.cannotDeleteLastWallet);
      return;
    }
    if (!walletAccounts.some((wallet) => wallet.id === targetWalletId)) return;
    setDeleteWalletId(targetWalletId);
    setDeleteAgreeBackup(false);
    setDeleteAgreeNoRecovery(false);
    setDeleteAgreeFinal(false);
    const targetSeedWords = walletSeedMap[targetWalletId];
    const deleteWordCount = Array.isArray(targetSeedWords) && isValidRecoverySeedWords(targetSeedWords)
      ? targetSeedWords.length
      : 0;
    clearDeleteSeedWords(deleteWordCount);
    setDeleteSeedTouched(false);
    setDeleteAuthPasswordInput('');
    setDeleteAuthErrorMessage('');
    navigate('walletDeleteCheck');
  };

  const continueWalletDeleteSeedStep = () => {
    setDeleteSeedTouched(true);
    if (!isDeleteSeedWordsComplete) return;
    if (!doesDeleteSeedMatch) return;
    setDeleteAuthErrorMessage('');
    setDeleteAuthPasswordInput('');
    navigate('walletDeleteAuth');
  };

  const confirmWalletDeleteWithAuth = async (overrideInput?: string) => {
    if (!deleteTargetWallet) return;
    if (sendAuthMethod === 'password') {
      if (!ensurePasswordAuthReady()) return;
      if (normalizePassword(overrideInput ?? deleteAuthPasswordInput) !== normalizePassword(sendPassword)) {
        setDeleteAuthPasswordInput('');
        setDeleteAuthErrorMessage('');
        const backoffMs = registerPasswordAuthFailure();
        setBannerMessage(`${flow.authInvalid} ${buildPasswordAuthLockedMessage(backoffMs)}`);
        return;
      }
      resetPasswordAuthFailure();
    } else {
      const authenticated = await authenticateWithBiometricMode(sendAuthMethod, walletUi.deleteWalletTitle);
      if (!authenticated) return;
    }

    setDeleteAuthErrorMessage('');
    const removingWalletId = deleteTargetWallet.id;
    const remainingWallets = walletAccounts.filter((wallet) => wallet.id !== removingWalletId);
    setWalletAccounts(remainingWallets);
    setWalletSeedMap((prev) => {
      const next = { ...prev };
      delete next[removingWalletId];
      return next;
    });
    setWalletSeedPassphraseMap((prev) => {
      const next = { ...prev };
      delete next[removingWalletId];
      return next;
    });
    setWalletAccountIndexMap((prev) => {
      const next = { ...prev };
      delete next[removingWalletId];
      return next;
    });
    if (walletId === removingWalletId && remainingWallets.length) {
      setWalletId(remainingWallets[0].id);
    }
    setDeleteWalletId(null);
    setDeleteAgreeBackup(false);
    setDeleteAgreeNoRecovery(false);
    setDeleteAgreeFinal(false);
    clearDeleteSeedWords();
    setDeleteSeedTouched(false);
    setDeleteAuthPasswordInput('');
    setDeleteAuthErrorMessage('');
    setBannerMessage(walletUi.walletDeleted);
    setStack(['settings', 'settingsWallets']);
  };

  const ensureSendSelectionOrToast = () => {
    if (isSendSelectionComplete) return true;
    setBannerMessage(text.selectChainAssetFirst);
    return false;
  };

  const ensureReceiveSelectionOrToast = () => {
    if (isReceiveSelectionComplete) return true;
    setBannerMessage(text.selectChainAssetFirst);
    return false;
  };

  const getRecipientError = (rawAddress = recipientInput, chain = sendToken.chainCode) => {
    const address = rawAddress.trim();
    if (!address) return text.recipientRequired;
    const targetChain = isSendSelectionComplete ? chain : detectAddressChains(address)[0];
    if (!targetChain) return text.addressInvalid;
    return validateRecipientForChain(targetChain, address);
  };

  const getAmountError = (rawAmount = amountInput, balance = sendToken.balance) => {
    if (!isSendSelectionComplete) return null;
    const result = validateSendAmount(rawAmount, balance);
    if (result === 'invalid_amount') return text.invalidAmount;
    if (result === 'insufficient_balance') return text.insufficientBalance;
    return null;
  };

  const recipientError = recipientTouched ? getRecipientError() : null;
  const amountError = amountTouched ? getAmountError() : null;
  const getNftRecipientError = (rawAddress = nftSendRecipientInput, item = selectedNftForSend) => {
    if (!item) return text.selectChainAssetFirst;
    const address = rawAddress.trim();
    if (!address) return text.recipientRequired;
    return validateRecipientForChain(getCollectibleChainCode(item), address);
  };
  const nftRecipientError = nftSendRecipientTouched ? getNftRecipientError() : null;

  const toggleAsset = (tokenId: string) => {
    const { blocked } = toggleEnabledToken(tokenId);
    if (blocked) {
      setBannerMessage(text.noAssetEnabled);
      return;
    }
    logEvent({ type: 'asset.toggle', payload: { tokenId } });
  };

  const copyAddressText = async (value: string) => {
    try {
      await Clipboard.setStringAsync(value);
      setBannerMessage(text.addressCopied);
    } catch (error) {
      trackError('clipboard.copy_failed', error, { valueLength: value.length });
      setBannerMessage(text.addressCopied);
    }
  };

  const copySeedPhraseText = async () => {
    const phrase = onboardingSeedWords.join(' ');
    try {
      await Clipboard.setStringAsync(phrase);
      if (seedClipboardClearTimerRef.current) {
        clearTimeout(seedClipboardClearTimerRef.current);
      }
      seedClipboardClearTimerRef.current = setTimeout(() => {
        void Clipboard.setStringAsync('').catch(() => undefined);
        seedClipboardClearTimerRef.current = null;
      }, SEED_CLIPBOARD_CLEAR_DELAY_MS);
      setBannerMessage(text.phraseCopied);
      logEvent({ type: 'seed.copy', payload: { wordCount: onboardingSeedWords.length } });
    } catch (error) {
      trackError('clipboard.seed_copy_failed', error, { valueLength: phrase.length });
      setBannerMessage(text.phraseCopied);
    }
  };

  const shareQrImage = async (address: string, chain: ChainCode, symbol: string) => {
    const shareTitle = `${symbol} ${text.receive}`;
    const shareMessage = createReceiveShareText(chain, text.receive, address);

    try {
      if (Platform.OS === 'web') {
        const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: (data: any) => Promise<void> }) : null;
        if (nav?.share) {
          await nav.share({
            title: shareTitle,
            text: shareMessage
          });
          return;
        }
        await Clipboard.setStringAsync(address);
        setBannerMessage(text.addressCopied);
        logEvent({ type: 'receive.qr.share.link_copied', payload: { chain, symbol } });
        return;
      }

      await Share.share({
        title: shareTitle,
        message: shareMessage
      });
      logEvent({ type: 'receive.qr.shared', payload: { chain, symbol } });
    } catch (error) {
      trackError('receive.qr.share_failed', error, { chain, symbol, platform: Platform.OS });
      setBannerMessage(text.addressCopied);
    }
  };

  const extractAddressCandidate = (raw: string) => {
    const base = raw.trim();
    if (!base) return null;

    if (detectAddressChains(base).length) return base;

    const noQuery = base.split('?')[0];
    if (detectAddressChains(noQuery).length) return noQuery;

    const noScheme = noQuery.replace(/^[a-zA-Z]+:/, '');
    if (detectAddressChains(noScheme).length) return noScheme;

    const candidates = base.match(/[A-Za-z0-9]{24,120}/g) ?? [];
    for (const candidate of candidates) {
      if (detectAddressChains(candidate).length) return candidate;
    }

    return null;
  };

  const openScanMethodPicker = (entryPoint: 'send' | 'nftSend' | 'home') => {
    if (entryPoint === 'nftSend' && !selectedNftForSend) {
      setBannerMessage(nftUi.noNftOwned);
      return;
    }
    setScanEntryPoint(entryPoint);
    setShowScanMethodModal(true);
  };

  const applyDetectedAddressSelection = (detectedChains: ChainCode[]) => {
    if (!detectedChains.length) return null;

    const targetChain = detectedChains.includes(sendChainCode) ? sendChainCode : detectedChains[0];
    setSendChainFilter(targetChain);
    setSendChainCode(targetChain);

    const nativeAssetKey = chainNativeAssetMap[targetChain];
    const matchedToken =
      allFilterTokens.find((token) => token.chainCode === targetChain && token.assetKey === nativeAssetKey) ??
      allFilterTokens.find((token) => token.chainCode === targetChain);
    if (matchedToken) {
      setSendTokenId(matchedToken.id);
      setSendAssetFilterTokenId(matchedToken.id);
      return targetChain;
    }
    setSendAssetFilterTokenId('ALL');
    return targetChain;
  };

  const applyRecentSendSelection = (item: RecentSendItem) => {
    const targetChain = item.chain;
    const targetSymbol = item.symbol.trim().toUpperCase();

    setSendChainFilter(targetChain);
    setSendChainCode(targetChain);

    const targetAssetKey = normalizeAssetKey(targetSymbol);
    const matchedToken =
      allFilterTokens.find((token) => token.chainCode === targetChain && token.symbol.toUpperCase() === targetSymbol) ??
      (targetAssetKey ? allFilterTokens.find((token) => token.chainCode === targetChain && token.assetKey === targetAssetKey) : undefined) ??
      allFilterTokens.find((token) => token.chainCode === targetChain);

    if (matchedToken) {
      setSendTokenId(matchedToken.id);
      setSendAssetFilterTokenId(matchedToken.id);
      return;
    }
    setSendAssetFilterTokenId('ALL');
  };

  const handleSendRecipientInputChange = (nextValue: string) => {
    setRecipientInput(nextValue);
    const trimmed = nextValue.trim();
    setRecipientTouched(trimmed.length > 0);
    if (!trimmed) return;

    const detected = extractAddressCandidate(trimmed) ?? trimmed;
    const detectedChains = detectAddressChains(detected);
    if (!detectedChains.length) return;
    applyDetectedAddressSelection(detectedChains);
  };

  const applyDetectedAddress = (raw: string) => {
    const detected = extractAddressCandidate(raw);
    if (!detected) {
      setBannerMessage(extra.scanNoQr);
      return;
    }
    const detectedChains = detectAddressChains(detected);
    if (scanEntryPoint === 'home') {
      const targetChain = applyDetectedAddressSelection(detectedChains);
      setRecipientTouched(true);
      setShowWalletMenu(false);
      setRecipientInput(detected);
      if (!targetChain) {
        setBannerMessage(text.addressInvalid);
      } else {
        const recipientIssue = validateRecipientForChain(targetChain, detected);
        if (recipientIssue) setBannerMessage(recipientIssue);
      }
      skipNextSendResetRef.current = true;
      navigate('send');
      return;
    }
    if (scanEntryPoint === 'nftSend') {
      setNftSendRecipientInput(detected);
      setNftSendRecipientTouched(true);
      if (!selectedNftForSend) {
        setBannerMessage(nftUi.noNftOwned);
        return;
      }
      const nftRecipientIssue = validateRecipientForChain(getCollectibleChainCode(selectedNftForSend), detected);
      if (nftRecipientIssue) setBannerMessage(nftRecipientIssue);
      return;
    }
    const targetChain = applyDetectedAddressSelection(detectedChains);
    setRecipientTouched(true);
    setRecipientInput(detected);
    if (!targetChain) {
      setBannerMessage(text.addressInvalid);
      return;
    }
    const recipientIssue = validateRecipientForChain(targetChain, detected);
    if (recipientIssue) setBannerMessage(recipientIssue);
  };

  const pasteRecipientFromClipboard = async () => {
    try {
      const raw = await Clipboard.getStringAsync();
      if (!raw.trim()) {
        setBannerMessage(text.recipientRequired);
        return;
      }
      const detected = extractAddressCandidate(raw) ?? raw.trim();
      const detectedChains = detectAddressChains(detected);
      const targetChain = applyDetectedAddressSelection(detectedChains);
      setRecipientInput(detected);
      setRecipientTouched(true);
      if (!targetChain) {
        setBannerMessage(text.addressInvalid);
        return;
      }
      const recipientIssue = validateRecipientForChain(targetChain, detected);
      if (recipientIssue) {
        setBannerMessage(recipientIssue);
      }
    } catch (error) {
      trackError('clipboard.paste_failed', error, { screen: currentScreen });
      setBannerMessage(text.recipientRequired);
    }
  };

  const pasteNftRecipientFromClipboard = async () => {
    if (!selectedNftForSend) {
      setBannerMessage(nftUi.noNftOwned);
      return;
    }
    try {
      const raw = await Clipboard.getStringAsync();
      if (!raw.trim()) {
        setBannerMessage(text.recipientRequired);
        return;
      }
      const detected = extractAddressCandidate(raw) ?? raw.trim();
      setNftSendRecipientInput(detected);
      setNftSendRecipientTouched(true);
      const recipientIssue = validateRecipientForChain(getCollectibleChainCode(selectedNftForSend), detected);
      if (recipientIssue) {
        setBannerMessage(recipientIssue);
      }
    } catch (error) {
      trackError('clipboard.paste_failed', error, { screen: currentScreen });
      setBannerMessage(text.recipientRequired);
    }
  };

  const scanAddressFromGallery = async () => {
    setShowScanMethodModal(false);
    try {
      await ImagePicker.requestMediaLibraryPermissionsAsync();
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1
      });
      if (picked.canceled || !picked.assets?.[0]?.uri) return;
      const result = await Camera.scanFromURLAsync(picked.assets[0].uri, ['qr']);
      if (!result.length || !result[0].data) {
        setBannerMessage(extra.scanNoQr);
        return;
      }
      applyDetectedAddress(result[0].data);
    } catch (error) {
      trackError('scan.gallery_failed', error, { entryPoint: scanEntryPoint });
      setBannerMessage(extra.scanNoQr);
    }
  };

  const pickSupportChatImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setBannerMessage(text.supportChatUploadFailed);
        return;
      }
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.9,
        allowsMultipleSelection: false
      });
      if (picked.canceled || !picked.assets?.[0]?.uri) return;
      const firstAsset = picked.assets[0];
      if (firstAsset.type && firstAsset.type !== 'image') {
        setBannerMessage(text.supportChatOnlyImages);
        return;
      }
      setSupportComposerImageUri(firstAsset.uri);
    } catch (error) {
      trackError('support.chat.image_pick_failed', error, { platform: Platform.OS });
      setBannerMessage(text.supportChatUploadFailed);
    }
  };

  const sendSupportChatMessage = () => {
    const body = supportComposerText.trim();
    const imageUri = supportComposerImageUri;
    if (!body && !imageUri) return;

    const userMessage: SupportChatMessage = {
      id: `support-user-${Date.now()}`,
      role: 'user',
      text: body || undefined,
      imageUri: imageUri ?? undefined,
      createdAt: new Date().toISOString()
    };
    setSupportMessages((prev) => [...prev, userMessage]);
    setSupportComposerText('');
    setSupportComposerImageUri(null);

    if (supportReplyTimerRef.current) {
      clearTimeout(supportReplyTimerRef.current);
      supportReplyTimerRef.current = null;
    }
    supportReplyTimerRef.current = setTimeout(() => {
      setSupportMessages((prev) => [
        ...prev,
        {
          id: `support-agent-${Date.now()}`,
          role: 'agent',
          text: text.supportChatAgentAutoReply,
          createdAt: new Date().toISOString()
        }
      ]);
      supportReplyTimerRef.current = null;
    }, 650);
  };

  const scanAddressFromCamera = async () => {
    setShowScanMethodModal(false);
    const permission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    if (!permission?.granted) {
      return;
    }
    setScanLocked(false);
    setShowCameraScanner(true);
  };

  const onCameraBarcodeScanned = (result: BarcodeScanningResult) => {
    if (scanLocked) return;
    setScanLocked(true);
    applyDetectedAddress(result.data ?? '');
    setShowCameraScanner(false);
    setTimeout(() => setScanLocked(false), 350);
  };

  const getAddressBookEntriesByScope = (scope: AddressBookScope) => (scope === 'nft' ? nftAddressBook : addressBook);

  const setAddressBookEntriesByScope = (scope: AddressBookScope, updater: (prev: AddressBookEntry[]) => AddressBookEntry[]) => {
    if (scope === 'nft') {
      setNftAddressBook(updater);
      return;
    }
    setAddressBook(updater);
  };

  const resetAddressBookEditState = () => {
    setShowAddressBookEditModal(false);
    setAddressEditScope('asset');
    setAddressEditTargetId(null);
    setAddressEditChain('ETH');
    setAddressEditAssetKey(chainNativeAssetMap.ETH);
    setAddressEditLabelInput('');
    setAddressEditValueInput('');
  };

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const rootScreen: Screen = hasWallet ? 'home' : 'noWalletHome';
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showCameraScanner) {
        setShowCameraScanner(false);
        return true;
      }
      if (showHistoryDateCalendarModal) {
        setShowHistoryDateCalendarModal(false);
        return true;
      }
      if (showHistoryDateRangeModal) {
        setShowHistoryDateRangeModal(false);
        return true;
      }
      if (showHomeAssetLayoutModal) {
        setShowHomeAssetLayoutModal(false);
        return true;
      }
      if (showScanMethodModal) {
        setShowScanMethodModal(false);
        return true;
      }
      if (showSaveRecipientModal) {
        setShowSaveRecipientModal(false);
        return true;
      }
      if (showAddressBookEditModal) {
        resetAddressBookEditState();
        return true;
      }
      if (showRecipientBookModal) {
        setShowRecipientBookModal(false);
        return true;
      }
      if (discoverSecurityPrompt) {
        setDiscoverSecurityPrompt(null);
        return true;
      }
      if (showRecentSendDropdown) {
        setShowRecentSendDropdown(false);
        return true;
      }
      if (showNftRecentSendDropdown) {
        setShowNftRecentSendDropdown(false);
        return true;
      }
      if (showDiscoverBriefingWeekMenu) {
        setShowDiscoverBriefingWeekMenu(false);
        return true;
      }
      if (showWalletMenu) {
        setShowWalletMenu(false);
        return true;
      }
      if (showLangMenu) {
        setShowLangMenu(false);
        return true;
      }
      if (showAutoLockMenu) {
        setShowAutoLockMenu(false);
        return true;
      }
      if (showLockMethodMenu) {
        setShowLockMethodMenu(false);
        return true;
      }
      if (showBiometricTypeMenu) {
        setShowBiometricTypeMenu(false);
        return true;
      }
      if (stack.length > 1 || currentScreen !== rootScreen) {
        goBack();
        return true;
      }
      return true;
    });

    return () => {
      subscription.remove();
    };
  }, [
    currentScreen,
    discoverSecurityPrompt,
    goBack,
    hasWallet,
    showAddressBookEditModal,
    showAutoLockMenu,
    showBiometricTypeMenu,
    showCameraScanner,
    showDiscoverBriefingWeekMenu,
    showHistoryDateCalendarModal,
    showHistoryDateRangeModal,
    showHomeAssetLayoutModal,
    showLangMenu,
    showLockMethodMenu,
    showNftRecentSendDropdown,
    showRecentSendDropdown,
    showRecipientBookModal,
    showSaveRecipientModal,
    showScanMethodModal,
    showWalletMenu,
    stack
  ]);

  const applyAddressBookScope = (scope: AddressBookScope) => {
    addressBookScopeRef.current = scope;
    setAddressBookScope(scope);
  };

  const resetAddressBookForm = (scope: AddressBookScope, chain?: ChainCode) => {
    const defaultChain =
      chain ??
      (scope === 'nft'
        ? normalizeChainCode(selectedNftForSend?.network ?? '') ?? 'ETH'
        : sendChainCode);
    applyAddressBookScope(scope);
    setAddressFormChain(defaultChain);
    setAddressFormAssetKey(chainNativeAssetMap[defaultChain]);
    setAddressLabelInput('');
    setAddressValueInput('');
  };

  const openAddressBookManager = (scope: AddressBookScope = 'asset') => {
    setShowRecipientBookModal(false);
    applyAddressBookScope(scope);
    resetAddressBookFormState(scope);
    navigate('addressBook');
  };

  const openAddressBookTypeSelect = () => {
    setShowRecipientBookModal(false);
    openAddressBookManager(addressBookScopeRef.current);
  };

  const openRecipientBookModal = (scope: AddressBookScope = 'asset') => {
    setRecipientBookScope(scope);
    if (scope === 'asset' && isSendSelectionComplete && selectedSendToken) {
      setRecipientBookChainFilter(selectedSendToken.chainCode);
      setRecipientBookAssetFilter(selectedSendToken.assetKey);
    } else if (scope === 'nft' && selectedNftForSend) {
      const chain = normalizeChainCode(selectedNftForSend.network) ?? 'ETH';
      setRecipientBookChainFilter(chain);
      setRecipientBookAssetFilter('ALL');
    } else {
      setRecipientBookChainFilter('ALL');
      setRecipientBookAssetFilter('ALL');
    }
    setRecipientBookPage(1);
    setShowRecipientBookModal(true);
  };

  const applyRecipientBookEntryToSend = (entry: AddressBookEntry) => {
    if (recipientBookScope === 'nft') {
      setNftSendRecipientInput(entry.address);
      setNftSendRecipientTouched(false);
      const matchedCollectible =
        ownedCollectibles.find((item) => getCollectibleChainCode(item) === entry.chain) ??
        collectibles.find((item) => getCollectibleChainCode(item) === entry.chain && item.owned > 0);
      if (matchedCollectible) setNftSendCollectibleId(matchedCollectible.id);
    } else {
      setRecipientInput(entry.address);
      setRecipientTouched(false);
      setSendChainFilter(entry.chain);
      setSendChainCode(entry.chain);

      const matchedToken =
        allFilterTokens.find((token) => token.chainCode === entry.chain && token.assetKey === entry.assetKey) ??
        allFilterTokens.find((token) => token.chainCode === entry.chain);
      if (matchedToken) {
        setSendTokenId(matchedToken.id);
        setSendAssetFilterTokenId(matchedToken.id);
      } else {
        setSendAssetFilterTokenId('ALL');
      }
    }

    setShowRecipientBookModal(false);
  };

  const saveCurrentRecipientToBook = (scope: AddressBookScope = 'asset') => {
    if (scope === 'asset' && !ensureSendSelectionOrToast()) return;
    if (scope === 'nft' && !selectedNftForSend) {
      setBannerMessage(nftUi.noNftOwned);
      return;
    }

    const isAssetScope = scope === 'asset';
    const address = (isAssetScope ? recipientInput : nftSendRecipientInput).trim();
    if (!address) {
      setBannerMessage(text.recipientRequired);
      return;
    }

    const chain = isAssetScope ? sendToken.chainCode : getCollectibleChainCode(selectedNftForSend!);
    const assetKey = isAssetScope ? sendToken.assetKey : chainNativeAssetMap[chain];
    const validation = validateRecipientForChain(chain, address);
    if (validation) {
      setBannerMessage(validation);
      return;
    }

    const scopedBook = getAddressBookEntriesByScope(scope);
    const normalized = normalizeAddress(chain, address);
    const duplicated = scopedBook.some(
      (entry) => entry.chain === chain && normalizeAddress(chain, entry.address) === normalized
    );
    if (duplicated) {
      setBannerMessage(text.addressExists);
      return;
    }

    setSaveRecipientScope(scope);
    const labelPrefix = isAssetScope ? sendToken.symbol : selectedNftForSend!.name;
    setSaveRecipientLabelInput(`${labelPrefix} ${shortAddress(address)}`);
    setShowSaveRecipientModal(true);
  };

  const submitSaveRecipientModal = () => {
    const isAssetScope = saveRecipientScope === 'asset';
    if (isAssetScope && !ensureSendSelectionOrToast()) return;
    if (!isAssetScope && !selectedNftForSend) {
      setBannerMessage(nftUi.noNftOwned);
      return;
    }

    const chain = isAssetScope ? sendToken.chainCode : getCollectibleChainCode(selectedNftForSend!);
    const assetKey = isAssetScope ? sendToken.assetKey : chainNativeAssetMap[chain];
    const address = (isAssetScope ? recipientInput : nftSendRecipientInput).trim();
    if (!address) {
      setBannerMessage(text.recipientRequired);
      return;
    }
    const validation = validateRecipientForChain(chain, address);
    if (validation) {
      setBannerMessage(validation);
      return;
    }

    const scopedBook = getAddressBookEntriesByScope(saveRecipientScope);
    const normalized = normalizeAddress(chain, address);
    const duplicated = scopedBook.some(
      (entry) => entry.chain === chain && normalizeAddress(chain, entry.address) === normalized
    );
    if (duplicated) {
      setBannerMessage(text.addressExists);
      setShowSaveRecipientModal(false);
      return;
    }

    const defaultLabelPrefix = isAssetScope ? sendToken.symbol : selectedNftForSend!.name;
    const nextLabel = saveRecipientLabelInput.trim() || `${defaultLabelPrefix} ${shortAddress(address)}`;
    setAddressBookEntriesByScope(saveRecipientScope, (prev) => [
      {
        id: `${saveRecipientScope}-book-${Date.now()}`,
        chain,
        assetKey,
        address,
        label: nextLabel,
        createdAt: nowStamp()
      },
      ...prev
    ]);
    setShowSaveRecipientModal(false);
    setBannerMessage(text.addressSaved);
  };

  const startEditAddressEntry = (entry: AddressBookEntry) => {
    setAddressEditScope(addressBookScope);
    setAddressEditTargetId(entry.id);
    setAddressEditChain(entry.chain);
    setAddressEditAssetKey(entry.assetKey ?? chainNativeAssetMap[entry.chain]);
    setAddressEditLabelInput(entry.label);
    setAddressEditValueInput(entry.address);
    setShowAddressBookEditModal(true);
  };

  const submitAddressBookEditModal = () => {
    if (!addressEditTargetId) return;
    const address = addressEditValueInput.trim();
    if (!address) {
      setBannerMessage(text.recipientRequired);
      return;
    }

    const validation = validateRecipientForChain(addressEditChain, address);
    if (validation) {
      setBannerMessage(validation);
      return;
    }

    const normalized = normalizeAddress(addressEditChain, address);
    const scopedBook = getAddressBookEntriesByScope(addressEditScope);
    const duplicated = scopedBook.some(
      (entry) =>
        entry.id !== addressEditTargetId &&
        entry.chain === addressEditChain &&
        normalizeAddress(addressEditChain, entry.address) === normalized
    );
    if (duplicated) {
      setBannerMessage(text.addressExists);
      return;
    }

    const nextLabel = addressEditLabelInput.trim() || `${chainTickerMap[addressEditChain]} ${shortAddress(address)}`;
    setAddressBookEntriesByScope(addressEditScope, (prev) =>
      prev.map((entry) =>
        entry.id === addressEditTargetId
          ? {
              ...entry,
              chain: addressEditChain,
              assetKey: addressEditAssetKey,
              address,
              label: nextLabel
            }
          : entry
      )
    );
    setBannerMessage(extra.addressUpdated);
    resetAddressBookEditState();
  };

  const deleteAddressEntry = (id: string) => {
    setAddressBookEntriesByScope(addressBookScope, (prev) => prev.filter((entry) => entry.id !== id));
    setBannerMessage(extra.addressDeleted);
    if (addressEditTargetId === id) resetAddressBookEditState();
  };

  const submitAddressBookForm = () => {
    const address = addressValueInput.trim();
    if (!address) {
      setBannerMessage(text.recipientRequired);
      return;
    }

    const validation = validateRecipientForChain(addressFormChain, address);
    if (validation) {
      setBannerMessage(validation);
      return;
    }

    const normalized = normalizeAddress(addressFormChain, address);
    const scopedBook = getAddressBookEntriesByScope(addressBookScope);
    const duplicated = scopedBook.some(
      (entry) => entry.chain === addressFormChain && normalizeAddress(addressFormChain, entry.address) === normalized
    );
    if (duplicated) {
      setBannerMessage(text.addressExists);
      return;
    }

    const nextLabel = addressLabelInput.trim() || `${chainTickerMap[addressFormChain]} ${shortAddress(address)}`;
    setAddressBookEntriesByScope(addressBookScope, (prev) => [
      {
        id: `${addressBookScope}-book-${Date.now()}`,
        chain: addressFormChain,
        assetKey: addressFormAssetKey,
        address,
        label: nextLabel,
        createdAt: nowStamp()
      },
      ...prev
    ]);
    setBannerMessage(text.addressSaved);

    resetAddressBookForm(addressBookScope, addressFormChain);
  };

  const getChainNativePrice = (chain: ChainCode) => {
    const nativeAsset = chainNativeAssetMap[chain];
    const onWallet = tokens.find((token) => token.chainCode === chain && token.assetKey === nativeAsset);
    if (onWallet) return onWallet.priceUsd;
    const livePrice = marketPrices[nativeAsset];
    if (livePrice) return livePrice.priceUsd;
    return tokenCatalog.find((token) => token.chainCode === chain && token.assetKey === nativeAsset)?.priceUsd ?? 0;
  };

  const calculateFeeUsd = (chain: ChainCode, feeNative: number) => {
    const nativePrice = getChainNativePrice(chain);
    if (Number.isFinite(nativePrice) && nativePrice > 0) {
      return Number((feeNative * nativePrice).toFixed(6));
    }
    return parseUsdNumber(estimateNetworkFee(chain));
  };

  const estimateRuntimeNativeFee = (chain: ChainCode, gas: SendGasSettings) => {
    const liveSnapshot = liveNetworkFeeMap[chain];
    const hasManualGasOverride =
      (chain === 'ETH' || chain === 'BSC') &&
      (gas.gasPrice.trim() !== DEFAULT_SEND_GAS_SETTINGS.gasPrice || gas.gasLimit.trim() !== DEFAULT_SEND_GAS_SETTINGS.gasLimit);

    if (hasManualGasOverride) {
      return estimateNativeFee(chain, gas.gasPrice, gas.gasLimit);
    }

    const liveNativeFee = Number(liveSnapshot?.nativeFee ?? 0);
    if (Number.isFinite(liveNativeFee) && liveNativeFee > 0) {
      return liveNativeFee;
    }

    return estimateNativeFee(chain, gas.gasPrice, gas.gasLimit);
  };

  const fetchLatestFilFeeSnapshot = async (request: LiveNetworkFeeRequest) => {
    const snapshot = await fetchLiveNetworkFee('FIL', undefined, request);
    setLiveNetworkFeeMap((prev) => ({ ...prev, FIL: snapshot }));
    return snapshot;
  };

  const getNativeWalletTokenByChain = (chain: ChainCode) => {
    const nativeAsset = chainNativeAssetMap[chain];
    return tokens.find((token) => token.chainCode === chain && token.assetKey === nativeAsset) ?? null;
  };

  const getInsufficientNetworkFeeMessage = (chain: ChainCode, requiredNative: number, currentNative: number) => {
    const ticker = chainTickerMap[chain];
    if (lang === 'ko') {
      return `네트워크 수수료가 부족합니다. 필요 ${formatNativeFee(requiredNative)} ${ticker} / 보유 ${formatNativeFee(currentNative)} ${ticker}`;
    }
    if (lang === 'zh') {
      return `网络手续费不足。需要 ${formatNativeFee(requiredNative)} ${ticker} / 当前持有 ${formatNativeFee(currentNative)} ${ticker}`;
    }
    return `Insufficient network fee. Required ${formatNativeFee(requiredNative)} ${ticker} / Available ${formatNativeFee(currentNative)} ${ticker}`;
  };

  const validateSendNetworkFeeBudget = ({
    chain,
    tokenId,
    amount,
    feeNative
  }: {
    chain: ChainCode;
    tokenId: string;
    amount: number;
    feeNative: number;
  }) => {
    const nativeToken = getNativeWalletTokenByChain(chain);
    const nativeBalance = nativeToken?.balance ?? 0;
    const requiredNative = nativeToken?.id === tokenId ? amount + feeNative : feeNative;
    if (requiredNative <= 0) return null;
    if (nativeBalance + 1e-12 >= requiredNative) return null;
    return getInsufficientNetworkFeeMessage(chain, requiredNative, nativeBalance);
  };

  const buildSendDraft = (overrideFeeNative?: number): SendDraft | null => {
    if (!isSendSelectionComplete || !selectedSendToken) return null;
    const amount = parseAmount();
    const overrideFee = Number(overrideFeeNative);
    const feeNative =
      Number.isFinite(overrideFee) && overrideFee > 0
        ? overrideFee
        : estimateRuntimeNativeFee(selectedSendToken.chainCode, sendGasSettings);
    const feeUsd = calculateFeeUsd(selectedSendToken.chainCode, feeNative);
    const recipient = recipientInput.trim();
    const draft = buildSendDraftFromInput({
      tokenId: selectedSendToken.id,
      tokenSymbol: selectedSendToken.symbol,
      chainCode: selectedSendToken.chainCode,
      network: selectedSendToken.network,
      recipient,
      recipientLabel: findAddressBookLabel(selectedSendToken.chainCode, recipient),
      amount,
      memo: sendMemoInput.trim() || undefined,
      priceUsd: selectedSendToken.priceUsd,
      feeUsd,
      feeNative,
      gas: { ...sendGasSettings }
    });
    return { ...draft, assetType: 'asset' };
  };

  const openSendConfirm = async () => {
    if (!ensureSendSelectionOrToast()) return;
    const selectedToken = selectedSendToken;
    if (!selectedToken) return;
    setRecipientTouched(true);
    setAmountTouched(true);
    const recipientIssue = getRecipientError();
    if (recipientIssue) {
      setBannerMessage(recipientIssue);
      return;
    }
    const amountIssue = getAmountError();
    if (amountIssue) {
      setBannerMessage(amountIssue);
      return;
    }
    let nativeFeePreview = estimateRuntimeNativeFee(selectedToken.chainCode, sendGasSettings);
    if (selectedToken.chainCode === 'FIL') {
      const recipient = recipientInput.trim();
      if (recipient) {
        const latestSnapshot = await fetchLatestFilFeeSnapshot({
          fromAddress: selectedToken.walletAddress,
          toAddress: recipient,
          amountNative: parseAmount()
        });
        const latestFee = Number(latestSnapshot?.nativeFee ?? 0);
        if (Number.isFinite(latestFee) && latestFee > 0) {
          nativeFeePreview = latestFee;
        }
      }
    }
    const networkFeeIssue = validateSendNetworkFeeBudget({
      chain: selectedToken.chainCode,
      tokenId: selectedToken.id,
      amount: parseAmount(),
      feeNative: nativeFeePreview
    });
    if (networkFeeIssue) {
      setBannerMessage(networkFeeIssue);
      return;
    }
    const nextDraft = buildSendDraft(nativeFeePreview);
    if (!nextDraft) return;
    sendFlowStartedAtRef.current = Date.now();
    setSendDraft(nextDraft);
    setAuthPasswordInput('');
    setAuthErrorMessage('');
    setSendIsDone(false);
    setSendIsProcessing(false);
    navigate('sendConfirm');
  };

  const saveAdvancedGasSettings = () => {
    const gasPrice = Number(sendGasSettings.gasPrice);
    const gasLimit = Number(sendGasSettings.gasLimit);
    const nonce = Number(sendGasSettings.nonce);
    if (!Number.isFinite(gasPrice) || gasPrice <= 0 || !Number.isFinite(gasLimit) || gasLimit <= 0 || !Number.isFinite(nonce) || nonce < 0) {
      setBannerMessage(flow.invalidGas);
      return;
    }
    if (sendDraft) {
      const feeNative = estimateRuntimeNativeFee(sendDraft.chainCode, sendGasSettings);
      const feeUsd = calculateFeeUsd(sendDraft.chainCode, feeNative);
      setSendDraft({
        ...sendDraft,
        feeNative,
        feeUsd,
        gas: { ...sendGasSettings }
      });
    }
    goBack();
  };

  const openSendAuth = () => {
    if (!sendDraft) return;
    setAuthPasswordInput('');
    setAuthErrorMessage('');
    navigate('sendAuth');
  };

  const waitMs = (ms: number) =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, Math.max(0, Math.floor(ms)));
    });

  const resolveActualFeeForSentTx = (params: { txId: string; txHash: string; chainCode: ChainCode }) => {
    const hash = params.txHash.trim();
    if (!hash) return;
    const retryDelaysMs = [0, 2500, 8000, 18000];

    void (async () => {
      let lastError: unknown = null;

      for (let attempt = 0; attempt < retryDelaysMs.length; attempt += 1) {
        if (attempt > 0) {
          await waitMs(retryDelaysMs[attempt]);
        }

        try {
          const snapshot = await resolveActualNetworkFee(params.chainCode as TxFeeChainCode, hash);
          const feeNative = Number(snapshot?.feeNative ?? 0);
          if (!snapshot || !Number.isFinite(feeNative) || feeNative <= 0) continue;

          const feeUsd = calculateFeeUsd(params.chainCode, feeNative);
          const feeConfirmedAt = snapshot.confirmedAt || new Date().toISOString();

          setTxs((prev) =>
            prev.map((tx) =>
              tx.id === params.txId
                ? {
                    ...tx,
                    hash,
                    feeNative,
                    feeUsd,
                    feeStatus: 'confirmed',
                    feeConfirmedAt
                  }
                : tx
            )
          );

          setTxDetailData((prev) => {
            if (!prev) return prev;
            if (prev.hash.trim() !== hash || prev.chainCode !== params.chainCode) return prev;
            return {
              ...prev,
              feeNative,
              feeUsd,
              feeStatus: 'confirmed',
              feeConfirmedAt
            };
          });

          logEvent({
            type: 'send.fee.confirmed',
            payload: {
              txId: params.txId,
              txHash: hash,
              chain: params.chainCode,
              feeNative,
              source: snapshot.source
            }
          });
          return;
        } catch (error) {
          lastError = error;
        }
      }

      if (lastError) {
        trackError('send.actual_fee.resolve_failed', lastError, {
          txId: params.txId,
          txHash: hash,
          chain: params.chainCode,
          platform: Platform.OS
        });
      }
    })();
  };

  const completeSendTransaction = (draft: SendDraft, options?: { txHash?: string }) => {
    const isNftDraft = draft.assetType === 'nft';
    const txHash = options?.txHash?.trim() || generateTxHash(draft.chainCode);
    const createdAt = nowStamp();
    const txId = `tx-${Date.now()}`;

    setTxs((prev) => [
      {
        id: txId,
        tokenSymbol: isNftDraft ? 'NFT' : draft.tokenSymbol,
        network: draft.network,
        chain: draft.chainCode,
        type: 'send',
        status: 'completed',
        amount: draft.amount,
        usdValue: draft.usdValue,
        counterparty: draft.recipient,
        memo: draft.memo,
        createdAt,
        hash: txHash,
        feeNative: draft.feeNative,
        feeUsd: draft.feeUsd,
        feeStatus: 'estimated'
      },
      ...prev
    ]);

    setTokens((prev) => {
      const nativeAsset = chainNativeAssetMap[draft.chainCode];
      return prev.map((token) => {
        if (token.chainCode !== draft.chainCode) return token;
        const isTransferToken = !isNftDraft && token.id === draft.tokenId;
        const isNativeToken = token.assetKey === nativeAsset;
        if (!isTransferToken && !isNativeToken) return token;

        let nextBalance = token.balance;
        if (isTransferToken) nextBalance -= draft.amount;
        if (isNativeToken) nextBalance -= draft.feeNative;
        return { ...token, balance: Math.max(0, nextBalance) };
      });
    });
    if (isNftDraft && draft.nftId) {
      setCollectibles((prev) => prev.map((item) => (item.id === draft.nftId ? { ...item, owned: Math.max(0, item.owned - 1) } : item)));
    }

    setTxDetailData({
      txId,
      hash: txHash,
      txType: 'send',
      tokenSymbol: isNftDraft ? 'NFT' : draft.tokenSymbol,
      chainCode: draft.chainCode,
      network: draft.network,
      amount: draft.amount,
      usdValue: draft.usdValue,
      createdAt,
      recipient: draft.recipient,
      recipientLabel: draft.recipientLabel,
      status: 'completed',
      feeNative: draft.feeNative,
      feeUsd: draft.feeUsd,
      feeStatus: 'estimated',
      gas: draft.gas,
      memo: draft.memo
    });
    setSendDraft(draft);
    setSendIsProcessing(false);
    setSendIsDone(true);
    if (isNftDraft) {
      resetNftSendState();
    } else {
      setAmountInput('');
      setRecipientInput('');
      setSendMemoInput('');
      setRecipientTouched(false);
      setAmountTouched(false);
    }
    logEvent({
      type: 'send.completed',
      payload: {
        txId,
        txHash,
        chain: draft.chainCode,
        symbol: draft.tokenSymbol,
        amount: draft.amount,
        assetType: isNftDraft ? 'nft' : 'asset'
      }
    });
    if (sendFlowStartedAtRef.current) {
      trackPerformance('send.flow.total', sendFlowStartedAtRef.current, {
        chain: draft.chainCode,
        symbol: draft.tokenSymbol,
        authMethod: sendAuthMethod
      });
      sendFlowStartedAtRef.current = null;
    }
    setBannerMessage(isNftDraft ? nftUi.sent : text.sendSuccess);

    resolveActualFeeForSentTx({
      txId,
      txHash,
      chainCode: draft.chainCode
    });
  };

  const confirmSendWithAuth = async (overrideInput?: string) => {
    if (!sendDraft) return;
    if (sendIsProcessing) return;
    if (sendAuthMethod === 'password') {
      if (!ensurePasswordAuthReady()) return;
      if (normalizePassword(overrideInput ?? authPasswordInput) !== normalizePassword(sendPassword)) {
        setAuthPasswordInput('');
        setAuthErrorMessage('');
        const backoffMs = registerPasswordAuthFailure();
        setBannerMessage(`${flow.authInvalid} ${buildPasswordAuthLockedMessage(backoffMs)}`);
        return;
      }
      resetPasswordAuthFailure();
    } else {
      const authenticated = await authenticateWithBiometricMode(sendAuthMethod, flow.authTitle);
      if (!authenticated) return;
    }
    setAuthErrorMessage('');

    const selectedWallet = walletAccounts.find((wallet) => wallet.id === walletId) ?? activeWallet ?? walletAccounts[0] ?? null;
    if (!selectedWallet) {
      setBannerMessage(
        lang === 'ko'
          ? '활성 지갑 정보를 찾을 수 없습니다.'
          : lang === 'zh'
            ? '未找到当前钱包信息。'
            : 'Active wallet information is missing.'
      );
      return;
    }

    const seedWords = walletSeedMap[selectedWallet.id];
    if (!Array.isArray(seedWords) || !isValidRecoverySeedWords(seedWords)) {
      setBannerMessage(
        lang === 'ko'
          ? '이 지갑의 복구 구문 정보가 없어 전송할 수 없습니다. 지갑을 다시 복구해주세요.'
          : lang === 'zh'
            ? '该钱包缺少助记词信息，无法转账。请重新恢复钱包。'
            : 'This wallet is missing recovery-phrase data. Please recover it again before sending.'
      );
      return;
    }

    const isNftDraft = sendDraft.assetType === 'nft';
    const selectedNftOnchainItem = isNftDraft ? collectibles.find((item) => item.id === sendDraft.nftId) ?? null : null;
    if (isNftDraft && !selectedNftOnchainItem) {
      setBannerMessage(
        lang === 'ko'
          ? '선택한 NFT 정보를 찾을 수 없습니다.'
          : lang === 'zh'
            ? '未找到所选 NFT 信息。'
            : 'Could not find the selected NFT metadata.'
      );
      return;
    }

    const transferAsset = sendDraft.tokenSymbol.trim().toUpperCase() === 'USDT' ? 'USDT' : 'NATIVE';
    if (!isNftDraft) {
      const chainTicker = chainTickerMap[sendDraft.chainCode];
      if (transferAsset === 'NATIVE' && sendDraft.tokenSymbol.trim().toUpperCase() !== chainTicker) {
        setBannerMessage(
          lang === 'ko'
            ? '현재 실거래 전송은 네트워크 기본자산 또는 USDT만 지원됩니다.'
            : lang === 'zh'
              ? '当前仅支持网络原生资产或 USDT 的实链转账。'
              : 'Real on-chain transfer currently supports native coin or USDT only.'
        );
        return;
      }
      if (transferAsset === 'USDT' && sendDraft.chainCode !== 'ETH' && sendDraft.chainCode !== 'BSC' && sendDraft.chainCode !== 'TRX') {
        setBannerMessage(
          lang === 'ko'
            ? 'USDT 실거래 전송은 ETH/BSC/TRX 네트워크에서만 지원됩니다.'
            : lang === 'zh'
              ? 'USDT 实链转账仅支持 ETH/BSC/TRX 网络。'
              : 'USDT on-chain transfer is supported only on ETH/BSC/TRX.'
        );
        return;
      }
    }

    const amountToPlainString = (value: number) => {
      if (!Number.isFinite(value) || value <= 0) return '';
      const text = value.toString();
      if (!/[eE]/.test(text)) return text;
      const [mantissaRaw, exponentRaw] = text.toLowerCase().split('e');
      const exponent = Number(exponentRaw);
      if (!Number.isFinite(exponent)) return '';
      const negative = mantissaRaw.startsWith('-');
      const mantissa = negative ? mantissaRaw.slice(1) : mantissaRaw;
      const [wholePart, fractionPart = ''] = mantissa.split('.');
      const digits = `${wholePart}${fractionPart}`.replace(/^0+/, '') || '0';
      const decimalIndex = wholePart.length + exponent;
      let normalized = '';
      if (decimalIndex <= 0) {
        normalized = `0.${'0'.repeat(Math.abs(decimalIndex))}${digits}`;
      } else if (decimalIndex >= digits.length) {
        normalized = `${digits}${'0'.repeat(decimalIndex - digits.length)}`;
      } else {
        normalized = `${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
      }
      return negative ? `-${normalized}` : normalized;
    };

    const draftGas = sendDraft.gas;
    const parsedManualGasPrice = Number(draftGas.gasPrice);
    const parsedManualGasLimit = Number(draftGas.gasLimit);
    const parsedManualNonce = Number(draftGas.nonce);
    const manualGasPriceGwei =
      draftGas.gasPrice.trim() !== DEFAULT_SEND_GAS_SETTINGS.gasPrice && Number.isFinite(parsedManualGasPrice) && parsedManualGasPrice > 0
        ? parsedManualGasPrice
        : undefined;
    const manualGasLimit =
      draftGas.gasLimit.trim() !== DEFAULT_SEND_GAS_SETTINGS.gasLimit && Number.isFinite(parsedManualGasLimit) && parsedManualGasLimit > 0
        ? Math.floor(parsedManualGasLimit)
        : undefined;
    const manualNonce =
      draftGas.nonce.trim() !== DEFAULT_SEND_GAS_SETTINGS.nonce && Number.isFinite(parsedManualNonce) && parsedManualNonce >= 0
        ? Math.floor(parsedManualNonce)
        : undefined;

    if (isNftDraft && sendDraft.chainCode !== 'ETH' && sendDraft.chainCode !== 'BSC' && sendDraft.chainCode !== 'SOL' && sendDraft.chainCode !== 'TRX') {
      setBannerMessage(
        lang === 'ko'
          ? '현재 NFT 실거래 전송은 ETH/BSC/SOL/TRX 네트워크에서만 지원됩니다.'
          : lang === 'zh'
            ? '当前 NFT 实链转账仅支持 ETH/BSC/SOL/TRX 网络。'
            : 'NFT on-chain transfer is supported only on ETH/BSC/SOL/TRX.'
      );
      return;
    }

    const amountText = isNftDraft ? '' : amountInput.trim() || amountToPlainString(sendDraft.amount);
    if (!isNftDraft && !amountText) {
      setBannerMessage(text.invalidAmount);
      return;
    }

    setSendIsProcessing(true);
    setSendIsDone(false);
    navigate('sendProcessing');

    try {
      const result = isNftDraft
        ? await sendOnchainNftTransaction({
            chain: sendDraft.chainCode as 'ETH' | 'BSC' | 'SOL' | 'TRX',
            contractAddress: selectedNftOnchainItem!.contractAddress,
            tokenId: selectedNftOnchainItem!.tokenId,
            fromAddress: activeWalletChainAddresses[sendDraft.chainCode],
            toAddress: sendDraft.recipient,
            seedWords,
            accountIndex: normalizeAccountIndex(walletAccountIndexMap[selectedWallet.id] ?? 0),
            passphrase: walletSeedPassphraseMap[selectedWallet.id] ?? '',
            manualGasPriceGwei,
            manualGasLimit,
            manualNonce
          })
        : await sendOnchainTransaction({
            chain: sendDraft.chainCode,
            asset: transferAsset,
            amountText,
            fromAddress: activeWalletChainAddresses[sendDraft.chainCode],
            toAddress: sendDraft.recipient,
            seedWords,
            accountIndex: normalizeAccountIndex(walletAccountIndexMap[selectedWallet.id] ?? 0),
            passphrase: walletSeedPassphraseMap[selectedWallet.id] ?? '',
            manualGasPriceGwei,
            manualGasLimit,
            manualNonce,
            txDataHex: sendDraft.gas.txData.trim() || undefined
          });

      const appliedDraft: SendDraft =
        typeof result.nonce === 'number' || typeof result.gasLimit === 'number'
          ? {
              ...sendDraft,
              gas: {
                ...sendDraft.gas,
                nonce: typeof result.nonce === 'number' ? String(result.nonce) : sendDraft.gas.nonce,
                gasLimit: typeof result.gasLimit === 'number' && result.gasLimit > 0 ? String(result.gasLimit) : sendDraft.gas.gasLimit
              }
            }
          : sendDraft;

      completeSendTransaction(appliedDraft, { txHash: result.txHash });
    } catch (error) {
      setSendIsProcessing(false);
      setSendIsDone(false);
      navigate('sendConfirm');

      let fallbackMessage =
        lang === 'ko'
          ? '실거래 전송에 실패했습니다. 잠시 후 다시 시도해주세요.'
          : lang === 'zh'
            ? '实链转账失败，请稍后重试。'
            : 'On-chain transfer failed. Please try again shortly.';

      if (error instanceof OnchainSendError) {
        if (error.code === 'invalid_amount') fallbackMessage = text.invalidAmount;
        if (error.code === 'invalid_recipient') fallbackMessage = text.addressInvalid;
        if (error.code === 'invalid_token') {
          fallbackMessage =
            lang === 'ko'
              ? 'NFT 토큰 식별자 정보가 올바르지 않습니다.'
              : lang === 'zh'
                ? 'NFT 代币标识信息无效。'
                : 'The NFT token identifier is invalid.';
        }
        if (error.code === 'unsupported_asset' || error.code === 'unsupported_chain') {
          fallbackMessage =
            lang === 'ko'
              ? '선택한 네트워크/자산 조합은 아직 실거래 전송을 지원하지 않습니다.'
              : lang === 'zh'
                ? '当前尚不支持该网络/资产组合的实链转账。'
                : 'This network/asset combination is not yet supported for live on-chain transfer.';
        }
        if (error.code === 'insufficient_balance') {
          fallbackMessage =
            lang === 'ko'
              ? '잔액이 부족합니다. 네트워크 수수료를 포함해 다시 확인해주세요.'
              : lang === 'zh'
                ? '余额不足，请包含网络手续费后重试。'
                : 'Insufficient balance. Please include network fee and try again.';
        }
        if (error.code === 'sender_mismatch') {
          fallbackMessage =
            lang === 'ko'
              ? '현재 지갑 주소와 시드 정보가 일치하지 않아 전송을 진행할 수 없습니다.'
              : lang === 'zh'
                ? '当前钱包地址与助记词信息不一致，无法转账。'
                : 'Wallet address and seed data do not match, so transfer was blocked.';
        }
      }

      trackError('send.onchain.broadcast_failed', error, {
        chain: sendDraft.chainCode,
        tokenId: sendDraft.tokenId,
        symbol: sendDraft.tokenSymbol,
        platform: Platform.OS
      });
      setBannerMessage(fallbackMessage);
    }
  };

  const openSendTxDetail = () => {
    if (!txDetailData) return;
    setTxDetailHeaderMode('postSend');
    navigate('sendTxDetail');
  };

  const getTxStatusText = (status: TxDetailData['status']) =>
    status === 'completed' ? flow.completed : status === 'pending' ? flow.pending : flow.failed;
  const getTxDetailTitle = (txType: TxDetailData['txType']) => (txType === 'receive' ? text.receive : text.send);

  const shareTxDetail = async () => {
    if (!txDetailData) return;
    const explorerUrl = buildTxExplorerUrl(txDetailData.chainCode, txDetailData.hash);
    const statusText = getTxStatusText(txDetailData.status);
    const txTitle = getTxDetailTitle(txDetailData.txType);
    const shareTitle = `${txTitle} ${txDetailData.tokenSymbol}`;
    const shareMessage = [
      `${flow.txHash}: ${txDetailData.hash}`,
      `${flow.status}: ${statusText}`,
      `${text.network}: ${txDetailData.network}`,
      `${text.amount}: ${formatAmount(txDetailData.amount, text.locale)} ${txDetailData.tokenSymbol}`,
      explorerUrl
    ].join('\n');

    try {
      if (Platform.OS === 'web') {
        const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: (data: any) => Promise<void> }) : null;
        if (nav?.share) {
          await nav.share({
            title: shareTitle,
            text: shareMessage,
            url: explorerUrl
          });
          logEvent({ type: 'tx.share.native', payload: { chain: txDetailData.chainCode, hash: txDetailData.hash } });
          return;
        }

        await Clipboard.setStringAsync(explorerUrl);
        setBannerMessage(text.addressCopied);
        logEvent({ type: 'tx.share.link_copied', payload: { chain: txDetailData.chainCode, hash: txDetailData.hash } });
        return;
      }

      await Share.share({
        title: shareTitle,
        message: shareMessage,
        url: explorerUrl
      });
      setBannerMessage(flow.txShared);
      logEvent({ type: 'tx.share.native', payload: { chain: txDetailData.chainCode, hash: txDetailData.hash } });
    } catch (error) {
      trackError('tx.share_failed', error, { chain: txDetailData.chainCode, hash: txDetailData.hash, platform: Platform.OS });
    }
  };

  const openTxInExplorer = async () => {
    if (!txDetailData) return;
    const explorerUrl = buildTxExplorerUrl(txDetailData.chainCode, txDetailData.hash);

    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const opened = window.open(explorerUrl, '_blank', 'noopener,noreferrer');
        if (!opened) {
          window.location.href = explorerUrl;
        }
      } else {
        await Linking.openURL(explorerUrl);
      }
      logEvent({ type: 'tx.explorer.open', payload: { chain: txDetailData.chainCode, hash: txDetailData.hash } });
    } catch (error) {
      trackError('tx.explorer_open_failed', error, { chain: txDetailData.chainCode, hash: txDetailData.hash, platform: Platform.OS });
      setBannerMessage(flow.explorerOpenFailed);
    }
  };

  const openHistoryTxDetail = (tx: WalletTxItem) => {
    const chainCode = inferChainFromTx(tx);
    const hash = tx.hash?.trim() || buildMockHashFromSeed(chainCode, `${tx.id}-${tx.counterparty}-${tx.createdAt}`);
    const tokenPriceOnWallet = tokens.find((token) => token.symbol.toUpperCase() === tx.tokenSymbol.toUpperCase())?.priceUsd;
    const tokenPriceCatalog = tokenCatalog.find((token) => token.symbol.toUpperCase() === tx.tokenSymbol.toUpperCase())?.priceUsd;
    const tokenPrice = tokenPriceOnWallet ?? tokenPriceCatalog ?? 0;
    const amount = tx.amount;
    const usdValue = tx.usdValue > 0 ? tx.usdValue : amount * tokenPrice;

    const fallbackGas: SendGasSettings = {
      gasPrice: '0.1',
      gasLimit: '21000',
      txData: '',
      nonce: '0'
    };
    const savedFeeNative = Number(tx.feeNative ?? 0);
    const feeNative = Number.isFinite(savedFeeNative) && savedFeeNative > 0 ? savedFeeNative : estimateRuntimeNativeFee(chainCode, fallbackGas);
    const savedFeeUsd = Number(tx.feeUsd ?? 0);
    const feeUsd = Number.isFinite(savedFeeUsd) && savedFeeUsd > 0 ? savedFeeUsd : calculateFeeUsd(chainCode, feeNative);

    setTxDetailData({
      txId: tx.id,
      hash,
      txType: tx.type,
      tokenSymbol: tx.tokenSymbol.toUpperCase(),
      chainCode,
      network: tx.network,
      amount,
      usdValue,
      createdAt: tx.createdAt,
      recipient: tx.counterparty,
      recipientLabel: findAddressBookLabel(chainCode, tx.counterparty),
      status: tx.status,
      feeNative,
      feeUsd,
      feeStatus: tx.feeStatus,
      feeConfirmedAt: tx.feeConfirmedAt,
      gas: fallbackGas,
      memo: tx.memo
    });
    setTxDetailHeaderMode('history');
    navigate('sendTxDetail');

    if (tx.hash?.trim() && tx.feeStatus !== 'confirmed') {
      resolveActualFeeForSentTx({
        txId: tx.id,
        txHash: tx.hash,
        chainCode
      });
    }
  };

  const openAssetDetail = (token: WalletToken) => {
    setAssetDetailTokenId(token.id);
    setAssetRecentPage(1);
    setAssetChartRange('1D');
    setAssetInfoExpanded(false);
    setAssetChartWidth(0);
    navigate('assetDetail');
  };

  const openSendWithToken = (token: WalletToken) => {
    skipNextSendResetRef.current = true;
    setSendChainFilter(token.chainCode);
    setSendChainCode(token.chainCode);
    setSendAssetFilterTokenId(token.id);
    setSendTokenId(token.id);
    navigate('send');
  };

  const openReceiveWithToken = (token: WalletToken) => {
    skipNextReceiveResetRef.current = true;
    setReceiveChainFilter(token.chainCode);
    setReceiveChainCode(token.chainCode);
    setReceiveAssetFilterTokenId(token.id);
    setReceiveTokenId(token.id);
    navigate('receive');
  };

  const openHistoryWithToken = (token: WalletToken) => {
    skipNextHistoryResetRef.current = true;
    setHistoryScopeFilter('ASSET');
    setHistoryChainFilter(token.chainCode);
    setHistoryAssetFilter(token.assetKey);
    setHistoryPage(1);
    navigate('history');
  };

  const openNftReceiveScreen = (_item?: CollectibleItem, options?: { replaceTop?: boolean }) => {
    if (options?.replaceTop) {
      replaceTopScreen('nftReceive');
      return;
    }
    navigate('nftReceive');
  };

  const openNftSendScreen = (item?: CollectibleItem, options?: { replaceTop?: boolean }) => {
    const nextOwned = collectibles.filter((collectible) => collectible.owned > 0);
    if (!nextOwned.length) {
      setBannerMessage(nftUi.noNftOwned);
      return;
    }
    const nextItem = item ?? nextOwned[0];
    setNftSendCollectibleId(nextItem.id);
    setNftSendRecipientInput('');
    setNftSendMemoInput('');
    setNftSendRecipientTouched(false);
    setNftSendRecipientFocused(false);
    if (options?.replaceTop) {
      replaceTopScreen('nftSend');
      return;
    }
    navigate('nftSend');
  };

  const openNftDetailScreen = (item: CollectibleItem) => {
    setNftDetailCollectibleId(item.id);
    navigate('nftDetail');
  };

  const submitNftSend = async () => {
    if (!selectedNftForSend) {
      setBannerMessage(nftUi.noNftOwned);
      return;
    }

    const recipient = nftSendRecipientInput.trim();
    setNftSendRecipientTouched(true);
    const recipientIssue = getNftRecipientError(recipient, selectedNftForSend);
    if (recipientIssue) {
      setBannerMessage(recipientIssue);
      return;
    }

    const chainCode = getCollectibleChainCode(selectedNftForSend);
    const recipientLabel = findNftAddressBookLabel(chainCode, recipient);
    const gas = { ...DEFAULT_SEND_GAS_SETTINGS };
    let feeNative = estimateRuntimeNativeFee(chainCode, gas);
    if (chainCode === 'FIL') {
      const latestSnapshot = await fetchLatestFilFeeSnapshot({
        fromAddress: activeWalletChainAddresses.FIL,
        toAddress: recipient,
        amountNative: 0
      });
      const latestFee = Number(latestSnapshot?.nativeFee ?? 0);
      if (Number.isFinite(latestFee) && latestFee > 0) {
        feeNative = latestFee;
      }
    }
    const feeUsd = calculateFeeUsd(chainCode, feeNative);
    const networkFeeIssue = validateSendNetworkFeeBudget({
      chain: chainCode,
      tokenId: '__NFT__',
      amount: 0,
      feeNative
    });
    if (networkFeeIssue) {
      setBannerMessage(networkFeeIssue);
      return;
    }
    const memoText = nftSendMemoInput.trim();
    const txMemo = `${selectedNftForSend.name}${memoText ? ` / ${memoText}` : ''}`;
    const nftDraft: SendDraft = {
      tokenId: '__NFT__',
      tokenSymbol: 'NFT',
      chainCode,
      network: selectedNftForSend.network,
      assetType: 'nft',
      nftId: selectedNftForSend.id,
      nftName: selectedNftForSend.name,
      recipient,
      recipientLabel,
      amount: 1,
      memo: txMemo,
      usdValue: selectedNftForSend.floorPriceUsd,
      feeUsd,
      feeNative,
      gas
    };
    sendFlowStartedAtRef.current = Date.now();
    setSendDraft(nftDraft);
    setAuthPasswordInput('');
    setAuthErrorMessage('');
    setSendIsDone(false);
    setSendIsProcessing(false);
    navigate('sendConfirm');
  };

  const toggleFavoriteAsset = (tokenId: string) => {
    setFavoriteTokenIds((prev) => {
      if (prev.includes(tokenId)) {
        return prev.filter((id) => id !== tokenId);
      }
      return [...prev, tokenId];
    });
  };

  const isAnyDropdownBackdropActive =
    showWalletMenu ||
    showLangMenu ||
    showAutoLockMenu ||
    showLockMethodMenu ||
    showBiometricTypeMenu ||
    showDiscoverBriefingWeekMenu ||
    showAddressBookEditModal ||
    showRecipientBookModal ||
    showSaveRecipientModal ||
    showScanMethodModal ||
    showHomeAssetLayoutModal ||
    showHistoryDateRangeModal ||
    showHistoryDateCalendarModal ||
    showRecentSendDropdown ||
    showNftRecentSendDropdown;

  const isBottomDockInteractionBlocked =
    (currentScreen === 'home' && (showWalletMenu || showHomeAssetLayoutModal || (showScanMethodModal && scanEntryPoint === 'home'))) ||
    (currentScreen === 'send' &&
      (showRecentSendDropdown ||
        (showScanMethodModal && scanEntryPoint === 'send') ||
        (showRecipientBookModal && recipientBookScope === 'asset') ||
        (showSaveRecipientModal && saveRecipientScope === 'asset'))) ||
    (currentScreen === 'nftSend' &&
      (showNftRecentSendDropdown ||
        (showScanMethodModal && scanEntryPoint === 'nftSend') ||
        (showRecipientBookModal && recipientBookScope === 'nft') ||
        (showSaveRecipientModal && saveRecipientScope === 'nft'))) ||
    (currentScreen === 'history' && (showHistoryDateRangeModal || showHistoryDateCalendarModal)) ||
    (currentScreen === 'discoverBriefingBoard' && showDiscoverBriefingWeekMenu);
  const isBottomDockDimmed = isBottomDockInteractionBlocked && !showWalletMenu;

  const renderTopHeader = (
    title: string,
    leftIcon: keyof typeof Ionicons.glyphMap,
    leftAction: () => void,
    rightItems?: {
      icon?: keyof typeof Ionicons.glyphMap;
      materialIcon?: React.ComponentProps<typeof MaterialIcons>['name'];
      action: () => void;
      color?: string;
    }[]
  ) => (
    <View style={styles.subHeader}>
      {isAnyDropdownBackdropActive ? null : renderHeaderBackdrop()}
      <View pointerEvents="none" style={styles.topHeaderTitleLayer}>
        <Text numberOfLines={1} style={styles.subHeaderTitle}>
          {title}
        </Text>
      </View>
      <View style={styles.topHeaderSide}>
        <Pressable style={styles.backBtn} hitSlop={HEADER_BUTTON_HIT_SLOP} onPress={leftAction}>
          <ThemedIonicons
            name={leftIcon}
            size={18}
            color={palette.text}
            style={[
              styles.backBtnIconGlyph,
              leftIcon === 'chevron-back' || leftIcon === 'chevron-back-outline' ? styles.backBtnChevronGlyph : undefined
            ]}
          />
        </Pressable>
      </View>
      <View style={[styles.topHeaderSide, styles.topHeaderSideRight]}>
        {(rightItems ?? []).map((item, index) => (
          <Pressable
            key={`${title}-r-${index}`}
            style={[styles.backBtn, index > 0 ? styles.headerBtnGap : undefined]}
            hitSlop={HEADER_BUTTON_HIT_SLOP}
            onPress={item.action}
          >
            {item.materialIcon ? (
              <MaterialIcons name={item.materialIcon} size={19} color={item.color ?? palette.text} style={styles.backBtnIconGlyph} />
            ) : (
              <ThemedIonicons name={item.icon ?? 'ellipse-outline'} size={18} color={item.color ?? palette.text} style={styles.backBtnIconGlyph} />
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderSubHeader = (
    title: string,
    rightItems?: {
      icon?: keyof typeof Ionicons.glyphMap;
      materialIcon?: React.ComponentProps<typeof MaterialIcons>['name'];
      action: () => void;
      testId?: string;
      color?: string;
    }[]
  ) => (
    <View style={styles.subHeader}>
      {isAnyDropdownBackdropActive ? null : renderHeaderBackdrop()}
      <View pointerEvents="none" style={styles.topHeaderTitleLayer}>
        <Text numberOfLines={1} style={styles.subHeaderTitle}>
          {title}
        </Text>
      </View>
      <View style={styles.topHeaderSide}>
        <Pressable style={styles.backBtn} hitSlop={HEADER_BUTTON_HIT_SLOP} onPress={goBack}>
          <ThemedIonicons name="chevron-back" size={20} color={palette.text} style={[styles.backBtnIconGlyph, styles.backBtnChevronGlyph]} />
        </Pressable>
      </View>
      <View style={[styles.topHeaderSide, styles.topHeaderSideRight]}>
        {(rightItems ?? []).map((item, index) => (
          <Pressable
            key={`${title}-sub-r-${index}`}
            testID={item.testId}
            style={[styles.backBtn, index > 0 ? styles.headerBtnGap : undefined]}
            hitSlop={HEADER_BUTTON_HIT_SLOP}
            onPress={item.action}
          >
            {item.materialIcon ? (
              <MaterialIcons name={item.materialIcon} size={19} color={item.color ?? palette.text} style={styles.backBtnIconGlyph} />
            ) : (
              <ThemedIonicons name={item.icon ?? 'ellipse-outline'} size={18} color={item.color ?? palette.text} style={styles.backBtnIconGlyph} />
            )}
          </Pressable>
        ))}
        {!rightItems?.length ? <View style={styles.subHeaderSpacer} /> : null}
      </View>
    </View>
  );

  const renderTokenCircle = (token: WalletToken, options?: { size?: number }) => {
    const iconSize = options?.size ?? 48;
    const iconRadius = iconSize / 2;
    const wrapSize = iconSize + 4;
    const iconRingColor = themeMode === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(13,18,28,0.2)';
    const iconGlowColor = themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(13,18,28,0.18)';
    const showUsdtChainBadge = token.assetKey === 'USDT' && Boolean(token.chainIconSource || token.chainBadge);

    return (
      <View style={[styles.tokenIconWrap, { width: wrapSize, height: wrapSize }]}>
        <View
          style={[
            styles.tokenIcon,
            {
              backgroundColor: token.iconBg,
              width: iconSize,
              height: iconSize,
              borderRadius: iconRadius,
              borderWidth: 1,
              borderColor: iconRingColor,
              shadowColor: iconGlowColor,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 1,
              shadowRadius: 3,
              elevation: 2
            }
          ]}
        >
          {token.iconSource ? (
            <Image
              source={token.iconSource}
              style={{
                width: iconSize,
                height: iconSize,
                borderRadius: iconRadius,
                borderWidth: 1,
                borderColor: iconRingColor
              }}
            />
          ) : (
            <Text style={styles.tokenIconText}>{token.iconGlyph ?? token.symbol[0]}</Text>
          )}
        </View>
        {showUsdtChainBadge ? (
          token.chainIconSource ? (
            <View
              style={[
                styles.chainBadge,
                styles.chainBadgeIconWrap,
                {
                  borderWidth: 1,
                  borderColor: iconRingColor,
                  shadowColor: iconGlowColor,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 1,
                  shadowRadius: 2,
                  elevation: 1
                }
              ]}
            >
              <Image source={token.chainIconSource} style={[styles.chainBadgeImageIcon, { borderWidth: 1, borderColor: iconRingColor }]} />
            </View>
          ) : token.chainBadge ? (
            <View style={styles.chainBadge}>
              <Text style={styles.chainBadgeText}>{token.chainBadge}</Text>
            </View>
          ) : null
        ) : null}
      </View>
    );
  };

  const renderTokenRow = (token: WalletToken) => {
    const usd = token.balance * token.priceUsd;
    const isUp = token.change24h >= 0;
    const isFavorite = favoriteTokenIdSet.has(token.id);
    const deltaUsd = usd * (token.change24h / 100);
    const tokenAmountLabel = showBalance ? formatAmount(token.balance, text.locale, 6) : '•••••';
    const tokenUsdLabel = showBalance ? formatCurrency(usd, text.locale) : '•••••';
    const tokenDeltaUsdLabel = showBalance ? `${deltaUsd >= 0 ? '+' : '-'}${formatCurrency(Math.abs(deltaUsd), text.locale)}` : '•••••';
    const renderFavoriteButton = () => {
      if (!isFavorite) return null;
      return (
        <Pressable
          style={styles.tokenFavoriteBtn}
          onPress={(event) => {
            event.stopPropagation?.();
            toggleFavoriteAsset(token.id);
          }}
        >
          <MaterialIcons name="star" size={14} color={palette.accent} />
        </Pressable>
      );
    };

    const renderLayoutTwo = () => (
      <>
        <View style={styles.tokenMeta}>
          <View style={styles.tokenTopLine}>
            <Text style={styles.tokenSymbol}>{token.symbol}</Text>
            {renderFavoriteButton()}
          </View>
          <Text style={styles.tokenSub} numberOfLines={1}>
            {token.name}
          </Text>
        </View>
        <View style={styles.tokenValueCol}>
          <Text style={[styles.tokenAmount, !showBalance ? styles.tokenAmountMasked : undefined]}>{tokenAmountLabel}</Text>
          <Text style={[styles.tokenUsd, !showBalance ? styles.tokenUsdMasked : undefined]}>{tokenUsdLabel}</Text>
        </View>
      </>
    );

    const renderLayoutOne = () => (
      <>
        <View style={styles.tokenMeta}>
          <View style={styles.tokenTopLine}>
            <Text style={styles.tokenSymbol}>{token.symbol}</Text>
            <View style={styles.tokenNetworkChip}>
              <Text style={styles.tokenNetworkChipText} numberOfLines={1}>
                {token.name}
              </Text>
            </View>
            {renderFavoriteButton()}
          </View>
          <Text style={styles.tokenSub} numberOfLines={1}>
            {showBalance ? formatCurrency(token.priceUsd, text.locale) : '•••••'}{' '}
            <Text style={[styles.tokenChangeInline, { color: isUp ? palette.positive : palette.negative }]}>
              {showBalance ? `${isUp ? '+' : ''}${token.change24h.toFixed(2)}%` : '•••••'}
            </Text>
          </Text>
        </View>
        <View style={styles.tokenValueCol}>
          <Text style={[styles.tokenAmount, !showBalance ? styles.tokenAmountMasked : undefined]}>{tokenAmountLabel}</Text>
          <Text style={[styles.tokenUsd, !showBalance ? styles.tokenUsdMasked : undefined]}>{tokenUsdLabel}</Text>
        </View>
      </>
    );

    const renderLayoutThree = () => (
      <>
        <View style={styles.tokenMeta}>
          <View style={styles.tokenTopLine}>
            <Text style={styles.tokenSymbol}>{token.name}</Text>
            {renderFavoriteButton()}
          </View>
          <Text style={styles.tokenSub} numberOfLines={1}>
            {`${tokenAmountLabel} ${token.symbol}`}
          </Text>
        </View>
        <View style={styles.tokenValueCol}>
          <Text style={[styles.tokenAmount, !showBalance ? styles.tokenAmountMasked : undefined]}>{tokenAmountLabel}</Text>
          <Text style={[styles.tokenUsd, !showBalance ? styles.tokenUsdMasked : undefined]}>{tokenUsdLabel}</Text>
        </View>
      </>
    );

    return (
      <Pressable key={token.id} style={styles.tokenRow} onPress={() => openAssetDetail(token)}>
        {renderTokenCircle(token, { size: 38 })}
        {homeAssetLayout === 1 ? renderLayoutOne() : homeAssetLayout === 2 ? renderLayoutTwo() : renderLayoutThree()}
      </Pressable>
    );
  };

  const renderBottomDock = () => {
    if (!hasWallet) return null;

    const discoverNavScreens: Screen[] = [
      'discover',
      'discoverEarn',
      'discoverExploreDapps',
      'discoverWatchlist',
      'discoverSites',
      'discoverLatest',
      'discoverPopularRanking',
      'discoverBriefingBoard'
    ];
    const isBottomNavScreen =
      currentScreen === 'home' ||
      currentScreen === 'send' ||
      currentScreen === 'nftSend' ||
      currentScreen === 'receive' ||
      currentScreen === 'nftReceive' ||
      currentScreen === 'history' ||
      discoverNavScreens.includes(currentScreen);
    if (!isBottomNavScreen) return null;
    if (showRecentSendDropdown || showNftRecentSendDropdown) return null;
    const discoverDockActive = discoverNavScreens.includes(currentScreen);
    const bottomDockBottomOffset = Math.max(10, effectiveBottomInset + 10);
    const bottomGradientHeight = Math.max(0, bottomDockBottomOffset + 2);

    const navItems: {
      key: 'send' | 'receive' | 'home' | 'history' | 'discover';
      icon: keyof typeof Ionicons.glyphMap;
      active: boolean;
      onPress: () => void;
      center?: boolean;
    }[] = [
      { key: 'send', icon: 'arrow-up-outline', active: currentScreen === 'send' || currentScreen === 'nftSend', onPress: () => openRoot('send') },
      {
        key: 'receive',
        icon: 'arrow-down-outline',
        active: currentScreen === 'receive' || currentScreen === 'nftReceive',
        onPress: () => openRoot('receive')
      },
      { key: 'home', icon: 'home-outline', active: currentScreen === 'home', onPress: () => openRoot('home'), center: true },
      { key: 'history', icon: 'time-outline', active: currentScreen === 'history', onPress: () => openRoot('history') },
      { key: 'discover', icon: 'compass-outline', active: discoverDockActive, onPress: () => openRoot('discover') }
    ];

    return (
      <>
        <View pointerEvents="none" style={[styles.bottomSystemGradient, { height: bottomGradientHeight }]}>
          <LinearGradient
            colors={bottomSystemGradientColors}
            start={{ x: 0.5, y: 1 }}
            end={{ x: 0.5, y: 0 }}
            style={styles.bottomSystemGradientLayer}
          />
        </View>
        <View pointerEvents={isBottomDockInteractionBlocked ? 'none' : 'auto'} style={[styles.bottomWrap, { bottom: bottomDockBottomOffset }]}>
          <View style={styles.bottomDock}>
	            {navItems.map((item) => {
		              const iconColor = item.center ? '#101010' : item.active ? palette.accent : palette.text;
		              return (
	                <Pressable
	                  key={`bottom-nav-${item.key}`}
                style={[
                  styles.bottomBtn,
                  item.center ? styles.bottomBtnCenter : undefined,
                  item.active && !item.center ? styles.bottomBtnActive : undefined
                ]}
	                  onPress={item.onPress}
	                >
                {item.key === 'home' ? (
                  <MaterialIcons name="home" size={item.center ? 21 : 20} color={iconColor} />
                ) : (
                  <ThemedIonicons name={item.icon} size={item.center ? 22 : 21} color={iconColor} />
                )}
	                </Pressable>
	              );
	            })}
            {isBottomDockDimmed ? <View pointerEvents="none" style={styles.bottomDockDimLayer} /> : null}
          </View>
        </View>
      </>
    );
  };

  const closeRecentSendOverlay = () => {
    setShowRecentSendDropdown(false);
    setShowNftRecentSendDropdown(false);
  };

  const closeTopDropdownOverlay = () => {
    setShowWalletMenu(false);
    closeRecentSendOverlay();
  };

  const renderRecipientActionTriggerOverlay = (
    scope: 'asset' | 'nft',
    action: 'scan' | 'book' | 'save' | null
  ) => {
    if (!action) return null;
    const rectMap = scope === 'asset' ? assetRecipientActionAnchorRectMap : nftRecipientActionAnchorRectMap;
    const rect = rectMap[action];
    if (!rect) return null;

    const closeActionOverlay = () => {
      if (action === 'scan') {
        setShowScanMethodModal(false);
        return;
      }
      if (action === 'book') {
        setShowRecipientBookModal(false);
        return;
      }
      setShowSaveRecipientModal(false);
    };

    const iconName = action === 'scan' ? 'scan-outline' : action === 'book' ? 'book-outline' : 'bookmark-outline';

    return (
      <View pointerEvents="box-none" style={styles.globalDropdownLayer}>
        <Pressable
          style={[
            styles.saveAddressIconBtn,
            styles.iconCircleBtnActive,
            styles.globalRecentOverlayTrigger,
            {
              top: rect.y,
              left: rect.x,
              width: rect.width,
              height: rect.height,
              borderRadius: rect.height / 2
            }
          ]}
          onPress={closeActionOverlay}
        >
          <ThemedIonicons name={iconName} size={16} color="#16110a" />
        </Pressable>
      </View>
    );
  };

  const renderHomeLayoutTriggerOverlay = () => {
    if (!(currentScreen === 'home' && showHomeAssetLayoutModal && homeLayoutTriggerRect)) return null;

    return (
      <View pointerEvents="box-none" style={styles.globalDropdownLayer}>
        <Pressable
          style={[
            styles.assetPanelToolBtn,
            styles.iconCircleBtnActive,
            styles.globalRecentOverlayTrigger,
            {
              top: homeLayoutTriggerRect.y,
              left: homeLayoutTriggerRect.x,
              width: homeLayoutTriggerRect.width,
              height: homeLayoutTriggerRect.height,
              borderRadius: homeLayoutTriggerRect.height / 2
            }
          ]}
          onPress={closeHomeAssetLayoutModal}
        >
          <ThemedIonicons name="options-outline" size={16} color="#16110a" />
        </Pressable>
      </View>
    );
  };

  const renderHistoryRangeTriggerOverlay = () => {
    if (!(currentScreen === 'history' && (showHistoryDateRangeModal || showHistoryDateCalendarModal) && historyRangeTriggerRect)) return null;

    return (
      <View pointerEvents="box-none" style={styles.globalDropdownLayer}>
        <Pressable
          style={[
            styles.historyDateChip,
            styles.historyDateRangeChip,
            styles.historyDateChipActive,
            styles.globalRecentOverlayTrigger,
            {
              top: historyRangeTriggerRect.y,
              left: historyRangeTriggerRect.x,
              width: historyRangeTriggerRect.width,
              height: historyRangeTriggerRect.height,
              borderRadius: historyRangeTriggerRect.height / 2
            }
          ]}
          onPress={() => {
            setShowHistoryDateCalendarModal(false);
            setShowHistoryDateRangeModal(false);
          }}
        >
          <Text style={styles.historyDateChipTextActive}>{text.historyDateRange}</Text>
        </Pressable>
      </View>
    );
  };

  const renderHomeScanTriggerOverlay = () => {
    if (!(currentScreen === 'home' && showScanMethodModal && scanEntryPoint === 'home' && homeScanTriggerRect)) return null;

    return (
      <View pointerEvents="box-none" style={styles.globalDropdownLayer}>
        <Pressable
          style={[
            styles.backBtn,
            styles.iconCircleBtnActive,
            styles.globalRecentOverlayTrigger,
            {
              top: homeScanTriggerRect.y,
              left: homeScanTriggerRect.x,
              width: homeScanTriggerRect.width,
              height: homeScanTriggerRect.height,
              borderRadius: homeScanTriggerRect.height / 2
            }
          ]}
          onPress={() => setShowScanMethodModal(false)}
        >
          <ThemedIonicons name="scan-outline" size={18} color="#16110a" style={styles.backBtnIconGlyph} />
        </Pressable>
      </View>
    );
  };

  const renderRecentSendOverlay = () => {
    const isWalletOverlayOpen = currentScreen === 'home' && showWalletMenu;
    const isAssetOverlayOpen = showRecentSendDropdown;
    const isNftOverlayOpen = showNftRecentSendDropdown;
    if (!isWalletOverlayOpen && !isAssetOverlayOpen && !isNftOverlayOpen) return null;

    if (isWalletOverlayOpen) {
      const walletTriggerTop = walletMenuAnchorRect ? walletMenuAnchorRect.y : topSafeInset + 6;
      const walletListTop = walletMenuAnchorRect ? walletTriggerTop + Math.max(36, walletMenuAnchorRect.height) + 6 : headerOverlayHeightValue + 4;
      return (
        <>
          <Pressable style={styles.globalDropdownScrim} onPress={closeTopDropdownOverlay} />
          <View pointerEvents="box-none" style={styles.globalDropdownLayer}>
            {walletMenuAnchorRect ? (
              <Pressable
                style={[
                  styles.homeWalletPillCenter,
                  styles.homeWalletPillCenterActive,
                  styles.globalRecentOverlayTrigger,
                  {
                    top: walletTriggerTop,
                    left: walletMenuAnchorRect.x,
                    width: walletMenuAnchorRect.width
                  }
                ]}
                onPress={closeTopDropdownOverlay}
              >
                <Text style={[styles.homeWalletPillText, styles.homeWalletPillTextActive]} numberOfLines={1}>
                  {getWalletDisplayName(activeWallet)}
                </Text>
                <ThemedIonicons name="chevron-up" size={16} color="#16110a" style={styles.homeWalletPillChevron} />
              </Pressable>
            ) : null}
            <Animated.View style={[styles.walletMenuWrap, styles.globalWalletMenuWrap, walletMenuAnimatedStyle, { top: walletListTop }]}>
              <ScrollView style={styles.walletMenuList} showsVerticalScrollIndicator={false}>
                {walletAccounts.map((wallet) => {
                  const active = wallet.id === walletId;
                  return (
                    <Pressable
                      key={`wallet-menu-overlay-${wallet.id}`}
                      style={[styles.walletMenuRow, active ? styles.walletMenuRowActive : undefined]}
                      onPress={() => {
                        setWalletId(wallet.id);
                        setShowWalletMenu(false);
                      }}
                    >
                      <View style={styles.walletMenuMeta}>
                        <Text style={[styles.walletMenuName, active ? styles.walletMenuNameActive : undefined]} numberOfLines={1}>
                          {getWalletDisplayName(wallet)}
                        </Text>
                      </View>
                      {active ? <ThemedIonicons name="checkmark-circle" size={18} color={palette.accent} /> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Pressable
                style={styles.walletMenuAddBtn}
                onPress={() => {
                  setShowWalletMenu(false);
                  startCreateWalletFlow();
                }}
              >
                <ThemedIonicons name="add" size={16} color={palette.text} />
              </Pressable>
            </Animated.View>
          </View>
        </>
      );
    }

    const isNftOverlay = isNftOverlayOpen;
    const anchorRect = isNftOverlay ? nftRecentAnchorRect : sendRecentAnchorRect;
    const recentList = isNftOverlay ? recentNftSendTargets : recentSendTargets;
    const latestItem = isNftOverlay ? latestRecentNftSend : latestRecentSend;
    const animatedStyle = isNftOverlay ? nftRecentSendDropdownAnimatedStyle : recentSendDropdownAnimatedStyle;
    const hasAnchorRect = Boolean(anchorRect);
    const triggerTop = hasAnchorRect ? Math.max(headerOverlayHeightValue + 8, anchorRect!.y) : headerOverlayHeightValue + 8;
    const triggerLeft = hasAnchorRect ? anchorRect!.x : 16;
    const triggerWidth = hasAnchorRect ? anchorRect!.width : undefined;

    return (
      <>
        <Pressable
          style={[styles.globalDropdownScrim, !hasAnchorRect ? styles.globalDropdownScrimTransparent : undefined]}
          onPress={closeTopDropdownOverlay}
        />
        <View pointerEvents="box-none" style={styles.globalDropdownLayer}>
          {hasAnchorRect ? (
            <Pressable
              style={[
                styles.recentSummaryBtn,
                styles.sendRecentSummaryBtn,
                styles.recentSummaryBtnActive,
                styles.globalRecentOverlayTrigger,
                {
                  top: triggerTop,
                  left: triggerLeft,
                  width: triggerWidth
                }
              ]}
              onPress={closeRecentSendOverlay}
            >
              <View style={styles.recentSummaryMeta}>
                <Text style={[styles.recipientPrimary, styles.recentSummaryPrimaryActive]} numberOfLines={1}>
                  {latestItem ? shortAddressCenter(latestItem.address, 8, 6) : '-'}
                </Text>
                <Text style={[styles.recipientSecondary, styles.recentSummarySecondaryActive]} numberOfLines={1}>
                  {isNftOverlay
                    ? latestItem
                      ? `${(latestItem as RecentNftSendItem).nftTitle} #${(latestItem as RecentNftSendItem).tokenId}`
                      : ' '
                    : latestItem
                      ? `${formatAmount((latestItem as RecentSendItem).amount, text.locale)} ${(latestItem as RecentSendItem).symbol}`
                      : ' '}
                  {latestItem?.label ? <Text style={styles.recentSummarySecondaryAccentActive}> / {latestItem.label}</Text> : null}
                  {latestItem ? ` / ${latestItem.memo ?? '-'} / ${latestItem.date}` : ''}
                </Text>
              </View>
              <ThemedIonicons name="chevron-up" size={16} color="#16110a" />
            </Pressable>
          ) : null}

          <View pointerEvents="box-none" style={styles.globalBottomRecentOverlayWrap}>
            <Animated.View style={[styles.modalCard, animatedStyle]}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{isNftOverlay ? nftRecentSendTitle : text.recentSends}</Text>
                <Pressable style={styles.modalCloseBtn} onPress={closeRecentSendOverlay}>
                  <ThemedIonicons name="close" size={18} color={palette.text} />
                </Pressable>
              </View>
              <ScrollView style={[styles.modalList, styles.globalBottomRecentOverlayList]}>
                {isNftOverlay
                  ? recentList.map((item) => (
                      <Pressable
                        key={`overlay-nft-recent-${(item as RecentNftSendItem).address}-${(item as RecentNftSendItem).tokenId}-${(item as RecentNftSendItem).date}`}
                        style={styles.modalRow}
                        onPress={() => {
                          const selected = item as RecentNftSendItem;
                          setNftSendRecipientInput(selected.address);
                          setNftSendRecipientTouched(false);
                          closeRecentSendOverlay();
                        }}
                      >
                        <View style={styles.modalRowIcon}>
                          <ThemedIonicons name="bookmark-outline" size={15} color={palette.accent} />
                        </View>
                        <View style={styles.modalRowMeta}>
                          <Text style={styles.modalPrimary} numberOfLines={1}>
                            {shortAddressCenter((item as RecentNftSendItem).address, 8, 6)}
                          </Text>
                          <Text style={styles.modalSecondary} numberOfLines={1}>
                            {(item as RecentNftSendItem).nftTitle} #{(item as RecentNftSendItem).tokenId}
                            {(item as RecentNftSendItem).label ? (
                              <Text style={styles.recipientSecondaryAccent}> / {(item as RecentNftSendItem).label}</Text>
                            ) : null}
                            {` / ${(item as RecentNftSendItem).memo ?? '-'} / ${(item as RecentNftSendItem).date}`}
                          </Text>
                        </View>
                        <ThemedIonicons name="chevron-forward" size={16} color={palette.muted} />
                      </Pressable>
                    ))
                  : recentList.map((item) => (
                      <Pressable
                        key={`overlay-recent-${(item as RecentSendItem).address}-${(item as RecentSendItem).date}`}
                        style={styles.modalRow}
                        onPress={() => {
                          const selected = item as RecentSendItem;
                          setRecipientInput(selected.address);
                          setRecipientTouched(false);
                          applyRecentSendSelection(selected);
                          closeRecentSendOverlay();
                        }}
                      >
                        <View style={styles.modalRowIcon}>
                          <ThemedIonicons name="bookmark-outline" size={15} color={palette.accent} />
                        </View>
                        <View style={styles.modalRowMeta}>
                          <Text style={styles.modalPrimary} numberOfLines={1}>
                            {shortAddressCenter((item as RecentSendItem).address, 8, 6)}
                          </Text>
                          <Text style={styles.modalSecondary} numberOfLines={1}>
                            {formatAmount((item as RecentSendItem).amount, text.locale)} {(item as RecentSendItem).symbol}
                            {(item as RecentSendItem).label ? (
                              <Text style={styles.recipientSecondaryAccent}> / {(item as RecentSendItem).label}</Text>
                            ) : null}
                            {` / ${(item as RecentSendItem).memo ?? '-'} / ${(item as RecentSendItem).date}`}
                          </Text>
                        </View>
                        <ThemedIonicons name="chevron-forward" size={16} color={palette.muted} />
                      </Pressable>
                    ))}
              </ScrollView>
            </Animated.View>
          </View>
        </View>
      </>
    );
  };

  const renderHomeHeader = () => (
    <View
      style={[
        styles.subHeader,
        styles.homeHeaderOverlay,
        showWalletMenu ? styles.homeHeaderOverlayOpen : undefined
      ]}
    >
      {isAnyDropdownBackdropActive ? null : renderHeaderBackdrop()}
      <Pressable style={styles.backBtn} hitSlop={HEADER_BUTTON_HIT_SLOP} onPress={() => navigate('settings')}>
        <ThemedIonicons name="settings-outline" size={18} color={palette.text} style={styles.backBtnIconGlyph} />
      </Pressable>
      <View pointerEvents="box-none" style={styles.homeWalletPillCenterWrap}>
        <View ref={homeWalletAnchorRef} style={styles.homeWalletAnchor} onLayout={measureWalletMenuAnchor}>
          <Pressable
            style={[styles.homeWalletPillCenter, showWalletMenu ? styles.homeWalletPillCenterActive : undefined]}
            onPress={() => {
              setShowWalletMenu((prev) => {
                if (prev) return false;
                measureWalletMenuAnchor();
                return true;
              });
            }}
          >
            <Text style={[styles.homeWalletPillText, showWalletMenu ? styles.homeWalletPillTextActive : undefined]} numberOfLines={1}>
              {getWalletDisplayName(activeWallet)}
            </Text>
            <ThemedIonicons
              name={showWalletMenu ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={showWalletMenu ? '#16110a' : palette.text}
              style={styles.homeWalletPillChevron}
            />
          </Pressable>
        </View>
      </View>
      <Pressable
        ref={homeScanTriggerRef}
        onLayout={measureHomeScanTriggerAnchor}
        style={[styles.backBtn, showScanMethodModal && scanEntryPoint === 'home' ? styles.iconCircleBtnActive : undefined]}
        hitSlop={HEADER_BUTTON_HIT_SLOP}
        onPress={() => {
          measureHomeScanTriggerAnchor();
          openScanMethodPicker('home');
        }}
      >
        <ThemedIonicons
          name="scan-outline"
          size={18}
          color={showScanMethodModal && scanEntryPoint === 'home' ? '#16110a' : palette.text}
          style={styles.backBtnIconGlyph}
        />
      </Pressable>
    </View>
  );

  const renderHome = () => {
    const deltaUsd = tokens.reduce((sum, token) => sum + token.balance * token.priceUsd * (token.change24h / 100), 0);
    const deltaPercent = totalBalance > 0 ? (deltaUsd / totalBalance) * 100 : 0;
    const deltaUp = deltaUsd >= 0;

    return (
      <View style={styles.screen}>
        {renderHomeHeader()}
        {(showScanMethodModal && scanEntryPoint === 'home') || showHomeAssetLayoutModal ? (
          <Pressable
            style={styles.walletMenuScrim}
            onPress={() => {
              if (showScanMethodModal && scanEntryPoint === 'home') {
                setShowScanMethodModal(false);
              }
              if (showHomeAssetLayoutModal) {
                closeHomeAssetLayoutModal();
              }
            }}
          />
        ) : null}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.homeScrollPad}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!(showWalletMenu || showHomeAssetLayoutModal || (showScanMethodModal && scanEntryPoint === 'home'))}
          onScrollBeginDrag={() => setShowWalletMenu(false)}
        >
          <View style={styles.homeScrollContentWrap}>
            <View style={styles.homeBalanceWrap}>
            <Text style={styles.balanceLabel}>{text.totalBalance}</Text>
            <Pressable style={styles.balanceAmountPress} onPress={() => setShowBalance((prev) => !prev)}>
              <Text style={[styles.balanceTextCenter, !showBalance ? styles.balanceTextMasked : undefined]}>
                {showBalance ? formatCurrency(totalBalance, text.locale) : '•••••'}
              </Text>
            </Pressable>
            <Text style={[styles.balanceChangeLine, { color: deltaUp ? palette.positive : palette.negative }]}>
              {deltaUp ? '▲' : '▼'} {formatCurrency(Math.abs(deltaUsd), text.locale)} ({deltaUp ? '+' : '-'}
              {Math.abs(deltaPercent).toFixed(2)}%)
            </Text>
          </View>

          <View style={styles.quickActionRow}>
            {[
              ['arrow-up-outline', text.send, () => navigate('send')],
              ['arrow-down-outline', text.receive, () => navigate('receive')],
              ['time-outline', text.history, () => navigate('history')]
            ].map(([icon, label, action]) => (
              <Pressable key={`quick-${label as string}`} style={styles.quickActionItem} onPress={action as () => void}>
                <View style={styles.quickActionIconBox}>
                  <ThemedIonicons name={icon as keyof typeof Ionicons.glyphMap} size={30} color={palette.text} />
                </View>
                <Text style={styles.quickActionText}>{label as string}</Text>
              </Pressable>
            ))}
          </View>

	          <View style={styles.assetPanel}>
            <View style={styles.segmentWrap} onLayout={(event) => setSegmentTrackWidth(event.nativeEvent.layout.width)}>
              <Animated.View style={[styles.segmentActivePill, segmentIndicatorStyle]} pointerEvents="none" />
              <Pressable
                style={styles.segmentBtn}
                onLayout={(event) => {
                  const { x, width } = event.nativeEvent.layout;
                  setSegmentLayout((prev) =>
                    Math.abs(prev.firstX - x) > 0.5 || Math.abs(prev.firstWidth - width) > 0.5 ? { ...prev, firstX: x, firstWidth: width } : prev
                  );
                }}
                onPress={() => setWalletSegment('crypto')}
              >
                <Text style={walletSegment === 'crypto' ? styles.segmentTextActive : styles.segmentText}>{text.crypto}</Text>
              </Pressable>
              <Pressable
                style={styles.segmentBtn}
                onLayout={(event) => {
                  const { x } = event.nativeEvent.layout;
                  setSegmentLayout((prev) => (Math.abs(prev.secondX - x) > 0.5 ? { ...prev, secondX: x } : prev));
                }}
                onPress={() => setWalletSegment('nft')}
              >
                <Text style={walletSegment === 'nft' ? styles.segmentTextActive : styles.segmentText}>{text.nfts}</Text>
              </Pressable>
            </View>

            {walletSegment === 'crypto' ? (
              <>
                <View style={styles.assetPanelToolsRow}>
                  <Pressable style={styles.assetPanelToolBtn} onPress={() => navigate('manageAssets')}>
                    <ThemedIonicons name="wallet-outline" size={16} color={palette.text} />
                  </Pressable>
                  <Pressable
                    ref={homeLayoutTriggerRef}
                    onLayout={measureHomeLayoutTriggerAnchor}
                    style={[
                      styles.assetPanelToolBtn,
                      styles.assetPanelToolBtnGap,
                      showHomeAssetLayoutModal ? styles.iconCircleBtnActive : undefined
                    ]}
                    onPress={() => {
                      if (showHomeAssetLayoutModal) {
                        closeHomeAssetLayoutModal();
                        return;
                      }
                      measureHomeLayoutTriggerAnchor();
                      openHomeAssetLayoutModal();
                    }}
                  >
                    <ThemedIonicons name="options-outline" size={16} color={showHomeAssetLayoutModal ? '#16110a' : palette.text} />
                  </Pressable>
                </View>
                <View style={styles.tokenList}>
                  {homeDisplayTokens.map((token) => renderTokenRow(token))}
                  {homeDisplayTokens.length === 0 ? <Text style={styles.emptyText}>{text.tokenSearch}</Text> : null}
                </View>
              </>
            ) : (
              <View style={styles.nftEmpty}>
                {!ownedCollectibles.length ? <Text style={styles.nftEmptyTitle}>{text.noNftTitle}</Text> : null}
                {!ownedCollectibles.length ? <Text style={styles.nftEmptyBody}>{text.noNftBody}</Text> : null}
                {ownedCollectibles.length ? (
                  <View style={styles.nftGrid}>
                    {ownedCollectibles.slice(0, 6).map((item) => (
                      <Pressable key={item.id} style={styles.nftGridCard} onPress={() => openNftDetailScreen(item)}>
                        <Image source={{ uri: item.imageUrl }} style={styles.nftGridImage} resizeMode="cover" />
                        <Text style={styles.nftGridName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.nftGridSub} numberOfLines={1}>
                          {item.collection}
                        </Text>
                        <View style={styles.nftGridBottom}>
                          <Text style={styles.nftGridOwned}>x{item.owned}</Text>
                          <Text style={styles.nftGridPrice}>{formatCurrency(item.floorPriceUsd, text.locale)}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.emptyText}>{nftUi.noNftOwned}</Text>
                )}
                <View style={styles.nftActionRow}>
                  <Pressable style={[styles.nftBtn, styles.nftActionBtn]} onPress={() => navigate('receive')}>
                    <Text style={styles.nftBtnText}>{nftUi.receiveButton}</Text>
                  </Pressable>
                  <Pressable style={[styles.nftBtn, styles.nftActionBtn, styles.nftBtnSecondary]} onPress={() => openNftSendScreen()}>
                    <Text style={[styles.nftBtnText, styles.nftBtnSecondaryText]}>{nftUi.sendButton}</Text>
                  </Pressable>
                </View>
              </View>
	            )}
	          </View>
          </View>
	        </ScrollView>
	      </View>
	    );
	  };

  const discoverActionText = useMemo(
    () =>
      lang === 'ko'
        ? {
            noLink: '연결된 링크가 없습니다.',
            notReady: '준비 중인 기능입니다.'
          }
        : lang === 'zh'
          ? {
              noLink: '未配置可打开的链接。',
              notReady: '该功能正在准备中。'
            }
          : {
              noLink: 'No linked URL is configured.',
              notReady: 'This action is coming soon.'
            },
    [lang]
  );

  const discoverSecurityText = useMemo(
    () =>
      lang === 'ko'
        ? {
            blockedOpen: '보안 정책으로 차단된 주소입니다.',
            invalidUrl: '유효한 HTTPS 주소를 입력해주세요.',
            cautionToast: '검증되지 않은 도메인입니다. 주소를 확인한 뒤 열어주세요.',
            highRiskBlockedToast: '고위험 도메인은 자동으로 차단됩니다.',
            promptTitle: '보안 경고',
            promptBodyPrefix: '다음 주소는 피싱 위험이 있을 수 있습니다:',
            promptContinue: '계속 열기',
            promptCancel: '취소',
            badgeSafe: '검증된 도메인',
            badgeUserAllowed: '사용자 허용 도메인',
            badgeCaution: '주의: 검증되지 않은 도메인',
            badgeHigh: '경고: 고위험 도메인',
            reasonTrusted: '신뢰된 서비스 도메인입니다.',
            reasonUserAllowed: '사용자가 신뢰 목록에 추가한 도메인입니다.',
            reasonUnknown: '알려지지 않은 도메인입니다. 연결/서명 전에 주소를 확인하세요.',
            reasonPunycode: 'Punycode 도메인(xn--)은 피싱에 악용될 수 있습니다.',
            reasonIpHost: 'IP 주소 기반 접속은 위험할 수 있습니다.',
            reasonSuspiciousTld: '의심 TLD 도메인이 감지되었습니다.',
            reasonBlockedHost: '로컬/차단 대상 호스트입니다.',
            reasonInvalid: '잘못된 주소 형식입니다.'
          }
        : lang === 'zh'
          ? {
              blockedOpen: '该地址已被安全策略拦截。',
              invalidUrl: '请输入有效的 HTTPS 地址。',
              cautionToast: '检测到未验证域名，请先确认后再打开。',
              highRiskBlockedToast: '高风险域名将被自动拦截。',
              promptTitle: '安全警告',
              promptBodyPrefix: '以下地址可能存在钓鱼风险：',
              promptContinue: '仍然打开',
              promptCancel: '取消',
              badgeSafe: '已验证域名',
              badgeUserAllowed: '用户信任域名',
              badgeCaution: '注意：未验证域名',
              badgeHigh: '警告：高风险域名',
              reasonTrusted: '该域名属于可信服务。',
              reasonUserAllowed: '该域名已加入用户信任列表。',
              reasonUnknown: '未知域名，连接或签名前请先确认。',
              reasonPunycode: 'Punycode 域名(xn--)可能被用于钓鱼。',
              reasonIpHost: '使用 IP 地址访问存在风险。',
              reasonSuspiciousTld: '检测到可疑顶级域名。',
              reasonBlockedHost: '本地或被拦截主机。',
              reasonInvalid: '地址格式无效。'
            }
          : {
              blockedOpen: 'This URL is blocked by security policy.',
              invalidUrl: 'Please enter a valid HTTPS URL.',
              cautionToast: 'Unverified domain detected. Please verify the URL before opening.',
              highRiskBlockedToast: 'High-risk domains are blocked automatically.',
              promptTitle: 'Security Warning',
              promptBodyPrefix: 'This URL may be a phishing risk:',
              promptContinue: 'Open anyway',
              promptCancel: 'Cancel',
              badgeSafe: 'Verified domain',
              badgeUserAllowed: 'User-trusted domain',
              badgeCaution: 'Caution: unverified domain',
              badgeHigh: 'Warning: high-risk domain',
              reasonTrusted: 'This domain is in the trusted service list.',
              reasonUserAllowed: 'This domain is in your trusted allowlist.',
              reasonUnknown: 'Unknown domain. Verify URL before connect/sign.',
              reasonPunycode: 'Punycode domain (xn--) can be used in phishing.',
              reasonIpHost: 'IP-based URL can be risky.',
              reasonSuspiciousTld: 'Suspicious top-level domain detected.',
              reasonBlockedHost: 'Local/blocked host.',
              reasonInvalid: 'Invalid URL format.'
            },
    [lang]
  );

  const discoverAllowlistText = useMemo(
    () =>
      lang === 'ko'
        ? {
            settingsLabel: 'DApp 보안 도메인',
            title: 'DApp 보안 도메인',
            description: '앱이 기본적으로 위험 도메인을 자동 차단합니다. 필요할 때만 예외 도메인을 추가하세요.',
            placeholder: '예: app.example.com',
            memoPlaceholder: '메모 (선택)',
            add: '추가',
            addCurrent: '현재 탭 도메인 추가',
            customSection: '내 신뢰 도메인',
            builtInSection: '기본 신뢰 도메인',
            empty: '추가된 도메인이 없습니다.',
            createdAt: '등록일',
            edit: '수정',
            save: '저장',
            cancel: '취소',
            invalid: '도메인 형식이 올바르지 않습니다.',
            exists: '이미 신뢰 목록에 등록된 도메인입니다.',
            added: '신뢰 도메인에 추가되었습니다.',
            updated: '신뢰 도메인이 수정되었습니다.',
            removed: '신뢰 도메인에서 제거되었습니다.'
          }
        : lang === 'zh'
          ? {
              settingsLabel: 'DApp 安全域名',
              title: 'DApp 安全域名',
              description: '应用会默认自动拦截高风险域名。仅在必要时添加例外域名。',
              placeholder: '例如：app.example.com',
              memoPlaceholder: '备注（可选）',
              add: '添加',
              addCurrent: '添加当前标签域名',
              customSection: '我的信任域名',
              builtInSection: '默认信任域名',
              empty: '暂无已添加域名。',
              createdAt: '创建时间',
              edit: '编辑',
              save: '保存',
              cancel: '取消',
              invalid: '域名格式无效。',
              exists: '该域名已在信任列表中。',
              added: '已添加到信任域名。',
              updated: '信任域名已更新。',
              removed: '已从信任域名移除。'
            }
          : {
              settingsLabel: 'DApp Security Domains',
              title: 'DApp Security Domains',
              description: 'The app blocks high-risk domains automatically. Add exception domains only when needed.',
              placeholder: 'e.g. app.example.com',
              memoPlaceholder: 'Memo (optional)',
              add: 'Add',
              addCurrent: 'Add current tab domain',
              customSection: 'My trusted domains',
              builtInSection: 'Default trusted domains',
              empty: 'No trusted domains added yet.',
              createdAt: 'Created',
              edit: 'Edit',
              save: 'Save',
              cancel: 'Cancel',
              invalid: 'Invalid domain format.',
              exists: 'This domain is already in the trusted list.',
              added: 'Added to trusted domains.',
              updated: 'Trusted domain updated.',
              removed: 'Removed from trusted domains.'
            },
    [lang]
  );

  const getDiscoverSecurityReasonText = (reason: DiscoverUrlSecurityCheck['reason']) => {
    switch (reason) {
      case 'trusted':
        return discoverSecurityText.reasonTrusted;
      case 'user-allowed':
        return discoverSecurityText.reasonUserAllowed;
      case 'unknown':
        return discoverSecurityText.reasonUnknown;
      case 'punycode':
        return discoverSecurityText.reasonPunycode;
      case 'ip-host':
        return discoverSecurityText.reasonIpHost;
      case 'suspicious-tld':
        return discoverSecurityText.reasonSuspiciousTld;
      case 'blocked-host':
        return discoverSecurityText.reasonBlockedHost;
      case 'invalid-url':
      case 'insecure-protocol':
      default:
        return discoverSecurityText.reasonInvalid;
    }
  };

  const getDiscoverUrlSecurityCheckWithAllowlist = (normalizedUrl: string): DiscoverUrlSecurityCheck => {
    const base = getDiscoverUrlSecurityCheck(normalizedUrl);
    if (base.level === 'blocked') return base;
    if (base.level === 'high') return base;
    if (base.host && Array.from(discoverTrustedHostSet).some((trusted) => hostMatchesDomain(base.host, trusted))) {
      return { ...base, level: 'safe', reason: 'user-allowed' };
    }
    return base;
  };

  const resetDiscoverTrustedEditor = () => {
    setDiscoverTrustedEditId(null);
    setDiscoverTrustedHostInput('');
    setDiscoverTrustedHostMemoInput('');
  };

  const addDiscoverTrustedHost = (
    rawHost: string,
    options?: {
      clearInput?: boolean;
      clearMemo?: boolean;
      silent?: boolean;
      memo?: string;
    }
  ) => {
    const host = normalizeDiscoverTrustedHost(rawHost);
    if (!host) {
      if (!options?.silent) setBannerMessage(discoverAllowlistText.invalid);
      return false;
    }
    const hostSecurity = getDiscoverUrlSecurityCheck(`https://${host}`);
    if (hostSecurity.level === 'high' || hostSecurity.level === 'blocked') {
      if (!options?.silent) setBannerMessage(discoverSecurityText.highRiskBlockedToast);
      if (options?.clearInput) setDiscoverTrustedHostInput('');
      return false;
    }
    if (TRUSTED_DISCOVER_DAPP_HOSTS.some((trusted) => hostMatchesDomain(host, trusted)) || discoverTrustedHostSet.has(host)) {
      if (!options?.silent) setBannerMessage(discoverAllowlistText.exists);
      if (options?.clearInput) setDiscoverTrustedHostInput('');
      return false;
    }

    const memo = String(options?.memo ?? discoverTrustedHostMemoInput).trim();
    setDiscoverTrustedHosts((prev) => {
      const normalizedPrev = prev
        .map((entry, index) => {
          const normalized = normalizeDiscoverTrustedHost(entry.host);
          if (!normalized) return null;
          const createdAt = toIsoOrNow(String(entry.createdAt ?? '').trim());
          const expiresAt = computeTrustedHostExpiresAt(createdAt, entry.expiresAt);
          const expiresAtTs = Date.parse(expiresAt);
          if (!Number.isFinite(expiresAtTs) || expiresAtTs <= Date.now()) return null;
          const id = String(entry.id ?? '').trim() || `trusted-${normalized}-${index}`;
          return {
            id,
            host: normalized,
            memo: String(entry.memo ?? '').trim(),
            createdAt,
            expiresAt
          } as DiscoverTrustedHostEntry;
        })
        .filter((entry): entry is DiscoverTrustedHostEntry => Boolean(entry));
      if (normalizedPrev.some((entry) => entry.host === host)) return normalizedPrev;
      const createdAt = new Date().toISOString();
      return [
        {
          id: `trusted-${Date.now()}-${randomHexString(6)}`,
          host,
          memo,
          createdAt,
          expiresAt: computeTrustedHostExpiresAt(createdAt)
        },
        ...normalizedPrev
      ];
    });
    discoverSecurityAllowHostsRef.current.add(host);
    if (options?.clearInput) setDiscoverTrustedHostInput('');
    if (options?.clearMemo) setDiscoverTrustedHostMemoInput('');
    if (!options?.silent) setBannerMessage(discoverAllowlistText.added);
    return true;
  };

  const removeDiscoverTrustedHost = (entryId: string) => {
    const target = discoverTrustedHostEntries.find((entry) => entry.id === entryId);
    if (!target) return;
    setDiscoverTrustedHosts((prev) => prev.filter((entry) => entry.id !== entryId));
    discoverSecurityAllowHostsRef.current.delete(target.host);
    setBannerMessage(discoverAllowlistText.removed);
    if (discoverTrustedEditId === entryId) resetDiscoverTrustedEditor();
  };

  const openEditDiscoverTrustedHost = (entry: DiscoverTrustedHostEntry) => {
    setDiscoverTrustedEditId(entry.id);
    setDiscoverTrustedHostInput(entry.host);
    setDiscoverTrustedHostMemoInput(entry.memo);
  };

  const saveDiscoverTrustedHostEdit = () => {
    if (!discoverTrustedEditEntry) return false;
    const nextHost = normalizeDiscoverTrustedHost(discoverTrustedHostInput);
    if (!nextHost) {
      setBannerMessage(discoverAllowlistText.invalid);
      return false;
    }
    const nextHostSecurity = getDiscoverUrlSecurityCheck(`https://${nextHost}`);
    if (nextHostSecurity.level === 'high' || nextHostSecurity.level === 'blocked') {
      setBannerMessage(discoverSecurityText.highRiskBlockedToast);
      return false;
    }
    if (TRUSTED_DISCOVER_DAPP_HOSTS.some((trusted) => hostMatchesDomain(nextHost, trusted))) {
      setBannerMessage(discoverAllowlistText.exists);
      return false;
    }
    if (discoverTrustedHostEntries.some((entry) => entry.id !== discoverTrustedEditEntry.id && entry.host === nextHost)) {
      setBannerMessage(discoverAllowlistText.exists);
      return false;
    }
    const nextMemo = discoverTrustedHostMemoInput.trim();
    setDiscoverTrustedHosts((prev) =>
      prev.map((entry) =>
        entry.id === discoverTrustedEditEntry.id
          ? {
              ...entry,
              host: nextHost,
              memo: nextMemo,
              expiresAt: computeTrustedHostExpiresAt(toIsoOrNow(entry.createdAt), entry.expiresAt)
            }
          : entry
      )
    );
    discoverSecurityAllowHostsRef.current.delete(discoverTrustedEditEntry.host);
    discoverSecurityAllowHostsRef.current.add(nextHost);
    setBannerMessage(discoverAllowlistText.updated);
    resetDiscoverTrustedEditor();
    return true;
  };

  const formatDiscoverTrustedCreatedAt = (createdAtRaw: string) => {
    const parsed = new Date(createdAtRaw);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleDateString(text.locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  useEffect(() => {
    if (!discoverTrustedEditId) return;
    if (!discoverTrustedHostEntries.some((entry) => entry.id === discoverTrustedEditId)) {
      resetDiscoverTrustedEditor();
    }
  }, [discoverTrustedEditId, discoverTrustedHostEntries]);

  const openAssetExternalLink = async (url: string) => {
    const targetUrl = String(url ?? '').trim();
    if (!isHttpUrl(targetUrl)) {
      setBannerMessage(discoverActionText.noLink);
      return false;
    }

    try {
      await Linking.openURL(targetUrl);
      return true;
    } catch (error) {
      trackError('asset.link_open_failed', error, { url: targetUrl, platform: Platform.OS });
      setBannerMessage(flow.explorerOpenFailed);
      return false;
    }
  };

  function isWeeklyBriefingItem(item: DiscoverFeedItem) {
    const id = String(item.id || '').trim().toLowerCase();
    const internalTarget = String(item.internalTarget || '').trim().toLowerCase();
    const tags = Array.isArray(item.tags) ? item.tags.map((entry) => String(entry || '').trim().toLowerCase()) : [];
    const hasImwalletTag = tags.includes('imwallet');
    const hasWeeklyBriefingTag = tags.includes('weekly') || tags.includes('briefing');
    if (id === 'imwallet-weekly-briefing') return true;
    if (internalTarget === 'discover:briefing' && hasImwalletTag && hasWeeklyBriefingTag) return true;
    return false;
  }

  const openWeeklyBriefingBoard = () => {
    setDiscoverBriefingWeekKey(null);
    setDiscoverBriefingExpandedId(null);
    setShowDiscoverBriefingWeekMenu(false);
    navigate('discoverBriefingBoard');
  };

  const openDiscoverInternalTarget = (targetRaw: string) => {
    const target = targetRaw.trim().toLowerCase();
    if (!target) return false;

    switch (target) {
      case 'home':
        openRoot('home');
        return true;
      case 'discover':
        openRoot('discover');
        return true;
      case 'discover/earn':
      case 'discover:earn':
        navigate('discoverEarn');
        return true;
      case 'discover/explore':
      case 'discover/explore-dapps':
      case 'discover:dapps':
        navigate('discoverExploreDapps');
        return true;
      case 'discover/watch':
      case 'discover/watchlist':
      case 'discover:watchlist':
        navigate('discoverWatchlist');
        return true;
      case 'discover/sites':
      case 'discover:sites':
        navigate('discoverSites');
        return true;
      case 'discover/latest':
      case 'discover:latest':
        openRoot('discover');
        return true;
      case 'discover/popular':
      case 'discover:popular':
        navigate('discoverPopularRanking');
        return true;
      case 'discover/briefing':
      case 'discover:briefing':
        openWeeklyBriefingBoard();
        return true;
      case 'send':
        openRoot('send');
        return true;
      case 'receive':
        openRoot('receive');
        return true;
      case 'history':
        openRoot('history');
        return true;
      case 'settings':
        navigate('settings');
        return true;
      case 'manageassets':
      case 'manage-assets':
      case 'manage_assets':
        navigate('manageAssets');
        return true;
      case 'support':
        navigate('settingsSupport');
        return true;
      default:
        break;
    }

    if (target.startsWith('asset:') || target.startsWith('token:')) {
      const tokenKey = target.split(':').slice(1).join(':').trim().toLowerCase();
      if (!tokenKey) return false;
      const matchedToken = tokens.find((token) => {
        const aliases = [token.id, token.assetKey, token.symbol].map((entry) => entry.toLowerCase());
        return aliases.includes(tokenKey);
      });
      if (matchedToken) {
        openAssetDetail(matchedToken);
        return true;
      }
    }

    return false;
  };

  const normalizeDiscoverBrowserUrl = (rawUrl: string) => {
    let next = String(rawUrl ?? '').trim();
    if (!next) return '';
    if (!/^https?:\/\//i.test(next)) next = `https://${next}`;
    try {
      const parsed = new URL(next);
      if (parsed.protocol !== 'https:') return '';
      return parsed.toString();
    } catch {
      return '';
    }
  };

  const buildDiscoverTabTitle = (titleRaw: string, url: string) => {
    const title = String(titleRaw ?? '').trim();
    if (title) return title;
    try {
      const host = new URL(url).hostname.replace(/^www\./i, '');
      return host || 'DApp';
    } catch {
      return 'DApp';
    }
  };

  const touchDiscoverHistory = (record: DiscoverBrowserTab) => {
    setDiscoverHistoryTabs((prev) => [record, ...prev.filter((tab) => tab.url !== record.url)].slice(0, 60));
  };

  const openDiscoverDappBrowser = (
    rawUrl: string,
    titleRaw = '',
    sourceItemId?: string,
    options?: {
      bypassRiskPrompt?: boolean;
      skipNavigate?: boolean;
      source?: 'open' | 'navigation';
    }
  ) => {
    const normalizedUrl = normalizeDiscoverBrowserUrl(rawUrl);
    if (!normalizedUrl) {
      setBannerMessage(discoverSecurityText.invalidUrl);
      return false;
    }

    const securityCheck = getDiscoverUrlSecurityCheckWithAllowlist(normalizedUrl);
    if (securityCheck.level === 'blocked') {
      setBannerMessage(discoverSecurityText.blockedOpen);
      return false;
    }

    if (securityCheck.level === 'high') {
      setBannerMessage(discoverSecurityText.highRiskBlockedToast);
      return false;
    }

    if (
      securityCheck.level === 'caution' &&
      !options?.bypassRiskPrompt &&
      !discoverSecurityAllowHostsRef.current.has(securityCheck.host)
    ) {
      setDiscoverSecurityPrompt({
        url: normalizedUrl,
        title: titleRaw,
        sourceItemId,
        host: securityCheck.host,
        reason: securityCheck.reason,
        source: options?.source ?? 'open'
      });
      setBannerMessage(discoverSecurityText.cautionToast);
      return false;
    }

    const now = new Date().toISOString();
    const nextTitle = buildDiscoverTabTitle(titleRaw, normalizedUrl);
    let nextActiveId: string | null = null;
    let historyRecord: DiscoverBrowserTab | null = null;

    setDiscoverOpenTabs((prev) => {
      const existing = prev.find((tab) => tab.url === normalizedUrl);
      if (existing) {
        const updated: DiscoverBrowserTab = {
          ...existing,
          title: nextTitle || existing.title,
          lastVisitedAt: now,
          sourceItemId: sourceItemId ?? existing.sourceItemId
        };
        nextActiveId = updated.id;
        historyRecord = updated;
        return [updated, ...prev.filter((tab) => tab.id !== existing.id)];
      }

      const created: DiscoverBrowserTab = {
        id: `dapp-tab-${Date.now()}-${randomBase36String(5)}`,
        title: nextTitle,
        url: normalizedUrl,
        openedAt: now,
        lastVisitedAt: now,
        sourceItemId
      };
      nextActiveId = created.id;
      historyRecord = created;
      return [created, ...prev].slice(0, 8);
    });

    if (nextActiveId) setDiscoverActiveTabId(nextActiveId);
    if (historyRecord) touchDiscoverHistory(historyRecord);
    setDiscoverBrowserDraftUrl(normalizedUrl);
    setDiscoverBrowserRefreshKey(0);
    setDiscoverWebViewCanGoBack(false);
    setDiscoverWebViewCanGoForward(false);
    if (!(options?.skipNavigate && currentScreen === 'discoverDappBrowser')) {
      navigate('discoverDappBrowser');
    }
    return true;
  };

  const closeDiscoverTab = (tabId: string) => {
    setDiscoverOpenTabs((prev) => {
      const nextTabs = prev.filter((tab) => tab.id !== tabId);
      if (!nextTabs.length) {
        setDiscoverActiveTabId(null);
        setDiscoverBrowserDraftUrl('');
        setDiscoverWebViewCanGoBack(false);
        setDiscoverWebViewCanGoForward(false);
      } else if (!nextTabs.some((tab) => tab.id === discoverActiveTabId)) {
        setDiscoverActiveTabId(nextTabs[0].id);
        setDiscoverBrowserDraftUrl(nextTabs[0].url);
        setDiscoverWebViewCanGoBack(false);
        setDiscoverWebViewCanGoForward(false);
      }
      return nextTabs;
    });
  };

  const toggleDiscoverFavorite = (tab: DiscoverBrowserTab) => {
    setDiscoverFavoriteTabs((prev) => {
      const exists = prev.some((item) => item.url === tab.url);
      if (exists) return prev.filter((item) => item.url !== tab.url);
      return [tab, ...prev.filter((item) => item.url !== tab.url)].slice(0, 60);
    });
  };

  const discoverFavoriteToastText = useMemo(
    () =>
      lang === 'ko'
        ? {
            dappAdded: 'DApp를 즐겨찾기에 추가했습니다.',
            dappRemoved: 'DApp 즐겨찾기를 해제했습니다.',
            tokenAdded: '토큰을 즐겨찾기에 추가했습니다.',
            tokenRemoved: '토큰 즐겨찾기를 해제했습니다.',
            siteAdded: '사이트를 즐겨찾기에 추가했습니다.',
            siteRemoved: '사이트 즐겨찾기를 해제했습니다.'
          }
        : lang === 'zh'
          ? {
              dappAdded: '已将 DApp 添加到收藏。',
              dappRemoved: '已取消 DApp 收藏。',
              tokenAdded: '已将代币添加到收藏。',
              tokenRemoved: '已取消代币收藏。',
              siteAdded: '已将站点添加到收藏。',
              siteRemoved: '已取消站点收藏。'
            }
          : {
              dappAdded: 'DApp added to favorites.',
              dappRemoved: 'DApp removed from favorites.',
              tokenAdded: 'Token added to favorites.',
              tokenRemoved: 'Token removed from favorites.',
              siteAdded: 'Site added to favorites.',
              siteRemoved: 'Site removed from favorites.'
            },
    [lang]
  );

  const toggleDiscoverDappFavorite = (itemId: string) => {
    setDiscoverFavoriteDappIds((prev) => {
      const exists = prev.includes(itemId);
      setBannerMessage(exists ? discoverFavoriteToastText.dappRemoved : discoverFavoriteToastText.dappAdded);
      if (exists) return prev.filter((id) => id !== itemId);
      return [itemId, ...prev.filter((id) => id !== itemId)].slice(0, 120);
    });
  };

  const toggleDiscoverTokenFavorite = (symbolRaw: string) => {
    const symbol = symbolRaw.trim().toUpperCase();
    if (!symbol) return;
    setDiscoverFavoriteTokenSymbols((prev) => {
      const exists = prev.some((item) => item.toUpperCase() === symbol);
      setBannerMessage(exists ? discoverFavoriteToastText.tokenRemoved : discoverFavoriteToastText.tokenAdded);
      if (exists) return prev.filter((item) => item.toUpperCase() !== symbol);
      return [symbol, ...prev.filter((item) => item.toUpperCase() !== symbol)].slice(0, 200);
    });
  };

  const toggleDiscoverSiteFavorite = (siteId: string) => {
    setDiscoverFavoriteSiteIds((prev) => {
      const exists = prev.includes(siteId);
      setBannerMessage(exists ? discoverFavoriteToastText.siteRemoved : discoverFavoriteToastText.siteAdded);
      if (exists) return prev.filter((id) => id !== siteId);
      return [siteId, ...prev.filter((id) => id !== siteId)].slice(0, 200);
    });
  };

  const openDiscoverUrlDraft = () => {
    const normalizedUrl = normalizeDiscoverBrowserUrl(discoverBrowserDraftUrl);
    if (!normalizedUrl) {
      setBannerMessage(discoverSecurityText.invalidUrl);
      return;
    }
    const securityCheck = getDiscoverUrlSecurityCheckWithAllowlist(normalizedUrl);
    if (securityCheck.level === 'blocked') {
      setBannerMessage(discoverSecurityText.blockedOpen);
      return;
    }
    if (securityCheck.level === 'high') {
      setBannerMessage(discoverSecurityText.highRiskBlockedToast);
      return;
    }
    if (securityCheck.level === 'caution' && !discoverSecurityAllowHostsRef.current.has(securityCheck.host)) {
      setDiscoverSecurityPrompt({
        url: normalizedUrl,
        title: discoverActiveTab?.title ?? '',
        sourceItemId: discoverActiveTab?.sourceItemId,
        host: securityCheck.host,
        reason: securityCheck.reason,
        source: 'open'
      });
      setBannerMessage(discoverSecurityText.cautionToast);
      return;
    }
    const now = new Date().toISOString();
    const nextTitle = buildDiscoverTabTitle(discoverActiveTab?.title ?? '', normalizedUrl);
    if (discoverActiveTabId) {
      const updated: DiscoverBrowserTab = {
        ...(discoverActiveTab ?? {
          id: discoverActiveTabId,
          title: nextTitle,
          url: normalizedUrl,
          openedAt: now,
          lastVisitedAt: now
        }),
        title: nextTitle,
        url: normalizedUrl,
        lastVisitedAt: now
      };
      setDiscoverOpenTabs((prev) => {
        if (!prev.length) return [updated];
        return [updated, ...prev.filter((tab) => tab.id !== discoverActiveTabId)];
      });
      touchDiscoverHistory(updated);
      setDiscoverBrowserDraftUrl(normalizedUrl);
      setDiscoverBrowserRefreshKey((prev) => prev + 1);
      setDiscoverWebViewCanGoBack(false);
      setDiscoverWebViewCanGoForward(false);
      if (currentScreen !== 'discoverDappBrowser') navigate('discoverDappBrowser');
      return;
    }
    void openDiscoverDappBrowser(normalizedUrl, nextTitle);
  };

  const syncDiscoverActiveTabNavigation = (state: {
    url?: string;
    title?: string | null;
    canGoBack?: boolean;
    canGoForward?: boolean;
  }) => {
    const activeId = discoverActiveTabId;
    if (!activeId) return;
    const rawUrl = String(state.url ?? '').trim();
    const normalizedUrl = normalizeDiscoverBrowserUrl(rawUrl);
    if (!normalizedUrl) return;
    const now = new Date().toISOString();
    const nextTitle = buildDiscoverTabTitle(state.title ?? '', normalizedUrl);
    const updated: DiscoverBrowserTab = {
      ...(discoverActiveTab ?? {
        id: activeId,
        title: nextTitle,
        url: normalizedUrl,
        openedAt: now,
        lastVisitedAt: now
      }),
      title: nextTitle,
      url: normalizedUrl,
      lastVisitedAt: now
    };
    setDiscoverOpenTabs((prev) => [updated, ...prev.filter((tab) => tab.id !== activeId)]);
    touchDiscoverHistory(updated);
    setDiscoverBrowserDraftUrl(normalizedUrl);
    setDiscoverWebViewCanGoBack(Boolean(state.canGoBack));
    setDiscoverWebViewCanGoForward(Boolean(state.canGoForward));
  };

  const shouldStartDiscoverWebRequest = (request: { url?: string }) => {
    const reqUrl = String(request.url ?? '').trim();
    if (!reqUrl || reqUrl.startsWith('about:blank')) return true;
    const normalized = normalizeDiscoverBrowserUrl(reqUrl);
    if (!normalized) {
      setBannerMessage(discoverSecurityText.invalidUrl);
      return false;
    }
    const securityCheck = getDiscoverUrlSecurityCheckWithAllowlist(normalized);
    if (securityCheck.level === 'blocked') {
      setBannerMessage(discoverSecurityText.blockedOpen);
      return false;
    }
    if (securityCheck.level === 'high') {
      setBannerMessage(discoverSecurityText.highRiskBlockedToast);
      return false;
    }
    if (securityCheck.level === 'caution' && !discoverSecurityAllowHostsRef.current.has(securityCheck.host)) {
      setDiscoverSecurityPrompt({
        url: normalized,
        title: discoverActiveTab?.title ?? '',
        sourceItemId: discoverActiveTab?.sourceItemId,
        host: securityCheck.host,
        reason: securityCheck.reason,
        source: 'navigation'
      });
      setBannerMessage(discoverSecurityText.cautionToast);
      return false;
    }
    return true;
  };

  const closeDiscoverSecurityPrompt = () => {
    setDiscoverSecurityPrompt(null);
  };

  const continueDiscoverSecurityPrompt = () => {
    if (!discoverSecurityPrompt) return;
    const pending = discoverSecurityPrompt;
    setDiscoverSecurityPrompt(null);
    void openDiscoverDappBrowser(pending.url, pending.title, pending.sourceItemId, {
      bypassRiskPrompt: true,
      skipNavigate: pending.source === 'navigation',
      source: pending.source
    });
  };

  useEffect(() => {
    if (!discoverOpenTabs.length) {
      if (discoverActiveTabId !== null) setDiscoverActiveTabId(null);
      return;
    }
    if (!discoverActiveTabId || !discoverOpenTabs.some((tab) => tab.id === discoverActiveTabId)) {
      setDiscoverActiveTabId(discoverOpenTabs[0].id);
    }
  }, [discoverOpenTabs, discoverActiveTabId]);

  useEffect(() => {
    if (!discoverActiveTab) return;
    setDiscoverBrowserDraftUrl(discoverActiveTab.url);
    setDiscoverWebViewCanGoBack(false);
    setDiscoverWebViewCanGoForward(false);
  }, [discoverActiveTab]);

  const handleDiscoverAction = async (item: DiscoverFeedItem) => {
    const externalUrl = resolveDiscoverExternalUrl(item);
    const actionType = normalizeDiscoverActionType(item.actionType, item.internalTarget, externalUrl);
    const emitClickLog = (
      resolvedActionType: DiscoverActionType,
      success: boolean,
      reason: string,
      url = externalUrl
    ) => {
      void logDiscoverClick({
        itemId: item.id,
        itemTitle: item.title,
        category: item.category,
        section: item.section,
        declaredActionType: item.actionType,
        resolvedActionType,
        internalTarget: item.internalTarget,
        externalUrl: url,
        success,
        reason,
        platform: Platform.OS,
        lang
      }).catch((error) => {
        trackError('discover.click.log_failed', error, {
          itemId: item.id,
          category: item.category,
          section: item.section,
          resolvedActionType
        });
      });
    };

    if (actionType === 'external') {
      if (!externalUrl) {
        setBannerMessage(discoverActionText.noLink);
        emitClickLog('external', false, 'missing_external_url', '');
        return;
      }
      const opened = openDiscoverDappBrowser(externalUrl, item.title, item.id);
      emitClickLog('external', opened, opened ? 'dapp_browser_opened' : 'dapp_browser_open_failed');
      return;
    }

    if (actionType === 'internal') {
      const opened = openDiscoverInternalTarget(item.internalTarget);
      if (opened) {
        emitClickLog('internal', true, 'internal_opened', '');
        return;
      }
      if (externalUrl) {
        const openedExternal = openDiscoverDappBrowser(externalUrl, item.title, item.id);
        emitClickLog('external', openedExternal, openedExternal ? 'internal_fallback_browser_opened' : 'internal_fallback_browser_failed');
        return;
      }
      setBannerMessage(discoverActionText.notReady);
      emitClickLog('internal', false, 'internal_target_unavailable', '');
      return;
    }

    setBannerMessage(discoverActionText.notReady);
    emitClickLog('none', false, 'no_action', '');
  };

  function isUriRecentlyBroken(uri: string) {
    const iconBrokenRetryWindowMs = 15_000;
    const normalized = String(uri || '').trim();
    if (!normalized) return false;
    const brokenAt = discoverBrokenIconUris[normalized];
    if (!brokenAt) return false;
    return Date.now() - brokenAt < iconBrokenRetryWindowMs;
  }

  function resolveIconFromUriCandidates(uriCandidates: string[], allowBrokenRetry = false) {
    for (const uri of uriCandidates) {
      const normalized = String(uri || '').trim();
      if (!normalized) continue;
      if (allowBrokenRetry || !isUriRecentlyBroken(normalized)) {
        return { source: { uri: normalized } as ImageSourcePropType, activeUri: normalized };
      }
    }
    return { source: undefined as ImageSourcePropType | undefined, activeUri: '' };
  }

  function resolveDiscoverPopularIconWithFallback(symbol: string, iconUrl?: string) {
    const normalizedSymbol = String(symbol || '').trim().toUpperCase();
    const preferredIconUrl = discoverCachedTokenIconUrlBySymbol[normalizedSymbol];
    const iconCandidates = buildDiscoverPopularIconCandidates(symbol, iconUrl, preferredIconUrl);
    const resolved = resolveIconFromUriCandidates(iconCandidates);
    if (resolved.source) return resolved;
    const localIconSource = discoverPopularLocalIconMap[normalizedSymbol];
    if (localIconSource) {
      return { source: localIconSource, activeUri: '' };
    }
    return resolveIconFromUriCandidates(iconCandidates, true);
  }

  const renderAssetDetail = () => {
    const trendUp = assetChartTrend.up;
    const liveAssetInfo = marketAssetInfoMap[assetDetailToken.assetKey];
    const liveMarketCapLabel =
      Number.isFinite(liveAssetInfo?.marketCapUsd) && Number(liveAssetInfo?.marketCapUsd) > 0
        ? formatCompactCurrency(Number(liveAssetInfo?.marketCapUsd), text.locale)
        : localizeUsdCompactLabel(assetInfoPreset.marketCap, text.locale);
    const liveVolumeLabel =
      Number.isFinite(liveAssetInfo?.volume24hUsd) && Number(liveAssetInfo?.volume24hUsd) > 0
        ? formatCompactCurrency(Number(liveAssetInfo?.volume24hUsd), text.locale)
        : localizeUsdCompactLabel(assetInfoPreset.volume24h, text.locale);
    const liveCirculatingLabel =
      Number.isFinite(liveAssetInfo?.circulatingSupply) && Number(liveAssetInfo?.circulatingSupply) > 0
        ? formatCompactCount(Number(liveAssetInfo?.circulatingSupply), text.locale)
        : assetInfoPreset.circulating;
    const liveLaunchedLabel =
      typeof liveAssetInfo?.launchedAt === 'string' && liveAssetInfo.launchedAt.trim()
        ? liveAssetInfo.launchedAt.trim().slice(0, 10)
        : assetInfoPreset.launched;
    const holdersLabel =
      Number.isFinite(assetLiveHolderCount) && Number(assetLiveHolderCount) > 0
        ? formatCompactCount(Number(assetLiveHolderCount), text.locale)
        : '--';
    const liveIssuedSupply =
      Number.isFinite(liveAssetInfo?.maxSupply) && Number(liveAssetInfo?.maxSupply) > 0
        ? Number(liveAssetInfo?.maxSupply)
        : Number.isFinite(liveAssetInfo?.totalSupply) && Number(liveAssetInfo?.totalSupply) > 0
          ? Number(liveAssetInfo?.totalSupply)
          : null;
    const liveIssuedLabel = liveIssuedSupply ? formatCompactCount(liveIssuedSupply, text.locale) : assetInfoPreset.issued;
    const liveLiquidityLabel =
      Number.isFinite(liveAssetInfo?.liquidityUsd) && Number(liveAssetInfo?.liquidityUsd) > 0
        ? formatCompactCurrency(Number(liveAssetInfo?.liquidityUsd), text.locale)
        : localizeUsdCompactLabel(assetInfoPreset.liquidity, text.locale);
    const riskLabel =
      assetInfoPreset.risk === 'low'
        ? assetText.riskLow
        : assetInfoPreset.risk === 'high'
          ? assetText.riskHigh
          : assetText.riskMedium;
    const infoItems: [string, string][] = [
      [assetText.marketCap, liveMarketCapLabel],
      [assetText.volume24h, liveVolumeLabel],
      [assetText.holders, holdersLabel],
      [assetText.launched, liveLaunchedLabel],
      [assetText.circulating, liveCirculatingLabel],
      [assetText.risk, riskLabel]
    ];
    const expandedTopInfoItems: { label: string; value: string }[] = [
      { label: assetText.issued, value: liveIssuedLabel },
      { label: assetText.liquidity, value: liveLiquidityLabel }
    ];
    const detailActions: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }[] = [
      { icon: 'arrow-up-outline', label: text.send, onPress: () => openSendWithToken(assetDetailToken) },
      { icon: 'arrow-down-outline', label: text.receive, onPress: () => openReceiveWithToken(assetDetailToken) },
      { icon: 'time-outline', label: text.history, onPress: () => openHistoryWithToken(assetDetailToken) }
    ];
    const aboutLinks = [
      { label: assetText.website, url: assetInfoPreset.website },
      { label: assetText.social, url: assetInfoPreset.social },
      { label: assetText.reddit, url: assetInfoPreset.reddit },
      { label: assetText.whitepaper, url: assetInfoPreset.whitepaper }
    ];
    const isAssetFavorite = favoriteTokenIdSet.has(assetDetailToken.id);
    const favoriteAddedToast = lang === 'ko' ? '관심 자산에 추가됨' : lang === 'zh' ? '已添加到关注资产' : 'Added to favorites';
    const favoriteRemovedToast = lang === 'ko' ? '관심 자산에서 제거됨' : lang === 'zh' ? '已从关注资产移除' : 'Removed from favorites';
    const recentPrevLabel = lang === 'ko' ? '이전' : lang === 'zh' ? '上一页' : 'Prev';
    const recentNextLabel = lang === 'ko' ? '다음' : lang === 'zh' ? '下一页' : 'Next';

    return (
      <View style={styles.screen}>
        {renderSubHeader(assetDetailToken.symbol, [
          {
            materialIcon: isAssetFavorite ? 'star' : 'star-border',
            color: palette.accent,
            action: () => {
              const wasFavorite = favoriteTokenIdSet.has(assetDetailToken.id);
              toggleFavoriteAsset(assetDetailToken.id);
              setBannerMessage(wasFavorite ? favoriteRemovedToast : favoriteAddedToast);
            }
          }
        ])}
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
          <View style={styles.assetHero}>
            {renderTokenCircle(assetDetailToken, { size: 56 })}
            <Text style={styles.assetHeroSymbol}>{assetDetailToken.symbol}</Text>
            <Text style={styles.assetHeroName}>{assetDetailToken.name}</Text>
            <Text style={styles.assetHeroPrice}>{showBalance ? formatCurrency(assetDetailToken.priceUsd, text.locale) : '•••••'}</Text>
            <Text style={[styles.assetHeroDelta, { color: trendUp ? palette.positive : palette.negative }]}>
              {trendUp ? '▲' : '▼'} {showBalance ? formatCurrency(Math.abs(assetChartTrend.usd), text.locale) : '•••••'} (
              {trendUp ? '+' : '-'}
              {Math.abs(assetChartTrend.percent).toFixed(2)}%) · {assetChartRange}
            </Text>
          </View>

          <View
            style={styles.assetChartCard}
            onLayout={(event) => {
              const nextWidth = event.nativeEvent.layout.width;
              if (Math.abs(nextWidth - assetChartWidth) > 1) {
                setAssetChartWidth(nextWidth);
              }
            }}
          >
            <View style={styles.assetChartArea}>
              {assetChartSegments.map((segment, idx) => (
                <View
                  key={`chart-segment-${idx}`}
                  style={[
                    styles.assetChartSegment,
                    {
                      left: segment.left,
                      top: segment.top,
                      width: segment.width,
                      backgroundColor: trendUp ? palette.positive : palette.negative,
                      transform: [{ rotateZ: `${segment.angle}rad` }]
                    }
                  ]}
                />
              ))}
            </View>
            <View style={styles.assetRangeRow}>
              {assetChartRanges.map((range) => (
                <Pressable
                  key={`asset-range-${range}`}
                  style={[styles.assetRangeChip, assetChartRange === range ? styles.assetRangeChipActive : undefined]}
                  onPress={() => setAssetChartRange(range)}
                >
                  <Text style={assetChartRange === range ? styles.assetRangeChipTextActive : styles.assetRangeChipText}>{range}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.assetMarketCard}>
            <View style={styles.assetMarketLeft}>
              <Text style={styles.assetMarketKrw}>
                {showBalance ? formatMarketSpotPrice(assetDetailToken.priceUsd, text.locale) : '•••••'}
              </Text>
              <Text style={styles.assetMarketSub}>{assetText.marketPulse}</Text>
            </View>
            <Pressable style={styles.assetMarketBtn} onPress={() => navigate('discover')}>
              <Text style={styles.assetMarketBtnText}>{text.discover}</Text>
            </Pressable>
          </View>

          <Text style={styles.assetSectionTitle}>{assetText.totalValue}</Text>
          <View style={styles.assetValueCard}>
            <Text style={styles.assetValueAmount}>
              {showBalance ? `${formatAmount(assetDetailToken.balance, text.locale, 8)} ${assetDetailToken.symbol}` : '•••••'}
            </Text>
            <Text style={styles.assetValueUsd}>{showBalance ? formatCurrency(assetDetailTotalUsd, text.locale) : '•••••'}</Text>
          </View>

          <View style={styles.assetActionRow}>
            {detailActions.map((item) => (
              <Pressable key={`asset-action-${item.label}`} style={styles.assetActionBtn} onPress={item.onPress}>
                <View style={styles.assetActionIconWrap}>
                  <ThemedIonicons name={item.icon} size={18} color={palette.text} />
                </View>
                <Text style={styles.assetActionLabel}>{item.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.assetSectionTitle}>{assetText.info}</Text>
          <View style={styles.assetInfoCard}>
            <View style={styles.assetInfoGrid}>
              {infoItems.map(([label, value]) => (
                <View key={`asset-info-${label}`} style={styles.assetInfoCell}>
                  <Text style={styles.assetInfoKey}>{label}</Text>
                  <Text style={styles.assetInfoValue}>{value}</Text>
                </View>
              ))}
            </View>
            <Pressable style={styles.assetInfoToggle} onPress={() => setAssetInfoExpanded((prev) => !prev)}>
              <Text style={styles.assetInfoToggleText}>{assetInfoExpanded ? assetText.showLess : assetText.showMore}</Text>
              <ThemedIonicons name={assetInfoExpanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={14} color={palette.muted} />
            </Pressable>
            {assetInfoExpanded ? (
              <View style={styles.assetInfoExpandedBox}>
                <View style={styles.assetInfoGrid}>
                  {expandedTopInfoItems.map((item) => (
                    <View
                      key={`asset-expanded-${item.label}`}
                      style={styles.assetInfoCell}
                    >
                      <Text style={styles.assetInfoKey}>{item.label}</Text>
                      <Text style={styles.assetInfoValue} numberOfLines={1}>
                        {item.value}
                      </Text>
                    </View>
                  ))}
                  <View style={styles.assetInfoCell}>
                    <Text style={styles.assetInfoKey}>{assetText.networkLabel}</Text>
                    <Text style={styles.assetInfoValue} numberOfLines={1}>
                      {assetDetailToken.network}
                    </Text>
                  </View>
                </View>
                <View style={[styles.assetInfoCell, styles.assetInfoCellWide, styles.assetInfoContractCell]}>
                  <Text style={styles.assetInfoKey}>{assetText.contractAddress}</Text>
                  <Text style={styles.assetInfoValue} numberOfLines={2}>
                    {assetContractAddress}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          <Text style={styles.assetSectionTitle}>{assetText.about}</Text>
          <View style={styles.assetLinkRow}>
            {aboutLinks.map((link) => (
              <Pressable key={`asset-link-${link.label}`} style={styles.assetLinkChip} onPress={() => openAssetExternalLink(link.url)}>
                <ThemedIonicons name="open-outline" size={13} color={palette.muted} />
                <Text style={styles.assetLinkChipText}>{link.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.assetSectionTitle}>{assetText.recentActivity}</Text>
          {recentAssetTxs.length ? (
            assetRecentPagedTxs.map((tx) => {
              const isIncomingTx = tx.type === 'receive';
              const isNftTx = tx.tokenSymbol.toUpperCase() === 'NFT';
              const amountPrefix = isNftTx ? '' : isIncomingTx ? '+' : '-';
              const txChain = inferChainFromTx(tx);
              const txAddressLabel = findAddressBookLabel(txChain, tx.counterparty);
              const txMemoValue = tx.memo?.trim() || '-';
              const txTypeLabel = isIncomingTx ? text.receive : text.send;
              return (
                <Pressable key={`asset-recent-${tx.id}`} style={styles.txRow} onPress={() => openHistoryTxDetail(tx)}>
                  <View>
                    <Text style={styles.txSymbol}>{tx.tokenSymbol}</Text>
                    <Text style={styles.txMeta}>
                      {txTypeLabel} / {tx.createdAt}
                    </Text>
                    <Text style={styles.txMemo} numberOfLines={1}>
                      {txAddressLabel ? <Text style={styles.txMetaLabelAccent}>{txAddressLabel}</Text> : null}
                      {txAddressLabel ? ' / ' : ''}
                      {txMemoValue}
                    </Text>
                  </View>
                  <View style={styles.txValueCol}>
                    <Text style={styles.txTokenAmount}>
                      {amountPrefix}
                      {formatAmount(tx.amount, text.locale)} {tx.tokenSymbol}
                    </Text>
                    <Text style={styles.txUsd}>{formatCurrency(tx.usdValue, text.locale)}</Text>
                    <ThemedIonicons name="chevron-forward" size={14} color={palette.muted} style={styles.txGoIcon} />
                  </View>
                </Pressable>
              );
            })
          ) : (
            <View style={styles.infoCard}>
              <Text style={styles.infoBody}>{assetText.noRecentActivity}</Text>
            </View>
          )}
          {recentAssetTxs.length > 5 ? (
            <View style={styles.discoverPopularPagination}>
              <Pressable
                style={[styles.discoverPopularPageBtn, assetRecentCurrentPage <= 1 ? styles.discoverPopularPageBtnDisabled : undefined]}
                disabled={assetRecentCurrentPage <= 1}
                onPress={() => {
                  setAssetRecentPage((prev) => Math.max(1, prev - 1));
                }}
              >
                <ThemedIonicons name="chevron-back" size={14} color={assetRecentCurrentPage <= 1 ? palette.muted : palette.text} />
                <Text
                  style={[
                    styles.discoverPopularPageBtnText,
                    { marginLeft: 2 },
                    assetRecentCurrentPage <= 1 ? styles.discoverPopularPageBtnTextDisabled : undefined
                  ]}
                >
                  {recentPrevLabel}
                </Text>
              </Pressable>
              <View style={styles.discoverPopularPageBadge}>
                <Text style={styles.discoverPopularPageBadgeText}>
                  {assetRecentCurrentPage} / {assetRecentTotalPages}
                </Text>
              </View>
              <Pressable
                style={[
                  styles.discoverPopularPageBtn,
                  assetRecentCurrentPage >= assetRecentTotalPages ? styles.discoverPopularPageBtnDisabled : undefined
                ]}
                disabled={assetRecentCurrentPage >= assetRecentTotalPages}
                onPress={() => {
                  setAssetRecentPage((prev) => Math.min(assetRecentTotalPages, prev + 1));
                }}
              >
                <Text
                  style={[
                    styles.discoverPopularPageBtnText,
                    { marginRight: 2 },
                    assetRecentCurrentPage >= assetRecentTotalPages ? styles.discoverPopularPageBtnTextDisabled : undefined
                  ]}
                >
                  {recentNextLabel}
                </Text>
                <ThemedIonicons
                  name="chevron-forward"
                  size={14}
                  color={assetRecentCurrentPage >= assetRecentTotalPages ? palette.muted : palette.text}
                />
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </View>
    );
  };

  const renderEarn = () => {
    const earnComingSoonTitle = lang === 'ko' ? '수익 서비스 준비중' : lang === 'zh' ? '收益服务准备中' : 'Earn Service Coming Soon';
    const earnComingSoonBody =
      lang === 'ko'
        ? '현재 수익 기능은 점검 및 고도화 중입니다. 안정성 검증이 끝나면 순차적으로 오픈됩니다.'
        : lang === 'zh'
          ? '当前收益功能正在优化与安全检查中，完成后将逐步开放。'
          : 'Earn is currently under optimization and safety checks, and will be released gradually.';

    return (
      <View style={styles.screen}>
        {renderTopHeader(text.earn, 'settings-outline', () => navigate('settings'))}
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
          <View style={styles.earnComingSoonCard}>
            <View style={styles.earnComingSoonIconWrap}>
              <ThemedIonicons name="hourglass-outline" size={22} color={palette.accent} />
            </View>
            <Text style={styles.earnComingSoonTitle}>{earnComingSoonTitle}</Text>
            <Text style={styles.earnComingSoonBody}>{earnComingSoonBody}</Text>
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderDiscoverList = (rowsInput: DiscoverFeedItem[], limit?: number) => {
    const rowsWithVerifiedIcon = rowsInput.map((item) => {
      const dappCacheKey = getDiscoverDappIconCacheKey(item);
      const preferredIconUrl = discoverCachedDappIconUrlByKey[dappCacheKey];
      const fixedSource = resolveDiscoverDappIconSource(item);
      if (fixedSource && typeof fixedSource !== 'object') {
        return { item, iconSource: fixedSource as ImageSourcePropType, iconUri: '' };
      }
      if (fixedSource && typeof fixedSource === 'object' && 'uri' in fixedSource) {
        const fixedUri = String(fixedSource.uri || '').trim();
        if (fixedUri && !isUriRecentlyBroken(fixedUri)) {
          return { item, iconSource: fixedSource as ImageSourcePropType, iconUri: fixedUri };
        }
      }

      const iconCandidates = buildDiscoverDappIconCandidates(item, preferredIconUrl);
      const { source: iconSource, activeUri: iconUri } = resolveIconFromUriCandidates(iconCandidates);
      return { item, iconSource, iconUri };
    });

    const rows = (typeof limit === 'number' ? rowsWithVerifiedIcon.slice(0, limit) : rowsWithVerifiedIcon).slice(
      0,
      Math.max(limit ?? rowsWithVerifiedIcon.length, 0)
    );
    if (!rows.length) {
      return (
        <View style={styles.discoverEmptyCard}>
          <Text style={styles.infoBody}>{text.discoverTabsEmpty}</Text>
        </View>
      );
    }

    return (
      <View>
        {rows.map(({ item, iconSource, iconUri }, index) => {
          const localized = localizeDiscoverDappText(item.title, item.summary, lang);
          const isFavorite = discoverFavoriteDappIdSet.has(item.id);
          return (
            <Pressable
              key={item.id}
              style={[styles.discoverDappRow, index > 0 ? styles.discoverDappRowBorder : undefined]}
              onPress={() => {
                void handleDiscoverAction(item);
              }}
            >
              <Text style={styles.discoverDappRank}>{index + 1}</Text>
              <View style={styles.discoverDappIcon}>
                {iconSource ? (
                  <View style={styles.discoverDappIconImageLayer}>
                    <Image
                      source={iconSource}
                      style={styles.discoverDappIconImage}
                      onError={() => {
                        if (!iconUri) return;
                        setDiscoverBrokenIconUris((prev) => ({ ...prev, [iconUri]: Date.now() }));
                      }}
                    />
                  </View>
                ) : (
                  <ThemedIonicons name="apps-outline" size={16} color={palette.muted} />
                )}
              </View>
              <View style={styles.discoverDappMeta}>
                <View style={styles.discoverDappNameRow}>
                  <Text style={styles.discoverDappName} numberOfLines={1}>
                    {localized.titlePrimary}
                  </Text>
                  {localized.titleSecondary ? (
                    <Text style={styles.discoverDappAlias} numberOfLines={1}>
                      {localized.titleSecondary}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.discoverDappDesc} numberOfLines={1}>
                  {localized.summary}
                </Text>
              </View>
              <View style={styles.discoverTabListActionWrap}>
                <Pressable
                  style={styles.discoverTabListActionBtn}
                  onPress={(event) => {
                    event.stopPropagation?.();
                    toggleDiscoverDappFavorite(item.id);
                  }}
                  hitSlop={8}
                >
                  <MaterialIcons name={isFavorite ? 'star' : 'star-border'} size={18} color={palette.accent} />
                </Pressable>
                <ThemedIonicons name="chevron-forward" size={16} color={palette.muted} />
              </View>
            </Pressable>
          );
        })}
      </View>
    );
  };

  const renderDiscoverSiteList = (rowsInput: DiscoverSiteItem[], limit?: number) => {
    const rows = typeof limit === 'number' ? rowsInput.slice(0, limit) : rowsInput;
    if (!rows.length) {
      return (
        <View style={styles.discoverEmptyCard}>
          <Text style={styles.infoBody}>{text.discoverTabsEmpty}</Text>
        </View>
      );
    }

    return (
      <View>
        {rows.map((site, index) => {
          const siteCacheKey = getDiscoverSiteIconCacheKey(site);
          const preferredIconUrl = discoverCachedSiteIconUrlByKey[siteCacheKey];
          const iconCandidates = buildDiscoverSiteIconCandidates(site.domain, preferredIconUrl);
          const { source: siteIconSource, activeUri } = resolveIconFromUriCandidates(iconCandidates);
          const isFavorite = discoverFavoriteSiteIdSet.has(site.id);
          const siteNameDisplay = resolveDiscoverSiteDisplayName(site.id, site.name, lang);
          const siteSummaryText = resolveDiscoverSiteSummary(site, lang);
          return (
            <Pressable
              key={site.id}
              style={[styles.discoverDappRow, index > 0 ? styles.discoverDappRowBorder : undefined]}
              onPress={() => void openAssetExternalLink(site.url)}
            >
              <View style={styles.discoverDappIcon}>
                {siteIconSource ? (
                  <View style={styles.discoverDappIconImageLayer}>
                    <Image
                      source={siteIconSource}
                      style={styles.discoverDappIconImage}
                      onError={() => {
                        if (!activeUri) return;
                        setDiscoverBrokenIconUris((prev) => ({ ...prev, [activeUri]: Date.now() }));
                      }}
                    />
                  </View>
                ) : (
                  <ThemedIonicons name="globe-outline" size={16} color={palette.muted} />
                )}
              </View>
              <View style={styles.discoverDappMeta}>
                <View style={styles.discoverDappNameRow}>
                  <Text style={styles.discoverDappName} numberOfLines={1}>
                    {siteNameDisplay.primary}
                  </Text>
                  {siteNameDisplay.secondary ? (
                    <Text style={styles.discoverDappAlias} numberOfLines={1}>
                      {siteNameDisplay.secondary}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.discoverDappDesc} numberOfLines={1}>
                  {siteSummaryText}
                </Text>
              </View>
              <View style={styles.discoverTabListActionWrap}>
                <Pressable
                  style={styles.discoverTabListActionBtn}
                  onPress={(event) => {
                    event.stopPropagation?.();
                    toggleDiscoverSiteFavorite(site.id);
                  }}
                  hitSlop={8}
                >
                  <MaterialIcons name={isFavorite ? 'star' : 'star-border'} size={18} color={palette.accent} />
                </Pressable>
                <ThemedIonicons name="chevron-forward" size={16} color={palette.muted} />
              </View>
            </Pressable>
          );
        })}
      </View>
    );
  };

  const renderDiscover = () => {
    return (
      <View style={styles.screen}>
        {renderTopHeader(text.discover, 'chevron-back', () => openRoot('home'), [
          { materialIcon: 'star-border', action: () => navigate('discoverFavorite') },
          { icon: 'browsers-outline', action: () => navigate('discoverNoTabs') }
        ])}
      <ScrollView
        ref={(ref) => {
          discoverScrollRef.current = ref;
        }}
        nativeID="discover-scroll"
        testID="discover-scroll"
        style={styles.scroll}
        contentContainerStyle={styles.scrollPad}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.discoverSearchRow}>
          <View style={styles.discoverSearchInputBox}>
            <ThemedIonicons name="search-outline" size={16} color={palette.muted} />
            <TextInput
              placeholder={discoverBlendText.searchPlaceholder}
              placeholderTextColor={palette.muted}
              style={styles.discoverSearchInput}
              value={discoverSearchInput}
              onChangeText={setDiscoverSearchInput}
            />
          </View>
        </View>
        {discoverFeedError ? (
          <View style={[styles.infoCard, { marginBottom: 12 }]}>
            <Text style={styles.infoBody}>{discoverFeedError}</Text>
          </View>
        ) : null}
        {discoverFeedLoading ? <Text style={styles.discoverHintText}>...</Text> : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.discoverQuickRow}>
          {discoverQuickChips.map((chip) => (
            <Pressable
              key={chip.key}
              style={[styles.discoverQuickChip, discoverQuickActive === chip.section ? styles.discoverQuickChipActive : undefined]}
              onPress={() => scrollToDiscoverSection(chip.section)}
            >
              <ThemedIonicons
                name={chip.icon}
                size={14}
                color={discoverQuickActive === chip.section ? '#111214' : palette.muted}
              />
              <Text style={discoverQuickActive === chip.section ? styles.discoverQuickChipTextActive : styles.discoverQuickChipText}>
                {chip.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {discoverPinnedPrimary ? (
          <View style={styles.discoverFeatureCard}>
            <Text style={styles.discoverFeatureTag}>{discoverPinnedPrimary.sourceName || text.featured}</Text>
            <Text style={styles.discoverFeatureTitle} numberOfLines={2}>
              {discoverPinnedPrimary.title}
            </Text>
            <Text style={styles.discoverFeatureBody} numberOfLines={2}>
              {discoverPinnedPrimary.summary}
            </Text>
            <Pressable
              style={styles.discoverFeatureBtn}
              onPress={() => {
                if (isWeeklyBriefingItem(discoverPinnedPrimary)) {
                  openWeeklyBriefingBoard();
                  return;
                }
                void handleDiscoverAction(discoverPinnedPrimary);
              }}
            >
              <Text style={styles.discoverFeatureBtnText}>{discoverPinnedPrimary.ctaLabel || text.continue}</Text>
            </Pressable>
          </View>
        ) : null}

        <View
          nativeID="discover-section-earn"
          testID="discover-section-earn"
          onLayout={(event) => {
            setDiscoverSectionOffset('earn', event.nativeEvent.layout.y);
          }}
        >
          <View style={styles.discoverSectionHead}>
            <Text style={styles.sectionTitle}>{discoverBlendText.earn}</Text>
          </View>
          <View style={styles.discoverEarnCard}>
            <Text style={styles.discoverEarnLabel}>{discoverBlendText.earn}</Text>
            <Text style={styles.discoverEarnValue}>
              {lang === 'ko' ? '준비중' : lang === 'zh' ? '准备中' : 'Coming Soon'}
            </Text>
            <Text style={styles.discoverEarnSummary}>
              {lang === 'ko'
                ? '수익 기능은 현재 점검 및 고도화 중입니다.'
                : lang === 'zh'
                  ? '收益功能正在优化与安全检查中。'
                  : 'Earn is currently under optimization and safety checks.'}
            </Text>
          </View>
          <Pressable style={styles.discoverCardViewAll} onPress={() => navigate('discoverEarn')}>
            <Text style={styles.discoverCardViewAllText}>{discoverBlendText.viewAll}</Text>
            <ThemedIonicons name="chevron-forward" size={14} color={palette.muted} />
          </Pressable>
        </View>

        <View
          nativeID="discover-section-explore-dapps"
          testID="discover-section-explore-dapps"
          onLayout={(event) => {
            setDiscoverSectionOffset('exploreDapps', event.nativeEvent.layout.y);
          }}
        >
          <View style={styles.discoverSectionHead}>
            <Text style={styles.sectionTitle}>{discoverBlendText.exploreDapps}</Text>
          </View>
          <View style={styles.discoverBlockCard}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
              {discoverDappFilterIds.map((id) => (
                <Pressable
                  key={`cate-${id}`}
                  style={[styles.categoryChip, discoverCategory === id ? styles.categoryChipActive : undefined]}
                  onPress={() => setDiscoverCategory(id)}
                >
                  <Text style={discoverCategory === id ? styles.categoryTextActive : styles.categoryText}>{discoverCategories[id]}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {renderDiscoverList(discoverDappItems, 3)}
            <Pressable style={styles.discoverCardViewAll} onPress={() => navigate('discoverExploreDapps')}>
              <Text style={styles.discoverCardViewAllText}>{discoverBlendText.viewAll}</Text>
              <ThemedIonicons name="chevron-forward" size={14} color={palette.muted} />
            </Pressable>
          </View>
        </View>

        <View
          nativeID="discover-section-popular-tokens"
          testID="discover-section-popular-tokens"
          onLayout={(event) => {
            setDiscoverSectionOffset('popularTokens', event.nativeEvent.layout.y);
          }}
        >
          <View style={styles.discoverSectionHead}>
            <Text style={styles.sectionTitle}>{discoverBlendText.popularTokens}</Text>
          </View>
          <View style={styles.discoverBlockCard}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
              {discoverTokenCategoryIds.map((id) => (
                <Pressable
                  key={`token-cate-${id}`}
                  style={[styles.categoryChip, discoverTokenCategory === id ? styles.categoryChipActive : undefined]}
                  onPress={() => setDiscoverTokenCategory(id)}
                >
                  <Text style={discoverTokenCategory === id ? styles.categoryTextActive : styles.categoryText}>
                    {discoverTokenCategories[id]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            {discoverPopularTokenRows.map((token, index) => {
              const { source: tokenIconSource, activeUri: tokenIconUri } = resolveDiscoverPopularIconWithFallback(token.symbol, token.iconUrl);
              const isFavoriteToken = discoverFavoriteTokenSymbolSet.has(token.symbol.toUpperCase());
              const capValue = formatCompactCurrency(token.marketCapUsd, text.locale);
              const volumeValue = formatCompactCurrency(token.volume24hUsd ?? token.marketCapUsd * 0.03, text.locale);
              const tokenNameDisplay = resolveDiscoverTokenDisplayName(token.symbol, token.name, lang);
              return (
                <View key={`discover-token-${token.id}`} style={[styles.discoverMarketRow, index > 0 ? styles.discoverMarketRowBorder : undefined]}>
                  <Text style={styles.discoverDappRank}>{index + 1}</Text>
                  <View style={styles.discoverMarketLeft}>
                    <View style={styles.discoverMarketTokenIconWrap}>
                      {tokenIconSource ? (
                        <View style={styles.discoverMarketTokenIconImageLayer}>
                          <Image
                            source={tokenIconSource}
                            style={styles.discoverMarketTokenIconImage}
                            onError={() => {
                              if (!tokenIconUri) return;
                              setDiscoverBrokenIconUris((prev) => ({ ...prev, [tokenIconUri]: Date.now() }));
                            }}
                          />
                        </View>
                      ) : (
                        <Text style={styles.discoverDappIconText}>{token.symbol.slice(0, 2)}</Text>
                      )}
                    </View>
                    <View style={styles.discoverMarketMeta}>
                      <View style={styles.discoverDappNameRow}>
                        <Text style={styles.discoverMarketName} numberOfLines={1}>
                          {tokenNameDisplay.primary}
                        </Text>
                        {tokenNameDisplay.secondary ? (
                          <Text style={styles.discoverDappAlias} numberOfLines={1}>
                            {tokenNameDisplay.secondary}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={styles.discoverMarketSub}>
                        {capValue} / {volumeValue}
                      </Text>
                      <Text style={styles.discoverMarketMetricHintLeft}>{discoverCapShortLabel} / {discoverVolShortLabel}</Text>
                    </View>
                  </View>
                  <View style={styles.discoverMarketRight}>
                    <View style={styles.discoverMarketPriceRow}>
                      <Text style={styles.discoverMarketPrice}>{formatCurrency(token.priceUsd, text.locale)}</Text>
                      <Pressable
                        style={styles.discoverMarketFavoriteBtn}
                        onPress={() => toggleDiscoverTokenFavorite(token.symbol)}
                        hitSlop={8}
                      >
                        <MaterialIcons name={isFavoriteToken ? 'star' : 'star-border'} size={18} color={palette.accent} />
                      </Pressable>
                    </View>
                    <Text style={[styles.discoverMarketChange, { color: token.change24h >= 0 ? palette.positive : palette.negative }]}>
                      {token.change24h >= 0 ? '+' : ''}
                      {token.change24h.toFixed(2)}%
                    </Text>
                  </View>
                </View>
              );
            })}
            {!discoverPopularTokenRows.length ? (
              <View style={styles.discoverEmptyCard}>
                <Text style={styles.infoBody}>{text.discoverTabsEmpty}</Text>
              </View>
            ) : null}
            <Pressable style={styles.discoverCardViewAll} onPress={() => navigate('discoverPopularRanking')}>
              <Text style={styles.discoverCardViewAllText}>{discoverBlendText.viewAll}</Text>
              <ThemedIonicons name="chevron-forward" size={14} color={palette.muted} />
            </Pressable>
          </View>
        </View>

        <View
          nativeID="discover-section-sites"
          testID="discover-section-sites"
          onLayout={(event) => {
            setDiscoverSectionOffset('sites', event.nativeEvent.layout.y);
          }}
        >
          <View style={styles.discoverSectionHead}>
            <Text style={styles.sectionTitle}>{discoverBlendText.sites}</Text>
          </View>
          <View style={styles.discoverBlockCard}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
              {discoverSiteCategoryIds.map((id) => (
                <Pressable
                  key={`site-cate-${id}`}
                  style={[styles.categoryChip, discoverSiteCategory === id ? styles.categoryChipActive : undefined]}
                  onPress={() => setDiscoverSiteCategory(id)}
                >
                  <Text style={discoverSiteCategory === id ? styles.categoryTextActive : styles.categoryText}>
                    {discoverSiteCategories[id]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            {renderDiscoverSiteList(discoverSitePreviewRows)}
            <Pressable style={styles.discoverCardViewAll} onPress={() => navigate('discoverSites')}>
              <Text style={styles.discoverCardViewAllText}>{discoverBlendText.viewAll}</Text>
              <ThemedIonicons name="chevron-forward" size={14} color={palette.muted} />
            </Pressable>
          </View>
        </View>

        <View
          nativeID="discover-section-watchlist"
          testID="discover-section-watchlist"
          onLayout={(event) => {
            setDiscoverSectionOffset('watchlist', event.nativeEvent.layout.y);
          }}
        >
          <View style={styles.discoverSectionHead}>
            <Text style={styles.sectionTitle}>{discoverBlendText.watchlist}</Text>
          </View>
          <View style={styles.discoverBlockCard}>
            {discoverWatchPreviewRows.map((row, index) => {
              const capLabel = lang === 'ko' ? '시총' : lang === 'zh' ? '市值' : 'MCap';
              const subLabel = `${row.capLabel} · ${row.volumeLabel}`;
              const rightValue = row.rightPrimary ?? (row.priceUsd === null ? '--' : formatCurrency(row.priceUsd, text.locale));
              const rightPrimaryHint = row.rightPrimaryHint ?? '';
              const rightCap = row.rightSecondary ?? (row.marketCapUsd === null ? '--' : `${capLabel} ${formatCompactCurrency(row.marketCapUsd, text.locale)}`);
              const effectiveIcon = row.iconUri && isUriRecentlyBroken(row.iconUri) ? undefined : row.iconSource;
              const rightValueStyle =
                row.rightPrimary || row.priceUsd !== null ? styles.discoverMarketPrice : [styles.discoverMarketPrice, { color: palette.muted }];

              return (
                <View key={row.id} style={[styles.discoverMarketRow, index > 0 ? styles.discoverMarketRowBorder : undefined]}>
                  <View style={styles.discoverMarketLeft}>
                    <View style={styles.discoverMarketTokenIconWrap}>
                      {effectiveIcon ? (
                        <View style={styles.discoverMarketTokenIconImageLayer}>
                              <Image
                                source={effectiveIcon}
                                style={styles.discoverMarketTokenIconImage}
                                onError={() => {
                                  if (!row.iconUri) return;
                                  setDiscoverBrokenIconUris((prev) => ({ ...prev, [row.iconUri!]: Date.now() }));
                                }}
                              />
                        </View>
                      ) : (
                        <Text style={styles.discoverDappIconText}>{String(row.symbol || '??').slice(0, 2)}</Text>
                      )}
                    </View>
                    <View style={styles.discoverMarketMeta}>
                      <View style={styles.discoverWatchTitleRow}>
                        <Text style={styles.discoverMarketName} numberOfLines={1}>
                          {row.name[lang] || row.name.en}
                        </Text>
                        <View style={styles.discoverWatchLevChip}>
                          <Text style={styles.discoverWatchLevText}>{row.leverage}</Text>
                        </View>
                      </View>
                      <Text style={styles.discoverMarketSub} numberOfLines={1}>
                        {subLabel}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.discoverMarketRight}>
                    <Text style={rightValueStyle} numberOfLines={1}>
                      {rightValue}
                    </Text>
                    {rightPrimaryHint ? (
                      <Text style={styles.discoverMarketMetricHint} numberOfLines={1}>
                        {rightPrimaryHint}
                      </Text>
                    ) : null}
                    <Text style={[styles.discoverMarketChange, { color: palette.muted }]} numberOfLines={1}>
                      {rightCap}
                    </Text>
                  </View>
                </View>
              );
            })}
            <Pressable style={styles.discoverCardViewAll} onPress={() => navigate('discoverWatchlist')}>
              <Text style={styles.discoverCardViewAllText}>{discoverBlendText.viewAll}</Text>
              <ThemedIonicons name="chevron-forward" size={14} color={palette.muted} />
            </Pressable>
          </View>
        </View>

      </ScrollView>
      </View>
    );
  };

  const renderDiscoverSectionListScreen = (section: DiscoverFullSection) => {
    const emptyLabel =
      lang === 'ko'
        ? '표시할 항목이 없습니다.'
        : lang === 'zh'
          ? '暂无可显示内容。'
          : 'No items to display.';

    const title =
      section === 'earn'
        ? discoverBlendText.earn
        : section === 'dapps'
          ? discoverBlendText.exploreDapps
          : section === 'watchlist'
            ? discoverBlendText.watchlist
            : section === 'sites'
              ? discoverBlendText.sites
              : discoverBlendText.latestUpdates;
    const watchlistPageLabel = `${discoverWatchlistCurrentPage} / ${discoverWatchlistTotalPages}`;
    const watchlistPrevLabel = lang === 'ko' ? '이전' : lang === 'zh' ? '上一页' : 'Prev';
    const watchlistNextLabel = lang === 'ko' ? '다음' : lang === 'zh' ? '下一页' : 'Next';

    return (
      <View style={styles.screen}>
        {renderSubHeader(title)}
        <ScrollView
          ref={(ref) => {
            discoverSectionScrollRef.current = ref;
          }}
          nativeID="discover-section-list-scroll"
          testID="discover-section-list-scroll"
          style={styles.scroll}
          contentContainerStyle={styles.scrollPad}
          showsVerticalScrollIndicator={false}
        >
          {section === 'earn' ? (
            <View style={styles.discoverEarnCard}>
              <Text style={styles.discoverEarnLabel}>{discoverBlendText.earn}</Text>
              <Text style={styles.discoverEarnValue}>
                {lang === 'ko' ? '준비중' : lang === 'zh' ? '准备中' : 'Coming Soon'}
              </Text>
              <Text style={styles.discoverEarnSummary}>
                {lang === 'ko'
                  ? '수익 기능은 현재 점검 및 고도화 중입니다.'
                  : lang === 'zh'
                    ? '收益功能正在优化与安全检查中。'
                    : 'Earn is currently under optimization and safety checks.'}
              </Text>
            </View>
          ) : null}

          {section === 'dapps' ? (
            <View style={styles.discoverBlockCard}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
                {discoverDappFilterIds.map((id) => (
                  <Pressable
                    key={`full-cate-${id}`}
                    style={[styles.categoryChip, discoverCategory === id ? styles.categoryChipActive : undefined]}
                    onPress={() => setDiscoverCategory(id)}
                  >
                    <Text style={discoverCategory === id ? styles.categoryTextActive : styles.categoryText}>{discoverCategories[id]}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              {renderDiscoverList(discoverDappItems)}
            </View>
          ) : null}

          {section === 'watchlist' ? (
            <View style={styles.discoverBlockCard}>
              {discoverWatchRows.length ? (
                discoverWatchlistPagedRows.map((row, index) => {
                  const capLabel = lang === 'ko' ? '시총' : lang === 'zh' ? '市值' : 'MCap';
                  const subLabel = `${row.capLabel} · ${row.volumeLabel}`;
                  const rightValue = row.rightPrimary ?? (row.priceUsd === null ? '--' : formatCurrency(row.priceUsd, text.locale));
                  const rightPrimaryHint = row.rightPrimaryHint ?? '';
                  const rightCap = row.rightSecondary ?? (row.marketCapUsd === null ? '--' : `${capLabel} ${formatCompactCurrency(row.marketCapUsd, text.locale)}`);
                  const effectiveIcon = row.iconUri && isUriRecentlyBroken(row.iconUri) ? undefined : row.iconSource;
                  const rightValueStyle =
                    row.rightPrimary || row.priceUsd !== null ? styles.discoverMarketPrice : [styles.discoverMarketPrice, { color: palette.muted }];

                  return (
                    <View key={row.id} style={[styles.discoverMarketRow, index > 0 ? styles.discoverMarketRowBorder : undefined]}>
                      <View style={styles.discoverMarketLeft}>
                        <View style={styles.discoverMarketTokenIconWrap}>
                        {effectiveIcon ? (
                          <View style={styles.discoverMarketTokenIconImageLayer}>
                              <Image
                                source={effectiveIcon}
                                style={styles.discoverMarketTokenIconImage}
                                onError={() => {
                                  if (!row.iconUri) return;
                                  setDiscoverBrokenIconUris((prev) => ({ ...prev, [row.iconUri!]: Date.now() }));
                                }}
                              />
                          </View>
                        ) : (
                          <Text style={styles.discoverDappIconText}>{String(row.symbol || '??').slice(0, 2)}</Text>
                        )}
                      </View>
                        <View style={styles.discoverMarketMeta}>
                          <View style={styles.discoverWatchTitleRow}>
                            <Text style={styles.discoverMarketName} numberOfLines={1}>
                              {row.name[lang] || row.name.en}
                            </Text>
                            <View style={styles.discoverWatchLevChip}>
                              <Text style={styles.discoverWatchLevText}>{row.leverage}</Text>
                            </View>
                          </View>
                          <Text style={styles.discoverMarketSub} numberOfLines={1}>
                            {subLabel}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.discoverMarketRight}>
                        <Text style={rightValueStyle} numberOfLines={1}>
                          {rightValue}
                        </Text>
                        {rightPrimaryHint ? (
                          <Text style={styles.discoverMarketMetricHint} numberOfLines={1}>
                            {rightPrimaryHint}
                          </Text>
                        ) : null}
                        <Text style={[styles.discoverMarketChange, { color: palette.muted }]} numberOfLines={1}>
                          {rightCap}
                        </Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.discoverEmptyCard}>
                  <Text style={styles.infoBody}>{emptyLabel}</Text>
                </View>
              )}
            </View>
          ) : null}

          {section === 'watchlist' && discoverWatchRows.length > 10 ? (
            <View style={styles.discoverPopularPagination}>
              <Pressable
                style={[
                  styles.discoverPopularPageBtn,
                  discoverWatchlistCurrentPage <= 1 ? styles.discoverPopularPageBtnDisabled : undefined
                ]}
                disabled={discoverWatchlistCurrentPage <= 1}
                onPress={() => {
                  setDiscoverWatchlistPage((prev) => Math.max(1, prev - 1));
                }}
              >
                <ThemedIonicons name="chevron-back" size={14} color={discoverWatchlistCurrentPage <= 1 ? palette.muted : palette.text} />
                <Text
                  style={[
                    styles.discoverPopularPageBtnText,
                    { marginLeft: 2 },
                    discoverWatchlistCurrentPage <= 1 ? styles.discoverPopularPageBtnTextDisabled : undefined
                  ]}
                >
                  {watchlistPrevLabel}
                </Text>
              </Pressable>

              <View style={styles.discoverPopularPageBadge}>
                <Text style={styles.discoverPopularPageBadgeText}>{watchlistPageLabel}</Text>
              </View>

              <Pressable
                style={[
                  styles.discoverPopularPageBtn,
                  discoverWatchlistCurrentPage >= discoverWatchlistTotalPages ? styles.discoverPopularPageBtnDisabled : undefined
                ]}
                disabled={discoverWatchlistCurrentPage >= discoverWatchlistTotalPages}
                onPress={() => {
                  setDiscoverWatchlistPage((prev) => Math.min(discoverWatchlistTotalPages, prev + 1));
                }}
              >
                <Text
                  style={[
                    styles.discoverPopularPageBtnText,
                    { marginRight: 2 },
                    discoverWatchlistCurrentPage >= discoverWatchlistTotalPages ? styles.discoverPopularPageBtnTextDisabled : undefined
                  ]}
                >
                  {watchlistNextLabel}
                </Text>
                <ThemedIonicons
                  name="chevron-forward"
                  size={14}
                  color={discoverWatchlistCurrentPage >= discoverWatchlistTotalPages ? palette.muted : palette.text}
                />
              </Pressable>
            </View>
          ) : null}

          {section === 'sites' ? (
            <View style={styles.discoverBlockCard}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
                {discoverSiteCategoryIds.map((id) => (
                  <Pressable
                    key={`full-site-cate-${id}`}
                    style={[styles.categoryChip, discoverSiteCategory === id ? styles.categoryChipActive : undefined]}
                    onPress={() => setDiscoverSiteCategory(id)}
                  >
                    <Text style={discoverSiteCategory === id ? styles.categoryTextActive : styles.categoryText}>
                      {discoverSiteCategories[id]}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              {discoverSiteTopRows.length ? renderDiscoverSiteList(discoverSiteTopRows) : (
                <View style={styles.discoverEmptyCard}>
                  <Text style={styles.infoBody}>{emptyLabel}</Text>
                </View>
              )}
            </View>
          ) : null}

          {section === 'latest' ? (
            <View style={styles.discoverBlockCard}>
              {discoverLatestItems.length ? (
                discoverLatestItems.map((item, index) => (
                  <Pressable
                    key={`discover-latest-full-${item.id}`}
                    style={[styles.discoverLatestRow, index > 0 ? styles.discoverMarketRowBorder : undefined]}
                    onPress={() => {
                      void handleDiscoverAction(item);
                    }}
                  >
                    <View style={styles.discoverLatestIcon}>
                      <Text style={styles.discoverDappIconText}>{item.title.slice(0, 1).toUpperCase()}</Text>
                    </View>
                    <View style={styles.discoverLatestMeta}>
                      <Text style={styles.discoverLatestTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.discoverLatestSub} numberOfLines={1}>
                        {item.summary}
                      </Text>
                    </View>
                    <Text style={styles.discoverLatestLink}>{discoverBlendText.open}</Text>
                  </Pressable>
                ))
              ) : (
                <View style={styles.discoverEmptyCard}>
                  <Text style={styles.infoBody}>{emptyLabel}</Text>
                </View>
              )}
            </View>
          ) : null}
        </ScrollView>
      </View>
    );
  };

  const renderDiscoverDappBrowser = () => {
    const browserTitle = lang === 'ko' ? 'DApp 브라우저' : lang === 'zh' ? 'DApp 浏览器' : 'DApp Browser';
    const noTabTitle = lang === 'ko' ? '열린 DApp 탭이 없습니다.' : lang === 'zh' ? '暂无打开的 DApp 标签。' : 'No DApp tabs are open.';
    const noTabBody =
      lang === 'ko'
        ? '둘러보기에서 DApp을 선택하면 여기에서 인앱으로 열립니다.'
        : lang === 'zh'
          ? '在发现页选择 DApp 后，会在这里以应用内方式打开。'
          : 'When you select a DApp in Discover, it opens here in-app.';
    const urlPlaceholder = lang === 'ko' ? 'https:// 로 시작하는 DApp URL 입력' : lang === 'zh' ? '输入以 https:// 开头的 DApp URL' : 'Enter DApp URL starting with https://';
    const openLabel = lang === 'ko' ? '이동' : lang === 'zh' ? '打开' : 'Open';
    const closeLabel = lang === 'ko' ? '닫기' : lang === 'zh' ? '关闭' : 'Close';
    const activeSecurityCheck = discoverActiveTab ? getDiscoverUrlSecurityCheckWithAllowlist(discoverActiveTab.url) : null;
    const securityBadgeLabel = !activeSecurityCheck
      ? ''
      : activeSecurityCheck.level === 'safe'
        ? activeSecurityCheck.reason === 'user-allowed'
          ? discoverSecurityText.badgeUserAllowed
          : discoverSecurityText.badgeSafe
        : activeSecurityCheck.level === 'caution'
          ? discoverSecurityText.badgeCaution
          : activeSecurityCheck.level === 'high'
            ? discoverSecurityText.badgeHigh
            : discoverSecurityText.blockedOpen;
    const securityReasonText = activeSecurityCheck ? getDiscoverSecurityReasonText(activeSecurityCheck.reason) : '';
    const securityHostText = activeSecurityCheck?.host ?? '';
    const securityBadgeIcon: keyof typeof Ionicons.glyphMap = activeSecurityCheck?.level === 'safe' ? 'shield-checkmark-outline' : 'alert-circle-outline';
    const favoriteIconName: React.ComponentProps<typeof MaterialIcons>['name'] = isDiscoverActiveTabFavorite ? 'star' : 'star-border';
    const backIconName: keyof typeof Ionicons.glyphMap = 'chevron-back-outline';
    const forwardIconName: keyof typeof Ionicons.glyphMap = 'chevron-forward-outline';
    const refreshIconName: keyof typeof Ionicons.glyphMap = 'refresh-outline';
    const openIconName: keyof typeof Ionicons.glyphMap = 'open-outline';
    const browserRightItems: {
      icon?: keyof typeof Ionicons.glyphMap;
      materialIcon?: React.ComponentProps<typeof MaterialIcons>['name'];
      action: () => void;
      color?: string;
    }[] = [
      discoverActiveTab
        ? {
            materialIcon: favoriteIconName,
            action: () => toggleDiscoverFavorite(discoverActiveTab),
            color: isDiscoverActiveTabFavorite ? palette.accent : palette.text
          }
        : {
            materialIcon: 'star-border',
            action: () => setBannerMessage(discoverActionText.notReady),
            color: palette.text
          },
      ...(Platform.OS !== 'web'
        ? [
            {
              icon: backIconName,
              action: () => {
                discoverWebViewRef.current?.goBack();
              },
              color: discoverWebViewCanGoBack ? palette.text : palette.muted
            },
            {
              icon: forwardIconName,
              action: () => {
                discoverWebViewRef.current?.goForward();
              },
              color: discoverWebViewCanGoForward ? palette.text : palette.muted
            }
          ]
        : []),
      { icon: refreshIconName, action: () => setDiscoverBrowserRefreshKey((prev) => prev + 1), color: palette.text },
      {
        icon: openIconName,
        action: () => {
          if (!discoverActiveTab) {
            setBannerMessage(discoverActionText.noLink);
            return;
          }
          void openAssetExternalLink(discoverActiveTab.url);
        },
        color: palette.text
      }
    ];

    return (
      <View style={styles.screen}>
        {renderTopHeader(browserTitle, 'chevron-back', goBack, browserRightItems)}
        <View style={styles.discoverBrowserShell}>
          <View style={styles.discoverBrowserUrlRow}>
            <TextInput
              placeholder={urlPlaceholder}
              placeholderTextColor={palette.muted}
              style={styles.discoverBrowserUrlInput}
              value={discoverBrowserDraftUrl}
              onChangeText={setDiscoverBrowserDraftUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              onSubmitEditing={openDiscoverUrlDraft}
            />
            <Pressable style={styles.discoverBrowserGoBtn} onPress={openDiscoverUrlDraft}>
              <Text style={styles.discoverBrowserGoBtnText}>{openLabel}</Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.discoverBrowserTabRow}>
            {discoverOpenTabs.map((tab) => {
              const isActive = tab.id === discoverActiveTabId;
              return (
                <Pressable
                  key={tab.id}
                  style={[styles.discoverBrowserTabChip, isActive ? styles.discoverBrowserTabChipActive : undefined]}
                  onPress={() => {
                    setDiscoverActiveTabId(tab.id);
                    setDiscoverBrowserDraftUrl(tab.url);
                  }}
                >
                  <Text style={isActive ? styles.discoverBrowserTabChipTextActive : styles.discoverBrowserTabChipText} numberOfLines={1}>
                    {tab.title}
                  </Text>
                  <Pressable
                    style={styles.discoverBrowserTabCloseBtn}
                    onPress={(event) => {
                      event.stopPropagation?.();
                      closeDiscoverTab(tab.id);
                    }}
                    hitSlop={8}
                    accessibilityLabel={closeLabel}
                  >
                    <ThemedIonicons name="close" size={14} color={isActive ? '#111214' : palette.muted} />
                  </Pressable>
                </Pressable>
              );
            })}
          </ScrollView>

          {activeSecurityCheck ? (
            <View
              style={[
                styles.discoverSecurityBanner,
                activeSecurityCheck.level === 'safe'
                  ? styles.discoverSecurityBannerSafe
                  : activeSecurityCheck.level === 'caution'
                    ? styles.discoverSecurityBannerCaution
                    : styles.discoverSecurityBannerHigh
              ]}
            >
              <ThemedIonicons
                name={securityBadgeIcon}
                size={15}
                color={activeSecurityCheck.level === 'safe' ? palette.positive : palette.accent}
              />
              <View style={styles.discoverSecurityBannerMeta}>
                <Text style={styles.discoverSecurityBannerTitle} numberOfLines={1}>
                  {securityBadgeLabel}
                  {securityHostText ? ` · ${securityHostText}` : ''}
                </Text>
                <Text style={styles.discoverSecurityBannerBody} numberOfLines={2}>
                  {securityReasonText}
                </Text>
              </View>
            </View>
          ) : null}

          {discoverActiveTab ? (
            Platform.OS === 'web' ? (
              <View style={styles.discoverBrowserFrameCard}>
                {React.createElement('iframe', {
                  key: `${discoverActiveTab.id}-${discoverBrowserRefreshKey}`,
                  src: discoverActiveTab.url,
                  title: discoverActiveTab.title,
                  style: {
                    width: '100%',
                    height: '100%',
                    border: '0',
                    borderRadius: 16,
                    backgroundColor: themeMode === 'dark' ? '#0f1115' : '#ffffff'
                  },
                  referrerPolicy: 'no-referrer-when-downgrade'
                } as any)}
              </View>
            ) : (
              <View style={styles.discoverBrowserFrameCard}>
                <WebView
                  ref={(ref) => {
                    discoverWebViewRef.current = ref;
                  }}
                  key={`${discoverActiveTab.id}-${discoverBrowserRefreshKey}`}
                  source={{ uri: discoverActiveTab.url }}
                  originWhitelist={['https://*']}
                  onShouldStartLoadWithRequest={shouldStartDiscoverWebRequest as any}
                  onNavigationStateChange={(state) => {
                    syncDiscoverActiveTabNavigation({
                      url: state.url,
                      title: state.title,
                      canGoBack: state.canGoBack,
                      canGoForward: state.canGoForward
                    });
                  }}
                  onError={() => setBannerMessage(discoverActionText.noLink)}
                  setSupportMultipleWindows={false}
                  sharedCookiesEnabled={false}
                  thirdPartyCookiesEnabled={false}
                  allowsBackForwardNavigationGestures
                  style={styles.discoverBrowserWebView}
                />
              </View>
            )
          ) : (
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>{noTabTitle}</Text>
              <Text style={styles.infoBody}>{noTabBody}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderDiscoverTabListScreen = (kind: 'history' | 'favorite' | 'tabs') => {
    const titleMap = {
      history: text.history,
      favorite: lang === 'ko' ? '즐겨찾기' : lang === 'zh' ? '收藏' : 'Favorites',
      tabs: lang === 'ko' ? '열린 탭' : lang === 'zh' ? '打开标签' : 'Open Tabs'
    };
    const rows = kind === 'history' ? discoverHistoryTabs : kind === 'favorite' ? discoverFavoriteTabs : discoverOpenTabs;
    const emptyMessage =
      kind === 'history'
        ? text.discoverHistoryEmpty
        : kind === 'favorite'
          ? text.discoverFavoriteEmpty
          : text.discoverTabsEmpty;

    return (
      <View style={styles.screen}>
        {renderSubHeader(titleMap[kind])}
        <ScrollView
          ref={(ref) => {
            discoverTabListScrollRef.current = ref;
          }}
          nativeID="discover-tab-list-scroll"
          testID="discover-tab-list-scroll"
          style={styles.scroll}
          contentContainerStyle={styles.scrollPad}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.discoverBlockCard}>
            {rows.length ? (
              rows.map((tab, index) => (
                <Pressable
                  key={`${kind}-${tab.id}`}
                  style={[styles.discoverSiteRow, index > 0 ? styles.discoverMarketRowBorder : undefined]}
                  onPress={() => {
                    void openDiscoverDappBrowser(tab.url, tab.title, tab.sourceItemId);
                  }}
                >
                  <View style={styles.discoverSiteMeta}>
                    <Text style={styles.discoverSiteName} numberOfLines={1}>
                      {tab.title}
                    </Text>
                    <Text style={styles.discoverSiteDomain} numberOfLines={1}>
                      {tab.url}
                    </Text>
                  </View>
                  <View style={styles.discoverTabListActionWrap}>
                    {kind === 'favorite' ? (
                      <Pressable
                        style={styles.discoverTabListActionBtn}
                        onPress={(event) => {
                          event.stopPropagation?.();
                          toggleDiscoverFavorite(tab);
                        }}
                        hitSlop={8}
                      >
                        <MaterialIcons name="star" size={18} color={palette.accent} />
                      </Pressable>
                    ) : null}
                    {kind === 'tabs' ? (
                      <Pressable
                        style={styles.discoverTabListActionBtn}
                        onPress={(event) => {
                          event.stopPropagation?.();
                          closeDiscoverTab(tab.id);
                        }}
                        hitSlop={8}
                      >
                        <ThemedIonicons name="close" size={16} color={palette.muted} />
                      </Pressable>
                    ) : null}
                    <ThemedIonicons name="chevron-forward" size={16} color={palette.muted} />
                  </View>
                </Pressable>
              ))
            ) : (
              <View style={styles.discoverEmptyCard}>
                <Text style={styles.infoBody}>{emptyMessage}</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderDiscoverPopularRanking = () => {
    const title = lang === 'ko' ? '인기 토큰 순위' : lang === 'zh' ? '热门代币排行' : 'Popular Token Ranking';
    const emptyLabel = lang === 'ko' ? '인기 토큰 데이터를 불러오는 중입니다.' : lang === 'zh' ? '正在加载热门代币数据。' : 'Loading popular token data.';

    return (
      <View style={styles.screen}>
        {renderSubHeader(title)}
        <ScrollView
          ref={(ref) => {
            discoverPopularScrollRef.current = ref;
          }}
          nativeID="discover-popular-scroll"
          testID="discover-popular-scroll"
          style={styles.scroll}
          contentContainerStyle={styles.scrollPad}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.discoverBlockCard}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
              {discoverTokenCategoryIds.map((id) => (
                <Pressable
                  key={`popular-rank-cate-${id}`}
                  style={[styles.categoryChip, discoverTokenCategory === id ? styles.categoryChipActive : undefined]}
                  onPress={() => setDiscoverTokenCategory(id)}
                >
                  <Text style={discoverTokenCategory === id ? styles.categoryTextActive : styles.categoryText}>
                    {discoverTokenCategories[id]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            {discoverPopularTopRows.length ? (
              discoverPopularTopRows.map((token, index) => {
                const { source: tokenIconSource, activeUri: tokenIconUri } = resolveDiscoverPopularIconWithFallback(token.symbol, token.iconUrl);
                const isFavoriteToken = discoverFavoriteTokenSymbolSet.has(token.symbol.toUpperCase());
                const rank = index + 1;
                const capValue = formatCompactCurrency(token.marketCapUsd, text.locale);
                const volumeValue = formatCompactCurrency(token.volume24hUsd ?? token.marketCapUsd * 0.03, text.locale);
                const tokenNameDisplay = resolveDiscoverTokenDisplayName(token.symbol, token.name, lang);
                return (
                  <View
                    key={`discover-popular-rank-${token.id}-${rank}`}
                    style={[styles.discoverMarketRow, index > 0 ? styles.discoverMarketRowBorder : undefined]}
                  >
                    <Text style={styles.discoverPopularRank}>{rank}</Text>
                    <View style={styles.discoverMarketLeft}>
                      <View style={styles.discoverMarketTokenIconWrap}>
                        {tokenIconSource ? (
                          <View style={styles.discoverMarketTokenIconImageLayer}>
                            <Image
                              source={tokenIconSource}
                              style={styles.discoverMarketTokenIconImage}
                              onError={() => {
                                if (!tokenIconUri) return;
                                setDiscoverBrokenIconUris((prev) => ({ ...prev, [tokenIconUri]: Date.now() }));
                              }}
                            />
                          </View>
                        ) : (
                          <Text style={styles.discoverDappIconText}>{token.symbol.slice(0, 2)}</Text>
                        )}
                      </View>
                      <View style={styles.discoverMarketMeta}>
                        <View style={styles.discoverDappNameRow}>
                          <Text style={styles.discoverMarketName} numberOfLines={1}>
                            {tokenNameDisplay.primary}
                          </Text>
                          {tokenNameDisplay.secondary ? (
                            <Text style={styles.discoverDappAlias} numberOfLines={1}>
                              {tokenNameDisplay.secondary}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={styles.discoverMarketSub}>
                          {capValue} / {volumeValue}
                        </Text>
                        <Text style={styles.discoverMarketMetricHintLeft}>{discoverCapShortLabel} / {discoverVolShortLabel}</Text>
                      </View>
                    </View>
                    <View style={styles.discoverMarketRight}>
                      <View style={styles.discoverMarketPriceRow}>
                        <Text style={styles.discoverMarketPrice}>{formatCurrency(token.priceUsd, text.locale)}</Text>
                        <Pressable
                          style={styles.discoverMarketFavoriteBtn}
                          onPress={() => toggleDiscoverTokenFavorite(token.symbol)}
                          hitSlop={8}
                        >
                          <MaterialIcons name={isFavoriteToken ? 'star' : 'star-border'} size={18} color={palette.accent} />
                        </Pressable>
                      </View>
                      <Text style={[styles.discoverMarketChange, { color: token.change24h >= 0 ? palette.positive : palette.negative }]}>
                        {token.change24h >= 0 ? '+' : ''}
                        {token.change24h.toFixed(2)}%
                      </Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.discoverEmptyCard}>
                <Text style={styles.infoBody}>{emptyLabel}</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderDiscoverBriefingBoard = () => {
    const title = lang === 'ko' ? 'IMWallet 주간 브리핑' : lang === 'zh' ? 'IMWallet 每周简报' : 'IMWallet Weekly Briefing';
    const latestTag = lang === 'ko' ? '최신' : lang === 'zh' ? '最新' : 'Latest';
    const issueLabel = lang === 'ko' ? '이슈' : lang === 'zh' ? '议题' : 'Issue';
    const sourcesLabel = lang === 'ko' ? '출처' : lang === 'zh' ? '来源' : 'Sources';
    const expandLabel = lang === 'ko' ? '펼쳐보기' : lang === 'zh' ? '展开查看' : 'Expand';
    const collapseLabel = lang === 'ko' ? '접기' : lang === 'zh' ? '收起' : 'Collapse';
    const noPostsLabel =
      lang === 'ko'
        ? '선택한 주차의 브리핑이 없습니다.'
        : lang === 'zh'
          ? '该周暂无简报内容。'
          : 'No briefing posts for the selected week.';
    const selectWeekLabel = lang === 'ko' ? '주차 선택' : lang === 'zh' ? '选择周次' : 'Select week';
    const selectedPosts = (activeBriefingWeekGroup?.posts ?? []).slice(0, 3);
    const latestWeekKey = weeklyBriefingWeekGroups[0]?.weekKey ?? null;
    const isLatestWeek = Boolean(activeBriefingWeekGroup?.weekKey && activeBriefingWeekGroup.weekKey === latestWeekKey);
    const hasExpandedCard = Boolean(discoverBriefingExpandedId);
    const selectedWeekChipLabel = activeBriefingWeekGroup?.label ?? selectWeekLabel;
    const blurFxStyle = Platform.OS === 'web' ? ({ filter: 'blur(2px)' } as any) : undefined;

    return (
      <View style={styles.screen}>
        {renderSubHeader(title)}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollPad}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!showDiscoverBriefingWeekMenu}
        >
          <View
            style={[
              styles.discoverBriefingWeekWrap,
              hasExpandedCard ? styles.discoverBriefingBlurredArea : undefined,
              hasExpandedCard ? blurFxStyle : undefined
            ]}
          >
            <View ref={discoverBriefingWeekTriggerRef} onLayout={measureDiscoverBriefingWeekTriggerAnchor}>
              <Pressable
                style={[styles.discoverBriefingWeekBtn, showDiscoverBriefingWeekMenu ? styles.discoverBriefingWeekBtnActive : undefined]}
                onPress={() =>
                  setShowDiscoverBriefingWeekMenu((prev) => {
                    if (prev) return false;
                    measureDiscoverBriefingWeekTriggerAnchor();
                    return true;
                  })
                }
              >
                <Text style={[styles.discoverBriefingWeekBtnText, showDiscoverBriefingWeekMenu ? styles.discoverBriefingWeekBtnTextActive : undefined]} numberOfLines={1}>
                  {selectedWeekChipLabel}
                </Text>
                <ThemedIonicons
                  name={showDiscoverBriefingWeekMenu ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={showDiscoverBriefingWeekMenu ? '#16110a' : palette.text}
                  style={styles.discoverBriefingWeekBtnChevron}
                />
              </Pressable>
            </View>
          </View>

          {selectedPosts.length === 0 ? (
            <View style={styles.discoverBriefingCard}>
              <Text style={styles.discoverBriefingSummary}>{noPostsLabel}</Text>
            </View>
          ) : null}

          {selectedPosts.map((post, index) => {
            const date = new Date(`${post.publishedAt}T00:00:00`);
            const dateLabel = Number.isNaN(date.getTime())
              ? post.publishedAt
              : date.toLocaleDateString(text.locale, { year: 'numeric', month: '2-digit', day: '2-digit' });
            const expanded = discoverBriefingExpandedId === post.id;
            const longParagraphs = buildBriefingLongParagraphs(post, lang);
            return (
              <View
                key={post.id}
                style={[
                  styles.discoverBriefingCard,
                  !expanded ? styles.discoverBriefingCardCollapsed : undefined,
                  expanded ? styles.discoverBriefingCardExpanded : undefined,
                  hasExpandedCard && !expanded ? styles.discoverBriefingCardBlurred : undefined,
                  hasExpandedCard && !expanded ? blurFxStyle : undefined
                ]}
              >
                <View style={styles.discoverBriefingHead}>
                  <View style={styles.discoverBriefingHeadLeft}>
                    <Text style={styles.discoverBriefingDate}>{dateLabel}</Text>
                    <View style={styles.discoverBriefingIssueChip}>
                    <Text style={styles.discoverBriefingIssueText}>{`${issueLabel} ${index + 1}`}</Text>
                  </View>
                    {isLatestWeek ? (
                      <View style={styles.discoverBriefingLatestChip}>
                        <Text style={styles.discoverBriefingLatestText}>{latestTag}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Pressable
                    style={[styles.discoverBriefingToggleBtn, expanded ? styles.discoverBriefingToggleBtnActive : undefined]}
                    onPress={() => setDiscoverBriefingExpandedId((prev) => (prev === post.id ? null : post.id))}
                  >
                    <Text style={[styles.discoverBriefingToggleText, expanded ? styles.discoverBriefingToggleTextActive : undefined]}>
                      {expanded ? collapseLabel : expandLabel}
                    </Text>
                    <ThemedIonicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={expanded ? '#16110a' : palette.muted} />
                  </Pressable>
                </View>
                <Text style={styles.discoverBriefingTitle} numberOfLines={expanded ? undefined : 2}>
                  {post.title}
                </Text>
                <Text style={[styles.discoverBriefingSummary, !expanded ? styles.discoverBriefingSummaryCollapsed : undefined]} numberOfLines={expanded ? undefined : 5}>
                  {post.summary}
                </Text>
                {expanded ? (
                  <View style={styles.discoverBriefingExpandedBody}>
                    {longParagraphs.map((paragraph, paragraphIndex) => (
                      <Text key={`${post.id}-long-${paragraphIndex}`} style={styles.discoverBriefingLongParagraph}>
                        {paragraph}
                      </Text>
                    ))}
                    {post.points.map((point, pointIndex) => (
                      <Text key={`${post.id}-point-${pointIndex}`} style={styles.discoverBriefingPoint}>
                        • {point}
                      </Text>
                    ))}
                    {post.sources.length ? (
                      <View style={styles.discoverBriefingSourcesWrap}>
                        <Text style={styles.discoverBriefingSourcesLabel}>{sourcesLabel}</Text>
                        {post.sources.map((source, sourceIndex) => (
                          <Pressable key={`${post.id}-source-${sourceIndex}`} onPress={() => void Linking.openURL(source.url)}>
                            <Text style={styles.discoverBriefingSourceLink}>{source.label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderSettings = () => (
    <View style={styles.screen}>
      {renderSubHeader(text.settings)}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollPad}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!showLangMenu}
      >
        <View style={styles.settingsScrollContent}>
          <Text style={styles.settingSectionTitle} numberOfLines={1}>
            {text.wallets}
          </Text>
          <Pressable style={styles.settingRow} onPress={() => void openWalletSettingsWithAuth()}>
            <Text style={styles.settingLabel} numberOfLines={1}>
              {text.wallets}
            </Text>
            <ThemedIonicons name="chevron-forward" size={18} color={palette.muted} />
          </Pressable>
          <Pressable style={styles.settingRow} onPress={() => void openAddressBookWithAuth()}>
            <Text style={styles.settingLabel} numberOfLines={1}>
              {extra.addressBookManage}
            </Text>
            <ThemedIonicons name="chevron-forward" size={18} color={palette.muted} />
          </Pressable>

          <Text style={styles.settingSectionTitle} numberOfLines={1}>
            {text.security}
          </Text>
          <Pressable style={styles.settingRow} onPress={() => void openSecuritySettingsWithAuth()}>
            <Text style={styles.settingLabel} numberOfLines={1}>
              {text.security}
            </Text>
            <ThemedIonicons name="chevron-forward" size={18} color={palette.muted} />
          </Pressable>
          <Pressable style={styles.settingRow} onPress={() => navigate('settingsDappSecurity')}>
            <Text style={styles.settingLabel} numberOfLines={1}>
              {discoverAllowlistText.settingsLabel}
            </Text>
            <ThemedIonicons name="chevron-forward" size={18} color={palette.muted} />
          </Pressable>
          <Pressable style={styles.settingRow} onPress={() => navigate('settingsNotifications')}>
            <Text style={styles.settingLabel} numberOfLines={1}>
              {text.notifications}
            </Text>
            <ThemedIonicons name="chevron-forward" size={18} color={palette.muted} />
          </Pressable>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel} numberOfLines={1}>
              {text.theme}
            </Text>
            <View style={styles.settingThemeSwitch}>
              <Animated.View pointerEvents="none" style={[styles.settingThemeActivePill, settingThemeIndicatorStyle]} />
              <Pressable
                style={styles.settingThemeBtn}
                onLayout={(event) => {
                  const { x, width } = event.nativeEvent.layout;
                  setSettingThemeLayout((prev) =>
                    Math.abs(prev.firstX - x) > 0.5 || Math.abs(prev.firstWidth - width) > 0.5 ? { ...prev, firstX: x, firstWidth: width } : prev
                  );
                }}
                onPress={() => setThemeMode('light')}
              >
                <Text style={themeMode === 'light' ? styles.settingThemeBtnTextActive : styles.settingThemeBtnText}>{text.light}</Text>
              </Pressable>
              <Pressable
                style={styles.settingThemeBtn}
                onLayout={(event) => {
                  const { x } = event.nativeEvent.layout;
                  setSettingThemeLayout((prev) => (Math.abs(prev.secondX - x) > 0.5 ? { ...prev, secondX: x } : prev));
                }}
                onPress={() => setThemeMode('dark')}
              >
                <Text style={themeMode === 'dark' ? styles.settingThemeBtnTextActive : styles.settingThemeBtnText}>{text.dark}</Text>
              </Pressable>
            </View>
          </View>

          <View style={[styles.settingRow, styles.settingRowLang]}>
            <Text style={styles.settingLabel} numberOfLines={1}>
              {text.language}
            </Text>
            <View ref={settingsLangTriggerRef} onLayout={measureSettingsLangTriggerAnchor}>
              <Pressable
                style={[
                  styles.langBtn,
                  showLangMenu ? styles.langBtnActive : undefined
                ]}
                onPress={() => {
                  measureSettingsLangTriggerAnchor();
                  setShowLangMenu((prev) => !prev);
                }}
              >
                <Text style={[styles.langBtnText, showLangMenu ? styles.langBtnTextActive : undefined]}>{languageLabel[lang]}</Text>
                <ThemedIonicons name={showLangMenu ? 'chevron-up' : 'chevron-down'} size={14} color={showLangMenu ? '#16110a' : palette.text} />
              </Pressable>
            </View>
          </View>

          <Text style={styles.settingSectionTitle} numberOfLines={1}>
            {text.helpCenter}
          </Text>
          <Pressable style={styles.settingRow} onPress={() => navigate('settingsHelp')}>
            <Text style={styles.settingLabel} numberOfLines={1}>
              {text.helpCenter}
            </Text>
            <ThemedIonicons name="chevron-forward" size={18} color={palette.muted} />
          </Pressable>
          <Pressable style={styles.settingRow} onPress={() => navigate('settingsPrivacy')}>
            <Text style={styles.settingLabel} numberOfLines={1}>
              {text.privacyPolicy}
            </Text>
            <ThemedIonicons name="chevron-forward" size={18} color={palette.muted} />
          </Pressable>
          <Pressable style={styles.settingRow} onPress={() => navigate('settingsSupport')}>
            <Text style={styles.settingLabel} numberOfLines={1}>
              {text.support}
            </Text>
            <ThemedIonicons name="chevron-forward" size={18} color={palette.muted} />
          </Pressable>
          <Pressable style={styles.settingRow} onPress={() => navigate('settingsAbout')}>
            <Text style={styles.settingLabel} numberOfLines={1}>
              {text.about}
            </Text>
            <ThemedIonicons name="chevron-forward" size={18} color={palette.muted} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );

  const renderSettingsLangOverlay = () => {
    if (!(currentScreen === 'settings' && showLangMenu && settingsLangTriggerRect)) return null;

    const menuHeight = 116;
    const desiredTop = settingsLangTriggerRect.y + settingsLangTriggerRect.height + 8;
    const minTop = headerOverlayHeightValue + 8;
    const maxTop = Math.max(minTop, viewportHeight - effectiveBottomInset - menuHeight - 10);
    const menuTop = Math.min(desiredTop, maxTop);

    return (
      <>
        <Pressable style={styles.globalDropdownScrim} onPress={() => setShowLangMenu(false)} />
        <View pointerEvents="box-none" style={styles.globalDropdownLayer}>
          <Pressable
            style={[
              styles.langBtn,
              styles.langBtnActive,
              styles.globalRecentOverlayTrigger,
              {
                top: settingsLangTriggerRect.y,
                left: settingsLangTriggerRect.x,
                width: settingsLangTriggerRect.width,
                height: settingsLangTriggerRect.height,
                borderRadius: settingsLangTriggerRect.height / 2
              }
            ]}
            onPress={() => setShowLangMenu(false)}
          >
            <Text style={[styles.langBtnText, styles.langBtnTextActive]}>{languageLabel[lang]}</Text>
            <ThemedIonicons name="chevron-up" size={14} color="#16110a" />
          </Pressable>
          <Animated.View
            style={[
              styles.langMenuFloating,
              styles.globalRecentOverlayTrigger,
              langMenuAnimatedStyle,
              {
                top: menuTop,
                left: settingsLangTriggerRect.x,
                width: settingsLangTriggerRect.width
              }
            ]}
          >
            {(['ko', 'en', 'zh'] as Language[]).map((code, index, items) => (
              <Pressable
                key={`lang-overlay-${code}`}
                style={[
                  styles.langItem,
                  index < items.length - 1 ? styles.langItemDivider : undefined,
                  index === items.length - 1 ? styles.langItemLast : undefined,
                  lang === code ? styles.langItemActive : undefined
                ]}
                onPress={() => {
                  setLang(code);
                  setShowLangMenu(false);
                }}
              >
                <Text style={lang === code ? styles.langItemTextActive : styles.langItemText}>{languageLabel[code]}</Text>
              </Pressable>
            ))}
          </Animated.View>
        </View>
      </>
    );
  };

  const renderDiscoverBriefingWeekOverlay = () => {
    if (!(currentScreen === 'discoverBriefingBoard' && showDiscoverBriefingWeekMenu && discoverBriefingWeekTriggerRect)) return null;

    const selectWeekLabel = lang === 'ko' ? '주차 선택' : lang === 'zh' ? '选择周次' : 'Select week';
    const selectedWeekChipLabel = activeBriefingWeekGroup?.label ?? selectWeekLabel;
    const menuHeight = Math.max(120, Math.min(weeklyBriefingWeekGroups.length * 39 + 2, 240));
    const desiredTop = discoverBriefingWeekTriggerRect.y + discoverBriefingWeekTriggerRect.height + 8;
    const minTop = headerOverlayHeightValue + 8;
    const maxTop = Math.max(minTop, viewportHeight - effectiveBottomInset - menuHeight - 10);
    const menuTop = Math.min(desiredTop, maxTop);

    return (
      <>
        <Pressable style={styles.globalDropdownScrim} onPress={() => setShowDiscoverBriefingWeekMenu(false)} />
        <View pointerEvents="box-none" style={styles.globalDropdownLayer}>
          <Pressable
            style={[
              styles.discoverBriefingWeekBtn,
              styles.discoverBriefingWeekBtnActive,
              styles.globalRecentOverlayTrigger,
              {
                top: discoverBriefingWeekTriggerRect.y,
                left: discoverBriefingWeekTriggerRect.x,
                width: discoverBriefingWeekTriggerRect.width,
                height: discoverBriefingWeekTriggerRect.height,
                borderRadius: discoverBriefingWeekTriggerRect.height / 2
              }
            ]}
            onPress={() => setShowDiscoverBriefingWeekMenu(false)}
          >
            <Text style={[styles.discoverBriefingWeekBtnText, styles.discoverBriefingWeekBtnTextActive]} numberOfLines={1}>
              {selectedWeekChipLabel}
            </Text>
            <ThemedIonicons name="chevron-up" size={14} color="#16110a" style={styles.discoverBriefingWeekBtnChevron} />
          </Pressable>
          <Animated.View
            style={[
              styles.discoverBriefingWeekMenu,
              styles.discoverBriefingWeekMenuFloating,
              styles.globalRecentOverlayTrigger,
              discoverBriefingWeekMenuAnimatedStyle,
              {
                top: menuTop,
                left: discoverBriefingWeekTriggerRect.x,
                width: discoverBriefingWeekTriggerRect.width
              }
            ]}
          >
            {weeklyBriefingWeekGroups.map((group) => {
              const selected = activeBriefingWeekGroup?.weekKey === group.weekKey;
              return (
                <Pressable
                  key={`briefing-week-overlay-${group.weekKey}`}
                  style={[styles.discoverBriefingWeekItem, selected ? styles.discoverBriefingWeekItemActive : undefined]}
                  onPress={() => {
                    setDiscoverBriefingWeekKey(group.weekKey);
                    setShowDiscoverBriefingWeekMenu(false);
                  }}
                >
                  <Text style={[styles.discoverBriefingWeekItemText, selected ? styles.discoverBriefingWeekItemTextActive : undefined]}>
                    {group.label}
                  </Text>
                </Pressable>
              );
            })}
          </Animated.View>
        </View>
      </>
    );
  };

  const renderThemeSettings = () => (
    <View style={styles.screen}>
      {renderSubHeader(text.theme)}
      <View style={styles.singleWrap}>
        <View style={styles.themeSegmentWrap}>
          <Pressable
            style={[styles.themeSegmentBtn, themeMode === 'light' ? styles.themeSegmentBtnActive : undefined]}
            onPress={() => setThemeMode('light')}
          >
            <Text style={themeMode === 'light' ? styles.themeSegmentTextActive : styles.themeSegmentText}>{text.light}</Text>
          </Pressable>
          <Pressable
            style={[styles.themeSegmentBtn, themeMode === 'dark' ? styles.themeSegmentBtnActive : undefined]}
            onPress={() => setThemeMode('dark')}
          >
            <Text style={themeMode === 'dark' ? styles.themeSegmentTextActive : styles.themeSegmentText}>{text.dark}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  const renderSecuritySettings = () => {
    const autoLockOptions: { value: AutoLockOption; label: string }[] = [
      { value: 'IMMEDIATE', label: text.autoLockImmediate },
      { value: '1M', label: text.autoLock1m },
      { value: '5M', label: text.autoLock5m },
      { value: '1H', label: text.autoLock1h },
      { value: '5H', label: text.autoLock5h }
    ];
    const currentAutoLockLabel = autoLockOptions.find((item) => item.value === autoLockOption)?.label ?? text.autoLockImmediate;
    const lockMethodKind: 'password' | 'biometric' = sendAuthMethod === 'password' ? 'password' : 'biometric';
    const lockMethodLabel = lockMethodKind === 'password' ? flow.passwordMode : text.biometric;
    const biometricTypeLabel = sendAuthMethod === 'face' ? flow.faceMode : flow.fingerprintMode;
    const showSecurityDropdownScrim = showAutoLockMenu || showLockMethodMenu || showBiometricTypeMenu;

    return (
      <View style={styles.screen}>
        {renderSubHeader(text.security)}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollPad}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!showSecurityDropdownScrim}
        >
          <View style={styles.toggleRow}>
            <Text style={styles.settingLabel}>{text.passwordLock}</Text>
            <AssetSwitchToggle enabled={passwordLockEnabled} onToggle={() => setPasswordLockEnabled((prev) => !prev)} styles={styles} />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.securityLabelWrap}>
              <Text style={styles.settingLabel}>{text.transactionSigning}</Text>
              <Text style={styles.securityHintText}>{text.transactionSigningHint}</Text>
            </View>
            <AssetSwitchToggle enabled={confirmSign} onToggle={() => setConfirmSign((prev) => !prev)} styles={styles} />
          </View>

          <View style={[styles.securityInfoRow, styles.securityPickerRow, styles.securityPickerRowTop]}>
            <Text style={styles.settingLabel}>{text.autoLock}</Text>
            <View
              ref={securityAutoLockTriggerRef}
              onLayout={measureSecurityAutoLockTriggerAnchor}
              style={showAutoLockMenu ? styles.dropdownTriggerMenuWrapOpen : styles.dropdownTriggerMenuWrap}
            >
              <Pressable
                style={[styles.langBtn, showAutoLockMenu ? styles.langBtnActive : undefined]}
                onPress={() => {
                  measureSecurityAutoLockTriggerAnchor();
                  setShowLockMethodMenu(false);
                  setShowBiometricTypeMenu(false);
                  setShowAutoLockMenu((prev) => !prev);
                }}
              >
                <Text style={[styles.langBtnText, showAutoLockMenu ? styles.langBtnTextActive : undefined]}>{currentAutoLockLabel}</Text>
                <ThemedIonicons
                  name={showAutoLockMenu ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={showAutoLockMenu ? '#16110a' : palette.text}
                />
              </Pressable>
            </View>
          </View>

          <View style={[styles.securityInfoRow, styles.securityPickerRow, styles.securityPickerRowMiddle]}>
            <Text style={styles.settingLabel}>{text.lockMethod}</Text>
            <View
              ref={securityLockMethodTriggerRef}
              onLayout={measureSecurityLockMethodTriggerAnchor}
              style={showLockMethodMenu ? styles.dropdownTriggerMenuWrapOpen : styles.dropdownTriggerMenuWrap}
            >
              <Pressable
                style={[styles.langBtn, showLockMethodMenu ? styles.langBtnActive : undefined]}
                onPress={() => {
                  measureSecurityLockMethodTriggerAnchor();
                  setShowAutoLockMenu(false);
                  setShowBiometricTypeMenu(false);
                  setShowLockMethodMenu((prev) => !prev);
                }}
              >
                <Text style={[styles.langBtnText, showLockMethodMenu ? styles.langBtnTextActive : undefined]}>{lockMethodLabel}</Text>
                <ThemedIonicons
                  name={showLockMethodMenu ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={showLockMethodMenu ? '#16110a' : palette.text}
                />
              </Pressable>
            </View>
          </View>

          {lockMethodKind === 'biometric' ? (
            <View style={[styles.securityInfoRow, styles.securityPickerRow, styles.securityPickerRowBottom]}>
              <Text style={styles.settingLabel}>{text.biometricType}</Text>
              <View
                ref={securityBiometricTypeTriggerRef}
                onLayout={measureSecurityBiometricTypeTriggerAnchor}
                style={showBiometricTypeMenu ? styles.dropdownTriggerMenuWrapOpen : styles.dropdownTriggerMenuWrap}
              >
                <Pressable
                  style={[styles.langBtn, showBiometricTypeMenu ? styles.langBtnActive : undefined]}
                  onPress={() => {
                    measureSecurityBiometricTypeTriggerAnchor();
                    setShowAutoLockMenu(false);
                    setShowLockMethodMenu(false);
                    setShowBiometricTypeMenu((prev) => !prev);
                  }}
                >
                  <Text style={[styles.langBtnText, showBiometricTypeMenu ? styles.langBtnTextActive : undefined]}>{biometricTypeLabel}</Text>
                  <ThemedIonicons
                    name={showBiometricTypeMenu ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={showBiometricTypeMenu ? '#16110a' : palette.text}
                  />
                </Pressable>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>
    );
  };

  const renderSecurityDropdownOverlay = () => {
    if (currentScreen !== 'settingsSecurity') return null;

    const closeSecurityMenus = () => {
      setShowAutoLockMenu(false);
      setShowLockMethodMenu(false);
      setShowBiometricTypeMenu(false);
    };

    const autoLockOptions: { value: AutoLockOption; label: string }[] = [
      { value: 'IMMEDIATE', label: text.autoLockImmediate },
      { value: '1M', label: text.autoLock1m },
      { value: '5M', label: text.autoLock5m },
      { value: '1H', label: text.autoLock1h },
      { value: '5H', label: text.autoLock5h }
    ];
    const lockMethodKind: 'password' | 'biometric' = sendAuthMethod === 'password' ? 'password' : 'biometric';
    const currentAutoLockLabel = autoLockOptions.find((item) => item.value === autoLockOption)?.label ?? text.autoLockImmediate;
    const lockMethodLabel = lockMethodKind === 'password' ? flow.passwordMode : text.biometric;
    const biometricTypeLabel = sendAuthMethod === 'face' ? flow.faceMode : flow.fingerprintMode;

    let triggerRect: { x: number; y: number; width: number; height: number } | null = null;
    let triggerLabel = '';
    let animatedStyle = autoLockMenuAnimatedStyle;
    let items: { key: string; label: string; active: boolean; onPress: () => void }[] = [];

    if (showAutoLockMenu && securityAutoLockTriggerRect) {
      triggerRect = securityAutoLockTriggerRect;
      triggerLabel = currentAutoLockLabel;
      animatedStyle = autoLockMenuAnimatedStyle;
      items = autoLockOptions.map((item) => ({
        key: `lock-${item.value}`,
        label: item.label,
        active: autoLockOption === item.value,
        onPress: () => {
          setAutoLockOption(item.value);
          closeSecurityMenus();
        }
      }));
    } else if (showLockMethodMenu && securityLockMethodTriggerRect) {
      triggerRect = securityLockMethodTriggerRect;
      triggerLabel = lockMethodLabel;
      animatedStyle = lockMethodMenuAnimatedStyle;
      items = [
        {
          key: 'lock-method-password',
          label: flow.passwordMode,
          active: lockMethodKind === 'password',
          onPress: () => {
            setBiometric(false);
            setSendAuthMethod('password');
            closeSecurityMenus();
          }
        },
        {
          key: 'lock-method-biometric',
          label: text.biometric,
          active: lockMethodKind === 'biometric',
          onPress: () => {
            void (async () => {
              const targetMode: Exclude<SendAuthMethod, 'password'> =
                sendAuthMethod === 'password'
                  ? (fingerprintBiometricSupported ? 'fingerprint' : faceBiometricSupported ? 'face' : 'fingerprint')
                  : sendAuthMethod;
              const available = await ensureBiometricModeAvailable(targetMode);
              if (!available) {
                closeSecurityMenus();
                return;
              }
              setBiometric(true);
              if (sendAuthMethod === 'password') setSendAuthMethod(targetMode);
              closeSecurityMenus();
            })();
          }
        }
      ];
    } else if (showBiometricTypeMenu && securityBiometricTypeTriggerRect) {
      triggerRect = securityBiometricTypeTriggerRect;
      triggerLabel = biometricTypeLabel;
      animatedStyle = biometricTypeMenuAnimatedStyle;
      const biometricTypeItems: { key: string; label: string; active: boolean; onPress: () => void }[] = [];
      if (fingerprintBiometricSupported) {
        biometricTypeItems.push({
          key: 'biometric-type-fingerprint',
          label: flow.fingerprintMode,
          active: sendAuthMethod === 'fingerprint',
          onPress: () => {
            void (async () => {
              const available = await ensureBiometricModeAvailable('fingerprint');
              if (!available) {
                closeSecurityMenus();
                return;
              }
              setBiometric(true);
              setSendAuthMethod('fingerprint');
              closeSecurityMenus();
            })();
          }
        });
      }
      if (faceBiometricSupported) {
        biometricTypeItems.push({
          key: 'biometric-type-face',
          label: flow.faceMode,
          active: sendAuthMethod === 'face',
          onPress: () => {
            void (async () => {
              const available = await ensureBiometricModeAvailable('face');
              if (!available) {
                closeSecurityMenus();
                return;
              }
              setBiometric(true);
              setSendAuthMethod('face');
              closeSecurityMenus();
            })();
          }
        });
      }
      items = biometricTypeItems;
    }

    if (!triggerRect || !items.length) return null;

    const menuHeight = Math.max(96, Math.min(items.length * 39 + 2, 240));
    const desiredTop = triggerRect.y + triggerRect.height + 8;
    const minTop = headerOverlayHeightValue + 8;
    const maxTop = Math.max(minTop, viewportHeight - effectiveBottomInset - menuHeight - 10);
    const menuTop = Math.min(desiredTop, maxTop);

    return (
      <>
        <Pressable style={styles.globalDropdownScrim} onPress={closeSecurityMenus} />
        <View pointerEvents="box-none" style={styles.globalDropdownLayer}>
          <Pressable
            style={[
              styles.langBtn,
              styles.langBtnActive,
              styles.globalRecentOverlayTrigger,
              {
                top: triggerRect.y,
                left: triggerRect.x,
                width: triggerRect.width,
                height: triggerRect.height,
                borderRadius: triggerRect.height / 2
              }
            ]}
            onPress={closeSecurityMenus}
          >
            <Text style={[styles.langBtnText, styles.langBtnTextActive]}>{triggerLabel}</Text>
            <ThemedIonicons name="chevron-up" size={14} color="#16110a" />
          </Pressable>
          <Animated.View
            style={[
              styles.langMenuFloating,
              styles.globalRecentOverlayTrigger,
              animatedStyle,
              {
                top: menuTop,
                left: triggerRect.x,
                width: triggerRect.width
              }
            ]}
          >
            {items.map((item, index) => {
              const isLast = index === items.length - 1;
              return (
                <Pressable
                  key={item.key}
                  style={[
                    styles.langItem,
                    !isLast ? styles.langItemDivider : undefined,
                    isLast ? styles.langItemLast : undefined,
                    item.active ? styles.langItemActive : undefined
                  ]}
                  onPress={item.onPress}
                >
                  <Text style={item.active ? styles.langItemTextActive : styles.langItemText}>{item.label}</Text>
                </Pressable>
              );
            })}
          </Animated.View>
        </View>
      </>
    );
  };

  const renderDiscoverSecuritySettings = () => {
    const editing = Boolean(discoverTrustedEditEntry);
    return (
      <View style={styles.screen}>
        {renderSubHeader(discoverAllowlistText.title)}
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
          <Text style={styles.settingSectionTitle}>{discoverAllowlistText.customSection}</Text>
          <Text style={styles.discoverTrustedGuideText}>{discoverAllowlistText.description}</Text>

          <View style={styles.discoverTrustedInputRow}>
            <TextInput
              placeholder={discoverAllowlistText.placeholder}
              placeholderTextColor={palette.muted}
              value={discoverTrustedHostInput}
              onChangeText={setDiscoverTrustedHostInput}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.discoverTrustedInput, seedInputWebStyle]}
            />
            <Pressable
              style={styles.discoverTrustedAddBtn}
              onPress={() => {
                if (editing) {
                  saveDiscoverTrustedHostEdit();
                  return;
                }
                addDiscoverTrustedHost(discoverTrustedHostInput, {
                  clearInput: true,
                  clearMemo: true
                });
              }}
            >
              <Text style={styles.discoverTrustedAddBtnText}>{editing ? discoverAllowlistText.save : discoverAllowlistText.add}</Text>
            </Pressable>
          </View>

          <View style={styles.discoverTrustedInputRow}>
            <TextInput
              placeholder={discoverAllowlistText.memoPlaceholder}
              placeholderTextColor={palette.muted}
              value={discoverTrustedHostMemoInput}
              onChangeText={setDiscoverTrustedHostMemoInput}
              autoCapitalize="sentences"
              autoCorrect={false}
              style={[styles.discoverTrustedInput, seedInputWebStyle]}
            />
          </View>

          {editing ? (
            <Pressable style={styles.secondaryBtn} onPress={resetDiscoverTrustedEditor}>
              <Text style={styles.secondaryBtnText}>{discoverAllowlistText.cancel}</Text>
            </Pressable>
          ) : null}

          {discoverActiveHost ? (
            <Pressable
              style={styles.settingRow}
              onPress={() => {
                addDiscoverTrustedHost(discoverActiveHost, { silent: false });
              }}
            >
              <View style={styles.discoverTrustedRowMeta}>
                <Text style={styles.settingLabel} numberOfLines={1}>
                  {discoverAllowlistText.addCurrent}
                </Text>
                <Text style={styles.discoverTrustedRowHint} numberOfLines={1}>
                  {discoverActiveHost}
                </Text>
              </View>
              <ThemedIonicons name="add-circle-outline" size={18} color={palette.accent} />
            </Pressable>
          ) : null}

          <View style={styles.discoverTrustedListWrap}>
            {discoverTrustedHostEntries.length ? (
              discoverTrustedHostEntries.map((entry) => (
                <View key={entry.id} style={styles.discoverTrustedEntryCard}>
                  <View style={styles.discoverTrustedEntryHead}>
                    <Text style={styles.discoverTrustedEntryHost} numberOfLines={1}>
                      {entry.host}
                    </Text>
                    <View style={styles.rowActions}>
                      <Pressable style={styles.rowActionBtn} onPress={() => openEditDiscoverTrustedHost(entry)}>
                        <ThemedIonicons name="create-outline" size={14} color={palette.text} />
                      </Pressable>
                      <Pressable style={styles.rowActionBtn} onPress={() => removeDiscoverTrustedHost(entry.id)}>
                        <ThemedIonicons name="trash-outline" size={14} color={palette.negative} />
                      </Pressable>
                    </View>
                  </View>
                  <Text style={styles.discoverTrustedEntryMemo} numberOfLines={2}>
                    {entry.memo || '-'}
                  </Text>
                  <Text style={styles.discoverTrustedEntryDate}>
                    {discoverAllowlistText.createdAt}: {formatDiscoverTrustedCreatedAt(entry.createdAt)}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.discoverTrustedEmptyText}>{discoverAllowlistText.empty}</Text>
            )}
          </View>

          <Text style={styles.settingSectionTitle}>{discoverAllowlistText.builtInSection}</Text>
          <View style={styles.discoverTrustedBuiltinCard}>
            {TRUSTED_DISCOVER_DAPP_HOSTS.map((host) => (
              <Text key={`builtin-${host}`} style={styles.discoverTrustedBuiltinItem}>
                • {host}
              </Text>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderNotificationSettings = () => (
    <View style={styles.screen}>
      {renderSubHeader(text.notifications)}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
        {[
          [text.allowPush, allowPush, setAllowPush],
          [text.sendReceiveNoti, sendReceiveNoti, setSendReceiveNoti],
          [text.announcements, announcements, setAnnouncements]
        ].map(([label, value, setter]) => (
          <View key={String(label)} style={styles.toggleRow}>
            <Text style={styles.settingLabel}>{label as string}</Text>
            <AssetSwitchToggle
              enabled={value as boolean}
              onToggle={() => (setter as (v: boolean) => void)(!(value as boolean))}
              styles={styles}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );

  const renderWalletSettingsAuth = () => (
    <View style={styles.screen}>
      {renderSubHeader(settingsAuthTarget === 'security' ? text.security : settingsAuthTarget === 'addressBook' ? extra.addressBookManage : text.wallets)}
      <View style={styles.formWrap}>
        {renderPasscodePad({
          value: walletSettingsAuthInput,
          setValue: setWalletSettingsAuthInput,
          error: walletSettingsAuthError,
          onClearError: () => setWalletSettingsAuthError(''),
          onSubmit: () => confirmWalletSettingsAuth(),
          onComplete: (value) => confirmWalletSettingsAuth(value),
          submitLabel: flow.confirm,
          showErrorText: false,
          showSubmitButton: false,
          biometricEnabled: biometric && sendAuthMethod !== 'password',
          onBiometricPress: () => {
            void confirmWalletSettingsWithBiometric();
          }
        })}
      </View>
    </View>
  );

  const renderWalletSettings = () => (
    <View style={styles.screen}>
      {renderSubHeader(text.wallets)}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
        <Text style={styles.settingSectionTitle}>{walletUi.walletList}</Text>
        {walletAccounts.map((wallet) => {
          const active = wallet.id === walletId;
          return (
            <View key={wallet.id} style={[styles.settingRow, active ? styles.settingRowActive : undefined]}>
              <Pressable style={styles.walletSelectArea} onPress={() => setWalletId(wallet.id)}>
                <Text style={styles.settingLabel}>{getWalletDisplayName(wallet)}</Text>
              </Pressable>
              <View style={styles.rowActions}>
                {active ? <ThemedIonicons name="checkmark-circle" size={20} color={palette.accent} /> : null}
                <Pressable
                  style={[styles.rowActionBtn, styles.walletDeleteBtn]}
                  onPress={() => startWalletDeleteFlow(wallet.id)}
                  disabled={walletAccounts.length <= 1}
                >
                  <ThemedIonicons
                    name="trash-outline"
                    size={16}
                    color={walletAccounts.length <= 1 ? palette.muted : palette.negative}
                  />
                </Pressable>
              </View>
            </View>
          );
        })}

        <Pressable
          style={styles.primaryBtn}
          onPress={() => {
            startCreateWalletFlow();
          }}
        >
          <Text style={styles.primaryBtnText}>{walletUi.addWallet}</Text>
        </Pressable>
        <Pressable
          style={[styles.secondaryBtn, styles.walletRecoveryAddBtn]}
          onPress={() => {
            startAddExistingWalletFlow();
          }}
        >
          <Text style={[styles.secondaryBtnText, styles.walletRecoveryAddBtnText]}>{walletUi.addWalletFromRecovery}</Text>
        </Pressable>

      </ScrollView>
    </View>
  );

  const renderWalletDeleteCheck = () => (
    <View style={styles.screen}>
      {renderSubHeader(walletUi.deleteWalletTitle)}
      <View style={styles.formWrap}>
        {deleteTargetWallet ? (
          <View style={styles.walletDeleteTargetCard}>
            <Text style={styles.walletDeleteTargetLabel}>{walletUi.deleteTarget}</Text>
            <Text style={styles.walletDeleteTargetName}>{getWalletDisplayName(deleteTargetWallet)}</Text>
          </View>
        ) : null}
        <View style={styles.walletDeleteWarningCard}>
          <ThemedIonicons name="warning-outline" size={16} color={palette.accent} />
          <Text style={styles.walletDeleteWarningText}>{walletUi.deleteWalletWarning}</Text>
        </View>
        <View style={styles.onboardingChecklist}>
          {[
            [walletUi.deleteWalletAgreeBackup, deleteAgreeBackup, () => setDeleteAgreeBackup((prev) => !prev)],
            [walletUi.deleteWalletAgreeNoRecovery, deleteAgreeNoRecovery, () => setDeleteAgreeNoRecovery((prev) => !prev)],
            [walletUi.deleteWalletAgreeFinal, deleteAgreeFinal, () => setDeleteAgreeFinal((prev) => !prev)]
          ].map(([label, checked, onToggle], idx) => (
            <Pressable
              key={`wallet-delete-check-${idx}`}
              style={[styles.onboardingChecklistRow, checked ? styles.onboardingChecklistRowActive : undefined]}
              onPress={onToggle as () => void}
            >
              <View style={[styles.onboardingChecklistBadge, checked ? styles.onboardingChecklistBadgeActive : undefined]}>
                <ThemedIonicons name={checked ? 'checkmark' : 'add'} size={12} color={checked ? '#16110a' : palette.muted} />
              </View>
              <Text style={[styles.onboardingChecklistText, checked ? styles.onboardingChecklistTextActive : undefined]}>{label as string}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          style={[styles.primaryBtn, !(deleteAgreeBackup && deleteAgreeNoRecovery && deleteAgreeFinal) ? styles.btnDisabled : undefined]}
          disabled={!(deleteAgreeBackup && deleteAgreeNoRecovery && deleteAgreeFinal)}
          onPress={() => {
            if (hasDeleteSeedVerification) {
              navigate('walletDeletePhrase');
              return;
            }
            setDeleteAuthErrorMessage('');
            setDeleteAuthPasswordInput('');
            navigate('walletDeleteAuth');
          }}
        >
          <Text style={styles.primaryBtnText}>{text.continue}</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderWalletDeletePhrase = () => (
    <View style={styles.screen}>
      {renderSubHeader(walletUi.deleteWalletSeedTitle)}
      <View style={styles.formWrap}>
        {deleteTargetWallet ? (
          <View style={styles.walletDeleteTargetCardCompact}>
            <Text style={styles.walletDeleteTargetName}>{getWalletDisplayName(deleteTargetWallet)}</Text>
          </View>
        ) : null}
        <Text style={styles.seedPreviewGuide}>{walletUi.deleteWalletSeedBody}</Text>
        <View style={styles.seedGrid}>
          {Array.from({ length: deleteSeedWords.length }).map((_, index) => (
            <View key={`delete-seed-${index + 1}`} style={styles.seedCell}>
              <Text style={styles.seedCellIndex}>{index + 1}</Text>
              <TextInput
                value={deleteSeedWords[index]}
                onChangeText={(value) => updateDeleteSeedWordAt(index, value)}
                style={[
                  styles.seedCellInput,
                  deleteSeedWords[index].trim() ? styles.seedCellInputFilled : undefined,
                  seedInputWebStyle
                ]}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          ))}
        </View>
        {deleteSeedTouched && isDeleteSeedWordsComplete && !doesDeleteSeedMatch ? (
          <Text style={styles.fieldErrorText}>{walletUi.deleteWalletSeedMismatch}</Text>
        ) : null}
        <Pressable
          style={[styles.primaryBtn, !isDeleteSeedWordsComplete ? styles.btnDisabled : undefined]}
          disabled={!isDeleteSeedWordsComplete}
          onPress={continueWalletDeleteSeedStep}
        >
          <Text style={styles.primaryBtnText}>{text.continue}</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderWalletDeleteAuth = () => {
    const authTitle = sendAuthMethod === 'password' ? flow.passwordLabel : sendAuthMethod === 'fingerprint' ? flow.fingerprintTitle : flow.faceTitle;
    const authIcon: keyof typeof Ionicons.glyphMap = sendAuthMethod === 'fingerprint' ? 'shield-checkmark-outline' : 'scan-outline';
    return (
      <View style={styles.screen}>
        {renderSubHeader(walletUi.deleteWalletTitle)}
        <View style={styles.formWrap}>
          {deleteTargetWallet ? (
            <View style={styles.walletDeleteTargetCardCompact}>
              <Text style={styles.walletDeleteTargetName}>{getWalletDisplayName(deleteTargetWallet)}</Text>
            </View>
          ) : null}
          {sendAuthMethod !== 'password' ? (
            <>
              <Text style={styles.fieldLabel}>{flow.authMethod}</Text>
              <Text style={styles.authMethodText}>
                {sendAuthMethod === 'fingerprint' ? flow.fingerprintMode : flow.faceMode}
              </Text>
            </>
          ) : null}
          {sendAuthMethod === 'password' ? (
            <View>
              {renderPasscodePad({
                value: deleteAuthPasswordInput,
                setValue: setDeleteAuthPasswordInput,
                error: deleteAuthErrorMessage,
                onClearError: () => setDeleteAuthErrorMessage(''),
                onSubmit: () => void confirmWalletDeleteWithAuth(),
                onComplete: (value) => {
                  void confirmWalletDeleteWithAuth(value);
                },
                submitLabel: walletUi.deleteWalletConfirm,
                showErrorText: false,
                showSubmitButton: false
              })}
            </View>
          ) : (
            <View style={styles.authCard}>
              <ThemedIonicons name={authIcon} size={44} color={palette.accent} />
              <Text style={styles.authCardTitle}>{authTitle}</Text>
              <Text style={styles.authHintText}>{walletUi.deleteWalletAuthHint}</Text>
            </View>
          )}
          {sendAuthMethod !== 'password' ? (
            <Pressable style={[styles.primaryBtn, styles.walletDeleteConfirmBtn]} onPress={() => void confirmWalletDeleteWithAuth()}>
              <Text style={styles.primaryBtnText}>{walletUi.deleteWalletConfirm}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  const renderSimpleInfoScreen = (title: string, body: string, footer?: string) => (
    <View style={styles.screen}>
      {renderSubHeader(title)}
      <View style={styles.singleWrap}>
        <View style={styles.infoCard}>
          <Text style={styles.infoBody}>{body}</Text>
          {footer ? <Text style={styles.infoSubBody}>{footer}</Text> : null}
        </View>
      </View>
    </View>
  );

  const renderSupportChat = () => {
    const supportCanSend = Boolean(supportComposerText.trim() || supportComposerImageUri);
    return (
      <View style={styles.screen}>
        {renderSubHeader(text.support)}
        <KeyboardAvoidingView
          style={[styles.supportChatWrap, { paddingBottom: supportComposerBottomPad }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
          enabled
        >
          <ScrollView
            ref={(ref) => {
              supportChatScrollRef.current = ref;
            }}
            style={styles.scroll}
            contentContainerStyle={styles.supportChatListPad}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => supportChatScrollRef.current?.scrollToEnd({ animated: true })}
          >
            {supportMessages.map((message) => {
              const isUser = message.role === 'user';
              return (
                <View key={message.id} style={[styles.supportBubbleRow, isUser ? styles.supportBubbleRowUser : undefined]}>
                  <View style={[styles.supportBubble, isUser ? styles.supportBubbleUser : styles.supportBubbleAgent]}>
                    {message.imageUri ? <Image source={{ uri: message.imageUri }} style={styles.supportBubbleImage} resizeMode="cover" /> : null}
                    {message.text ? (
                      <Text style={isUser ? styles.supportBubbleTextUser : styles.supportBubbleTextAgent}>{message.text}</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </ScrollView>
          {supportComposerImageUri ? (
            <View style={styles.supportComposerPreviewRow}>
              <Image source={{ uri: supportComposerImageUri }} style={styles.supportComposerPreviewImage} resizeMode="cover" />
              <Pressable style={styles.supportComposerPreviewRemove} onPress={() => setSupportComposerImageUri(null)}>
                <ThemedIonicons name="close" size={12} color={palette.text} />
              </Pressable>
            </View>
          ) : null}
          <View style={styles.supportComposerRow}>
            <Pressable style={styles.supportComposerIconBtn} onPress={() => void pickSupportChatImage()}>
              <ThemedIonicons name="add" size={20} color={palette.text} />
            </Pressable>
            <TextInput
              value={supportComposerText}
              onChangeText={setSupportComposerText}
              placeholder={text.supportChatInputPlaceholder}
              placeholderTextColor={palette.muted}
              style={styles.supportComposerInput}
              maxLength={500}
            />
            <Pressable
              style={[styles.supportComposerSendBtn, !supportCanSend ? styles.supportComposerSendBtnDisabled : undefined]}
              onPress={sendSupportChatMessage}
              disabled={!supportCanSend}
            >
              <Text style={[styles.supportComposerSendText, !supportCanSend ? styles.supportComposerSendTextDisabled : undefined]}>
                {text.supportChatSend}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  };

  const renderManageAssets = () => (
    <View style={styles.screen}>
      {renderSubHeader(text.manageAssets)}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
        <View style={styles.historyFilterSection}>
          <Text style={styles.historyFilterTitle}>{text.historyFilterChain}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Pressable
              style={[styles.historyFilterChip, manageChainFilter === 'ALL' ? styles.historyFilterChipActive : undefined]}
              onPress={() => setManageChainFilter('ALL')}
            >
              <Text style={manageChainFilter === 'ALL' ? styles.historyFilterChipTextActive : styles.historyFilterChipText}>
                {text.historyFilterAll}
              </Text>
            </Pressable>
            {manageChainOptions.map((chain) =>
              renderIconChip(
                `manage-chain-${chain}`,
                chainIconMap[chain],
                chainTickerMap[chain],
                manageChainFilter === chain,
                () => setManageChainFilter(chain),
                { showTicker: false, compact: true }
              )
            )}
          </ScrollView>
        </View>

        <View style={styles.historyFilterSection}>
          <Text style={styles.historyFilterTitle}>{text.historyFilterAsset}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyAssetRow}>
            <Pressable
              style={[styles.historyFilterChip, manageAssetFilter === 'ALL' ? styles.historyFilterChipActive : undefined]}
              onPress={() => setManageAssetFilter('ALL')}
            >
              <Text style={manageAssetFilter === 'ALL' ? styles.historyFilterChipTextActive : styles.historyFilterChipText}>
                {text.historyFilterAll}
              </Text>
            </Pressable>
            {manageChainFilter === 'ALL'
              ? (
                  <Text style={styles.historyFilterHintInline} numberOfLines={1}>
                    {text.historyFilterAssetHint}
                  </Text>
                )
              : manageAssetOptions.map((asset) =>
                  renderIconChip(
                    `manage-asset-${asset}`,
                    coinIconMap[asset],
                    asset,
                    manageAssetFilter === asset,
                    () => setManageAssetFilter(asset),
                    { showTicker: false, compact: true }
                  )
                )}
          </ScrollView>
        </View>

        {filteredManageTokens.map((token) => {
          const enabled = tokens.some((item) => item.id === token.id);
          const isFavorite = favoriteTokenIdSet.has(token.id);
          return (
            <View key={token.id} style={styles.manageRow}>
              {renderTokenCircle(token, { size: 38 })}
              <View style={styles.manageMeta}>
                <Text style={styles.manageSymbol}>
                  {token.symbol} {token.assetKey === 'USDT' ? `(${token.network.replace(/^.*\((.*)\).*$/, '$1')})` : ''}
                </Text>
                <Text style={styles.manageName}>
                  {token.name} · {token.chainLabel}
                </Text>
              </View>
              <Pressable style={styles.manageFavoriteBtn} onPress={() => toggleFavoriteAsset(token.id)}>
                <MaterialIcons name={isFavorite ? 'star' : 'star-border'} size={15} color={palette.accent} />
              </Pressable>
              <AssetSwitchToggle enabled={enabled} onToggle={() => toggleAsset(token.id)} styles={styles} />
            </View>
          );
        })}
        {!filteredManageTokens.length ? (
          <Text style={styles.emptyInline}>{manageChainFilter === 'ALL' ? text.historyFilterAssetHint : text.historyNoResult}</Text>
        ) : null}
      </ScrollView>
    </View>
  );

  const renderIconChip = (
    keyId: string,
    icon: ImageSourcePropType,
    ticker: string,
    active: boolean,
    onPress: () => void,
    options?: { showTicker?: boolean; compact?: boolean }
  ) => (
    <Pressable
      key={keyId}
      style={[
        styles.iconOptionChip,
        options?.compact ? styles.iconOptionChipCompact : undefined,
        active ? styles.iconOptionChipActive : undefined
      ]}
      onPress={onPress}
    >
      <Image source={icon} style={[styles.iconOptionImage, options?.compact ? styles.iconOptionImageCompact : undefined]} />
      {(options?.showTicker ?? true) ? <Text style={active ? styles.iconOptionTickerActive : styles.iconOptionTicker}>{ticker}</Text> : null}
    </Pressable>
  );

  const renderSend = () => {
    const typedAmount = parseAmount();
    const activeSendToken = selectedSendToken;
    const amountUsd =
      Number.isFinite(typedAmount) && typedAmount > 0 && activeSendToken ? typedAmount * activeSendToken.priceUsd : 0;
    const amountUsdLabel = `≈ ${formatCurrency(amountUsd, text.locale)}`;
    const sendFeeNative = activeSendToken ? estimateRuntimeNativeFee(activeSendToken.chainCode, sendGasSettings) : 0;
    const sendFeeUsd = activeSendToken ? calculateFeeUsd(activeSendToken.chainCode, sendFeeNative) : 0;
    const sendAvailableBalanceText =
      isSendSelectionComplete && activeSendToken
        ? `${text.availableBalance}: ${formatAmount(activeSendToken.balance, text.locale, 6)} ${activeSendToken.symbol} (≈ ${formatCurrency(
            activeSendToken.balance * activeSendToken.priceUsd,
            text.locale
          )})`
        : ' ';

    const canOpenRecentSendDropdown = recentSendTargets.length > 0;
    const isAssetScanModalOpen = showScanMethodModal && scanEntryPoint === 'send';
    const isAssetBookModalOpen = showRecipientBookModal && recipientBookScope === 'asset';
    const isAssetSaveModalOpen = showSaveRecipientModal && saveRecipientScope === 'asset';
    const activeAssetRecipientAction: 'scan' | 'book' | 'save' | null = isAssetScanModalOpen
      ? 'scan'
      : isAssetBookModalOpen
        ? 'book'
        : isAssetSaveModalOpen
          ? 'save'
          : null;
    const isAssetRecipientActionOpen = activeAssetRecipientAction !== null;

		    return (
		      <View style={styles.screen}>
		        {renderSubHeader(text.send)}
          {isAssetRecipientActionOpen ? (
            <Pressable
              style={styles.walletMenuScrim}
              onPress={() => {
                setShowScanMethodModal(false);
                setShowRecipientBookModal(false);
                setShowSaveRecipientModal(false);
              }}
            />
          ) : null}
          {renderRecipientActionTriggerOverlay('asset', activeAssetRecipientAction)}
          <View style={styles.sendScreenBody}>
	        <ScrollView
	            style={styles.scroll}
	            contentContainerStyle={styles.scrollPad}
	            showsVerticalScrollIndicator={false}
		            scrollEnabled={
                  !(
                    showRecentSendDropdown ||
                    isAssetScanModalOpen ||
                    isAssetBookModalOpen ||
                    isAssetSaveModalOpen
                  )
                }
	            scrollEventThrottle={16}
	            onScroll={(event) => {
                if (showRecentSendDropdown) {
                  measureRecentAnchor('asset');
                }
              }}
	            onScrollBeginDrag={() => setShowRecentSendDropdown(false)}
	          >
          <View style={styles.sendScrollContentWrap}>
	          <View style={styles.historyFilterSection}>
	            <Text style={styles.historyFilterTitle}>{text.historyFilterType}</Text>
	            <View style={[styles.historyDateRow, styles.historyScopeRow]}>
                <Pressable style={[styles.historyDateChip, styles.historyScopeChip, styles.historyDateChipActive]} onPress={() => {}}>
                  <Text style={styles.historyDateChipTextActive}>{text.historyTypeAsset}</Text>
                </Pressable>
                <Pressable
                  style={[styles.historyDateChip, styles.historyScopeChip]}
                  onPress={() => {
                    openNftSendScreen(undefined, { replaceTop: true });
                  }}
                >
                  <Text style={styles.historyDateChipText}>{text.historyTypeNft}</Text>
                </Pressable>
	            </View>
	          </View>

	          <View style={styles.historyFilterSection}>
	            <Text style={styles.historyFilterTitle}>{text.selectChain}</Text>
	            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyAssetRow}>
                <Pressable
                  style={[styles.historyFilterChip, sendChainFilter === 'ALL' ? styles.historyFilterChipActive : undefined]}
                  onPress={() => {
                    setSendChainFilter('ALL');
                    setSendAssetFilterTokenId('ALL');
                  }}
                >
                  <Text style={sendChainFilter === 'ALL' ? styles.historyFilterChipTextActive : styles.historyFilterChipText}>
                    {text.historyFilterAll}
                  </Text>
                </Pressable>
		              {filterChainCodes.map((chain) =>
		                renderIconChip(
	                  `send-chain-${chain}`,
	                  chainIconMap[chain],
	                  chainTickerMap[chain],
	                  sendChainFilter === chain,
	                  () => {
                      setSendChainFilter(chain);
	                    setSendChainCode(chain);
                      setSendAssetFilterTokenId('ALL');
		                    const next = allFilterTokens.find((token) => token.chainCode === chain);
		                    if (next) setSendTokenId(next.id);
	                  },
	                  { showTicker: false, compact: true }
	                )
	              )}
	            </ScrollView>
	          </View>

	          <View style={styles.historyFilterSection}>
	            <Text style={styles.historyFilterTitle}>{text.selectAsset}</Text>
	            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyAssetRow}>
                <Pressable
                  style={[styles.historyFilterChip, sendAssetFilterTokenId === 'ALL' ? styles.historyFilterChipActive : undefined]}
                  onPress={() => setSendAssetFilterTokenId('ALL')}
                >
                  <Text style={sendAssetFilterTokenId === 'ALL' ? styles.historyFilterChipTextActive : styles.historyFilterChipText}>
                    {text.historyFilterAll}
                  </Text>
                </Pressable>
                {sendChainFilter === 'ALL'
                  ? (
                      <Text style={styles.historyFilterHintInline} numberOfLines={1}>
                        {text.historyFilterAssetHint}
                      </Text>
                    )
                  : sendAssetOptions.map((token) =>
                      renderIconChip(
                        `send-asset-${token.id}`,
                        token.iconSource ?? coinIconMap[token.assetKey],
                        token.symbol,
                        sendAssetFilterTokenId === token.id,
                        () => {
                          setSendAssetFilterTokenId(token.id);
                          setSendTokenId(token.id);
                        },
                        { showTicker: false, compact: true }
                      )
                    )}
	            </ScrollView>
	          </View>

		          <View
                style={styles.sendFieldBlock}
              >
          <View style={styles.fieldHeaderRow}>
		            <Text style={[styles.fieldLabel, styles.fieldLabelTight]}>{text.recipient}</Text>
              <View style={styles.fieldHeaderActions}>
                <Pressable
                  ref={assetSaveActionRef}
                  style={[
                    styles.saveAddressIconBtn,
                    styles.fieldHeaderActionStart,
                    activeAssetRecipientAction === 'save' ? styles.iconCircleBtnActive : undefined,
                    activeAssetRecipientAction === 'save' ? styles.scanTriggerBtnOpen : undefined,
                    isAssetRecipientActionOpen && activeAssetRecipientAction !== 'save' ? styles.scanNonTriggerDimmed : undefined
                  ]}
                  onLayout={() => measureRecipientActionAnchor('asset', 'save')}
                  disabled={isAssetRecipientActionOpen && activeAssetRecipientAction !== 'save'}
                  onPress={() => {
                    if (isAssetSaveModalOpen) {
                      setShowSaveRecipientModal(false);
                      return;
                    }
                    if (!ensureSendSelectionOrToast()) return;
                    measureRecipientActionAnchor('asset', 'save');
                    saveCurrentRecipientToBook();
                  }}
                >
                  <ThemedIonicons
                    name="bookmark-outline"
                    size={16}
                    color={showSaveRecipientModal && saveRecipientScope === 'asset' ? '#16110a' : palette.text}
                  />
                </Pressable>
                <Pressable
                  ref={assetBookActionRef}
                  style={[
                    styles.saveAddressIconBtn,
                    styles.fieldHeaderActionGap,
                    activeAssetRecipientAction === 'book' ? styles.iconCircleBtnActive : undefined,
                    activeAssetRecipientAction === 'book' ? styles.scanTriggerBtnOpen : undefined,
                    isAssetRecipientActionOpen && activeAssetRecipientAction !== 'book' ? styles.scanNonTriggerDimmed : undefined
                  ]}
                  onLayout={() => measureRecipientActionAnchor('asset', 'book')}
                  disabled={isAssetRecipientActionOpen && activeAssetRecipientAction !== 'book'}
                  onPress={() => {
                    if (isAssetBookModalOpen) {
                      setShowRecipientBookModal(false);
                      return;
                    }
                    measureRecipientActionAnchor('asset', 'book');
                    openRecipientBookModal();
                  }}
                >
                  <ThemedIonicons
                    name="book-outline"
                    size={16}
                    color={showRecipientBookModal && recipientBookScope === 'asset' ? '#16110a' : palette.text}
                  />
                </Pressable>
              </View>
          </View>
          <View style={styles.fieldOverlayHost}>
            <View
              style={[
                styles.recipientInputRow,
                recipientFocused ? styles.fieldBoxFocus : undefined,
                recipientError && !recipientFocused ? styles.fieldBoxError : undefined
              ]}
            >
		              <TextInput
		                value={recipientInput}
		                onChangeText={handleSendRecipientInputChange}
		                placeholder={text.recipientPlaceholder}
		                placeholderTextColor={palette.muted}
		                style={styles.recipientInputField}
	                  editable
		                autoCapitalize="none"
		                selectionColor={palette.accent}
		                onFocus={() => setRecipientFocused(true)}
		                onBlur={() => {
		                  setRecipientFocused(false);
		                  setRecipientTouched(true);
		                }}
		              />
	              <View style={styles.recipientActions}>
                <Pressable
                    style={[styles.recipientActionBtn, isAssetRecipientActionOpen ? styles.scanNonTriggerDimmed : undefined]}
                    onPress={() => {
                      pasteRecipientFromClipboard();
                    }}
                  disabled={isAssetRecipientActionOpen}
                  >
		                  <ThemedIonicons name="clipboard-outline" size={16} color={palette.text} />
		                </Pressable>
                <Pressable
                    ref={assetScanActionRef}
                    style={[
                      styles.recipientActionBtn,
                      activeAssetRecipientAction === 'scan' ? styles.iconCircleBtnActive : undefined,
                      activeAssetRecipientAction === 'scan' ? styles.scanTriggerBtnOpen : undefined,
                      isAssetRecipientActionOpen && activeAssetRecipientAction !== 'scan' ? styles.scanNonTriggerDimmed : undefined
                    ]}
                    onLayout={() => measureRecipientActionAnchor('asset', 'scan')}
                    disabled={isAssetRecipientActionOpen && activeAssetRecipientAction !== 'scan'}
                    onPress={() => {
                      if (isAssetScanModalOpen) {
                        setShowScanMethodModal(false);
                        return;
                      }
                      measureRecipientActionAnchor('asset', 'scan');
                      openScanMethodPicker('send');
                    }}
                  >
		                  <ThemedIonicons
                      name="scan-outline"
                      size={16}
                      color={activeAssetRecipientAction === 'scan' ? '#16110a' : palette.text}
                    />
		                </Pressable>
		              </View>
            </View>
          </View>
          <View style={[styles.fieldErrorSlot, styles.sendFieldErrorSlot]}>
            <Text numberOfLines={1} style={[styles.fieldErrorText, !recipientError ? styles.fieldErrorTextHidden : undefined]}>
              {recipientError ?? ' '}
            </Text>
          </View>
        </View>

        <View style={[styles.sendFieldBlock, showRecentSendDropdown ? styles.sendRecentFieldBlockOpen : undefined]}>
          <Text style={styles.fieldLabel}>{text.recentSends}</Text>
          <View
            ref={sendRecentAnchorRef}
            style={[styles.sendRecentAnchor, showRecentSendDropdown ? styles.sendRecentAnchorOpen : undefined]}
            onLayout={() => {
              measureRecentAnchor('asset');
            }}
          >
            <Pressable
              style={[styles.recentSummaryBtn, styles.sendRecentSummaryBtn, showRecentSendDropdown ? styles.recentSummaryBtnActive : undefined]}
              disabled={isAssetRecipientActionOpen}
              onPress={() => {
                if (!recentSendTargets.length) {
                  setBannerMessage(text.noRecentSends);
                  return;
                }
                setShowRecentSendDropdown((prev) => {
                  if (prev) {
                    return false;
                  }
                  measureRecentAnchor('asset');
                  return true;
                });
              }}
            >
	              <View style={styles.recentSummaryMeta}>
	                <Text style={[styles.recipientPrimary, showRecentSendDropdown ? styles.recentSummaryPrimaryActive : undefined]} numberOfLines={1}>
	                  {latestRecentSend ? shortAddressCenter(latestRecentSend.address, 8, 6) : '-'}
	                </Text>
	                <Text style={[styles.recipientSecondary, showRecentSendDropdown ? styles.recentSummarySecondaryActive : undefined]} numberOfLines={1}>
	                  {latestRecentSend ? `${formatAmount(latestRecentSend.amount, text.locale)} ${latestRecentSend.symbol}` : ' '}
	                  {latestRecentSend?.label ? (
                      <Text
                        style={[
                          styles.recipientSecondaryAccent,
                          showRecentSendDropdown ? styles.recentSummarySecondaryAccentActive : undefined
                        ]}
                      >
                        {' '}
                        / {latestRecentSend.label}
                      </Text>
                    ) : null}
	                  {latestRecentSend ? ` / ${latestRecentSend.memo ?? '-'} / ${latestRecentSend.date}` : ''}
	                </Text>
	              </View>
	              <ThemedIonicons
	                name={showRecentSendDropdown ? 'chevron-up' : 'chevron-down'}
	                size={16}
	                color={showRecentSendDropdown ? '#16110a' : canOpenRecentSendDropdown ? palette.text : palette.muted}
	              />
	            </Pressable>

          </View>
        </View>

          <View style={styles.sendFieldBlock}>
            <View style={styles.amountHeaderRow}>
              <Text style={[styles.fieldLabel, styles.fieldLabelTight]}>{text.amount}</Text>
              <Text style={styles.amountAvailableHint} numberOfLines={1}>
                {sendAvailableBalanceText}
              </Text>
            </View>
            <View style={styles.fieldOverlayHost}>
              <View style={[styles.amountRow, styles.sendAmountRow]}>
                <TextInput
                  value={amountInput}
                  onChangeText={setAmountInput}
                  placeholder="0.0"
                  keyboardType="decimal-pad"
                  placeholderTextColor={palette.muted}
                  style={[
                    styles.fieldInput,
                    styles.amountInput,
                    amountFocused ? styles.fieldInputFocus : undefined,
                    amountError && !amountFocused ? styles.fieldInputError : undefined
                  ]}
                  editable={isSendSelectionComplete}
                  selectionColor={palette.accent}
                  onPressIn={() => {
                    if (!isSendSelectionComplete) setBannerMessage(text.selectChainAssetFirst);
                  }}
                  onFocus={() => setAmountFocused(true)}
                  onBlur={() => {
                    setAmountFocused(false);
                    setAmountTouched(true);
                  }}
                />
                <Text style={styles.amountUsdInline} numberOfLines={1}>
                  {amountUsdLabel}
                </Text>
                <Pressable
                  style={styles.maxBtn}
                  onPress={() => {
                    if (!ensureSendSelectionOrToast()) return;
                    setAmountInput(sendToken ? String(sendToken.balance) : '0');
                  }}
                >
                  <Text style={styles.maxBtnText}>{text.max}</Text>
                </Pressable>
              </View>
              {!isSendSelectionComplete ? (
                <Pressable style={styles.fieldDisabledOverlay} onPress={() => setBannerMessage(text.selectChainAssetFirst)} />
              ) : null}
            </View>
            <View style={[styles.fieldErrorSlot, styles.sendFieldErrorSlot]}>
              <Text numberOfLines={1} style={[styles.fieldErrorText, !amountError ? styles.fieldErrorTextHidden : undefined]}>
                {amountError ?? ' '}
              </Text>
            </View>
          </View>

        <View style={styles.sendFieldBlock}>
          <Text style={styles.fieldLabel}>{extra.memoOptional}</Text>
          <View style={styles.fieldOverlayHost}>
            <TextInput
              value={sendMemoInput}
              onChangeText={setSendMemoInput}
              placeholder={text.memoPlaceholder}
              placeholderTextColor={palette.muted}
              style={[styles.fieldInput, styles.sendMemoInput, memoFocused ? styles.fieldInputFocus : undefined]}
              editable={isSendSelectionComplete}
              selectionColor={palette.accent}
              onPressIn={() => {
                if (!isSendSelectionComplete) setBannerMessage(text.selectChainAssetFirst);
              }}
              onFocus={() => setMemoFocused(true)}
              onBlur={() => setMemoFocused(false)}
            />
            {!isSendSelectionComplete ? (
              <Pressable style={styles.fieldDisabledOverlay} onPress={() => setBannerMessage(text.selectChainAssetFirst)} />
            ) : null}
          </View>
        </View>

          <Text style={styles.feeText}>
            {text.feeEstimate}:{' '}
            {activeSendToken
              ? `${formatNativeFee(sendFeeNative)} ${chainTickerMap[activeSendToken.chainCode]} = ${formatCurrency(sendFeeUsd, text.locale)}`
              : '--'}
          </Text>

	              <Pressable style={styles.primaryBtn} onPress={openSendConfirm}>
	                <Text style={styles.primaryBtnText}>{text.send}</Text>
	              </Pressable>
	            </View>
		        </ScrollView>
	          </View>
	      </View>
	    );
  };

  const renderNftSend = () => {
    if (!ownedCollectibles.length) {
      return (
        <View style={styles.screen}>
          {renderSubHeader(text.send)}
          <View style={styles.singleWrap}>
            <View style={styles.infoCard}>
              <Text style={styles.infoBody}>{nftUi.noNftOwned}</Text>
            </View>
          </View>
        </View>
      );
    }

    const activeNft = selectedNftForSend;
    const activeChain = activeNft ? getCollectibleChainCode(activeNft) : 'ETH';
    const chainLabel = activeNft ? activeNft.network : '';
    const canOpenNftRecentSendDropdown = recentNftSendTargets.length > 0;
    const isNftScanModalOpen = showScanMethodModal && scanEntryPoint === 'nftSend';
    const isNftBookModalOpen = showRecipientBookModal && recipientBookScope === 'nft';
    const isNftSaveModalOpen = showSaveRecipientModal && saveRecipientScope === 'nft';
    const activeNftRecipientAction: 'scan' | 'book' | 'save' | null = isNftScanModalOpen
      ? 'scan'
      : isNftBookModalOpen
        ? 'book'
        : isNftSaveModalOpen
          ? 'save'
          : null;
    const isNftRecipientActionOpen = activeNftRecipientAction !== null;
    const nftSendFeeNative = activeNft ? estimateRuntimeNativeFee(activeChain, DEFAULT_SEND_GAS_SETTINGS) : 0;
    const nftSendFeeUsd = activeNft ? calculateFeeUsd(activeChain, nftSendFeeNative) : 0;

		    return (
		      <View style={styles.screen}>
		        {renderSubHeader(text.send)}
          {isNftRecipientActionOpen ? (
            <Pressable
              style={styles.walletMenuScrim}
              onPress={() => {
                setShowScanMethodModal(false);
                setShowRecipientBookModal(false);
                setShowSaveRecipientModal(false);
              }}
            />
          ) : null}
	        {renderRecipientActionTriggerOverlay('nft', activeNftRecipientAction)}
	        <View style={styles.sendScreenBody}>
          <ScrollView
            ref={nftSendScrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.scrollPad}
            showsVerticalScrollIndicator={false}
			            scrollEnabled={
                !(
                  showNftRecentSendDropdown ||
                  isNftScanModalOpen ||
                  isNftBookModalOpen ||
                  isNftSaveModalOpen
                )
              }
            scrollEventThrottle={16}
            onScroll={(event) => {
              if (showNftRecentSendDropdown) {
                measureRecentAnchor('nft');
              }
            }}
          >
            <View style={styles.sendScrollContentWrap}>
              <View style={styles.historyFilterSection}>
                <Text style={styles.historyFilterTitle}>{text.historyFilterType}</Text>
                <View style={[styles.historyDateRow, styles.historyScopeRow]}>
                  <Pressable
                    style={[styles.historyDateChip, styles.historyScopeChip]}
                    onPress={() => {
                      replaceTopScreen('send');
                    }}
                  >
                    <Text style={styles.historyDateChipText}>{text.historyTypeAsset}</Text>
                  </Pressable>
                  <Pressable style={[styles.historyDateChip, styles.historyScopeChip, styles.historyDateChipActive]} onPress={() => {}}>
                    <Text style={styles.historyDateChipTextActive}>{text.historyTypeNft}</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.sendFieldBlock}>
                <Text style={styles.fieldLabel}>{nftUi.selectNft}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyAssetRow}>
                  {ownedCollectibles.map((item) => {
                    const active = item.id === activeNft?.id;
                    return (
                      <Pressable
                        key={`nft-send-select-${item.id}`}
                        style={[styles.nftSelectCard, active ? styles.nftSelectCardActive : undefined]}
                        onPress={() => setNftSendCollectibleId(item.id)}
                      >
                        <Image source={{ uri: item.imageUrl }} style={styles.nftSelectImage} resizeMode="cover" />
	                        <View style={styles.nftSelectMeta}>
	                          <Text style={styles.nftSelectName} numberOfLines={1}>
	                            {item.name}
	                          </Text>
	                          <Text style={[styles.nftSelectName, styles.nftSelectTokenId]} numberOfLines={1}>
	                            #{item.tokenId}
	                          </Text>
	                        </View>
	                      </Pressable>
	                    );
	                  })}
                </ScrollView>
              </View>

              {activeNft ? (
                <View style={styles.nftSendPreviewCard}>
                  <Image source={{ uri: activeNft.imageUrl }} style={styles.nftSendPreviewImage} resizeMode="cover" />
                  <View style={styles.nftSendPreviewMeta}>
                    <Text style={styles.nftSendPreviewTitle} numberOfLines={1}>
                      {activeNft.name}
                    </Text>
                    <Text style={styles.nftSendPreviewSub} numberOfLines={1}>
                      {activeNft.collection} · {chainLabel}
                    </Text>
                    <Text style={styles.nftSendPreviewSub} numberOfLines={1}>
                      Token ID #{activeNft.tokenId}
                    </Text>
                  </View>
                  <Text style={styles.nftPrice}>{formatCurrency(activeNft.floorPriceUsd, text.locale)}</Text>
                </View>
              ) : null}

	              <View style={[styles.sendFieldBlock, styles.nftRecipientBlock]}>
                <View style={styles.fieldHeaderRow}>
                  <Text style={[styles.fieldLabel, styles.fieldLabelTight]}>{text.recipient}</Text>
                  <View style={styles.fieldHeaderActions}>
                    <Pressable
                      ref={nftSaveActionRef}
                      style={[
                        styles.saveAddressIconBtn,
                        styles.fieldHeaderActionStart,
                        activeNftRecipientAction === 'save' ? styles.iconCircleBtnActive : undefined,
                        activeNftRecipientAction === 'save' ? styles.scanTriggerBtnOpen : undefined,
                        isNftRecipientActionOpen && activeNftRecipientAction !== 'save' ? styles.scanNonTriggerDimmed : undefined
                      ]}
                      onLayout={() => measureRecipientActionAnchor('nft', 'save')}
                      disabled={isNftRecipientActionOpen && activeNftRecipientAction !== 'save'}
                      onPress={() => {
                        if (isNftSaveModalOpen) {
                          setShowSaveRecipientModal(false);
                          return;
                        }
                        if (!selectedNftForSend) {
                          setBannerMessage(nftUi.noNftOwned);
                          return;
                        }
                        measureRecipientActionAnchor('nft', 'save');
                        saveCurrentRecipientToBook('nft');
                      }}
                    >
                      <ThemedIonicons
                        name="bookmark-outline"
                        size={16}
                        color={showSaveRecipientModal && saveRecipientScope === 'nft' ? '#16110a' : palette.text}
                      />
                    </Pressable>
                    <Pressable
                      ref={nftBookActionRef}
                      style={[
                        styles.saveAddressIconBtn,
                        styles.fieldHeaderActionGap,
                        activeNftRecipientAction === 'book' ? styles.iconCircleBtnActive : undefined,
                        activeNftRecipientAction === 'book' ? styles.scanTriggerBtnOpen : undefined,
                        isNftRecipientActionOpen && activeNftRecipientAction !== 'book' ? styles.scanNonTriggerDimmed : undefined
                      ]}
                      onLayout={() => measureRecipientActionAnchor('nft', 'book')}
                      disabled={isNftRecipientActionOpen && activeNftRecipientAction !== 'book'}
                      onPress={() => {
                        if (isNftBookModalOpen) {
                          setShowRecipientBookModal(false);
                          return;
                        }
                        measureRecipientActionAnchor('nft', 'book');
                        openRecipientBookModal('nft');
                      }}
                    >
                      <ThemedIonicons
                        name="book-outline"
                        size={16}
                        color={showRecipientBookModal && recipientBookScope === 'nft' ? '#16110a' : palette.text}
                      />
                    </Pressable>
                  </View>
                </View>
                <View style={[styles.fieldOverlayHost, styles.nftRecipientFieldGap]}>
                  <View
                    style={[
                      styles.recipientInputRow,
                      nftSendRecipientFocused ? styles.fieldBoxFocus : undefined,
                      nftRecipientError && !nftSendRecipientFocused ? styles.fieldBoxError : undefined
                    ]}
                  >
                    <TextInput
                      value={nftSendRecipientInput}
                      onChangeText={setNftSendRecipientInput}
                      placeholder={nftUi.recipientPlaceholder}
                      placeholderTextColor={palette.muted}
                      style={styles.recipientInputField}
                      autoCapitalize="none"
                      selectionColor={palette.accent}
                      onFocus={() => setNftSendRecipientFocused(true)}
                      onBlur={() => {
                        setNftSendRecipientFocused(false);
                        setNftSendRecipientTouched(true);
                      }}
                    />
                    <View style={styles.recipientActions}>
	                      <Pressable
                        style={[styles.recipientActionBtn, isNftRecipientActionOpen ? styles.scanNonTriggerDimmed : undefined]}
                        onPress={() => void pasteNftRecipientFromClipboard()}
                        disabled={isNftRecipientActionOpen}
                      >
	                        <ThemedIonicons name="clipboard-outline" size={16} color={palette.text} />
	                      </Pressable>
		                      <Pressable
                        ref={nftScanActionRef}
                        style={[
                          styles.recipientActionBtn,
                          activeNftRecipientAction === 'scan' ? styles.iconCircleBtnActive : undefined,
                          activeNftRecipientAction === 'scan' ? styles.scanTriggerBtnOpen : undefined,
                          isNftRecipientActionOpen && activeNftRecipientAction !== 'scan' ? styles.scanNonTriggerDimmed : undefined
                        ]}
                        onLayout={() => measureRecipientActionAnchor('nft', 'scan')}
                        disabled={isNftRecipientActionOpen && activeNftRecipientAction !== 'scan'}
                        onPress={() => {
                          if (isNftScanModalOpen) {
                            setShowScanMethodModal(false);
                            return;
                          }
                          measureRecipientActionAnchor('nft', 'scan');
                          openScanMethodPicker('nftSend');
                        }}
                      >
                        <ThemedIonicons
                          name="scan-outline"
                          size={16}
                          color={activeNftRecipientAction === 'scan' ? '#16110a' : palette.text}
                        />
                      </Pressable>
                    </View>
                  </View>
                </View>
                <View style={[styles.fieldErrorSlot, styles.sendFieldErrorSlot]}>
                  <Text numberOfLines={1} style={[styles.fieldErrorText, !nftRecipientError ? styles.fieldErrorTextHidden : undefined]}>
                    {nftRecipientError ?? ' '}
                  </Text>
                </View>
              </View>

              <View style={[styles.sendFieldBlock, showNftRecentSendDropdown ? styles.sendRecentFieldBlockOpen : undefined]}>
                <Text style={styles.fieldLabel}>{nftRecentSendTitle}</Text>
                <View
                  ref={nftRecentAnchorRef}
                  style={[styles.sendRecentAnchor, showNftRecentSendDropdown ? styles.sendRecentAnchorOpen : undefined]}
                  onLayout={() => {
                    measureRecentAnchor('nft');
                  }}
                >
                  <Pressable
                    style={[styles.recentSummaryBtn, styles.sendRecentSummaryBtn, showNftRecentSendDropdown ? styles.recentSummaryBtnActive : undefined]}
                    disabled={isNftRecipientActionOpen}
                    onPress={() => {
                      if (!recentNftSendTargets.length) {
                        setBannerMessage(nftRecentSendEmptyText);
                        return;
                      }
                      setShowNftRecentSendDropdown((prev) => {
                        if (prev) {
                          return false;
                        }
                        measureRecentAnchor('nft');
                        return true;
                      });
                    }}
                  >
	                    <View style={styles.recentSummaryMeta}>
	                      <Text
                          style={[styles.recipientPrimary, showNftRecentSendDropdown ? styles.recentSummaryPrimaryActive : undefined]}
                          numberOfLines={1}
                        >
	                        {latestRecentNftSend ? shortAddressCenter(latestRecentNftSend.address, 8, 6) : '-'}
	                      </Text>
	                      <Text
                          style={[styles.recipientSecondary, showNftRecentSendDropdown ? styles.recentSummarySecondaryActive : undefined]}
                          numberOfLines={1}
                        >
	                        {latestRecentNftSend ? `${latestRecentNftSend.nftTitle} #${latestRecentNftSend.tokenId}` : ' '}
	                        {latestRecentNftSend?.label ? (
	                          <Text
                              style={[
                                styles.recipientSecondaryAccent,
                                showNftRecentSendDropdown ? styles.recentSummarySecondaryAccentActive : undefined
                              ]}
                            >
                              {' '}
                              / {latestRecentNftSend.label}
                            </Text>
	                        ) : null}
	                        {latestRecentNftSend ? ` / ${latestRecentNftSend.memo ?? '-'} / ${latestRecentNftSend.date}` : ''}
	                      </Text>
	                    </View>
	                    <ThemedIonicons
	                      name={showNftRecentSendDropdown ? 'chevron-up' : 'chevron-down'}
	                      size={16}
	                      color={showNftRecentSendDropdown ? '#16110a' : canOpenNftRecentSendDropdown ? palette.text : palette.muted}
	                    />
	                  </Pressable>

                </View>
              </View>

              <View style={styles.sendFieldBlock}>
                <Text style={styles.fieldLabel}>{extra.memoOptional}</Text>
                <TextInput
                  value={nftSendMemoInput}
                  onChangeText={setNftSendMemoInput}
                  placeholder={nftUi.memoPlaceholder}
                  placeholderTextColor={palette.muted}
                  style={styles.fieldInput}
                  selectionColor={palette.accent}
                />
              </View>

              <Text style={styles.feeText}>
                {text.feeEstimate}:{' '}
                {activeNft
                  ? `${formatNativeFee(nftSendFeeNative)} ${chainTickerMap[activeChain]} = ${formatCurrency(nftSendFeeUsd, text.locale)}`
                  : '--'}
              </Text>

	              <Pressable style={styles.primaryBtn} onPress={submitNftSend}>
	                <Text style={styles.primaryBtnText}>{text.send}</Text>
	              </Pressable>
		            </View>
	          </ScrollView>
	        </View>
      </View>
    );
  };

  const renderNftDetail = () => {
    if (!nftDetailItem) {
      return (
        <View style={styles.screen}>
          {renderSubHeader(nftUi.detailTitle)}
          <View style={styles.singleWrap}>
            <View style={styles.infoCard}>
              <Text style={styles.infoBody}>{nftUi.noNftOwned}</Text>
            </View>
          </View>
        </View>
      );
    }

    const detailChain = getCollectibleChainCode(nftDetailItem);
    const nftName = nftDetailItem.name.trim();
    const nftTokenHash = `#${nftDetailItem.tokenId}`;
    const nftDetailHeaderTitle = nftName.includes(nftTokenHash) ? nftName : `${nftName} ${nftTokenHash}`;

    return (
      <View style={styles.screen}>
        {renderSubHeader(nftDetailHeaderTitle)}
        <ScrollView ref={nftDetailScrollRef} style={styles.scroll} contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
          <View style={styles.nftDetailCard}>
            <Image source={{ uri: nftDetailItem.imageUrl }} style={styles.nftDetailImage} resizeMode="cover" />
            <Text style={styles.nftDetailName}>{nftDetailItem.name}</Text>
            <Text style={styles.nftDetailCollection}>
              {nftDetailItem.collection} · {nftDetailItem.network}
            </Text>
          </View>

          <View style={styles.nftDetailInfoCard}>
            <View style={[styles.nftDetailInfoRow, styles.nftDetailInfoRowFirst]}>
              <Text style={styles.sendConfirmLabel}>{nftUi.tokenId}</Text>
              <Text style={styles.sendConfirmValue}>#{nftDetailItem.tokenId}</Text>
            </View>
            <View style={styles.nftDetailInfoRow}>
              <Text style={styles.sendConfirmLabel}>{nftUi.owned}</Text>
              <Text style={styles.sendConfirmValue}>x{nftDetailItem.owned}</Text>
            </View>
            <View style={styles.nftDetailInfoRow}>
              <Text style={styles.sendConfirmLabel}>{nftUi.floorPrice}</Text>
              <Text style={styles.sendConfirmValue}>{formatCurrency(nftDetailItem.floorPriceUsd, text.locale)}</Text>
            </View>
            <View style={styles.nftDetailInfoRow}>
              <Text style={styles.sendConfirmLabel}>{text.network}</Text>
              <Text style={styles.sendConfirmValue}>
                {nftDetailItem.network} ({chainTickerMap[detailChain]})
              </Text>
            </View>
            <View style={styles.nftDetailInfoRow}>
              <Text style={styles.sendConfirmLabel}>{nftUi.contractAddress}</Text>
              <Text style={styles.sendConfirmValue}>{shortAddressCenter(nftDetailItem.contractAddress, 10, 8)}</Text>
            </View>
          </View>

          <Pressable
            style={[styles.primaryBtn, nftDetailItem.owned < 1 ? styles.btnDisabled : undefined]}
            onPress={() => openNftSendScreen(nftDetailItem)}
            disabled={nftDetailItem.owned < 1}
          >
            <Text style={styles.primaryBtnText}>{nftUi.sendButton}</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  };

  const renderSendConfirm = () => {
    if (!sendDraft) {
      return (
        <View style={styles.screen}>
          {renderSubHeader(flow.confirm)}
          <View style={styles.singleWrap}>
            <View style={styles.infoCard}>
              <Text style={styles.infoBody}>{text.recipientRequired}</Text>
            </View>
          </View>
        </View>
      );
    }

    const isNftDraft = sendDraft.assetType === 'nft';
    const token = !isNftDraft
      ? tokens.find((item) => item.id === sendDraft.tokenId) ?? tokenCatalog.find((item) => item.id === sendDraft.tokenId) ?? sendToken
      : null;
    const nftItem = isNftDraft ? collectibles.find((item) => item.id === sendDraft.nftId) ?? null : null;
    const nftConfirmTitle =
      nftItem == null
        ? 'NFT'
        : nftItem.name.includes(`#${nftItem.tokenId}`)
          ? nftItem.name
          : `${nftItem.name} #${nftItem.tokenId}`;
    const confirmTitle = flow.confirm;
    const totalCost = sendDraft.usdValue + sendDraft.feeUsd;

    return (
      <View style={styles.screen}>
        {renderTopHeader(confirmTitle, 'chevron-back', goBack, [{ icon: 'settings-outline', action: () => navigate('sendAdvanced') }])}
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
          <View style={styles.sendConfirmAmountCard}>
            {isNftDraft ? (
              <View style={styles.sendConfirmTokenRow}>
                {nftItem ? (
                  <Image source={{ uri: nftItem.imageUrl }} style={styles.sendConfirmNftImage} resizeMode="cover" />
                ) : (
                  <View style={styles.sendConfirmNftPlaceholder}>
                    <ThemedIonicons name="image-outline" size={18} color={palette.muted} />
                  </View>
                )}
                <View style={styles.sendConfirmTokenMeta}>
                  <Text style={styles.sendConfirmUsd}>{formatCurrency(sendDraft.usdValue, text.locale)}</Text>
                  <Text style={styles.sendConfirmAmount} numberOfLines={1}>
                    {nftConfirmTitle}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.sendConfirmTokenRow}>
                {token ? renderTokenCircle(token) : null}
                <View style={styles.sendConfirmTokenMeta}>
                  <Text style={styles.sendConfirmUsd}>{formatCurrency(sendDraft.usdValue, text.locale)}</Text>
                  <Text style={styles.sendConfirmAmount}>
                    {formatAmount(sendDraft.amount, text.locale)} {sendDraft.tokenSymbol}
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.sendConfirmDetailCard}>
            <View style={styles.sendConfirmDetailRow}>
              <Text style={styles.sendConfirmLabel}>{flow.amountToSend}</Text>
              <Text style={styles.sendConfirmValue}>
                {isNftDraft ? `${nftItem?.name ?? 'NFT'} · ${sendDraft.network}` : `${sendDraft.tokenSymbol} · ${sendDraft.network}`}
              </Text>
            </View>
            <View style={styles.sendConfirmDetailRow}>
              <Text style={styles.sendConfirmLabel}>{flow.recipientWallet}</Text>
              <Text style={styles.sendConfirmValue}>{shortAddressCenter(sendDraft.recipient, 10, 8)}</Text>
            </View>
            {sendDraft.recipientLabel ? (
              <View style={styles.sendConfirmDetailRow}>
                <Text style={styles.sendConfirmLabel}>{extra.label}</Text>
                <Text style={styles.sendConfirmValue}>{sendDraft.recipientLabel}</Text>
              </View>
            ) : null}
            <View style={styles.sendConfirmDetailRow}>
              <Text style={styles.sendConfirmLabel}>{text.memo}</Text>
              <Text style={styles.sendConfirmValue}>{sendDraft.memo?.trim() || '-'}</Text>
            </View>
            <View style={styles.sendConfirmDetailRow}>
              <Text style={styles.sendConfirmLabel}>{text.network}</Text>
              <Text style={styles.sendConfirmValue}>{sendDraft.network}</Text>
            </View>
          </View>

          <View style={styles.sendConfirmDetailCard}>
            <View style={styles.sendConfirmDetailRow}>
              <Text style={styles.sendConfirmLabel}>{flow.networkFee}</Text>
              <Text style={styles.sendConfirmValue}>
                {formatCurrency(sendDraft.feeUsd, text.locale)} ({formatNativeFee(sendDraft.feeNative)} {chainTickerMap[sendDraft.chainCode]})
              </Text>
            </View>
            <View style={styles.sendConfirmDetailRow}>
              <Text style={styles.sendConfirmLabel}>{flow.nonceLabel}</Text>
              <Text style={styles.sendConfirmValue}>{sendDraft.gas.nonce}</Text>
            </View>
          </View>

          <View style={styles.sendConfirmTotalCard}>
            <Text style={styles.sendConfirmLabel}>{flow.totalCost}</Text>
            <Text style={styles.sendConfirmTotalValue}>{formatCurrency(totalCost, text.locale)}</Text>
          </View>

          <Pressable style={styles.primaryBtn} onPress={openSendAuth}>
            <Text style={styles.primaryBtnText}>{flow.confirm}</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  };

  const renderSendAdvanced = () => (
    <View style={styles.screen}>
      {renderSubHeader(flow.advancedTitle)}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
        <Text style={styles.fieldLabel}>{flow.gasPrice}</Text>
        <TextInput
          value={sendGasSettings.gasPrice}
          onChangeText={(value) => setSendGasSettings((prev) => ({ ...prev, gasPrice: value }))}
          placeholder="0.1"
          keyboardType="decimal-pad"
          placeholderTextColor={palette.muted}
          style={styles.fieldInput}
        />

        <Text style={styles.fieldLabel}>{flow.gasLimit}</Text>
        <TextInput
          value={sendGasSettings.gasLimit}
          onChangeText={(value) => setSendGasSettings((prev) => ({ ...prev, gasLimit: value }))}
          placeholder="21000"
          keyboardType="number-pad"
          placeholderTextColor={palette.muted}
          style={styles.fieldInput}
        />

        <Text style={styles.fieldLabel}>{flow.txData}</Text>
        <TextInput
          value={sendGasSettings.txData}
          onChangeText={(value) => setSendGasSettings((prev) => ({ ...prev, txData: value }))}
          placeholder="0x"
          placeholderTextColor={palette.muted}
          style={[styles.fieldInput, styles.fieldInputMultiline]}
          multiline
        />

        <Text style={styles.fieldLabel}>{flow.nonce}</Text>
        <TextInput
          value={sendGasSettings.nonce}
          onChangeText={(value) => setSendGasSettings((prev) => ({ ...prev, nonce: value }))}
          placeholder="3"
          keyboardType="number-pad"
          placeholderTextColor={palette.muted}
          style={styles.fieldInput}
        />

        <Pressable style={styles.primaryBtn} onPress={saveAdvancedGasSettings}>
          <Text style={styles.primaryBtnText}>{flow.saveGasSettings}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );

  const renderSendAuth = () => {
    const authTitle = sendAuthMethod === 'password' ? flow.passwordLabel : sendAuthMethod === 'fingerprint' ? flow.fingerprintTitle : flow.faceTitle;
    const authIcon: keyof typeof Ionicons.glyphMap = sendAuthMethod === 'fingerprint' ? 'shield-checkmark-outline' : 'scan-outline';
    const authHeaderTitle = text.send;

    return (
      <View style={styles.screen}>
        {renderSubHeader(authHeaderTitle)}
        <View style={styles.formWrap}>
          {sendAuthMethod !== 'password' ? (
            <>
              <Text style={styles.fieldLabel}>{flow.authMethod}</Text>
              <Text style={styles.authMethodText}>
                {sendAuthMethod === 'fingerprint' ? flow.fingerprintMode : flow.faceMode}
              </Text>
            </>
          ) : null}

          {sendAuthMethod === 'password' ? (
            <>
              {renderPasscodePad({
                value: authPasswordInput,
                setValue: setAuthPasswordInput,
                error: authErrorMessage,
                onClearError: () => setAuthErrorMessage(''),
                onSubmit: () => void confirmSendWithAuth(),
                onComplete: (value) => {
                  void confirmSendWithAuth(value);
                },
                submitLabel: flow.authContinue,
                showErrorText: false,
                showSubmitButton: false
              })}
            </>
          ) : (
            <View style={styles.authCard}>
              <ThemedIonicons name={authIcon} size={44} color={palette.accent} />
              <Text style={styles.authCardTitle}>{authTitle}</Text>
              <Text style={styles.authHintText}>{flow.authContinue}</Text>
            </View>
          )}

          {sendAuthMethod !== 'password' ? (
            <Pressable style={styles.primaryBtn} onPress={() => void confirmSendWithAuth()}>
              <Text style={styles.primaryBtnText}>{flow.authContinue}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  const renderSendProcessing = () => {
    const waiting = sendIsProcessing && !sendIsDone;
    return (
      <View style={styles.screen}>
        <View style={styles.processingHeader}>
          <View style={styles.subHeaderSpacer} />
          <Text style={styles.subHeaderTitle}>{waiting ? flow.processingTitle : flow.processingDoneTitle}</Text>
          <Pressable style={styles.backBtn} hitSlop={HEADER_BUTTON_HIT_SLOP} onPress={() => openRoot('home')}>
            <ThemedIonicons name="close" size={20} color={palette.text} style={styles.backBtnIconGlyph} />
          </Pressable>
        </View>
        <View style={styles.processingWrap}>
          <View style={styles.processingIconWrap}>
            <ThemedIonicons name={waiting ? 'sync-outline' : 'checkmark-done'} size={52} color={palette.accent} />
          </View>
          <Text style={styles.processingTitle}>{waiting ? flow.processingTitle : flow.processingDoneTitle}</Text>
          <Text style={styles.processingBody}>{waiting ? flow.processingBody : flow.processingDoneBody}</Text>
          <Pressable
            style={[styles.primaryBtn, waiting ? styles.btnDisabled : undefined]}
            disabled={waiting}
            onPress={openSendTxDetail}
          >
            <Text style={styles.primaryBtnText}>{flow.viewTxDetails}</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderSendTxDetail = () => {
    const txDetailTitle = txDetailData ? getTxDetailTitle(txDetailData.txType) : flow.txDetailTitle;
    const txDetailHeader =
      txDetailHeaderMode === 'postSend' ? (
        <View style={styles.subHeader}>
          {renderHeaderBackdrop()}
          <View pointerEvents="none" style={styles.topHeaderTitleLayer}>
            <Text numberOfLines={1} style={styles.subHeaderTitle}>
              {txDetailTitle}
            </Text>
          </View>
          <View style={styles.topHeaderSide}>
            <View style={styles.subHeaderSpacer} />
          </View>
          <View style={[styles.topHeaderSide, styles.topHeaderSideRight]}>
            <Pressable style={styles.backBtn} hitSlop={HEADER_BUTTON_HIT_SLOP} onPress={() => openRoot('home')}>
              <ThemedIonicons name="close" size={20} color={palette.text} style={styles.backBtnIconGlyph} />
            </Pressable>
          </View>
        </View>
      ) : (
        renderSubHeader(txDetailTitle)
      );

    if (!txDetailData) {
      return (
        <View style={styles.screen}>
          {txDetailHeader}
          <View style={styles.singleWrap}>
            <View style={styles.infoCard}>
              <Text style={styles.infoBody}>{flow.processingBody}</Text>
            </View>
          </View>
        </View>
      );
    }

    const statusText = getTxStatusText(txDetailData.status);
    const isIncomingTx = txDetailData.txType === 'receive';
    const isNftTx = txDetailData.tokenSymbol.toUpperCase() === 'NFT';
    const amountPrefix = isNftTx ? '' : isIncomingTx ? '+' : '-';
    const amountText = `${amountPrefix}${formatAmount(txDetailData.amount, text.locale)} ${txDetailData.tokenSymbol}`;
    const counterpartyLabel = isIncomingTx ? text.from : flow.recipientWallet;

    return (
      <View style={styles.screen}>
        {txDetailHeader}
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
          <Text style={styles.txDetailAmount}>{amountText}</Text>
          <Text style={styles.txDetailUsd}>≈ {formatCurrency(txDetailData.usdValue, text.locale)}</Text>

          <View style={styles.txDetailCard}>
            <View style={styles.sendConfirmDetailRow}>
              <Text style={styles.sendConfirmLabel}>{text.history}</Text>
              <Text style={styles.sendConfirmValue}>{txDetailData.createdAt}</Text>
            </View>
            <View style={styles.sendConfirmDetailRow}>
              <Text style={styles.sendConfirmLabel}>{flow.status}</Text>
              <Text style={styles.sendConfirmValue}>{statusText}</Text>
            </View>
            <View style={styles.sendConfirmDetailRow}>
              <Text style={styles.sendConfirmLabel}>{counterpartyLabel}</Text>
              <Text style={styles.sendConfirmValue}>{shortAddressCenter(txDetailData.recipient, 10, 8)}</Text>
            </View>
            {txDetailData.recipientLabel ? (
              <View style={styles.sendConfirmDetailRow}>
                <Text style={styles.sendConfirmLabel}>{extra.label}</Text>
                <Text style={styles.sendConfirmValue}>{txDetailData.recipientLabel}</Text>
              </View>
            ) : null}
            <View style={styles.sendConfirmDetailRow}>
              <Text style={styles.sendConfirmLabel}>{text.memo}</Text>
              <Text style={styles.sendConfirmValue}>{txDetailData.memo?.trim() || '-'}</Text>
            </View>
          </View>

          <View style={styles.txDetailCard}>
            <View style={styles.sendConfirmDetailRow}>
              <Text style={styles.sendConfirmLabel}>{txDetailData.feeStatus === 'confirmed' ? flow.networkFee : text.feeEstimate}</Text>
              <Text style={styles.sendConfirmValue}>
                {formatNativeFee(txDetailData.feeNative)} {chainTickerMap[txDetailData.chainCode]} ({formatCurrency(txDetailData.feeUsd, text.locale)})
              </Text>
            </View>
            <View style={styles.sendConfirmDetailRow}>
              <Text style={styles.sendConfirmLabel}>{flow.nonceLabel}</Text>
              <Text style={styles.sendConfirmValue}>{txDetailData.gas.nonce}</Text>
            </View>
          </View>

          <View style={styles.txDetailCard}>
            <View style={styles.txHashRow}>
              <View style={styles.txHashMeta}>
                <Text style={styles.sendConfirmLabel}>{flow.txHash}</Text>
                <Text style={styles.txHashValue}>{shortAddressCenter(txDetailData.hash, 14, 12)}</Text>
              </View>
              <Pressable style={styles.txCopyBtn} onPress={() => copyAddressText(txDetailData.hash)}>
                <ThemedIonicons name="copy-outline" size={14} color={palette.text} />
              </Pressable>
            </View>
          </View>

          <View style={styles.txDetailActions}>
            <Pressable style={styles.txActionBtn} onPress={shareTxDetail}>
              <ThemedIonicons name="share-social-outline" size={16} color={palette.text} />
              <Text style={styles.txActionBtnText}>{flow.shareTx}</Text>
            </Pressable>
            <Pressable style={[styles.txActionBtn, { marginRight: 0 }]} onPress={openTxInExplorer}>
              <ThemedIonicons name="open-outline" size={16} color={palette.text} />
              <Text style={styles.txActionBtnText}>{flow.openExplorer}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderReceive = () => {
    const receiveAddress = isReceiveSelectionComplete && selectedReceiveToken ? selectedReceiveToken.walletAddress : '';

    return (
      <View style={styles.screen}>
        {renderSubHeader(text.receive)}
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
          <View style={styles.historyFilterSection}>
            <Text style={styles.historyFilterTitle}>{text.historyFilterType}</Text>
            <View style={[styles.historyDateRow, styles.historyScopeRow]}>
              <Pressable style={[styles.historyDateChip, styles.historyScopeChip, styles.historyDateChipActive]} onPress={() => {}}>
                <Text style={styles.historyDateChipTextActive}>{text.historyTypeAsset}</Text>
              </Pressable>
              <Pressable
                style={[styles.historyDateChip, styles.historyScopeChip]}
                onPress={() => openNftReceiveScreen(undefined, { replaceTop: true })}
              >
                <Text style={styles.historyDateChipText}>{text.historyTypeNft}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.historyFilterSection}>
            <Text style={styles.historyFilterTitle}>{text.selectChain}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyAssetRow}>
                <Pressable
                  style={[styles.historyFilterChip, receiveChainFilter === 'ALL' ? styles.historyFilterChipActive : undefined]}
                  onPress={() => {
                    setReceiveChainFilter('ALL');
                    setReceiveAssetFilterTokenId('ALL');
                  }}
                >
                  <Text style={receiveChainFilter === 'ALL' ? styles.historyFilterChipTextActive : styles.historyFilterChipText}>
                    {text.historyFilterAll}
                  </Text>
                </Pressable>
              {filterChainCodes.map((chain) =>
                renderIconChip(
                  `receive-chain-${chain}`,
                  chainIconMap[chain],
                  chainTickerMap[chain],
                  receiveChainFilter === chain,
                  () => {
                      setReceiveChainFilter(chain);
                    setReceiveChainCode(chain);
                      setReceiveAssetFilterTokenId('ALL');
                    const next = allFilterTokens.find((token) => token.chainCode === chain);
                    if (next) setReceiveTokenId(next.id);
                  },
                  { showTicker: false, compact: true }
                )
              )}
            </ScrollView>
          </View>

          <View style={styles.historyFilterSection}>
            <Text style={styles.historyFilterTitle}>{text.selectAsset}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyAssetRow}>
                <Pressable
                  style={[styles.historyFilterChip, receiveAssetFilterTokenId === 'ALL' ? styles.historyFilterChipActive : undefined]}
                  onPress={() => setReceiveAssetFilterTokenId('ALL')}
                >
                  <Text style={receiveAssetFilterTokenId === 'ALL' ? styles.historyFilterChipTextActive : styles.historyFilterChipText}>
                    {text.historyFilterAll}
                  </Text>
                </Pressable>
              {receiveChainFilter === 'ALL'
                ? (
                      <Text style={styles.historyFilterHintInline} numberOfLines={1}>
                        {text.receiveFilterAddressHint}
                      </Text>
                    )
                : receiveAssetOptions.map((token) =>
                    renderIconChip(
                      `receive-asset-${token.id}`,
                      token.iconSource ?? coinIconMap[token.assetKey],
                      token.symbol,
                      receiveAssetFilterTokenId === token.id,
                      () => {
                        setReceiveAssetFilterTokenId(token.id);
                        setReceiveTokenId(token.id);
                      },
                      { showTicker: false, compact: true }
                    )
                  )}
            </ScrollView>
          </View>

          <ReceiveQrCard
            qrValue={receiveAddress}
            address={receiveAddress}
              emptyHint={text.selectChainAssetFirst}
            copyLabel={text.copyAddress}
            shareLabel={text.shareImage}
            styles={styles}
            onCopy={() => {
              if (!ensureReceiveSelectionOrToast()) return;
              copyAddressText(receiveAddress);
            }}
            onShare={() => {
              if (!ensureReceiveSelectionOrToast() || !selectedReceiveToken) return;
              shareQrImage(receiveAddress, selectedReceiveToken.chainCode, selectedReceiveToken.symbol);
            }}
          />
        </ScrollView>
      </View>
    );
  };

  const renderNftReceive = () => {
    const selectedReceiveNftChain = receiveNftChainFilter === 'ALL' ? null : receiveNftChainFilter;
    const receiveAddress = selectedReceiveNftChain
      ? (activeWalletChainAddresses?.[selectedReceiveNftChain] ??
        tokens.find((token) => token.chainCode === selectedReceiveNftChain)?.walletAddress ??
        '')
      : '';
    const nftReceiveSelectChainMessage = lang === 'ko' ? '체인을 선택하세요.' : lang === 'zh' ? '请选择链。' : 'Select chain.';

    return (
      <View style={styles.screen}>
        {renderSubHeader(text.receive)}
        <ScrollView ref={nftReceiveScrollRef} style={styles.scroll} contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
          <View style={styles.historyFilterSection}>
            <Text style={styles.historyFilterTitle}>{text.historyFilterType}</Text>
            <View style={[styles.historyDateRow, styles.historyScopeRow]}>
              <Pressable style={[styles.historyDateChip, styles.historyScopeChip]} onPress={() => replaceTopScreen('receive')}>
                <Text style={styles.historyDateChipText}>{text.historyTypeAsset}</Text>
              </Pressable>
              <Pressable style={[styles.historyDateChip, styles.historyScopeChip, styles.historyDateChipActive]} onPress={() => {}}>
                <Text style={styles.historyDateChipTextActive}>{text.historyTypeNft}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.historyFilterSection}>
            <Text style={styles.historyFilterTitle}>{text.selectChain}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyAssetRow}>
              <Pressable
                style={[styles.historyFilterChip, receiveNftChainFilter === 'ALL' ? styles.historyFilterChipActive : undefined]}
                onPress={() => setReceiveNftChainFilter('ALL')}
              >
                <Text style={receiveNftChainFilter === 'ALL' ? styles.historyFilterChipTextActive : styles.historyFilterChipText}>
                  {text.historyFilterAll}
                </Text>
              </Pressable>
              {nftReceiveChainOptions.map((chain) =>
                renderIconChip(
                  `receive-nft-chain-${chain}`,
                  chainIconMap[chain],
                  chainTickerMap[chain],
                  receiveNftChainFilter === chain,
                  () => setReceiveNftChainFilter(chain),
                  { showTicker: false, compact: true }
                )
              )}
            </ScrollView>
          </View>

          <ReceiveQrCard
            qrValue={receiveAddress}
            address={receiveAddress}
            emptyHint={text.receiveFilterAddressHint}
            copyLabel={text.copyAddress}
            shareLabel={text.shareImage}
            styles={styles}
            onCopy={() => {
              if (!selectedReceiveNftChain || !receiveAddress) {
                setBannerMessage(nftReceiveSelectChainMessage);
                return;
              }
              copyAddressText(receiveAddress);
            }}
            onShare={() => {
              if (!selectedReceiveNftChain || !receiveAddress) {
                setBannerMessage(nftReceiveSelectChainMessage);
                return;
              }
              shareQrImage(receiveAddress, selectedReceiveNftChain, `${chainTickerMap[selectedReceiveNftChain]} NFT`);
            }}
          />
        </ScrollView>
      </View>
    );
  };

const renderAddressBookSelect = () => renderAddressBook();

  const renderAddressBook = () => (
    <View style={styles.screen}>
      {renderSubHeader(extra.addressBookManage)}
      {showAddressBookEditModal ? <Pressable style={styles.walletMenuScrim} onPress={resetAddressBookEditState} /> : null}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollPad}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!showAddressBookEditModal}
      >
        <View style={styles.historyFilterSection}>
          <Text style={styles.historyFilterTitle}>{extra.addressBookTypeSelect}</Text>
          <View style={[styles.historyDateRow, styles.addressBookScopeRow]}>
            <Pressable
              style={[styles.historyDateChip, styles.addressBookScopeChip, addressBookScope === 'asset' ? styles.historyDateChipActive : undefined]}
              onPress={() => {
                if (addressBookScope === 'asset') return;
                applyAddressBookScope('asset');
                resetAddressBookFormState('asset');
              }}
            >
              <Text style={addressBookScope === 'asset' ? styles.historyDateChipTextActive : styles.historyDateChipText}>
                {extra.assetAddressBook}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.historyDateChip, styles.addressBookScopeChip, addressBookScope === 'nft' ? styles.historyDateChipActive : undefined]}
              onPress={() => {
                if (addressBookScope === 'nft') return;
                applyAddressBookScope('nft');
                resetAddressBookFormState('nft');
              }}
            >
              <Text style={addressBookScope === 'nft' ? styles.historyDateChipTextActive : styles.historyDateChipText}>
                {extra.nftAddressBook}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.historyFilterSection}>
          <Text style={styles.historyFilterTitle}>{text.selectChain}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyAssetRow}>
            <Pressable
              style={[styles.historyFilterChip, addressBookChainFilter === 'ALL' ? styles.historyFilterChipActive : undefined]}
              onPress={() => {
                setAddressBookChainFilter('ALL');
                setAddressBookAssetFilter('ALL');
              }}
            >
              <Text style={addressBookChainFilter === 'ALL' ? styles.historyFilterChipTextActive : styles.historyFilterChipText}>
                {text.historyFilterAll}
              </Text>
            </Pressable>
            {addressBookChainOptions.map((chain) =>
              renderIconChip(
                `book-chain-${chain}`,
                chainIconMap[chain],
                chainTickerMap[chain],
                addressBookChainFilter === chain,
                () => {
                  setAddressBookChainFilter(chain);
                  setAddressBookAssetFilter('ALL');
                },
                { showTicker: false, compact: true }
              )
            )}
          </ScrollView>
        </View>

        {addressBookScope === 'asset' ? (
          <View style={styles.historyFilterSection}>
            <Text style={styles.historyFilterTitle}>{text.selectAsset}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyAssetRow}>
              <Pressable
                style={[styles.historyFilterChip, addressBookAssetFilter === 'ALL' ? styles.historyFilterChipActive : undefined]}
                onPress={() => setAddressBookAssetFilter('ALL')}
              >
                <Text style={addressBookAssetFilter === 'ALL' ? styles.historyFilterChipTextActive : styles.historyFilterChipText}>
                  {text.historyFilterAll}
                </Text>
              </Pressable>
              {addressBookChainFilter === 'ALL'
                ? (
                    <Text style={styles.historyFilterHintInline} numberOfLines={1}>
                      {text.historyFilterAssetHint}
                    </Text>
                  )
                : addressBookAssetOptions.map((asset) =>
                    renderIconChip(
                      `book-asset-${asset}`,
                      coinIconMap[asset],
                      asset,
                      addressBookAssetFilter === asset,
                      () => setAddressBookAssetFilter(asset),
                      { showTicker: false, compact: true }
                    )
                  )}
            </ScrollView>
          </View>
        ) : null}

        <Text style={[styles.fieldLabel, styles.addressBookFieldTopGap]}>{extra.label}</Text>
        <TextInput
          value={addressLabelInput}
          onChangeText={setAddressLabelInput}
          placeholder={lang === 'ko' ? '라벨을 입력하세요' : lang === 'zh' ? '请输入标签' : 'Enter label'}
          placeholderTextColor={palette.muted}
          style={styles.fieldInput}
        />

        <Text style={styles.fieldLabel}>{text.recipient}</Text>
        <TextInput
          value={addressValueInput}
          onChangeText={setAddressValueInput}
          placeholder={text.recipientPlaceholder}
          placeholderTextColor={palette.muted}
          style={styles.fieldInput}
          autoCapitalize="none"
        />

        <Pressable style={[styles.primaryBtn, styles.addressBookAddBtn]} onPress={submitAddressBookForm}>
          <Text style={styles.primaryBtnText}>{extra.addAddress}</Text>
        </Pressable>

        <Text style={styles.fieldLabel}>{text.addressBook}</Text>

        {filteredAddressBookEntries.length ? (
          <View style={styles.recipientList}>
            {addressBookPagedEntries.map((entry) => (
              <View key={entry.id} style={styles.recipientRow}>
                <Pressable
                  style={styles.recipientMeta}
                  onPress={() => {
                    if (addressBookScope === 'nft') {
                      setNftSendRecipientInput(entry.address);
                      return;
                    }
                    setRecipientInput(entry.address);
                  }}
                >
                  <Text style={styles.recipientPrimary} numberOfLines={1}>
                    {entry.label}
                  </Text>
                  <Text style={styles.recipientSecondary} numberOfLines={1}>
                    {shortAddressCenter(entry.address, 8, 6)}
                  </Text>
                </Pressable>
                <View style={styles.rowActions}>
                  <Pressable
                    style={[
                      styles.rowActionBtn,
                      showAddressBookEditModal && addressEditTargetId === entry.id ? styles.iconCircleBtnActive : undefined,
                      showAddressBookEditModal && addressEditTargetId === entry.id ? styles.dropdownTriggerRaised : undefined
                    ]}
                    onPress={() => startEditAddressEntry(entry)}
                  >
                    <ThemedIonicons
                      name="create-outline"
                      size={14}
                      color={showAddressBookEditModal && addressEditTargetId === entry.id ? '#16110a' : palette.text}
                    />
                  </Pressable>
                  <Pressable
                    style={[
                      styles.rowActionBtn,
                      showAddressBookEditModal && addressEditTargetId === entry.id ? styles.scanNonTriggerDimmed : undefined
                    ]}
                    disabled={showAddressBookEditModal && addressEditTargetId === entry.id}
                    onPress={() => deleteAddressEntry(entry.id)}
                  >
                    <ThemedIonicons name="trash-outline" size={14} color={palette.negative} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyInline}>{activeManagerAddressBook.length ? text.historyNoResult : extra.noAddressForChain}</Text>
        )}
        {filteredAddressBookEntries.length ? (
          <View style={[styles.discoverPopularPagination, styles.addressBookPagination]}>
            <Pressable
              style={[styles.discoverPopularPageBtn, addressBookCurrentPage <= 1 ? styles.discoverPopularPageBtnDisabled : undefined]}
              disabled={addressBookCurrentPage <= 1}
              onPress={() => setAddressBookPage((prev) => Math.max(1, prev - 1))}
            >
              <ThemedIonicons name="chevron-back" size={14} color={addressBookCurrentPage <= 1 ? palette.muted : palette.text} />
            </Pressable>
            <View style={styles.discoverPopularPageBadge}>
              <Text style={styles.discoverPopularPageBadgeText}>
                {addressBookCurrentPage} / {addressBookTotalPages}
              </Text>
            </View>
            <Pressable
              style={[styles.discoverPopularPageBtn, addressBookCurrentPage >= addressBookTotalPages ? styles.discoverPopularPageBtnDisabled : undefined]}
              disabled={addressBookCurrentPage >= addressBookTotalPages}
              onPress={() => setAddressBookPage((prev) => Math.min(addressBookTotalPages, prev + 1))}
            >
              <ThemedIonicons name="chevron-forward" size={14} color={addressBookCurrentPage >= addressBookTotalPages ? palette.muted : palette.text} />
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );

const renderHistory = () => (
    <View style={styles.screen}>
      {renderSubHeader(text.history)}
      {showHistoryDateRangeModal || showHistoryDateCalendarModal ? (
        <Pressable
          style={styles.walletMenuScrim}
          onPress={() => {
            setShowHistoryDateCalendarModal(false);
            setShowHistoryDateRangeModal(false);
          }}
        />
      ) : null}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollPad}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!(showHistoryDateRangeModal || showHistoryDateCalendarModal)}
      >
        <View style={styles.sendScrollContentWrap}>
          <View style={styles.historyFilterSection}>
          <Text style={styles.historyFilterTitle}>{text.historyFilterType}</Text>
          <View style={[styles.historyDateRow, styles.historyScopeRow]}>
            {([
              ['ALL', text.historyFilterAll],
              ['ASSET', text.historyTypeAsset],
              ['NFT', text.historyTypeNft]
            ] as [HistoryScopeFilter, string][]).map(([key, label]) => (
              <Pressable
                key={`history-scope-${key}`}
                style={[styles.historyDateChip, styles.historyScopeChip, historyScopeFilter === key ? styles.historyDateChipActive : undefined]}
                onPress={() => setHistoryScopeFilter(key)}
              >
                <Text style={historyScopeFilter === key ? styles.historyDateChipTextActive : styles.historyDateChipText}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.historyFilterSection}>
          <Text style={styles.historyFilterTitle}>{text.historyFilterChain}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Pressable
              style={[styles.historyFilterChip, historyChainFilter === 'ALL' ? styles.historyFilterChipActive : undefined]}
              onPress={() => setHistoryChainFilter('ALL')}
            >
              <Text style={historyChainFilter === 'ALL' ? styles.historyFilterChipTextActive : styles.historyFilterChipText}>
                {text.historyFilterAll}
              </Text>
            </Pressable>
            {historyChainOptions.map((chain) =>
              renderIconChip(
                `history-chain-${chain}`,
                chainIconMap[chain],
                chainTickerMap[chain],
                historyChainFilter === chain,
                () => setHistoryChainFilter(chain),
                { showTicker: false, compact: true }
              )
            )}
          </ScrollView>
        </View>

        {historyScopeFilter !== 'NFT' ? (
          <View style={styles.historyFilterSection}>
            <Text style={styles.historyFilterTitle}>{text.historyFilterAsset}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyAssetRow}>
              <Pressable
                style={[styles.historyFilterChip, historyAssetFilter === 'ALL' ? styles.historyFilterChipActive : undefined]}
                onPress={() => setHistoryAssetFilter('ALL')}
              >
                <Text style={historyAssetFilter === 'ALL' ? styles.historyFilterChipTextActive : styles.historyFilterChipText}>
                  {text.historyFilterAll}
                </Text>
              </Pressable>
              {historyChainFilter === 'ALL'
                ? (
                    <Text style={styles.historyFilterHintInline} numberOfLines={1}>
                      {text.historyFilterAssetHint}
                    </Text>
                  )
                : historyAssetOptions.map((asset) =>
                    renderIconChip(
                      `history-asset-${asset}`,
                      coinIconMap[asset],
                      asset,
                      historyAssetFilter === asset,
                      () => setHistoryAssetFilter(asset),
                      { showTicker: false, compact: true }
                    )
                  )}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.historyFilterSection}>
          <Text style={styles.historyFilterTitle}>{text.historyFilterDate}</Text>
          <View style={styles.historyDateFilterRow}>
            <View style={styles.historyDateQuickRow}>
              {([
                ['ALL', text.historyFilterAll],
                ['TODAY', text.historyDateToday],
                ['7D', text.historyDate7d],
                ['30D', text.historyDate30d]
              ] as [HistoryDateFilter, string][]).map(([key, label]) => (
                <Pressable
                  key={`history-date-${key}`}
                  style={[styles.historyDateChip, styles.historyScopeChip, historyDateFilter === key ? styles.historyDateChipActive : undefined]}
                  onPress={() => {
                    setHistoryDateFilter(key);
                  }}
                >
                  <Text style={historyDateFilter === key ? styles.historyDateChipTextActive : styles.historyDateChipText}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              ref={historyRangeTriggerRef}
              onLayout={measureHistoryRangeTriggerAnchor}
              style={[
                styles.historyDateChip,
                styles.historyDateRangeChip,
                historyDateFilter === 'RANGE' || showHistoryDateRangeModal || showHistoryDateCalendarModal ? styles.historyDateChipActive : undefined
              ]}
              onPress={() => {
                measureHistoryRangeTriggerAnchor();
                openHistoryDateRangeModal();
              }}
            >
              <Text
                style={
                  historyDateFilter === 'RANGE' || showHistoryDateRangeModal || showHistoryDateCalendarModal
                    ? styles.historyDateChipTextActive
                    : styles.historyDateChipText
                }
              >
                {text.historyDateRange}
              </Text>
            </Pressable>
          </View>
          {historyDateFilter === 'RANGE' ? (
            <Text style={styles.historyRangeSummary}>
              {formatHistoryRangeLabel(historyRangeStart)} - {formatHistoryRangeLabel(historyRangeEnd)}
            </Text>
          ) : null}
        </View>

        {filteredHistoryTxs.length ? (
          historyPagedTxs.map((tx) => {
            const isIncomingTx = tx.type === 'receive';
            const isNftTx = tx.tokenSymbol.toUpperCase() === 'NFT';
            const amountPrefix = isNftTx ? '' : isIncomingTx ? '+' : '-';
            const txChain = inferChainFromTx(tx);
            const txAddressLabel = findAddressBookLabel(txChain, tx.counterparty);
            const txMemoValue = tx.memo?.trim() || '-';
            const txTypeLabel = isIncomingTx ? text.receive : text.send;
            return (
              <Pressable key={tx.id} style={styles.txRow} onPress={() => openHistoryTxDetail(tx)}>
                <View>
                  <Text style={styles.txSymbol}>{tx.tokenSymbol}</Text>
                  <Text style={styles.txMeta}>
                    {txTypeLabel} / {tx.createdAt}
                  </Text>
                  <Text style={styles.txMemo} numberOfLines={1}>
                    {txAddressLabel ? <Text style={styles.txMetaLabelAccent}>{txAddressLabel}</Text> : null}
                    {txAddressLabel ? ' / ' : ''}
                    {txMemoValue}
                  </Text>
                </View>
                <View style={styles.txValueCol}>
                  <Text style={styles.txTokenAmount}>
                    {amountPrefix}
                    {formatAmount(tx.amount, text.locale)} {tx.tokenSymbol}
                  </Text>
                  <Text style={styles.txUsd}>{formatCurrency(tx.usdValue, text.locale)}</Text>
                  <ThemedIonicons name="chevron-forward" size={14} color={palette.muted} style={styles.txGoIcon} />
                </View>
              </Pressable>
            );
          })
        ) : (
          <View style={styles.infoCard}>
            <Text style={styles.infoBody}>{text.historyNoResult}</Text>
          </View>
        )}
        {filteredHistoryTxs.length > 20 ? (
          <View style={styles.discoverPopularPagination}>
            <Pressable
              style={[styles.discoverPopularPageBtn, historyCurrentPage <= 1 ? styles.discoverPopularPageBtnDisabled : undefined]}
              disabled={historyCurrentPage <= 1}
              onPress={() => {
                setHistoryPage((prev) => Math.max(1, prev - 1));
              }}
            >
              <ThemedIonicons name="chevron-back" size={14} color={historyCurrentPage <= 1 ? palette.muted : palette.text} />
              <Text
                style={[
                  styles.discoverPopularPageBtnText,
                  { marginLeft: 2 },
                  historyCurrentPage <= 1 ? styles.discoverPopularPageBtnTextDisabled : undefined
                ]}
              >
                {lang === 'ko' ? '이전' : lang === 'zh' ? '上一页' : 'Prev'}
              </Text>
            </Pressable>

            <View style={styles.discoverPopularPageBadge}>
              <Text style={styles.discoverPopularPageBadgeText}>
                {historyCurrentPage} / {historyTotalPages}
              </Text>
            </View>

            <Pressable
              style={[styles.discoverPopularPageBtn, historyCurrentPage >= historyTotalPages ? styles.discoverPopularPageBtnDisabled : undefined]}
              disabled={historyCurrentPage >= historyTotalPages}
              onPress={() => {
                setHistoryPage((prev) => Math.min(historyTotalPages, prev + 1));
              }}
            >
              <Text
                style={[
                  styles.discoverPopularPageBtnText,
                  { marginRight: 2 },
                  historyCurrentPage >= historyTotalPages ? styles.discoverPopularPageBtnTextDisabled : undefined
                ]}
              >
                {lang === 'ko' ? '다음' : lang === 'zh' ? '下一页' : 'Next'}
              </Text>
              <ThemedIonicons name="chevron-forward" size={14} color={historyCurrentPage >= historyTotalPages ? palette.muted : palette.text} />
            </Pressable>
          </View>
        ) : null}
        </View>
      </ScrollView>
    </View>
  );

  const renderDiscoverEmpty = (title: string, body: string) => (
    <View style={styles.screen}>
      {renderSubHeader(title)}
      <View style={styles.singleWrap}>
        <View style={styles.infoCard}>
          <Text style={styles.infoBody}>{body}</Text>
          <Pressable style={styles.primaryBtn} onPress={() => openRoot('discover')}>
            <Text style={styles.primaryBtnText}>{text.startBrowsing}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  const renderOnboardingWelcome = () => (
    <View style={styles.screen}>
      <View style={styles.onboardingWrap}>
        <Image source={onboardingSymbolSource} style={styles.onboardingSymbolImage} resizeMode="contain" />
        <Text style={styles.onboardingTitle}>{text.onboardingTitle}</Text>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => {
            startCreateWalletFlow();
          }}
        >
          <Text style={styles.primaryBtnText}>{text.createWallet}</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryBtn}
          onPress={() => {
            startAddExistingWalletFlow();
          }}
        >
          <Text style={styles.secondaryBtnText}>{text.addExisting}</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderOnboardingCreateCheck = () => {
    const checklistItems = [
      { id: 'backup', label: text.securityChecklistBackup, checked: agreeBackup, toggle: () => setAgreeBackup((prev) => !prev) },
      { id: 'share', label: text.securityChecklistNoShare, checked: agreeNeverShare, toggle: () => setAgreeNeverShare((prev) => !prev) },
      { id: 'recovery', label: text.securityChecklistNoRecovery, checked: agreeNoRecover, toggle: () => setAgreeNoRecover((prev) => !prev) }
    ];

    return (
      <View style={styles.screen}>
        {renderSubHeader(text.securityCheck)}
        <View style={styles.formWrap}>
          <View style={styles.onboardingCheckCard}>
            <View style={styles.onboardingCheckHeader}>
              <View style={styles.onboardingCheckIcon}>
                <ThemedIonicons name="shield-checkmark-outline" size={20} color="#16110a" />
              </View>
              <View style={styles.onboardingCheckTitleWrap}>
                <Text style={styles.onboardingCheckTitle}>{text.backupTitle}</Text>
                <Text style={styles.onboardingCheckBody}>{text.backupBody}</Text>
              </View>
            </View>
            <View style={styles.onboardingChecklist}>
              {checklistItems.map((item) => (
                <Pressable
                  key={`agree-${item.id}`}
                  style={[styles.onboardingChecklistRow, item.checked ? styles.onboardingChecklistRowActive : undefined]}
                  onPress={item.toggle}
                >
                  <View style={[styles.onboardingChecklistBadge, item.checked ? styles.onboardingChecklistBadgeActive : undefined]}>
                    <ThemedIonicons name={item.checked ? 'checkmark' : 'add'} size={12} color={item.checked ? '#16110a' : palette.muted} />
                  </View>
                  <Text style={[styles.onboardingChecklistText, item.checked ? styles.onboardingChecklistTextActive : undefined]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Pressable
            style={[styles.primaryBtn, !(agreeBackup && agreeNeverShare && agreeNoRecover) ? styles.btnDisabled : undefined]}
            disabled={!(agreeBackup && agreeNeverShare && agreeNoRecover)}
            onPress={() => navigate('onboardingCreateBackup')}
          >
            <Text style={styles.primaryBtnText}>{text.continue}</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderOnboardingCreateBackup = () => (
    <View style={styles.screen}>
      {renderSubHeader(text.backupTitle)}
      <View style={styles.formWrap}>
        <View style={styles.onboardingBackupHeroCard}>
          <View style={styles.onboardingBackupHeroTop}>
            <View style={styles.onboardingBackupHeroIconWrap}>
              <ThemedIonicons name="key-outline" size={18} color="#16110a" />
            </View>
            <Text style={styles.onboardingBackupHeroTitle}>{text.backupTitle}</Text>
          </View>
          <Text style={styles.onboardingBackupHeroBody}>{text.backupBody}</Text>
        </View>

        <View style={styles.onboardingBackupTipsCard}>
          {[text.securityChecklistBackup, text.securityChecklistNoShare, text.securityChecklistNoRecovery].map((item, index) => (
            <View key={`backup-tip-${index}`} style={styles.onboardingBackupTipRow}>
              <View style={styles.onboardingBackupTipIconWrap}>
                <ThemedIonicons name="checkmark" size={12} color="#16110a" />
              </View>
              <Text style={styles.onboardingBackupTipText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.onboardingBackupWarningCard}>
          <ThemedIonicons name="alert-circle-outline" size={16} color={palette.accent} />
          <Text style={styles.onboardingBackupWarningText}>{text.backupWarning}</Text>
        </View>

        <Pressable style={styles.primaryBtn} onPress={() => navigate('onboardingCreatePhrase')}>
          <Text style={styles.primaryBtnText}>{text.continue}</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderOnboardingCreatePhrase = () => (
    <View style={styles.screen}>
      {renderSubHeader(text.phraseTitle)}
      <View style={styles.formWrap}>
        <Text style={styles.seedPreviewGuide}>{text.phraseGuide}</Text>
        <View style={styles.seedPreviewGrid}>
          {onboardingSeedWords.map((word, index) => (
            <View key={`seed-preview-${index + 1}`} style={styles.seedPreviewCell}>
              <Text style={styles.seedPreviewIndex}>{index + 1}</Text>
              <Text style={styles.seedPreviewWord}>{word}</Text>
            </View>
          ))}
        </View>
        <Text style={[styles.seedPreviewHint, styles.seedPreviewHintCentered]}>{text.phraseGuideSub}</Text>
        <Pressable style={styles.secondaryBtn} onPress={copySeedPhraseText}>
          <Text style={styles.secondaryBtnText}>{text.copyPhrase}</Text>
        </Pressable>
        <Pressable style={styles.primaryBtn} onPress={() => navigate('onboardingCreateConfirm')}>
          <Text style={styles.primaryBtnText}>{text.continue}</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderOnboardingCreateConfirm = () => (
    <View style={styles.screen}>
      {renderSubHeader(text.confirmTitle)}
      <View style={styles.formWrap}>
        <Text style={styles.fieldLabel}>{walletUi.walletName}</Text>
        <TextInput
          value={onboardingWalletName}
          onChangeText={setOnboardingWalletName}
          placeholder={walletNamePlaceholder}
          placeholderTextColor={palette.muted}
          style={styles.fieldInput}
        />
        <Text style={styles.seedPreviewGuide}>{text.confirmSeedGuide}</Text>
        <View style={styles.seedGrid}>
          {Array.from({ length: seedWords.length }).map((_, index) => (
            <View key={`create-seed-${index + 1}`} style={styles.seedCell}>
              <Text style={styles.seedCellIndex}>{index + 1}</Text>
              <TextInput
                value={seedWords[index]}
                onChangeText={(value) => updateSeedWordAt(index, value)}
                style={[styles.seedCellInput, seedWords[index].trim() ? styles.seedCellInputFilled : undefined, seedInputWebStyle]}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          ))}
        </View>
        <Pressable
          style={[styles.primaryBtn, !isSeedWordsComplete ? styles.btnDisabled : undefined]}
          disabled={!isSeedWordsComplete}
          onPress={() => {
            if (!isSeedWordsBip39Valid) {
              setBannerMessage(invalidSeedPhraseMessage);
              return;
            }
            if (!isOnboardingSeedMatch) {
              setBannerMessage(seedPhraseMismatchMessage);
              return;
            }
            setPhraseInput(seedPhraseJoined);
            if (!hasWallet && !hasAppPassword) {
              setPendingInitialCreateAfterPassword(true);
              setOnboardingPasswordInput('');
              setOnboardingPasswordConfirmInput('');
              setOnboardingPasswordTarget('password');
              setOnboardingPasswordError('');
              navigate('onboardingSetPassword');
              return;
            }
            setPendingInitialCreateAfterPassword(false);
            setOnboardingDoneGoHomeOnly(false);
            navigate('onboardingCreateDone');
          }}
        >
          <Text style={styles.primaryBtnText}>{text.continue}</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderOnboardingDone = () => (
    <View style={styles.screen}>
      <View style={styles.doneWrap}>
        <View style={styles.doneIcon}>
          <ThemedIonicons name="checkmark" size={40} color={themeMode === 'dark' ? '#000000' : '#ffffff'} />
        </View>
        <Text style={styles.doneTitle}>{text.doneTitle}</Text>
        <Text style={styles.doneBody}>{text.doneBody}</Text>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => {
            if (onboardingDoneGoHomeOnly) {
              setOnboardingDoneGoHomeOnly(false);
              openRoot('home');
              return;
            }
            completeWalletCreateFlow({ requirePasswordSetup: !hasWallet && !hasAppPassword });
          }}
        >
          <Text style={styles.primaryBtnText}>{text.goToWallet}</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderOnboardingSetPassword = () => (
    <View style={styles.screen}>
      {renderSubHeader(flow.appPasswordSetupTitle)}
      <View style={styles.formWrap}>
        <View style={styles.onboardingSetPasswordTop}>
          <Text style={styles.onboardingBody}>{flow.appPasswordSetupBody}</Text>

          <View style={styles.onboardingPasscodeBlock}>
            <Text style={[styles.fieldLabel, styles.onboardingPasscodeLabel]}>{flow.sendPasswordLabel}</Text>
            {renderPasscodeBoxes(onboardingPasswordInput, {
              active: onboardingPasswordTarget === 'password',
              error: Boolean(onboardingPasswordError),
              onPress: () => setOnboardingPasswordTarget('password')
            })}
          </View>

          <View style={styles.onboardingPasscodeBlock}>
            <Text style={[styles.fieldLabel, styles.onboardingPasscodeLabel]}>{flow.appPasswordConfirmLabel}</Text>
            {renderPasscodeBoxes(onboardingPasswordConfirmInput, {
              active: onboardingPasswordTarget === 'confirm',
              error: Boolean(onboardingPasswordError),
              onPress: () => setOnboardingPasswordTarget('confirm')
            })}
          </View>

          <View style={[styles.fieldErrorSlot, styles.onboardingPasscodeErrorSlot]}>
            <Text numberOfLines={1} style={[styles.fieldErrorText, !onboardingPasswordError ? styles.fieldErrorTextHidden : undefined]}>
              {onboardingPasswordError ?? ' '}
            </Text>
          </View>
        </View>

        <View style={styles.onboardingSetPasswordBottom}>
          {renderPasscodeKeypad({
            biometricEnabled: false,
            onDigitPress: (digit) => {
              if (onboardingPasswordTarget === 'password') {
                appendPasscodeDigit(onboardingPasswordInput, setOnboardingPasswordInput, digit, {
                  onClearError: () => setOnboardingPasswordError(''),
                  onComplete: () => setOnboardingPasswordTarget('confirm')
                });
                return;
              }
              appendPasscodeDigit(onboardingPasswordConfirmInput, setOnboardingPasswordConfirmInput, digit, {
                onClearError: () => setOnboardingPasswordError(''),
                onComplete: (value) => {
                  void submitOnboardingPasswordSetup({ confirmPassword: value });
                }
              });
            },
            onDeletePress: () => {
              if (onboardingPasswordTarget === 'confirm') {
                const confirmCurrent = normalizePassword(onboardingPasswordConfirmInput);
                if (confirmCurrent.length > 0) {
                  deletePasscodeDigit(onboardingPasswordConfirmInput, setOnboardingPasswordConfirmInput, {
                    onClearError: () => setOnboardingPasswordError('')
                  });
                  return;
                }
                setOnboardingPasswordTarget('password');
                deletePasscodeDigit(onboardingPasswordInput, setOnboardingPasswordInput, {
                  onClearError: () => setOnboardingPasswordError('')
                });
                return;
              }
              deletePasscodeDigit(onboardingPasswordInput, setOnboardingPasswordInput, {
                onClearError: () => setOnboardingPasswordError('')
              });
            }
          })}
        </View>
      </View>
    </View>
  );

  const renderOnboardingAddExisting = () => {
    const recoveryWordCountTitle = lang === 'ko' ? '복구 단어 수' : lang === 'zh' ? '助记词数量' : 'Recovery word count';

    return (
      <View style={styles.screen}>
        {renderSubHeader(walletUi.addWalletFromRecovery, [
          { icon: 'settings-outline', action: () => navigate('onboardingAddAdvanced'), testId: 'onboarding-advanced-btn' }
        ])}
        <KeyboardAvoidingView style={styles.passcodeLayout} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.onboardingFormScrollPad, { paddingBottom: onboardingKeyboardPad }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.onboardingFieldBlock}>
            <Text style={styles.fieldLabel}>{walletUi.walletName}</Text>
            <TextInput
              value={onboardingWalletName}
              onChangeText={setOnboardingWalletName}
              placeholder={walletNamePlaceholder}
              placeholderTextColor={palette.muted}
              style={[styles.fieldInput, styles.onboardingFieldInput]}
            />
          </View>

            <View style={styles.onboardingFieldBlock}>
            <Text style={styles.fieldLabel}>{recoveryWordCountTitle}</Text>
            <View style={[styles.historyDateRow, styles.onboardingWordCountRow]}>
              {([12, 24] as RecoveryWordCount[]).map((count) => (
                <Pressable
                  key={`recovery-word-count-${count}`}
                  style={[
                    styles.historyDateChip,
                    styles.onboardingWordCountChip,
                    recoveryWordCount === count ? styles.historyDateChipActive : undefined
                  ]}
                  onPress={() => updateRecoveryWordCount(count)}
                >
                  <Text style={recoveryWordCount === count ? styles.historyDateChipTextActive : styles.historyDateChipText}>
                    {count}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

            <View style={[styles.onboardingFieldBlock, styles.onboardingSeedFieldBlock]}>
            <Text style={styles.fieldLabel}>{text.secretPhrase}</Text>
            <View style={styles.seedGrid}>
              {Array.from({ length: currentSeedWordCount }).map((_, index) => (
                <View key={`existing-seed-${index + 1}`} style={styles.seedCell}>
                  <Text style={styles.seedCellIndex}>{index + 1}</Text>
                  <TextInput
                    value={seedWords[index]}
                    onChangeText={(value) => updateSeedWordAt(index, value)}
                    style={[styles.seedCellInput, seedWords[index].trim() ? styles.seedCellInputFilled : undefined, seedInputWebStyle]}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              ))}
            </View>
          </View>
            <Pressable
              style={[styles.primaryBtn, !isSeedWordsComplete ? styles.btnDisabled : undefined]}
              disabled={!isSeedWordsComplete}
              onPress={() => {
                if (!isSeedWordsBip39Valid) {
                  setBannerMessage(invalidSeedPhraseMessage);
                  return;
                }
                setSeedAccountIndexInput(String(normalizedSeedAccountIndex));
                setPhraseInput(seedPhraseJoined);
                setRecoveryIndexScanResult(null);
                navigate('onboardingAddDone');
              }}
            >
              <Text style={styles.primaryBtnText}>{text.continue}</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  };

  const renderOnboardingAddAdvanced = () => {
    const passphraseTitle = lang === 'ko' ? '패스프레이즈 (선택)' : lang === 'zh' ? '密码短语（可选）' : 'Passphrase (optional)';
    const passphrasePlaceholder = lang === 'ko' ? '비워두면 기본(없음)' : lang === 'zh' ? '留空表示不使用' : 'Leave blank for none';
    const accountIndexTitle = lang === 'ko' ? '계정 인덱스' : lang === 'zh' ? '账户索引' : 'Account index';
    const accountIndexPlaceholder = lang === 'ko' ? '0부터 시작' : lang === 'zh' ? '从 0 开始' : 'Starts at 0';

    return (
      <View style={styles.screen}>
        {renderSubHeader(flow.advancedTitle)}
        <KeyboardAvoidingView style={styles.passcodeLayout} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.onboardingFormScrollPad, { paddingBottom: onboardingKeyboardPad }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
          <View style={styles.onboardingFieldBlock}>
            <Text style={styles.fieldLabel}>{passphraseTitle}</Text>
            <TextInput
              value={seedPassphraseInput}
              onChangeText={(value) => {
                setSeedPassphraseInput(value);
                setRecoveryIndexScanResult(null);
              }}
              placeholder={passphrasePlaceholder}
              placeholderTextColor={palette.muted}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.fieldInput, styles.onboardingFieldInput]}
            />
          </View>

          <View style={styles.onboardingFieldBlock}>
            <Text style={styles.fieldLabel}>{accountIndexTitle}</Text>
            <TextInput
              value={seedAccountIndexInput}
              onChangeText={(value) => {
                setSeedAccountIndexInput(normalizeAccountIndexInput(value));
                setRecoveryIndexScanResult(null);
              }}
              placeholder={accountIndexPlaceholder}
              placeholderTextColor={palette.muted}
              keyboardType="numeric"
              style={[styles.fieldInput, styles.onboardingFieldInput]}
            />
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  };

  const renderOnboardingAddNetwork = () => {
    const scanTitle = lang === 'ko' ? '계정 인덱스 자동 탐색' : lang === 'zh' ? '自动扫描账户索引' : 'Auto account-index scan';
    const scanIdleBody =
      lang === 'ko'
        ? '선택한 네트워크의 온체인 활동을 조회해 가장 가능성 높은 계정 인덱스를 찾습니다.'
        : lang === 'zh'
          ? '系统会按所选网络的链上活动自动推测最可能的账户索引。'
          : 'Checks on-chain activity for the selected network and suggests the best account index.';
    const scanLoadingBody =
      lang === 'ko'
        ? `${selectedNetwork} 활동 내역을 조회 중입니다...`
        : lang === 'zh'
          ? `正在检查 ${selectedNetwork} 的链上活动...`
          : `Checking ${selectedNetwork} activity...`;
    const scanNoActivityBody =
      lang === 'ko'
        ? `${selectedNetwork} 활동 내역을 찾지 못했습니다. 기본 인덱스(0)를 유지합니다.`
        : lang === 'zh'
          ? `未找到 ${selectedNetwork} 的链上活动，保持默认索引（0）。`
          : `No ${selectedNetwork} activity found. Keeping default index (0).`;
    const scanFoundBody =
      lang === 'ko'
        ? `${selectedNetwork} 활동 기준으로 인덱스 ${recoveryIndexScanResult?.bestIndex ?? 0}를 추천합니다.`
        : lang === 'zh'
          ? `按 ${selectedNetwork} 链上活动推荐索引 ${recoveryIndexScanResult?.bestIndex ?? 0}。`
          : `Recommended index ${recoveryIndexScanResult?.bestIndex ?? 0} from ${selectedNetwork} activity.`;
    const scanButtonText = lang === 'ko' ? '자동 탐색 실행' : lang === 'zh' ? '开始自动扫描' : 'Run auto scan';
    const scanLoadingText = lang === 'ko' ? '탐색 중...' : lang === 'zh' ? '扫描中...' : 'Scanning...';
    const accountIndexLabel = lang === 'ko' ? '현재 인덱스' : lang === 'zh' ? '当前索引' : 'Current index';

    const scanBodyText = recoveryIndexScanLoading
      ? scanLoadingBody
      : recoveryIndexScanResult
        ? recoveryIndexScanResult.bestActivity > 0
          ? scanFoundBody
          : scanNoActivityBody
        : scanIdleBody;

    return (
      <View style={styles.screen}>
        {renderSubHeader(text.selectNetwork)}
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>{scanTitle}</Text>
            <Text style={styles.infoBody}>{scanBodyText}</Text>
            <Text style={styles.onboardingScanMeta}>
              {accountIndexLabel}: {normalizedSeedAccountIndex} · {selectedOnboardingChainCode}
            </Text>
            <Pressable
              style={[styles.secondaryBtn, styles.onboardingScanBtn, recoveryIndexScanLoading ? styles.btnDisabled : undefined]}
              disabled={recoveryIndexScanLoading}
              onPress={() => void scanRecoveryIndexForSelectedNetwork()}
            >
              <Text style={styles.secondaryBtnText}>{recoveryIndexScanLoading ? scanLoadingText : scanButtonText}</Text>
            </Pressable>
          </View>

          {ONBOARDING_NETWORK_OPTIONS.map((network) => (
            <Pressable
              key={network.label}
              style={styles.settingRow}
              onPress={() => {
                setSelectedNetwork(network.label);
                setRecoveryIndexScanResult(null);
                navigate('onboardingAddDone');
              }}
            >
              <Text style={styles.settingLabel}>{network.label}</Text>
              {selectedNetwork === network.label ? <ThemedIonicons name="checkmark-circle" size={20} color={palette.accent} /> : null}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderOnboardingAddDone = () => (
    <View style={styles.screen}>
      <View style={styles.doneWrap}>
        <View style={styles.doneIcon}>
          <ThemedIonicons name="wallet-outline" size={36} color={themeMode === 'dark' ? '#000000' : '#ffffff'} />
        </View>
        <Text style={styles.doneTitle}>{text.doneTitle}</Text>
        <Text style={styles.doneBody}>{text.doneBody}</Text>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => {
            if (!hasWallet && !hasAppPassword) {
              setPendingInitialCreateAfterPassword(true);
              setOnboardingPasswordInput('');
              setOnboardingPasswordConfirmInput('');
              setOnboardingPasswordTarget('password');
              setOnboardingPasswordError('');
              navigate('onboardingSetPassword');
              return;
            }
            completeWalletCreateFlow({ target: 'onboardingCreateDone', doneGoHomeOnly: true });
          }}
        >
          <Text style={styles.primaryBtnText}>{text.goToWallet}</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderNoWalletHome = () => (
    <View style={styles.screen}>
      <View style={styles.onboardingWrap}>
        <Image source={onboardingSymbolSource} style={styles.onboardingSymbolImage} resizeMode="contain" />
        <Text style={styles.onboardingTitle}>{text.onboardingTitle}</Text>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => {
            startCreateWalletFlow({ root: true });
          }}
        >
          <Text style={styles.primaryBtnText}>{text.createWallet}</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryBtn}
          onPress={() => {
            startAddExistingWalletFlow({ root: true });
          }}
        >
          <Text style={styles.secondaryBtnText}>{text.addExisting}</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderNoWalletSettings = () => (
    <View style={styles.screen}>
      {renderSubHeader(text.settings)}
      <View style={styles.formWrap}>
        <Pressable style={styles.settingRow} onPress={() => openRoot('home')}>
          <Text style={styles.settingLabel}>{text.backToWallet}</Text>
          <ThemedIonicons name="chevron-forward" size={18} color={palette.muted} />
        </Pressable>
      </View>
    </View>
  );

  const renderAppLockOverlay = () => {
    const shouldShowLockOverlay = isLockPreviewMode
      ? appLocked
      : appLocked && hasWallet && hasAppPassword && passwordLockEnabled;
    if (!shouldShowLockOverlay) return null;

    const effectiveAuthMethod: SendAuthMethod =
      isLockPreviewMode && lockPreviewMode ? lockPreviewMode : sendAuthMethod;
    const allowBiometricUnlock = effectiveAuthMethod !== 'password' && (isLockPreviewMode || biometric);
    const isPasswordMode = effectiveAuthMethod === 'password' || !allowBiometricUnlock;

    return (
      <Modal visible transparent animationType="none" onRequestClose={() => undefined}>
        <View style={styles.appLockLayer}>
          <View style={styles.appLockSplashStage}>
            <Image source={launchIntroLogoSource} style={styles.appLockSplashLogo} resizeMode="contain" />
          </View>
          <View style={styles.appLockDimLayer} />
          {isPasswordMode ? (
            <View style={styles.appLockBackdrop}>
              <View style={styles.appLockCard}>
                <View style={styles.appLockIconWrap}>
                  <ThemedIonicons name="lock-closed-outline" size={26} color={palette.accent} />
                </View>
                <Text style={styles.appLockTitle}>{flow.appUnlockTitle}</Text>
                <Text style={styles.appLockBody}>{flow.appUnlockBody}</Text>
                <View style={styles.appLockPasscodeBlock}>
                  {renderPasscodeBoxes(appUnlockInput, { active: true, error: Boolean(appUnlockError) })}
                  <View style={[styles.fieldErrorSlot, styles.appLockPasscodeErrorSlot]}>
                    <Text numberOfLines={1} style={[styles.fieldErrorText, !appUnlockError ? styles.fieldErrorTextHidden : undefined]}>
                      {appUnlockError ?? ' '}
                    </Text>
                  </View>
                </View>
                <View style={styles.appLockPasscodePad}>
                  {renderPasscodeKeypad({
                    biometricEnabled: false,
                    onDigitPress: (digit) =>
                      appendPasscodeDigit(appUnlockInput, setAppUnlockInput, digit, {
                        onClearError: () => setAppUnlockError(''),
                        onComplete: (value) => unlockWithPassword(value)
                      }),
                    onDeletePress: () =>
                      deletePasscodeDigit(appUnlockInput, setAppUnlockInput, {
                        onClearError: () => setAppUnlockError('')
                      })
                  })}
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    );
  };

  const renderCurrentScreen = () => {
    if (!hasWallet && currentScreen === 'home') return renderNoWalletHome();

    if (currentScreen === 'home') return renderHome();
    if (currentScreen === 'assetDetail') return renderAssetDetail();
    if (currentScreen === 'nftDetail') return renderNftDetail();
    if (currentScreen === 'earn') return renderEarn();
    if (currentScreen === 'discover') return renderDiscover();
    if (currentScreen === 'discoverEarn') return renderDiscoverSectionListScreen('earn');
    if (currentScreen === 'discoverExploreDapps') return renderDiscoverSectionListScreen('dapps');
    if (currentScreen === 'discoverWatchlist') return renderDiscoverSectionListScreen('watchlist');
    if (currentScreen === 'discoverSites') return renderDiscoverSectionListScreen('sites');
    if (currentScreen === 'discoverLatest') return renderDiscover();
    if (currentScreen === 'discoverDappBrowser') return renderDiscoverDappBrowser();
    if (currentScreen === 'discoverPopularRanking') return renderDiscoverPopularRanking();
    if (currentScreen === 'discoverBriefingBoard') return renderDiscoverBriefingBoard();
    if (currentScreen === 'manageAssets') return renderManageAssets();
    if (currentScreen === 'addressBookSelect') return renderAddressBookSelect();
    if (currentScreen === 'addressBook') return renderAddressBook();

    if (currentScreen === 'settings') return renderSettings();
    if (currentScreen === 'settingsTheme') return renderThemeSettings();
    if (currentScreen === 'settingsSecurity') return renderSecuritySettings();
    if (currentScreen === 'settingsNotifications') return renderNotificationSettings();
    if (currentScreen === 'settingsDappSecurity') return renderDiscoverSecuritySettings();
    if (currentScreen === 'settingsWalletsAuth') return renderWalletSettingsAuth();
    if (currentScreen === 'settingsWallets') return renderWalletSettings();
    if (currentScreen === 'settingsHelp') return renderSimpleInfoScreen(text.helpCenter, 'https://support.imwallet.com');
    if (currentScreen === 'settingsPrivacy') return renderSimpleInfoScreen(text.privacyPolicy, PRIVACY_POLICY_URL);
    if (currentScreen === 'settingsSupport') return renderSupportChat();
    if (currentScreen === 'settingsAbout') return renderSimpleInfoScreen(text.about, appInfoVersionLabel, 'Powered by Hepta Labs');

    if (currentScreen === 'send') return renderSend();
    if (currentScreen === 'sendConfirm') return renderSendConfirm();
    if (currentScreen === 'sendAdvanced') return renderSendAdvanced();
    if (currentScreen === 'sendAuth') return renderSendAuth();
    if (currentScreen === 'sendProcessing') return renderSendProcessing();
    if (currentScreen === 'sendTxDetail') return renderSendTxDetail();
    if (currentScreen === 'nftSend') return renderNftSend();
    if (currentScreen === 'receive') return renderReceive();
    if (currentScreen === 'nftReceive') return renderNftReceive();
    if (currentScreen === 'history') return renderHistory();

    if (currentScreen === 'discoverHistory') return renderDiscoverTabListScreen('history');
    if (currentScreen === 'discoverFavorite') return renderDiscoverSectionListScreen('watchlist');
    if (currentScreen === 'discoverNoTabs') return renderDiscoverTabListScreen('tabs');

    if (currentScreen === 'onboardingWelcome') return renderOnboardingWelcome();
    if (currentScreen === 'onboardingCreateCheck') return renderOnboardingCreateCheck();
    if (currentScreen === 'onboardingCreateBackup') return renderOnboardingCreateBackup();
    if (currentScreen === 'onboardingCreatePhrase') return renderOnboardingCreatePhrase();
    if (currentScreen === 'onboardingCreateConfirm') return renderOnboardingCreateConfirm();
    if (currentScreen === 'onboardingCreateDone') return renderOnboardingDone();
    if (currentScreen === 'onboardingSetPassword') return renderOnboardingSetPassword();
    if (currentScreen === 'onboardingAddExisting') return renderOnboardingAddExisting();
    if (currentScreen === 'onboardingAddAdvanced') return renderOnboardingAddAdvanced();
    if (currentScreen === 'onboardingAddNetwork') return renderOnboardingAddNetwork();
    if (currentScreen === 'onboardingAddDone') return renderOnboardingAddDone();
    if (currentScreen === 'walletDeleteCheck') return renderWalletDeleteCheck();
    if (currentScreen === 'walletDeletePhrase') return renderWalletDeletePhrase();
    if (currentScreen === 'walletDeleteAuth') return renderWalletDeleteAuth();
    if (currentScreen === 'noWalletHome') return renderNoWalletHome();
    if (currentScreen === 'noWalletSettings') return renderNoWalletSettings();

    return renderHome();
  };

  let currentScreenNode: React.ReactNode;
  try {
    currentScreenNode = renderCurrentScreen();
  } catch (error) {
    trackError('app.render_crash', error, { screen: currentScreen });
    currentScreenNode = (
      <View style={styles.crashFallbackWrap}>
        <Text style={styles.crashFallbackTitle}>IMWallet Error</Text>
        <Text style={styles.crashFallbackBody}>{USER_SAFE_FATAL_ERROR_MESSAGE}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safe}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} translucent backgroundColor="transparent" />
      <View style={styles.viewport}>
        <View ref={phoneShellRef} style={styles.phoneShell}>
          {toastMessage ? (
            <Animated.View pointerEvents="none" style={[styles.banner, { opacity: toastOpacity, transform: [{ translateY: toastTranslateY }] }]}>
              <Text style={styles.bannerText}>{toastMessage}</Text>
            </Animated.View>
          ) : null}
          {currentScreenNode}
          {renderRecentSendOverlay()}
          {renderHistoryRangeTriggerOverlay()}
          {renderSettingsLangOverlay()}
          {renderSecurityDropdownOverlay()}
          {renderDiscoverBriefingWeekOverlay()}
          {renderHomeScanTriggerOverlay()}
          {renderHomeLayoutTriggerOverlay()}
          {renderBottomDock()}

          <Modal visible={Boolean(discoverSecurityPrompt)} transparent animationType="none" onRequestClose={closeDiscoverSecurityPrompt}>
            <View style={styles.modalBackdrop}>
              <Pressable style={styles.modalScrimTap} onPress={closeDiscoverSecurityPrompt} />
              <Animated.View style={[styles.modalCard, modalCardAnimatedStyle]}>
                <View style={styles.modalHandle} />
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{discoverSecurityText.promptTitle}</Text>
                  <Pressable style={styles.modalCloseBtn} onPress={closeDiscoverSecurityPrompt}>
                    <ThemedIonicons name="close" size={18} color={palette.text} />
                  </Pressable>
                </View>
                <Text style={styles.discoverSecurityPromptMessage}>{discoverSecurityText.promptBodyPrefix}</Text>
                <View style={styles.discoverSecurityPromptHostCard}>
                  <Text style={styles.discoverSecurityPromptHost} numberOfLines={1}>
                    {discoverSecurityPrompt?.host || discoverSecurityPrompt?.url || ''}
                  </Text>
                  <Text style={styles.discoverSecurityPromptReason} numberOfLines={3}>
                    {discoverSecurityPrompt ? getDiscoverSecurityReasonText(discoverSecurityPrompt.reason) : ''}
                  </Text>
                </View>
                <View style={styles.discoverSecurityPromptActionRow}>
                  <Pressable
                    style={[styles.discoverSecurityPromptActionBtn, styles.discoverSecurityPromptActionBtnGhost]}
                    onPress={closeDiscoverSecurityPrompt}
                  >
                    <Text style={[styles.discoverSecurityPromptActionText, styles.discoverSecurityPromptActionTextGhost]}>
                      {discoverSecurityText.promptCancel}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.discoverSecurityPromptActionBtn, styles.discoverSecurityPromptActionBtnPrimary]}
                    onPress={continueDiscoverSecurityPrompt}
                  >
                    <Text style={[styles.discoverSecurityPromptActionText, styles.discoverSecurityPromptActionTextPrimary]}>
                      {discoverSecurityText.promptContinue}
                    </Text>
                  </Pressable>
                </View>
              </Animated.View>
            </View>
          </Modal>

          <Modal visible={showRecipientBookModal} transparent animationType="none" onRequestClose={() => setShowRecipientBookModal(false)}>
            <View style={[styles.modalBackdrop, styles.dropdownModalBackdrop]}>
              <Pressable style={styles.modalScrimTap} onPress={() => setShowRecipientBookModal(false)} />
              <Animated.View style={[styles.modalCard, modalCardAnimatedStyle]}>
                <View style={styles.modalHandle} />
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{recipientBookScope === 'nft' ? extra.nftAddressBook : extra.assetAddressBook}</Text>
                  <Pressable style={styles.modalCloseBtn} onPress={() => setShowRecipientBookModal(false)}>
                    <ThemedIonicons name="close" size={18} color={palette.text} />
                  </Pressable>
                </View>
                <View style={styles.historyFilterSection}>
                  <Text style={styles.historyFilterTitle}>{text.selectChain}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyAssetRow}>
                    <Pressable
                      style={[styles.historyFilterChip, recipientBookChainFilter === 'ALL' ? styles.historyFilterChipActive : undefined]}
                      onPress={() => setRecipientBookChainFilter('ALL')}
                    >
                      <Text style={recipientBookChainFilter === 'ALL' ? styles.historyFilterChipTextActive : styles.historyFilterChipText}>
                        {text.historyFilterAll}
                      </Text>
                    </Pressable>
                    {recipientBookChainOptions.map((chain) =>
                      renderIconChip(
                        `recipient-book-chain-${chain}`,
                        chainIconMap[chain],
                        chainTickerMap[chain],
                        recipientBookChainFilter === chain,
                        () => setRecipientBookChainFilter(chain),
                        { showTicker: false, compact: true }
                      )
                    )}
                  </ScrollView>
                </View>

                {recipientBookScope === 'asset' ? (
                  <View style={styles.historyFilterSection}>
                    <Text style={styles.historyFilterTitle}>{text.selectAsset}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyAssetRow}>
                      <Pressable
                        style={[styles.historyFilterChip, recipientBookAssetFilter === 'ALL' ? styles.historyFilterChipActive : undefined]}
                        onPress={() => setRecipientBookAssetFilter('ALL')}
                      >
                        <Text style={recipientBookAssetFilter === 'ALL' ? styles.historyFilterChipTextActive : styles.historyFilterChipText}>
                          {text.historyFilterAll}
                        </Text>
                      </Pressable>
                      {recipientBookAssetOptions.map((asset) =>
                        renderIconChip(
                          `recipient-book-asset-${asset}`,
                          coinIconMap[asset],
                          asset,
                          recipientBookAssetFilter === asset,
                          () => setRecipientBookAssetFilter(asset),
                          { showTicker: false, compact: true }
                        )
                      )}
                    </ScrollView>
                  </View>
                ) : null}

                {filteredRecipientBookEntries.length ? (
                  <ScrollView style={styles.modalList}>
                    {recipientBookPagedEntries.map((entry) => (
                      <Pressable
                        key={`picker-${entry.id}`}
                        style={styles.modalRow}
                        onPress={() => applyRecipientBookEntryToSend(entry)}
                      >
                        <View style={styles.modalRowIcon}>
                          <ThemedIonicons name="bookmark-outline" size={15} color={palette.accent} />
                        </View>
                        <View style={styles.modalRowMeta}>
                          <Text style={styles.modalPrimary} numberOfLines={1}>
                            {entry.label}
                          </Text>
                          <Text style={styles.modalSecondary} numberOfLines={1}>
                            {shortAddressCenter(entry.address, 8, 6)}
                          </Text>
                        </View>
                        <ThemedIonicons name="chevron-forward" size={16} color={palette.muted} />
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={styles.modalEmptyText}>{extra.noAddressForChain}</Text>
                )}
                {filteredRecipientBookEntries.length ? (
                  <View style={[styles.discoverPopularPagination, styles.modalPaginationCompact]}>
                    <Pressable
                      style={[styles.discoverPopularPageBtn, recipientBookCurrentPage <= 1 ? styles.discoverPopularPageBtnDisabled : undefined]}
                      disabled={recipientBookCurrentPage <= 1}
                      onPress={() => setRecipientBookPage((prev) => Math.max(1, prev - 1))}
                    >
                      <ThemedIonicons name="chevron-back" size={14} color={recipientBookCurrentPage <= 1 ? palette.muted : palette.text} />
                    </Pressable>
                    <View style={styles.discoverPopularPageBadge}>
                      <Text style={styles.discoverPopularPageBadgeText}>
                        {recipientBookCurrentPage} / {recipientBookTotalPages}
                      </Text>
                    </View>
                    <Pressable
                      style={[
                        styles.discoverPopularPageBtn,
                        recipientBookCurrentPage >= recipientBookTotalPages ? styles.discoverPopularPageBtnDisabled : undefined
                      ]}
                      disabled={recipientBookCurrentPage >= recipientBookTotalPages}
                      onPress={() => setRecipientBookPage((prev) => Math.min(recipientBookTotalPages, prev + 1))}
                    >
                      <ThemedIonicons
                        name="chevron-forward"
                        size={14}
                        color={recipientBookCurrentPage >= recipientBookTotalPages ? palette.muted : palette.text}
                      />
                    </Pressable>
                  </View>
                ) : null}
                <Pressable
                  style={[styles.modalActionBtn, styles.modalActionBtnPrimary, styles.modalActionBtnCentered]}
                  onPress={() => openAddressBookManager(recipientBookScope)}
                >
                  <View style={[styles.modalActionIcon, styles.modalActionIconInline]}>
                    <ThemedIonicons name="create-outline" size={16} color="#16110a" />
                  </View>
                  <Text numberOfLines={1} style={styles.modalActionBtnPrimaryLabelInline}>
                    {extra.addressBookManage}
                  </Text>
                </Pressable>
              </Animated.View>
            </View>
          </Modal>

          <Modal visible={showSaveRecipientModal} transparent animationType="none" onRequestClose={() => setShowSaveRecipientModal(false)}>
            <View style={[styles.modalBackdrop, styles.dropdownModalBackdrop]}>
              <Pressable style={styles.modalScrimTap} onPress={() => setShowSaveRecipientModal(false)} />
              <Animated.View style={[styles.modalCard, modalCardAnimatedStyle]}>
                <View style={styles.modalHandle} />
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {saveRecipientScope === 'nft' ? `${extra.nftAddressBook} · ${text.saveAddress}` : text.saveAddress}
                  </Text>
                  <Pressable style={styles.modalCloseBtn} onPress={() => setShowSaveRecipientModal(false)}>
                    <ThemedIonicons name="close" size={18} color={palette.text} />
                  </Pressable>
                </View>
                <Text style={styles.fieldLabel}>{text.recipient}</Text>
                <TextInput
                  value={saveRecipientScope === 'nft' ? nftSendRecipientInput.trim() : recipientInput.trim()}
                  editable={false}
                  selectTextOnFocus={false}
                  style={[styles.fieldInput, styles.fieldInputReadonly, styles.saveRecipientModalInput]}
                />
                <Text style={styles.fieldLabel}>{extra.label}</Text>
                <TextInput
                  value={saveRecipientLabelInput}
                  onChangeText={setSaveRecipientLabelInput}
                  placeholder={extra.label}
                  placeholderTextColor={palette.muted}
                  selectionColor={palette.accent}
                  style={[styles.fieldInput, styles.saveRecipientModalInputLast]}
                  autoCapitalize="words"
                />
                <View style={styles.saveRecipientModalActions}>
                  <Pressable
                    style={[styles.modalActionBtn, styles.modalActionBtnGhost, styles.saveRecipientModalActionBtn]}
                    onPress={() => setShowSaveRecipientModal(false)}
                  >
                    <Text style={[styles.modalActionBtnText, styles.modalActionBtnGhostText]}>{extra.cancel}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalActionBtn, styles.modalActionBtnPrimary, styles.saveRecipientModalActionBtn]}
                    onPress={submitSaveRecipientModal}
                  >
                    <Text style={[styles.modalActionBtnPrimaryText, styles.saveRecipientModalActionBtnText]}>{text.saveAddress}</Text>
                  </Pressable>
                </View>
              </Animated.View>
            </View>
          </Modal>

          <Modal visible={showAddressBookEditModal} transparent animationType="none" onRequestClose={resetAddressBookEditState}>
            <View style={[styles.modalBackdrop, styles.dropdownModalBackdrop]}>
              <Pressable style={styles.modalScrimTap} onPress={resetAddressBookEditState} />
              <Animated.View style={[styles.modalCard, modalCardAnimatedStyle]}>
                <View style={styles.modalHandle} />
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{extra.editAddress}</Text>
                  <Pressable style={styles.modalCloseBtn} onPress={resetAddressBookEditState}>
                    <ThemedIonicons name="close" size={18} color={palette.text} />
                  </Pressable>
                </View>

                <Text style={styles.fieldLabel}>{text.selectChain}</Text>
                <TextInput
                  value={chainLabelMap[addressEditChain]}
                  editable={false}
                  selectTextOnFocus={false}
                  style={[styles.fieldInput, styles.fieldInputReadonly, styles.saveRecipientModalInput]}
                />

                <Text style={styles.fieldLabel}>{text.selectAsset}</Text>
                <TextInput
                  value={addressEditAssetKey}
                  editable={false}
                  selectTextOnFocus={false}
                  style={[styles.fieldInput, styles.fieldInputReadonly, styles.saveRecipientModalInput]}
                />

                <Text style={styles.fieldLabel}>{extra.label}</Text>
                <TextInput
                  value={addressEditLabelInput}
                  onChangeText={setAddressEditLabelInput}
                  placeholder={lang === 'ko' ? '라벨을 입력하세요' : lang === 'zh' ? '请输入标签' : 'Enter label'}
                  placeholderTextColor={palette.muted}
                  selectionColor={palette.accent}
                  style={[styles.fieldInput, styles.saveRecipientModalInput]}
                  autoCapitalize="words"
                />

                <Text style={styles.fieldLabel}>{text.recipient}</Text>
                <TextInput
                  value={addressEditValueInput}
                  onChangeText={setAddressEditValueInput}
                  placeholder={text.recipientPlaceholder}
                  placeholderTextColor={palette.muted}
                  selectionColor={palette.accent}
                  style={[styles.fieldInput, styles.saveRecipientModalInputLast]}
                  autoCapitalize="none"
                />

                <View style={styles.saveRecipientModalActions}>
                  <Pressable
                    style={[styles.modalActionBtn, styles.modalActionBtnGhost, styles.saveRecipientModalActionBtn]}
                    onPress={resetAddressBookEditState}
                  >
                    <Text style={[styles.modalActionBtnText, styles.modalActionBtnGhostText]}>{extra.cancel}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalActionBtn, styles.modalActionBtnPrimary, styles.saveRecipientModalActionBtn]}
                    onPress={submitAddressBookEditModal}
                  >
                    <Text style={[styles.modalActionBtnPrimaryText, styles.saveRecipientModalActionBtnText]}>{extra.save}</Text>
                  </Pressable>
                </View>
              </Animated.View>
            </View>
          </Modal>

          <Modal visible={showScanMethodModal} transparent animationType="none" onRequestClose={() => setShowScanMethodModal(false)}>
            <View style={[styles.modalBackdrop, styles.dropdownModalBackdrop]}>
              <Pressable style={styles.modalScrimTap} onPress={() => setShowScanMethodModal(false)} />
              <Animated.View style={[styles.modalCard, modalCardAnimatedStyle]}>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle}>{extra.scanMethod}</Text>
                <View style={styles.modalActionGroup}>
                  <Pressable style={styles.modalActionBtn} onPress={scanAddressFromCamera}>
                    <View style={styles.modalActionIcon}>
                      <ThemedIonicons name="camera-outline" size={16} color={palette.accent} />
                    </View>
                    <Text style={styles.modalActionBtnText}>{extra.camera}</Text>
                    <ThemedIonicons name="chevron-forward" size={16} color={palette.muted} />
                  </Pressable>
                  <Pressable style={styles.modalActionBtn} onPress={scanAddressFromGallery}>
                    <View style={styles.modalActionIcon}>
                      <ThemedIonicons name="images-outline" size={16} color={palette.accent} />
                    </View>
                    <Text style={styles.modalActionBtnText}>{extra.gallery}</Text>
                    <ThemedIonicons name="chevron-forward" size={16} color={palette.muted} />
                  </Pressable>
                </View>
              </Animated.View>
            </View>
          </Modal>

          <Modal visible={showHomeAssetLayoutModal} transparent animationType="none" onRequestClose={closeHomeAssetLayoutModal}>
            <View style={[styles.modalBackdrop, styles.dropdownModalBackdrop]}>
              <Pressable style={styles.modalScrimTap} onPress={closeHomeAssetLayoutModal} />
              <Animated.View style={[styles.modalCard, styles.assetLayoutModalCard, modalCardAnimatedStyle]}>
                <View style={styles.modalHandle} />
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{text.assetLayout}</Text>
                  <Pressable style={styles.modalCloseBtn} onPress={closeHomeAssetLayoutModal}>
                    <ThemedIonicons name="close" size={18} color={palette.text} />
                  </Pressable>
                </View>

                <View style={styles.assetLayoutPreviewCard}>
                  <View style={styles.assetLayoutPreviewRow}>
                    {renderTokenCircle(layoutPreviewToken, { size: 34 })}
                    <View style={styles.assetLayoutPreviewMeta}>
                      <View style={styles.assetLayoutPreviewTitleRow}>
                        <Text style={styles.assetLayoutPreviewTitle}>
                          {homeAssetLayoutDraft === 3 ? layoutPreviewToken.name : layoutPreviewToken.symbol}
                        </Text>
                        {homeAssetLayoutDraft === 1 ? (
                          <View style={styles.assetLayoutPreviewNetworkChip}>
                            <Text style={styles.assetLayoutPreviewNetworkChipText} numberOfLines={1}>
                              {layoutPreviewToken.name}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.assetLayoutPreviewSub} numberOfLines={1}>
                        {homeAssetLayoutDraft === 1
                          ? `${layoutPreviewPriceText} ${layoutPreviewUp ? '+' : ''}${layoutPreviewToken.change24h.toFixed(2)}%`
                          : homeAssetLayoutDraft === 2
                            ? `${layoutPreviewAmountText} ${layoutPreviewToken.name}`
                            : layoutPreviewBalanceText}
                      </Text>
                    </View>
                    <View style={styles.assetLayoutPreviewValueCol}>
                      <Text style={styles.assetLayoutPreviewValue}>{layoutPreviewAmountText}</Text>
                      <Text style={[styles.assetLayoutPreviewChange, styles.assetLayoutPreviewChangeMuted]}>
                        {layoutPreviewUsdText}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.assetLayoutOptionRow}>
                    {[1, 2, 3].map((layout) => {
                      const active = homeAssetLayoutDraft === layout;
                      return (
                        <Pressable
                          key={`asset-layout-${layout}`}
                          style={[styles.assetLayoutOptionBtn, active ? styles.assetLayoutOptionBtnActive : undefined]}
                          onPress={() => setHomeAssetLayoutDraft(layout as HomeAssetLayout)}
                        >
                          <Text style={active ? styles.assetLayoutOptionTextActive : styles.assetLayoutOptionText}>{layout}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <Pressable style={[styles.primaryBtn, styles.assetLayoutConfirmBtn]} onPress={confirmHomeAssetLayoutModal}>
                  <Text style={styles.primaryBtnText}>{flow.confirm}</Text>
                </Pressable>
              </Animated.View>
            </View>
          </Modal>

          <Modal visible={showHistoryDateRangeModal} transparent animationType="none" onRequestClose={() => setShowHistoryDateRangeModal(false)}>
            <View style={[styles.modalBackdrop, styles.dropdownModalBackdrop]}>
              <Pressable style={styles.modalScrimTap} onPress={() => setShowHistoryDateRangeModal(false)} />
              <Animated.View style={[styles.modalCard, modalCardAnimatedStyle]}>
                <View style={styles.modalHandle} />
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{text.historyRangeTitle}</Text>
                  <Pressable style={styles.modalCloseBtn} onPress={() => setShowHistoryDateRangeModal(false)}>
                    <ThemedIonicons name="close" size={18} color={palette.text} />
                  </Pressable>
                </View>
                <View style={styles.historyRangePresetRow}>
                  <Pressable
                    style={[
                      styles.historyRangePresetChip,
                      styles.historyRangePresetChipFirst,
                      historyRangePresetDraft === 3 ? styles.historyRangePresetChipActive : undefined
                    ]}
                    onPress={() => applyHistoryPresetRange(3)}
                  >
                    <Text style={historyRangePresetDraft === 3 ? styles.historyRangePresetTextActive : styles.historyRangePresetText}>
                      {text.historyRangePreset3m}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.historyRangePresetChip,
                      styles.historyRangePresetChipMiddle,
                      historyRangePresetDraft === 6 ? styles.historyRangePresetChipActive : undefined
                    ]}
                    onPress={() => applyHistoryPresetRange(6)}
                  >
                    <Text style={historyRangePresetDraft === 6 ? styles.historyRangePresetTextActive : styles.historyRangePresetText}>
                      {text.historyRangePreset6m}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.historyRangePresetChip,
                      styles.historyRangePresetChipLast,
                      historyRangePresetDraft === 12 ? styles.historyRangePresetChipActive : undefined
                    ]}
                    onPress={() => applyHistoryPresetRange(12)}
                  >
                    <Text style={historyRangePresetDraft === 12 ? styles.historyRangePresetTextActive : styles.historyRangePresetText}>
                      {text.historyRangePreset1y}
                    </Text>
                  </Pressable>
                </View>
                <Pressable
                  style={[styles.historyRangeField, historyRangeDraftStart ? styles.historyRangeFieldActive : undefined]}
                  onPress={() => openHistoryRangeCalendar('start')}
                >
                  <Text style={[styles.historyRangeLabel, historyRangeDraftStart ? styles.historyRangeLabelActive : undefined]}>
                    {text.historyRangeStart}
                  </Text>
                  <Text style={[styles.historyRangeValue, historyRangeDraftStart ? styles.historyRangeValueActive : undefined]}>
                    {formatHistoryRangeLabel(historyRangeDraftStart)}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.historyRangeField, historyRangeDraftEnd ? styles.historyRangeFieldActive : undefined]}
                  onPress={() => openHistoryRangeCalendar('end')}
                >
                  <Text style={[styles.historyRangeLabel, historyRangeDraftEnd ? styles.historyRangeLabelActive : undefined]}>
                    {text.historyRangeEnd}
                  </Text>
                  <Text style={[styles.historyRangeValue, historyRangeDraftEnd ? styles.historyRangeValueActive : undefined]}>
                    {formatHistoryRangeLabel(historyRangeDraftEnd)}
                  </Text>
                </Pressable>
                <View style={styles.historyRangeActionRow}>
                  <Pressable style={[styles.historyRangeActionBtn, styles.historyRangeActionBtnGhost]} onPress={resetHistoryRange}>
                    <Text style={styles.historyRangeActionBtnGhostText}>{text.historyRangeReset}</Text>
                  </Pressable>
                  <Pressable style={[styles.historyRangeActionBtn, styles.historyRangeActionBtnPrimary]} onPress={applyHistoryRange}>
                    <Text style={styles.historyRangeActionBtnPrimaryText}>{text.historyRangeApply}</Text>
                  </Pressable>
                </View>
              </Animated.View>
            </View>
          </Modal>

          <Modal
            visible={showHistoryDateCalendarModal}
            transparent
            animationType="none"
            onRequestClose={() => setShowHistoryDateCalendarModal(false)}
          >
            <View style={[styles.modalBackdrop, styles.dropdownModalBackdrop]}>
              <Pressable style={styles.modalScrimTap} onPress={() => setShowHistoryDateCalendarModal(false)} />
              <Animated.View style={[styles.modalCard, modalCardAnimatedStyle]}>
                <View style={styles.modalHandle} />
                <View style={styles.historyCalendarTopRow}>
                  <Pressable
                    style={styles.historyCalendarNavBtn}
                    onPress={() => setHistoryCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                  >
                    <ThemedIonicons name="chevron-back" size={16} color={palette.text} />
                  </Pressable>
                  <Text style={styles.historyCalendarMonthText}>{historyCalendarMonthLabel}</Text>
                  <Pressable
                    style={styles.historyCalendarNavBtn}
                    onPress={() => setHistoryCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                  >
                    <ThemedIonicons name="chevron-forward" size={16} color={palette.text} />
                  </Pressable>
                </View>
                <View style={styles.historyCalendarWeekRow}>
                  {calendarWeekLabels.map((weekLabel) => (
                    <Text key={`week-${weekLabel}`} style={styles.historyCalendarWeekText}>
                      {weekLabel}
                    </Text>
                  ))}
                </View>
                <View style={styles.historyCalendarGrid}>
                  {historyCalendarCells.map((cell) => {
                    if (!cell.date) return <View key={cell.key} style={styles.historyCalendarDayCell} />;
                    const cellYmd = formatDateYmd(cell.date);
                    const isSelected = cellYmd === selectedHistoryCalendarYmd;
                    const isToday = cellYmd === todayYmd;
                    return (
                      <Pressable
                        key={cell.key}
                        style={[styles.historyCalendarDayCell, isSelected ? styles.historyCalendarDayCellSelected : undefined]}
                        onPress={() => onPickHistoryCalendarDate(cell.date as Date)}
                      >
                        <Text
                          style={[
                            styles.historyCalendarDayText,
                            isToday ? styles.historyCalendarDayTextToday : undefined,
                            isSelected ? styles.historyCalendarDayTextSelected : undefined
                          ]}
                        >
                          {cell.date.getDate()}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Animated.View>
            </View>
          </Modal>

          <Modal visible={showCameraScanner} animationType="slide" onRequestClose={() => setShowCameraScanner(false)}>
            <SafeAreaView style={styles.cameraScreen}>
              <View style={styles.cameraFrame}>
                <View style={styles.cameraHeader}>
                  <Pressable style={styles.backBtn} hitSlop={HEADER_BUTTON_HIT_SLOP} onPress={() => setShowCameraScanner(false)}>
                    <ThemedIonicons name="close" size={20} color={palette.text} style={styles.backBtnIconGlyph} />
                  </Pressable>
                  <Text style={styles.subHeaderTitle}>{extra.scan}</Text>
                  <View style={styles.subHeaderSpacer} />
                </View>
                <View style={styles.cameraViewWrap}>
                  <CameraView
                    style={styles.cameraView}
                    facing="back"
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    onBarcodeScanned={onCameraBarcodeScanned}
                  />
                </View>
              </View>
            </SafeAreaView>
          </Modal>

          {renderAppLockOverlay()}
          {showLaunchIntro ? (
            <View style={styles.launchIntroOverlay} pointerEvents="auto">
              <Animated.Image
                source={launchIntroLogoSource}
                style={[styles.launchIntroLogo, { opacity: launchIntroLogoOpacity }]}
                resizeMode="contain"
              />
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (palette: AppPalette, themeMode: ThemeMode, insets: EdgeInsets, viewportWidth: number) => {
  const iconContrastShadow = themeMode === 'dark' ? 'rgba(255,255,255,0.34)' : 'rgba(12,18,28,0.28)';
  const topSafeInset = Platform.OS === 'android' ? Math.max(insets.top, NativeStatusBar.currentHeight ?? 0, 24) : insets.top;
  const bottomSafeInset = Platform.OS === 'android' ? Math.max(insets.bottom, 24) : insets.bottom;
  const headerOverlayHeight = HEADER_OVERLAY_HEIGHT + topSafeInset;
  const headerTitleTop = topSafeInset + 17;
  const headerContentTopPad = headerOverlayHeight + 4;
  const formContentTopPad = headerOverlayHeight + 10;
  const screenHorizontalPad = 16;
  const bottomSafePad = bottomSafeInset + 12;
  const bottomDockHeight = 56;
  const bottomDockBottomOffset = Math.max(10, bottomSafeInset + 10);
  const scrollBottomPad = bottomDockHeight + bottomDockBottomOffset + 12;
  const modalBottomPad = bottomSafeInset + 12;
  const modalHorizontalPad = 12;
  const phoneShellMaxWidth = 430;
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: palette.bg
    },
    viewport: {
      flex: 1,
      backgroundColor: palette.bg,
      alignItems: 'center'
    },
    phoneShell: {
      flex: 1,
      width: '100%',
      maxWidth: phoneShellMaxWidth,
      backgroundColor: palette.bg,
      position: 'relative'
    },
    banner: {
      position: 'absolute',
      top: headerOverlayHeight + 8,
      left: 20,
      right: 20,
      zIndex: 50,
      backgroundColor: palette.panel,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: palette.accent,
      paddingVertical: 9,
      paddingHorizontal: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 8
    },
    bannerText: {
      color: palette.text,
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center'
    },
    launchIntroOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 1500,
      elevation: 1500,
      backgroundColor: '#000000',
      alignItems: 'center',
      justifyContent: 'center'
    },
    launchIntroLogo: {
      width: '22.7%',
      maxWidth: 107,
      minWidth: 64,
      aspectRatio: 291 / 370
    },
    appLockLayer: {
      flex: 1,
      backgroundColor: '#000000'
    },
    appLockSplashStage: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#000000'
    },
    appLockSplashLogo: {
      width: '22.7%',
      maxWidth: 107,
      minWidth: 64,
      aspectRatio: 291 / 370
    },
    appLockDimLayer: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.56)'
    },
    appLockBackdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingHorizontal: 20,
      paddingBottom: Math.max(64, bottomSafeInset + 44)
    },
    appLockCard: {
      width: '100%',
      maxWidth: 380,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: palette.accent,
      backgroundColor: themeMode === 'dark' ? 'rgba(23, 25, 28, 0.94)' : 'rgba(255, 255, 255, 0.96)',
      paddingHorizontal: 16,
      paddingVertical: 18
    },
    appLockIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: palette.accent,
      backgroundColor: palette.chip,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center'
    },
    appLockTitle: {
      marginTop: 12,
      color: palette.text,
      fontSize: 20,
      fontWeight: '800',
      textAlign: 'center'
    },
    appLockBody: {
      marginTop: 6,
      marginBottom: 0,
      color: palette.muted,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center'
    },
    appLockPasscodeBlock: {
      marginTop: 12,
      width: '100%',
      maxWidth: 336,
      alignSelf: 'center'
    },
    appLockPasscodeErrorSlot: {
      marginTop: 8,
      minHeight: 14
    },
    appLockPasscodePad: {
      marginTop: 2,
      width: '100%'
    },
    appLockBiometricArea: {
      marginTop: 12,
      minHeight: 54,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12
    },
    appLockInput: {
      marginBottom: 4
    },
    appLockBtn: {
      marginTop: 10,
      marginBottom: 0
    },
    screen: {
      flex: 1,
      backgroundColor: palette.bg
    },
    screenAboveBottomDock: {
      position: 'relative',
      zIndex: 45,
      elevation: 45
    },
    screenOverlayTransparent: {
      backgroundColor: 'transparent'
    },
    crashFallbackWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      backgroundColor: palette.bg
    },
    crashFallbackTitle: {
      color: palette.negative,
      fontSize: 18,
      fontWeight: '800',
      textAlign: 'center'
    },
    crashFallbackBody: {
      marginTop: 10,
      color: palette.text,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center'
    },
    scroll: {
      flex: 1
    },
    scrollPad: {
      paddingHorizontal: 16,
      paddingBottom: scrollBottomPad,
      paddingTop: headerContentTopPad
    },
    homeScrollPad: {
      paddingHorizontal: 16,
      paddingBottom: scrollBottomPad,
      paddingTop: headerContentTopPad
    },
    topHeader: {
      height: headerOverlayHeight,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: topSafeInset,
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 20,
      backgroundColor: 'transparent',
      overflow: 'visible'
    },
    subHeader: {
      height: headerOverlayHeight,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: topSafeInset,
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 20,
      backgroundColor: 'transparent',
      overflow: 'visible'
    },
    headerBackdrop: {
      ...StyleSheet.absoluteFillObject,
      top: -1,
      left: -1,
      right: -1,
      bottom: -1,
      overflow: 'hidden'
    },
    headerGradientLayer: {
      ...StyleSheet.absoluteFillObject
    },
    homeHeaderOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 20,
      backgroundColor: 'transparent'
    },
    homeHeaderOverlayOpen: {
      zIndex: 31,
      elevation: 14
    },
    subHeaderTitle: {
      color: palette.text,
      fontSize: 19,
      fontWeight: '700',
      textAlign: 'center',
      lineHeight: 22,
      includeFontPadding: false
    },
    topHeaderTitleLayer: {
      position: 'absolute',
      top: headerTitleTop,
      left: 0,
      right: 0,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1
    },
    topHeaderSide: {
      width: 116,
      flexDirection: 'row',
      alignItems: 'center',
      zIndex: 2
    },
    topHeaderSideRight: {
      justifyContent: 'flex-end'
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: palette.chip,
      borderWidth: 1,
      borderColor: palette.line,
      alignItems: 'center',
      justifyContent: 'center'
    },
    backBtnIconGlyph: {
      textAlign: 'center'
    },
    backBtnChevronGlyph: {},
    iconCircleBtnActive: {
      borderColor: palette.accent,
      backgroundColor: palette.accentSoft,
      shadowColor: palette.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4
    },
    iconGlyphContrast: {
      textShadowColor: iconContrastShadow,
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 1.4
    },
    subHeaderSpacer: {
      width: 38,
      height: 38
    },
    headerBtnGap: {
      marginLeft: 6
    },
    subHeaderIconBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: palette.chip,
      borderWidth: 1,
      borderColor: palette.line,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 6
    },
    headerTitle: {
      color: palette.text,
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.4
    },
    headerIconCircle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: palette.chip,
      borderWidth: 1,
      borderColor: palette.line,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 6
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      minWidth: 88,
      justifyContent: 'flex-end'
    },
    homeHeaderWrap: {
      marginTop: 4,
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 0
    },
    homeHeaderTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 52
    },
    homeSearchBox: {
      flex: 1,
      height: 42,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      marginTop: 12
    },
    homeSearchInput: {
      flex: 1,
      marginLeft: 8,
      color: palette.text,
      fontSize: 14,
      fontWeight: '500',
      paddingVertical: 0,
      outlineStyle: 'solid',
      outlineWidth: 0,
      outlineColor: 'transparent'
    },
    homeWalletPillCenterWrap: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: topSafeInset
    },
    homeWalletAnchor: {
      alignSelf: 'center'
    },
    homeWalletPillCenter: {
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14,
      minWidth: 168,
      maxWidth: 220,
      overflow: 'hidden'
    },
    homeWalletPillCenterActive: {
      borderColor: palette.accent,
      backgroundColor: palette.accentSoft,
      shadowColor: palette.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4
    },
    homeWalletPillText: {
      width: '100%',
      color: palette.text,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 20,
      includeFontPadding: true,
      textAlign: 'center',
      paddingRight: 16
    },
    homeWalletPillTextActive: {
      color: '#16110a'
    },
    homeWalletPillChevron: {
      position: 'absolute',
      right: 10
    },
    walletMenuScrim: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 29,
      backgroundColor: palette.overlay
    },
    walletMenuWrap: {
      position: 'absolute',
      left: 16,
      right: 16,
      top: headerOverlayHeight + 4,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.accent,
      backgroundColor: palette.panel,
      padding: 10,
      zIndex: 30,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 14,
      elevation: 10
    },
    walletMenuTitle: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 8
    },
    walletMenuList: {
      maxHeight: 210
    },
    walletMenuRow: {
      minHeight: 50,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      paddingHorizontal: 10,
      marginBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    walletMenuRowActive: {
      borderColor: palette.accent,
      backgroundColor: palette.accentSoft
    },
    walletMenuMeta: {
      flex: 1,
      minWidth: 0,
      marginRight: 12
    },
    walletMenuName: {
      color: palette.text,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
      includeFontPadding: true
    },
    walletMenuNameActive: {
      color: '#16110a'
    },
    walletMenuAddBtn: {
      alignSelf: 'center',
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2
    },
    walletCard: {
      backgroundColor: palette.panel,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: palette.line,
      paddingHorizontal: 16,
      paddingVertical: 16
    },
    homeBalanceWrap: {
      marginTop: 14,
      backgroundColor: 'transparent',
      paddingHorizontal: 0,
      paddingTop: 8,
      paddingBottom: 10,
      alignItems: 'center',
      height: 112
    },
    balanceLabel: {
      color: palette.muted,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 16,
      includeFontPadding: false,
      letterSpacing: 0.2
    },
    balanceAmountPress: {
      marginTop: 6,
      height: 56,
      minWidth: 240,
      alignItems: 'center',
      justifyContent: 'center'
    },
    balanceRowCenter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center'
    },
    balanceTextCenter: {
      color: palette.text,
      fontSize: 40,
      fontWeight: '800',
      lineHeight: 46,
      letterSpacing: -0.6,
      includeFontPadding: false
    },
    balanceTextMasked: {
      fontSize: 52,
      lineHeight: 52,
      letterSpacing: 1.3,
      transform: [{ translateY: -2 }],
      includeFontPadding: false
    },
    balanceChangeLine: {
      marginTop: 2,
      color: palette.positive,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 18,
      includeFontPadding: true
    },
    balanceRow: {
      flexDirection: 'row',
      alignItems: 'center'
    },
    balanceText: {
      color: palette.text,
      fontSize: 46,
      fontWeight: '800',
      lineHeight: 50
    },
    walletLine: {
      marginTop: 10
    },
    walletSwitcher: {
      flexDirection: 'row',
      alignItems: 'center',
      width: 130
    },
    walletSwitcherStatic: {
      flexDirection: 'row',
      alignItems: 'center',
      minWidth: 130
    },
    walletName: {
      color: palette.muted,
      fontSize: 17,
      fontWeight: '500',
      marginRight: 4
    },
    walletAddress: {
      marginTop: 8,
      color: palette.muted,
      fontSize: 14,
      fontWeight: '500'
    },
    quickActionRow: {
      marginTop: 18,
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'center'
    },
    quickActionItem: {
      width: 96,
      alignItems: 'center',
      marginHorizontal: 4
    },
    quickActionIconBox: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: palette.chip,
      borderWidth: 1,
      borderColor: palette.line,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8
    },
    quickActionText: {
      color: palette.text,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 16,
      includeFontPadding: true
    },
    actionRow: {
      marginTop: 14
    },
    actionChip: {
      width: 92,
      height: 38,
      borderRadius: 19,
      backgroundColor: palette.chip,
      borderWidth: 1,
      borderColor: palette.line,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8
    },
    actionChipText: {
      color: palette.text,
      fontSize: 14,
      fontWeight: '600'
    },
    assetPanel: {
      marginTop: 18,
      backgroundColor: 'transparent',
      borderRadius: 0,
      borderWidth: 0,
      overflow: 'visible'
    },
    homeAssetPanelOpen: {
      position: 'relative',
      zIndex: 46,
      elevation: 14
    },
    assetControlRow: {
      marginTop: 10,
      marginHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    assetControlTitle: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: '700'
    },
    manageAssetBtn: {
      height: 30,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10
    },
    manageAssetBtnText: {
      color: palette.text,
      fontSize: 12,
      fontWeight: '700',
      marginLeft: 4
    },
    segmentWrap: {
      marginTop: 2,
      height: 46,
      backgroundColor: palette.chip,
      flexDirection: 'row',
      padding: 2,
      borderRadius: 23,
      borderWidth: 1,
      borderColor: palette.line,
      position: 'relative',
      overflow: 'hidden'
    },
    segmentActivePill: {
      position: 'absolute',
      top: 2,
      bottom: 2,
      left: 2,
      borderRadius: 21,
      backgroundColor: palette.accent,
      zIndex: 0
    },
    segmentBtn: {
      flex: 1,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 0,
      zIndex: 1
    },
    segmentBtnActive: {
      backgroundColor: palette.accent
    },
    segmentText: {
      color: palette.muted,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 18,
      includeFontPadding: false
    },
    segmentTextActive: {
      color: '#111111',
      fontSize: 15,
      fontWeight: '900',
      lineHeight: 18,
      includeFontPadding: false
    },
    assetPanelToolsRow: {
      marginTop: 8,
      marginBottom: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end'
    },
    homeAssetToolsRowOpen: {
      position: 'relative',
      zIndex: 46,
      elevation: 14
    },
    assetPanelToolBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      alignItems: 'center',
      justifyContent: 'center'
    },
    assetPanelToolBtnGap: {
      marginLeft: 8
    },
    searchBox: {
      marginHorizontal: 12,
      marginTop: 12,
      height: 50,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12
    },
    searchInput: {
      flex: 1,
      color: palette.text,
      marginLeft: 8,
      fontSize: 14,
      paddingVertical: 0,
      outlineStyle: 'solid',
      outlineWidth: 0,
      outlineColor: 'transparent'
    },
    tokenList: {
      marginTop: 4
    },
    tokenRow: {
      height: 76,
      paddingHorizontal: 4,
      paddingVertical: 10,
      marginTop: 0,
      flexDirection: 'row',
      alignItems: 'center'
    },
    assetHero: {
      alignItems: 'center',
      marginTop: 2
    },
    assetHeroSymbol: {
      marginTop: 8,
      color: palette.text,
      fontSize: 22,
      fontWeight: '800'
    },
    assetHeroName: {
      marginTop: 2,
      color: palette.muted,
      fontSize: 13,
      fontWeight: '600'
    },
    assetHeroPrice: {
      marginTop: 8,
      color: palette.text,
      fontSize: 34,
      fontWeight: '800',
      letterSpacing: -0.4
    },
    assetHeroDelta: {
      marginTop: 4,
      fontSize: 14,
      fontWeight: '700'
    },
    assetChartCard: {
      marginTop: 12,
      minHeight: 248,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      paddingHorizontal: 10,
      paddingTop: 8,
      paddingBottom: 12
    },
    assetChartArea: {
      height: 178,
      borderRadius: 12,
      backgroundColor: palette.bg,
      borderWidth: 1,
      borderColor: palette.line,
      overflow: 'hidden'
    },
    assetChartSegment: {
      position: 'absolute',
      height: 2,
      borderRadius: 2
    },
    assetRangeRow: {
      marginTop: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    assetRangeChip: {
      minWidth: 42,
      height: 30,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      alignItems: 'center',
      justifyContent: 'center'
    },
    assetRangeChipActive: {
      borderColor: palette.accent,
      backgroundColor: palette.accentSoft
    },
    assetRangeChipText: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: '700'
    },
    assetRangeChipTextActive: {
      color: '#16110a',
      fontSize: 12,
      fontWeight: '800'
    },
    assetMarketCard: {
      marginTop: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      paddingHorizontal: 14,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    assetMarketLeft: {
      flex: 1,
      minWidth: 0,
      marginRight: 10
    },
    assetMarketKrw: {
      color: palette.text,
      fontSize: 32,
      fontWeight: '800',
      lineHeight: 34
    },
    assetMarketSub: {
      marginTop: 4,
      color: palette.muted,
      fontSize: 12,
      fontWeight: '600'
    },
    assetMarketBtn: {
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: palette.accent,
      backgroundColor: palette.accent,
      paddingHorizontal: 14,
      alignItems: 'center',
      justifyContent: 'center'
    },
    assetMarketBtnText: {
      color: '#16110a',
      fontSize: 12,
      fontWeight: '800'
    },
    assetSectionTitle: {
      marginTop: 16,
      marginBottom: 8,
      color: palette.text,
      fontSize: 16,
      fontWeight: '800'
    },
    assetValueCard: {
      minHeight: 60,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    assetValueAmount: {
      color: palette.text,
      fontSize: 17,
      fontWeight: '700'
    },
    assetValueUsd: {
      color: palette.text,
      fontSize: 18,
      fontWeight: '800'
    },
    assetActionRow: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    assetActionBtn: {
      width: '24%',
      alignItems: 'center'
    },
    assetActionIconWrap: {
      width: 46,
      height: 46,
      borderRadius: 23,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      alignItems: 'center',
      justifyContent: 'center'
    },
    assetActionLabel: {
      marginTop: 6,
      color: palette.text,
      fontSize: 12,
      fontWeight: '700'
    },
    assetInfoCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      paddingHorizontal: 12,
      paddingVertical: 12
    },
    assetInfoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap'
    },
    assetInfoCell: {
      width: '50%',
      paddingVertical: 8,
      paddingHorizontal: 2
    },
    assetInfoCellWide: {
      width: '100%'
    },
    assetInfoContractCell: {
      paddingTop: 0
    },
    assetInfoKey: {
      color: palette.muted,
      fontSize: 11,
      fontWeight: '600'
    },
    assetInfoValue: {
      marginTop: 3,
      color: palette.text,
      fontSize: 14,
      fontWeight: '700'
    },
    assetInfoToggle: {
      marginTop: 6,
      height: 30,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center'
    },
    assetInfoToggleText: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: '700',
      marginRight: 2
    },
    assetInfoExpandedBox: {
      marginTop: 8,
      borderTopWidth: 1,
      borderTopColor: palette.line,
      paddingTop: 8
    },
    assetLinkRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: -2
    },
    assetLinkChip: {
      height: 30,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      paddingHorizontal: 10,
      marginRight: 8,
      marginBottom: 8,
      flexDirection: 'row',
      alignItems: 'center'
    },
    assetLinkChipText: {
      marginLeft: 4,
      color: palette.text,
      fontSize: 12,
      fontWeight: '700'
    },
    tokenIconWrap: {
      width: 52,
      height: 52,
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center'
    },
    tokenIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center'
    },
    tokenIconImage: {
      width: 48,
      height: 48,
      borderRadius: 24
    },
    chainBadge: {
      position: 'absolute',
      top: 0,
      right: 0,
      minWidth: 15,
      height: 15,
      borderRadius: 8,
      paddingHorizontal: 3,
      backgroundColor: palette.accent,
      borderWidth: 1,
      borderColor: palette.bg,
      alignItems: 'center',
      justifyContent: 'center'
    },
    chainBadgeIconWrap: {
      minWidth: 16,
      width: 16,
      height: 16,
      borderRadius: 8,
      paddingHorizontal: 0,
      backgroundColor: 'transparent',
      borderWidth: 0
    },
    chainBadgeImage: {
      width: 15,
      height: 15,
      borderRadius: 8
    },
    chainBadgeImageIcon: {
      width: 16,
      height: 16,
      borderRadius: 8
    },
    chainBadgeText: {
      color: '#111111',
      fontSize: 9,
      fontWeight: '800',
      lineHeight: 10
    },
    tokenIconText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '800'
    },
    tokenMeta: {
      flex: 1,
      marginLeft: 12,
      minWidth: 0
    },
    tokenTopLine: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 24
    },
    tokenSymbol: {
      color: palette.text,
      fontSize: 15,
      fontWeight: '800',
      lineHeight: 18,
      includeFontPadding: false
    },
    tokenFavoriteBtn: {
      marginLeft: 6,
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      alignItems: 'center',
      justifyContent: 'center'
    },
    tokenFavoriteBtnActive: {
      borderColor: palette.accent,
      backgroundColor: palette.accentSoft
    },
    tokenNetworkChip: {
      marginLeft: 8,
      minWidth: 52,
      maxWidth: 88,
      height: 24,
      borderRadius: 12,
      backgroundColor: palette.chip,
      borderWidth: 1,
      borderColor: palette.line,
      paddingHorizontal: 8,
      justifyContent: 'center',
      alignSelf: 'flex-start'
    },
    tokenNetworkChipText: {
      color: palette.text,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 14,
      includeFontPadding: false,
      textAlign: 'center'
    },
    tokenSub: {
      color: palette.muted,
      fontSize: 14,
      marginTop: 2,
      lineHeight: 18,
      includeFontPadding: true
    },
    tokenChangeInline: {
      fontSize: 14,
      fontWeight: '700'
    },
    tokenValueCol: {
      alignItems: 'flex-end',
      marginLeft: 8,
      width: 112
    },
    tokenAmount: {
      color: palette.text,
      fontSize: 17,
      fontWeight: '800',
      marginTop: 1,
      lineHeight: 20,
      includeFontPadding: false
    },
    tokenAmountMasked: {
      fontSize: 28,
      lineHeight: 28,
      letterSpacing: 1,
      marginTop: 0,
      transform: [{ translateY: -1 }]
    },
    tokenUsd: {
      color: palette.muted,
      fontSize: 14,
      marginTop: 1,
      lineHeight: 16,
      includeFontPadding: false
    },
    tokenDeltaValue: {
      fontWeight: '700'
    },
    tokenUsdMasked: {
      fontSize: 18,
      lineHeight: 18,
      letterSpacing: 1,
      marginTop: 0,
      transform: [{ translateY: -1 }]
    },
    manageAssetsTextBtn: {
      marginTop: 10,
      marginBottom: 4,
      alignSelf: 'center',
      paddingVertical: 6,
      paddingHorizontal: 10
    },
    manageAssetsText: {
      color: palette.accent,
      fontSize: 16,
      fontWeight: '700'
    },
    nftEmpty: {
      paddingHorizontal: 12,
      paddingVertical: 18
    },
    nftEmptyTitle: {
      color: palette.text,
      fontSize: 17,
      fontWeight: '700'
    },
    nftEmptyBody: {
      marginTop: 8,
      color: palette.muted,
      fontSize: 13,
      lineHeight: 18
    },
    nftBtn: {
      marginTop: 12,
      height: 44,
      borderRadius: 22,
      backgroundColor: palette.accent,
      alignItems: 'center',
      justifyContent: 'center'
    },
    nftActionRow: {
      marginTop: 12,
      flexDirection: 'row',
      columnGap: 10
    },
    nftActionBtn: {
      flex: 1,
      marginTop: 0
    },
    nftBtnSecondary: {
      backgroundColor: palette.panel,
      borderWidth: 1,
      borderColor: palette.line
    },
    nftBtnText: {
      color: themeTextColor(palette),
      fontSize: 15,
      fontWeight: '700'
    },
    nftBtnSecondaryText: {
      color: palette.text
    },
    nftGrid: {
      borderRadius: 14,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginTop: 12
    },
    nftGridCard: {
      width: '48.2%',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      padding: 8,
      marginBottom: 10
    },
    nftGridImage: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel
    },
    nftGridName: {
      marginTop: 7,
      color: palette.text,
      fontSize: 13,
      fontWeight: '700'
    },
    nftGridSub: {
      color: palette.muted,
      fontSize: 11,
      marginTop: 2
    },
    nftGridBottom: {
      marginTop: 6,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    nftGridOwned: {
      color: palette.muted,
      fontSize: 11,
      fontWeight: '700'
    },
    nftGridPrice: {
      color: palette.text,
      fontSize: 12,
      fontWeight: '800'
    },
    nftPrice: {
      color: palette.text,
      fontSize: 13,
      fontWeight: '700'
    },
    nftSelectCard: {
      width: 115,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      padding: 7,
      marginRight: 7
    },
    nftSelectCardActive: {
      borderColor: palette.accent,
      shadowColor: palette.accent,
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 0 }
    },
    nftSelectImage: {
      width: '100%',
      height: 63,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel
    },
    nftSelectMeta: {
      marginTop: 5
    },
    nftSelectName: {
      color: palette.text,
      fontSize: 13,
      fontWeight: '700'
    },
    nftSelectTokenId: {
      marginTop: 2
    },
    nftSelectSub: {
      marginTop: 3,
      color: palette.muted,
      fontSize: 11,
      fontWeight: '600'
    },
    nftSendPreviewCard: {
      marginTop: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center'
    },
    nftSendPreviewImage: {
      width: 62,
      height: 62,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip
    },
    nftSendPreviewMeta: {
      flex: 1,
      marginLeft: 10,
      marginRight: 8
    },
    nftSendPreviewTitle: {
      color: palette.text,
      fontSize: 14,
      fontWeight: '800'
    },
    nftSendPreviewSub: {
      marginTop: 3,
      color: palette.muted,
      fontSize: 12,
      fontWeight: '600'
    },
    nftRecipientFieldGap: {
      marginTop: 6
    },
    nftRecipientBlock: {
      marginTop: 16
    },
    nftDetailCard: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      padding: 12
    },
    nftDetailImage: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip
    },
    nftDetailName: {
      marginTop: 10,
      color: palette.text,
      fontSize: 18,
      fontWeight: '800'
    },
    nftDetailCollection: {
      marginTop: 4,
      color: palette.muted,
      fontSize: 13,
      fontWeight: '600'
    },
    nftDetailInfoCard: {
      marginTop: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      paddingHorizontal: 12,
      paddingVertical: 6
    },
    nftDetailInfoRow: {
      minHeight: 38,
      borderTopWidth: 1,
      borderTopColor: palette.line,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    nftDetailInfoRowFirst: {
      borderTopWidth: 0
    },
    emptyText: {
      textAlign: 'center',
      color: palette.muted,
      fontSize: 13,
      paddingVertical: 20
    },
    primaryBtn: {
      marginTop: 16,
      height: 50,
      borderRadius: 25,
      backgroundColor: palette.accent,
      alignItems: 'center',
      justifyContent: 'center'
    },
    addressBookAddBtn: {
      marginBottom: 12
    },
    primaryBtnText: {
      color: themeTextColor(palette),
      fontSize: 16,
      fontWeight: '800',
      lineHeight: 20,
      includeFontPadding: true
    },
    hotList: {
      marginTop: 14,
      borderRadius: 18,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel
    },
    hotRow: {
      minHeight: 72,
      borderTopWidth: 1,
      borderTopColor: palette.line,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    hotLeft: {
      flexDirection: 'row',
      alignItems: 'center'
    },
    hotIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: palette.chip,
      borderWidth: 1,
      borderColor: palette.line,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10
    },
    hotIconText: {
      color: palette.text,
      fontSize: 13,
      fontWeight: '700'
    },
    hotSymbol: {
      color: palette.text,
      fontSize: 15,
      fontWeight: '700'
    },
    hotMeta: {
      color: palette.muted,
      fontSize: 12,
      marginTop: 2
    },
    hotRight: {
      alignItems: 'flex-end'
    },
    hotPrice: {
      color: palette.text,
      fontSize: 14,
      fontWeight: '700'
    },
    hotChange: {
      fontSize: 12,
      marginTop: 2,
      fontWeight: '700'
    },
    earnCard: {
      marginTop: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      padding: 14
    },
    earnTag: {
      alignSelf: 'flex-start',
      height: 24,
      borderRadius: 8,
      backgroundColor: palette.chip,
      paddingHorizontal: 10,
      justifyContent: 'center'
    },
    earnTagText: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: '700'
    },
    earnTitle: {
      marginTop: 10,
      color: palette.text,
      fontSize: 19,
      fontWeight: '800'
    },
    earnSummary: {
      marginTop: 6,
      color: palette.muted,
      fontSize: 13,
      lineHeight: 18
    },
    earnBtn: {
      marginTop: 12,
      height: 40,
      borderRadius: 20,
      backgroundColor: palette.chip,
      borderWidth: 1,
      borderColor: palette.line,
      alignItems: 'center',
      justifyContent: 'center'
    },
    earnBtnText: {
      color: palette.text,
      fontSize: 14,
      fontWeight: '700'
    },
    earnComingSoonCard: {
      marginTop: 18,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      paddingHorizontal: 16,
      paddingVertical: 18,
      alignItems: 'center'
    },
    earnComingSoonIconWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      alignItems: 'center',
      justifyContent: 'center'
    },
    earnComingSoonTitle: {
      marginTop: 12,
      color: palette.text,
      fontSize: 18,
      fontWeight: '800',
      lineHeight: 22,
      includeFontPadding: false
    },
    earnComingSoonBody: {
      marginTop: 8,
      color: palette.muted,
      fontSize: 13,
      lineHeight: 19,
      includeFontPadding: false,
      textAlign: 'center'
    },
    heroRow: {
      marginTop: 10
    },
    heroCard: {
      width: 318,
      minHeight: 130,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginRight: 12
    },
    heroTag: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: '700'
    },
    heroTitle: {
      marginTop: 7,
      color: palette.text,
      fontSize: 20,
      fontWeight: '800',
      lineHeight: 24
    },
    heroDesc: {
      marginTop: 6,
      color: palette.muted,
      fontSize: 12,
      lineHeight: 16
    },
    heroBtn: {
      marginTop: 10,
      alignSelf: 'flex-start',
      height: 30,
      borderRadius: 15,
      backgroundColor: palette.chip,
      borderWidth: 1,
      borderColor: palette.line,
      paddingHorizontal: 12,
      justifyContent: 'center'
    },
    heroBtnText: {
      color: palette.text,
      fontSize: 13,
      fontWeight: '700'
    },
    sectionTitle: {
      color: palette.text,
      fontSize: 24,
      fontWeight: '800'
    },
    discoverHintText: {
      marginTop: 8,
      color: palette.muted,
      fontSize: 12,
      fontWeight: '600'
    },
    discoverSearchRow: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center'
    },
    discoverSearchInputBox: {
      flex: 1,
      height: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12
    },
    discoverSearchInput: {
      flex: 1,
      marginLeft: 8,
      color: palette.text,
      fontSize: 14,
      fontWeight: '600',
      paddingVertical: 0,
      outlineStyle: 'solid',
      outlineWidth: 0,
      outlineColor: 'transparent'
    },
    discoverSearchBadge: {
      marginLeft: 8,
      width: 34,
      height: 34,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      alignItems: 'center',
      justifyContent: 'center'
    },
    discoverSearchBadgeText: {
      color: palette.text,
      fontSize: 14,
      fontWeight: '800',
      lineHeight: 16,
      includeFontPadding: false
    },
    discoverQuickRow: {
      marginTop: 8,
      marginBottom: 2
    },
    discoverQuickChip: {
      height: 32,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 11,
      marginRight: 8
    },
    discoverQuickChipActive: {
      borderColor: palette.accent,
      backgroundColor: palette.accent
    },
    discoverQuickChipText: {
      marginLeft: 5,
      color: palette.text,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 14,
      includeFontPadding: false
    },
    discoverQuickChipTextActive: {
      marginLeft: 5,
      color: '#111214',
      fontSize: 12,
      fontWeight: '800',
      lineHeight: 14,
      includeFontPadding: false
    },
    discoverFeatureCard: {
      marginTop: 10,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      paddingHorizontal: 14,
      paddingVertical: 14
    },
    discoverFeatureTag: {
      color: palette.accent,
      fontSize: 11,
      fontWeight: '800',
      lineHeight: 14,
      includeFontPadding: false
    },
    discoverFeatureTitle: {
      marginTop: 6,
      color: palette.text,
      fontSize: 30,
      fontWeight: '900',
      lineHeight: 34,
      letterSpacing: -0.4,
      includeFontPadding: false
    },
    discoverFeatureBody: {
      marginTop: 6,
      color: palette.muted,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600'
    },
    discoverFeatureBtn: {
      marginTop: 12,
      alignSelf: 'flex-start',
      height: 30,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: palette.accent,
      backgroundColor: palette.accent,
      paddingHorizontal: 12,
      justifyContent: 'center'
    },
    discoverFeatureBtnText: {
      color: '#16110a',
      fontSize: 12,
      fontWeight: '800',
      lineHeight: 14,
      includeFontPadding: true
    },
    discoverSectionHead: {
      marginTop: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    discoverSectionArrowBtn: {
      height: 26,
      width: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center'
    },
    discoverSectionLink: {
      color: palette.muted,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 16,
      includeFontPadding: false
    },
    discoverRankingMetaRow: {
      marginTop: 8,
      marginBottom: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 2
    },
    discoverRankingMetaText: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 15,
      includeFontPadding: false
    },
    discoverEarnCard: {
      marginTop: 8,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      paddingHorizontal: 14,
      paddingVertical: 14
    },
    discoverEarnLabel: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 15,
      includeFontPadding: false
    },
    discoverEarnValue: {
      marginTop: 5,
      color: palette.text,
      fontSize: 46,
      fontWeight: '900',
      lineHeight: 48,
      letterSpacing: -1,
      includeFontPadding: false
    },
    discoverEarnSummary: {
      marginTop: 4,
      color: palette.muted,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
      includeFontPadding: false
    },
    discoverBlockCard: {
      marginTop: 8,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      paddingHorizontal: 12,
      paddingVertical: 10
    },
    discoverEmptyCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      paddingHorizontal: 12,
      paddingVertical: 12,
      marginTop: 10
    },
    discoverCardViewAll: {
      marginTop: 8,
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center'
    },
    discoverCardViewAllText: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 15,
      includeFontPadding: false,
      marginRight: 3
    },
    discoverDappRow: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 9
    },
    discoverDappRowBorder: {
      borderTopWidth: 1,
      borderTopColor: palette.line
    },
    discoverDappRank: {
      width: 18,
      color: palette.muted,
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'center'
    },
    discoverDappIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
      overflow: 'hidden'
    },
    discoverDappIconImageLayer: {
      position: 'absolute',
      top: 1,
      right: 1,
      bottom: 1,
      left: 1,
      borderRadius: 17,
      overflow: 'hidden',
      borderWidth: 0,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center'
    },
    discoverDappIconImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover'
    },
    discoverMarketTokenIconWrap: {
      width: 36,
      height: 36,
      minWidth: 36,
      maxWidth: 36,
      minHeight: 36,
      maxHeight: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      marginLeft: 8,
      overflow: 'hidden'
    },
    discoverMarketTokenIconImageLayer: {
      position: 'absolute',
      top: 1,
      right: 1,
      bottom: 1,
      left: 1,
      borderRadius: 17,
      overflow: 'hidden',
      borderWidth: 0,
      borderColor: 'transparent',
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center'
    },
    discoverMarketTokenIconImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover'
    },
    discoverDappIconText: {
      color: palette.text,
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 16,
      includeFontPadding: false
    },
    discoverDappMeta: {
      flex: 1,
      minWidth: 0,
      marginLeft: 10,
      marginRight: 8
    },
    discoverDappName: {
      color: palette.text,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 20,
      includeFontPadding: false
    },
    discoverDappNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minWidth: 0
    },
    discoverDappAlias: {
      marginLeft: 6,
      color: palette.muted,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '600',
      includeFontPadding: false,
      flexShrink: 1
    },
    discoverDappDesc: {
      marginTop: 2,
      color: palette.muted,
      fontSize: 12,
      lineHeight: 16,
      includeFontPadding: false
    },
    discoverMarketRow: {
      minHeight: 70,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 9
    },
    discoverMarketRowBorder: {
      borderTopWidth: 1,
      borderTopColor: palette.line
    },
    discoverPopularRank: {
      width: 24,
      marginRight: 6,
      color: palette.muted,
      fontSize: 14,
      fontWeight: '800',
      lineHeight: 18,
      textAlign: 'center',
      includeFontPadding: false
    },
    discoverMarketLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      minWidth: 0,
      paddingRight: 8
    },
    discoverMarketMeta: {
      marginLeft: 10,
      flex: 1,
      minWidth: 0
    },
    discoverMarketName: {
      color: palette.text,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 19,
      includeFontPadding: false
    },
    discoverMarketSub: {
      marginTop: 3,
      color: palette.muted,
      fontSize: 12,
      lineHeight: 16,
      includeFontPadding: false
    },
    discoverMarketRight: {
      minWidth: 84,
      alignItems: 'flex-end'
    },
    discoverMarketPriceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end'
    },
    discoverMarketPrice: {
      color: palette.text,
      fontSize: 18,
      fontWeight: '800',
      lineHeight: 22,
      letterSpacing: -0.2,
      includeFontPadding: false
    },
    discoverMarketFavoriteBtn: {
      width: 22,
      height: 22,
      borderRadius: 11,
      marginLeft: 4,
      alignItems: 'center',
      justifyContent: 'center'
    },
    discoverMarketChange: {
      marginTop: 2,
      fontSize: 14,
      fontWeight: '800',
      lineHeight: 18,
      includeFontPadding: false
    },
    discoverMarketMetricHint: {
      marginTop: 1,
      color: palette.accent,
      fontSize: 9,
      fontWeight: '700',
      lineHeight: 11,
      includeFontPadding: false,
      textAlign: 'right'
    },
    discoverMarketMetricHintLeft: {
      marginTop: 1,
      color: palette.accent,
      fontSize: 9,
      fontWeight: '700',
      lineHeight: 11,
      includeFontPadding: false,
      textAlign: 'left',
      alignSelf: 'flex-start'
    },
    discoverPopularPagination: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    modalPaginationCompact: {
      marginTop: 2,
      marginBottom: 2
    },
    addressBookPagination: {
      marginTop: 8,
      marginBottom: 4
    },
    discoverPopularPageBtn: {
      minWidth: 102,
      height: 38,
      borderRadius: 19,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center'
    },
    discoverPopularPageBtnDisabled: {
      opacity: 0.45
    },
    discoverPopularPageBtnText: {
      color: palette.text,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 16,
      includeFontPadding: true
    },
    discoverPopularPageBtnTextDisabled: {
      color: palette.muted
    },
    discoverPopularPageBadge: {
      height: 38,
      minWidth: 90,
      borderRadius: 19,
      borderWidth: 1,
      borderColor: palette.accent,
      backgroundColor: palette.panel,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14
    },
    discoverPopularPageBadgeText: {
      color: palette.text,
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 16,
      includeFontPadding: false
    },
    discoverBriefingIntroCard: {
      marginTop: 8,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      paddingHorizontal: 14,
      paddingVertical: 12
    },
    discoverBriefingIntroTitle: {
      color: palette.text,
      fontSize: 16,
      fontWeight: '800',
      lineHeight: 20,
      includeFontPadding: false
    },
    discoverBriefingIntroBody: {
      marginTop: 4,
      color: palette.muted,
      fontSize: 12,
      lineHeight: 16,
      includeFontPadding: false
    },
    discoverBriefingWeekWrap: {
      marginTop: 12,
      position: 'relative',
      alignItems: 'center',
      zIndex: 8
    },
    discoverBriefingWeekWrapOpen: {
      zIndex: 26
    },
    discoverBriefingMenuScrim: {
      position: 'absolute',
      left: -16,
      right: -16,
      top: 0,
      bottom: -scrollBottomPad,
      zIndex: 21,
      backgroundColor: palette.overlay
    },
    discoverBriefingWeekLabel: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 15,
      includeFontPadding: false
    },
    discoverBriefingWeekScroll: {
      marginTop: 8
    },
    discoverBriefingWeekScrollContent: {
      paddingRight: 8
    },
    discoverBriefingWeekBtn: {
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      minWidth: 168,
      paddingHorizontal: 14,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden'
    },
    discoverBriefingWeekBtnActive: {
      borderColor: palette.accent,
      backgroundColor: palette.accentSoft,
      shadowColor: palette.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4
    },
    discoverBriefingWeekBtnText: {
      width: '100%',
      color: palette.text,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 18,
      includeFontPadding: true,
      textAlign: 'center',
      paddingRight: 16
    },
    discoverBriefingWeekBtnTextActive: {
      color: '#16110a'
    },
    discoverBriefingWeekBtnChevron: {
      position: 'absolute',
      right: 10
    },
    discoverBriefingWeekMenu: {
      position: 'absolute',
      top: 44,
      left: '50%',
      width: 168,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.accent,
      backgroundColor: palette.panel,
      overflow: 'hidden',
      shadowColor: '#000000',
      shadowOpacity: 0.22,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10
    },
    discoverBriefingWeekMenuFloating: {
      zIndex: 50,
      elevation: 14
    },
    discoverBriefingWeekItem: {
      minHeight: 39,
      borderBottomWidth: 1,
      borderBottomColor: palette.line,
      paddingHorizontal: 12,
      justifyContent: 'center'
    },
    discoverBriefingWeekItemActive: {
      backgroundColor: palette.accent
    },
    discoverBriefingWeekItemText: {
      color: palette.muted,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 16,
      includeFontPadding: false
    },
    discoverBriefingWeekItemTextActive: {
      color: '#16110a'
    },
    discoverBriefingWeekChip: {
      height: 32,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8
    },
    discoverBriefingWeekChipActive: {
      borderColor: palette.accent,
      backgroundColor: palette.accent
    },
    discoverBriefingWeekChipText: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 15,
      includeFontPadding: false
    },
    discoverBriefingWeekChipTextActive: {
      color: '#111111'
    },
    discoverBriefingBlurredArea: {
      opacity: 0.38
    },
    discoverBriefingCard: {
      marginTop: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      paddingHorizontal: 14,
      paddingVertical: 12
    },
    discoverBriefingCardCollapsed: {
      height: 196
    },
    discoverBriefingCardExpanded: {
      borderColor: palette.accent,
      backgroundColor: palette.card,
      shadowColor: '#000000',
      shadowOpacity: themeMode === 'dark' ? 0.35 : 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3
    },
    discoverBriefingCardBlurred: {
      opacity: 0.32
    },
    discoverBriefingHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    discoverBriefingHeadLeft: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center'
    },
    discoverBriefingDate: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 15,
      includeFontPadding: false
    },
    discoverBriefingIssueChip: {
      marginLeft: 7,
      height: 20,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      paddingHorizontal: 8,
      alignItems: 'center',
      justifyContent: 'center'
    },
    discoverBriefingIssueText: {
      color: palette.muted,
      fontSize: 11,
      fontWeight: '800',
      lineHeight: 13,
      includeFontPadding: false
    },
    discoverBriefingLatestChip: {
      marginLeft: 7,
      height: 20,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.accent,
      backgroundColor: palette.accentSoft,
      paddingHorizontal: 8,
      alignItems: 'center',
      justifyContent: 'center'
    },
    discoverBriefingLatestText: {
      color: '#111111',
      fontSize: 11,
      fontWeight: '800',
      lineHeight: 13,
      includeFontPadding: false
    },
    discoverBriefingToggleBtn: {
      marginLeft: 8,
      minWidth: 88,
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      paddingHorizontal: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center'
    },
    discoverBriefingToggleBtnActive: {
      borderColor: palette.accent,
      backgroundColor: palette.accent
    },
    discoverBriefingToggleText: {
      color: palette.muted,
      fontSize: 11,
      fontWeight: '800',
      lineHeight: 13,
      includeFontPadding: false,
      marginRight: 4
    },
    discoverBriefingToggleTextActive: {
      color: '#16110a'
    },
    discoverBriefingTitle: {
      marginTop: 8,
      color: palette.text,
      fontSize: 16,
      fontWeight: '800',
      lineHeight: 20,
      includeFontPadding: false,
      minHeight: 40
    },
    discoverBriefingSummary: {
      marginTop: 5,
      color: palette.muted,
      fontSize: 12,
      lineHeight: 16,
      includeFontPadding: false
    },
    discoverBriefingSummaryCollapsed: {
      minHeight: 80
    },
    discoverBriefingExpandedBody: {
      marginTop: 2
    },
    discoverBriefingLongParagraph: {
      marginTop: 8,
      color: palette.text,
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 18,
      includeFontPadding: false
    },
    discoverBriefingPoint: {
      marginTop: 6,
      color: palette.text,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 17,
      includeFontPadding: false
    },
    discoverBriefingSourcesWrap: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: palette.line
    },
    discoverBriefingSourcesLabel: {
      color: palette.muted,
      fontSize: 11,
      fontWeight: '800',
      lineHeight: 14,
      includeFontPadding: false
    },
    discoverBriefingSourceLink: {
      marginTop: 6,
      color: palette.accent,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
      includeFontPadding: false
    },
    discoverTickerIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      alignItems: 'center',
      justifyContent: 'center'
    },
    discoverTickerIconText: {
      color: palette.text,
      fontSize: 11,
      fontWeight: '800',
      lineHeight: 13,
      includeFontPadding: false
    },
    discoverWatchTitleRow: {
      flexDirection: 'row',
      alignItems: 'center'
    },
    discoverWatchLevChip: {
      marginLeft: 6,
      height: 20,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      paddingHorizontal: 8,
      alignItems: 'center',
      justifyContent: 'center'
    },
    discoverWatchLevText: {
      color: palette.muted,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 13,
      includeFontPadding: false
    },
    discoverSiteRow: {
      minHeight: 60,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 9
    },
    discoverSiteMeta: {
      flex: 1,
      minWidth: 0,
      paddingRight: 8
    },
    discoverSiteName: {
      color: palette.text,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 18,
      includeFontPadding: false
    },
    discoverSiteDomain: {
      marginTop: 2,
      color: palette.muted,
      fontSize: 12,
      lineHeight: 16,
      includeFontPadding: false
    },
    discoverLatestRow: {
      minHeight: 66,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10
    },
    discoverLatestIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      alignItems: 'center',
      justifyContent: 'center'
    },
    discoverLatestMeta: {
      marginLeft: 10,
      flex: 1,
      minWidth: 0
    },
    discoverLatestTitle: {
      color: palette.text,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 18,
      includeFontPadding: false
    },
    discoverLatestSub: {
      marginTop: 2,
      color: palette.muted,
      fontSize: 12,
      lineHeight: 16,
      includeFontPadding: false
    },
    discoverLatestLink: {
      marginLeft: 8,
      color: palette.accent,
      fontSize: 12,
      fontWeight: '800',
      lineHeight: 16,
      includeFontPadding: false
    },
    discoverBrowserShell: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: formContentTopPad,
      paddingBottom: bottomSafePad
    },
    discoverBrowserUrlRow: {
      flexDirection: 'row',
      alignItems: 'center'
    },
    discoverBrowserUrlInput: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      color: palette.text,
      fontSize: 13,
      paddingHorizontal: 12
    },
    discoverBrowserGoBtn: {
      marginLeft: 8,
      minWidth: 66,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.accent,
      backgroundColor: palette.accent,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14
    },
    discoverBrowserGoBtnText: {
      color: '#111111',
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 16,
      includeFontPadding: true
    },
    discoverBrowserTabRow: {
      marginTop: 10,
      minHeight: 36,
      maxHeight: 36
    },
    discoverBrowserTabChip: {
      height: 32,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      paddingLeft: 12,
      paddingRight: 8,
      marginRight: 8,
      flexDirection: 'row',
      alignItems: 'center',
      maxWidth: 220
    },
    discoverBrowserTabChipActive: {
      backgroundColor: palette.accentSoft,
      borderColor: palette.accent
    },
    discoverBrowserTabChipText: {
      flexShrink: 1,
      color: palette.text,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 14,
      includeFontPadding: false
    },
    discoverBrowserTabChipTextActive: {
      flexShrink: 1,
      color: '#111111',
      fontSize: 12,
      fontWeight: '800',
      lineHeight: 14,
      includeFontPadding: false
    },
    discoverBrowserTabCloseBtn: {
      marginLeft: 6,
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center'
    },
    discoverSecurityBanner: {
      marginTop: 10,
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'flex-start'
    },
    discoverSecurityBannerSafe: {
      borderColor: palette.positive,
      backgroundColor: themeMode === 'dark' ? 'rgba(56, 193, 114, 0.14)' : 'rgba(22, 163, 74, 0.1)'
    },
    discoverSecurityBannerCaution: {
      borderColor: palette.accent,
      backgroundColor: palette.accentSoft
    },
    discoverSecurityBannerHigh: {
      borderColor: palette.negative,
      backgroundColor: themeMode === 'dark' ? 'rgba(255, 91, 91, 0.14)' : 'rgba(220, 38, 38, 0.1)'
    },
    discoverSecurityBannerMeta: {
      marginLeft: 8,
      flex: 1,
      minWidth: 0
    },
    discoverSecurityBannerTitle: {
      color: palette.text,
      fontSize: 12,
      fontWeight: '800',
      lineHeight: 16,
      includeFontPadding: false
    },
    discoverSecurityBannerBody: {
      marginTop: 2,
      color: palette.muted,
      fontSize: 11,
      lineHeight: 15,
      includeFontPadding: false
    },
    discoverBrowserFrameCard: {
      flex: 1,
      marginTop: 10,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      overflow: 'hidden'
    },
    discoverBrowserWebView: {
      flex: 1,
      backgroundColor: themeMode === 'dark' ? '#0f1115' : '#ffffff'
    },
    discoverBrowserActionBtn: {
      flex: 1,
      height: 44
    },
    discoverTabListActionWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 8
    },
    discoverTabListActionBtn: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 6
    },
    latestItem: {
      marginTop: 10,
      flexDirection: 'row',
      alignItems: 'center'
    },
    discoverItem: {
      marginTop: 11,
      flexDirection: 'row',
      alignItems: 'center'
    },
    discoverIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      alignItems: 'center',
      justifyContent: 'center'
    },
    discoverIconText: {
      color: palette.text,
      fontSize: 10,
      fontWeight: '700'
    },
    discoverMeta: {
      marginLeft: 12,
      flex: 1,
      minWidth: 0
    },
    discoverName: {
      color: palette.text,
      fontSize: 16,
      fontWeight: '700'
    },
    discoverDesc: {
      marginTop: 2,
      color: palette.muted,
      fontSize: 12,
      lineHeight: 16
    },
    discoverSubMeta: {
      marginTop: 5,
      color: palette.muted,
      fontSize: 11,
      fontWeight: '600'
    },
    categoryRow: {
      marginTop: 10
    },
    categoryChip: {
      minWidth: 72,
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      paddingHorizontal: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8
    },
    categoryChipActive: {
      backgroundColor: palette.accentSoft
    },
    categoryText: {
      color: palette.muted,
      fontSize: 14,
      fontWeight: '600'
    },
    categoryTextActive: {
      color: '#111111',
      fontSize: 14,
      fontWeight: '700'
    },
    topTokenRow: {
      marginTop: 10,
      flexDirection: 'row',
      alignItems: 'center'
    },
    manageRow: {
      minHeight: 66,
      borderRadius: 0,
      borderWidth: 0,
      borderColor: 'transparent',
      backgroundColor: 'transparent',
      paddingHorizontal: 12,
      marginBottom: 2,
      flexDirection: 'row',
      alignItems: 'center'
    },
    manageMeta: {
      flex: 1,
      marginLeft: 10,
      minWidth: 0
    },
    manageSymbol: {
      color: palette.text,
      fontSize: 15,
      fontWeight: '700'
    },
    manageName: {
      color: palette.muted,
      fontSize: 12,
      marginTop: 2
    },
    manageFavoriteBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8
    },
    manageFavoriteBtnActive: {
      borderColor: palette.accent,
      backgroundColor: palette.accentSoft
    },
    assetSwitchTrack: {
      width: ASSET_SWITCH_TRACK_WIDTH,
      height: ASSET_SWITCH_TRACK_HEIGHT,
      borderRadius: ASSET_SWITCH_TRACK_HEIGHT / 2,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      position: 'relative',
      justifyContent: 'center',
      overflow: 'hidden'
    },
    assetSwitchTrackOn: {
      backgroundColor: palette.accent
    },
    assetSwitchTrackOff: {
      backgroundColor: palette.chip
    },
    assetSwitchLabelWrap: {
      position: 'absolute',
      top: 0,
      right: ASSET_SWITCH_LABEL_INSET,
      bottom: 0,
      left: ASSET_SWITCH_LABEL_INSET,
      justifyContent: 'center'
    },
    assetSwitchLabelOn: {
      color: '#111111',
      fontSize: 11,
      fontWeight: '800',
      textAlign: 'left',
      lineHeight: 14,
      includeFontPadding: false
    },
    assetSwitchLabelOff: {
      color: palette.muted,
      fontSize: 11,
      fontWeight: '800',
      textAlign: 'right',
      lineHeight: 14,
      includeFontPadding: false
    },
    assetSwitchThumb: {
      position: 'absolute',
      width: ASSET_SWITCH_THUMB_SIZE,
      height: ASSET_SWITCH_THUMB_SIZE,
      borderRadius: ASSET_SWITCH_THUMB_SIZE / 2,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: '#ffffff',
      alignItems: 'center',
      justifyContent: 'center'
    },
    assetSwitchThumbOn: {
      left: ASSET_SWITCH_INSET + ASSET_SWITCH_TRAVEL,
      backgroundColor: '#ffffff'
    },
    assetSwitchThumbOff: {
      left: ASSET_SWITCH_INSET,
      backgroundColor: '#ffffff'
    },
    settingSectionTitle: {
      color: palette.muted,
      fontSize: 18,
      fontWeight: '700',
      lineHeight: 22,
      includeFontPadding: true,
      marginTop: 16,
      marginBottom: 8
    },
    settingRow: {
      height: 54,
      borderRadius: 0,
      borderWidth: 0,
      borderColor: 'transparent',
      backgroundColor: 'transparent',
      borderBottomWidth: 0,
      borderBottomColor: 'transparent',
      paddingHorizontal: 14,
      marginBottom: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    discoverTrustedGuideText: {
      color: palette.muted,
      fontSize: 12,
      lineHeight: 17,
      includeFontPadding: false,
      marginBottom: 10
    },
    discoverTrustedInputRow: {
      height: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      paddingLeft: 12,
      paddingRight: 6,
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8
    },
    discoverTrustedInput: {
      flex: 1,
      minWidth: 0,
      color: palette.text,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 16,
      includeFontPadding: false,
      borderWidth: 0,
      backgroundColor: 'transparent',
      paddingHorizontal: 0,
      paddingVertical: 0
    },
    discoverTrustedAddBtn: {
      minWidth: 56,
      height: 32,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.accent,
      backgroundColor: palette.accent,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12
    },
    discoverTrustedAddBtnText: {
      color: '#16110a',
      fontSize: 12,
      fontWeight: '800',
      lineHeight: 14,
      includeFontPadding: true
    },
    discoverTrustedRowMeta: {
      flex: 1,
      minWidth: 0,
      marginRight: 8
    },
    discoverTrustedRowHint: {
      marginTop: 2,
      color: palette.muted,
      fontSize: 11,
      fontWeight: '600',
      lineHeight: 14,
      includeFontPadding: false
    },
    discoverTrustedListWrap: {
      marginTop: 2
    },
    discoverTrustedEntryCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 8
    },
    discoverTrustedEntryHead: {
      flexDirection: 'row',
      alignItems: 'center'
    },
    discoverTrustedEntryHost: {
      flex: 1,
      minWidth: 0,
      color: palette.text,
      fontSize: 14,
      fontWeight: '800',
      lineHeight: 18,
      includeFontPadding: false
    },
    discoverTrustedEntryMemo: {
      marginTop: 4,
      color: palette.muted,
      fontSize: 12,
      lineHeight: 16,
      includeFontPadding: false
    },
    discoverTrustedEntryDate: {
      marginTop: 5,
      color: palette.muted,
      fontSize: 11,
      lineHeight: 14,
      includeFontPadding: false
    },
    discoverTrustedEmptyText: {
      color: palette.muted,
      fontSize: 12,
      lineHeight: 16,
      includeFontPadding: false,
      paddingHorizontal: 14,
      paddingVertical: 8
    },
    discoverTrustedBuiltinCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 10
    },
    discoverTrustedBuiltinItem: {
      color: palette.muted,
      fontSize: 12,
      lineHeight: 16,
      includeFontPadding: false
    },
    settingRowActive: {
      backgroundColor: 'transparent'
    },
    walletSelectArea: {
      flex: 1,
      minHeight: 54,
      justifyContent: 'center',
      marginRight: 8
    },
    walletDeleteBtn: {
      marginLeft: 8
    },
    walletDeleteTargetCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 10
    },
    walletDeleteTargetCardCompact: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      paddingHorizontal: 11,
      paddingVertical: 9,
      marginBottom: 10
    },
    walletDeleteTargetLabel: {
      color: palette.muted,
      fontSize: 11,
      fontWeight: '700'
    },
    walletDeleteTargetName: {
      marginTop: 2,
      color: palette.text,
      fontSize: 15,
      fontWeight: '800'
    },
    walletDeleteTargetAddress: {
      marginTop: 2,
      color: palette.muted,
      fontSize: 12,
      fontWeight: '600'
    },
    walletDeleteWarningCard: {
      borderRadius: 13,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      minHeight: 44,
      paddingHorizontal: 11,
      flexDirection: 'row',
      alignItems: 'center'
    },
    walletDeleteWarningText: {
      marginLeft: 8,
      flex: 1,
      color: palette.muted,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16
    },
    walletDeleteConfirmBtn: {
      backgroundColor: palette.negative
    },
    settingLabel: {
      color: palette.text,
      fontSize: 15,
      fontWeight: '600',
      lineHeight: 20,
      includeFontPadding: true,
      maxWidth: 190,
      flexShrink: 1
    },
    settingValue: {
      color: palette.muted,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
      includeFontPadding: true,
      width: 84,
      textAlign: 'right'
    },
    settingHint: {
      marginTop: 2,
      color: palette.muted,
      fontSize: 12
    },
    settingThemeSwitch: {
      width: THEME_SWITCH_TRACK_WIDTH,
      height: THEME_SWITCH_TRACK_HEIGHT,
      borderRadius: THEME_SWITCH_TRACK_HEIGHT / 2,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      padding: THEME_SWITCH_INSET,
      position: 'relative',
      overflow: 'hidden',
      flexDirection: 'row',
      alignItems: 'center'
    },
    settingThemeActivePill: {
      position: 'absolute',
      top: THEME_SWITCH_INSET,
      bottom: THEME_SWITCH_INSET,
      borderRadius: (THEME_SWITCH_TRACK_HEIGHT - THEME_SWITCH_INSET * 2) / 2,
      backgroundColor: palette.accent
    },
    settingThemeBtn: {
      flex: 1,
      height: THEME_SWITCH_TRACK_HEIGHT - THEME_SWITCH_INSET * 2,
      borderRadius: (THEME_SWITCH_TRACK_HEIGHT - THEME_SWITCH_INSET * 2) / 2,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1
    },
    settingThemeBtnActive: {
      backgroundColor: palette.accent
    },
    settingThemeBtnText: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 14,
      includeFontPadding: true
    },
    settingThemeBtnTextActive: {
      color: '#16110a',
      fontSize: 12,
      fontWeight: '800',
      lineHeight: 14,
      includeFontPadding: true
    },
    settingRowLang: {
      overflow: 'visible',
      zIndex: 10
    },
    dropdownTriggerMenuWrap: {
      position: 'relative',
      overflow: 'visible'
    },
    dropdownTriggerMenuWrapOpen: {
      position: 'relative',
      overflow: 'visible',
      zIndex: 32,
      elevation: 14
    },
    settingsScrollContent: {
      position: 'relative',
      flexGrow: 1
    },
    langBtn: {
      width: 124,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center'
    },
    langBtnActive: {
      borderColor: palette.accent,
      backgroundColor: palette.accentSoft,
      shadowColor: palette.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.24,
      shadowRadius: 6,
      elevation: 3
    },
    langBtnText: {
      color: palette.text,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 18,
      includeFontPadding: true,
      marginRight: 4
    },
    langBtnTextActive: {
      color: '#16110a'
    },
    langMenu: {
      position: 'absolute',
      right: 14,
      top: 48,
      width: 124,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.accent,
      backgroundColor: palette.panel,
      overflow: 'hidden',
      zIndex: 30,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 14,
      elevation: 10
    },
    langMenuFloating: {
      position: 'absolute',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.accent,
      backgroundColor: palette.panel,
      overflow: 'hidden',
      zIndex: 50,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 14,
      elevation: 14
    },
    langItem: {
      height: 38,
      alignItems: 'center',
      justifyContent: 'center'
    },
    langItemDivider: {
      borderBottomWidth: 1,
      borderBottomColor: palette.line
    },
    langItemLast: {
      borderBottomWidth: 0
    },
    langItemActive: {
      backgroundColor: palette.accent
    },
    langItemText: {
      color: palette.muted,
      fontSize: 14,
      fontWeight: '600'
    },
    langItemTextActive: {
      color: '#16110a',
      fontSize: 14,
      fontWeight: '800'
    },
    themeSegmentWrap: {
      height: 54,
      borderRadius: 24,
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderColor: 'transparent',
      flexDirection: 'row',
      padding: 0
    },
    themeSegmentBtn: {
      flex: 1,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center'
    },
    themeSegmentBtnActive: {
      backgroundColor: 'transparent'
    },
    themeSegmentText: {
      color: palette.muted,
      fontSize: 15,
      fontWeight: '700'
    },
    themeSegmentTextActive: {
      color: '#111111',
      fontSize: 15,
      fontWeight: '800'
    },
    toggleRow: {
      minHeight: 54,
      borderRadius: 0,
      borderWidth: 0,
      borderColor: 'transparent',
      backgroundColor: 'transparent',
      borderBottomWidth: 0,
      borderBottomColor: 'transparent',
      paddingHorizontal: 14,
      marginBottom: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    securityInfoRow: {
      minHeight: 54,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      overflow: 'visible'
    },
    securityPickerRow: {
      position: 'relative'
    },
    securityPickerRowTop: {
      zIndex: 10
    },
    securityPickerRowMiddle: {
      zIndex: 9
    },
    securityPickerRowBottom: {
      zIndex: 8
    },
    dropdownTriggerRaised: {
      position: 'relative',
      zIndex: 32,
      elevation: 14
    },
    securityDropdownMenu: {
      right: 0,
      top: 42,
      width: 124
    },
    securityDropdownScrim: {
      backgroundColor: 'transparent'
    },
    securityInfoRight: {
      flexDirection: 'row',
      alignItems: 'center'
    },
    securityInfoValue: {
      color: palette.muted,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 16,
      includeFontPadding: false,
      marginRight: 6
    },
    securityOptionMenu: {
      marginHorizontal: 14,
      marginBottom: 6,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      overflow: 'hidden'
    },
    securityOptionRow: {
      minHeight: 44,
      paddingHorizontal: 12,
      justifyContent: 'center',
      borderBottomWidth: 1,
      borderBottomColor: palette.line
    },
    securityOptionRowActive: {
      backgroundColor: palette.accentSoft
    },
    securityOptionText: {
      color: palette.text,
      fontSize: 13,
      fontWeight: '600'
    },
    securityOptionTextActive: {
      color: '#111111',
      fontSize: 13,
      fontWeight: '800'
    },
    securityLabelWrap: {
      flex: 1,
      marginRight: 10
    },
    securityHintText: {
      marginTop: 3,
      color: palette.muted,
      fontSize: 11,
      fontWeight: '600',
      lineHeight: 14,
      includeFontPadding: false
    },
    securityDivider: {
      marginHorizontal: 14,
      marginVertical: 8,
      height: 1,
      backgroundColor: palette.line
    },
    securityLinkRow: {
      minHeight: 50,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    toggleTrack: {
      width: 48,
      height: 28,
      borderRadius: 14,
      backgroundColor: palette.line,
      padding: 3
    },
    toggleTrackOn: {
      backgroundColor: palette.accent
    },
    toggleThumb: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: '#ffffff'
    },
    toggleThumbOn: {
      marginLeft: 20
    },
    singleWrap: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: formContentTopPad,
      paddingBottom: bottomSafePad
    },
    infoCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      padding: 14
    },
    infoTitle: {
      color: palette.text,
      fontSize: 15,
      fontWeight: '800',
      lineHeight: 20,
      includeFontPadding: false,
      marginBottom: 6
    },
    infoBody: {
      color: palette.muted,
      fontSize: 14,
      lineHeight: 20
    },
    infoSubBody: {
      marginTop: 8,
      color: palette.muted,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600'
    },
    rowBtnWrap: {
      marginTop: 10,
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: 8
    },
    supportChatWrap: {
      flex: 1,
      paddingTop: formContentTopPad,
      paddingHorizontal: 16,
      paddingBottom: bottomSafePad
    },
    supportChatListPad: {
      paddingBottom: bottomSafePad
    },
    supportBubbleRow: {
      marginBottom: 10,
      flexDirection: 'row'
    },
    supportBubbleRowUser: {
      justifyContent: 'flex-end'
    },
    supportBubble: {
      maxWidth: '82%',
      borderRadius: 14,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 9
    },
    supportBubbleAgent: {
      borderColor: palette.line,
      backgroundColor: palette.panel
    },
    supportBubbleUser: {
      borderColor: palette.accent,
      backgroundColor: palette.accentSoft
    },
    supportBubbleImage: {
      width: 180,
      height: 180,
      borderRadius: 10,
      marginBottom: 8
    },
    supportBubbleTextAgent: {
      color: palette.text,
      fontSize: 13,
      lineHeight: 18
    },
    supportBubbleTextUser: {
      color: '#111111',
      fontSize: 13,
      lineHeight: 18
    },
    supportComposerPreviewRow: {
      alignSelf: 'flex-start',
      width: 88,
      height: 88,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      padding: 4,
      marginBottom: 8,
      position: 'relative'
    },
    supportComposerPreviewImage: {
      width: '100%',
      height: '100%',
      borderRadius: 9
    },
    supportComposerPreviewRemove: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      alignItems: 'center',
      justifyContent: 'center'
    },
    supportComposerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 48
    },
    supportComposerIconBtn: {
      width: 46,
      height: 48,
      borderRadius: 23,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      alignItems: 'center',
      justifyContent: 'center'
    },
    supportComposerIconBtnText: {
      color: palette.muted,
      fontSize: 10,
      fontWeight: '700',
      marginTop: 2
    },
    supportComposerInput: {
      flex: 1,
      marginHorizontal: 8,
      height: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      color: palette.text,
      fontSize: 14,
      paddingHorizontal: 12,
      paddingVertical: 0
    },
    supportComposerSendBtn: {
      width: 64,
      height: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.accent,
      backgroundColor: palette.accent,
      alignItems: 'center',
      justifyContent: 'center'
    },
    supportComposerSendBtnDisabled: {
      backgroundColor: palette.chip,
      borderColor: palette.line
    },
    supportComposerSendText: {
      color: '#111111',
      fontSize: 13,
      fontWeight: '800'
    },
    supportComposerSendTextDisabled: {
      color: palette.muted
    },
    formWrap: {
      flex: 1,
      paddingHorizontal: screenHorizontalPad,
      paddingTop: formContentTopPad,
      paddingBottom: bottomSafePad
    },
    onboardingFormScrollPad: {
      paddingHorizontal: screenHorizontalPad,
      paddingTop: formContentTopPad,
      paddingBottom: bottomSafePad
    },
    fieldLabel: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 14,
      includeFontPadding: true,
      marginBottom: 8
    },
    fieldLabelTight: {
      marginBottom: 0
    },
    addressBookFieldTopGap: {
      marginTop: 8
    },
    sendFieldBlock: {
      marginBottom: 10
    },
    onboardingFieldBlock: {
      marginBottom: 10
    },
    onboardingSeedFieldBlock: {
      marginBottom: 0
    },
    sendScreenBody: {
      flex: 1,
      position: 'relative'
    },
    homeHeaderDropdownScrim: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: headerContentTopPad,
      zIndex: 21
    },
    homeScrollContentWrap: {
      position: 'relative',
      minHeight: '100%'
    },
    homeAssetLayoutDropdownScrim: {
      position: 'absolute',
      left: -16,
      right: -16,
      top: 0,
      bottom: -scrollBottomPad,
      zIndex: 38
    },
    sendHeaderScrim: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: headerContentTopPad,
      zIndex: 42,
      overflow: 'hidden'
    },
    sendScrollContentWrap: {
      position: 'relative',
      minHeight: '100%'
    },
    sendDropdownScrim: {
      position: 'absolute',
      left: -16,
      right: -16,
      top: 0,
      bottom: -scrollBottomPad,
      zIndex: 38,
      overflow: 'hidden'
    },
    sendScrimOverlay: {
      backgroundColor: palette.overlay
    },
    globalDropdownScrim: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 48,
      backgroundColor: palette.overlay
    },
    globalDropdownScrimTransparent: {
      backgroundColor: 'transparent'
    },
    globalDropdownLayer: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 49
    },
    globalWalletMenuWrap: {
      zIndex: 50,
      elevation: 120
    },
    globalRecentOverlayTrigger: {
      position: 'absolute',
      zIndex: 50
    },
    globalRecentOverlayList: {
      position: 'absolute',
      marginTop: 0,
      marginBottom: 0,
      borderColor: palette.line,
      maxHeight: Math.max(148, 300 - bottomSafeInset - (bottomDockHeight + bottomDockBottomOffset)),
      zIndex: 50,
      elevation: 120
    },
    globalBottomRecentOverlayList: {
      maxHeight: Math.max(200, 380 - bottomSafeInset),
      marginBottom: 0
    },
    globalBottomRecentOverlayWrap: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 50,
      elevation: 120,
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingHorizontal: modalHorizontalPad,
      paddingBottom: modalBottomPad
    },
    sendRecentFieldBlockOpen: {
      position: 'relative',
      zIndex: 44
    },
    fieldHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8
    },
    fieldHeaderActions: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingRight: 10.8
    },
    fieldHeaderActionGap: {
      marginLeft: 6
    },
    fieldHeaderActionStart: {
      marginLeft: 6
    },
    saveAddressIconBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      alignItems: 'center',
      justifyContent: 'center'
    },
    fieldRow: {
      marginTop: 4,
      marginBottom: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    fieldInput: {
      height: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      color: palette.text,
      fontSize: 14,
      paddingHorizontal: 12,
      marginBottom: 12,
      outlineStyle: 'solid',
      outlineWidth: 0,
      outlineColor: 'transparent'
    },
    onboardingFieldInput: {
      marginBottom: 0
    },
    fieldInputReadonly: {
      color: palette.muted
    },
    fieldInputMultiline: {
      minHeight: 90,
      textAlignVertical: 'top',
      paddingTop: 12
    },
    fieldInputError: {
      borderColor: palette.negative
    },
    fieldInputFocus: {
      borderColor: palette.accent
    },
    fieldBoxError: {
      borderColor: palette.negative
    },
    fieldBoxFocus: {
      borderColor: palette.accent
    },
    fieldOverlayHost: {
      position: 'relative'
    },
    fieldDisabledOverlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      borderRadius: 12,
      zIndex: 20
    },
    fieldDisabledOverlayInputOnly: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 112,
      borderRadius: 12,
      zIndex: 20
    },
    fieldErrorSlot: {
      minHeight: 18,
      marginTop: 6,
      justifyContent: 'center'
    },
    sendFieldErrorSlot: {
      minHeight: 14,
      marginTop: 2,
      justifyContent: 'flex-start'
    },
    fieldErrorText: {
      color: palette.negative,
      fontSize: 11,
      fontWeight: '600',
      lineHeight: 14,
      includeFontPadding: false
    },
    fieldErrorTextHidden: {
      opacity: 0
    },
    onboardingPasscodeBlock: {
      width: '100%',
      maxWidth: 336,
      alignSelf: 'center',
      marginBottom: 10
    },
    onboardingSetPasswordTop: {
      flex: 1,
      justifyContent: 'center'
    },
    onboardingSetPasswordBottom: {
      marginTop: 'auto'
    },
    onboardingPasscodeLabel: {
      width: '100%',
      maxWidth: 336
    },
    onboardingPasscodeErrorSlot: {
      width: '100%',
      maxWidth: 336,
      alignSelf: 'center'
    },
    passcodeLayout: {
      flex: 1
    },
    passcodeCenter: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: Math.max(10, bottomSafeInset + 10)
    },
    passcodeBottom: {
      marginTop: 'auto',
      paddingBottom: Math.max(6, bottomSafeInset)
    },
    passcodeTitle: {
      color: palette.text,
      fontSize: 22,
      fontWeight: '800',
      lineHeight: 28,
      includeFontPadding: false,
      textAlign: 'center',
      marginBottom: 14
    },
    passcodeErrorSlotHidden: {
      minHeight: 0,
      marginTop: 0
    },
    passcodeBoxesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      maxWidth: 336
    },
    passcodeBox: {
      width: 44,
      height: 52,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      alignItems: 'center',
      justifyContent: 'center'
    },
    passcodeBoxFilled: {
      borderColor: palette.line
    },
    passcodeBoxActive: {
      borderColor: palette.accent,
      shadowColor: palette.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.28,
      shadowRadius: 6,
      elevation: 2
    },
    passcodeBoxError: {
      borderColor: palette.negative
    },
    passcodeDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: palette.text
    },
    passcodePad: {
      marginTop: 4,
      marginBottom: 0
    },
    passcodePadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8
    },
    passcodePadKey: {
      width: '31.6%',
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6
    },
    passcodePadKeyDisabled: {
      opacity: 0.45
    },
    passcodePadKeyText: {
      color: palette.text,
      fontSize: 22,
      fontWeight: '800'
    },
    passcodePadActionText: {
      color: palette.text,
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center'
    },
    passcodePadActionTextDisabled: {
      color: palette.muted
    },
    inlineGhostBtn: {
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10
    },
    inlineGhostBtnText: {
      color: palette.text,
      fontSize: 11,
      fontWeight: '700',
      marginLeft: 5
    },
    iconOptionChip: {
      width: 56,
      height: 66,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 6,
      marginBottom: 8
    },
    iconOptionChipCompact: {
      width: 32,
      height: 32,
      borderRadius: 16,
      marginRight: 8,
      marginBottom: 0
    },
    iconOptionChipActive: {
      borderColor: palette.accent,
      borderWidth: 1.8,
      backgroundColor: palette.accentSoft,
      shadowColor: palette.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.24,
      shadowRadius: 5,
      elevation: 3
    },
    iconOptionImage: {
      width: 24,
      height: 24,
      borderRadius: 12
    },
    iconOptionImageCompact: {
      width: 24,
      height: 24,
      borderRadius: 12
    },
    iconOptionTicker: {
      marginTop: 6,
      color: palette.muted,
      fontSize: 9,
      fontWeight: '800'
    },
    iconOptionTickerActive: {
      marginTop: 6,
      color: '#111111',
      fontSize: 9,
      fontWeight: '900'
    },
    optionChip: {
      minWidth: 72,
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      marginRight: 8,
      marginBottom: 10
    },
    optionChipActive: {
      borderColor: palette.accent,
      borderWidth: 1.3,
      backgroundColor: palette.accentSoft
    },
    optionChipText: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: '700'
    },
    optionChipTextActive: {
      color: '#111111',
      fontSize: 12,
      fontWeight: '800'
    },
    recipientList: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      marginBottom: 10,
      overflow: 'hidden'
    },
    recentSummaryBtn: {
      minHeight: 52,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      marginBottom: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    recentSummaryBtnActive: {
      borderColor: palette.accent,
      backgroundColor: palette.accentSoft,
      shadowColor: palette.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 3
    },
    recentSummaryMeta: {
      flex: 1,
      minWidth: 0,
      marginRight: 8
    },
    recipientRow: {
      minHeight: 52,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: palette.line,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    recipientMeta: {
      flex: 1,
      minWidth: 0,
      marginRight: 8
    },
    recipientPrimary: {
      color: palette.text,
      fontSize: 12,
      fontWeight: '700'
    },
    recipientSecondary: {
      color: palette.muted,
      fontSize: 11,
      marginTop: 2
    },
    recipientSecondaryAccent: {
      color: palette.accent,
      fontSize: 11,
      fontWeight: '700'
    },
    recentSummaryPrimaryActive: {
      color: '#16110a'
    },
    recentSummarySecondaryActive: {
      color: 'rgba(22, 17, 10, 0.88)'
    },
    recentSummarySecondaryAccentActive: {
      color: '#9f4f1d'
    },
    recipientDate: {
      color: palette.muted,
      fontSize: 11,
      fontWeight: '600'
    },
    emptyInline: {
      color: palette.muted,
      fontSize: 12,
      marginBottom: 10
    },
    recipientInputRow: {
      height: 50,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      marginBottom: 0,
      overflow: 'hidden'
    },
    recipientInputField: {
      flex: 1,
      color: palette.text,
      fontSize: 15,
      paddingVertical: 0,
      paddingRight: 8,
      outlineStyle: 'solid',
      outlineWidth: 0,
      outlineColor: 'transparent'
    },
    recipientActions: {
      flexDirection: 'row',
      alignItems: 'center'
    },
    recipientActionBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 6
    },
    saveAddressBtn: {
      marginTop: -6,
      marginBottom: 10,
      alignSelf: 'flex-end',
      height: 32,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10
    },
    saveAddressBtnText: {
      color: palette.text,
      fontSize: 12,
      fontWeight: '700',
      marginLeft: 6
    },
    sendRecentSummaryBtn: {
      minHeight: 50,
      borderColor: palette.line,
      marginBottom: 0
    },
    sendRecentAnchor: {
      position: 'relative',
      zIndex: 1
    },
    sendRecentAnchorOpen: {
      zIndex: 120,
      elevation: 120
    },
    scanTriggerBtnOpen: {
      position: 'relative',
      zIndex: 120,
      elevation: 120
    },
    scanNonTriggerDimmed: {
      opacity: themeMode === 'dark' ? 0.38 : 0.46
    },
    sendRecentList: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 58,
      marginTop: 0,
      borderColor: palette.line,
      marginBottom: 0,
      maxHeight: Math.max(148, 300 - bottomSafeInset - (bottomDockHeight + bottomDockBottomOffset)),
      zIndex: 120,
      elevation: 120
    },
    sendRecentListActive: {
      borderColor: palette.accent,
      shadowColor: palette.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 3
    },
    sendEmptyInline: {
      marginBottom: 0
    },
    sendAmountRow: {
      alignItems: 'center'
    },
    amountHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8
    },
    amountAvailableHint: {
      flex: 1,
      minWidth: 0,
      marginLeft: 8,
      color: palette.muted,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 14,
      includeFontPadding: false,
      textAlign: 'right'
    },
    amountUsdInline: {
      width: 98,
      marginLeft: 8,
      color: palette.muted,
      fontSize: 11,
      fontWeight: '700',
      textAlign: 'right'
    },
    sendMemoInput: {
      marginBottom: 0
    },
    authModeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12
    },
    authModeChip: {
      flex: 1,
      height: 38,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8
    },
    authModeChipActive: {
      borderColor: palette.accent,
      borderWidth: 1.3,
      backgroundColor: palette.accentSoft
    },
    authModeText: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: '700'
    },
    authModeTextActive: {
      color: '#111111',
      fontSize: 12,
      fontWeight: '800'
    },
    authMethodText: {
      color: palette.text,
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 12
    },
    authHintText: {
      color: palette.muted,
      fontSize: 12,
      marginBottom: 12
    },
    authCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      padding: 18,
      alignItems: 'center',
      marginBottom: 12
    },
    authCardTitle: {
      marginTop: 10,
      color: palette.text,
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 6
    },
    sendConfirmAmountCard: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      padding: 14,
      marginBottom: 10
    },
    sendConfirmTokenRow: {
      flexDirection: 'row',
      alignItems: 'center'
    },
    sendConfirmNftImage: {
      width: 48,
      height: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip
    },
    sendConfirmNftPlaceholder: {
      width: 48,
      height: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      alignItems: 'center',
      justifyContent: 'center'
    },
    sendConfirmTokenMeta: {
      marginLeft: 12
    },
    sendConfirmUsd: {
      color: palette.text,
      fontSize: 30,
      fontWeight: '800'
    },
    sendConfirmAmount: {
      marginTop: 2,
      color: palette.muted,
      fontSize: 20,
      fontWeight: '700'
    },
    sendConfirmDetailCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 10
    },
    sendConfirmDetailRow: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    sendConfirmLabel: {
      color: palette.muted,
      fontSize: 13,
      fontWeight: '600',
      marginRight: 8
    },
    sendConfirmValue: {
      color: palette.text,
      fontSize: 14,
      fontWeight: '700',
      flexShrink: 1,
      textAlign: 'right'
    },
    sendConfirmTotalCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      minHeight: 62,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10
    },
    sendConfirmTotalValue: {
      color: palette.text,
      fontSize: 28,
      fontWeight: '800'
    },
    processingHeader: {
      height: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      marginTop: 4
    },
    processingWrap: {
      flex: 1,
      paddingHorizontal: 16,
      justifyContent: 'center'
    },
    processingIconWrap: {
      width: 132,
      height: 132,
      borderRadius: 66,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: 18
    },
    processingTitle: {
      color: palette.text,
      fontSize: 32,
      fontWeight: '900',
      textAlign: 'center'
    },
    processingBody: {
      marginTop: 10,
      color: palette.muted,
      fontSize: 16,
      lineHeight: 24,
      textAlign: 'center',
      marginBottom: 22
    },
    txDetailAmount: {
      marginTop: 4,
      color: palette.text,
      fontSize: 46,
      fontWeight: '800',
      textAlign: 'center'
    },
    txDetailUsd: {
      marginTop: 6,
      marginBottom: 14,
      color: palette.muted,
      fontSize: 26,
      fontWeight: '700',
      textAlign: 'center'
    },
    txDetailCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 10
    },
    txHashRow: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    txHashMeta: {
      flex: 1,
      minWidth: 0,
      marginRight: 8
    },
    txHashValue: {
      marginTop: 3,
      color: palette.text,
      fontSize: 13,
      fontWeight: '700'
    },
    txCopyBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      alignItems: 'center',
      justifyContent: 'center'
    },
    txDetailActions: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
      marginBottom: 6
    },
    txActionBtn: {
      flex: 1,
      minHeight: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8
    },
    txActionBtnText: {
      marginLeft: 6,
      color: palette.text,
      fontSize: 13,
      fontWeight: '700'
    },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'center'
    },
    dualBtnRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10
    },
    dualBtn: {
      flex: 1,
      marginTop: 0
    },
    amountInput: {
      flex: 1,
      marginBottom: 0
    },
    maxBtn: {
      marginLeft: 8,
      width: 62,
      height: 50,
      borderRadius: 25,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      alignItems: 'center',
      justifyContent: 'center'
    },
    maxBtnText: {
      color: palette.text,
      fontSize: 13,
      fontWeight: '700'
    },
    feeText: {
      color: palette.muted,
      fontSize: 12,
      marginTop: 10
    },
    qrBox: {
      width: 236,
      height: 236,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginTop: 28,
      padding: 12
    },
    qrImageFrame: {
      width: '100%',
      height: '100%',
      borderRadius: 18,
      backgroundColor: '#ffffff',
      padding: 14,
      alignItems: 'center',
      justifyContent: 'center'
    },
    qrImage: {
      width: '100%',
      height: '100%',
      borderRadius: 10,
      backgroundColor: '#ffffff'
    },
    qrEmptyText: {
      color: palette.muted,
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'center',
      lineHeight: 20,
      paddingHorizontal: 18,
      includeFontPadding: false
    },
    receiveAddress: {
      marginTop: 16,
      color: palette.text,
      fontSize: 13,
      textAlign: 'center'
    },
    receiveQrActionBtn: {
      marginTop: 8,
      height: 42,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      width: '62%',
      minWidth: 190,
      maxWidth: 250
    },
    receiveQrActionBtnText: {
      color: palette.text,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 16,
      includeFontPadding: true
    },
    rowActions: {
      flexDirection: 'row',
      alignItems: 'center'
    },
    rowActionBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 6
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: palette.overlay,
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingHorizontal: modalHorizontalPad,
      paddingBottom: modalBottomPad
    },
    dropdownModalBackdrop: {
      backgroundColor: 'transparent'
    },
    modalScrimTap: {
      ...StyleSheet.absoluteFillObject
    },
    modalCard: {
      width: '100%',
      maxWidth: phoneShellMaxWidth,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: palette.accent,
      backgroundColor: palette.panel,
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.22,
      shadowRadius: 24,
      elevation: 12
    },
    modalHandle: {
      alignSelf: 'center',
      width: 44,
      height: 4,
      borderRadius: 2,
      backgroundColor: palette.line,
      marginBottom: 10
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 2
    },
    modalTitle: {
      color: palette.text,
      fontSize: 17,
      fontWeight: '800'
    },
    modalCloseBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.line,
      alignItems: 'center',
      justifyContent: 'center'
    },
    modalList: {
      maxHeight: 320,
      marginTop: 10,
      marginBottom: 12
    },
    modalRow: {
      minHeight: 56,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      paddingHorizontal: 10,
      marginBottom: 8,
      flexDirection: 'row',
      alignItems: 'center'
    },
    modalRowIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.line,
      alignItems: 'center',
      justifyContent: 'center'
    },
    modalRowMeta: {
      flex: 1,
      minWidth: 0,
      marginLeft: 10,
      marginRight: 10
    },
    modalPrimary: {
      color: palette.text,
      fontSize: 13,
      fontWeight: '700'
    },
    modalSecondary: {
      marginTop: 2,
      color: palette.muted,
      fontSize: 11
    },
    modalEmptyText: {
      color: palette.muted,
      fontSize: 12,
      marginTop: 12,
      marginBottom: 14
    },
    modalActionGroup: {
      marginTop: 10
    },
    modalActionBtn: {
      minHeight: 52,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      marginTop: 10
    },
    modalActionBtnCentered: {
      justifyContent: 'center'
    },
    modalActionIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.line,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10
    },
    modalActionIconInline: {
      marginRight: 8
    },
    modalActionBtnText: {
      flex: 1,
      color: palette.text,
      fontSize: 14,
      fontWeight: '700'
    },
    modalActionBtnPrimary: {
      backgroundColor: palette.accent,
      borderColor: palette.accent
    },
    modalActionBtnPrimaryText: {
      flex: 1,
      color: '#16110a',
      fontSize: 14,
      fontWeight: '800'
    },
    modalActionBtnPrimaryTextCentered: {
      flex: 0,
      textAlign: 'center'
    },
    modalActionBtnPrimaryLabelInline: {
      flexShrink: 0,
      color: '#16110a',
      fontSize: 14,
      fontWeight: '800',
      lineHeight: 20,
      includeFontPadding: true,
      textAlign: 'left'
    },
    modalActionBtnGhost: {
      justifyContent: 'center'
    },
    modalActionBtnGhostText: {
      textAlign: 'center',
      color: palette.muted
    },
    saveRecipientModalInput: {
      marginBottom: 10
    },
    saveRecipientModalInputLast: {
      marginBottom: 6
    },
    saveRecipientModalActions: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: 8
    },
    saveRecipientModalActionBtn: {
      flex: 1,
      marginTop: 0
    },
    saveRecipientModalActionBtnText: {
      textAlign: 'center'
    },
    discoverSecurityPromptMessage: {
      marginTop: 10,
      color: palette.muted,
      fontSize: 13,
      lineHeight: 18,
      includeFontPadding: false
    },
    discoverSecurityPromptHostCard: {
      marginTop: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.accent,
      backgroundColor: palette.accentSoft,
      paddingHorizontal: 10,
      paddingVertical: 10
    },
    discoverSecurityPromptHost: {
      color: palette.text,
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 17,
      includeFontPadding: false
    },
    discoverSecurityPromptReason: {
      marginTop: 6,
      color: palette.muted,
      fontSize: 12,
      lineHeight: 17,
      includeFontPadding: false
    },
    discoverSecurityPromptActionRow: {
      marginTop: 14,
      flexDirection: 'row',
      alignItems: 'center'
    },
    discoverSecurityPromptActionBtn: {
      flex: 1,
      minHeight: 48,
      borderRadius: 24,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12
    },
    discoverSecurityPromptActionBtnGhost: {
      marginRight: 8,
      borderColor: palette.line,
      backgroundColor: palette.chip
    },
    discoverSecurityPromptActionBtnPrimary: {
      marginLeft: 8,
      borderColor: palette.accent,
      backgroundColor: palette.accent
    },
    discoverSecurityPromptActionText: {
      fontSize: 14,
      fontWeight: '800',
      lineHeight: 16,
      includeFontPadding: false
    },
    discoverSecurityPromptActionTextGhost: {
      color: palette.muted
    },
    discoverSecurityPromptActionTextPrimary: {
      color: '#16110a'
    },
    assetLayoutModalCard: {
      borderColor: palette.accent
    },
    assetLayoutPreviewCard: {
      marginTop: 8,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      padding: 10
    },
    assetLayoutPreviewRow: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center'
    },
    assetLayoutPreviewMeta: {
      flex: 1,
      minWidth: 0,
      marginLeft: 10,
      marginRight: 8
    },
    assetLayoutPreviewTitleRow: {
      flexDirection: 'row',
      alignItems: 'center'
    },
    assetLayoutPreviewTitle: {
      color: palette.text,
      fontSize: 15,
      fontWeight: '800'
    },
    assetLayoutPreviewNetworkChip: {
      marginLeft: 6,
      maxWidth: 80,
      height: 20,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      paddingHorizontal: 8,
      justifyContent: 'center'
    },
    assetLayoutPreviewNetworkChipText: {
      color: palette.muted,
      fontSize: 10,
      fontWeight: '700',
      lineHeight: 12,
      includeFontPadding: false
    },
    assetLayoutPreviewSub: {
      marginTop: 2,
      color: palette.muted,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 14,
      includeFontPadding: false
    },
    assetLayoutPreviewValueCol: {
      alignItems: 'flex-end',
      minWidth: 90
    },
    assetLayoutPreviewValue: {
      color: palette.text,
      fontSize: 18,
      fontWeight: '800',
      lineHeight: 20,
      includeFontPadding: false
    },
    assetLayoutPreviewChange: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 14,
      includeFontPadding: false
    },
    assetLayoutPreviewChangeMuted: {
      color: palette.muted
    },
    assetLayoutOptionRow: {
      marginTop: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center'
    },
    assetLayoutOptionBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 8
    },
    assetLayoutOptionBtnActive: {
      borderColor: palette.accent,
      backgroundColor: palette.accentSoft
    },
    assetLayoutOptionText: {
      color: palette.muted,
      fontSize: 14,
      fontWeight: '800',
      lineHeight: 16,
      includeFontPadding: false
    },
    assetLayoutOptionTextActive: {
      color: '#111111',
      fontSize: 14,
      fontWeight: '900',
      lineHeight: 16,
      includeFontPadding: false
    },
    assetLayoutConfirmBtn: {
      marginTop: 10
    },
    cameraScreen: {
      flex: 1,
      backgroundColor: palette.bg,
      alignItems: 'center'
    },
    cameraFrame: {
      flex: 1,
      width: '100%',
      maxWidth: 430
    },
    cameraHeader: {
      height: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      marginTop: 4
    },
    cameraViewWrap: {
      flex: 1,
      margin: 16,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: palette.line
    },
    cameraView: {
      flex: 1
    },
    historyFilterSection: {
      marginBottom: 6
    },
    historyFilterTitle: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 14,
      includeFontPadding: true,
      marginBottom: 4
    },
    historyAssetRow: {
      alignItems: 'center',
      paddingRight: 2
    },
    historyFilterHintInline: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 14,
      includeFontPadding: true,
      marginLeft: 2
    },
    historyDateFilterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%'
    },
    historyDateQuickRow: {
      flexDirection: 'row',
      alignItems: 'center'
    },
    historyDateScroll: {
      flex: 1
    },
    historyDatePickerBtn: {
      height: 32,
      width: 76,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      paddingHorizontal: 0,
      marginLeft: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center'
    },
    historyDatePickerBtnContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center'
    },
    historyDatePickerBtnText: {
      marginLeft: 4,
      color: palette.text,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 14,
      includeFontPadding: true
    },
    historyFilterChip: {
      height: 32,
      width: 56,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8
    },
    historyFilterChipActive: {
      borderColor: palette.accent,
      borderWidth: 1.6,
      backgroundColor: palette.accentSoft,
      shadowColor: palette.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: themeMode === 'dark' ? 0.2 : 0.14,
      shadowRadius: 3,
      elevation: 2
    },
    historyFilterChipText: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 14,
      includeFontPadding: false
    },
    historyFilterChipTextActive: {
      color: '#16110a',
      fontSize: 12,
      fontWeight: '800'
    },
    historyDateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      paddingRight: 0
    },
    onboardingWordCountRow: {
      justifyContent: 'flex-start'
    },
    historyScopeRow: {
      justifyContent: 'flex-start'
    },
    historyScopeChip: {
      marginRight: 8
    },
    historyDateRangeChip: {
      marginRight: 0
    },
    addressBookScopeRow: {
      justifyContent: 'flex-start'
    },
    addressBookScopeChip: {
      width: 'auto',
      minWidth: 104,
      paddingHorizontal: 12,
      marginRight: 8
    },
    historyDateChip: {
      height: 32,
      width: 56,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 0
    },
    onboardingWordCountChip: {
      width: 'auto',
      minWidth: 56,
      paddingHorizontal: 12,
      marginRight: 8
    },
    historyDateChipActive: {
      borderColor: palette.accent,
      borderWidth: 1.6,
      backgroundColor: palette.accentSoft,
      shadowColor: palette.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: themeMode === 'dark' ? 0.2 : 0.14,
      shadowRadius: 3,
      elevation: 2
    },
    historyDateChipText: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 14,
      includeFontPadding: false
    },
    historyDateChipTextActive: {
      color: '#16110a',
      fontSize: 12,
      fontWeight: '800'
    },
    historyRangeSummary: {
      marginTop: 6,
      color: palette.muted,
      fontSize: 11,
      fontWeight: '600'
    },
    historyRangePresetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
      width: '100%'
    },
    historyRangePresetChip: {
      flex: 1,
      height: 38,
      borderRadius: 19,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      alignItems: 'center',
      justifyContent: 'center'
    },
    historyRangePresetChipActive: {
      borderColor: palette.accent,
      backgroundColor: palette.accentSoft
    },
    historyRangePresetChipFirst: {
      marginRight: 5
    },
    historyRangePresetChipMiddle: {
      marginHorizontal: 5
    },
    historyRangePresetChipLast: {
      marginLeft: 5
    },
    historyRangePresetText: {
      color: palette.text,
      fontSize: 13,
      fontWeight: '700'
    },
    historyRangePresetTextActive: {
      color: '#16110a',
      fontSize: 13,
      fontWeight: '800'
    },
    historyRangeField: {
      minHeight: 52,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      paddingHorizontal: 12,
      justifyContent: 'center',
      marginTop: 10
    },
    historyRangeFieldActive: {
      borderColor: palette.accent,
      backgroundColor: palette.accentSoft
    },
    historyRangeLabel: {
      color: palette.muted,
      fontSize: 11,
      fontWeight: '600'
    },
    historyRangeLabelActive: {
      color: '#16110a'
    },
    historyRangeValue: {
      marginTop: 3,
      color: palette.text,
      fontSize: 14,
      fontWeight: '700'
    },
    historyRangeValueActive: {
      color: '#16110a',
      fontWeight: '800'
    },
    historyRangeActionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 10
    },
    historyRangeActionBtn: {
      flex: 1,
      minHeight: 42,
      borderRadius: 21,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center'
    },
    historyRangeActionBtnGhost: {
      borderColor: palette.line,
      backgroundColor: palette.chip,
      marginRight: 8
    },
    historyRangeActionBtnGhostText: {
      color: palette.muted,
      fontSize: 13,
      fontWeight: '700'
    },
    historyRangeActionBtnPrimary: {
      borderColor: palette.accent,
      backgroundColor: palette.accent
    },
    historyRangeActionBtnPrimaryText: {
      color: '#16110a',
      fontSize: 13,
      fontWeight: '800'
    },
    historyCalendarTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8
    },
    historyCalendarNavBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      alignItems: 'center',
      justifyContent: 'center'
    },
    historyCalendarMonthText: {
      color: palette.text,
      fontSize: 15,
      fontWeight: '800'
    },
    historyCalendarWeekRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
      marginBottom: 8
    },
    historyCalendarWeekText: {
      flex: 1,
      textAlign: 'center',
      color: palette.muted,
      fontSize: 11,
      fontWeight: '700'
    },
    historyCalendarGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 4
    },
    historyCalendarDayCell: {
      width: '14.2857%',
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center'
    },
    historyCalendarDayCellSelected: {
      backgroundColor: palette.accentSoft
    },
    historyCalendarDayText: {
      color: palette.text,
      fontSize: 13,
      fontWeight: '600'
    },
    historyCalendarDayTextToday: {
      color: palette.accent,
      fontWeight: '800'
    },
    historyCalendarDayTextSelected: {
      color: '#16110a',
      fontWeight: '800'
    },
    txRow: {
      minHeight: 68,
      borderBottomWidth: 1,
      borderBottomColor: palette.line,
      paddingHorizontal: 4,
      paddingVertical: 10,
      marginBottom: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    txSymbol: {
      color: palette.text,
      fontSize: 15,
      fontWeight: '700'
    },
    txMeta: {
      marginTop: 3,
      color: palette.muted,
      fontSize: 12
    },
    txMemo: {
      marginTop: 4,
      color: palette.muted,
      fontSize: 12,
      maxWidth: 220
    },
    txMetaLabelAccent: {
      color: palette.accent,
      fontWeight: '700'
    },
    txValueCol: {
      alignItems: 'flex-end',
      justifyContent: 'center',
      minWidth: 126,
      paddingRight: 22,
      position: 'relative'
    },
    txUsd: {
      marginTop: 3,
      color: palette.muted,
      fontSize: 12,
      fontWeight: '700'
    },
    txTokenAmount: {
      color: palette.text,
      fontSize: 15,
      fontWeight: '800',
      lineHeight: 18,
      includeFontPadding: false
    },
    txType: {
      marginTop: 3,
      color: palette.muted,
      fontSize: 12,
      fontWeight: '700'
    },
    txGoIcon: {
      position: 'absolute',
      right: 0,
      top: '50%',
      marginTop: -7
    },
    onboardingWrap: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 60,
      paddingBottom: 60,
      justifyContent: 'center'
    },
    onboardingSymbolImage: {
      width: 118,
      height: 118,
      alignSelf: 'center'
    },
    onboardingTitle: {
      marginTop: 18,
      color: palette.text,
      fontSize: 28,
      fontWeight: '800',
      textAlign: 'center'
    },
    onboardingBody: {
      marginTop: 8,
      color: palette.muted,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
      marginBottom: 18
    },
    onboardingScanMeta: {
      marginTop: 8,
      color: palette.muted,
      fontSize: 12,
      lineHeight: 17,
      includeFontPadding: false
    },
    onboardingScanBtn: {
      marginTop: 10,
      height: 44,
      borderRadius: 22
    },
    secondaryBtn: {
      marginTop: 10,
      height: 50,
      borderRadius: 25,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      alignItems: 'center',
      justifyContent: 'center'
    },
    secondaryBtnText: {
      color: palette.text,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 20,
      includeFontPadding: true
    },
    walletRecoveryAddBtn: {
      height: 58,
      paddingHorizontal: 12
    },
    walletRecoveryAddBtnText: {
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
      includeFontPadding: true
    },
    onboardingCheckCard: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      padding: 14
    },
    onboardingCheckHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start'
    },
    onboardingCheckIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: palette.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
      marginTop: 2
    },
    onboardingCheckTitleWrap: {
      flex: 1
    },
    onboardingCheckTitle: {
      color: palette.text,
      fontSize: 16,
      fontWeight: '800'
    },
    onboardingCheckBody: {
      marginTop: 5,
      color: palette.muted,
      fontSize: 13,
      lineHeight: 19
    },
    onboardingChecklist: {
      marginTop: 12
    },
    onboardingChecklistRow: {
      minHeight: 52,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      paddingHorizontal: 10,
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8
    },
    onboardingChecklistRowActive: {
      borderColor: palette.accent,
      backgroundColor: palette.accentSoft
    },
    onboardingChecklistBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10
    },
    onboardingChecklistBadgeActive: {
      borderColor: palette.accent,
      backgroundColor: palette.accent
    },
    onboardingChecklistText: {
      flex: 1,
      color: palette.text,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600'
    },
    onboardingChecklistTextActive: {
      color: '#16110a',
      fontWeight: '700'
    },
    onboardingBackupHeroCard: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      padding: 14
    },
    onboardingBackupHeroTop: {
      flexDirection: 'row',
      alignItems: 'center'
    },
    onboardingBackupHeroIconWrap: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: palette.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10
    },
    onboardingBackupHeroTitle: {
      flex: 1,
      color: palette.text,
      fontSize: 16,
      fontWeight: '800'
    },
    onboardingBackupHeroBody: {
      marginTop: 9,
      color: palette.muted,
      fontSize: 13,
      lineHeight: 19
    },
    onboardingBackupTipsCard: {
      marginTop: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      paddingVertical: 4,
      paddingHorizontal: 10
    },
    onboardingBackupTipRow: {
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center'
    },
    onboardingBackupTipIconWrap: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: palette.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8
    },
    onboardingBackupTipText: {
      flex: 1,
      color: palette.text,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 17
    },
    onboardingBackupWarningCard: {
      marginTop: 10,
      minHeight: 42,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 11
    },
    onboardingBackupWarningText: {
      flex: 1,
      marginLeft: 8,
      color: palette.muted,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16
    },
    checkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12
    },
    checkText: {
      marginLeft: 10,
      color: palette.text,
      fontSize: 14,
      flex: 1,
      lineHeight: 20
    },
    btnDisabled: {
      opacity: 0.38
    },
    phraseBox: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      padding: 14
    },
    phraseText: {
      color: palette.text,
      fontSize: 15,
      lineHeight: 24
    },
    seedPreviewGuide: {
      color: palette.text,
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 10
    },
    seedPreviewGrid: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.panel,
      padding: 10,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between'
    },
    seedPreviewCell: {
      width: '31.8%',
      minHeight: 46,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      marginBottom: 8,
      paddingHorizontal: 8,
      flexDirection: 'row',
      alignItems: 'center'
    },
    seedPreviewIndex: {
      width: 16,
      color: palette.muted,
      fontSize: 11,
      fontWeight: '700',
      textAlign: 'center',
      lineHeight: 12,
      includeFontPadding: false
    },
    seedPreviewWord: {
      marginLeft: 6,
      color: palette.text,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 14,
      includeFontPadding: false
    },
    seedPreviewHint: {
      marginTop: 2,
      color: palette.muted,
      fontSize: 12,
      lineHeight: 17
    },
    seedPreviewHintCentered: {
      marginTop: 8,
      width: '100%',
      textAlign: 'center',
      alignSelf: 'center'
    },
    seedGrid: {
      marginBottom: 12,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between'
    },
    seedCell: {
      width: '31.8%',
      height: 52,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.chip,
      marginBottom: 8,
      paddingHorizontal: 8,
      flexDirection: 'row',
      alignItems: 'center'
    },
    seedCellIndex: {
      width: 16,
      color: palette.muted,
      fontSize: 11,
      fontWeight: '700',
      textAlign: 'center',
      lineHeight: 12,
      includeFontPadding: false
    },
    seedCellInput: {
      flex: 1,
      minWidth: 0,
      height: '100%',
      marginLeft: 6,
      color: palette.text,
      fontSize: 12,
      fontWeight: '700',
      borderWidth: 0,
      backgroundColor: 'transparent',
      paddingHorizontal: 0,
      paddingVertical: 0,
      lineHeight: 14,
      includeFontPadding: false,
      outlineStyle: 'solid',
      outlineWidth: 0,
      outlineColor: 'transparent'
    },
    seedCellInputFilled: {
      color: palette.text
    },
    doneWrap: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 16
    },
    doneIcon: {
      width: 86,
      height: 86,
      borderRadius: 43,
      backgroundColor: palette.accent,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center'
    },
    doneTitle: {
      marginTop: 16,
      color: palette.text,
      fontSize: 25,
      fontWeight: '800',
      textAlign: 'center'
    },
    doneBody: {
      marginTop: 8,
      color: palette.muted,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20
    },
    bottomWrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 10,
      alignItems: 'center',
      zIndex: 10
    },
    bottomSystemGradient: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 4
    },
    bottomSystemGradientLayer: {
      ...StyleSheet.absoluteFillObject
    },
    bottomDock: {
      width: 330,
      height: 56,
      borderRadius: 28,
      backgroundColor: palette.panel,
      borderWidth: 1,
      borderColor: palette.line,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 10
    },
    bottomDockDimLayer: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 28,
      backgroundColor: palette.overlay
    },
    bottomBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center'
    },
    bottomBtnActive: {
      backgroundColor: palette.chip
    },
    bottomBtnCenter: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: palette.accent
    },
    bottomBtnLabel: {
      marginTop: 4,
      fontSize: 11,
      fontWeight: '700',
      color: palette.muted
    },
    bottomBtnLabelActive: {
      color: '#16110a'
    }
  });
};

const themeTextColor = (_palette: AppPalette) => '#16110a';

export default function App() {
  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <AppInner />
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}
