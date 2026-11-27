import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { listPipeline, listDealWatchlist } from './pipeline.functions';
import { listMyInvitations, listSellerInvitations, type BuyerInvitation, type SellerInvitation } from './invitations.functions';
import { getPipelineReportSummaries, getReportsHub } from './reports-hub.functions';
import { getMyPlanStrip } from './plan.functions';
import { applicationsToCheck } from './buy-orders.functions';
import { pipelineStep, signedPipelineOpen, type PipelinePageKey } from './pipeline-pages';

export function pipelineQueryOptions(as: 'seller' | 'buyer') {
  return {
    deals: queryOptions({ queryKey: ['pipeline', as], queryFn: () => listPipeline({ data: { as } }), retry: false }),
    stars: queryOptions({ queryKey: ['pipeline', 'watchlist', as], queryFn: () => listDealWatchlist(), retry: false }),
    invites: queryOptions<(BuyerInvitation | SellerInvitation)[]>({ queryKey: ['invitations', as], queryFn: () => as === 'seller' ? listSellerInvitations() : listMyInvitations(), retry: false }),
    reports: queryOptions({ queryKey: ['reports-hub', 'pipeline-summary', as], queryFn: () => getPipelineReportSummaries({ data: { as } }), retry: false }),
  };
}

export async function prefetchPipelinePage(qc: QueryClient, as: 'seller' | 'buyer', page: PipelinePageKey) {
  const q = pipelineQueryOptions(as);
  const jobs = [qc.prefetchQuery(q.deals), qc.prefetchQuery(q.stars), qc.prefetchQuery(q.invites), qc.prefetchQuery(q.reports)];
  if (page === 'invitations') {
    jobs.push(qc.prefetchQuery({ queryKey: ['plan-strip'], queryFn: () => getMyPlanStrip(), staleTime: 30_000 }));
    if (as === 'buyer') jobs.push(qc.prefetchQuery({ queryKey: ['buy-order-apps', 'count'], queryFn: () => applicationsToCheck(), staleTime: 60_000 }));
  }
  await Promise.all(jobs);
  if (page !== 'reports') return;
  const summaries = qc.getQueryData(q.reports.queryKey);
  const deals = (qc.getQueryData(q.deals.queryKey) ?? []).filter(signedPipelineOpen).sort((a, b) => pipelineStep(b) - pipelineStep(a) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const first = deals.find(p => (summaries?.[p.id]?.waitingCount ?? 0) > 0) ?? deals[0];
  if (first) await qc.prefetchQuery({ queryKey: ['reports-hub', as, undefined, first.id], queryFn: () => getReportsHub({ data: { mode: as, pipelineId: first.id } }) });
}