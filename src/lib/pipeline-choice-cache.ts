import { type QueryClient, type QueryKey } from '@tanstack/react-query';
import type { PipelineRow } from './pipeline.functions';
import type { DealSide, StageChoice } from './loi-workflow';

export type ChoiceStage = 'valuation' | 'legal';
export type ChoiceInput = { id: string; side: DealSide; stage: ChoiceStage; choice: StageChoice['value']; unlock?: boolean };
type Operation = { input: ChoiceInput; at: string };
type RowQueue = { base: StageChoice | undefined; pending: Operation[]; tail: Promise<unknown> };
type DealState = { id: string; side: DealSide; rows: Map<ChoiceStage, RowQueue>; revision: number };

export function nextChoice(before: StageChoice | undefined, op: Operation): StageChoice | undefined {
  if (op.input.unlock) return before ? { ...before, locked: false } : undefined;
  return op.input.choice === null ? undefined : { value: op.input.choice, locked: true, at: op.at };
}

function putChoice(p: PipelineRow, side: DealSide, stage: ChoiceStage, value: StageChoice | undefined): PipelineRow {
  const existing = p.workflow?.choices[side]?.[stage];
  if (existing === value || (existing && value && existing.value === value.value && existing.locked === value.locked && existing.at === value.at)) return p;
  const workflow = p.workflow ?? { choices: {}, receipts: {}, payment: {} };
  const choices = { ...workflow.choices[side] };
  if (value) choices[stage] = value;
  else delete choices[stage];
  return { ...p, workflow: { ...workflow, choices: { ...workflow.choices, [side]: choices } } };
}

/** One journal per QueryClient, never shared across users or SSR requests. */
export class PipelineChoiceCache {
  private deals = new Map<string, DealState>();
  private unsubscribe: (() => void) | undefined;
  private writing = false;

  constructor(private qc: QueryClient) {}
  private key(input: Pick<ChoiceInput, 'id' | 'side'>) { return `${input.side}:${input.id}`; }
  private listKey(side: DealSide): QueryKey { return ['pipeline', side]; }
  detailKey(input: Pick<ChoiceInput, 'id' | 'side'>): QueryKey { return ['pipeline', 'deal', input.side, input.id]; }

  begin(input: ChoiceInput): Operation {
    // Cancellation is synchronous; don't await its Promise before showing the click.
    void this.qc.cancelQueries({ queryKey: this.listKey(input.side), exact: true });
    void this.qc.cancelQueries({ queryKey: this.detailKey(input), exact: true });
    let deal = this.deals.get(this.key(input));
    if (!deal) {
      deal = { id: input.id, side: input.side, rows: new Map(), revision: 0 };
      this.deals.set(this.key(input), deal);
    }
    let row = deal.rows.get(input.stage);
    if (!row) {
      const p = this.qc.getQueryData<PipelineRow[]>(this.listKey(input.side))?.find(p => p.id === input.id);
      row = { base: p?.workflow?.choices[input.side]?.[input.stage], pending: [], tail: Promise.resolve() };
      deal.rows.set(input.stage, row);
    }
    const op = { input, at: new Date().toISOString() };
    row.pending.push(op);
    deal.revision++;
    if (!this.unsubscribe) {
      // Polling, focus refresh or another card's save must not erase pending clicks.
      this.unsubscribe = this.qc.getQueryCache().subscribe(event => {
        const key = event.query.queryKey;
        if (event.type === 'updated' && event.action.type === 'success' && !this.writing && key[0] === 'pipeline' && (key.length === 2 || key[1] === 'deal')) this.paint();
      });
    }
    this.paint();
    return op;
  }

  private overlay(p: PipelineRow, deal: DealState): PipelineRow {
    for (const [stage, row] of deal.rows) {
      let value = row.base;
      for (const op of row.pending) value = nextChoice(value, op);
      p = putChoice(p, deal.side, stage, value);
    }
    return p;
  }

  private paint() {
    this.writing = true;
    try {
      for (const deal of this.deals.values()) {
        const rows = this.qc.getQueryData<PipelineRow[]>(this.listKey(deal.side));
        if (rows) {
          let changed = false;
          const next = rows.map(p => {
            const result = p.id === deal.id ? this.overlay(p, deal) : p;
            changed ||= result !== p;
            return result;
          });
          if (changed) this.qc.setQueryData(this.listKey(deal.side), next);
        }
        const p = this.qc.getQueryData<PipelineRow | null>(this.detailKey(deal));
        if (p) {
          const next = this.overlay(p, deal);
          if (next !== p) this.qc.setQueryData(this.detailKey(deal), next);
        }
      }
    } finally { this.writing = false; }
  }

  async run(op: Operation, save: (input: ChoiceInput) => Promise<unknown>): Promise<void> {
    const row = this.deals.get(this.key(op.input))?.rows.get(op.input.stage);
    if (!row) return;
    const result = row.tail.then(() => save(op.input));
    // A failed save must not block subsequent saves in this row.
    row.tail = result.catch(() => undefined);
    try {
      await result;
      row.base = nextChoice(row.base, op);
    } finally {
      row.pending = row.pending.filter(item => item !== op);
      // Roll back only this row, then replay newer clicks over the confirmed base.
      this.paint();
    }
  }

  async settle(input: ChoiceInput, read: () => Promise<PipelineRow | null>): Promise<void> {
    const deal = this.deals.get(this.key(input));
    if (!deal || [...deal.rows.values()].some(row => row.pending.length)) return;
    const revision = deal.revision;
    try {
      const p = await this.qc.fetchQuery({ queryKey: this.detailKey(input), queryFn: read, staleTime: 0 });
      if (deal.revision !== revision || [...deal.rows.values()].some(row => row.pending.length)) return;
      this.deals.delete(this.key(input));
      if (!this.deals.size) { this.unsubscribe?.(); this.unsubscribe = undefined; }
      this.qc.setQueryData<PipelineRow[]>(this.listKey(input.side), rows => rows?.flatMap(old => old.id === input.id ? p ? [p] : [] : [old]));
    } catch {
      if (deal.revision !== revision) return;
      // Keep the confirmed/rolled-back view if the read fails; list refresh can recover it.
      this.deals.delete(this.key(input));
      if (!this.deals.size) { this.unsubscribe?.(); this.unsubscribe = undefined; }
    }
    if (deal.revision !== revision) return;
    // Do not await list/count work or connect it to the card's busy flag.
    for (const key of ['pipeline', 'invitations', 'reports-hub']) {
      void this.qc.invalidateQueries({ queryKey: [key] }).catch(() => undefined);
    }
  }
}

const caches = new WeakMap<QueryClient, PipelineChoiceCache>();
export function pipelineChoiceCache(qc: QueryClient) {
  let cache = caches.get(qc);
  if (!cache) { cache = new PipelineChoiceCache(qc); caches.set(qc, cache); }
  return cache;
}

export function choiceSaveError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : '';
  return !message || /^(Failed to fetch|NetworkError|Network request failed|Load failed|Internal Server Error|fetch failed|HTTP 5\d\d)/i.test(message) ? fallback : message;
}