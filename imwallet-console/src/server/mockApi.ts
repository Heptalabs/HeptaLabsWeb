import { adminAssets, chainHealthRows, queueItems, userRows } from '../data/mockAdmin';
import type {
  AdminRole,
  AdminSession,
  AuditLogItem,
  DashboardPayload,
  MfaChallenge,
  PolicySetting,
  WithdrawalValidationRequest,
  WithdrawalValidationResult
} from '../types/admin';
import { evaluateWithdrawalRisk } from './riskRules';
import { validateWithdrawalRequest } from './validators';

type AdminUserCredential = {
  userId: string;
  displayName: string;
  email: string;
  password: string;
  role: AdminRole;
};

const credentials: AdminUserCredential[] = [
  {
    userId: 'adm-001',
    displayName: 'Ops Console',
    email: 'admin@imwallet.local',
    password: 'admin123!@#',
    role: 'admin'
  },
  {
    userId: 'adm-002',
    displayName: 'Ops Team',
    email: 'ops@imwallet.local',
    password: 'ops123!@#',
    role: 'operator'
  },
  {
    userId: 'adm-003',
    displayName: 'Compliance',
    email: 'compliance@imwallet.local',
    password: 'cmp123!@#',
    role: 'compliance'
  }
];

let policyState: PolicySetting[] = [
  { key: 'send_limit_basic_usd', value: '10000', updatedAt: '2026-04-16 10:10', updatedBy: 'system' },
  { key: 'send_limit_pro_usd', value: '50000', updatedAt: '2026-04-16 10:10', updatedBy: 'system' },
  { key: 'send_limit_vip_usd', value: '250000', updatedAt: '2026-04-16 10:10', updatedBy: 'system' },
  { key: 'require_mfa_for_limit_change', value: 'true', updatedAt: '2026-04-16 10:10', updatedBy: 'system' }
];

let queueState = [...queueItems];
let usersState = [...userRows];
let auditLogState: AuditLogItem[] = [
  {
    id: 'AUD-9001',
    action: 'SESSION_BOOTSTRAP',
    actor: 'system',
    scope: 'auth',
    summary: 'Mock server initialized',
    createdAt: '2026-04-16 09:00'
  }
];

const mfaChallenges = new Map<string, { email: string; expiresAt: string; code: string }>();
const sessions = new Map<string, AdminSession>();

const nowStamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

const appendAudit = (entry: Omit<AuditLogItem, 'id' | 'createdAt'>) => {
  const item: AuditLogItem = {
    ...entry,
    id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    createdAt: nowStamp()
  };

  auditLogState = [item, ...auditLogState].slice(0, 500);
};

const requireSession = (token: string): AdminSession => {
  const session = sessions.get(token);
  if (!session) {
    throw new Error('Unauthorized session');
  }
  return session;
};

const delay = async (ms = 180) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export const mockApi = {
  async login(email: string, password: string): Promise<MfaChallenge> {
    await delay();

    const found = credentials.find((item) => item.email === email && item.password === password);
    if (!found) throw new Error('Invalid credentials');

    const challengeId = `mfa-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();

    mfaChallenges.set(challengeId, {
      email,
      expiresAt,
      code: '000000'
    });

    appendAudit({
      action: 'AUTH_LOGIN_CHALLENGE',
      actor: email,
      scope: 'auth',
      summary: 'MFA challenge issued'
    });

    return {
      id: challengeId,
      email,
      expiresAt,
      maskedTo: `${email.slice(0, 2)}***`
    };
  },

  async verifyMfa(challengeId: string, code: string): Promise<AdminSession> {
    await delay();

    const challenge = mfaChallenges.get(challengeId);
    if (!challenge) throw new Error('MFA challenge not found');
    if (new Date(challenge.expiresAt).getTime() < Date.now()) throw new Error('MFA challenge expired');
    if (challenge.code !== code) throw new Error('Invalid MFA code');

    const account = credentials.find((item) => item.email === challenge.email);
    if (!account) throw new Error('Account not found');

    const session: AdminSession = {
      token: `sess-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId: account.userId,
      email: account.email,
      role: account.role,
      displayName: account.displayName,
      issuedAt: nowStamp()
    };

    sessions.set(session.token, session);
    mfaChallenges.delete(challengeId);

    appendAudit({
      action: 'AUTH_LOGIN_SUCCESS',
      actor: account.email,
      scope: 'auth',
      summary: `Session opened as ${account.role}`
    });

    return session;
  },

  async logout(token: string): Promise<void> {
    await delay();
    const session = sessions.get(token);
    sessions.delete(token);
    if (session) {
      appendAudit({
        action: 'AUTH_LOGOUT',
        actor: session.email,
        scope: 'auth',
        summary: 'Session closed'
      });
    }
  },

  async getDashboard(token: string): Promise<DashboardPayload> {
    const session = requireSession(token);
    await delay();

    appendAudit({
      action: 'DASHBOARD_VIEW',
      actor: session.email,
      scope: 'dashboard',
      summary: 'Loaded admin dashboard snapshot'
    });

    return {
      assets: [...adminAssets],
      queue: [...queueState],
      chainHealth: [...chainHealthRows],
      users: [...usersState],
      policies: [...policyState],
      auditLogs: [...auditLogState]
    };
  },

  async updatePolicy(token: string, key: string, value: string): Promise<PolicySetting> {
    const session = requireSession(token);
    await delay();

    const index = policyState.findIndex((item) => item.key === key);
    if (index < 0) throw new Error('Policy not found');

    policyState[index] = {
      ...policyState[index],
      value,
      updatedAt: nowStamp(),
      updatedBy: session.email
    };

    appendAudit({
      action: 'POLICY_UPDATE',
      actor: session.email,
      scope: 'policy',
      summary: `${key} => ${value}`
    });

    return policyState[index];
  },

  async updateUserLimit(token: string, userId: string, sendLimitUsd: number) {
    const session = requireSession(token);
    await delay();

    usersState = usersState.map((user) => (user.id === userId ? { ...user, sendLimitUsd } : user));

    appendAudit({
      action: 'USER_LIMIT_UPDATE',
      actor: session.email,
      scope: 'user',
      summary: `${userId} limit=${sendLimitUsd}`
    });

    return usersState.find((user) => user.id === userId) ?? null;
  },

  async runRiskScan(token: string) {
    const session = requireSession(token);
    await delay(400);

    queueState = queueState.map((item) => {
      const nextRisk = Math.max(5, Math.min(99, item.riskScore + (Math.random() > 0.5 ? 4 : -3)));
      return {
        ...item,
        riskScore: nextRisk,
        status: nextRisk >= 80 ? 'manual-review' : item.status
      };
    });

    appendAudit({
      action: 'RISK_SCAN_RUN',
      actor: session.email,
      scope: 'risk',
      summary: 'Queue risks recalculated'
    });

    return [...queueState];
  },

  async validateWithdrawal(token: string, request: WithdrawalValidationRequest): Promise<WithdrawalValidationResult> {
    const session = requireSession(token);
    await delay();

    const validationError = validateWithdrawalRequest(request);
    if (validationError) {
      appendAudit({
        action: 'WITHDRAWAL_VALIDATE_REJECT',
        actor: session.email,
        scope: 'withdrawal',
        summary: validationError
      });

      return {
        ok: false,
        riskScore: 99,
        reason: validationError,
        requiresManualReview: true
      };
    }

    const result = evaluateWithdrawalRisk(request);

    appendAudit({
      action: result.ok ? 'WITHDRAWAL_VALIDATE_PASS' : 'WITHDRAWAL_VALIDATE_FLAG',
      actor: session.email,
      scope: 'withdrawal',
      summary: `${request.chain}/${request.asset} amount=${request.amount} risk=${result.riskScore}`
    });

    return result;
  }
};
