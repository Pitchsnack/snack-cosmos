import type { PipelineRow } from "@/lib/pipeline.functions";

export const STEPS = ["NDA", "Financial & Valuation", "Letter of intent", "Contact M&A", "Legal", "Offer & SPA", "Payment"] as const;

export function stepDates(p: PipelineRow) {
  return [p.ndaApprovedAt, p.reportSharedAt, p.loiAcceptedAt, p.contactAt, p.legalAt, p.spaAt, p.paymentAt];
}
export function currentStep(p: PipelineRow) {
  const i = stepDates(p).findIndex((x) => !x);
  return i === -1 ? STEPS.length : i;
}
export function isPending(p: PipelineRow) {
  return !p.ndaApprovedAt || (!!p.loiSentAt && !p.loiAcceptedAt);
}

/** Who the Tracking card is waiting on, and for what. */
export function waitState(p: PipelineRow, seller: boolean): { onYou: boolean; what: string } {
  if (p.paymentAt) return { onYou: false, what: "deal completed" };
  if (seller) {
    if (p.reportRequestedAt && !p.reportSharedAt) return { onYou: true, what: "share the financial report" };
    if (p.loiSentAt && !p.loiAcceptedAt) return { onYou: true, what: "review the letter of intent" };
    if (!p.loiSentAt) return { onYou: false, what: "letter of intent" };
    if (!p.legalAt) return { onYou: true, what: "share the legal folder" };
    if (!p.spaAt) return { onYou: true, what: "share the SPA draft" };
    return { onYou: true, what: "confirm payment" };
  }
  if (p.reportRequestedAt && !p.reportSharedAt) return { onYou: false, what: "financial report" };
  if (!p.loiSentAt) return { onYou: true, what: "send a letter of intent" };
  if (!p.loiAcceptedAt) return { onYou: false, what: "decision on your letter of intent" };
  if (!p.legalAt) return { onYou: false, what: "legal folder" };
  if (!p.spaAt) return { onYou: false, what: "SPA draft" };
  return { onYou: false, what: "payment" };
}

/** Pipeline menu badge = cards waiting on you (plus NDA requests for sellers). */
export function waitingOnYouCount(rows: PipelineRow[], seller: boolean) {
  return rows.filter((p) => (p.ndaApprovedAt ? waitState(p, seller).onYou : seller)).length;
}
