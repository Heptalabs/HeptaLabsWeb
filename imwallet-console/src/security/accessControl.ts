import type { AdminRole } from '../types/admin';

export type AdminNavKey = 'overview' | 'transactions' | 'users' | 'policies' | 'audit' | 'content';

const navOrder: AdminNavKey[] = ['overview', 'transactions', 'users', 'policies', 'audit', 'content'];

export const roleNavAccess: Record<AdminRole, AdminNavKey[]> = {
  viewer: ['overview', 'content'],
  operator: ['overview', 'transactions', 'users', 'content'],
  compliance: ['overview', 'transactions', 'policies', 'audit', 'content'],
  admin: navOrder
};

export const getRoleNav = (role: AdminRole): AdminNavKey[] => roleNavAccess[role];

export const canAccessNav = (role: AdminRole, nav: AdminNavKey): boolean => getRoleNav(role).includes(nav);

export const getFirstNav = (role: AdminRole): AdminNavKey => getRoleNav(role)[0] ?? 'overview';
