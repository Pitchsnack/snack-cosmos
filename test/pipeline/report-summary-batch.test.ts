import { describe, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({ role: vi.fn(async (_uid: string, roles: string[]) => roles[0] ?? 'buyer'), workspace: vi.fn(async () => ['mine']), tables: {} as Record<string, any[]> }));
vi.mock('@/lib/plan-access.server', () => ({ requireRole: fake.role }));
vi.mock('@/lib/workspace-scope.server', () => ({ myWorkspaceStartupIds: fake.workspace, scopeStartupIds: async (_uid: string, ids: string[]) => ids.filter(id => id === 'mine') }));
function query(table: string) {
  let values = fake.tables[table] ?? [];
  const q: any = { select: () => q, order: () => q, maybeSingle: async () => ({ data: values[0], error: null }), eq: (key: string, value: unknown) => { values = values.filter(r => r[key] === value); return q; }, in: (key: string, ids: unknown[]) => { values = values.filter(r => ids.includes(r[key])); return q; }, is: (key: string) => { values = values.filter(r => r[key] == null); return q; }, not: () => q, then: (resolve: any) => resolve({ data: values, error: null }) };
  return q;
}
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { from: query, rpc: async () => ({ data: { method: 'Paid' } }) } }));
import { pipelineReportSummaries, projectPipelineReportSummary } from '../../src/lib/pipeline-report-summary.server';
import { hubData } from '../../src/lib/reports-hub.server';

const p = { id: 'a', startup_id: 'mine', buyer_user_id: 'me', nda_approved_at: '2026-11-01', nda_expires_at: '2027-11-01', status: 'active', report_viewed_at: null };
const tables = () => ({ records: [], orders: [], verifications: [], filings: [], shares: [], access: [], requests: [], verificationAccess: [], quotes: {} });
describe('read-only report summary access and precedence', () => {
  it('discovers several buyer deals itself and omits another buyer, expired and unsigned deals', async () => {
    fake.tables = { deal_pipelines: [p, { ...p, id: 'b' }, { ...p, id: 'other', buyer_user_id: 'other' }, { ...p, id: 'expired', nda_expires_at: '2020-01-01' }, { ...p, id: 'unsigned', nda_approved_at: null }] };
    const result = await pipelineReportSummaries({ userId: 'me' }, 'buyer');
    expect(Object.keys(result)).toEqual(['a', 'b']);
    expect(fake.role).toHaveBeenCalledWith('me', ['buyer']);
    expect(result['a']).toEqual({ count: 0, fresh: false, waitingCount: 0 });
  });
  it('seller summaries are restricted to the active workspace and existing owner check', async () => {
    fake.tables = { deal_pipelines: [p, { ...p, id: 'foreign', startup_id: 'foreign' }] };
    const ctx = { userId: 'me', supabase: { rpc: async () => ({ data: true }) } };
    expect(Object.keys(await pipelineReportSummaries(ctx, 'seller'))).toEqual(['a']);
    expect(Object.keys(await pipelineReportSummaries({ ...ctx, supabase: { rpc: async () => ({ data: false }) } }, 'seller'))).toEqual([]);
  });
  it('counts an authorised unopened shared report and preserves its new indicator', () => {
    const t: any = tables();
    t.records = [{ company_id: 'mine', report_key: 'credit', authorised_at: '2026-11-02', generated_at: '2026-11-01' }];
    t.shares = [{ pipeline_id: 'a', report_keys: ['credit'] }];
    expect(projectPipelineReportSummary(p, false, t)).toEqual({ count: 1, fresh: true, waitingCount: 1 });
    t.shares[0].report_opened_at = { credit: '2026-11-03' };
    expect(projectPipelineReportSummary(p, false, t)).toEqual({ count: 1, fresh: false, waitingCount: 0 });
  });
  it('preserves seller requests but does not count a request for a shared report', () => {
    const t: any = tables(); t.requests = [{ company_id: 'mine', buyer_id: 'me', report_key: 'credit', status: 'open' }];
    expect(projectPipelineReportSummary(p, true, t).waitingCount).toBe(1);
    t.shares = [{ pipeline_id: 'a', report_keys: ['credit'] }];
    expect(projectPipelineReportSummary(p, true, t).waitingCount).toBe(0);
  });
  it('preserves plan count only for ready reports, without granting report content', () => {
    const t: any = tables(); t.quotes.credit = { method: 'Plan' };
    expect(projectPipelineReportSummary(p, false, t).count).toBe(0);
    t.records = [{ company_id: 'mine', report_key: 'credit', authorised_at: '2026-11-02' }];
    expect(projectPipelineReportSummary(p, false, t)).toEqual({ count: 1, fresh: true, waitingCount: 0 });
  });
  it('matches the existing full hub count, fresh flag and waiting rows for both sides', async () => {
    fake.tables = {
      startups: [{ id: 'mine', startup_name: 'Company' }], deal_pipelines: [p],
      company_report_records: [{ company_id: 'mine', report_key: 'credit', authorised_at: '2026-11-02', generated_at: '2026-11-01' }],
      report_shares: [{ business_id: 'mine', pipeline_id: 'a', report_keys: ['credit'], report_opened_at: {} }],
      report_share_requests: [{ company_id: 'mine', pipeline_id: 'a', buyer_id: 'me', report_key: 'risk', status: 'open' }],
      buyer_report_access: [{ company_id: 'mine', buyer_id: 'me', report_key: 'pnl', opened_at: '2026-11-03' }],
    };
    const ctx = { userId: 'me', supabase: { from: query, rpc: async () => ({ data: true }) } };
    for (const mode of ['buyer', 'seller'] as const) {
      const hub = await hubData(ctx, mode, undefined, p.id);
      const summaries = await pipelineReportSummaries(ctx, mode);
      const waitingCount = mode === 'seller' ? hub.rows.filter(r => r.audience.some(a => a.state === 'asked')).length : hub.rows.filter(r => r.buyerState === 'shared' && !r.openedAt).length;
      expect(summaries['a']).toEqual({ count: hub.count, fresh: hub.fresh, waitingCount });
    }
  });
});