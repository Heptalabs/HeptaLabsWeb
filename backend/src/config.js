import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '.env.local', override: true });

const parseBooleanEnv = (value, fallback) => {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return fallback;
};

const isProduction = String(process.env.NODE_ENV || 'development').toLowerCase() === 'production';
const defaultContentAdminRequireAuth = isProduction;
const defaultContentAdminAllowLegacyRoleHeader = !defaultContentAdminRequireAuth;

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
  rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 300),
  authRateLimitWindowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 60_000),
  authRateLimitMaxRequests: Number(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || 20),
  contentAdminRequireAuth: parseBooleanEnv(process.env.CONTENT_ADMIN_REQUIRE_AUTH, defaultContentAdminRequireAuth),
  contentAdminAllowLegacyRoleHeader: parseBooleanEnv(
    process.env.CONTENT_ADMIN_ALLOW_LEGACY_ROLE_HEADER,
    defaultContentAdminAllowLegacyRoleHeader
  ),
  marketPriceProvider: process.env.MARKET_PRICE_PROVIDER || 'coingecko',
  marketPriceTtlMs: Number(process.env.MARKET_PRICE_TTL_MS || 15000),
  marketPriceTimeoutMs: Number(process.env.MARKET_PRICE_TIMEOUT_MS || 5000),
  marketFxTtlMs: Number(process.env.MARKET_FX_TTL_MS || 300000),
  marketPopularTtlMs: Number(process.env.MARKET_POPULAR_TTL_MS || 30000),
  marketDappProviders: process.env.MARKET_DAPP_PROVIDERS || 'dappradar,defillama',
  dappRadarApiKey: process.env.DAPPRADAR_API_KEY || '',
  dappRadarEndpoint: process.env.DAPPRADAR_TOP_DAPPS_ENDPOINT || '',
  dappRadarBaseUrl: process.env.DAPPRADAR_BASE_URL || 'https://apis.dappradar.com',
  dappRadarProjectId: process.env.DAPPRADAR_PROJECT_ID || '',
  dappRadarTopPath: process.env.DAPPRADAR_TOP_DAPPS_PATH || 'dapps/top/uaw',
  dappRadarTopRange: process.env.DAPPRADAR_TOP_RANGE || '30d',
  dappRadarTopLimitParam: process.env.DAPPRADAR_TOP_LIMIT_PARAM || 'top',
  dappRadarAuthHeader: process.env.DAPPRADAR_AUTH_HEADER || 'X-BLOBR-KEY',
  dappRadarAuthPrefix: process.env.DAPPRADAR_AUTH_PREFIX || '',
  coinMarketCapApiKey: process.env.COINMARKETCAP_API_KEY || process.env.CMC_PRO_API_KEY || '',
  coinmetricsApiKey: process.env.COINMETRICS_API_KEY || '',
  solscanApiKey: process.env.SOLSCAN_API_KEY || process.env.SOLSCAN_PRO_API_KEY || '',
  etherscanApiKey: process.env.ETHERSCAN_API_KEY || process.env.ETHERSCAN_KEY || '',
  tronscanApiKey: process.env.TRONSCAN_API_KEY || ''
};

if (!config.databaseUrl) {
  // Fail fast for missing DB URL.
  throw new Error('DATABASE_URL is required.');
}

if (!config.jwtSecret) {
  throw new Error('JWT_SECRET is required.');
}
