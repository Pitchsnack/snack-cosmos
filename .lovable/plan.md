# Auto-generated SET baseline peer sets

Every sector-wide peer set becomes a **Baseline** set: built automatically from SET-listed companies in that sector, and read-only. Business-model sets stay fully manual and unchanged.

## First-run impact (checked before building)

Only **one** sector-wide set exists today: **Commerce**, with **0 members**. Nothing hand-curated would be lost, and no mai company is currently in a sector-wide set, so the first generation is safe to run.

Generation would create baseline sets for the 23 sectors that have 3 or more SET companies (Food & Beverage 33, Energy & Utilities 31, Property Development 25, … down to Fashion 3), and skip 3 sectors with fewer than 3 (Professional Services, Home & Office Products, Paper & Printing Materials).

## What gets built

**The rule**
- For each sector among listed companies with market = SET: 3 or more companies → a baseline set holding all of them; fewer than 3 → no baseline set (an existing one is removed).
- mai companies never enter a baseline set. Generation reads listed companies only — no startup data.
- Baseline sets are marked with a new `is_baseline` flag; they remain `business_model = null` in the data.

**When it runs**
- Automatically after a successful Listed Companies CSV import.
- Manually from the Peer Sets menu: "Regenerate baseline sets".
- Idempotent: a sector whose SET membership is unchanged is not touched — no refresh date, no audit entry. A changed sector gets one audit entry naming the companies added and removed.

**Read-only**
- Opening a baseline set shows members, figures and median with no add, remove, import or save controls, plus a note explaining it is generated and that customising means creating a business-model set.
- Business-model sets keep every control they have now.

**Naming**
- "All business models" becomes "Baseline" everywhere it appears — list pill, set title, pickers, valuation tab.
- The create action becomes "New business-model set" and requires a business model; Baseline is not offered.

**Progress**
- The hat loader replaces the list while generating, with the menu disabled, then a summary: created / updated / unchanged / removed / skipped, with a details view naming the skipped and removed sectors. After an automatic run the same summary appears as a toast.

## Technical notes

- Migration: `peer_sets.is_baseline boolean not null default false`.
- New server-only generator module shared by the manual server function and the import handler, so both routes run identical code.
- `PeerSetSummary` / `PeerSetDetail` gain `isBaseline`; `peerSetLabel` and the peer-sets list label switch to "Baseline".
- No dependency added; matching logic, the valuation maths, and listed-company data untouched.
