import { describe, expect, it } from 'vitest';
import { canAccessNav, getFirstNav, getRoleNav } from './accessControl';

describe('accessControl', () => {
  it('returns expected first nav by role', () => {
    expect(getFirstNav('admin')).toBe('overview');
    expect(getFirstNav('operator')).toBe('overview');
    expect(getFirstNav('compliance')).toBe('overview');
    expect(getFirstNav('viewer')).toBe('overview');
  });

  it('enforces viewer restrictions', () => {
    expect(getRoleNav('viewer')).toEqual(['overview', 'content']);
    expect(canAccessNav('viewer', 'overview')).toBe(true);
    expect(canAccessNav('viewer', 'transactions')).toBe(false);
    expect(canAccessNav('viewer', 'users')).toBe(false);
    expect(canAccessNav('viewer', 'policies')).toBe(false);
    expect(canAccessNav('viewer', 'audit')).toBe(false);
    expect(canAccessNav('viewer', 'content')).toBe(true);
  });

  it('grants admin full access', () => {
    expect(canAccessNav('admin', 'overview')).toBe(true);
    expect(canAccessNav('admin', 'transactions')).toBe(true);
    expect(canAccessNav('admin', 'users')).toBe(true);
    expect(canAccessNav('admin', 'policies')).toBe(true);
    expect(canAccessNav('admin', 'audit')).toBe(true);
    expect(canAccessNav('admin', 'content')).toBe(true);
  });
});
