# Control-added buyer profiles after setup
- [x] Replace the completed extra-profile placeholder with the buyer's shared folder-tab card, PublicPanel/BuyerPrivatePanel, section editing and state footer; keep unfinished profiles on DraftCompanyPanel.
- [x] Pass the authorized investor id through registration, verification, pause/resume, review, decision and identity-check handlers; keep extra approval state in the existing investors.wizard.bp record without creating accounts or changing saved records.
- [x] Include submitted extras in Admin Approvals and approved live extras in Browse investors; share Listing/Exclusive selection between Profiles/Split cards and panels.
- [x] Code-only verification per Dan: focused storage/rule tests, related approval tests and TypeScript. No sign-in, browser checks, screenshots or database-record changes.

# Profile field-row alignment sweep
- [ ] Enumerate every seller, buyer and advisor side-by-side labelled field row in Edit information, Review & complete and Control/Admin hosts, including custom grids outside `CompactFields`.
- [ ] Measure custom rows at desktop widths in EN/TH, fix only rows that remain out of line, and preserve settled data, permissions and phone stacking.
- [ ] Re-run focused tests and live read-only checks; report every checked surface and any surface that could not be exercised.

# Buyer shared field-row alignment
- [x] Equalize label areas through the shared `CompactFields` grid while preserving each label's wording, wrapping, gaps, tags and required markers; exclude later hints/errors and retain the phone stack.
- [x] Route the Buyer Investment Mandate money row through the same grid and keep Region's existing 20px refresh button, 14px icon and re-detection handler unchanged.
- [x] Read-only Buyer Edit information checks at 1440/1024px: EN Fund's AUM/Average investment tops 795.03125px and Investor Classification/Company size/Region tops 512.75px; TH tops 802.53125px and 494.875px respectively; every row spread is 0px. Review & complete also passes with 0px spreads, and 390px EN/TH fields stack without overflow.
- [x] Control seller/advisor audit found no naturally misaligned shared-grid rows, so none changed. Four focused alignment tests plus four source-tag tests, TypeScript and preview build pass; no typing, saving, Continue, Auto Enrich or Region refresh actions were invoked. Four requested 1440px EN/TH screenshots delivered using pitchsnack+corporate@gmail.co.th.

# Remove every “Your answer” field tag
- [x] Suppress “Your answer” centrally in the shared Buyer and Advisor source-tag renderers, including Review & complete, Edit information and Admin/Control hosts, while preserving Auto Enrich, Company registry, DBD, language, optional and required labels.
- [x] Verified buyer Review & complete and Edit information in every EN/TH tab, seller Review and every editor tab in EN/TH, advisor Review (EN) and every Control/Admin editor tab in EN/TH; DBD, New, optional and language labels remain, with no horizontal overflow or saved-value changes. Used the named buyer login and Control per Dan's later choice; separate seller/advisor sign-ins were declined. Three correct 1440px English screenshots delivered; four focused tests, TypeScript and preview builds pass. Thai advisor Review was not reopened after its loading panel stalled, but every Thai advisor editor tab passed.

# Buyer Review & complete About Company alignment
- [x] Remove Review-only “Your answer” tags from the About Company identity fields and Investor Classification while preserving Auto Enrich and DBD indicators.
- [x] In the shared Buyer form, set the corporate first row to 200px / flexible / one-third with 22px non-wrapping labels, ellipsis protection and the existing gaps and phone stacking.
- [x] Read-only `test Coroporate` checks pass at 1440/1024px in EN/TH: every first-row input top is 546.75px, Year Founded is 200px, Registered Number and Region are 255.328px, every label is 22px and every DBD tag has one client rect. The 390px EN/TH rows stack without overflow; 31 focused tests, TypeScript and preview builds pass with no browser errors or saved profile changes. English/Thai screenshots delivered using pitchsnack+corporate@gmail.co.th.

# Buyer wizard Firm step
- [x] Remove only the first green company-record notice from the Buyer Firm step; preserve the DBD lock note and all field behavior.
- [x] Rename only this step's Firm name label to Company name / ชื่อบริษัท, widen Year founded to 200px, and keep both 22px label rows on one line with ellipsis protection.
- [x] Verified test Coroporate read-only at 1440/1024px in English and Thai: both input tops differ by 0px, Year founded is 200px, the gap is 14px, both label rows are 22px, Verified stays in line, and one DBD note remains; 390px stacks without overflow. Fourteen focused tests pass; English/Thai screenshots delivered using pitchsnack+corporate@gmail.co.th.

# Buyer Listing preview frame and one-language editing
- [x] Put the existing What sellers see caption and unchanged card in the specified light-blue frame on the Listing step and every Buyer Description & Mandate editor, with desktop alignment and the compact phone card inside.
- [x] Show one Listing language at a time: buyers follow the app language; Control/Admin reuse Texts in with EN/TH tags; the preview follows the selected language and both saved languages retain validation/translation.
- [x] Fourteen focused tests and TypeScript pass; Listing/Edit information verified at 1440 and 390px in English and Thai, including Control switching, 451.1875px desktop cards, compact 312px phone cards, no overflow, hidden-language Continue validation and cleanup of TEMP Buyer Listing Control 20261122. Screenshots delivered; the separate unfinished-Firm setup guard remains unchanged.

# Buyer firm, private descriptions, Listing step and NDA cards
- [x] Open every buyer wizard on its existing prefilled firm/company question; add the Listing step before Review with bilingual generated card texts and protected translations.
- [x] Store Website Short description privately for post-NDA cards, preserve public descriptions and existing buyer texts, and update private card titles/descriptions without changing fixed card height.
- [x] Make website reading produce distinct short/long texts, show the green line only for actual fills, and share precise empty/invalid Continue guidance across wizards.
- [x] Fifty-seven focused tests pass; existing counts: 25 in setup, 0 approved with empty public Description, 4 approved with empty published Wants to buy. Real Seller Browse/approved-NDA cards and a browser-only private-text/long-name fixture pass; buyer and seller closed cards are 451.188px with/without Wants to buy at 1440/1024/390 in EN/TH with no overflow. Screenshots delivered; TEMP Buyer Wizard PE 20261121 and TEMP Buyer Wizard Individual 20261121 deleted, with no other profiles removed.

# Buyer wizard Website Auto Enrich
- [x] Enable Website Continue for a valid URL with both descriptions empty so Auto Enrich can run; preserve required descriptions and failure behavior.
- [x] Start buyer website reading when Control's + Add company check is confirmed with a website, matching sign-up's welcome path.
- [x] Check the advisor Website step and fix only the same Continue/reader deadlock if present.
- [x] Twenty focused tests, TypeScript and preview build pass; live sign-up and Control + Add readable-site reads, Review Answer, unreadable-site blocking and advisor reads pass with before/after screenshots; all temporary profiles, checks, media and the test Control grant removed.

# Buyer and advisor + Add parity with sign-up
- [x] Make Control + Add Investor Profile save the same relation, types, company facts, sectors, logo and wizard markers as buyer sign-up through shared server code; Control-only extra profiles retain their confirmed per-profile storage.
- [x] Repair existing + Add buyer profiles from their held company check or official stored record: one Corporate profile repaired with official Year founded 2024 and missing skip markers; no unresolved profiles.
- [x] Compare advisor + Add Firm Profile with advisor sign-up; existing save fields and markers already matched, so no advisor application code changed.
- [x] Thirty-four focused tests plus 40 broader sign-up/buyer tests, three Bun advisor tests and TypeScript pass; live Website/Review comparisons match at 8/8 Corporate, 7/7 adviser, 6/6 Individual and 6/6 advisor. Four side-by-side screenshots delivered; all temporary profiles, checks and logo removed.

# Seller Description set sentences
- [ ] Replace automatic seller Description paragraphs with five bilingual editable sentence rows in wizard step 13 and Edit information › Listing Identity, reusing founder-story part styling and write-it-yourself mode.
- [ ] Populate parts from existing answers, omit incomplete lines from buyer text, preserve the 420-character limit and protected translations, and persist the parts server-side.
- [ ] Replace only automatically written existing Descriptions, preserve seller-written text, and report replaced/kept counts plus PS-1040 and PS-1006 buyer text.
- [ ] Add focused tests and verify Control/non-Control EN/TH flows, owner handover, incomplete lines, manual mode, translation marks, screenshots and no unrelated changes; remove any temporary test profiles.

# Automatic seller listing texts and tag fallbacks
- [x] Generate and save empty seller listing names, bilingual headlines and bilingual descriptions without overwriting seller text; preserve limits, identity checks and Admin approval.
- [x] Add Description to wizard step 13 and Review, remove seller Listing Identity auto-fill/Suggest controls, and synchronize untouched automatic translations.
- [x] Backfill eligible existing seller profiles: 35 listings changed; 24 names, 11 English/34 Thai headlines and 19 English/34 Thai descriptions filled; no unresolved rows.
- [x] Diagnose PS-1040 preview tags and add other-language tag fallbacks across preview, Browse, Split panels and Discovery.
- [ ] Focused tests, TypeScript and preview build pass; PS-1040's real English preview shows its Thai product/market tags and generated bilingual texts. Full new-profile Control/non-Control + Add EN/TH wizard walkthroughs and their screenshots remain unchecked; no temporary test profiles were created.

# Bilingual completion, wizard language routing and company-check repairs
- [ ] Count either-language values in seller, buyer and advisor completion; buyer's 30% item reads Wants to buy with its existing label and weight.
- [ ] Route setup wizard text/tags by typed language, preserve the other language and reopen saved values; backfill only misplaced text where the correct column is empty and report counts.
- [ ] Add buyer/advisor other-language description fallbacks across shared cards and panels.
- [ ] Save seller/advisor English registered names, correct the Legal name label, and keep checked sub-districts in No. and street; backfill qualifying existing records and report counts.
- [ ] Run focused tests and live test-account checks, capture PS-1040 completion and บริษัท เพ็ท มีโซ จำกัด Address screenshots, remove any temporary test profiles, and verify no unrelated behavior changed.

# Bilingual Highlights and registered-address postal codes
- [x] Detect each typed/generated Highlight's language, save it to that language, translate the other language, and preserve user-edited translations across seller wizard/Edit information paths for Control and non-Control; buyers/advisors retain their existing fields because they have no Highlights.
- [x] Mark untouched automatic translations bilingually, clear the mark on edit, and backfill one-language existing profiles: 16 listings/50 rows filled, no unresolved Highlight translations and no one-language sets remain.
- [x] Resolve missing Thai postal codes after sign-up/+ Add company confirmation; require only Postal code when no unique match exists and retain all other company-check behavior.
- [x] Add required red asterisks and bilingual missing-field explanations in Edit information › Address; filled 3 existing profiles. The 30 unresolved profiles have no usable sub-district/district address to match and remain listed in the authorised repair report.
- [x] Twenty-one focused language/translation/postal/setup tests, TypeScript and preview build pass; verified the example company's Listing Highlights and Address in English and Thai, including automatic-translation tags, 10220, red stars and exact missing-postcode messages.

# Founder story written from earlier answers
- [x] Compared the uploaded brief with both seller editing places; corrected the help placement, protected every company-name variant and website host, and kept answer-based year/sales blue and synchronized while typed parts stay unchanged.
- [x] Twenty-one focused tests pass. Real completed sellers verified EN/TH generation, all seven available parts blue, Thai translation, About Owner typing/own-words mode and company-name removal; no browser errors. Later-answer updates are covered by focused tests rather than changing live answers.
- [x] Captured the requested English and Thai About the founder screenshots for a seller with completed earlier answers.

# Reliable photo drops in every role
- [x] Accept desktop file drags over every shared empty/occupied photo slot without file-type detection during dragover; keep existing validation on drop.
- [x] Prevent slot illustrations, labels and icons from cancelling drags; stop handled drops bubbling into the page-level filler.
- [x] Treat broken stored image URLs as empty spaces so they accept replacements and do not hide the photo drop box.
- [x] Cover seller/buyer/advisor setup and Edit information through the shared components; 11 placement/autosave tests and TypeScript pass. Real empty-type and replacement drops passed in seller Edit information, buyer Edit information and the advisor editor through Admin; broken stored-photo recovery passed in seller. Every edit was cancelled without saving; separate role-account and wizard browser runs were not needed to prove the shared handler.

# Image drop behavior sweep
- [x] Audited sign-up/+ Add LogoPicker; seller Images & Logo, legacy logo and PhotosQ; buyer EntityMediaEditor and wizard; advisor LogoDrop, AttachmentCard and SetupReview; Admin create/edit LogoSlot and media editors; uploadPending, seller syncMedia, saveBuyerMedia and advisor save functions.
- [x] Fixed the remaining occupied AttachmentCard logo and advisor SetupReview photo targets; all other listed surfaces already replace the pending image and retain existing validation, ownership checks and saved data.
- [x] Nine placement/autosave tests, TypeScript and preview build pass. Human-paced real PNG drops replaced both seller PS-1005's occupied logo and photo previews without browser errors and were cancelled without saving; other surfaces were code-checked rather than browser-run.

# Existing photo slot drag and drop
- [x] Fix occupied Images & Logo photo slots ignoring file drops: dropping now replaces that slot, extra files fill empty slots, and the same occupied-slot handling covers the shared entity editor.
- [x] Five focused placement tests and TypeScript pass; a real PNG drop on PS-1005 showed Drop to replace and changed the preview with no browser errors. Cancelled without saving, leaving stored company media unchanged; preview build OK.

# Admin-only identity check
- [x] Remove seller/buyer identity warnings and submission/setup/save blocks while retaining static privacy guidance.
- [x] Build one server-side pre-NDA finding engine excluding province/region/country and covering only the brief's seller/buyer fields, with province-aware bilingual fixes.
- [x] Add Identity check to active seller/buyer Admin approval reviews with contextual/preview highlights, audited fixes, focused Edit and non-blocking publish warning.
- [x] Show the exact bilingual post-approval PitchSnack word-change notice until the seller next edits the listing.
- [x] Add focused rule tests; 29 Vitest and 13 Bun tests pass, TypeScript is clean, and a real Admin finding/preview renders without browser errors. Admin screenshot delivered.
- [ ] Live one-click before/after and seller no-warning screenshots remain unverified: there are no pending seller/buyer reviews, and existing live listing wording was not changed for a screenshot.

# Founder story year synchronization
- [x] Leave the founder-story year empty when the company year is missing, showing the existing bilingual hint.
- [x] In the seller wizard and Edit information › About Owner, update blank or previously synchronized story years when the company year changes; preserve custom-typed years and existing bios.
- [x] Six focused tests and 86 seller regressions pass; live unsaved Edit information checks covered empty, changed and custom years with About Owner closed between changes; preview build OK.

# Photo deletion during autosave
- [x] Queue the latest seller, buyer and advisor wizard media change instead of dropping clicks made while an upload/save is running; never restore stale completed state over a newer deletion.
- [x] Delete storage objects only when their path is absent from every incoming slot, so moving a photo left does not delete its file.
- [x] Add four focused regression tests; verify a delayed real upload deleted with one click stays gone after reload, and a shifted survivor still loads after reload. Restored Automation Test Seller Eleven to zero photos with its original logo unchanged; preview build OK.

# Shared company step, assisted form and rejected-number retry
- [x] Apply the exact bilingual registration link and sign-up Thai help line in every seller/buyer/advisor sign-up and + Add entry point.
- [x] Make assisted setup a standalone screen with the specified fields, responsive buttons, Back behavior and unchanged request sending.
- [x] After No/Not found, show only the yellow company explanation and allow cached same-number confirmation using one change without a new lookup.
- [x] Add focused regression tests; verify EN/TH desktop/phone flows and Control/Admin shared behavior without creating accounts or changing company data.
- [x] Deliver English/Thai assisted-form and after-No screenshots and list every shared link/form entry point.
- [x] Correct the Individual Investor sign-up Thai help line to the brief's exact wording and cover it with a regression test.
- [x] Complete the brief's separate seller, buyer and advisor EN/TH assisted-form and after-No browser proof without creating profiles or sending requests; cached retries reached 1 change left with no browser errors.

# Logo drop hint everywhere
- [x] Add the exact bilingual “+ Add logo” / “Or drop it here.” empty state to the shared sign-up and + Add logo box without changing its 120px size or file checks.
- [x] Apply the same two lines and working drop behaviour to seller, buyer, advisor and Admin logo editors, including directory creation/editing and setup review; hide both lines once a logo is present.
- [x] Check EN/TH, phone sizing and real dropped-file previews in the shared controls; audit every entry point. Full seller host dialog stayed on its loading panel, so host-level Save was not exercised.

# Shared sign-up and + Add company flow

## One flow for sellers, buyers and advisors
- [ ] Reuse sign-up's role-specific About/type/sector/company/logo steps in + Add, omitting only Role, Account and email confirmation.
- [ ] Share the registration confirmation, lookup, limits, DBD-store save and bilingual + Add wording; preserve sign-up behavior and authorization.
- [ ] Create the role draft with all pre-answers and wizard answered progress only after Yes; open it selected on My Company without a welcome pop-up.
- [ ] Keep buyer + Add Control/Admin-only, preserve identity locks, and verify shared limits and no-create-on-cancel paths with focused tests.
- [ ] Run existing signup/Add tests and live EN/TH checks; capture + Add My Business at “Whose business are you selling?”, report changed files and unverified paths.

# Browse cards brief (lovable-seller-buyer-cards.md)

## Seller Industry removal and required Sector
- [x] Export the existing 28 ref/industry values for the final reply only; no database backup copy.
- [x] Remove seller/Admin Industry editing and reads, replacing displays, filters, matching, reports, Pipeline, relationships, maps and projections with SET sector.
- [x] Make Sector required in Edit information with bilingual missing counts while preserving Save/Create behavior and existing review rules.
- [x] Run focused rules/tests and live Control/Admin EN/TH checks; capture the three requested screenshots. Separate non-Control seller check not run at Dan's choice.
- [ ] Drop the Industry column/index and regenerate types: blocked by Settings → Agent permissions → “Execute backward incompatible database migrations” = “Never allow”; Dan must choose “Ask each time” or “Always allow” before retrying.

## Individual-investor registration correction recovery
- [x] Restore Back and the existing no-registration-number assisted-setup option during correction; preserve rejection and lookup limits.
- [x] Verify the affected buyer can open and leave assisted setup in EN/TH on desktop and phone without changing account data or sending requests.
- [x] Run signup regression tests (18 passed) and check preview errors (build OK).

## Seller Company row half and half
- [x] Make Company name and Company Registration Number equal-width columns; keep the registration label on one line and the existing mobile stack.
- [x] Verify EN/TH alignment at 1440px and 1280px, registration-error alignment and the 390px stack; capture the requested 1440px English screenshot.
- [x] Buyer and advisor setup checked: neither places the firm name and registration number in one row, so no buyer or advisor row changed.

## Finish and submit three test profiles
- [x] Complete buyer10, Sasu advisor and seller10 with authorised invented answers; no new accounts or sign-up tests.
- [x] Submit all three through Register your company and verify each appears in the matching Admin approval queue.
- [x] Record any validation blocker and leave submitted profiles awaiting Admin review; do not approve them.

## Seller wizard Listing step
- [x] Reuse Listing Identity wording fields and Buyer preview before Review; include unfinished setup progress and bilingual validation.
- [x] Save to existing identity columns and enforce completion without changing completed businesses or other roles.
- [x] Seller rules/handler tests and isolated EN/TH desktop/mobile browser checks; no accounts, sign-up tests or company edits. Live saved read-back deliberately not exercised because company writes are prohibited.

## Investor revenue highlight
- [x] Use the existing buyer-blue tokens for valued Min. target revenue rows in both investor card implementations.
- [x] Verified Browse investors, advisor Browse marketplace and My Company Buyer in Grid/Split/List; empty rows, values, secondary baht text and seller Asking price stay unchanged. Typecheck and preview build pass; no runtime errors.

## Setup wizard momentum follow-up
- [x] Start one owner-gated website read at Create business profile; persist and poll its result for seller, buyer and advisor instead of reading again on reopen or Finish.
- [x] Combine buyer/advisor website and descriptions, require both descriptions, add corrected contact-person rows and role-specific founder/team prefill.
- [x] Prefill only owner/family-owner seller founders and individual-investor team members; preserve agents, founder IDs/stories and private access.
- [x] Reuse sign-up logos with photo-only buyer upload steps; add shared loading, missing-field and review wording.
- [x] Finish seller layout spacing and focused save/background-read/prefill tests; typecheck clean, with no sign-up tests or new accounts.
- [ ] Full live wizard walkthroughs remain unverified: existing My Company profile data took over 25 seconds to load and draft selection did not open during the available check.

## Statements-only financial report and P&L ratios
- [x] Update shared and legacy viewers, sample, expanded views and PDF printing without changing report access.
- [x] Move report descriptions and route old ratios links only when P&L is accessible.
- [x] 32 tests pass; signed-in Control My reports and buyer Pipeline, EN/TH, phone, Expand and print section visibility verified.
- [ ] Separate non-Control seller/buyer, View as, seller per-buyer and Admin modal live checks require suitable sessions or reliable populated opening controls; actual PDF page layout and Compare (only one shared report) remain unverified.

## Review alert on every page
- [x] Mount one shared seller/buyer alert in the authenticated top-bar layout; remove the All deals copy and exclude Admin/advisors.
- [x] Preserve folding across navigation, refresh live counts every five seconds and make LOI/NDA review actions work from every eligible page.
- [x] Control seller My Company, Browse, watchlist, Messages, Notifications, reports and every Pipeline page; folded navigation, LOI/NDA destinations, Thai, dark mode, 1440×900, 1280×720 and 1024; one alert only and no runtime errors.
- [ ] Buyer-with-items screenshot and live new-NDA arrival remain unverified: the available Control buyer view has nothing waiting, and no live NDA was created. Buyer empty state, Admin and advisor exclusions checked; separate role accounts unavailable.

## Merged NDA Invitations
- [x] Merge pending/completed lists, sorting, four-part steps, history, bilingual controls and deep links; retain existing dialogs and Applications.
- [x] Remove Deal status navigation; exclude unsigned NDAs from All deals/watchlist without changing stored deals or parent badge.
- [x] Add atomic seller invitation/buyer request withdrawal, opposite-side bells and two standard email alerts.
- [x] 44 rule tests and build OK; Control buyer/seller screens, Cancel focus, NDA reader, direct links, redirect, EN/TH, dark and 1440/1280/1024 checked.
- [ ] Separate seller/buyer accounts, live withdrawal/race/email delivery and seller ended-row screenshot: no designated test accounts or ended seller row; real NDAs and emails were not changed.

## Pipeline top page links
- [x] Read brief, open reference, and report existing seller/buyer menu counts and distinct addresses.
- [x] Add six bilingual links above every Pipeline title, reusing live sidebar counts; leave sidebar and other content unchanged.
- [x] Verify all six pages in both Control views and EN/TH (24 combinations), exact sidebar counts, navigation and independent 390px scrolling; 28 existing rule tests pass, no runtime errors, latest build OK; four 1280 screenshots delivered.
- Separate seller/buyer accounts were not exercised; checks used Control viewing each side. No real deal data changed.

## Pipeline completion colours follow-up
- [x] Use existing NDA/LOI and side-specific valuation/legal completion signals; keep Deal Support current after acceptance and payment confirmation.
- [x] Green completed rows with outside steps, yellow unfinished rows, blue Deal Support, payment pulse and scoped hover.
- [x] 38 focused tests pass; live Control buyer/seller accepted cards, buyer watchlist, report/outlined-button/LOI-step hover and 16 EN/TH width checks without overflow; genuine 1280 screenshots saved, latest build OK.
- [ ] Seller screenshot with completed valuation and live payment-confirmation pulse remain unverified: real seller valuation is unfinished and real confirmations were not changed. Separate role-account transitions and receipt/SPA writes require authorised test data; no real deal records modified.

## Optional Pipeline Financial & Valuation reports
- [x] Read brief and try reference folding, buyer/Thai controls and report action.
- [x] Report current seven-report state availability and current yellow row/Step chip; Dan chose existing actions only, including existing unavailable checkout/quote flows.
- [x] Reuse per-deal report states/actions in expandable All deals/watchlist lists; preserve report pricing/access and advisors.
- [x] Make Financial & Valuation optional and independently complete; approved NDA/completed report rows green.
- [x] 41 focused tests; live Control buyer/seller lists, real shared-report viewer, and 32 role/language/theme/width checks without horizontal overflow; 1280 buyer/seller screenshots captured.
- [ ] Standalone role-account mutations, buyer-owned pending-order distinctions, and live watchlist read-back remain unverified; available session is Control and no real orders/shares were altered. Missing quote requests, free-order confirmations and buyer checkout deliberately stay unchanged per Dan.

## Five Sign out fixes
- [x] Keyboard/touch selection, shared duplicate lock, busy indicator, Thai copy, ordered logout and origin-aware cache teardown; preserve existing expiry guard/login.
- [x] Focused ordering/duplicate/failure/external-event tests passed; live Enter/Space, Thai confirmation and auth failure checked. Added query pause and approval-watcher guard for observed logout refetches.
- [ ] Final no-refetch retest, touch and expiry/next-login end-to-end checks remain unverified: preview menu repeatedly detached during automation; real next-login credentials are unavailable.

## My Company independent panel scrolling
- [x] Shared CompanyScrollLayout for desktop Profiles/Split across roles, including Control extra buyer profiles; pinned themed headers, focusable contained regions, viewport sizing and selection/filter resets.
- [x] Live Control seller Profiles/Split, buyer Profiles/Split and advisor Profiles: independent scrolling and pinned headers; 1440×900, 1280×720, 1024, 1000 and phone, dark mode, keyboard PageDown, filter reset and normal Grid/List checked; 12 focused tests passed, build OK.
- [ ] Separate seller/buyer/advisor signed-in account checks and full advisor Split matrix need suitable role sessions; current managed session is Control. Buyer has only two cards, so its halfway-scroll screenshot has no overflowing list.

## Businesses Wanted Grid / Split / List
- The second uploaded pair is byte-identical to the first; it does not change the scope.
- [x] Reuse Discovery controls and frames without changing its rendering or existing marketplace cards.
- [x] Add transient sorting, saved layouts, selected role-aware details and list actions; preserve privacy/view counting.
- [x] Exact before/after Grid card widths/heights/covers match at 1440/1280; populated Control buyer EN/TH Grid/Split/List at six widths without overflow, saved layout, details, dark mode and empty-selection recovery; Discovery Split/List still render; 56 tests passed, preview build OK.
- [ ] Separate seller/advisor/buyer-owner Advertisement and closed-order checks require suitable role accounts/records; role switches returned empty pages. Tile arrows need a populated multi-industry list to verify live; delayed-cover rerun and all menu-fold combinations remain unverified.

## Either-side LOI and post-LOI Pipeline
- [x] Review brief, try reference and trace shared permissions, cards, alerts and messaging; Admin is Deal Support for now.
- [x] Add protected two-sided LOI transitions, revisions, consent records, decline acknowledgements and mirrored notifications.
- [x] Build shared bilingual letter dialogs, confirmations and expandable LOI timelines.
- [x] Add Admin support assignment, optional-stage choices/report receipt, shared server-only SPA date display and bilateral payment readiness.
- [x] Add All deals top-bar review alert and update canonical waiting/stage counts.
- [x] 38 focused tests; live buyer reading/tick/Cancel and twelve width/language/theme combinations; phone alert and eight Thai clauses; preview build OK.
- [ ] Full live two-sided send/accept/decline, report upload/read-back, payment and email checks need an authorised test deal; current offers are real and were not changed. Separate seller session and concurrent-transition end-to-end remain unverified.
- [x] Card rows one line down to 720px card width, grey pre-acceptance rows with "—", one-line review tag with orange edge, aligned step-bar labels and Optional bracket; buyer/seller/Thai/390px checked live, 59 tests passed, build OK.

## Public Discovery
- [x] Public, privacy-whitelisted live data and EN/TH two-tab page with shared header/footer.
- [x] Reuse cards, covers, industry picker and details across Grid, Split and List.
- [x] Wire continued Apply/NDA/Share after login/signup; waiting boxes and role notes.
- [x] Checked public live data, Grid/Split/List, details, signed-out NDA → login waiting → Back, current-account role restrictions, 24 language/tab/width combinations, delayed/failed/cached/reduced-motion photos; 33 tests passed.
- [ ] Full buyer/seller completion and actual email delivery: current injected account is Admin; no approved buyer/seller session or requested recipient supplied. Existing soft-launch invitation remains required for new signup.

## Businesses Wanted no-flash covers
- [x] Neutral lookup/photo loading, shared opt-in photo fade/cache handling, drawn failure fallback and reduced motion; preserve all other cards and cover overlays.
- [x] Delayed-photo grey → loaded photo, cached details/redraw, failed-photo fallback, reduced motion and Seller/Buyer/Advisor light/dark checked; 47 tests passed and preview build OK.
- [x] Admin check and Post an advertisement previews inspected under delayed image loading; temporary order status restored, no new post submitted.

## Seller Website key business strengths
- [x] Read the supplied brief and try the HTML reference's typing, Enter and empty-row Suggest.
- [x] Add four bilingual shared Highlights rows, three required, with protected Suggest/enrichment and Review count; user approved adding missing waiting/reading/found states.
- [x] Verify EN/TH saved read-back, Listing Identity Thai preservation, real enrichment, desktop/mobile/dark views and 64 focused tests; restore test answers. Preview build OK.

## Seller after-wizard listing identity
- [x] Add completion navigation and one-time shared pop-up.
- [x] Apply bilingual wording limits, growing fields and registration checks without direct database edits.
- [x] 39 focused tests passed; test-seller EN/TH pop-up, 1440/1024/390, errors and dismissal verified. No saved over-limit refs found.
- [x] Control Listing name field: "Suggested names" / "More ideas" dropdown removed; typing, availability badge, counter and taken error verified live.
- [ ] Full wizard completion and Control Seller-tab click-through: available test seller has incomplete required setup; no completion or publication performed.

## Seller website and founder setup
- [x] Reorder seller steps, migrate legacy progress on read/save, combine founded/size, require Website descriptions/tags, and reuse founders.
- [x] Expand Website with real enrichment and bilingual sector examples; preserve manual fields and later auto-fill safeguards.
- [x] Verify setup saving/read-back, EN/TH, dark and 1440/1024/390 views; deliver full bilingual sector table and change inventory.
- [ ] Populated live enrichment success: tested website yielded no readable text; no invented results used. Edit information populated read-back and final publication/new-business end-to-end remain unverified.

## Advisor company name
- [x] Use Company name on firm cards; move ref/city and managed hat onto cover.
- [x] Remove advisor name/headline inputs and checks from editing, registration, review and notices without changing legacy data or other roles.
- [x] EN/TH Browse at 1440/1024/390 and test-firm About Company checked; server registration/approval regression tests passed.
- [ ] Live new-firm registration/approval and cleanup: existing Admin deletion only allows never-submitted drafts, so a registered test firm cannot be removed through Admin; no new firm created. Current approval queue is empty; managed firms are not live in Browse, so those requested screenshots remain unavailable without changing records.

## Compact advisor panels
- [x] Compact shared Browse/My Company and separate Admin sections; accessible photo viewer, scoped hover and section-specific edits.
- [x] Ten exact EN/TH service lines updated throughout app and Partners; saved data and fee words elsewhere unchanged.
- [x] Admin and seller/buyer/advisor view switches checked; 1440/1024/390 without overflow; EN/TH, hover/focus, dark tokens, 0/1/3-photo browser-only cases and 20 focused tests passed. Separate role-account sessions and populated feedback remain unverified.

## Advisor licence dropdown
- [x] Shared grouped picker, issuer lines, Other, duplicate prevention and validation.
- [x] Persist keys, preserve legacy credentials, localize displays and snapshots, including active one-step review.
- [x] 64 relevant tests; authenticated Admin save/read-back on ADV-1009; eight desktop/mobile EN/TH light/dark checks. Legacy ADV-1014 “test”: “accoutning” remains Other, possible CPA match (note “2 CPA”).

- [x] 1. DB: user_activity table (last_active_at), RLS own-row read, touch_last_active() RPC (15-min throttle), backfill from auth.users.last_sign_in_at
- [x] 2. Server: last-login step helpers + touchLastActive server fn
- [x] 3. DTOs: lastLoginStep on listings, investors, firms; never send timestamps
- [x] 4. Client: touch on sign-in + app open/focus (__root.tsx)
- [x] 5. Buyer card = seller card shape: US$-only rows, Investment focus one-line, Geography + baht rows in Show more
- [x] 6. Show more row: last login left, Show more right; previews/Admin unchanged
- [x] 7. Badges all 24px (Managed by, Verified advisor green), star 32px
- [x] 8. Firm card: 150px cover, logo ≤96x240, Languages row in box, foot = last login + Show more, Send enquiry inside Show more
- [x] 9. i18n: 4 last-login lines EN/TH + tooltips
- [x] 10. Tests: step thresholds pass; tsgo clean
- [x] 11. Advisor Browse EN/TH and opened firm checked; investor/listing cards unchanged by compact advisor work.
- Architecture baseline remains untouched (479 direct calls versus frozen 243); not part of this task.

## Pipeline cards open on their own
- [x] Removed Expand all / Collapse all from All deals, Deal watchlist and History; Sort unchanged.
- [x] All deals / Deal watchlist open with only the first card open; per-card toggles stay independent; deep-linked deal still opens.
- [x] Verified live (buyer view, 8 cards): no link EN/TH, first card open on load and after reload, independent toggles; 52 pipeline tests pass, build OK.

- [x] Company-first sign-up with registration check (Nov 12 brief)

## Registration lookup correction
- [x] Build entity-aware register profile URLs for public companies, private companies and partnerships in the shared lookup used by every role.
- [x] Add bilingual Edit Company Registration Number to the unavailable-register dialog and permit corrected pending numbers after unsuccessful checks.
- [x] 73 sign-up/financial tests and isolated EN/TH dialog action checks pass; no accounts created or company data changed. Full external extraction was not rerun.

## Responsive sign-up verification
- [x] Make Verifying cancellable in English and Thai, without stale results overriding a corrected registration number.
- [x] Use the company-profile-only register lookup for sign-up; keep financial extraction in its existing Admin/report flows and never store an identity-only read as financial data.
- [x] 74 sign-up/financial tests pass; real reported company lookup succeeds in 15.8 seconds (previously ~93); isolated real-component Edit, Cancel, Escape and 390px touch checks pass without runtime errors. No accounts created.
- [ ] Full email-confirmed correction/resume remains unverified without a designated pending sign-up account; server attempt tokens and conditional writes are covered by code review, not a live account flow.

## Seller industry picker
- [x] Reuse the two-pane picker for every seller sector editor, including Admin and financial matching.
- [x] Add required bilingual selected/empty states and preserve saving and setup wizards.
- [x] Ten focused tests passed; Admin Automotive save/read-back verified in English/Thai and the test seller restored to Commerce; preview build OK.
