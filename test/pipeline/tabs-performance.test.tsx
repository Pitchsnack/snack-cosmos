import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider, Outlet } from '@tanstack/react-router';

const fns = vi.hoisted(() => ({ list: vi.fn(async () => []), stars: vi.fn(async () => []), summaries: vi.fn(async () => ({ a: { count: 1, fresh: false, waitingCount: 0 }, b: { count: 2, fresh: true, waitingCount: 1 } })), invites: vi.fn(async () => []), hub: vi.fn(async () => null) }));
vi.mock('@/lib/pipeline.functions', () => ({ listPipeline: fns.list, listDealWatchlist: fns.stars }));
vi.mock('@/lib/reports-hub.functions', () => ({ getPipelineReportSummaries: fns.summaries, getReportsHub: fns.hub }));
vi.mock('@/lib/invitations.functions', () => ({ listMyInvitations: fns.invites, listSellerInvitations: fns.invites }));
vi.mock('@/lib/plan.functions', () => ({ getMyPlanStrip: vi.fn(async () => null) }));
vi.mock('@/lib/buy-orders.functions', () => ({ applicationsToCheck: vi.fn(async () => ({ n: 0 })) }));
vi.mock('@/hooks/use-marketplace', () => ({ usePersona: () => ({ persona: 'buyer' }) }));
vi.mock('@/hooks/use-pipeline-workspace', () => ({ usePipelineWorkspace: () => ({ counts: { all: 2, watch: 0, history: 0 }, newInv: 0, fresh: 1 }) }));
vi.mock('@/i18n/language', () => ({ useTranslation: () => ({ language: 'en', t: (s: string) => s }) }));
vi.mock('@/components/pipeline/agreement-state', () => ({ AgreementStateProvider: ({ children }: any) => children }));
vi.mock('@/components/messages/chat-drafts', () => ({ PipelineChatDrafts: ({ children }: any) => children }));

import { PipelineLayout } from '../../src/routes/_authenticated/marketplace.pipeline';
import { KeepMountedDetails } from '../../src/components/pipeline/keep-mounted-details';
import { PIPELINE_REVIEW_REFRESH, initialPipelineOpen } from '../../src/lib/pipeline-performance';
import { prefetchPipelinePage, pipelineQueryOptions } from '../../src/lib/pipeline-queries';
import { signPipelineLogos } from '../../src/lib/pipeline-logo.server';
import type { PipelineRow } from '../../src/lib/pipeline.functions';

const rendered: ReactTestRenderer[] = [];
beforeAll(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal('scrollTo', vi.fn());
});
afterEach(async () => { await act(async () => { for (const tree of rendered.splice(0)) tree.unmount(); }); vi.clearAllMocks(); });

describe('Pipeline navigation and construction', () => {
  it('retains the actual navigation instance when the child route switches', async () => {
    const root = createRootRoute({ component: Outlet });
    const layout = createRoute({ getParentRoute: () => root, path: '/marketplace/pipeline', component: PipelineLayout });
    const a = createRoute({ getParentRoute: () => layout, path: 'invitations', component: () => <section /> });
    let finish: (() => void) | undefined;
    const b = createRoute({ getParentRoute: () => layout, path: 'all-deals', loader: () => new Promise<void>(resolve => { finish = resolve; }), pendingMs: 0, pendingMinMs: 0, pendingComponent: () => <aside />, component: () => <article /> });
    const router = createRouter({ isServer: false, routeTree: root.addChildren([layout.addChildren([a, b])]), history: createMemoryHistory({ initialEntries: ['/marketplace/pipeline/invitations'] }) });
    await router.load();
    let tree: ReactTestRenderer | undefined;
    const qc = new QueryClient();
    await act(async () => { tree = create(<QueryClientProvider client={qc}><RouterProvider router={router} /></QueryClientProvider>); });
    if (!tree) throw new Error('Missing test render');
    rendered.push(tree);
    const nav = tree.root.findByType('nav');
    let navigation: Promise<void> | undefined;
    await act(async () => { navigation = router.navigate({ to: '/marketplace/pipeline/all-deals' }); await new Promise(resolve => setTimeout(resolve, 20)); });
    expect(tree.root.findByType('nav')).toBe(nav);
    expect(nav.findAllByType('a').find(link => link.props.href === '/marketplace/pipeline/all-deals')?.props['aria-current']).toBe('page');
    await act(async () => { finish?.(); await navigation; });
    expect(tree.root.findByType('nav')).toBe(nav);
    expect(tree.root.findAllByType('article')).toHaveLength(1);
  });

  it('constructs no deferred content until opened and retains its typed state after closing', async () => {
    const mounted = vi.fn();
    function Inside() { mounted(); const [draft, setDraft] = useState(''); return <input value={draft} onChange={(e: any) => setDraft(e.target.value)} />; }
    const render = (open: boolean) => <KeepMountedDetails open={open}>{() => <Inside />}</KeepMountedDetails>;
    let tree: ReactTestRenderer | undefined;
    await act(async () => { tree = create(render(false)); });
    if (!tree) throw new Error('Missing test render'); rendered.push(tree);
    expect(mounted).not.toHaveBeenCalled();
    await act(async () => { tree?.update(render(true)); });
    const inside = tree.root.findByType(Inside);
    await act(async () => { tree?.root.findByType('input').props.onChange({ target: { value: 'unsent' } }); });
    await act(async () => { tree?.update(render(false)); });
    expect(tree.root.findByType(Inside)).toBe(inside);
    expect(tree.root.findByType('input').props.value).toBe('unsent');
    await act(async () => { tree?.update(render(true)); });
    expect(tree.root.findByType('input').props.value).toBe('unsent');
  });

  it('opens the same first deal on the first render, without a follow-up opening render', async () => {
    const renders = vi.fn();
    const rows = [{ id: 'furthest' }, { id: 'recent' }] as PipelineRow[];
    function Page() { const [open] = useState(() => initialPipelineOpen('all-deals', rows)); renders(open); return null; }
    await act(async () => { rendered.push(create(<Page />)); });
    expect(renders).toHaveBeenCalledTimes(1);
    expect(renders).toHaveBeenCalledWith(['furthest']);
    expect(initialPipelineOpen('watchlist', rows)).toEqual(['furthest']);
    expect(initialPipelineOpen('all-deals', rows, 'recent')).toEqual(['recent']);
    expect(initialPipelineOpen('history', rows)).toEqual(['furthest', 'recent']);
  });

  it('makes one summary request for several deals and none on a fresh-cache switch', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });
    await prefetchPipelinePage(qc, 'buyer', 'all-deals');
    expect(qc.getQueryData(pipelineQueryOptions('buyer').reports.queryKey)).toEqual({ a: { count: 1, fresh: false, waitingCount: 0 }, b: { count: 2, fresh: true, waitingCount: 1 } });
    expect(fns.summaries).toHaveBeenCalledTimes(1);
    expect(fns.hub).not.toHaveBeenCalled();
    await prefetchPipelinePage(qc, 'buyer', 'watchlist');
    expect(fns.summaries).toHaveBeenCalledTimes(1);
    expect(fns.list).toHaveBeenCalledTimes(1);
  });

  it('refreshes the review alert every 60 seconds, pauses hidden polling and refreshes on return', () => {
    expect(PIPELINE_REVIEW_REFRESH.refetchInterval).toBe(60_000);
    expect(PIPELINE_REVIEW_REFRESH.refetchIntervalInBackground).toBe(false);
    expect(PIPELINE_REVIEW_REFRESH.refetchOnWindowFocus).toBe('always');
  });

  it('signs the avatar for 88 by 88 pixels without creating stored files', async () => {
    const bucket = { createSignedUrls: vi.fn(async () => ({ data: [{ path: 'logo.png', signedUrl: 'original' }] })), createSignedUrl: vi.fn(async () => ({ data: { signedUrl: 'small' } })) };
    const result = await signPipelineLogos(bucket, ['logo.png']);
    expect(bucket.createSignedUrl).toHaveBeenCalledWith('logo.png', 3600, { transform: { width: 88, height: 88, resize: 'contain' } });
    expect(result['logo.png']).toEqual({ small: 'small', original: 'original' });
  });

  it('keeps the original logo if transformation signing is unavailable', async () => {
    const bucket = { createSignedUrls: async () => ({ data: [{ path: 'logo.png', signedUrl: 'original' }] }), createSignedUrl: async () => ({ error: 'unavailable' }) };
    expect((await signPipelineLogos(bucket, ['logo.png']))['logo.png']).toEqual({ small: 'original', original: 'original' });
  });
});