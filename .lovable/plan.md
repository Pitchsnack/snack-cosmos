
# PRD 2 v3.0 — Authentication, Authorization & RBAC

Implements the full auth/RBAC foundation: invite-only login, password reset, application-owned roles & permissions, tenant + workspace context, security auditing, and replaces PRD 1's permissive RLS with role/tenant-scoped policies. AI-user support is included as a first-class identity (no vendor RBAC).

## 1. Database (single migration)

### Enums
- `app_role`: `CONTROL`, `CONTROL_RESEARCH_AI`, `CONTROL_STARTUP_DISCOVERY_AI`, `CONTROL_INVESTOR_DISCOVERY_AI`, `MASTER_AGENT`, `MASTER_AGENT_AI`, `TENANT_ADMIN`, `TENANT_AGENT`, `TENANT_STARTUP_AI`, `TENANT_INVESTOR_AI`, `TENANT_DEAL_AI`, `STARTUP_USER`, `INVESTOR_USER`
- `user_type`: `Human`, `AI`, `System`
- `user_status`: `Pending`, `Active`, `Suspended`, `Locked`, `Archived`, `Deleted`
- `workspace_type`: `CONTROL`, `MASTER_AGENT`, `TENANT`, `STARTUP`, `INVESTOR`
- `security_event_type`: enum of the 11 documented event types

### Tables (public schema, UUID PKs, audit cols, RLS + GRANTs)
- `users` — app-owned profile keyed by `id = auth.users.id` for humans; AI users have synthetic UUID + `user_type='AI'` + `ai_agent_id` (placeholder FK-less for now). Cols per PRD: `email`, `first_name`, `last_name`, `user_type`, `status`, `primary_tenant_id`, `primary_role_id`, `ai_agent_id`, `last_login_at`, audit cols.
- `roles` — seeded with all 13 role codes.
- `user_roles` — `(user_id, role_id, tenant_id NULL for global)`, unique constraint.
- `user_tenants` — `(user_id, tenant_id, is_default, workspace_type)`, unique `(user_id, tenant_id, workspace_type)`.
- `workspace_context` — one row per user holding `active_tenant_id`, `active_role_id`, `active_workspace_type` (server-of-truth, replaces the localStorage shim from PRD 1).
- `master_agent_tenants` — cross-tenant access list.
- `startup_user_assignments` — placeholder (no startups table yet; FK omitted, indexed only).
- `investor_user_assignments` — placeholder.
- `user_sessions` — login/logout history.
- `security_events` — audit trail per PRD event types.

### Security-definer helpers (avoid recursive RLS)
- `public.has_role(_user uuid, _role app_role) returns boolean`
- `public.is_control(_user uuid) returns boolean`
- `public.is_master_agent_of(_user uuid, _tenant uuid) returns boolean`
- `public.is_tenant_admin_of(_user uuid, _tenant uuid) returns boolean`
- `public.user_in_tenant(_user uuid, _tenant uuid) returns boolean` — true if Control, master-agent-assigned, or member of `user_tenants`
- `public.current_user_id() returns uuid` — wraps `auth.uid()` for portability
- `public.active_tenant_id() returns uuid` — reads `workspace_context`

### Triggers
- `on_auth_user_created` (auth.users → public.users insert as `Pending`/`Human`).
- `updated_at` triggers on all new tables.

### RLS replacement (drop ALL `prd1_*` permissive policies)
- `tenants`: SELECT if `user_in_tenant(uid, id)`; write Control-only.
- `tenant_settings`/`subscription`/`features`: SELECT member; write Control or TENANT_ADMIN of that tenant.
- `audit_logs` + `security_events`: SELECT Control or member of `tenant_id`; INSERT authenticated (server-fn writes via admin).
- `users`: SELECT self OR Control OR same-tenant admin/agent; UPDATE self (limited cols) OR Control.
- `user_roles`/`user_tenants`/`workspace_context`/`master_agent_tenants`/`user_sessions`/`*_assignments`: scoped via helpers.

## 2. Auth configuration
- `supabase--configure_auth`: `disable_signup: true`, `external_anonymous_users_enabled: false`, `auto_confirm_email: false`, `password_hibp_enabled: true`.
- Email/password only (no Google per anti-lock-in rule).
- Password policy (12+ chars, upper/lower/number/symbol) enforced with Zod client-side; HIBP server-side.

## 3. Permissions layer (application-owned, no vendor primitives)
- `src/lib/permissions.ts` — static `ROLE_PERMISSIONS: Record<AppRole, Permission[]>` map covering: `tenants.*`, `users.*`, `roles.*`, `security.read`, `audit.read`, `workspace.switch`, `startup.*`, `investor.*`, `deals.*`, `ai.invoke`. Future modules MUST import from this map.
- `Permission` is a string union; helpers `can(role, perm)`, `canAny(roles, perm)`.

## 4. Session Context Service
- `src/lib/session-context.functions.ts` exposes a single `getSessionContext()` server fn returning `{ user, roles, activeWorkspace, permissions, tenants }`.
- Client hook `useSessionContext()` (TanStack Query, single source of truth).
- Required accessors per PRD: `getCurrentUser`, `getCurrentRole`, `getCurrentTenant`, `getCurrentWorkspace`, `getCurrentPermissions` — all thin wrappers over `useSessionContext()`.

## 5. Routes & UI

### Public routes (outside `_authenticated`)
- `/login` — email + password, Zod, error toast, logs LOGIN/FAILED_LOGIN via server fn.
- `/forgot-password` — `resetPasswordForEmail({ redirectTo: '/reset-password' })`.
- `/reset-password` — recovery flow, `updateUser({ password })`, logs PASSWORD_RESET.
- `/accept-invite` — sets password, marks user `Active`, logs INVITE_ACCEPTED.

### `_authenticated` layout
- `beforeLoad`: redirect to `/login` if no `getUser()`.
- Child `beforeLoad` hydrates session via `supabase.auth.getUser()` before loaders.
- Root `onAuthStateChange` invalidates router + query cache.
- Move existing `/` (Tenants) and `/audit` under `_authenticated/`.

### Role-gated layouts
- `_authenticated/_control.tsx` — CONTROL only (gates `/users` global, `/security`, `/access-management`).
- `_authenticated/_admin.tsx` — CONTROL or TENANT_ADMIN of active tenant.

### New authenticated pages
- `/users` — directory (filtered to active workspace; Control sees all). Invite, suspend, activate, lock, assign roles, assign tenants.
- `/access-management` — role catalog + matrix (role → permissions) + role assignments view.
- `/security` — `security_events` viewer with filters (event type, user, tenant, date range).

### Sidebar
- Add `Users`, `Access Management`, `Security` nav items with role-based visibility (via `usePermissions`).
- Footer: user menu (avatar, name, current role, Sign out).
- Workspace switcher: switches via `switchWorkspace` server fn that writes `workspace_context` and logs WORKSPACE_SWITCH; replaces the localStorage `sp2.activeTenantId` shim.

## 6. Server functions (`src/lib/*.functions.ts` with `requireSupabaseAuth`)

- `auth.functions.ts`: `recordLogin`, `recordLogout`, `recordFailedLogin`, `logSecurityEvent`.
- `session-context.functions.ts`: `getSessionContext`, `switchWorkspace`.
- `users.functions.ts`: `listUsers`, `getUser`, `inviteUser`, `acceptInvite`, `updateUserStatus`, `assignRole`, `revokeRole`, `assignTenant`, `revokeTenant`, `setDefaultWorkspace`.
- `users.server.ts`: admin-only helpers using `supabaseAdmin` (creates `auth.users` via `inviteUserByEmail`, mirrors into `public.users`, attaches roles/tenants).
- `security.functions.ts`: `listSecurityEvents`.
- `access.functions.ts`: `listRoles`, `getRoleMatrix`, `assignMasterAgentTenant`.

All write paths re-check authorization in the handler using `ROLE_PERMISSIONS` (defense-in-depth — UI hiding is not enough).

## 7. Cleanup
- `tenant-utils.logAudit`: route through a new `logAuditEvent` server fn (now that RLS is restrictive on `audit_logs`).
- `workspace-switcher`: drop localStorage; read/write via session context.

## 8. Out of scope (explicit)
- MFA, SSO, social auth, AI Gateway, Agent Framework, API Gateway.
- Real startups/investors tables (assignment tables are placeholders).
- Per-tenant session-timeout overrides, custom email templates.

## 9. Verification
- Manual: invite → accept → login → workspace switch → role-gated nav → password reset → logout.
- DB: confirm zero `prd1_*` permissive policies remain; `security_events` rows appear per action.
- Linter (`supabase--linter`) clean for new tables.
- Build passes; no client bundle imports `client.server`.

## Files

**New migrations**
- `supabase/migrations/<ts>_prd2_auth_rbac.sql`

**New lib**
- `src/lib/permissions.ts`, `src/lib/role-codes.ts`
- `src/lib/auth.functions.ts`
- `src/lib/session-context.functions.ts`
- `src/lib/users.functions.ts`, `src/lib/users.server.ts`
- `src/lib/security.functions.ts`
- `src/lib/access.functions.ts`
- `src/lib/audit.functions.ts` (replaces direct insert)

**New hooks**
- `src/hooks/use-session-context.ts`
- `src/hooks/use-permissions.ts`

**New routes**
- `src/routes/login.tsx`, `forgot-password.tsx`, `reset-password.tsx`, `accept-invite.tsx`
- `src/routes/_authenticated.tsx`
- `src/routes/_authenticated/_control.tsx`, `_admin.tsx`
- `src/routes/_authenticated/index.tsx` (moved Tenants)
- `src/routes/_authenticated/audit.tsx` (moved)
- `src/routes/_authenticated/users.tsx`
- `src/routes/_authenticated/access-management.tsx`
- `src/routes/_authenticated/security.tsx`

**New components**
- `src/components/user-menu.tsx`
- `src/components/invite-user-dialog.tsx`
- `src/components/role-badge.tsx`
- `src/components/permission-matrix.tsx`

**Edited**
- `src/routes/__root.tsx` (auth-state listener; sidebar only for authed routes)
- `src/components/app-sidebar.tsx` (role-gated nav, user menu)
- `src/components/workspace-switcher.tsx` (server-backed, logs events)
- `src/lib/tenant-utils.ts` (audit via server fn)
- `src/start.ts` (ensure `attachSupabaseAuth` is registered)
