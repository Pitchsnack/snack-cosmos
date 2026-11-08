import type { PipelineRow } from "@/lib/pipeline.functions";

export const STEPS = ["NDA", "Financial & Valuation", "Letter of intent", "Deal Support", "Independent valuation", "Legal", "Payment"] as const;

export function stepDates(p: PipelineRow) {
  const latest=(values:(string|null|undefined)[])=>values.filter((x):x is string=>!!x).sort().at(-1)??null;
  const w=p.workflow;
  return [p.ndaApprovedAt,p.reportSharedAt,p.loiAcceptedAt,w?.supportAt??null,latest([w?.receipts?.buyer?.at,w?.receipts?.seller?.at]),w?.spaSignedAt??w?.spaDraftedAt??null,p.paymentAt??(w?.payment?.buyer&&w.payment.seller?latest([w.payment.buyer,w.payment.seller]):null)];
}
export function currentStep(p: PipelineRow) {
 if(!p.ndaApprovedAt)return 0;
 if(p.loiAcceptedAt){if(p.paymentAt)return 6;return 3;}
 return 2;
}
export function isPending(p: PipelineRow) {
  return !p.ndaApprovedAt || (!!p.loiSentAt && !p.loiAcceptedAt);
}

/** Who the Tracking card is waiting on, and for what. */
export function waitState(p: PipelineRow, seller: boolean): { onYou: boolean; what: string } {
  if (!p.ndaApprovedAt) return { onYou: seller, what: seller ? "approve or decline the NDA request" : "approve your NDA request" };
  if (p.paymentAt) return { onYou: false, what: "deal completed" };
  if (p.loiAcceptedAt) return {onYou:!p.workflow?.payment?.[seller?"seller":"buyer"],what:p.workflow?.payment?.[seller?"seller":"buyer"]?"payment confirmation":"confirm payment"};
  if (!p.loiSentAt) return {onYou:false,what:"next: a letter of intent, from either side"};
  const mine=(p.loiFrom??"buyer")===(seller?"seller":"buyer");
  if(p.loiChangesRequestedAt)return {onYou:mine,what:mine?"accept the revised letter of intent":"decision on the revised letter of intent"};
  return {onYou:!mine,what:mine?"decision on your letter of intent":"review the letter of intent"};
}

/** Pipeline menu badge = cards waiting on you (plus NDA requests for sellers). */
export function waitingOnYouCount(rows: PipelineRow[], seller: boolean) {
  return rows.filter((p) => (p.ndaApprovedAt ? waitState(p, seller).onYou : seller)).length;
}
