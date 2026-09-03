import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { usePermissions } from "@/hooks/use-session-context";
import { useSessionContext } from "@/hooks/use-session-context";
import type { Permission } from "@/lib/permissions";
import { Loading } from "@/components/ui/PitchSnackLoader";

interface PermissionGuardProps {
  /** Required permission. Either `permission` or `anyOf` must be provided. */
  permission?: Permission;
  /** Allowed if user has any of these permissions. */
  anyOf?: Permission[];
  /** CONTROL role bypasses the permission check. */
  allowControl?: boolean;
  /** Custom denial message. */
  message?: string;
  /** Custom loading UI. */
  loadingFallback?: ReactNode;
  children: ReactNode;
}

/**
 * Centralized permission guard. Renders one of three states:
 *  - Loading: neutral skeleton while session/permissions resolve
 *  - Allowed: children
 *  - Denied:  standardized "no access" panel
 *
 * Pages MUST NOT implement their own `if (!has(...))` checks — wrap the
 * page body in <PermissionGuard /> instead. See PRD-008A / PRD-008B.
 */
export function PermissionGuard({
  permission,
  anyOf,
  allowControl = false,
  message,
  loadingFallback,
  children,
}: PermissionGuardProps) {
  const { has, hasAny, isControl, isLoading, isResolved, roles } = usePermissions();
  const { data: session } = useSessionContext();
  const route = useRouterState({ select: (s) => s.location.pathname });
  const loggedRef = useRef(false);

  const allowed = (() => {
    if (allowControl && isControl) return true;
    if (permission && has(permission)) return true;
    if (anyOf && hasAny(anyOf)) return true;
    return false;
  })();

  // Centralized denial logging (FR-4). Logs once per mount when truly denied.
  useEffect(() => {
    if (!isResolved || allowed || loggedRef.current) return;
    loggedRef.current = true;
    // eslint-disable-next-line no-console
    console.warn("[PermissionGuard] denied", {
      route,
      requested: permission ?? anyOf,
      allowControl,
      roles,
      workspace: session?.activeWorkspace ?? null,
    });
  }, [isResolved, allowed, route, permission, anyOf, allowControl, roles, session]);

  if (isLoading || !isResolved) {
    return (
      loadingFallback ?? (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground"
        >
          <Loading size="md" message="Loading…" />
        </div>
      )
    );
  }

  if (!allowed) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground"
      >
        {message ?? "You don't have permission to view this page."}
      </div>
    );
  }

  return <>{children}</>;
}
