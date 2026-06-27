## Problem (verified)

The Website field in startup and investor forms uses `<Input type="url">`. Browser HTML5 validation requires a scheme, so `www.pitchsnack.com` fails native validation and the form never saves — the detail page has nothing to render as a hyperlink. `CompanyUrlLink` / `buildCompanyUrlHref` already auto-prefix `https://` at render time, so the bug is input-only.

Evidence:
- `src/components/startups/startup-form.tsx:383` → `<Input type="url" ... placeholder="https://" />`
- `src/components/investors/investor-form.tsx:366` → `<Input type="url" ... placeholder="https://example.com" />`

## Fix (frontend only)

1. `src/components/startups/startup-form.tsx` (Website field)
   - `type="url"` → `type="text"` + `inputMode="url"` + `autoComplete="url"`
   - Placeholder → `www.example.com`
2. `src/components/investors/investor-form.tsx` (Company URL field)
   - Same change.

No schema or save-logic changes. Values are still `.trim()`'d and `buildCompanyUrlHref` adds the `https://` prefix at render time.

## Note for PR description

Removing `type="url"` also removes browser-level rejection of malformed URLs (e.g. typos, strings with spaces). Intentional — URL validation will land with the duplicate-detection PRD. For now, save accepts any non-empty string.

## Verification (Playwright against running preview)

1. `/startups/:id/edit`: type `www.pitchsnack.com` in Website, Save. Assert detail page renders `<a href="https://www.pitchsnack.com" target="_blank">`.
2. `/startups/new`: fill required fields + Website `www.pitchsnack.com`, Save. Same assertion.
3. `/investors/new` and `/investors/:id/edit`: repeat.
4. Read the anchor's `href` via `page.get_attribute` and screenshot the rendered Website row.
5. **Empty-Website regression**: at `/startups/new`, fill required fields but leave Website empty. Save. Assert save succeeds and the detail page does NOT render a broken `<a href="">` (CompanyUrlLink should return `null`).

Artifacts under `/tmp/browser/website-hyperlink/`; report file paths and asserted `href` values as proof.
