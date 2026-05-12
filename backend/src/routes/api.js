import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { randomUUID } from 'crypto';
import { getAddress as toChecksumEvmAddress } from 'ethers';
import bs58check from 'bs58check';
import { bech32 } from 'bech32';
import { pool, withTransaction } from '../db/pool.js';
import { config } from '../config.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../utils/errors.js';
import { parseAmount } from '../utils/number.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import {
  getMarketAssetInfoSnapshot,
  getMarketFxSnapshot,
  getMarketHolderCountSnapshot,
  getMarketTokenIconBinary,
  getMarketTokenIconsSnapshot,
  getMarketPopularTokensSnapshot,
  getMarketPriceSnapshot,
  parseRequestedMarketPopularLimit,
  parseRequestedMarketSymbols
} from '../services/market-price.js';
import {
  getMarketPopularDappsByCategorySnapshot,
  getMarketPopularDappsSnapshot,
  parseRequestedMarketDappLimit
} from '../services/market-dapps.js';
import {
  WEEKLY_BRIEFING_ITEM_ID,
  appendDiscoverClickLog,
  getDiscoverPublicFeed,
  listAdminDiscoverClickLogs,
  listAdminDiscoverItems,
  summarizeAdminDiscoverClickLogs,
  uploadDiscoverImage,
  updateAdminDiscoverItem
} from '../services/discover-content.js';
import { syncDiscoverIconCache } from '../services/discover-icon-cache.js';

const router = express.Router();

const LOGIN_ID_REGEX = /^[A-Za-z0-9]{4,30}$/;
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,16}$/;
const NAME_REGEX = /^[A-Za-z가-힣\s]+$/;
const PHONE_REGEX = /^[0-9]+$/;
const TXID_REGEX = /^[A-Za-z0-9]+$/;
const ALLOWED_NETWORKS = new Set(['TRC20', 'ERC20', 'BEP20', 'OTHER']);
const CONTENT_ADMIN_ROLES = new Set(['viewer', 'operator', 'compliance', 'admin']);
const CONTENT_ROLE_PERMISSIONS = {
  viewer: { read: true, write: false, publish: false, delete: false, refresh: false, upload: false },
  operator: { read: true, write: true, publish: false, delete: false, refresh: true, upload: true },
  compliance: { read: true, write: true, publish: true, delete: false, refresh: true, upload: true },
  admin: { read: true, write: true, publish: true, delete: true, refresh: true, upload: true }
};
const contentAdminAuthGuard = config.contentAdminRequireAuth ? [requireAuth] : [];
const authRateLimiter = rateLimit({
  windowMs: Math.max(10_000, config.authRateLimitWindowMs),
  max: Math.max(5, config.authRateLimitMaxRequests),
  standardHeaders: true,
  legacyHeaders: false
});
const signupRateLimiter = rateLimit({
  windowMs: Math.max(10_000, config.authRateLimitWindowMs),
  max: Math.max(5, Math.floor(config.authRateLimitMaxRequests / 2)),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const loginId = String(req.body?.loginId || '').trim().toLowerCase();
    const ipKey = ipKeyGenerator(req.ip || req.socket?.remoteAddress || '');
    return `${ipKey}:${loginId}`;
  }
});
const RPC_JSON_UPSTREAM_BY_CHAIN = Object.freeze({
  ETH: 'https://ethereum-rpc.publicnode.com',
  BSC: 'https://bsc-dataseed.binance.org',
  XRP: 'https://xrplcluster.com',
  SOL: 'https://api.mainnet-beta.solana.com',
  FIL: 'https://api.node.glif.io/rpc/v1'
});
const RPC_BTC_BLOCKSTREAM_BASE = 'https://blockstream.info/api';
const RPC_MEMPOOL_BASE = 'https://mempool.space/api';
const RPC_TRONGRID_BASE = 'https://api.trongrid.io';
const RPC_PROXY_TIMEOUT_MS = 15_000;

const createTimeoutController = (timeoutMs = RPC_PROXY_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer)
  };
};

const buildProxyUrl = (baseUrl, pathname, query = {}) => {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const url = new URL(normalizedPath, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
};

const forwardUpstreamRequest = async ({ url, method = 'GET', body, contentType, accept = 'application/json' }) => {
  const guard = createTimeoutController();
  try {
    const headers = { accept };
    if (contentType) headers['content-type'] = contentType;

    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: guard.signal
    });

    const responseContentType = String(response.headers.get('content-type') || '').toLowerCase();
    const payloadText = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      contentType: responseContentType || 'text/plain; charset=utf-8',
      text: payloadText
    };
  } finally {
    guard.cleanup();
  }
};

const parseJsonRpcPayload = (body) => {
  const payload = body && typeof body === 'object' ? body : {};
  const method = String(payload.method || '').trim();
  if (!method) {
    throw new AppError(400, 'JSON-RPC method is required.');
  }
  const params = Array.isArray(payload.params) ? payload.params : [];
  const id = payload.id ?? method;
  return {
    jsonrpc: '2.0',
    id,
    method,
    params
  };
};

const proxyJsonRpcToChain = async (chain, body) => {
  const targetUrl = RPC_JSON_UPSTREAM_BY_CHAIN[chain];
  if (!targetUrl) {
    throw new AppError(400, `Unsupported rpc chain: ${chain}`);
  }
  const rpcPayload = parseJsonRpcPayload(body);
  const upstream = await forwardUpstreamRequest({
    url: targetUrl,
    method: 'POST',
    body: JSON.stringify(rpcPayload),
    contentType: 'application/json',
    accept: 'application/json'
  });
  if (!upstream.ok) {
    throw new AppError(502, `RPC upstream error (${chain}): ${upstream.status}`);
  }

  try {
    return JSON.parse(upstream.text);
  } catch {
    throw new AppError(502, `RPC upstream returned invalid JSON (${chain}).`);
  }
};

function getRequestOrigin(req) {
  const forwardedProto = String(req.header('x-forwarded-proto') || '').trim();
  const proto = forwardedProto ? forwardedProto.split(',')[0].trim() : req.protocol || 'http';
  return `${proto}://${req.get('host')}`;
}

function createToken(user) {
  return jwt.sign(
    {
      uid: Number(user.uid),
      role: user.role,
      loginId: user.login_id
    },
    config.jwtSecret,
    {
      subject: String(user.id),
      expiresIn: config.jwtExpiresIn
    }
  );
}

function toAuthUser(user) {
  return {
    id: Number(user.id),
    uid: Number(user.uid),
    loginId: user.login_id,
    role: user.role
  };
}

function assertNetwork(network) {
  if (!ALLOWED_NETWORKS.has(network)) {
    throw new AppError(400, 'Unsupported network.');
  }
}

function assertValidLoginId(loginId) {
  if (!LOGIN_ID_REGEX.test(loginId)) {
    throw new AppError(400, 'loginId format is invalid.');
  }
}

function assertValidPassword(password) {
  if (!PASSWORD_REGEX.test(password)) {
    throw new AppError(400, 'password must include letter, number, special char (8~16).');
  }
}

function assertValidName(name) {
  if (!NAME_REGEX.test(name)) {
    throw new AppError(400, 'name can include Korean/English letters only.');
  }
}

function assertValidPhone(phone) {
  if (!PHONE_REGEX.test(phone)) {
    throw new AppError(400, 'phone must contain digits only.');
  }
}

function assertValidTxid(txid) {
  if (!TXID_REGEX.test(txid) || txid.length > 300) {
    throw new AppError(400, 'txid must be alphanumeric and <= 300 chars.');
  }
}

function isValidEvmAddress(address) {
  try {
    return Boolean(toChecksumEvmAddress(address));
  } catch {
    return false;
  }
}

function isValidTronAddress(address) {
  try {
    const decoded = bs58check.decode(address);
    return decoded.length === 21 && decoded[0] === 0x41;
  } catch {
    return false;
  }
}

function isValidBitcoinAddress(address) {
  const trimmed = String(address || '').trim();
  if (!trimmed) return false;

  if (/^(bc1|tb1)/i.test(trimmed)) {
    try {
      const decoded = bech32.decode(trimmed, 1500);
      return Array.isArray(decoded.words) && decoded.words.length > 1;
    } catch {
      return false;
    }
  }

  if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(trimmed)) {
    try {
      const decoded = bs58check.decode(trimmed);
      return decoded.length >= 21 && decoded.length <= 34;
    } catch {
      return false;
    }
  }

  return false;
}

function isValidAddressByNetwork(address, network = 'OTHER') {
  const trimmed = String(address || '').trim();
  if (!trimmed || trimmed.length > 300) return false;

  const normalizedNetwork = String(network || '')
    .trim()
    .toUpperCase();

  if (normalizedNetwork === 'ERC20' || normalizedNetwork === 'BEP20' || normalizedNetwork === 'ETH' || normalizedNetwork === 'BSC') {
    return isValidEvmAddress(trimmed);
  }
  if (normalizedNetwork === 'TRC20' || normalizedNetwork === 'TRX') {
    return isValidTronAddress(trimmed);
  }
  if (normalizedNetwork === 'BTC') {
    return isValidBitcoinAddress(trimmed);
  }
  if (normalizedNetwork === 'USDT') {
    return isValidEvmAddress(trimmed) || isValidTronAddress(trimmed);
  }
  if (normalizedNetwork === 'OTHER') {
    // Keep OTHER conservative to avoid cross-chain misroutes in profile/signup inputs.
    return false;
  }

  return false;
}

function assertValidAddress(address, field = 'address', network = 'OTHER') {
  if (!isValidAddressByNetwork(address, network)) {
    throw new AppError(400, `${field} format is invalid for ${network}.`);
  }
}

function mapTokenRoleToContentRole(rawRole) {
  const role = String(rawRole || '')
    .trim()
    .toLowerCase();
  if (!role) return null;
  if (CONTENT_ADMIN_ROLES.has(role)) return role;
  if (role === 'super_admin' || role === 'admin') return 'admin';
  if (role === 'operator' || role === 'ops') return 'operator';
  if (role === 'compliance') return 'compliance';
  if (role === 'viewer') return 'viewer';
  return null;
}

function resolveContentAdminRole(req) {
  const tokenRole = mapTokenRoleToContentRole(req.user?.role);
  if (tokenRole) return tokenRole;

  if (config.contentAdminRequireAuth) {
    throw new AppError(401, 'Content admin auth token is required.');
  }

  if (!config.contentAdminAllowLegacyRoleHeader) {
    throw new AppError(403, 'Legacy content admin role header is disabled.');
  }

  const headerRole = String(req.header('x-admin-role') || '')
    .trim()
    .toLowerCase();
  if (!headerRole) {
    throw new AppError(401, 'x-admin-role header is required.');
  }
  if (!CONTENT_ADMIN_ROLES.has(headerRole)) {
    throw new AppError(403, 'Unsupported admin role.');
  }
  return headerRole;
}

function requireContentPermission(req, permission) {
  const role = resolveContentAdminRole(req);
  const permissions = CONTENT_ROLE_PERMISSIONS[role];
  if (!permissions?.[permission]) {
    throw new AppError(403, `No permission for ${permission}.`);
  }
  return role;
}

function mapBalances(userRow) {
  return {
    available: userRow.balance_available,
    withdrawLocked: userRow.balance_withdraw_locked,
    productPrincipal: userRow.balance_product_principal,
    total: userRow.balance_total
  };
}

router.get(
  '/health',
  asyncHandler(async (req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  })
);

router.post(
  '/rpc/:chain',
  asyncHandler(async (req, res) => {
    const chain = String(req.params.chain || '')
      .trim()
      .toUpperCase();
    const payload = await proxyJsonRpcToChain(chain, req.body);
    res.json(payload);
  })
);

router.get(
  '/rpc/btc/address/:address',
  asyncHandler(async (req, res) => {
    const address = String(req.params.address || '').trim();
    if (!address) throw new AppError(400, 'address is required.');
    const url = buildProxyUrl(RPC_BTC_BLOCKSTREAM_BASE, `/address/${encodeURIComponent(address)}`);
    const upstream = await forwardUpstreamRequest({ url, method: 'GET', accept: 'application/json' });
    if (!upstream.ok) throw new AppError(502, `BTC upstream error: ${upstream.status}`);
    res.setHeader('content-type', upstream.contentType);
    res.send(upstream.text);
  })
);

router.get(
  '/rpc/btc/tx/:hash',
  asyncHandler(async (req, res) => {
    const hash = String(req.params.hash || '').trim();
    if (!hash) throw new AppError(400, 'hash is required.');
    const url = buildProxyUrl(RPC_BTC_BLOCKSTREAM_BASE, `/tx/${encodeURIComponent(hash)}`);
    const upstream = await forwardUpstreamRequest({ url, method: 'GET', accept: 'application/json' });
    if (!upstream.ok) throw new AppError(502, `BTC upstream error: ${upstream.status}`);
    res.setHeader('content-type', upstream.contentType);
    res.send(upstream.text);
  })
);

router.post(
  '/rpc/btc/tx',
  express.text({ type: '*/*', limit: '2mb' }),
  asyncHandler(async (req, res) => {
    const rawTx = typeof req.body === 'string' ? req.body : '';
    if (!rawTx.trim()) throw new AppError(400, 'raw tx payload is required.');
    const url = buildProxyUrl(RPC_BTC_BLOCKSTREAM_BASE, '/tx');
    const upstream = await forwardUpstreamRequest({
      url,
      method: 'POST',
      body: rawTx,
      contentType: 'text/plain',
      accept: 'text/plain'
    });
    if (!upstream.ok) throw new AppError(502, `BTC upstream error: ${upstream.status}`);
    res.setHeader('content-type', upstream.contentType);
    res.send(upstream.text);
  })
);

router.get(
  '/rpc/btc/fees/recommended',
  asyncHandler(async (req, res) => {
    const url = buildProxyUrl(RPC_MEMPOOL_BASE, '/v1/fees/recommended');
    const upstream = await forwardUpstreamRequest({ url, method: 'GET', accept: 'application/json' });
    if (!upstream.ok) throw new AppError(502, `Mempool upstream error: ${upstream.status}`);
    res.setHeader('content-type', upstream.contentType);
    res.send(upstream.text);
  })
);

router.get(
  '/rpc/trx/account/:address',
  asyncHandler(async (req, res) => {
    const address = String(req.params.address || '').trim();
    if (!address) throw new AppError(400, 'address is required.');
    const url = buildProxyUrl(RPC_TRONGRID_BASE, `/v1/accounts/${encodeURIComponent(address)}`, req.query || {});
    const upstream = await forwardUpstreamRequest({ url, method: 'GET', accept: 'application/json' });
    if (!upstream.ok) throw new AppError(502, `TRX upstream error: ${upstream.status}`);
    res.setHeader('content-type', upstream.contentType);
    res.send(upstream.text);
  })
);

router.post(
  '/rpc/trx/wallet/getchainparameters',
  asyncHandler(async (req, res) => {
    const url = buildProxyUrl(RPC_TRONGRID_BASE, '/wallet/getchainparameters');
    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const upstream = await forwardUpstreamRequest({
      url,
      method: 'POST',
      body: JSON.stringify(payload),
      contentType: 'application/json',
      accept: 'application/json'
    });
    if (!upstream.ok) throw new AppError(502, `TRX upstream error: ${upstream.status}`);
    res.setHeader('content-type', upstream.contentType);
    res.send(upstream.text);
  })
);

router.post(
  '/rpc/trx/wallet/gettransactioninfobyid',
  asyncHandler(async (req, res) => {
    const url = buildProxyUrl(RPC_TRONGRID_BASE, '/wallet/gettransactioninfobyid');
    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const upstream = await forwardUpstreamRequest({
      url,
      method: 'POST',
      body: JSON.stringify(payload),
      contentType: 'application/json',
      accept: 'application/json'
    });
    if (!upstream.ok) throw new AppError(502, `TRX upstream error: ${upstream.status}`);
    res.setHeader('content-type', upstream.contentType);
    res.send(upstream.text);
  })
);

router.all(
  '/rpc/trx/*',
  asyncHandler(async (req, res) => {
    const proxiedPath = String(req.params[0] || '').trim();
    if (!proxiedPath) {
      throw new AppError(400, 'trx proxy path is required.');
    }
    const url = buildProxyUrl(RPC_TRONGRID_BASE, `/${proxiedPath}`, req.query || {});
    const method = String(req.method || 'GET').toUpperCase();
    const hasBody = method !== 'GET' && method !== 'HEAD';

    let body;
    let contentType = undefined;
    if (hasBody) {
      if (typeof req.body === 'string') {
        body = req.body;
      } else if (req.body && typeof req.body === 'object') {
        body = JSON.stringify(req.body);
        contentType = 'application/json';
      }
      if (!contentType) {
        const incomingContentType = String(req.headers['content-type'] || '').trim();
        if (incomingContentType) contentType = incomingContentType;
      }
    }

    const upstream = await forwardUpstreamRequest({
      url,
      method,
      body,
      contentType,
      accept: String(req.headers.accept || '*/*')
    });

    res.status(upstream.status);
    res.setHeader('content-type', upstream.contentType);
    res.send(upstream.text);
  })
);

router.get(
  '/market/prices',
  asyncHandler(async (req, res) => {
    const { symbols, invalidSymbols } = parseRequestedMarketSymbols(req.query.symbols);
    if (invalidSymbols.length) {
      throw new AppError(400, `Unsupported symbols: ${invalidSymbols.join(', ')}`);
    }

    try {
      const snapshot = await getMarketPriceSnapshot(symbols);
      res.json(snapshot);
    } catch (error) {
      throw new AppError(502, 'Failed to fetch market prices.');
    }
  })
);

router.get(
  '/market/asset-info',
  asyncHandler(async (req, res) => {
    const { symbols, invalidSymbols } = parseRequestedMarketSymbols(req.query.symbols);
    if (invalidSymbols.length) {
      throw new AppError(400, `Unsupported symbols: ${invalidSymbols.join(', ')}`);
    }

    try {
      const snapshot = await getMarketAssetInfoSnapshot(symbols);
      res.json(snapshot);
    } catch (error) {
      throw new AppError(502, 'Failed to fetch market asset info.');
    }
  })
);

router.get(
  '/market/holders',
  asyncHandler(async (req, res) => {
    const asset = String(req.query.asset || '')
      .trim()
      .toUpperCase();
    const chain = String(req.query.chain || '')
      .trim()
      .toUpperCase();

    if (!asset || !chain) {
      throw new AppError(400, 'asset and chain query are required.');
    }

    try {
      const snapshot = await getMarketHolderCountSnapshot(asset, chain);
      res.json(snapshot);
    } catch (error) {
      throw new AppError(502, 'Failed to fetch holder count.');
    }
  })
);

router.get(
  '/market/fx-rates',
  asyncHandler(async (req, res) => {
    try {
      const snapshot = await getMarketFxSnapshot();
      res.json(snapshot);
    } catch (error) {
      throw new AppError(502, 'Failed to fetch FX rates.');
    }
  })
);

router.get(
  '/market/popular-dapps',
  asyncHandler(async (req, res) => {
    const limit = parseRequestedMarketDappLimit(req.query.limit);

    try {
      const snapshot = await getMarketPopularDappsSnapshot(limit);
      res.json(snapshot);
    } catch (error) {
      throw new AppError(502, 'Failed to fetch popular dapps.');
    }
  })
);

router.get(
  '/market/popular-dapps/by-category',
  asyncHandler(async (req, res) => {
    const limit = parseRequestedMarketDappLimit(req.query.limit);

    try {
      const snapshot = await getMarketPopularDappsByCategorySnapshot(limit);
      res.json(snapshot);
    } catch (error) {
      throw new AppError(502, 'Failed to fetch popular dapps by category.');
    }
  })
);

router.get(
  '/market/popular-tokens',
  asyncHandler(async (req, res) => {
    const limit = parseRequestedMarketPopularLimit(req.query.limit);

    try {
      const snapshot = await getMarketPopularTokensSnapshot(limit);
      const origin = getRequestOrigin(req);
      const tokens = Array.isArray(snapshot.tokens)
        ? snapshot.tokens.map((row) => {
            const iconId = Number(row?.iconId);
            if (!Number.isFinite(iconId) || iconId <= 0) return row;
            return {
              ...row,
              iconProxyUrl: `${origin}/api/v1/market/token-icon/${Math.floor(iconId)}`
            };
          })
        : [];
      res.json({
        ...snapshot,
        tokens
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('api key is not configured')) {
        throw new AppError(503, 'CoinMarketCap API key is not configured.');
      }
      throw new AppError(502, 'Failed to fetch popular market tokens.');
    }
  })
);

router.get(
  '/market/token-icon/:iconId',
  asyncHandler(async (req, res) => {
    const iconIdRaw = String(req.params.iconId || '').trim();
    const iconId = Number(iconIdRaw);
    if (!Number.isFinite(iconId) || iconId <= 0) {
      throw new AppError(400, 'iconId must be a positive integer.');
    }

    try {
      const snapshot = await getMarketTokenIconBinary(iconId);
      res.setHeader('content-type', snapshot.contentType || 'image/png');
      res.setHeader('cache-control', 'public, max-age=86400, s-maxage=86400');
      res.send(snapshot.body);
    } catch (error) {
      throw new AppError(502, 'Failed to fetch token icon.');
    }
  })
);

router.get(
  '/market/token-icons',
  asyncHandler(async (req, res) => {
    const raw = Array.isArray(req.query.symbols) ? req.query.symbols.join(',') : String(req.query.symbols || '');
    const symbols = [...new Set(raw.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean))].slice(0, 300);

    if (!symbols.length) {
      throw new AppError(400, 'symbols query is required.');
    }

    try {
      const snapshot = await getMarketTokenIconsSnapshot(symbols);
      const origin = getRequestOrigin(req);
      const tokens = Array.isArray(snapshot.tokens)
        ? snapshot.tokens.map((row) => {
            const iconId = Number(row?.id);
            if (!Number.isFinite(iconId) || iconId <= 0) return row;
            return {
              ...row,
              iconProxyUrl: `${origin}/api/v1/market/token-icon/${Math.floor(iconId)}`
            };
          })
        : [];
      res.json({
        ...snapshot,
        tokens
      });
    } catch (error) {
      throw new AppError(502, 'Failed to fetch token icons.');
    }
  })
);

router.get(
  '/content/discover',
  asyncHandler(async (req, res) => {
    const lang = typeof req.query.lang === 'string' ? req.query.lang : 'ko';
    const category = typeof req.query.category === 'string' ? req.query.category : 'all';
    const section = typeof req.query.section === 'string' ? req.query.section : 'all';
    const limit = Number(req.query.limit || 40);
    const feed = await getDiscoverPublicFeed({ lang, category, section, limit });
    res.json(feed);
  })
);

router.post(
  '/content/discover/icon-cache/sync',
  asyncHandler(async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const payloadRaw =
      body && body.payload && typeof body.payload === 'object'
        ? body.payload
        : body && typeof body === 'object'
          ? body
          : {};
    const limitRaw = Number(req.query.limit ?? body.limit ?? 50);
    const limit = Math.max(1, Math.min(50, Math.floor(Number.isFinite(limitRaw) ? limitRaw : 50)));
    const forceRaw = req.query.force ?? body.force;
    const force =
      forceRaw === true ||
      String(forceRaw || '')
        .trim()
        .toLowerCase() === 'true';

    const origin = getRequestOrigin(req);
    const snapshot = await syncDiscoverIconCache({
      payload: payloadRaw,
      origin,
      limit,
      force
    });
    res.json(snapshot);
  })
);

router.post(
  '/content/discover/click',
  asyncHandler(async (req, res) => {
    const created = await appendDiscoverClickLog(req.body || {});
    res.status(201).json({ ok: true, id: created.id, clickedAt: created.clickedAt });
  })
);

router.get(
  '/content/admin/items',
  ...contentAdminAuthGuard,
  asyncHandler(async (req, res) => {
    requireContentPermission(req, 'read');
    const items = await listAdminDiscoverItems();
    res.json({ items });
  })
);

router.post(
  '/content/admin/items',
  ...contentAdminAuthGuard,
  asyncHandler(async (req, res) => {
    requireContentPermission(req, 'write');
    throw new AppError(403, 'Only the weekly briefing item can be edited.');
  })
);

router.patch(
  '/content/admin/items/:id',
  ...contentAdminAuthGuard,
  asyncHandler(async (req, res) => {
    requireContentPermission(req, 'write');
    const id = String(req.params.id || '').trim();
    if (!id) {
      throw new AppError(400, 'id is required.');
    }

    if (id !== WEEKLY_BRIEFING_ITEM_ID) {
      throw new AppError(403, 'Only the weekly briefing item can be edited.');
    }

    const patch = req.body && typeof req.body === 'object' ? req.body : {};
    const allowedKeys = new Set(['title', 'summary', 'ctaLabel', 'sourceName', 'tags', 'publishedAt']);
    const disallowedKeys = Object.keys(patch).filter((key) => !allowedKeys.has(key));
    if (disallowedKeys.length) {
      throw new AppError(400, `Unsupported fields: ${disallowedKeys.join(', ')}`);
    }

    const normalizedPatch = {
      ...patch,
      status: 'published',
      category: 'market',
      section: 'latest',
      pinned: true,
      priority: 90,
      sourceUrl: '',
      ctaUrl: '',
      actionType: 'internal',
      internalTarget: 'discover:briefing'
    };

    const updated = await updateAdminDiscoverItem(id, normalizedPatch);
    if (!updated) {
      throw new AppError(404, 'Content item not found.');
    }

    res.json(updated);
  })
);

router.delete(
  '/content/admin/items/:id',
  ...contentAdminAuthGuard,
  asyncHandler(async (req, res) => {
    requireContentPermission(req, 'write');
    throw new AppError(403, 'Deleting discover items is disabled.');
  })
);

router.post(
  '/content/admin/refresh',
  ...contentAdminAuthGuard,
  asyncHandler(async (req, res) => {
    requireContentPermission(req, 'write');
    throw new AppError(403, 'Manual refresh is disabled.');
  })
);

router.post(
  '/content/admin/upload-image',
  ...contentAdminAuthGuard,
  asyncHandler(async (req, res) => {
    requireContentPermission(req, 'upload');
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const uploaded = await uploadDiscoverImage({
      fileName: req.body?.fileName,
      mimeType: req.body?.mimeType,
      dataBase64: req.body?.dataBase64,
      baseUrl
    });
    res.status(201).json(uploaded);
  })
);

router.get(
  '/content/admin/clicks',
  ...contentAdminAuthGuard,
  asyncHandler(async (req, res) => {
    requireContentPermission(req, 'read');
    const limit = Number(req.query.limit || 50);
    const items = await listAdminDiscoverClickLogs({ limit });
    res.json({ items });
  })
);

router.get(
  '/content/admin/clicks/summary',
  ...contentAdminAuthGuard,
  asyncHandler(async (req, res) => {
    requireContentPermission(req, 'read');
    const days = Number(req.query.days || 7);
    const summary = await summarizeAdminDiscoverClickLogs({ days });
    res.json(summary);
  })
);

router.post(
  '/auth/signup',
  signupRateLimiter,
  asyncHandler(async (req, res) => {
    const { loginId, password, name, phone, email, referrerUid, usdtAddress } = req.body;

    if (!loginId || !password || !name || !phone || !email) {
      throw new AppError(400, 'loginId, password, name, phone, email are required.');
    }

    assertValidLoginId(loginId);
    assertValidPassword(password);
    assertValidName(name);
    assertValidPhone(phone);

    if (usdtAddress) {
      assertValidAddress(usdtAddress, 'usdtAddress', 'USDT');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const newUser = await withTransaction(async (client) => {
      let referrerUserId = null;
      if (referrerUid) {
        const referrer = await client.query('SELECT id FROM users WHERE uid = $1', [referrerUid]);
        if (referrer.rowCount === 0) {
          throw new AppError(400, 'referrerUid does not exist.');
        }
        referrerUserId = referrer.rows[0].id;
      }

      const inserted = await client.query(
        `
          INSERT INTO users (
            login_id,
            password_hash,
            name,
            phone,
            email,
            role,
            status,
            referrer_user_id,
            usdt_address,
            email_verified_at
          )
          VALUES ($1, $2, $3, $4, $5, 'MEMBER', 'ACTIVE', $6, $7, NOW())
          RETURNING id, uid, login_id, role
        `,
        [loginId, passwordHash, name, phone, email, referrerUserId, usdtAddress || null]
      );

      return inserted.rows[0];
    });

    const token = createToken(newUser);
    res.status(201).json({ token, user: toAuthUser(newUser) });
  })
);

router.post(
  '/auth/login',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const { loginId, password } = req.body;
    if (!loginId || !password) {
      throw new AppError(400, 'loginId and password are required.');
    }

    const result = await pool.query(
      `
        SELECT id, uid, login_id, password_hash, role, status
        FROM users
        WHERE login_id = $1
        LIMIT 1
      `,
      [loginId]
    );

    if (result.rowCount === 0) {
      throw new AppError(401, 'Invalid credentials.');
    }

    const user = result.rows[0];
    if (user.status !== 'ACTIVE') {
      throw new AppError(403, 'Account is not active.');
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      throw new AppError(401, 'Invalid credentials.');
    }

    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    const token = createToken(user);
    res.json({ token, user: toAuthUser(user) });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `
        SELECT
          id,
          uid,
          login_id,
          name,
          phone,
          email,
          level,
          usdt_address,
          balance_available,
          balance_withdraw_locked,
          balance_product_principal,
          balance_total
        FROM users
        WHERE id = $1
      `,
      [req.user.id]
    );

    if (result.rowCount === 0) {
      throw new AppError(404, 'User not found.');
    }

    const user = result.rows[0];
    res.json({
      id: Number(user.id),
      uid: Number(user.uid),
      loginId: user.login_id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      level: Number(user.level),
      usdtAddress: user.usdt_address,
      balances: mapBalances(user)
    });
  })
);

router.patch(
  '/me/profile',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { phone, usdtAddress } = req.body;

    if (!phone && !usdtAddress) {
      throw new AppError(400, 'At least one field is required.');
    }

    const fields = [];
    const values = [];

    if (phone) {
      assertValidPhone(phone);
      fields.push(`phone = $${fields.length + 1}`);
      values.push(phone);
    }

    if (usdtAddress) {
      assertValidAddress(usdtAddress, 'usdtAddress', 'USDT');
      fields.push(`usdt_address = $${fields.length + 1}`);
      values.push(usdtAddress);
    }

    values.push(req.user.id);

    const updated = await pool.query(
      `
        UPDATE users
        SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id = $${values.length}
        RETURNING
          id,
          uid,
          login_id,
          name,
          phone,
          email,
          level,
          usdt_address,
          balance_available,
          balance_withdraw_locked,
          balance_product_principal,
          balance_total
      `,
      values
    );

    const user = updated.rows[0];
    res.json({
      id: Number(user.id),
      uid: Number(user.uid),
      loginId: user.login_id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      level: Number(user.level),
      usdtAddress: user.usdt_address,
      balances: mapBalances(user)
    });
  })
);

router.post(
  '/deposits',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { network, amount, txid, proofNote } = req.body;

    assertNetwork(network);
    const parsedAmount = parseAmount(amount, 'amount');
    assertValidTxid(txid);

    const idempotencyKey = req.headers['x-idempotency-key'] || randomUUID();

    const inserted = await pool.query(
      `
        INSERT INTO deposits (
          user_id,
          network,
          requested_amount,
          txid,
          proof_note,
          status,
          idempotency_key
        ) VALUES ($1, $2, $3, $4, $5, 'REQUESTED', $6)
        RETURNING
          id,
          network,
          requested_amount,
          txid,
          status,
          requested_at,
          reviewed_at
      `,
      [req.user.id, network, parsedAmount, txid, proofNote || null, idempotencyKey]
    );

    const row = inserted.rows[0];
    res.status(201).json({
      id: Number(row.id),
      network: row.network,
      requestedAmount: row.requested_amount,
      txid: row.txid,
      status: row.status,
      requestedAt: row.requested_at,
      reviewedAt: row.reviewed_at
    });
  })
);

router.get(
  '/deposits',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `
        SELECT id, network, requested_amount, txid, status, requested_at, reviewed_at
        FROM deposits
        WHERE user_id = $1
        ORDER BY id DESC
      `,
      [req.user.id]
    );

    res.json({
      items: result.rows.map((row) => ({
        id: Number(row.id),
        network: row.network,
        requestedAmount: row.requested_amount,
        txid: row.txid,
        status: row.status,
        requestedAt: row.requested_at,
        reviewedAt: row.reviewed_at
      }))
    });
  })
);

router.post(
  '/withdrawals',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { network, amount, destinationAddress } = req.body;

    assertNetwork(network);
    const parsedAmount = parseAmount(amount, 'amount');
    assertValidAddress(destinationAddress, 'destinationAddress', network);

    const requestIdempotencyKey = req.headers['x-idempotency-key'] || randomUUID();

    const result = await withTransaction(async (client) => {
      const policyResult = await client.query(
        `
          SELECT min_withdraw_amount, withdraw_allowed_weekdays
          FROM asset_policies
          WHERE is_active = TRUE
          ORDER BY effective_from DESC
          LIMIT 1
        `
      );

      if (policyResult.rowCount === 0) {
        throw new AppError(400, 'Active asset policy not found.');
      }

      const policy = policyResult.rows[0];
      const minWithdrawAmount = Number(policy.min_withdraw_amount);
      const allowedWeekdays = policy.withdraw_allowed_weekdays || [];

      if (parsedAmount < minWithdrawAmount) {
        throw new AppError(400, `amount must be >= ${minWithdrawAmount}.`);
      }

      const dowResult = await client.query(
        `SELECT EXTRACT(DOW FROM (NOW() AT TIME ZONE 'Asia/Seoul'))::SMALLINT AS dow`
      );
      const currentDow = Number(dowResult.rows[0].dow);
      if (!allowedWeekdays.includes(currentDow)) {
        throw new AppError(400, 'Withdrawals are not allowed on this weekday.');
      }

      const userResult = await client.query(
        `SELECT balance_available FROM users WHERE id = $1 FOR UPDATE`,
        [req.user.id]
      );
      if (userResult.rowCount === 0) {
        throw new AppError(404, 'User not found.');
      }

      const available = Number(userResult.rows[0].balance_available);
      if (available < parsedAmount) {
        throw new AppError(400, 'Insufficient available balance.');
      }

      const ledgerKey = `withdraw-request:${requestIdempotencyKey}`;
      const ledgerResult = await client.query(
        `
          SELECT fn_apply_ledger_delta(
            $1::BIGINT,
            'WITHDRAW_REQUESTED'::ledger_entry_type,
            $2::NUMERIC,
            $3::NUMERIC,
            $4::NUMERIC,
            0::NUMERIC,
            'withdrawal'::VARCHAR,
            NULL::BIGINT,
            ((NOW() AT TIME ZONE 'Asia/Seoul')::DATE),
            $5::TEXT,
            'Withdrawal requested'::TEXT,
            $1::BIGINT
          ) AS ledger_id
        `,
        [req.user.id, parsedAmount, -parsedAmount, parsedAmount, ledgerKey]
      );

      const lockLedgerEntryId = ledgerResult.rows[0].ledger_id;

      const inserted = await client.query(
        `
          INSERT INTO withdrawals (
            user_id,
            network,
            requested_amount,
            destination_address,
            status,
            lock_ledger_entry_id,
            idempotency_key
          )
          VALUES ($1, $2, $3, $4, 'REQUESTED', $5, $6)
          RETURNING
            id,
            network,
            requested_amount,
            destination_address,
            status,
            requested_at,
            reviewed_at
        `,
        [
          req.user.id,
          network,
          parsedAmount,
          destinationAddress,
          lockLedgerEntryId,
          requestIdempotencyKey
        ]
      );

      return inserted.rows[0];
    });

    res.status(201).json({
      id: Number(result.id),
      network: result.network,
      requestedAmount: result.requested_amount,
      destinationAddress: result.destination_address,
      status: result.status,
      requestedAt: result.requested_at,
      reviewedAt: result.reviewed_at
    });
  })
);

router.get(
  '/withdrawals',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `
        SELECT id, network, requested_amount, destination_address, status, requested_at, reviewed_at
        FROM withdrawals
        WHERE user_id = $1
        ORDER BY id DESC
      `,
      [req.user.id]
    );

    res.json({
      items: result.rows.map((row) => ({
        id: Number(row.id),
        network: row.network,
        requestedAmount: row.requested_amount,
        destinationAddress: row.destination_address,
        status: row.status,
        requestedAt: row.requested_at,
        reviewedAt: row.reviewed_at
      }))
    });
  })
);

router.get(
  '/products',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `
        SELECT id, name, guide_text, daily_rate, profit_occurrence_limit, profit_weekdays, return_principal
        FROM products
        WHERE is_visible = TRUE
        ORDER BY id DESC
      `
    );

    res.json({
      items: result.rows.map((row) => ({
        id: Number(row.id),
        name: row.name,
        guideText: row.guide_text,
        dailyRate: row.daily_rate,
        profitOccurrenceLimit: Number(row.profit_occurrence_limit),
        profitWeekdays: row.profit_weekdays,
        returnPrincipal: row.return_principal
      }))
    });
  })
);

router.post(
  '/products/:productId/subscriptions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const productId = Number(req.params.productId);
    const parsedAmount = parseAmount(req.body.amount, 'amount');
    const requestIdempotencyKey = req.body.idempotencyKey || req.headers['x-idempotency-key'] || randomUUID();

    if (!Number.isInteger(productId) || productId <= 0) {
      throw new AppError(400, 'Invalid productId.');
    }

    const created = await withTransaction(async (client) => {
      const productResult = await client.query(
        `
          SELECT id, name, is_visible
          FROM products
          WHERE id = $1
          LIMIT 1
        `,
        [productId]
      );

      if (productResult.rowCount === 0) {
        throw new AppError(404, 'Product not found.');
      }

      if (!productResult.rows[0].is_visible) {
        throw new AppError(400, 'Product is not visible.');
      }

      const policyResult = await client.query(
        `
          SELECT *
          FROM fn_get_product_policy_for_date($1, ((NOW() AT TIME ZONE 'Asia/Seoul')::DATE))
          LIMIT 1
        `,
        [productId]
      );

      if (policyResult.rowCount === 0) {
        throw new AppError(400, 'Product policy not found.');
      }

      const policy = policyResult.rows[0];

      const userResult = await client.query(
        `SELECT balance_available FROM users WHERE id = $1 FOR UPDATE`,
        [req.user.id]
      );
      if (userResult.rowCount === 0) {
        throw new AppError(404, 'User not found.');
      }

      const available = Number(userResult.rows[0].balance_available);
      if (available < parsedAmount) {
        throw new AppError(400, 'Insufficient available balance.');
      }

      const ledgerKey = `product-join:${requestIdempotencyKey}`;
      const ledgerResult = await client.query(
        `
          SELECT fn_apply_ledger_delta(
            $1::BIGINT,
            'PRODUCT_JOINED'::ledger_entry_type,
            $2::NUMERIC,
            $3::NUMERIC,
            0::NUMERIC,
            $4::NUMERIC,
            'product_subscription'::VARCHAR,
            NULL::BIGINT,
            ((NOW() AT TIME ZONE 'Asia/Seoul')::DATE),
            $5::TEXT,
            'Product participation'::TEXT,
            $1::BIGINT
          ) AS ledger_id
        `,
        [req.user.id, parsedAmount, -parsedAmount, parsedAmount, ledgerKey]
      );

      const lockLedgerEntryId = ledgerResult.rows[0].ledger_id;

      const startDateResult = await client.query(
        `SELECT (((NOW() AT TIME ZONE 'Asia/Seoul')::DATE) + INTERVAL '1 day')::DATE AS start_date`
      );

      const inserted = await client.query(
        `
          INSERT INTO product_subscriptions (
            user_id,
            product_id,
            participation_amount,
            status,
            joined_at,
            start_business_date,
            remaining_profit_count,
            completed_profit_count,
            total_profit_amount,
            request_idempotency_key,
            principal_lock_ledger_entry_id
          )
          VALUES (
            $1,
            $2,
            $3,
            'ACTIVE',
            NOW(),
            $4,
            $5,
            0,
            0,
            $6,
            $7
          )
          RETURNING
            id,
            product_id,
            participation_amount,
            status,
            joined_at,
            remaining_profit_count,
            completed_profit_count
        `,
        [
          req.user.id,
          productId,
          parsedAmount,
          startDateResult.rows[0].start_date,
          Number(policy.profit_occurrence_limit),
          requestIdempotencyKey,
          lockLedgerEntryId
        ]
      );

      return inserted.rows[0];
    });

    res.status(201).json({
      id: Number(created.id),
      productId: Number(created.product_id),
      participationAmount: created.participation_amount,
      status: created.status,
      joinedAt: created.joined_at,
      remainingProfitCount: Number(created.remaining_profit_count),
      completedProfitCount: Number(created.completed_profit_count)
    });
  })
);

router.get(
  '/subscriptions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `
        SELECT
          id,
          product_id,
          participation_amount,
          status,
          joined_at,
          remaining_profit_count,
          completed_profit_count
        FROM product_subscriptions
        WHERE user_id = $1
        ORDER BY id DESC
      `,
      [req.user.id]
    );

    res.json({
      items: result.rows.map((row) => ({
        id: Number(row.id),
        productId: Number(row.product_id),
        participationAmount: row.participation_amount,
        status: row.status,
        joinedAt: row.joined_at,
        remainingProfitCount: Number(row.remaining_profit_count),
        completedProfitCount: Number(row.completed_profit_count)
      }))
    });
  })
);

router.post(
  '/admin/deposits/:depositId/decision',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const depositId = Number(req.params.depositId);
    const { decision, adminMemo } = req.body;

    if (!Number.isInteger(depositId) || depositId <= 0) {
      throw new AppError(400, 'Invalid depositId.');
    }

    if (decision !== 'APPROVED' && decision !== 'REJECTED') {
      throw new AppError(400, 'decision must be APPROVED or REJECTED.');
    }

    const updated = await withTransaction(async (client) => {
      const depositResult = await client.query(
        `
          SELECT id, user_id, requested_amount, status
          FROM deposits
          WHERE id = $1
          FOR UPDATE
        `,
        [depositId]
      );

      if (depositResult.rowCount === 0) {
        throw new AppError(404, 'Deposit not found.');
      }

      const deposit = depositResult.rows[0];
      if (deposit.status === 'APPROVED' || deposit.status === 'REJECTED') {
        throw new AppError(400, 'Deposit is already finalized.');
      }

      let ledgerId = null;
      if (decision === 'APPROVED') {
        const key = `deposit-approve:${deposit.id}`;
        const ledgerResult = await client.query(
          `
            SELECT fn_apply_ledger_delta(
              $1::BIGINT,
              'DEPOSIT_APPROVED'::ledger_entry_type,
              $2::NUMERIC,
              $2::NUMERIC,
              0::NUMERIC,
              0::NUMERIC,
              'deposit'::VARCHAR,
              $3::BIGINT,
              ((NOW() AT TIME ZONE 'Asia/Seoul')::DATE),
              $4::TEXT,
              'Deposit approved'::TEXT,
              $5::BIGINT
            ) AS ledger_id
          `,
          [deposit.user_id, Number(deposit.requested_amount), deposit.id, key, req.user.id]
        );
        ledgerId = ledgerResult.rows[0].ledger_id;
      }

      const result = await client.query(
        `
          UPDATE deposits
          SET
            status = $1,
            reviewed_at = NOW(),
            reviewed_by = $2,
            admin_memo = $3,
            approved_ledger_entry_id = $4,
            updated_at = NOW()
          WHERE id = $5
          RETURNING
            id,
            network,
            requested_amount,
            txid,
            status,
            requested_at,
            reviewed_at
        `,
        [decision, req.user.id, adminMemo || null, ledgerId, depositId]
      );

      return result.rows[0];
    });

    res.json({
      id: Number(updated.id),
      network: updated.network,
      requestedAmount: updated.requested_amount,
      txid: updated.txid,
      status: updated.status,
      requestedAt: updated.requested_at,
      reviewedAt: updated.reviewed_at
    });
  })
);

router.post(
  '/admin/withdrawals/:withdrawalId/decision',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const withdrawalId = Number(req.params.withdrawalId);
    const { decision, chainTxid, adminMemo } = req.body;

    if (!Number.isInteger(withdrawalId) || withdrawalId <= 0) {
      throw new AppError(400, 'Invalid withdrawalId.');
    }

    if (!['COMPLETED', 'FAILED', 'CANCELED'].includes(decision)) {
      throw new AppError(400, 'decision must be COMPLETED, FAILED, or CANCELED.');
    }

    if (chainTxid) {
      assertValidTxid(chainTxid);
    }

    const updated = await withTransaction(async (client) => {
      const wdResult = await client.query(
        `
          SELECT id, user_id, requested_amount, status
          FROM withdrawals
          WHERE id = $1
          FOR UPDATE
        `,
        [withdrawalId]
      );

      if (wdResult.rowCount === 0) {
        throw new AppError(404, 'Withdrawal not found.');
      }

      const wd = wdResult.rows[0];
      if (['COMPLETED', 'FAILED', 'CANCELED'].includes(wd.status)) {
        throw new AppError(400, 'Withdrawal is already finalized.');
      }

      let entryType = 'WITHDRAW_COMPLETED';
      let deltaAvailable = 0;
      let deltaWithdrawLocked = -Number(wd.requested_amount);
      let deltaPrincipal = 0;

      if (decision === 'FAILED') {
        entryType = 'WITHDRAW_FAILED';
        deltaAvailable = Number(wd.requested_amount);
      }

      if (decision === 'CANCELED') {
        entryType = 'WITHDRAW_CANCELED';
        deltaAvailable = Number(wd.requested_amount);
      }

      const key = `withdraw-finalize:${decision.toLowerCase()}:${wd.id}`;

      const ledgerResult = await client.query(
        `
          SELECT fn_apply_ledger_delta(
            $1::BIGINT,
            $2::ledger_entry_type,
            $3::NUMERIC,
            $4::NUMERIC,
            $5::NUMERIC,
            $6::NUMERIC,
            'withdrawal'::VARCHAR,
            $7::BIGINT,
            ((NOW() AT TIME ZONE 'Asia/Seoul')::DATE),
            $8::TEXT,
            'Withdrawal finalized'::TEXT,
            $9::BIGINT
          ) AS ledger_id
        `,
        [
          wd.user_id,
          entryType,
          Number(wd.requested_amount),
          deltaAvailable,
          deltaWithdrawLocked,
          deltaPrincipal,
          wd.id,
          key,
          req.user.id
        ]
      );

      const ledgerId = ledgerResult.rows[0].ledger_id;

      const result = await client.query(
        `
          UPDATE withdrawals
          SET
            status = $1,
            reviewed_at = NOW(),
            reviewed_by = $2,
            chain_txid = $3,
            admin_memo = $4,
            finalize_ledger_entry_id = $5,
            updated_at = NOW()
          WHERE id = $6
          RETURNING
            id,
            network,
            requested_amount,
            destination_address,
            status,
            requested_at,
            reviewed_at
        `,
        [decision, req.user.id, chainTxid || null, adminMemo || null, ledgerId, wd.id]
      );

      return result.rows[0];
    });

    res.json({
      id: Number(updated.id),
      network: updated.network,
      requestedAmount: updated.requested_amount,
      destinationAddress: updated.destination_address,
      status: updated.status,
      requestedAt: updated.requested_at,
      reviewedAt: updated.reviewed_at
    });
  })
);

router.post(
  '/admin/batch/run',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const businessDate = req.body?.businessDate || null;

    const result = await pool.query(
      `
        SELECT fn_run_daily_batch(
          COALESCE($1::DATE, ((NOW() AT TIME ZONE 'Asia/Seoul')::DATE)),
          $2::BIGINT
        ) AS result
      `,
      [businessDate, req.user.id]
    );

    res.json({ result: result.rows[0].result });
  })
);

export default router;
