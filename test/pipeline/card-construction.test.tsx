import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Profiler, useState } from 'react';
const mock = vi.hoisted(() => ({ poll: vi.fn(() => ({ data: [] })), rows: [] as any[], summaries: {} }));
vi.mock('@tanstack/react-start', () => ({ useServerFn: () => vi.fn() }));
vi.mock('@tanstack/react-router', () => ({ Link: ({ children }: any) => children, useNavigate: () => vi.fn() }));
vi.mock('@tanstack/react-query', () => ({ useQuery: mock.poll, useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock('@/hooks/use-marketplace', () => ({ useIsMarketplace: () => true, usePersona: () => ({ persona: 'buyer' }) }));
vi.mock('@/hooks/use-pipeline-workspace', () => ({ usePipelineWorkspace: () => ({ seller: false, persona: 'buyer', deals: { data: mock.rows }, stars: { data: [] }, counts: {}, reports: { data: mock.summaries }, approved: mock.rows }) }));
vi.mock('@/i18n/language', () => ({ useTranslation: () => ({ language: 'en', t: (s: string) => s }) }));
vi.mock('@/lib/pipeline.functions', () => ({ listPipeline: vi.fn(), setDealWatchlist: vi.fn(), shareReport: vi.fn(), askForReport: vi.fn(), shareStep: vi.fn(), withdrawLoiRequest: vi.fn(), pipelineEvents: vi.fn() }));
vi.mock('@/lib/invitations.functions', () => ({ listMyInvitations: vi.fn(), listSellerInvitations: vi.fn() }));
vi.mock('@/components/pipeline/review-alert', () => ({ PipelineReviewAlert: () => null }));
vi.mock('@/lib/favourites.functions', () => ({ withdrawNdaRequest: vi.fn() }));
vi.mock('@/components/pipeline/pipeline-dialogs', () => ({ CompareReports: () => null, ReportViewer: () => null, InvestorProfile: () => <dialog />, SellerProfile: () => <dialog />, NdaDialog: () => <dialog />, LoiDialog: () => <dialog /> }));
vi.mock('@/components/pipeline/advisor-bits', () => ({ useAdvisorContactRow: () => ({ text: '', action: null }) }));
vi.mock('@/components/pipeline/send-loi-dialog', () => ({ SendLoiDialog: () => <dialog /> }));
vi.mock('@/components/marketplace/seller-invitations', () => ({ ReviewInvestorDialog: () => <dialog /> }));
vi.mock('@/components/my-business/report-share-ui', () => ({ ShareAccessDialog: () => <dialog /> }));
vi.mock('@/components/pipeline/withdraw-deal', () => ({ WithdrawLink: () => null, WithdrawnPill: () => null, EndedBox: () => null, withdrewText: () => '', closedWhen: () => '' }));
vi.mock('@/components/pipeline/financial-reports', () => ({ FinancialReports: () => null }));
vi.mock('@/components/pipeline/loi-timeline', () => ({ LoiTimeline: () => null }));
vi.mock('@/components/pipeline/deal-company-chip', () => ({ DealCompanyChip: () => null }));
vi.mock('@/components/reports/reports-hub', () => ({ PipelineReportsButton: () => null }));
vi.mock('@/components/pipeline/deal-agreements', () => ({ DealAgreements: ({ onNda }: any) => <button data-open-nda onClick={onNda} /> }));
vi.mock('@/components/pipeline/decline-notice', () => ({ DeclineNotice: () => null }));
vi.mock('@/components/pipeline/workspace-reports', () => ({ PipelineReports: () => null }));
vi.mock('@/components/pipeline/workspace-invitations', () => ({ PipelineInvitations: () => null }));
vi.mock('@/components/pipeline/post-loi-stages', () => ({ PostLoiStages: function DraftStage() { const [draft, setDraft] = useState(''); return <input data-stage-draft value={draft} onChange={(e: any) => setDraft(e.target.value)} />; } }));
import { TrackingCard, Avatar } from '../../src/components/pipeline/workspace-cards';
import { PipelineWorkspacePage } from '../../src/components/pipeline/workspace-page';
import { GlobalPipelineReviewAlert } from '../../src/components/pipeline/review-alert-host';
import type { PipelineRow } from '../../src/lib/pipeline.functions';

const p = { id: 'a', status: 'active', ndaApprovedAt: '2026-11-01', ndaExpiresAt: '2027-11-01', updatedAt: '2026-11-01', ndaRequestedAt: '2026-11-01', counterparty: { name: 'Buyer', sub: '', logoUrl: null }, reports: {}, share: null } as PipelineRow;
const trees: ReactTestRenderer[] = [];
beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() }); });
afterEach(async () => { await act(async () => { trees.splice(0).forEach(tree => tree.unmount()); }); });

it('the real folded deal has no stage rows or pop-ups, retains stages after close, and opens a pop-up only on request', async () => {
  const render = (open: boolean) => <TrackingCard p={p} seller={false} open={open} onToggle={() => {}} onEnded={() => {}} t={s => s} />;
  let tree: ReactTestRenderer | undefined;
  await act(async () => { tree = create(render(false)); });
  if (!tree) throw new Error('Missing test render'); trees.push(tree);
  const stages = () => tree?.root.findAll(node => typeof node.props.className === 'string' && node.props.className.split(' ').includes('loi-stage-row'));
  expect(stages()).toHaveLength(0);
  expect(tree.root.findAllByType('dialog')).toHaveLength(0);
  await act(async () => { tree?.update(render(true)); });
  expect(stages()).toHaveLength(3);
  expect(tree.root.findAllByType('dialog')).toHaveLength(0);
  await act(async () => { tree?.root.findByType('input').props.onChange({ target: { value: 'kept draft' } }); });
  await act(async () => { tree?.update(render(false)); });
  expect(stages()).toHaveLength(3);
  expect(tree.root.findByType('input').props.value).toBe('kept draft');
  await act(async () => { tree?.root.findByProps({ 'data-open-nda': true }).props.onClick(); });
  expect(tree.root.findAllByType('dialog')).toHaveLength(1);
});

it('the real workspace renders its first card open immediately, without another render to open it', async () => {
  mock.rows = [p, { ...p, id: 'b', loiAcceptedAt: '2026-11-01', updatedAt: '2026-10-31' }];
  const commits = vi.fn();
  let tree: ReactTestRenderer | undefined;
  await act(async () => { tree = create(<Profiler id="workspace" onRender={commits}><PipelineWorkspacePage page="all-deals" /></Profiler>); });
  if (!tree) throw new Error('Missing test render'); trees.push(tree);
  const cards = tree.root.findAllByType(TrackingCard);
  expect(cards.map(card => card.props.open)).toEqual([true, false]);
  expect(commits).toHaveBeenCalledTimes(1);
  expect(cards[0]?.findAllByType('input')).toHaveLength(1);
  expect(cards[1]?.findAllByType('input')).toHaveLength(0);
  expect(cards[0]?.props.p.id).toBe('b');
  await act(async () => { tree?.root.findByType('select').props.onChange({ target: { value: 'recent' } }); });
  const sorted = tree.root.findAllByType(TrackingCard);
  expect(sorted[0]?.props.p.id).toBe('a');
  expect(sorted.map(card => card.props.open)).toEqual([false, true]);
});

it('a failed transformed avatar tries the original before falling back to initials', async () => {
  let tree: ReactTestRenderer | undefined;
  await act(async () => { tree = create(<Avatar name="Buyer" logoUrl="small" logoFallbackUrl="original" />); });
  if (!tree) throw new Error('Missing test render'); trees.push(tree);
  expect(tree.root.findByType('img').props.src).toBe('small');
  await act(async () => { tree?.root.findByType('img').props.onError(); });
  expect(tree.root.findByType('img').props.src).toBe('original');
  await act(async () => { tree?.root.findByType('img').props.onError(); });
  expect(tree.root.findAllByType('img')).toHaveLength(0);
});

it('both real review-alert queries use 60-second hidden-pausing, focus-refresh options', async () => {
  mock.poll.mockClear();
  await act(async () => { trees.push(create(<GlobalPipelineReviewAlert />)); });
  expect(mock.poll).toHaveBeenCalledTimes(2);
  for (const call of mock.poll.mock.calls as unknown as [Record<string, unknown>][]) {
    expect(call[0]['refetchInterval']).toBe(60_000);
    expect(call[0]['refetchIntervalInBackground']).toBe(false);
    expect(call[0]['refetchOnWindowFocus']).toBe('always');
  }
});