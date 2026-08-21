# Show and edit Tenant + Ownership on Edit Investor

You were right: on the Edit Investor page, the Tenant Workspace selector and the
Ownership block (Owning Agent + Owning AI Agent) are hidden — they render only in
create mode. This plan makes them visible and editable when editing.

## What changes

1. **Tenant Workspace section** appears in edit mode, pre-selected with the
   investor's current tenant, choosable from the same authorized tenant list used
   on create.
2. **Ownership section** appears in edit mode with:
   - Owning Agent (human) dropdown, pre-selected with the current owner.
   - Owning AI Agent dropdown, pre-selected with the current AI owner.
   - Same rules as create: both required, options loaded for the selected tenant.
3. **Saving** applies tenant and ownership changes together with the other field
   edits when you press Save Changes.
4. **Guardrails kept**: changing the tenant clears the owner selections (owners
   must belong to the new tenant), and the existing mismatch banner between the
   selected tenant and your active workspace still shows.

## Technical notes

- `src/components/investors/investor-form.tsx`
  - Remove the `!isEdit` gate on the Tenant Workspace block and the Ownership
    block; keep the create-only "Default Intake ownership mode" helper create-only.
  - Enable the `assignable-humans` / `assignable-ai` queries in edit mode.
  - Seed `tenantId`, `owningAgentUserId`, `owningAiAgentId` from the loaded
    investor record (owners come from the `investor_ownership` /
    `investor_ai_ownership` embeds already returned by `getInvestor`).
  - Extend the edit-mode submit payload and `canSubmit` validation to include the
    three values.
- `src/lib/investors.functions.ts` — `updateInvestor`
  - Accept optional `tenantId`, `owningAgentUserId`, `owningAiAgentId`.
  - When tenant changes: update `investors.tenant_id` and re-point the related
    rows that carry `tenant_id` (ownership, AI ownership, tags, portfolio links)
    so the tenant-match triggers stay satisfied.
  - Upsert the ownership rows (`investor_ownership`, `investor_ai_ownership`) when
    the owner values change, and log `OWNER_CHANGED` / `TENANT_CHANGED` activity.
- Verify in the preview at `/investors/$id/edit`: both sections render with the
  current values, a change saves and is reflected in the investor's information
  panel.

## Note

Reassigning tenant is destructive-ish: relationships that cross tenants (portfolio
startups/investors from the old tenant) may be dropped by the tenant-match
triggers. The plan re-points the rows it owns and reports any links that cannot
move.
