import { describe, it, expect } from 'vitest';
import { appOrigin } from '../../src/lib/app-origin';
import { paymentSummary } from '../../src/lib/billing';
import type { Bundle } from '../../src/types/domain';
describe('deployment links', () => {
  it('ignores localhost copied into Vercel and uses the production domain', () => {
    expect(
      appOrigin({
        VERCEL: '1',
        VERCEL_ENV: 'production',
        NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
        VERCEL_PROJECT_PRODUCTION_URL: 'makrab-planner.vercel.app',
        VERCEL_URL: 'build-123.vercel.app',
      }),
    ).toBe('https://makrab-planner.vercel.app');
  });
  it('supports explicit custom HTTPS domains and trims paths', () => {
    expect(appOrigin({ VERCEL: '1', NEXT_PUBLIC_APP_URL: 'https://makrab.example.com/' })).toBe(
      'https://makrab.example.com',
    );
  });
  it('uses the deployment domain for previews, and fails closed without a public domain', () => {
    expect(
      appOrigin({
        VERCEL: '1',
        VERCEL_ENV: 'preview',
        VERCEL_URL: 'branch-123.vercel.app',
        VERCEL_PROJECT_PRODUCTION_URL: 'makrab.vercel.app',
      }),
    ).toBe('https://branch-123.vercel.app');
    expect(() => appOrigin({ VERCEL: '1', NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3000' })).toThrow(
      'domain',
    );
    expect(() => appOrigin({ VERCEL: '1', NEXT_PUBLIC_APP_URL: 'javascript:alert(1)' })).toThrow();
  });
  it('keeps local development URLs local', () => {
    expect(appOrigin({ NEXT_PUBLIC_APP_URL: 'http://localhost:3001/' })).toBe(
      'http://localhost:3001',
    );
  });
});
describe('payment totals', () => {
  it('includes every participant and preserves pending/verified charges after a price change', () => {
    const data = {
      event: { cost_per_person: 400000 },
      participants: ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id })),
      payments: [
        { participant_id: 'a', amount: 350000, status: 'VERIFIED' },
        { participant_id: 'b', amount: 350000, status: 'PENDING' },
        { participant_id: 'c', amount: 350000, status: 'REJECTED' },
      ],
    } as Bundle;
    const summary = paymentSummary(data);
    expect(summary.rows.map((r) => r.due)).toEqual([350000, 350000, 400000, 400000]);
    expect(summary.rows[3].status).toBe('NOT_SUBMITTED');
    expect(summary.expected).toBe(1500000);
    expect(summary.verified).toBe(350000);
    expect(summary.pending).toBe(350000);
    expect(summary.outstanding).toBe(1150000);
  });
});
