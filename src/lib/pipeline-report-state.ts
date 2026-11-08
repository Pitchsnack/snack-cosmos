import type {HubRow} from './reports-hub';
import type {PipelineRow} from './pipeline.functions';
export function reportReadyToView(row: HubRow, seller: boolean) {
  return row.status === 'ready' && (seller || row.buyerState === 'shared' || row.buyerState === 'yours');
}
export function financialStageComplete(p: Pick<PipelineRow, 'ndaApprovedAt'>) {
  return !!p.ndaApprovedAt;
}
export function optionalStageComplete(p: Pick<PipelineRow, 'loiAcceptedAt' | 'workflow'>, seller: boolean, stage: 'valuation' | 'legal') {
  if (!p.loiAcceptedAt) return false;
  const side = seller ? 'seller' : 'buyer';
  const choice = p.workflow?.choices?.[side]?.[stage]?.value;
  if (choice === 'none') return true;
  if (stage === 'valuation') return !!p.workflow?.receipts?.[side]?.at;
  return (choice === 'own' || choice === 'pitchsnack') && !!p.workflow?.spaSignedAt;
}
export function paymentConfirmationPending(p: Pick<PipelineRow, 'loiAcceptedAt' | 'workflow' | 'paymentAt'>, seller: boolean) {
  return !!p.loiAcceptedAt && !p.paymentAt && !!p.workflow?.payment?.[seller ? 'seller' : 'buyer'];
}