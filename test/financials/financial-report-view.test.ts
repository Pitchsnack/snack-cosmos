import { describe, expect, it } from 'vitest';
import { financialPdfSections, resolveFinancialReportLink } from '../../src/lib/financial-report-view';
import type { HubData, HubRow } from '../../src/lib/reports-hub';
const hub = (mode: HubData['mode'], buyerState: HubRow['buyerState'], status: HubRow['status'] = 'ready') => ({ mode, rows: [{ key: 'pnl', buyerState, status }] }) as HubData;
describe('Financial report section ownership and legacy links', () => {
  it('statements PDF has exactly income, balance sheet and cash flow', () => expect(financialPdfSections('statements')).toEqual(['income', 'position', 'cash-flow']));
  it('P&L PDF retains overview and appends ratios', () => expect(financialPdfSections('pnl')).toEqual(['overview', 'ratios']));
  it('old Overview opens statements', () => expect(resolveFinancialReportLink(hub('buyer', 'shared'), 'statements', 'overview')).toEqual({ report: 'statements', tab: 'income' }));
  it('old ratios opens P&L for a shared buyer', () => expect(resolveFinancialReportLink(hub('buyer', 'shared'), 'statements', 'ratios')).toEqual({ report: 'pnl', tab: 'ratios' }));
  it('statements access alone does not grant ratios', () => expect(resolveFinancialReportLink(hub('buyer', 'buy'), 'statements', 'ratios')).toEqual({ report: 'statements', tab: 'income' }));
  it('owned P&L allows old ratio links', () => expect(resolveFinancialReportLink(hub('buyer', 'yours'), 'statements', 'ratios').report).toBe('pnl'));
  it('in-plan P&L allows old ratio links', () => expect(resolveFinancialReportLink(hub('buyer', 'plan'), 'statements', 'ratios').report).toBe('pnl'));
  it('seller needs a ready P&L', () => expect(resolveFinancialReportLink(hub('seller', 'buy', 'not_ordered'), 'statements', 'ratios').report).toBe('statements'));
  it('Admin uses ready P&L', () => expect(resolveFinancialReportLink(hub('admin', 'buy'), 'statements', 'ratios').report).toBe('pnl'));
  it('ordinary P&L opening starts on Overview', () => expect(resolveFinancialReportLink(hub('buyer', 'shared'), 'pnl').tab).toBe('overview'));
});