import type {HubData, HubRow} from './reports-hub';
export function reportReadyToView(row: HubRow, seller: boolean) {
  return row.status === 'ready' && (seller || row.buyerState === 'shared' || row.buyerState === 'yours');
}
export function financialStageComplete(hub?: HubData) {
  return hub?.buyerHasReadyReport === true;
}