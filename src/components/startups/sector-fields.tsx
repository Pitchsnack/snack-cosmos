import { Check, ChevronsUpDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { BUSINESS_MODELS, SECTOR_GROUPS } from "@/lib/sectors";
import { useTr } from "@/components/common/edit-info-popup";
import { useTextLang } from "@/components/common/text-lang";
import { businessModelLabel } from "@/i18n/th-edit-info";

/**
 * Sector + business model — the financial benchmarking pair shared by
 * Edit information and the setup wizard. Both stay optional here: sellers
 * confirm them in the wizard, and pre-wizard profiles are grandfathered.
 */
export function SectorBusinessModelFields({ sector, onSectorChange, businessModel, onBusinessModelChange }: {
  sector: string;
  onSectorChange: (v: string) => void;
  businessModel: string;
  onBusinessModelChange: (v: string) => void;
}) {
  const tr = useTr();
  const { lang } = useTextLang();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>{tr("Sector", "กลุ่มอุตสาหกรรม")} <span className="font-normal text-muted-foreground">{tr("(optional)", "(ไม่บังคับ)")}</span></Label>
        <p className="text-xs text-muted-foreground">{tr("SET classification, used for financial benchmarking", "การจัดกลุ่มของ SET ใช้เทียบเคียงตัวเลขทางการเงิน")}</p>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button"
              className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm">
              <span className={sector ? "" : "text-muted-foreground"}>{sector || tr("Search or pick a sector…", "ค้นหาหรือเลือกกลุ่มอุตสาหกรรม…")}</span>
              <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" align="start">
            <Command>
              <CommandInput placeholder={tr("Search…", "ค้นหา…")} className="h-8 text-sm" />
              <CommandList className="max-h-56">
                <CommandEmpty className="py-2 text-xs">{tr("No sector found.", "ไม่พบกลุ่มอุตสาหกรรม")}</CommandEmpty>
                {SECTOR_GROUPS.map((g) => (
                  <CommandGroup key={g.group} heading={g.group}>
                    {g.sectors.map((s) => (
                      <CommandItem key={s} value={s} onSelect={() => onSectorChange(s === sector ? "" : s)}
                        className="py-1.5 px-2 text-sm">
                        <Check className={cn("mr-1.5 h-3.5 w-3.5", s === sector ? "opacity-100" : "opacity-0")} />
                        {s}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      <div className="space-y-1.5">
        <Label>{tr("Business model", "รูปแบบธุรกิจ")} <span className="font-normal text-muted-foreground">{tr("(optional)", "(ไม่บังคับ)")}</span></Label>
        <p className="text-xs text-muted-foreground">&nbsp;</p>
        <Select value={businessModel || "none"} onValueChange={(v) => onBusinessModelChange(v === "none" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder={tr("Choose a business model…", "เลือกรูปแบบธุรกิจ…")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{tr("— Select —", "— เลือก —")}</SelectItem>
            {BUSINESS_MODELS.map((b) => (
              <SelectItem key={b.value} value={b.value}>
                {businessModelLabel(b.label, lang)}
                <span className="ml-1.5 text-xs text-muted-foreground">{b.hint}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
