# Setup wizards: easier sector question, buyer/advisor step bar, ticket box, sign-in email, address

The brief touches all three setup wizards, the buyer and advisor forms, My Company banners, cards and the database. I'll build it in four phases and check each one before starting the next.

## Phase 1 — The short list (sections 1–4, 9 sector data)
- One shared "type of business" question: 16 tiles with icons, kind chips for Manufacturing and Construction, the box under the question, and the existing SET sector picker opened from Other.
- **Seller:** "What does your business do?" with one type at a time, "Not right? Pick from all sectors", "Back to the short list", the error line, and reopening on the saved pick.
- **Buyer and advisor:** up to 5 types, the Sector agnostic toggle (with the amber note for buyers only), "All manufacturing · 11 sectors" tags, Other with unlimited ticks, the error lines, and the Review row wording.
- One Change pop-up for the buyer's and advisor's Review & complete, Edit profile, and Admin's Edit Investor.
- Cards show "All manufacturing" / "All construction" as one chip, and "+n more" after 5 chips. Filters still match the saved sectors.
- Data: a sector pick on the seller's business, and the type picks on the buyer and advisor records. Existing buyer and advisor profiles open with Other picked and their saved sectors ticked. I'll list the records I change.
- Any SET name in the brief that differs from the app's list keeps the app's name. I'll report each one.

## Phase 2 — Step bar and banners (section 5)
- The seller's step bar in the buyer's and advisor's wizards: one step per question shown, plus Review, with the labels from the brief.
- "Answered" is worked out from the saved answers only. A new furthest-step-reached record marks skipped questions red. Review's forward button is off only while a required question is unanswered.
- The bar replaces the 180px bar in both My Company setup banners, with the count line. "Finish setup to publish" is removed while setup isn't done.

## Phase 3 — What sellers see, sign-in email (sections 6–7)
- Buyer average investment: the "What sellers see" box. Continue moves on; picking a range no longer does.
- Advisor contact email: a read-only box showing the sign-in email, everywhere the advisor or Admin edits the firm profile. Shown emails read from the owner's account. I'll list the profiles whose shown email changes.

## Phase 4 — Business address (section 8, 10)
- The existing Business address box in the buyer's firm question, plus an Address question for Individual Investors. The address is required in the wizards and Review & complete. Edit profile checks it only when it was changed.
- New address fields on the buyer record. Text already in the old single field moves into the first line. Sellers still see only the province before NDA.
- Thai for all the new wording, translated by me. I'll flag it for your review, since the brief doesn't supply Thai.

## Technical notes
- New columns: startups.sector_pick (jsonb), investors.sector_picks and advisor_firms.sector_picks (jsonb), buyer_profiles/advisor_firms setup_reached (text), investors address_line1/2, address_city_district, address_province_state, postal_code.
- Saved industries/sectors are worked out from the picks on save, in one shared helper, so matching stays as built.
