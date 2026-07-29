import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Building2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useSessionContext } from "@/hooks/use-session-context";
import { useHasSession } from "@/hooks/use-has-session";
import { switchWorkspace } from "@/lib/session-context.functions";
import { listAssignableTenants } from "@/lib/tenants.functions";
import { ROLE_LABELS } from "@/lib/permissions";

// Preview-only feature flag. Production stays OFF until the Option A backend
// PRD extends switchWorkspace with MASTER_AGENT authorization and physical
// tenant-database readiness enforcement. Flag is read independently in each
// authorized file (no shared helper module).
const WORKSPACE_ENFORCEMENT_ENABLED =
  import.meta.env.VITE_WORKSPACE_ENFORCEMENT === "true";

const ACTIVE_KEY = "sp2.activeTenantId";
const CONTROL_LABEL = "Control";
const CONTROL_SUB = "Global Workspace";

// Preview-only, non-persistent fixture tenants. Rendered only when the
// enforcement flag is ON and the real merged list is empty, so the CONTROL
// principal can exercise the mismatch/switch/disabled UX without touching
// backend membership. Fixtures never call switchWorkspace, never write
// session state, never select a physical database, never persist.
const FIXTURE_TENANT_PREFIX = "fixture-preview-";
const FIXTURE_TENANTS: Array<{ tenantId: string; tenantName: string; tenantCode: string; workspaceType: string | null }> = [
  { tenantId: `${FIXTURE_TENANT_PREFIX}alpha`, tenantName: "Acme Ventures (preview fixture)", tenantCode: "ACME-FX", workspaceType: "TENANT" },
  { tenantId: `${FIXTURE_TENANT_PREFIX}beta`, tenantName: "Nova Capital (preview fixture)", tenantCode: "NOVA-FX", workspaceType: "TENANT" },
];
const isFixtureTenant = (id: string | null | undefined): boolean =>
  !!id && id.startsWith(FIXTURE_TENANT_PREFIX);

export function getActiveTenantId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_KEY);
}

interface WorkspaceChoice {
  tenantId: string;
  tenantName: string;
  tenantCode: string;
  workspaceType: string | null;
}

export function WorkspaceSwitcher({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const { data: session } = useSessionContext();
  const qc = useQueryClient();
  const doSwitch = useServerFn(switchWorkspace);
  const hasSession = useHasSession();
  const fetchAssignableTenants = useServerFn(listAssignableTenants);

  const sessionTenants = session?.tenants ?? [];
  const isControl = (session?.roles ?? []).includes("CONTROL");
  const activeId = session?.activeWorkspace.tenantId ?? null;

  // Principal-scoped authorized-choice list. Not authorization, not
  // membership, not routing, not physical-database selection. Query fires
  // only when the flag is ON and a principal exists.
  const principalRef = session?.user?.id ?? null;
  const assignableQ = useQuery({
    queryKey: ["assignable-tenants", principalRef],
    queryFn: () => fetchAssignableTenants(),
    enabled: WORKSPACE_ENFORCEMENT_ENABLED && hasSession && !!principalRef,
    staleTime: 60_000,
  });

  const tenants: WorkspaceChoice[] = useMemo(() => {
    if (!WORKSPACE_ENFORCEMENT_ENABLED) {
      return sessionTenants.map((t) => ({
        tenantId: t.tenantId,
        tenantName: t.tenantName,
        tenantCode: t.tenantCode,
        workspaceType: t.workspaceType,
      }));
    }
    const map = new Map<string, WorkspaceChoice>();
    for (const t of sessionTenants) {
      map.set(t.tenantId, {
        tenantId: t.tenantId,
        tenantName: t.tenantName,
        tenantCode: t.tenantCode,
        workspaceType: t.workspaceType,
      });
    }
    for (const t of assignableQ.data ?? []) {
      if (!map.has(t.id)) {
        map.set(t.id, {
          tenantId: t.id,
          tenantName: t.tenantName,
          tenantCode: t.tenantCode,
          workspaceType: null,
        });
      }
    }
    const merged = Array.from(map.values()).sort((a, b) =>
      a.tenantName.localeCompare(b.tenantName, undefined, { sensitivity: "base" }),
    );
    // Preview-only fixture fallback: only when the real merged list is empty.
    // Never persists, never mutates session state.
    if (merged.length === 0 && !assignableQ.isLoading) {
      return [...FIXTURE_TENANTS];
    }
    return merged;
  }, [sessionTenants, assignableQ.data, assignableQ.isLoading]);

  const active = tenants.find((t) => t.tenantId === activeId);
  const label = active
    ? active.tenantName
    : isControl
      ? CONTROL_LABEL
      : tenants[0]?.tenantName ?? "—";
  const roleCode = session?.activeWorkspace.roleCode ?? session?.roles?.[0] ?? null;
  const roleLabel = roleCode ? ROLE_LABELS[roleCode] ?? roleCode : "No role";


  async function pick(tenantId: string | null, workspaceType: string | null) {
    // Preview-only fixture: do NOT call switchWorkspace, do NOT write
    // localStorage, do NOT invalidate session context. Close popover and
    // surface a preview-only console notice so the UX can be demoed without
    // touching backend membership or physical-database routing.
    if (isFixtureTenant(tenantId)) {
      console.info(
        "[workspace-switcher] Preview fixture tenant selected — no switchWorkspace call, no session mutation.",
        { tenantId },
      );
      setOpen(false);
      return;
    }
    try {
      if (tenantId) localStorage.setItem(ACTIVE_KEY, tenantId);
      else localStorage.removeItem(ACTIVE_KEY);
      await doSwitch({
        data: {
          tenantId,
          workspaceType: (workspaceType as never) ?? (tenantId ? "TENANT" : "CONTROL"),
        },
      });
      await qc.invalidateQueries();
      setOpen(false);
      window.dispatchEvent(new CustomEvent("sp2:workspace-changed"));
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={`Active workspace: ${label}${roleLabel ? `, role ${roleLabel}` : ""}. Switch workspace`}
          className={cn(
            "inline-flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-left text-foreground transition-colors hover:bg-muted",
            compact ? "h-9" : "h-10",
          )}
        >
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          {!compact && (
            <span className="hidden min-w-0 flex-col leading-tight sm:flex">
              <span className="max-w-[160px] truncate text-sm font-medium">{label}</span>
              <span className="max-w-[160px] truncate text-[11px] text-muted-foreground">
                {roleLabel}
              </span>
            </span>
          )}
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[280px] p-0" align="start" sideOffset={8}>
        <Command>
          <CommandInput placeholder="Search workspace…" />
          <CommandList>
            <CommandEmpty>No workspaces available.</CommandEmpty>
            {isControl && (
              <CommandGroup heading="Platform">
                <CommandItem value="__control__" onSelect={() => pick(null, "CONTROL")}>
                  <Check className={cn("mr-2 h-4 w-4", !activeId ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col">
                    <span className="text-sm">{CONTROL_LABEL}</span>
                    <span className="text-[11px] text-muted-foreground">{CONTROL_SUB}</span>
                  </div>
                </CommandItem>
              </CommandGroup>
            )}
            {tenants.length > 0 && (
              <CommandGroup heading="Workspaces">
                {tenants.map((t) => {
                  const fx = isFixtureTenant(t.tenantId);
                  return (
                    <CommandItem
                      key={t.tenantId}
                      value={`${t.tenantName} ${t.tenantCode}`}
                      onSelect={() => pick(t.tenantId, t.workspaceType)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          activeId === t.tenantId ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="text-sm">
                          {t.tenantName}
                          {fx && (
                            <span className="ml-2 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 align-middle text-[10px] font-medium text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
                              PREVIEW FIXTURE
                            </span>
                          )}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {t.tenantCode}
                          {t.workspaceType ? ` · ${t.workspaceType}` : ""}
                          {fx ? " · not activatable" : ""}
                        </span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
