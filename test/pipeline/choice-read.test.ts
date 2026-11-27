import { beforeEach, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({ tables: {} as Record<string, any[]>, calls: [] as [string, string, unknown][], auth: {}, error: null as Error | null }));
vi.mock('@tanstack/react-start', () => ({ createServerFn: () => {
  let parse = (d: unknown): any => d;
  const builder = { middleware: (middlewares: unknown[]) => { expect(middlewares).toContain(fake.auth); return builder; }, inputValidator: (fn: typeof parse) => { parse = fn; return builder; }, handler: (fn: any) => (args: any) => fn({ data: parse(args?.data), context: { userId: 'me' } }) };
  return builder;
} }));
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: fake.auth }));
function query(table: string) {
  let rows = fake.tables[table] ?? [];
  const q: any = {
    select: () => q,
    eq: (key: string, value: unknown) => { fake.calls.push([table, key, value]); rows = rows.filter(r => r[key] === value); return q; },
    in: (key: string, values: unknown[]) => { fake.calls.push([table, key, values]); rows = rows.filter(r => values.includes(r[key])); return q; },
    not: () => { rows = rows.filter(r => !['declined', 'withdrawn'].includes(r.status)); return q; },
    order: () => q,
    then: (resolve: any) => resolve({ data: rows, error: table === 'deal_pipelines' ? fake.error : null }),
  };
  return q;
}
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { from: query, storage: { from: vi.fn() } } }));
vi.mock('@/lib/workspace-scope.server', () => ({ scopeStartupIds: async (_user: string, ids: string[]) => ids.filter(id => id === 'mine') }));
vi.mock('@/lib/report-shares.server', () => ({ deliveredKinds: async () => ({ financials: false, valuation: false }), ndaActive: () => false }));
vi.mock('@/lib/profile-verification.server', () => ({ verificationsByUsers: async () => new Map() }));
vi.mock('@/lib/pipeline-logo.server', () => ({ signPipelineLogos: vi.fn() }));
import { listPipeline } from '../../src/lib/pipeline.functions';
const id = 'b768319b-0e70-4ed2-9366-76668bf40c02';
const otherId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
beforeEach(() => {
  fake.calls = []; fake.error = null;
  fake.tables = {
    deal_pipelines: [{ id, buyer_user_id: 'me', startup_id: 'mine', hidden_profile_id: 'h', status: 'active' }, { id: otherId, buyer_user_id: 'me', startup_id: 'mine', hidden_profile_id: 'h', status: 'active' }],
    startup_ownership: [{ startup_id: 'mine', owning_agent_user_id: 'me' }, { startup_id: 'outside-workspace', owning_agent_user_id: 'me' }],
  };
});
it('buyer single-deal read keeps the caller scope and filters id before profile lookups', async () => {
  const result = await listPipeline({ data: { as: 'buyer', id } });
  expect(result.map(p => p.id)).toEqual([id]);
  expect(fake.calls).toContainEqual(['deal_pipelines', 'buyer_user_id', 'me']);
  expect(fake.calls).toContainEqual(['deal_pipelines', 'id', id]);
  fake.tables['deal_pipelines'] = [{ id, buyer_user_id: 'other', startup_id: 'mine', status: 'active' }];
  expect(await listPipeline({ data: { as: 'buyer', id } })).toEqual([]);
});
it('seller single-deal read keeps ownership, membership and active workspace scope', async () => {
  expect((await listPipeline({ data: { as: 'seller', id } })).map(p => p.id)).toEqual([id]);
  expect(fake.calls).toContainEqual(['deal_pipelines', 'startup_id', ['mine']]);
  fake.tables['deal_pipelines'] = [{ id, buyer_user_id: 'me', startup_id: 'outside-workspace', status: 'active' }];
  expect(await listPipeline({ data: { as: 'seller', id } })).toEqual([]);
});
it('the existing unfiltered list still returns both deals', async () => {
  expect((await listPipeline({ data: { as: 'buyer' } })).map(p => p.id)).toEqual([id, otherId]);
});
it('invalid single-deal ids are rejected before reading', async () => {
  expect(() => listPipeline({ data: { as: 'buyer', id: 'invalid' } })).toThrow();
  expect(fake.calls).toEqual([]);
});
it('a failed single-deal read is not mistaken for a removed deal', async () => {
  fake.error = new Error('read failed');
  await expect(listPipeline({ data: { as: 'buyer', id } })).rejects.toThrow('Could not reload this deal');
});