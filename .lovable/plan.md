## Root cause

The `Save Changes` error `Number must be less than or equal to 1970` comes from the server-side Zod schema in `src/lib/startups.functions.ts:365`:

```ts
yearFounded: z.number().int().min(1800).max(new Date().getFullYear()).nullable().optional(),
```

`new Date().getFullYear()` is evaluated **once at module load**. On the Cloudflare Workers runtime, `Date` at top-level module init returns the Unix epoch (`1970-01-01`) for determinism. So the schema is frozen with `max = 1970`, rejecting every real year (2023, 2024, …).

The same pattern is applied at line 365 for both create and update input (via `ProfileFields`).

## Fix

Move the "current year" evaluation to request time, inside the validator, using a Zod refinement so `Date.now()` runs per request (which is allowed and returns real time inside a handler).

Change line 365 from:
```ts
yearFounded: z.number().int().min(1800).max(new Date().getFullYear()).nullable().optional(),
```
to:
```ts
yearFounded: z
  .number()
  .int()
  .min(1800)
  .refine((y) => y <= new Date().getFullYear(), {
    message: "Year cannot be in the future",
  })
  .nullable()
  .optional(),
```

No other files change. No schema/RLS/adapter/UI changes needed.

## Verification

1. Typecheck passes.
2. Edit an existing startup with `yearFounded = 2023` → Save succeeds (no `too_big` error).
3. Set `yearFounded = 2099` → rejected with "Year cannot be in the future".
4. Leave `yearFounded` empty → still accepted (nullable/optional preserved).

## Out of scope

- No UI/highlight changes.
- No changes to Auto Enrich, city, phone, or headquarters logic.
- No changes to other date-derived module-scope constants (none found in this file).
