import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Building2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
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
import { supabase } from "@/integrations/supabase/client";

const ACTIVE_KEY = "sp2.activeTenantId";
const CONTROL_LABEL = "Control";
const CONTROL_SUB = "Global Workspace";

export function getActiveTenantId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_KEY);
}

export function WorkspaceSwitcher() {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setActiveId(getActiveTenantId());
  }, []);

  const { data: tenants = [] } = useQuery({
    queryKey: ["tenants", "switcher"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, tenant_code, tenant_name, status")
        .neq("status", "Deleted")
        .order("tenant_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const active = tenants.find((t) => t.id === activeId);
  const label = active ? active.tenant_name : CONTROL_LABEL;
  const sublabel = active ? active.tenant_code : CONTROL_SUB;

  function pick(id: string | null) {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
    setActiveId(id);
    setOpen(false);
    window.dispatchEvent(new CustomEvent("sp2:workspace-changed"));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className="flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-2.5 py-2 text-left text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
        >
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-sidebar-primary/15 text-sidebar-primary">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-medium">{label}</div>
            <div className="truncate text-[11px] text-sidebar-foreground/60">
              {sublabel}
            </div>
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start" sideOffset={8}>
        <Command>
          <CommandInput placeholder="Search workspace…" />
          <CommandList>
            <CommandEmpty>No tenants yet.</CommandEmpty>
            <CommandGroup heading="Platform">
              <CommandItem value="__control__" onSelect={() => pick(null)}>
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    !activeId ? "opacity-100" : "opacity-0",
                  )}
                />
                <div className="flex flex-col">
                  <span className="text-sm">{CONTROL_LABEL}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {CONTROL_SUB}
                  </span>
                </div>
              </CommandItem>
            </CommandGroup>
            {tenants.length > 0 && (
              <CommandGroup heading="Tenants">
                {tenants.map((t) => (
                  <CommandItem
                    key={t.id}
                    value={`${t.tenant_name} ${t.tenant_code}`}
                    onSelect={() => pick(t.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        activeId === t.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="text-sm">{t.tenant_name}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {t.tenant_code}
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
