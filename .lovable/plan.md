# Either-side LOI and the stages after it

## Scope
Apply the uploaded Markdown brief over the interactive HTML reference to seller/buyer All deals and Deal watchlist, including Control’s Seller/Buyer views. Preserve NDA privacy, reports, agreements, existing completed deals and advisor permissions. Use Admin as Deal Support for now; its Message button opens the existing Admin Help Desk.

## 1. Letters from either side
- Let either authorised side send when there is no current letter; save the sender and make only the recipient able to decide.
- Remove new seller LOI requests from both the screen and the action that creates them. Keep existing open requests, buyer prefill/banner and seller withdrawal until answered.
- Share the eight-clause EN/TH letter across Send, View, Revised and Preview. Conditions remain exactly as typed.
- Require scrolling to the end before consent; keep entered terms, read state and consent when a confirmation is cancelled.
- Add the specified Send, Accept and Decline confirmation pop-ups and completed consent display.
- Save requested price, exclusivity, conditions and optional note without changing the original letter. Allow the sender to accept the revised terms or send its own revised letter.
- Keep dated term snapshots for the expandable LOI steps and a decline notice shown once per authorised person, acknowledged only with OK.
- Mirror current bell/email behavior for either sender and revised actions, respecting existing email switches. Do not post LOI actions into Messages.

## 2. Post-LOI stages
- Replace steps 4–7 with Deal Support, optional Independent valuation, optional Legal including SPA, and Payment.
- On acceptance, save an Admin support assignment and date for both sides. Show the green expandable row, hat marker, FREE badge and Help Desk button.
- Save each side’s valuation/legal choice and date. Choices lock against accidental taps; Unlock enables a new choice and Clear removes that side’s choice. A valuation choice change resets that side’s report step, not the other side’s work or shared SPA dates.
- For an own valuer, save report receipt and an optional private PDF/Word/Excel attachment. PitchSnack advisor delivery remains pending until its separate upload workflow exists.
- Keep shared SPA drafted/signed dates server-only with no new card buttons.
- Save each side’s payment-readiness confirmation. Show optional unfinished steps without blocking confirmation; both confirmations enable Go to payment, which only shows the specified not-open-yet message.

## 3. Shared cards and review alert
- Add folded row timelines, selection-safe click-to-fold behavior, current-stage colours, optional markers/bracket, shared button hover states and the revised Step chip.
- Update waiting rules centrally: no letter means neither side is waiting; recipient decisions, revised-term acceptance and outstanding payment confirmation count as waiting.
- Remove the waiting-count sentence from All deals.
- Add an All deals-only alert inside the existing top bar, clear of the bell, using the current authorised LOI and NDA invitation data. Preserve preapproval anonymous NDA identities.
- Implement the four-second fold, pointer/focus pause, manual reopening, review destinations and brief green acceptance state with reduced-motion equivalents.

## Technical safeguards
- Extend existing authenticated pipeline functions and their whitelisted DTOs; preserve server-side seller startup-access checks and exact buyer-owner authority.
- Apply additive schema changes through the migration tool. Keep legacy buyer-origin LOIs, termless change requests, open requests, accepted dates and completed-payment meaning intact; do not invent past reading evidence or overwrite live terms.
- Use transactional/version-checked writes so concurrent sends cannot overwrite a letter and stale decisions cannot accept different terms. Record immutable action/consent snapshots with the state transition; dispatch notifications once from successful events.
- Keep private report files and decline acknowledgements scoped to the correct deal/person, with grants and access policies for every added table. Support assignment does not widen private-profile access.
- Reuse shared Pipeline cards, NDA dialogs, Help Desk, HatMark, design tokens and translations. Add a scoped header host for the page-owned alert rather than positioning it against page content.

## Verification
- Add and run focused tests for sender/recipient permissions, advisor denial, one-letter concurrency, stale revisions, consent/version records, legacy requests/changes, per-person decline notices, choice reset, private attachment access, bilateral readiness and waiting counts.
- Exercise Send → recipient review → request changes → revised acceptance, plus decline/new-letter and post-acceptance flows, with authorised test accounts. Do not change real deal terms or send test mail to real counterparties.
- Check both sides at 1440, 1024 and 390px, EN/TH, light/dark; reader/confirmation cancellation, timelines, keyboard/focus, alert timing and reduced motion.
- Verify existing NDA, reports, agreement countdown, watchlist, History and advisor behavior remain intact; report any live checks blocked by unavailable safe test accounts.

## Deliberately not built
Payment/escrow, an Admin contact picker, arbitrary direct-user chat, advisor report upload controls, or SPA recording controls. No reference sample data is imported.