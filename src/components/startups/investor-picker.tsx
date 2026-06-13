import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { listTenantInvestors } from "@/lib/startups.functions";
import { cn } from "@/lib/utils";

interface Props {
  tenantId: string;
  value: string[];
  onChange: (ids: string[]) => void;
}

export function InvestorPicker({ tenantId, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const fn = useServerFn(listTenantInvestors);
  const q = useQuery({
    queryKey: ["tenant-investors", tenantId],
    queryFn: () => fn({ data: { tenantId } }),
    enabled: !!tenantId,
  });
  const investors = q.data ?? [];
  const byId = new Map(investors.map((i) => [i.id, i]));

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" className="w-full justify-between" disabled={!tenantId}>
            {value.length ? `${value.length} investor${value.length === 1 ? "" : "s"} selected` : "Select investors…"}
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search investors…" />
            <CommandList>
              <CommandEmpty>{q.isLoading ? "Loading…" : "No investors in this tenant."}</CommandEmpty>
              <CommandGroup>
                {investors.map((inv) => (
                  <CommandItem key={inv.id} value={inv.name} onSelect={() => toggle(inv.id)}>
                    <Check className={cn("mr-2 h-4 w-4", value.includes(inv.id) ? "opacity-100" : "opacity-0")} />
                    {inv.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs">
              {byId.get(id)?.name ?? id.slice(0, 6)}
              <button type="button" onClick={() => toggle(id)} className="hover:opacity-70">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
