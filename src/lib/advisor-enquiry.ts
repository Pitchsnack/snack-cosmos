/**
 * Browse advisors: client-safe shapes and wording for enquiries, proposals
 * and engagements between a seller's or buyer's company and an advisor firm.
 * Every status change happens on the server (advisor-enquiries.functions.ts).
 */
import { feeWords, fmtAmount, type FeeDetail } from "@/lib/advisor-firm";

export type ClientSide = "seller" | "buyer";
export type EnquiryStatus = "enquiry" | "talking" | "proposal" | "engaged" | "done" | "declined" | "closed";
export type ProposalStatus = "open" | "accepted" | "declined" | "expired" | "replaced";
export type Timing = "asap" | "month" | "quarter" | "exploring";
export type DeclineReason = "no_service" | "booked" | "deal_size" | "other";

export const OPEN_STATUSES: EnquiryStatus[] = ["enquiry", "talking", "proposal", "engaged"];

export const TIMINGS: { value: Timing; label: string }[] = [
  { value: "asap", label: "As soon as possible" },
  { value: "month", label: "Within a month" },
  { value: "quarter", label: "In 1–3 months" },
  { value: "exploring", label: "Just exploring" },
];
export const timingLabel = (t: string | null | undefined) => TIMINGS.find((x) => x.value === t)?.label ?? null;

/** Reasons as the firm picks them, and as the client reads them. */
export const REASONS: { value: DeclineReason; label: string; client: string }[] = [
  { value: "no_service", label: "We don't offer this service", client: "We don't offer this service" },
  { value: "booked", label: "We're fully booked", client: "We're fully booked" },
  { value: "deal_size", label: "It's outside the deal sizes we work on", client: "It's outside the deal sizes we work on" },
  { value: "other", label: "Another reason", client: "For another reason" },
];
export const reasonText = (r: string | null | undefined) => REASONS.find((x) => x.value === r)?.client ?? "For another reason";

export const RATING_LABELS = ["Poor", "Fair", "Good", "Very good", "Excellent"];

/** Placeholder for "What do you need help with?" by service and side. */
export const ENQUIRY_EXAMPLES: Record<string, [string, string]> = {
  "M&A advisory": ["e.g. We plan to sell 60% of the company next year and need help finding buyers and running the sale.", "e.g. We are looking for food companies in the north to buy and need help finding and approaching them."],
  Valuation: ["e.g. A valuation of the company before we list it for sale, based on the 2025 accounts.", "e.g. A second opinion on the value of a company we plan to buy."],
  Tax: ["e.g. How a share sale would be taxed for the owners, and what to fix before buyers look.", "e.g. A tax due diligence on a target and how best to structure the purchase."],
  Legal: ["e.g. A legal review of the share purchase agreement once we have a buyer.", "e.g. Legal due diligence on a target and the share purchase agreement."],
  "Accounting & audit": ["e.g. Audited statements for 2024 and 2025 before buyers ask for them.", "e.g. A review of the target's accounts before we sign."],
  "Financial due diligence": ["e.g. A vendor due diligence report to give buyers before they make an offer.", "e.g. A financial due diligence on a company we signed a letter of intent with."],
  "Debt & financing": ["e.g. Refinance our bank loans before the sale.", "e.g. A bank loan to fund about half of an acquisition."],
  "Business broker": ["e.g. Help to sell our two cafés in Chiang Mai.", "e.g. Find us a small clinic for sale in Bangkok."],
  Restructuring: ["e.g. Restructure our bank debt before we sell.", "e.g. Restructure a target's debt after we buy it."],
  "ESG & sustainability": ["e.g. An ESG review a buyer asked for.", "e.g. An ESG review of a target before we sign."],
};

/** The proposal's fee words: as on the profile, but a fixed fee reads "Fixed fee ฿{amount}". */
export function proposalFeeWords(f: FeeDetail): string | null {
  if (f.type === "quote") return null;
  if (f.type === "fixed") return /^\d{1,12}$/.test(f.amount) && Number(f.amount) >= 1 ? `Fixed fee ฿${fmtAmount(f.amount)}` : null;
  return feeWords(f);
}

export type ProposalDTO = {
  id: string; service: string; scope: string; fee: string; timing: string | null; validUntil: string;
  letter: { name: string; size: number } | null; status: ProposalStatus; sentAt: string; sentBy: string; answeredAt: string | null;
};

/** This company's latest enquiry with a firm, as the card, panel and tray read it. */
export type EnquiryState = {
  enquiryId: string; status: EnquiryStatus; service: string; createdAt: string; readAt: string | null;
  declinedReason: string | null; declinedAt: string | null; engagedAt: string | null; doneAt: string | null;
  /** When the enquiry is "talking": why (the last proposal was declined or expired). */
  lastOutcome: { kind: "declined" | "expired"; at: string } | null;
  proposal: ProposalDTO | null; engagedFee: string | null; firmPerson: string | null;
  review: { stars: number; comment: string | null; line: string } | null;
  conversationKey: string;
};

export type Me = { name: string; first: string; title: string | null; company: string | null; email: string | null; phone: string | null; side: ClientSide };

export const fmtShort = (iso: string | null | undefined, th = false) =>
  iso ? new Date(iso).toLocaleDateString(th ? "th-TH-u-ca-gregory" : "en-GB", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" }).replace("Sept", "Sep") : "";
export const fmtLong = (iso: string | null | undefined, th = false) =>
  iso ? new Date(iso).toLocaleDateString(th ? "th-TH-u-ca-gregory" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).replace("Sept", "Sep") : "";
