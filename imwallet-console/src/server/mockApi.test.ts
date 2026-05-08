import { describe, expect, it } from 'vitest';
import { mockApi } from './mockApi';

describe('mockApi auth and dashboard flow', () => {
  it('rejects invalid credentials', async () => {
    await expect(mockApi.login('invalid@imwallet.local', 'wrong-password')).rejects.toThrow('Invalid credentials');
  });

  it('logs in with MFA and returns dashboard payload', async () => {
    const challenge = await mockApi.login('admin@imwallet.local', 'admin123!@#');
    const session = await mockApi.verifyMfa(challenge.id, '000000');
    const dashboard = await mockApi.getDashboard(session.token);

    expect(session.role).toBe('admin');
    expect(dashboard.assets.length).toBeGreaterThan(0);
    expect(dashboard.queue.length).toBeGreaterThan(0);
    expect(dashboard.users.length).toBeGreaterThan(0);

    await mockApi.logout(session.token);
  });

  it('returns validation reject for malformed withdrawal payload', async () => {
    const challenge = await mockApi.login('ops@imwallet.local', 'ops123!@#');
    const session = await mockApi.verifyMfa(challenge.id, '000000');

    const result = await mockApi.validateWithdrawal(session.token, {
      chain: 'ETH',
      asset: 'ETH',
      address: 'wrong-address',
      amount: 10,
      userTier: 'Pro'
    });

    expect(result.ok).toBe(false);
    expect(result.requiresManualReview).toBe(true);
    expect(result.reason).toContain('Address format');
  });
});
