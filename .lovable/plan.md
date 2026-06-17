## Goal

Produce a fully completed, expanded version of the attached `Application Design Overview [Tenant Foundation].md`, populated by reading this project's actual implementation (routes, sidebar, RBAC, hooks, server functions). Deliver it as a single Markdown file the user can download.

## Note on save location

The requested path `C:\Users\dan\PitchSnack\LOvable\Overview` is a Windows path on your local machine — I cannot write there from the sandbox. I will save the completed file to:

```
/mnt/documents/Application_Design_Overview_Tenant_Foundation_COMPLETED.md
```

You can then download it and drop it into that Windows folder. If you'd prefer it also committed into the project repo (e.g. `docs/Application_Design_Overview_Tenant_Foundation.md`), say so and I'll add that on build.

## Source material I will reference

Inside this project (PitchSnack / SnackPortal — "Tenant Foundation"):
- Route tree under `src/routes/` and `src/routes/_authenticated/` (Dashboard, Tenants, Startups, Investors, Deals, Shared Deals, Users, Access Management, Notifications, Audit, Security, Preferences, auth routes).
- `src/components/app-sidebar.tsx` — navigation model, role-gated items, collapse behavior, mobile sheet.
- `src/components/workspace-header.tsx` and `workspace-switcher.tsx` — tenant/workspace identity strip.
- `src/lib/permissions.ts` — full RBAC model (13 roles, permission map, role labels).
- `src/hooks/use-session-context.ts`, `src/integrations/supabase/auth-middleware.ts`, `src/lib/session-context.functions.ts`, `src/lib/auth.functions.ts` — session/auth flow.
- `src/lib/*.functions.ts` — server-function surface (tenants, users, startups, investors, deals, deal-shares, deal-introductions, deal-ownership, notifications, preferences, search, security, audit/workspace).
- `src/routes/_authenticated.tsx` + `route-pending-skeleton.tsx` — authenticated layout, route-pending shell.
- Recent flicker-fix PRDs and `PRD-FLICKER-INVESTIGATION-02-REPORT.md` for UX behavior context.

## Document structure (what the completed file will contain)

Sections 1–6 from the template will be filled in, then expanded with the following additional sections:

1. **Core Objective** — single sentence.
2. **Problem Statement** — current issue, impact, gap.
3. **Solution & Value Proposition** — efficiency, simplicity, impact.
4. **Success Metrics (KPIs)** — concrete metrics for the foundation phase.
5. **Target Audience & Personas** — Control admin, Master Agent, Tenant Admin, Tenant Agent, AI agents, Startup/Investor users.
6. **Out of Scope** — explicit non-objectives for the foundation phase.
7. **Application Architecture** — TanStack Start (React 19, Vite 7) frontend, Supabase (via Lovable Cloud) backend, server functions, RLS, file-based routing, Cloudflare Workers runtime.
8. **Tenant & Workspace Model** — Control vs Tenant workspaces, workspace switching, multi-tenant isolation.
9. **RBAC & Permissions** — full role list, permission matrix, role labels, AI-role pattern (`ai.invoke`).
10. **Screens & Navigation Map** — every route in `_authenticated/`, its purpose, primary actions, required permission, and which roles can see it.
11. **User Journeys** — login/accept-invite, tenant onboarding, startup creation (with Ownership requirements), investor creation, deal creation and pipeline, deal sharing (introduce → accept/reject), audit review, access management.
12. **UI Layout & Behavior** — collapsible sidebar, workspace header, sticky submit bars, loading-state strategy (local skeletons, route-pending shell), empty states, toast notifications.
13. **Data Flow** — `useSessionContext` resolution, React Query caching (`staleTime: 60_000` on list hooks), server-function calls, Supabase RLS enforcement, audit logging.
14. **Authentication & Authorization Flow** — Supabase auth, `requireSupabaseAuth` middleware, `attachSupabaseAuth`, route guards under `_authenticated`, permission checks via `usePermissions`.
15. **Implementation Assumptions & Conventions** — design tokens, no hardcoded colors, route file naming, server-function placement (`*.functions.ts`), no Supabase Edge Functions for app logic, RLS-first data access.
16. **Future Modules (Framework Placeholders)** — Communications, Documents, Analytics (currently shown as "Soon" in sidebar).
17. **Glossary** — Control, Tenant, Master Agent, Workspace, Deal Share, Introduction, etc.

## Deliverable

One markdown file at `/mnt/documents/Application_Design_Overview_Tenant_Foundation_COMPLETED.md`, ready to download.

No code changes will be made.