import type { PipelineRow } from './pipeline.functions';
import type { PipelinePageKey } from './pipeline-pages';

export const PIPELINE_REVIEW_REFRESH = {
  refetchInterval: 60_000,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: 'always' as const,
};

export function initialPipelineOpen(page: PipelinePageKey, rows: PipelineRow[], deal?: string): string[] {
  if (page === 'history') return rows.map(p => p.id);
  if (deal) return [deal];
  return ['all-deals', 'watchlist'].includes(page) && rows[0] ? [rows[0].id] : [];
}

export type PipelineReportSummary = { count: number; fresh: boolean; waitingCount: number };