/**
 * PRD 7.1 — View Switcher (frontend presentation only).
 *
 * Control-only "View as" preview. Does NOT touch authorization, RLS, RBAC,
 * server functions, route loaders, workspace switching, or tenant routing.
 * Tenant id is display-only and must never call switchWorkspace.
 */
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSessionContext } from "@/hooks/use-session-context";
import type { AppRole } from "@/lib/permissions";

export type ViewRole =
  | "CONTROL"
  | "MASTER_AGENT"
  | "TENANT_ADMIN"
  | "TENANT_AGENT"
  | "STARTUP_USER"
  | "INVESTOR_USER";

export const VIEW_ROLES: ViewRole[] = [
  "CONTROL",
  "MASTER_AGENT",
  "TENANT_ADMIN",
  "TENANT_AGENT",
  "STARTUP_USER",
  "INVESTOR_USER",
];

export const VIEW_ROLE_LABELS: Record<ViewRole, string> = {
  CONTROL: "Control",
  MASTER_AGENT: "Master Agent",
  TENANT_ADMIN: "Tenant Admin",
  TENANT_AGENT: "Tenant Agent",
  STARTUP_USER: "Startup User",
  INVESTOR_USER: "Investor User",
};

const TENANT_SCOPED: ReadonlySet<ViewRole> = new Set<ViewRole>([
  "MASTER_AGENT",
  "TENANT_ADMIN",
  "TENANT_AGENT",
  "STARTUP_USER",
  "INVESTOR_USER",
]);

export function isTenantScopedViewRole(role: ViewRole): boolean {
  return TENANT_SCOPED.has(role);
}

const ROLE_KEY = "sp2.viewAsRole";
const TENANT_KEY = "sp2.viewAsTenantId";

export interface ViewModeContextValue {
  realRole: ViewRole | null;
  sessionResolved: boolean;
  canUseSwitcher: boolean;
  requestedViewRole: ViewRole;
  requestedViewTenantId: string | null;
  effectiveRenderRole: ViewRole | null;
  isPreviewMode: boolean;
  setRequestedViewRole: (role: ViewRole) => void;
  setRequestedViewTenantId: (tenantId: string | null) => void;
  resetPreview: () => void;
}

const NEUTRAL: ViewModeContextValue = {
  realRole: null,
  sessionResolved: false,
  canUseSwitcher: false,
  requestedViewRole: "CONTROL",
  requestedViewTenantId: null,
  effectiveRenderRole: null,
  isPreviewMode: false,
  setRequestedViewRole: () => {},
  setRequestedViewTenantId: () => {},
  resetPreview: () => {},
};

export const ViewModeContext = createContext<ViewModeContextValue>(NEUTRAL);

function readSession<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeSession(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* noop */
  }
}

function clearSession(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

function deriveRealRole(roles: readonly AppRole[] | undefined): ViewRole | null {
  if (!roles || roles.length === 0) return null;
  if (roles.includes("CONTROL")) return "CONTROL";
  if (roles.includes("MASTER_AGENT") || roles.includes("MASTER_AGENT_AI")) return "MASTER_AGENT";
  if (roles.includes("TENANT_ADMIN")) return "TENANT_ADMIN";
  if (roles.includes("TENANT_AGENT")) return "TENANT_AGENT";
  if (roles.includes("STARTUP_USER")) return "STARTUP_USER";
  if (roles.includes("INVESTOR_USER")) return "INVESTOR_USER";
  return null;
}

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const { data, isSuccess, isError } = useSessionContext();
  const sessionResolved = isSuccess || isError;
  const realRole: ViewRole | null = sessionResolved ? deriveRealRole(data?.roles) : null;
  const canUseSwitcher = sessionResolved && realRole === "CONTROL";

  const [requestedViewRole, setRequestedViewRoleState] = useState<ViewRole>("CONTROL");
  const [requestedViewTenantId, setRequestedViewTenantIdState] = useState<string | null>(null);

  // Hydrate from sessionStorage only when allowed; clear otherwise.
  // Tied to user id so a session/user change resets the preview.
  const userId = data?.user?.id ?? null;
  useEffect(() => {
    if (!canUseSwitcher) {
      clearSession(ROLE_KEY);
      clearSession(TENANT_KEY);
      setRequestedViewRoleState("CONTROL");
      setRequestedViewTenantIdState(null);
      return;
    }
    const storedRole = readSession<ViewRole>(ROLE_KEY);
    const storedTenant = readSession<string>(TENANT_KEY);
    if (storedRole && VIEW_ROLES.includes(storedRole)) {
      setRequestedViewRoleState(storedRole);
    } else {
      setRequestedViewRoleState("CONTROL");
    }
    setRequestedViewTenantIdState(
      typeof storedTenant === "string" && storedTenant.length > 0 ? storedTenant : null,
    );
  }, [canUseSwitcher, userId]);

  const setRequestedViewRole = useCallback(
    (role: ViewRole) => {
      if (!canUseSwitcher) return; // anti-escalation
      if (!VIEW_ROLES.includes(role)) return;
      setRequestedViewRoleState(role);
      writeSession(ROLE_KEY, role);
      // Clear tenant when switching to a non-tenant-scoped role.
      if (!isTenantScopedViewRole(role)) {
        setRequestedViewTenantIdState(null);
        clearSession(TENANT_KEY);
      }
      // eslint-disable-next-line no-console
      console.log("[ViewSwitcher] preview role:", role);
    },
    [canUseSwitcher],
  );

  const setRequestedViewTenantId = useCallback(
    (tenantId: string | null) => {
      if (!canUseSwitcher) return; // anti-escalation
      setRequestedViewTenantIdState(tenantId);
      if (tenantId) writeSession(TENANT_KEY, tenantId);
      else clearSession(TENANT_KEY);
      // eslint-disable-next-line no-console
      console.log("[ViewSwitcher] preview tenant:", tenantId ?? "(none)");
    },
    [canUseSwitcher],
  );

  const resetPreview = useCallback(() => {
    if (!canUseSwitcher) return;
    setRequestedViewRoleState("CONTROL");
    setRequestedViewTenantIdState(null);
    clearSession(ROLE_KEY);
    clearSession(TENANT_KEY);
  }, [canUseSwitcher]);

  // effectiveRenderRole = canUseSwitcher ? requestedViewRole : realRole
  // Stays null while unresolved. NEVER coerced to CONTROL.
  const effectiveRenderRole: ViewRole | null = canUseSwitcher ? requestedViewRole : realRole;
  const isPreviewMode = canUseSwitcher && requestedViewRole !== "CONTROL";

  const value = useMemo<ViewModeContextValue>(
    () => ({
      realRole,
      sessionResolved,
      canUseSwitcher,
      requestedViewRole,
      requestedViewTenantId,
      effectiveRenderRole,
      isPreviewMode,
      setRequestedViewRole,
      setRequestedViewTenantId,
      resetPreview,
    }),
    [
      realRole,
      sessionResolved,
      canUseSwitcher,
      requestedViewRole,
      requestedViewTenantId,
      effectiveRenderRole,
      isPreviewMode,
      setRequestedViewRole,
      setRequestedViewTenantId,
      resetPreview,
    ],
  );

  return <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>;
}
