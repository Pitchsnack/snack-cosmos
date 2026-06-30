
## Why City is empty today

In `src/lib/auto-enrich/auto-enrich.functions.ts`:

1. The prompt defines `headquarters (country)` precisely but leaves `city` undefined, so the model treats it as optional and usually returns `null`.
2. `CANDIDATE_PATHS` is `["", "/about", "/about-us", "/company", "/team", "/our-team"]` — no `/contact*` or `/imprint`/`/impressum`, where street addresses (and therefore city names) actually live.
3. Even the Firecrawl fallback only renders the homepage; contact-page content is rarely there.

## Changes

### 1. `src/lib/auto-enrich/auto-enrich.functions.ts` — improve city recall

- Append contact/legal pages to `CANDIDATE_PATHS`:
  `"/contact", "/contact-us", "/imprint", "/impressum", "/legal"`.
  Early-stop at 6000 chars still bounds latency for content-rich sites.
- Tighten the prompt:
  - `headquarters`: keep as country.
  - `city`: explicit instruction — *"HQ city name only (e.g. 'Berlin', not 'Berlin, Germany'). Extract from address blocks in footers, contact pages, or imprint/impressum sections. Omit if not explicitly stated."*
- No signature/response-shape changes. No new fields.

### 2. `src/components/startups/startup-form.tsx` — red highlight for missing fields (edit mode only)

Matches the existing `⚠ Missing: Headquarters` placeholder pattern, extended uniformly.

- Add a small `isMissing(value)` helper plus a `missingFieldClass` constant:
  `"border-destructive text-destructive placeholder:text-destructive/70"` for inputs/textareas/triggers, and a `text-destructive` variant for the `<Label>`.
- Gate on `isEdit` — never highlight on the create form (avoids noisy blank-form red).
- Apply to the same set of fields Auto Enrich targets: Company Name, Company Type, Year Founded, Email, Headquarters, **City**, LinkedIn URL, Short Description, Long Description, Investment Stage, Industries, Product Tags, Market Tags, Founders.
- For each: when `isEdit && isMissing(field)`,
  - add `missingFieldClass` to the `<Input>`/`<Textarea>`/`<SelectTrigger>`/`CountryCombobox`,
  - swap the `<Label>` to a destructive variant,
  - use a `⚠ Missing: <Field>` placeholder (consistent with the existing Headquarters treatment).
- Tag/founder collections are highlighted via a destructive-bordered empty-state line ("⚠ Missing: add at least one …").
- Clears automatically as the user types — the highlight is purely derived from current empty state, no extra state machine, no auto-enrich-vs-manual tracking.

### 3. Out of scope

- No adapter, server-function signature, or response-shape changes.
- No new fields on `EnrichResult` / `EnrichDebug`.
- Create form unchanged (no red on a fresh form).
- No changes to required-for-submit logic (`canSubmit`).

## Verification

- Auto Enrich `https://www.pitchsnack.com` on an existing startup with empty fields → city is populated (when present on contact/footer), and any field Auto Enrich couldn't fill stays red until the user types.
- Auto Enrich on a startup with all fields full → no red, no overwrite.
- Create form (`/startups/new`) → no red highlights even when fields are blank.
- `firecrawl_fallback_used` log behavior unchanged.
