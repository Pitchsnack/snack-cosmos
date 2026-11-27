import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { PipelineChoiceCache, choiceSaveError, type ChoiceInput } from '../../src/lib/pipeline-choice-cache';
import type { PipelineRow } from '../../src/lib/pipeline.functions';
import type { DealSide } from '../../src/lib/loi-workflow';

const locked = { value: 'none' as const, locked: true, at: '2026-11-01' };
function setup(side: DealSide = 'buyer') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const p = { id: 'a', workflow: { choices: { [side]: { valuation: locked, legal: locked } }, receipts: {}, payment: {} } } as PipelineRow;
  const other = { ...p, id: 'b' };
  qc.setQueryData(['pipeline', side], [p, other]);
  const cache = new PipelineChoiceCache(qc);
  const input: ChoiceInput = { id: 'a', side, stage: 'valuation', choice: 'none', unlock: true };
  const row = () => qc.getQueryData<PipelineRow[]>(['pipeline', side])?.[0];
  return { qc, cache, input, p, other, row };
}
function deferred() {
  let resolve: () => void = () => {};
  let reject: (e: Error) => void = () => {};
  const promise = new Promise<void>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

describe('optimistic Pipeline row choices', () => {
  it.each(['seller', 'buyer'] as const)('%s unlocks immediately and changes no other deal, stage or side', sideName => {
    const { qc, cache, input, other, row } = setup(sideName);
    const side = input.side;
    cache.begin(input);
    expect(row()?.workflow?.choices[side]?.valuation?.locked).toBe(false);
    expect(row()?.workflow?.choices[side]?.legal).toEqual(locked);
    expect(qc.getQueryData<PipelineRow[]>(['pipeline', side])?.[1]).toBe(other);
    expect(row()?.workflow?.choices[side === 'seller' ? 'buyer' : 'seller']).toBeUndefined();
  });
  it('picking locks the new option before any save resolves; clearing removes it immediately', () => {
    const { cache, input, row } = setup();
    cache.begin({ ...input, unlock: false, choice: 'own' });
    expect(row()?.workflow?.choices.buyer?.valuation).toMatchObject({ value: 'own', locked: true });
    cache.begin({ ...input, unlock: false, choice: null });
    expect(row()?.workflow?.choices.buyer?.valuation).toBeUndefined();
  });
  it('cancels the current role list and single-deal read before writing the new choice', () => {
    const { qc, cache, input } = setup();
    const cancel = vi.spyOn(qc, 'cancelQueries');
    cache.begin(input);
    expect(cancel.mock.calls.map(call => call[0])).toEqual([
      { queryKey: ['pipeline', 'buyer'], exact: true },
      { queryKey: ['pipeline', 'deal', 'buyer', 'a'], exact: true },
    ]);
  });
  it.each(['unlock', 'pick', 'clear'] as const)('failed %s restores the exact old row and preserves another stage', async action => {
    const { cache, input, row } = setup();
    const op = cache.begin({ ...input, unlock: action === 'unlock', choice: action === 'clear' ? null : 'own' });
    const legal = cache.begin({ ...input, stage: 'legal', choice: 'pitchsnack', unlock: false });
    await expect(cache.run(op, async () => { throw new Error('failure'); })).rejects.toThrow('failure');
    expect(row()?.workflow?.choices.buyer?.valuation).toEqual(locked);
    expect(row()?.workflow?.choices.buyer?.legal?.value).toBe('pitchsnack');
    await cache.run(legal, async () => {});
  });
  it('serializes Unlock then immediate pick while painting the latest choice throughout', async () => {
    const { cache, input, row } = setup();
    const wait = deferred(), calls: ChoiceInput[] = [];
    const unlock = cache.begin(input);
    const first = cache.run(unlock, async data => { calls.push(data); await wait.promise; });
    const pick = cache.begin({ ...input, choice: 'own', unlock: false });
    const second = cache.run(pick, async data => { calls.push(data); });
    await Promise.resolve();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.unlock).toBe(true);
    expect(row()?.workflow?.choices.buyer?.valuation).toMatchObject({ value: 'own', locked: true });
    wait.resolve(); await first; await second;
    expect(calls.map(c => c.choice)).toEqual(['none', 'own']);
    expect(row()?.workflow?.choices.buyer?.valuation).toMatchObject({ value: 'own', locked: true });
  });
  it('an older failure does not erase a newer click or prevent its save', async () => {
    const { cache, input, row } = setup();
    const wait = deferred();
    const first = cache.run(cache.begin(input), () => wait.promise);
    const latest = cache.begin({ ...input, unlock: false, choice: 'pitchsnack' });
    const second = cache.run(latest, async () => {});
    wait.reject(new Error('failed unlock'));
    await expect(first).rejects.toThrow('failed unlock');
    expect(row()?.workflow?.choices.buyer?.valuation?.value).toBe('pitchsnack');
    await second;
    expect(row()?.workflow?.choices.buyer?.valuation?.value).toBe('pitchsnack');
  });
  it('a failed later pick returns to the successfully unlocked choice, not the original lock', async () => {
    const { cache, input, row } = setup();
    await cache.run(cache.begin(input), async () => {});
    await expect(cache.run(cache.begin({ ...input, unlock: false, choice: 'own' }), async () => { throw new Error('no'); })).rejects.toThrow('no');
    expect(row()?.workflow?.choices.buyer?.valuation).toEqual({ ...locked, locked: false });
  });
  it('an overlapping list response cannot overwrite pending choices or unrelated fresh facts', () => {
    const { cache, qc, input, p, row } = setup();
    cache.begin(input);
    qc.setQueryData(['pipeline', 'buyer'], [{ ...p, status: 'fresh' }]);
    expect(row()?.workflow?.choices.buyer?.valuation?.locked).toBe(false);
    expect(row()?.status).toBe('fresh');
  });
  it('re-reads only the deal after the queue drains and invalidates the three list families quietly', async () => {
    const { cache, qc, input, p, row } = setup();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const read = vi.fn(async () => ({ ...p, status: 'server', workflow: { ...p.workflow, choices: { buyer: { valuation: { ...locked, locked: false } } }, receipts: {}, payment: {} } } as PipelineRow));
    const op = cache.begin(input);
    await cache.settle(input, read);
    expect(read).not.toHaveBeenCalled();
    await cache.run(op, async () => {});
    await cache.settle(input, read);
    expect(read).toHaveBeenCalledTimes(1);
    expect(qc.getQueryData(cache.detailKey(input))).toMatchObject({ id: 'a', status: 'server' });
    expect(row()?.status).toBe('server');
    expect(invalidate.mock.calls.map(call => call[0]?.queryKey)).toEqual([['pipeline'], ['invitations'], ['reports-hub']]);
  });
  it('a click during a delayed single-deal read wins over the older result', async () => {
    const { cache, input, p, row } = setup();
    await cache.run(cache.begin(input), async () => {});
    const wait = deferred();
    const settling = cache.settle(input, async () => { await wait.promise; return p; });
    cache.begin({ ...input, unlock: false, choice: 'own' });
    wait.resolve(); await settling;
    expect(row()?.workflow?.choices.buyer?.valuation).toMatchObject({ value: 'own', locked: true });
  });
  it('two deals can save independently and one failure cannot roll back the other deal', async () => {
    const { cache, qc, input, row } = setup();
    const first = cache.begin(input);
    const other = cache.begin({ ...input, id: 'b', unlock: false, choice: 'own' });
    await expect(cache.run(first, async () => { throw new Error('no'); })).rejects.toThrow('no');
    expect(row()?.workflow?.choices.buyer?.valuation).toEqual(locked);
    expect(qc.getQueryData<PipelineRow[]>(['pipeline', 'buyer'])?.[1]?.workflow?.choices.buyer?.valuation?.value).toBe('own');
    await cache.run(other, async () => {});
  });
  it('uses the supplied bilingual fallback for transport errors but preserves server reasons', () => {
    expect(choiceSaveError(new Error('Failed to fetch'), 'fallback')).toBe('fallback');
    expect(choiceSaveError(undefined, 'fallback')).toBe('fallback');
    expect(choiceSaveError(new Error('This deal has ended'), 'fallback')).toBe('This deal has ended');
  });
});