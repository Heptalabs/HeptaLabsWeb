import { mockApi } from '../server/mockApi';
import { evaluateWithdrawalRisk } from '../server/riskRules';
import { validateWithdrawalRequest } from '../server/validators';
import { adminAssets, chainHealthRows, queueItems, userRows } from '../data/mockAdmin';
import type {
  AdminContentItem,
  AdminContentUpsertInput,
  AdminRole,
  AdminSession,
  AuditLogItem,
  DiscoverClickLogItem,
  DiscoverClickSummary,
  DashboardPayload,
  MfaChallenge,
  PolicySetting,
  WithdrawalValidationRequest
} from '../types/admin';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');
const env = (import.meta as ImportMeta & { env?: Record<string, string | boolean | undefined> }).env || {};
const hasMockFlag = typeof env.VITE_USE_MOCK_API === 'string';
const useMockApi = hasMockFlag ? String(env.VITE_USE_MOCK_API).trim().toLowerCase() === 'true' : Boolean(env.DEV);
if (!env.DEV && useMockApi) {
  throw new Error('VITE_USE_MOCK_API=true is blocked for non-development builds.');
}
let adminBearerToken: string | null = null;
export const setAdminBearerToken = (token: string | null) => {
  adminBearerToken = token && token.trim() ? token.trim() : null;
};

const mapBackendRole = (rawRole: unknown): AdminRole => {
  const role = String(rawRole || '')
    .trim()
    .toLowerCase();
  if (role === 'admin' || role === 'super_admin') return 'admin';
  if (role === 'operator' || role === 'ops') return 'operator';
  if (role === 'compliance') return 'compliance';
  return 'viewer';
};

const nowStamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

let backendQueueState = [...queueItems];
let backendUsersState = [...userRows];
let backendPolicyState: PolicySetting[] = [
  { key: 'send_limit_basic_usd', value: '10000', updatedAt: nowStamp(), updatedBy: 'system' },
  { key: 'send_limit_pro_usd', value: '50000', updatedAt: nowStamp(), updatedBy: 'system' },
  { key: 'send_limit_vip_usd', value: '250000', updatedAt: nowStamp(), updatedBy: 'system' },
  { key: 'require_mfa_for_limit_change', value: 'true', updatedAt: nowStamp(), updatedBy: 'system' }
];
let backendAuditState: AuditLogItem[] = [
  {
    id: `AUD-${Date.now()}`,
    action: 'BACKEND_CONSOLE_BOOT',
    actor: 'system',
    scope: 'console',
    summary: 'Backend console bridge is active.',
    createdAt: nowStamp()
  }
];

const appendBackendAudit = (entry: Omit<AuditLogItem, 'id' | 'createdAt'>) => {
  const item: AuditLogItem = {
    ...entry,
    id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    createdAt: nowStamp()
  };
  backendAuditState = [item, ...backendAuditState].slice(0, 200);
};

const resolveBackendBaseUrl = () => {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const fromEnv = env?.VITE_BACKEND_BASE_URL?.trim();
  if (fromEnv) return trimTrailingSlash(fromEnv);

  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const host = window.location.hostname || 'localhost';
    return `${protocol}//${host}:4000`;
  }

  return 'http://localhost:4000';
};

const callBackend = async <T>(
  path: string,
  init?: RequestInit & { adminRole?: AdminRole; adminActor?: string; bearerToken?: string | null }
): Promise<T> => {
  const roleHeaders =
    init?.adminRole || init?.adminActor
      ? {
          ...(init?.adminRole ? { 'x-admin-role': init.adminRole } : {}),
          ...(init?.adminActor ? { 'x-admin-actor': init.adminActor } : {})
        }
      : {};
  const token = init?.bearerToken === undefined ? adminBearerToken : init?.bearerToken;
  const response = await fetch(`${resolveBackendBaseUrl()}${path}`, {
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...roleHeaders,
      ...(init?.headers || {})
    },
    ...init
  });

  if (!response.ok) {
    const fallbackError = `Backend request failed (${response.status})`;
    let message = fallbackError;
    try {
      const payload = (await response.json()) as { message?: string; error?: string };
      message = payload?.message || payload?.error || fallbackError;
    } catch {
      // ignore json parse errors
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
};

const buildBackendDashboard = async (token: string): Promise<DashboardPayload> => {
  const [profile, popularTokens, deposits, withdrawals] = await Promise.all([
    callBackend<{
      id: number;
      uid: number;
      loginId?: string;
      name?: string;
      level?: number;
      balances?: { total?: number };
    }>('/api/v1/me', { bearerToken: token }),
    callBackend<{ tokens?: Array<{ symbol?: string; priceUsd?: number; change24h?: number }> }>('/api/v1/market/popular-tokens?limit=5').catch(
      () => ({ tokens: [] })
    ),
    callBackend<{ items?: Array<{ id: number; network: string; requestedAmount: number; status: string; requestedAt: string }> }>(
      '/api/v1/deposits',
      { bearerToken: token }
    ).catch(() => ({ items: [] })),
    callBackend<
      { items?: Array<{ id: number; network: string; requestedAmount: number; destinationAddress: string; status: string; requestedAt: string }> }
    >('/api/v1/withdrawals', { bearerToken: token }).catch(() => ({ items: [] }))
  ]);

  const fallbackAssets = [...adminAssets];
  const dynamicAssets =
    Array.isArray(popularTokens?.tokens) && popularTokens.tokens.length
      ? popularTokens.tokens.slice(0, 5).map((item) => ({
          symbol: String(item.symbol || 'ASSET').toUpperCase(),
          network: 'Multi-chain',
          holders: 0,
          walletBalance: 0,
          usdExposure: Number(item.priceUsd || 0),
          change24h: Number(item.change24h || 0),
          risk: 'low' as const
        }))
      : fallbackAssets;

  const mappedDepositQueue = (deposits.items || []).slice(0, 10).map((item) => ({
    id: `D-${item.id}`,
    user: profile?.name || profile?.loginId || `UID ${profile?.uid || '-'}`,
    tier: 'Basic' as const,
    flow: 'receive' as const,
    asset: 'USDT',
    amount: Number(item.requestedAmount || 0),
    usdValue: Number(item.requestedAmount || 0),
    network: item.network || 'TRC20',
    status: item.status === 'REQUESTED' ? ('pending' as const) : item.status === 'REJECTED' ? ('blocked' as const) : ('approved' as const),
    riskScore: item.status === 'REQUESTED' ? 40 : 20,
    createdAt: item.requestedAt || nowStamp()
  }));

  const mappedWithdrawQueue = (withdrawals.items || []).slice(0, 10).map((item) => ({
    id: `W-${item.id}`,
    user: profile?.name || profile?.loginId || `UID ${profile?.uid || '-'}`,
    tier: 'Basic' as const,
    flow: 'send' as const,
    asset: 'USDT',
    amount: Number(item.requestedAmount || 0),
    usdValue: Number(item.requestedAmount || 0),
    network: item.network || 'TRC20',
    status: item.status === 'REQUESTED' || item.status === 'REVIEW_PENDING' ? ('manual-review' as const) : item.status === 'FAILED' ? ('blocked' as const) : ('approved' as const),
    riskScore: item.status === 'REQUESTED' ? 66 : 32,
    createdAt: item.requestedAt || nowStamp()
  }));

  backendQueueState = [...mappedWithdrawQueue, ...mappedDepositQueue].slice(0, 20);

  const walletUsd = Number(profile?.balances?.total || 0);
  const tier = Number(profile?.level || 0) >= 6 ? 'VIP' : Number(profile?.level || 0) >= 3 ? 'Pro' : 'Basic';
  backendUsersState = [
    {
      id: `U-${profile?.uid || profile?.id || 0}`,
      name: profile?.name || profile?.loginId || 'Current User',
      tier,
      walletUsd,
      lastActive: 'now',
      kyc: 'verified',
      sendLimitUsd: tier === 'VIP' ? 250000 : tier === 'Pro' ? 50000 : 10000
    },
    ...userRows.slice(0, 3)
  ];

  appendBackendAudit({
    action: 'DASHBOARD_REFRESH',
    actor: profile?.loginId || 'backend-user',
    scope: 'dashboard',
    summary: 'Dashboard snapshot loaded from backend bridge.'
  });

  return {
    assets: dynamicAssets,
    queue: [...backendQueueState],
    chainHealth: [...chainHealthRows],
    users: [...backendUsersState],
    policies: [...backendPolicyState],
    auditLogs: [...backendAuditState]
  };
};

export const adminApiClient = {
  login: async (email: string, password: string): Promise<MfaChallenge | AdminSession> => {
    if (useMockApi) {
      return mockApi.login(email, password);
    }

    const payload = await callBackend<{
      token: string;
      user?: {
        id?: number;
        uid?: number;
        loginId?: string;
        login_id?: string;
        role?: string;
        name?: string;
      };
    }>('/api/v1/auth/login', {
      method: 'POST',
      bearerToken: null,
      body: JSON.stringify({
        loginId: email.trim(),
        password
      })
    });

    const loginId = String(payload.user?.loginId || payload.user?.login_id || email || '').trim();
    const role = mapBackendRole(payload.user?.role);
    return {
      token: String(payload.token || ''),
      userId: String(payload.user?.id || payload.user?.uid || loginId || 'backend-user'),
      email: loginId || email,
      role,
      displayName: payload.user?.name || loginId || 'Console Admin',
      issuedAt: new Date().toISOString()
    };
  },
  verifyMfa: (challengeId: string, code: string): Promise<AdminSession> => {
    if (!useMockApi) {
      throw new Error('MFA challenge flow is only used in mock mode.');
    }
    return mockApi.verifyMfa(challengeId, code);
  },
  logout: (token: string): Promise<void> => {
    if (!useMockApi) {
      return Promise.resolve();
    }
    return mockApi.logout(token);
  },
  getDashboard: (token: string): Promise<DashboardPayload> => {
    if (useMockApi) {
      return mockApi.getDashboard(token);
    }
    return buildBackendDashboard(token);
  },
  updatePolicy: async (token: string, key: string, value: string) => {
    if (useMockApi) {
      return mockApi.updatePolicy(token, key, value);
    }

    const found = backendPolicyState.find((item) => item.key === key);
    if (!found) {
      throw new Error(`Policy key not found: ${key}`);
    }

    const updated: PolicySetting = {
      ...found,
      value,
      updatedAt: nowStamp(),
      updatedBy: 'backend-user'
    };
    backendPolicyState = backendPolicyState.map((item) => (item.key === key ? updated : item));
    appendBackendAudit({
      action: 'POLICY_UPDATE',
      actor: 'backend-user',
      scope: 'policy',
      summary: `${key} => ${value}`
    });
    return updated;
  },
  updateUserLimit: async (token: string, userId: string, sendLimitUsd: number) => {
    if (useMockApi) {
      return mockApi.updateUserLimit(token, userId, sendLimitUsd);
    }

    backendUsersState = backendUsersState.map((user) => (user.id === userId ? { ...user, sendLimitUsd } : user));
    appendBackendAudit({
      action: 'USER_LIMIT_UPDATE',
      actor: 'backend-user',
      scope: 'user',
      summary: `${userId} => ${sendLimitUsd}`
    });
    return backendUsersState.find((item) => item.id === userId) ?? null;
  },
  runRiskScan: async (token: string) => {
    if (useMockApi) {
      return mockApi.runRiskScan(token);
    }

    backendQueueState = backendQueueState.map((item) => {
      const nextRisk = Math.max(5, Math.min(99, item.riskScore + (Math.random() > 0.5 ? 4 : -3)));
      return {
        ...item,
        riskScore: nextRisk,
        status: nextRisk >= 80 ? 'manual-review' : item.status
      };
    });
    appendBackendAudit({
      action: 'RISK_SCAN_RUN',
      actor: 'backend-user',
      scope: 'risk',
      summary: 'Queue risk scores recalculated.'
    });
    return [...backendQueueState];
  },
  validateWithdrawal: async (token: string, request: WithdrawalValidationRequest) => {
    if (useMockApi) {
      return mockApi.validateWithdrawal(token, request);
    }

    const validationError = validateWithdrawalRequest(request);
    if (validationError) {
      return {
        ok: false,
        riskScore: 99,
        reason: validationError,
        requiresManualReview: true
      };
    }
    return evaluateWithdrawalRisk(request);
  },
  getContentItems: (adminRole?: AdminRole) =>
    callBackend<{ items: AdminContentItem[] }>('/api/v1/content/admin/items', { adminRole }).then((payload) => payload.items || []),
  createContentItem: (payload: AdminContentUpsertInput, adminRole?: AdminRole, adminActor?: string) =>
    callBackend<AdminContentItem>('/api/v1/content/admin/items', {
      method: 'POST',
      adminRole,
      adminActor,
      body: JSON.stringify(payload)
    }),
  updateContentItem: (id: string, payload: Partial<AdminContentUpsertInput>, adminRole?: AdminRole, adminActor?: string) =>
    callBackend<AdminContentItem>(`/api/v1/content/admin/items/${id}`, {
      method: 'PATCH',
      adminRole,
      adminActor,
      body: JSON.stringify(payload)
    }),
  deleteContentItem: (id: string, adminRole?: AdminRole, adminActor?: string) =>
    callBackend<void>(`/api/v1/content/admin/items/${id}`, {
      method: 'DELETE',
      adminRole,
      adminActor
    }),
  refreshContentFeed: (adminRole?: AdminRole, adminActor?: string) =>
    callBackend<{ fetchedAt: string; source: string; stale: boolean; count: number }>('/api/v1/content/admin/refresh', {
      method: 'POST',
      adminRole,
      adminActor
    }),
  uploadContentImage: (payload: { fileName: string; mimeType: string; dataBase64: string }, adminRole?: AdminRole, adminActor?: string) =>
    callBackend<{ imageUrl: string; fileName: string; bytes: number; uploadedAt: string }>('/api/v1/content/admin/upload-image', {
      method: 'POST',
      adminRole,
      adminActor,
      body: JSON.stringify(payload)
    }),
  getDiscoverClickLogs: (limit = 50, adminRole?: AdminRole) =>
    callBackend<{ items: DiscoverClickLogItem[] }>(`/api/v1/content/admin/clicks?limit=${Math.max(1, Math.min(200, limit))}`, {
      adminRole
    }).then((payload) => payload.items || []),
  getDiscoverClickSummary: (days = 7, adminRole?: AdminRole) =>
    callBackend<DiscoverClickSummary>(`/api/v1/content/admin/clicks/summary?days=${Math.max(1, Math.min(90, days))}`, { adminRole })
};
