import { queueItems, userRows } from '../../../data/mockAdmin';
import type { PolicySetting } from '../../../types/admin';

export const seedPolicies: PolicySetting[] = [
  { key: 'send_limit_basic_usd', value: '10000', updatedAt: '2026-04-16 10:10', updatedBy: 'seed' },
  { key: 'send_limit_pro_usd', value: '50000', updatedAt: '2026-04-16 10:10', updatedBy: 'seed' },
  { key: 'send_limit_vip_usd', value: '250000', updatedAt: '2026-04-16 10:10', updatedBy: 'seed' },
  { key: 'require_mfa_for_limit_change', value: 'true', updatedAt: '2026-04-16 10:10', updatedBy: 'seed' }
];

export const seedUsers = userRows;
export const seedQueue = queueItems;
