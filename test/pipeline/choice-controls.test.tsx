import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
const mock = vi.hoisted(() => ({ save: vi.fn(), read: vi.fn(), error: vi.fn(), language: 'en' }));
vi.mock('@tanstack/react-start', () => ({ useServerFn: (f: unknown) => f }));
vi.mock('@tanstack/react-router', () => ({ Link: ({ children }: any) => children }));
vi.mock('@/lib/pipeline.functions', () => ({ saveStageChoice: mock.save, listPipeline: mock.read, confirmPayment: vi.fn(), receiveValuation: vi.fn(), readValuationFile: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: mock.error } }));
vi.mock('@/i18n/language', () => ({ useTranslation: () => ({ language: mock.language, t: (s: string) => s }) }));
vi.mock('@/components/ui/button', () => ({ Button: ({ children, ...props }: any) => <button {...props}>{children}</button> }));
vi.mock('@/components/ui/dialog', () => ({ Dialog: ({ children }: any) => <dialog>{children}</dialog>, DialogContent: ({ children }: any) => <div>{children}</div>, DialogTitle: ({ children }: any) => <h2>{children}</h2>, DialogDescription: ({ children }: any) => <p>{children}</p> }));
import { PostLoiStages } from '../../src/components/pipeline/post-loi-stages';
import type { PipelineRow } from '../../src/lib/pipeline.functions';

const trees: ReactTestRenderer[] = [];
beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => { await act(async () => trees.splice(0).forEach(t => t.unmount())); mock.save.mockReset(); mock.read.mockReset(); mock.error.mockReset(); mock.language = 'en'; });

async function render(seller = false, instantChoices = true) {
  const side = seller ? 'seller' : 'buyer';
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  const p = { id: 'a', loiAcceptedAt: '2026-11-01', counterparty: { name: 'Counterparty' }, workflow: { choices: { [side]: { valuation: { value: 'none', at: '2026-11-01', locked: true } } }, payment: {}, receipts: {} } } as PipelineRow;
  qc.setQueryData(['pipeline', side], [p]);
  const onDone = vi.fn();
  function Host() {
    const { data } = useQuery<PipelineRow[]>({ queryKey: ['pipeline', side], queryFn: async () => [p] });
    const deal = data?.[0];
    return deal ? <PostLoiStages p={deal} seller={seller} onDone={onDone} instantChoices={instantChoices} /> : null;
  }
  let tree: ReactTestRenderer | undefined;
  await act(async () => { tree = create(<QueryClientProvider client={qc}><Host /></QueryClientProvider>); });
  if (!tree) throw new Error('Missing render');
  trees.push(tree);
  const button = (text: string) => tree?.root.findAllByType('button').find(b => b.children.some(child => child === text));
  const value = () => qc.getQueryData<PipelineRow[]>(['pipeline', side])?.[0]?.workflow?.choices[side]?.valuation;
  return { tree, button, value, onDone };
}

it.each([false, true])('real shared controls unlock instantly and accept a pick while the save waits (seller=%s)', async seller => {
  let resolve: () => void = () => {};
  mock.save.mockImplementationOnce(() => new Promise<void>(ok => { resolve = ok; })).mockImplementationOnce(() => new Promise(() => {}));
  const { tree, button, value, onDone } = await render(seller);
  await act(async () => { button('Not needed')?.props.onClick(); });
  expect(tree.root.findAllByType('dialog')).toHaveLength(1);
  await act(async () => { button('Unlock')?.props.onClick(); });
  expect(tree.root.findAllByType('dialog')).toHaveLength(0);
  expect(value()?.locked).toBe(false);
  expect(button('Own valuer')?.props.disabled).toBe(false);
  await act(async () => { button('Own valuer')?.props.onClick(); });
  expect(value()).toMatchObject({ value: 'own', locked: true });
  expect(mock.save).toHaveBeenCalledTimes(1);
  await act(async () => resolve());
  expect(mock.save).toHaveBeenCalledTimes(2);
  expect(mock.save.mock.calls[1]?.[0].data).toMatchObject({ side: seller ? 'seller' : 'buyer', choice: 'own' });
  expect(onDone).not.toHaveBeenCalled();
});

it('real Clear choice closes the pop-up and clears immediately without refreshing other card actions', async () => {
  mock.save.mockImplementation(() => new Promise(() => {}));
  const { tree, button, value, onDone } = await render();
  await act(async () => { button('Not needed')?.props.onClick(); });
  await act(async () => { button('Clear choice')?.props.onClick(); });
  expect(tree.root.findAllByType('dialog')).toHaveLength(0);
  expect(value()).toBeUndefined();
  expect(mock.save.mock.calls[0]?.[0].data.choice).toBeNull();
  expect(onDone).not.toHaveBeenCalled();
});

it('a host outside All deals/watchlist retains the original wait-for-save behavior', async () => {
  mock.save.mockImplementation(() => new Promise(() => {}));
  const { tree, button, value } = await render(false, false);
  await act(async () => { button('Not needed')?.props.onClick(); });
  await act(async () => { button('Unlock')?.props.onClick(); });
  expect(tree.root.findAllByType('dialog')).toHaveLength(1);
  expect(value()?.locked).toBe(true);
});

it.each(['en', 'th'])('failed real control restores the row and shows the usual %s error toast', async language => {
  mock.language = language;
  let reject: (e: Error) => void = () => {};
  mock.save.mockImplementation(() => new Promise<void>((_ok, fail) => { reject = fail; }));
  mock.read.mockImplementation(() => new Promise(() => {}));
  const { button, value } = await render();
  await act(async () => { button(language === 'th' ? 'ไม่ต้องการ' : 'Not needed')?.props.onClick(); });
  await act(async () => { button(language === 'th' ? 'ปลดล็อก' : 'Unlock')?.props.onClick(); });
  expect(value()?.locked).toBe(false);
  await act(async () => reject(new Error('Failed to fetch')));
  expect(value()).toMatchObject({ value: 'none', locked: true });
  expect(mock.error).toHaveBeenCalledWith(language === 'th' ? 'บันทึกตัวเลือกไม่สำเร็จ กรุณาลองอีกครั้ง' : "Couldn't save your choice. Please try again.");
});