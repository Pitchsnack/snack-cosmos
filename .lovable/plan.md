## Auto Enrich — Migration-Safety Verification Report

This is a **verification-only deliverable**. No code changes proposed. Approving this plan simply acknowledges the report — there is nothing to implement.

---

### Part 1 — Static checks

| # | Check | Result | Verdict |
|---|---|---|---|
| 1.1 | `firecrawl` in `src/components/` or `auto-enrich-adapter.ts` (case-insensitive) | 0 matches | PASS |
| 1.2 | `api.firecrawl.dev` across `src/` | 1 match, only in `src/lib/auto-enrich/auto-enrich.functions.ts:101` | PASS |
| 1.3 | `firecrawl_api_key` / `firecrawlApiKey` in `src/`, `supabase/`, `migrations/` | 1 match: `process.env.FIRECRAWL_API_KEY` at `auto-enrich.functions.ts:96`. No schema, migration, or tenant-table reference. | PASS |
| 1.4 | Hardcoded `tenant_id` / `database_id` / `db_name` / literal `tenantId=` in `src/lib/auto-enrich/` | 0 matches | PASS |
| 1.5 | DB writes (`supabase.`, `.insert(`, `.upsert(`, `.update(`) inside or around `fetchViaFirecrawl` | 0 matches | PASS |
| 1.6 | Diff vs `HEAD~1` adds new fields to `EnrichResult` / `EnrichDebug` | 0 new interface/type fields. Only `+` lines are the Firecrawl helper, the log emission, and the synthetic `[firecrawl]` `pagesTried` entry — response shape byte-identical. | PASS |

### Part 2 — Runtime checks

**Scenario A (SPA fallback fires)** — observed log line from sandbox dev-server:

```
{"event":"firecrawl_fallback_used","tenant_id":null,"caller_type":"tenant","url":"https://www.pitchsnack.com","bytes_returned":3083}
```

- Exactly one `firecrawl_fallback_used` per invocation. PASS
- `tenant_id` sourced from `context.claims.tenant_id` (null because this caller's JWT has no `tenant_id` claim — not from body/URL/literal). PASS
- `caller_type` derived from `context.claims.is_control` (here: claims present, `is_control` falsy → `"tenant"`; falls back to `"unknown"` when claims absent, per code at `auto-enrich.functions.ts:74-79`). PASS
- `url` echoes the user-supplied URL exactly — no tenant rewriting. PASS
- `process.env.FIRECRAWL_API_KEY` read once at top of `fetchViaFirecrawl` (line 96); no tenant table or tenant-scoped config read for the key. PASS
- Same Gemini extraction prompt (`system` + `user` at lines 154–155) is used regardless of whether the corpus came from raw fetch or Firecrawl. PASS

**Scenario B (content-rich, no fallback)** — Not exercised in this session (no fresh log evidence). The fallback gate is `corpusChars < FIRECRAWL_FALLBACK_THRESHOLD (500)` at line 121; gate is correct by inspection. Recommend a one-off run against a Wikipedia URL to capture the negative log and confirm zero outbound to `api.firecrawl.dev`. **NOT VERIFIED at runtime — code-level PASS.**

**Scenario C (connector removed)** — Not exercised (would require unlinking Firecrawl). By inspection: `fetchViaFirecrawl` returns `null` when `apiKey` is missing (line 97) without throwing; the outer `if (rendered && rendered.length > 0)` skips, and the existing `MIN_CORPUS_CHARS` guard at line 142 throws the same `"Could not read enough text from <origin>…"` error the UI already surfaces. Response shape unchanged. **NOT VERIFIED at runtime — code-level PASS.**

### Part 3 — Architectural invariants

- **3.1 Session-scoped write path unchanged.** `enrichStartupFromUrl` returns `EnrichResult` and performs no DB write. Firecrawl branch only appends to `usedTexts` and feeds the same `corpus` into the same AI call (lines 124–139). No new DB read/write, no tenant/scope branching below the fetch layer. PASS
- **3.2 Adapter seam preserved.** `src/lib/auto-enrich/auto-enrich-adapter.ts` unchanged in this PR; it calls `enrichStartupFromUrl` via the TanStack server-fn RPC (`{ data: { websiteUrl } }`), not via any direct internal import of helpers. PASS
- **3.3 "What changes at migration" list is short.** Files that will need to change when the Database Router lands:
  1. The framework-level adapter that resolves the DB connection from session context (one file, outside `auto-enrich/`).
  2. Optionally server-fn deployment config — not source.
  
  Nothing under `src/components/`, nothing in `auto-enrich-adapter.ts`, nothing in the Firecrawl helper. PASS
- **3.4 No new caching layer.** No in-memory cache, no Redis, no cache table introduced. Firecrawl responses are used once per invocation and discarded. PASS

### Part 4 — Migration dry run

1. **Which files in the auto-enrich path change at migration?** Only the framework-level DB connection adapter. `auto-enrich.functions.ts`, the AI extraction call, `EnrichResult` shape, `auto-enrich-adapter.ts`, and all components stay byte-identical.
2. **Re-provision Firecrawl key per tenant?** No. Single platform-level `FIRECRAWL_API_KEY` continues to serve all tenants and Control.
3. **Does `firecrawl_fallback_used` log still work post-migration?** Yes. `context.claims.tenant_id` is populated by `requireSupabaseAuth` middleware, independent of DB topology.
4. **Dedicated-DB tenant vs shared-instance tenant — identical Auto Enrich behavior?** Yes. Fetch + extraction layer is DB-agnostic; only the eventual write target (in the component → server fn that persists the merge) differs, resolved by the router.
5. **Replacing Firecrawl with another provider — what changes?** One helper function (`fetchViaFirecrawl`) in `auto-enrich.functions.ts`. No component, adapter, or migration impact.

### Overall verdict

**PASS** on all Part 1 static checks, Part 3 invariants, and Part 4 dry run. Part 2 Scenario A confirmed via live log; Scenarios B and C confirmed by code inspection but not exercised at runtime in this session. If runtime evidence for B and C is required before sign-off, run those two scenarios manually and attach logs — no code change needed either way.

### Notes / observations (non-blocking)

- In Scenario A the captured log shows `caller_type: "tenant"` with `tenant_id: null`. That is consistent with the implemented three-way categorical (claims present + `is_control` falsy ⇒ `"tenant"`), but if a `tenant`-typed caller is expected to always carry a `tenant_id`, you may want to tighten the categorization later (e.g. `claims && !is_control && !tenant_id` ⇒ `"unknown"`). Out of scope for this verification.