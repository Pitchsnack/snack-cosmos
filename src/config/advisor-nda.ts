// The advisor NDA's own template (three parties). Kept apart from the
// buyer–seller NDA so its wording can change on its own.
export const ADVISOR_NDA_TERM_YEARS = 2;
export const ADVISOR_NDA_USE = "Only for this deal. Nothing goes to anyone else without both sides’ consent.";
export const advisorNdaPurpose = (client: string) => `Advising ${client} on this deal`;

const d = (s: string | Date) => new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).replace("Sept", "Sep");

export function advisorNdaText(v: { firm: string; firmRef: string | null; seller: string; buyer: string; client: string; signer: string; signedAt: string | Date; expiresAt: string | Date }) {
  return `ADVISOR NON-DISCLOSURE AGREEMENT

Between ${v.firm}${v.firmRef ? ` (${v.firmRef})` : ""} ("the Advisor"), ${v.seller} ("the Seller") and ${v.buyer} ("the Buyer"), arranged through PitchSnack.

1. Purpose. ${advisorNdaPurpose(v.client)}. The Advisor receives confidential information only to advise ${v.client} on the possible transaction between the Seller and the Buyer.

2. Confidential information. All information the Advisor receives through PitchSnack about this deal, including the parties' identities, contacts, documents and the progress of the deal, is confidential.

3. Use. ${ADVISOR_NDA_USE}

4. What stays between the Seller and the Buyer. Their own NDA, the financial report, the valuation and the letter of intent are not shared with the Advisor under this agreement.

5. No direct contact. The Advisor does not contact the other side's staff, customers or suppliers without that side's written consent.

6. Term. This agreement runs for ${ADVISOR_NDA_TERM_YEARS} years from signing, until ${d(v.expiresAt)}.

7. Return of information. On request, the Advisor deletes or returns all confidential information.

8. Governing law. This agreement is governed by the laws of Thailand.

Signed by ${v.signer} for the Advisor on ${d(v.signedAt)}, and sent to the Seller and the Buyer the same day.

— End of agreement —`;
}
