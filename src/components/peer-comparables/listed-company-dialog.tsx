import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SECTORS } from "@/lib/sectors";
import type { PeerMarket } from "@/lib/peer-comparables";
import { emptyListedCompany, type ListedCompanyInput } from "@/lib/listed-companies";
import { saveListedCompany } from "@/lib/listed-companies.functions";

const NO_SECTOR = "__none__";

const NUMERIC: { key: keyof ListedCompanyInput; label: string }[] = [
  { key: "revenueThbM", label: "Revenue THB m" },
  { key: "ebitdaMarginPct", label: "EBITDA margin %" },
  { key: "evEbitda", label: "EV/EBITDA" },
  { key: "pe", label: "P/E" },
  { key: "pbv", label: "P/BV" },
];

/**
 * Add / edit one listed company. `defaultMarket` pre-fills from the visible
 * market tab and stays editable.
 */
export function ListedCompanyDialog({
  open,
  onOpenChange,
  defaultMarket,
  initial,
  prefillName,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultMarket: PeerMarket;
  initial?: ListedCompanyInput | null;
  /** Typed text carried over from the "+ Add …" combobox row. */
  prefillName?: string;
  onSaved?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const saveFn = useServerFn(saveListedCompany);
  const [form, setForm] = useState<ListedCompanyInput>(emptyListedCompany(defaultMarket));

  useEffect(() => {
    if (!open) return;
    if (initial) setForm(initial);
    else {
      const base = emptyListedCompany(defaultMarket);
      setForm(prefillName ? { ...base, name: prefillName, ticker: "" } : base);
    }
  }, [open, initial, defaultMarket, prefillName]);

  const set = (patch: Partial<ListedCompanyInput>) => setForm((f) => ({ ...f, ...patch }));

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          id: form.id ?? null,
          ticker: form.ticker.trim(),
          name: form.name.trim(),
          market: form.market,
          sector: form.sector,
          revenueThbM: form.revenueThbM,
          ebitdaMarginPct: form.ebitdaMarginPct,
          evEbitda: form.evEbitda,
          pe: form.pe,
          pbv: form.pbv,
          asAt: form.asAt,
        },
      }),
    onSuccess: (r) => {
      toast.success(form.id ? "Company updated." : "Company added.");
      qc.invalidateQueries({ queryKey: ["listed-companies"] });
      onOpenChange(false);
      onSaved?.(r.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const valid = form.ticker.trim().length > 0 && form.name.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{form.id ? "Edit listed company" : "Add listed company"}</DialogTitle>
          <DialogDescription>
            One row per ticker. Peer sets point at this row, so a change here updates every set
            that uses it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Ticker</span>
            <Input
              value={form.ticker}
              placeholder="e.g. TU"
              onChange={(e) => set({ ticker: e.target.value.toUpperCase() })}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Market</span>
            <Select value={form.market} onValueChange={(v) => set({ market: v as PeerMarket })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SET">SET</SelectItem>
                <SelectItem value="mai">mai</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="col-span-2 space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Company</span>
            <Input
              value={form.name}
              placeholder="Company name"
              onChange={(e) => set({ name: e.target.value })}
            />
          </label>
          <label className="col-span-2 space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Sector (informational)
            </span>
            <Select
              value={form.sector ?? NO_SECTOR}
              onValueChange={(v) => set({ sector: v === NO_SECTOR ? null : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="No sector" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SECTOR}>No sector</SelectItem>
                {SECTORS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          {NUMERIC.map((m) => (
            <label key={m.key} className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">{m.label}</span>
              <Input
                inputMode="decimal"
                className="text-right tabular-nums"
                placeholder="—"
                value={
                  form[m.key] === null || form[m.key] === undefined ? "" : String(form[m.key])
                }
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  const n = raw === "" || raw === "-" ? null : Number(raw);
                  set({ [m.key]: n !== null && Number.isFinite(n) ? n : null } as Partial<ListedCompanyInput>);
                }}
              />
            </label>
          ))}
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Period</span>
            <Input
              placeholder="Dec-25"
              value={form.statementPeriod ?? ""}
              onChange={(e) => set({ statementPeriod: e.target.value || null })}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Tag</span>
            <Input
              placeholder="e.g. Telecom"
              value={form.tag ?? ""}
              onChange={(e) => set({ tag: e.target.value || null })}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">As at</span>
            <Input
              type="date"
              value={form.asAt ?? ""}
              onChange={(e) => set({ asAt: e.target.value || null })}
            />
          </label>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!valid || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save company"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
