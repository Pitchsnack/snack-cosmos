## Scope (this PRD, reduced)

Per your answer: implement only §2.2 + §2.3 (hyperlink display + open in new tab) on Startup and Investor surfaces. Skip §2.1 duplicate check entirely — it stays deferred until P-18 backend lands.

This is a frontend-only change. No DB changes, no server functions, no schema edits.

## Changes

### 1. New helper
- `src/lib/company-url.ts`
  - `buildCompanyUrlHref(value)` — trims; rejects `javascript:` / other unsafe schemes (returns `""`); if already `http(s)://` returns as-is, else prefixes `https://`.
  - `CompanyUrlLink` React component (co-located or `src/components/shared/company-url-link.tsx`) that renders:
    ```tsx
    <a href={safeHref} target="_blank" rel="noopener noreferrer" title={value} className="…truncate underline-offset-2 hover:underline inline-flex items-center gap-1">
      {value}<ExternalLink className="h-3 w-3" />
    </a>
    ```
  - Renders nothing (or a muted "—") when value is empty / unsafe.

### 2. Display the saved URL as a hyperlink

Replace plain-text rendering of `website_url` with `<CompanyUrlLink>` in:
- `src/routes/_authenticated/startups.$id.index.tsx` (startup detail header / overview block)
- `src/components/startups/startup-detail-panel.tsx`
- `src/components/startups/startup-table.tsx` (Website column, if present)
- `src/components/startups/startup-card.tsx` / `startup-list-item.tsx` (if they show URL)
- `src/routes/_authenticated/investors.$id.index.tsx`
- `src/components/investors/investor-detail-panel.tsx`
- `src/components/investors/investor-table.tsx` / `investor-card.tsx` / `investor-list-item.tsx` (where URL is shown)

Only swap pure read-only renders. The edit-form `<Input>` for the URL stays an input (PRD §6.2: "If displayed outside active editing, it should be a hyperlink").

### 3. Form inputs — leave logic alone
- `startup-form.tsx` and `investor-form.tsx`: keep the existing `Input type="url"` for editing. No duplicate-check hook, no debounce, no warnings.
- Trim leading/trailing whitespace on the URL value at submit time (small safety per PRD §8). Empty stays allowed.

### 4. Out of scope (explicitly not built)
- `findUrlDuplicates` server function
- Investor `url_key` column / trigger
- Duplicate warning / suggestion UI
- Any debounce or async query on the URL input

## Verification
- `/startups/<id>` and `/investors/<id>`: saved URL renders as a link with external-link icon; click opens new tab; middle-click / Cmd-click still work; `rel="noopener noreferrer"` present.
- Values like `acme.com`, `www.acme.com`, `https://acme.com`, `http://acme.com` all resolve to the correct `href` per the PRD table.
- `javascript:alert(1)` saved as URL renders as muted text, no anchor.
- Edit forms: URL input still editable; no new warnings; save still works.
