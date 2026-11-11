import type { HubData, HubKey } from './reports-hub';

export function resolveFinancialReportLink(hub: HubData, report: HubKey, tab?: string): { report: HubKey; tab: string } {
  if (report !== 'statements' || !['ratios', 'financial-ratios'].includes(tab ?? '')) {
    return { report, tab: report === 'pnl' && tab === 'ratios' ? 'ratios' : report === 'pnl' ? 'overview' : 'income' };
  }
  const pnl = hub.rows.find(row => row.key === 'pnl');
  const accessible = pnl?.status === 'ready' && (hub.mode === 'admin' || hub.mode === 'seller' || ['shared', 'yours', 'plan'].includes(pnl.buyerState));
  return accessible ? { report: 'pnl', tab: 'ratios' } : { report: 'statements', tab: 'income' };
}

export const financialPdfSections = (report: 'statements' | 'pnl') => report === 'statements'
  ? ['income', 'position', 'cash-flow'] as const
  : ['overview', 'ratios'] as const;