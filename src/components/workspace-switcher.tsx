import { useState } from "react";
import { Check, ChevronsUpDown, Building2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
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
import { switchWorkspace } from "@/lib/session-context.functions";

const ACTIVE_KEY = "sp2.activeTenantId";
const CONTROL_LABEL = "Control";
const CONTROL_SUB = "Global Workspace";

export function getActiveTenantId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_KEY);
}

export function WorkspaceSwitcher({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const { data: session } = useSessionContext();
  const qc = useQueryClient();
  const doSwitch = useServerFn(switchWorkspace);

  const tenants = session?.tenants ?? [];
  const isControl = (session?.roles ?? []).includes("CONTROL");
  const activeId = session?.activeWorkspace.tenantId ?? null;
  const active = tenants.find((t) => t.tenantId === activeId);
  const label = active ? active.tenantName : isControl ? CONTROL_LABEL : tenants[0]?.tenantName ?? "—";

  async function pick(tenantId: string | null, workspaceType: string | null) {
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
          aria-label="Switch workspace"
          className={cn(
            "inline-flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-left text-foreground transition-colors hover:bg-muted",
            compact ? "h-9" : "h-9",
          )}
        >
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          {!compact && (
            <span className="hidden max-w-[140px] truncate text-sm font-medium sm:inline">
              {label}
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
                {tenants.map((t) => (
                  <CommandItem
                    key={t.tenantId}
                    value={`${t.tenantName} ${t.tenantCode}`}
                    onSelect={() => pick(t.tenantId, t.workspaceType)}
                  >
                    <Check className={cn("mr-2 h-4 w-4", activeId === t.tenantId ? "opacity-100" : "opacity-0")} />
                    <div className="flex flex-col">
                      <span className="text-sm">{t.tenantName}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {t.tenantCode} · {t.workspaceType}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
