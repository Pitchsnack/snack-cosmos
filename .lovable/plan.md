## Root causes confirmed

1. **Silent no-op merge.** `applyEnrichment` in `src/components/startups/startup-form.tsx` only writes to empty fields. On an existing record like Superdata, almost every field is already filled, so even a perfect payload changes nothing visible — but the green "Auto Enrich complete" toast still fires.
2. **Silent scraper failures.** `fetchText` in `src/lib/auto-enrich/auto-enrich.functions.ts` swallows every error (timeout, non-2xx, blocked UA) and returns `""`. The "Could not fetch website content" guard only trips when **all three** of `/`, `/about`, `/team` return empty, so a single 404 HTML page is enough to send a near-empty corpus to the model. Recent gateway logs confirm this: log_ids `019f0a64-43e8-7514-…` and `019f0a64-1edd-726b-…` (2026-06-27 18:42 UTC) both ran with only ~237 input tokens (the prompt scaffolding alone), meaning the scraped corpus was effectively empty.

## Changes

### 1. `src/lib/auto-enrich/auto-enrich.functions.ts` — harden the scraper
- Replace the bot-flavored UA with a realistic desktop Chrome User-Agent and add `Accept`, `Accept-Language` headers. Many sites 403 anything containing `Bot`.
- Change `fetchText` to return `{ text, status, bytes, error }` instead of a bare string so the handler can tell "empty page" from "blocked" from "404".
- Try a wider path set: `/`, `/about`, `/about-us`, `/company`, `/team`, `/our-team`. Stop early once total stripped text exceeds ~6000 chars.
- Compute `corpusChars`. If `corpusChars < 400`, throw a precise error:
  `Could not read enough text from <origin> (fetched N pages, total M chars, statuses: …). The site may block scrapers or be JS-only.`
- Extend `EnrichResult` with a non-PII `_debug` field: `{ origin, pagesTried, pagesUsed, corpusChars, modelOutputChars }`. UI uses this for the diagnostic toast.
- Keep the existing Lovable AI Gateway call, model, schema, and 429/402 handling unchanged.

### 2. `src/components/startups/auto-enrich-button.tsx` — surface what happened
- After a successful call, inspect the result. Count how many non-empty top-level fields came back (`fieldsReturned`). If `fieldsReturned === 0`, replace the success toast with a warning toast: `Auto Enrich finished but the model returned no fields. Source: <origin>, ~<corpusChars> chars scraped.` using `_debug`.
- Otherwise keep the success toast but append `(N fields returned)`.
- Error path unchanged (already shows `e.message`).

### 3. `src/components/startups/startup-form.tsx` — surface the no-op case
- `applyEnrichment` now returns `{ applied: string[], skippedBecauseFilled: string[] }`.
- In the `onEnriched` handler, after calling `applyEnrichment`, if `applied.length === 0` AND `fieldsReturned > 0`, fire an info toast:
  `Auto Enrich returned data but all target fields were already filled (skipped: <first 5 field labels>). Clear a field and try again to overwrite.`
- No change to the empty-field-only merge rule itself — overwrite mode is explicitly out of scope per the chosen option.

## Out of scope (not changed)

- Adapter contract (`autoEnrichAdapter.enrichStartup`) and `AUTO_ENRICH_BACKEND` switch.
- Field-name mapping (`website_url`, etc.).
- Auth middleware on the server function.
- Any DB or schema changes.
- Investor Auto Enrich (only Startup form has it today).
- No new dependency (Firecrawl etc.); we keep the existing `fetch` path.

## Verification

1. Reload `/startups/<id>/edit` for Superdata (all fields already filled). Click Auto Enrich → expect an **info toast** saying fields were skipped because already filled, listing them.
2. Clear `shortDescription` and `industries` on Superdata, click Auto Enrich → expect those two to populate and a success toast with `(N fields returned)`.
3. On `/startups/new`, enter a Website URL of a site that blocks scrapers (or a non-existent domain), click Auto Enrich → expect an **error toast** with the precise "Could not read enough text…" message, not a misleading success.
4. Confirm a new gateway log row appears with input-token count proportional to corpus size (much larger than 237 when the site is reachable).
