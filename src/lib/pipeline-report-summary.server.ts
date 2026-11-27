import { REPORT_KEYS, hubNdaActive, buyerReportState, accessibleCount } from './reports-hub';
import type { PipelineReportSummary } from './pipeline-performance';

type SummaryTables = { records: any[]; orders: any[]; verifications: any[]; filings: any[]; shares: any[]; access: any[]; requests: any[]; verificationAccess: any[]; quotes: Record<string, any> };

/** Same readiness/grant precedence as hubData, without company, price or report payloads. */
export function projectPipelineReportSummary(p: any, seller: boolean, t: SummaryTables, now = Date.now()): PipelineReportSummary {
  const rows = REPORT_KEYS.map(key => {
    const r = t.records.find(r => r.company_id === p.startup_id && r.report_key === key);
    const orders = t.orders.filter(o => o.startup_id === p.startup_id);
    const o = orders.find(o => o.kind === (key === 'statements' ? 'financials' : key) || (['statements', 'valuation'].includes(key) && o.kind === 'bundle'));
    let authorised = r?.authorised_at ?? o?.delivered_at ?? null;
    let generated = r?.generated_at ?? o?.generated_at ?? null;
    let ready = !!authorised;
    if (key === 'verification') {
      const v = t.verifications.find(v => v.company_id === p.startup_id);
      authorised = ['certified', 'needs_fix'].includes(v?.status) ? v.checked_at : null;
      generated = authorised; ready = !!authorised;
    }
    if (key === 'statements' && !generated) generated = t.filings.filter(f => f.startup_id === p.startup_id).map(f => f.retrieved_at ?? f.created_at).filter(Boolean).sort().at(-1) ?? null;
    if (key === 'pnl' && !o && !r) {
      const f = orders.find(o => ['financials', 'bundle'].includes(o.kind));
      generated = f?.generated_at ?? null; ready = !!f?.delivered_at;
    }
    const sh = t.shares.find(s => s.pipeline_id === p.id);
    const shared = !!sh && ((sh.report_keys ?? []).includes(key) || key === 'statements' && sh.financials || key === 'valuation' && sh.valuation);
    const own = t.access.find(a => a.company_id === p.startup_id && a.buyer_id === p.buyer_user_id && a.report_key === key)
      ?? (key === 'verification' ? t.verificationAccess.find(a => a.company_id === p.startup_id && a.buyer_account_id === p.buyer_user_id && (['paid', 'contract'].includes(a.via) || a.open_until && Date.parse(a.open_until) > now)) : null);
    const asked = !shared && t.requests.some(a => a.company_id === p.startup_id && a.buyer_id === p.buyer_user_id && a.report_key === key && a.status === 'open');
    const sharedReady = shared && ready;
    const yours = !sharedReady && !!own;
    const openedAt = sharedReady ? sh.report_opened_at?.[key] ?? (key === 'statements' ? p.report_viewed_at : null) : yours ? own.last_opened_at ?? own.opened_at : null;
    if (!seller && yours && generated) ready = true;
    const quote = t.quotes[key];
    const buyerState = buyerReportState({ shared: sharedReady, yours, asked, ready, inPlan: quote?.method === 'Plan' || quote?.method === 'Free period' });
    return { ready, buyerState, openedAt, generated, asked };
  });
  return {
    count: seller ? rows.filter(r => r.ready).length : accessibleCount(rows),
    fresh: rows.some(r => r.ready && ['shared', 'yours', 'plan'].includes(r.buyerState) && (!r.openedAt || !!r.generated && r.generated > r.openedAt)),
    waitingCount: rows.filter(r => seller ? r.asked : r.buyerState === 'shared' && !r.openedAt).length,
  };
}

async function read(query: any): Promise<any[]> {
  const { data, error } = await query;
  if (error) throw new Error('Report summaries could not be loaded');
  return data ?? [];
}
async function pooled<T>(jobs: (() => Promise<T>)[]): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < jobs.length; i += 6) results.push(...await Promise.all(jobs.slice(i, i + 6).map(job => job())));
  return results;
}

export async function pipelineReportSummaries(ctx: any, as: 'seller' | 'buyer'): Promise<Record<string, PipelineReportSummary>> {
  const { requireRole } = await import('./plan-access.server');
  await requireRole(ctx.userId, [as]);
  const ids = as === 'seller' ? await (await import('./workspace-scope.server')).myWorkspaceStartupIds(ctx.userId) : [];
  if (as === 'seller' && !ids.length) return {};
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const sb = supabaseAdmin as any;
  const query = sb.from('deal_pipelines').select('id,startup_id,buyer_user_id,status,nda_approved_at,nda_expires_at,report_viewed_at');
  let deals = (await read(as === 'buyer' ? query.eq('buyer_user_id', ctx.userId) : query.in('startup_id', ids))).filter(p => hubNdaActive(p));
  if (as === 'seller') {
    const companies = [...new Set(deals.map(p => p.startup_id))];
    const allowed = await pooled(companies.map(company => async () => {
      const { data, error } = await ctx.supabase.rpc('verification_owner', { _uid: ctx.userId, _company: company });
      return !error && data ? company : null;
    }));
    deals = deals.filter(p => allowed.includes(p.startup_id));
  }
  if (!deals.length) return {};
  const companies = [...new Set(deals.map(p => p.startup_id))], pipelines = deals.map(p => p.id);
  const tables = await pooled([
    () => read(sb.from('company_report_records').select('company_id,report_key,authorised_at,generated_at').in('company_id', companies)),
    () => read(sb.from('report_orders').select('startup_id,kind,delivered_at,generated_at').in('startup_id', companies).not('status', 'in', '(cancelled,refunded)')),
    () => read(sb.from('company_verifications').select('company_id,status,checked_at').in('company_id', companies)),
    () => read(sb.from('financial_statements').select('startup_id,retrieved_at,created_at').in('startup_id', companies)),
    () => read(sb.from('report_shares').select('pipeline_id,report_keys,financials,valuation,report_opened_at').in('pipeline_id', pipelines).is('revoked_at', null)),
    () => read(sb.from('buyer_report_access').select('company_id,buyer_id,report_key,opened_at,last_opened_at').in('company_id', companies)),
    () => read(sb.from('report_share_requests').select('company_id,buyer_id,report_key,status').in('company_id', companies)),
    () => read(sb.from('verification_access').select('company_id,buyer_account_id,via,opened_at,open_until').in('company_id', companies)),
  ]);
  // Plan membership contributes to the existing Reports count; quote each key once, not per deal.
  const prices = await pooled(REPORT_KEYS.map(key => async () => {
    const { data, error } = await sb.rpc('report_quote', { _uid: ctx.userId, _key: key });
    if (error) throw new Error('Report summaries could not be loaded');
    return [key, data] as const;
  }));
  const [records = [], orders = [], verifications = [], filings = [], shares = [], access = [], requests = [], verificationAccess = []] = tables;
  const t = { records, orders, verifications, filings, shares, access, requests, verificationAccess, quotes: Object.fromEntries(prices) };
  return Object.fromEntries(deals.filter(p => hubNdaActive(p)).map(p => [p.id, projectPipelineReportSummary(p, as === 'seller', t)]));
}