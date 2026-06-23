/**
 * PRD 7.1 — Presentation-only effective permissions for the sidebar.
 *
 * DO NOT USE FROM:
 *   - PermissionGuard
 *   - Route loaders / route guards
 *   - Server functions / backend logic
 *   - Anything that authorizes data access
 *
 * Only the app sidebar should opt in. All other consumers must keep using
 * usePermissions().
 */
import { usePermissions } from "@/hooks/use-session-context";
import { useViewMode } from "@/hooks/use-view-mode";
import { ROLE_PERMISSIONS, type AppRole, type Permission } from "@/lib/permissions";

export function useEffectivePermissions() {
  // Hooks are ALWAYS called in the same order on every render.
  const realPermissions = usePermissions();
  const viewMode = useViewMode();

  if (!viewMode.isPreviewMode || !viewMode.effectiveRenderRole) {
    return realPermissions;
  }

  const role = viewMode.effectiveRenderRole as AppRole;
  const perms = new Set<Permission>(ROLE_PERMISSIONS[role] ?? []);

  return {
    has: (p: Permission) => perms.has(p),
    hasAny: (ps: Permission[]) => ps.some((p) => perms.has(p)),
    isControl: false,
    roles: [role] as AppRole[],
    isLoading: realPermissions.isLoading,
    isFetching: realPermissions.isFetching,
    isResolved: realPermissions.isResolved,
  };
}
