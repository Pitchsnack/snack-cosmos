import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Database, Loader2, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { deleteDbd, extractDbd, getDbdStore, saveManualDbd } from "@/lib/dbd-store.functions";
import type { DbdStoreState } from "@/lib/dbd-store.server";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }) : "");

/**
 * Control Admin controls for the shared DBD store of one registration number:
 * Extract data (nothing is fetched on opening), Try again, Enter data by hand,
 * Refresh from DBD and Delete DBD data — each with its confirm.
 */
export function DbdStorePanel({ reg, initial, onChanged }: { reg: string | null; initial?: DbdStoreState; onChanged?: () => void }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getDbdStore);
  const extractFn = useServerFn(extractDbd);
  const deleteFn = useServerFn(deleteDbd);
  const key = ["dbd-store", reg];
  const q = useQuery({ queryKey: key, queryFn: () => getFn({ data: { reg } }), enabled: !!reg, initialData: initial ? { state: initial, data: null } : undefined, staleTime: 10_000 });
  const [confirm, setConfirm] = useState<null | "refresh" | "delete" | "replace_manual">(null);
  const [manual, setManual] = useState(false);
  const done = () => { void qc.invalidateQueries({ queryKey: key }); void qc.invalidateQueries({ queryKey: ["dbd-store"] }); onChanged?.(); };

  const extract = useMutation({
    mutationFn: (v: { refresh: boolean; replaceManual?: boolean }) => extractFn({ data: { reg: reg!, refresh: v.refresh, replaceManual: !!v.replaceManual } }),
    onSuccess: (r, v) => {
      if (r.ok) toast.success(v.refresh ? "Refreshed from DBD. Analyst edits are kept on top." : "DBD data extracted and stored.");
      else toast.error(v.refresh && r.kept ? `${r.error}. The data stored before is kept.` : r.error);
      done();
    },
    onError: (e) => { toast.error((e as Error).message); done(); },
  });
  const del = useMutation({
    mutationFn: () => deleteFn({ data: { reg: reg! } }),
    onSuccess: () => { toast.success("DBD data deleted."); done(); },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!reg) return <p className="mb-2.5 text-[12.5px] text-muted-foreground">No 13-digit registration number, so there is no DBD data to extract.</p>;
  const s = q.data?.state ?? initial;
  const busy = extract.isPending || del.isPending;

  return (
    <div className="mb-2.5 rounded-[10px] border border-border bg-muted/30 px-3.5 py-2.5 text-[13px]" data-dbd-panel>
      {busy ? (
        <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />{del.isPending ? "Deleting DBD data…" : "Getting the company data from DBD…"}</p>
      ) : s?.status === "stored" ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <Database className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span>
              {s.source === "manual"
                ? <>Entered by hand {s.enteredBy ? `by ${s.enteredBy} ` : ""}on {when(s.retrievedAt)} · Source: {s.sourceNote}</>
                : <>DBD data fetched {when(s.retrievedAt)}</>}
              {s.years.length ? ` · FY${s.years[0]}–${s.years[s.years.length - 1]}` : ""}
              {s.edits ? ` · ${s.edits} analyst edit${s.edits > 1 ? "s" : ""}` : ""}
              {s.lastError ? <span className="text-[#B91C1C]"> · Last refresh failed: {s.lastError}</span> : null}
            </span>
          </span>
          {s.source === "manual" ? (
            <>
              <Button size="sm" variant="outline" className="h-8" onClick={() => setManual(true)}><Pencil className="mr-1 h-3.5 w-3.5" />Edit data</Button>
              <Button size="sm" variant="outline" className="h-8" onClick={() => setConfirm("replace_manual")}><RefreshCw className="mr-1 h-3.5 w-3.5" />Extract from DBD</Button>
            </>
          ) : (
            <Button size="sm" variant="outline" className="h-8" onClick={() => setConfirm("refresh")}><RefreshCw className="mr-1 h-3.5 w-3.5" />Refresh from DBD</Button>
          )}
          <Button size="sm" variant="outline" className="h-8 text-[#B91C1C]" onClick={() => setConfirm("delete")}><Trash2 className="mr-1 h-3.5 w-3.5" />Delete DBD data</Button>
        </div>
      ) : s?.status === "failed" ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex-1 text-[#B91C1C]">Couldn't get the data from DBD: {s.lastError}. Nothing was stored.</span>
          <Button size="sm" className="h-8" onClick={() => extract.mutate({ refresh: false })}>Try again</Button>
          <Button size="sm" variant="outline" className="h-8" onClick={() => setManual(true)}>Enter data by hand</Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex-1 text-muted-foreground">No DBD data stored for this registration number yet.</span>
          <Button size="sm" className="h-8" onClick={() => extract.mutate({ refresh: false })}><Database className="mr-1 h-3.5 w-3.5" />Extract data</Button>
          <Button size="sm" variant="outline" className="h-8" onClick={() => setManual(true)}>Enter data by hand</Button>
        </div>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>{confirm === "delete" ? "Delete DBD data?" : confirm === "refresh" ? "Refresh from DBD?" : "Replace the data entered by hand?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {confirm === "delete"
              ? "This removes the stored company data and financial statements for this registration number, for every seller, buyer and advisor that uses it. Reports built from it go back to waiting. Analyst edits are kept."
              : confirm === "refresh"
                ? "PitchSnack fetches the data from DBD again and replaces what is stored. If DBD does not answer, the data stored now is kept. Analyst edits stay on top."
                : "PitchSnack fetches the data from DBD and replaces the figures entered by hand. If DBD does not answer, the figures entered by hand are kept."}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              const c = confirm; setConfirm(null);
              if (c === "delete") del.mutate();
              else extract.mutate({ refresh: true, replaceManual: c === "replace_manual" });
            }}>{confirm === "delete" ? "Delete DBD data" : confirm === "refresh" ? "Refresh from DBD" : "Replace with DBD data"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {manual && <ManualDialog reg={reg} stored={s?.status === "stored" ? q.data?.data : null} hasDbd={s?.status === "stored" && s.source === "dbd"} onClose={() => setManual(false)} onSaved={done} />}
    </div>
  );
}

type Year = Record<string, string>;
const FIGS: [string, string, "income" | "position" | "cash_flow", string][] = [
  ["revenue", "Revenue", "income", "total_revenue"], ["costOfSales", "Cost of sales", "income", "cost_of_goods_sold"],
  ["grossProfit", "Gross profit", "income", "gross_profit_loss"], ["operatingExpenses", "Operating expenses", "income", "selling_admin_expenses"],
  ["ebitda", "EBITDA", "income", "ebitda"], ["netProfit", "Net profit", "income", "net_profit_loss"],
  ["totalAssets", "Total assets", "position", "total_assets"], ["currentAssets", "Current assets", "position", "total_current_assets"],
  ["totalLiabilities", "Total liabilities", "position", "total_liabilities"], ["currentLiabilities", "Current liabilities", "position", "total_current_liabilities"],
  ["equity", "Equity", "position", "equity"], ["cash", "Cash", "cash_flow", "cf_cash_end"],
];

function ManualDialog({ reg, stored, hasDbd, onClose, onSaved }: { reg: string; stored: any; hasDbd: boolean; onClose: () => void; onSaved: () => void }) {
  const saveFn = useServerFn(saveManualDbd);
  const info = stored?.info ?? {};
  const [tab, setTab] = useState<"company" | "figures">("company");
  const [co, setCo] = useState({
    nameTh: info.legal_name_th ?? "", nameEn: info.legal_name_en ?? "", registeredOn: info.registration_date ?? "",
    status: info.legal_entity_status_th ?? "", capital: info.registered_capital_thb != null ? String(info.registered_capital_thb) : "",
    address: info.head_office_address_th ?? "", directors: (stored?.directors ?? []).join("\n"),
  });
  const thisYear = new Date().getFullYear() - 1;
  const [years, setYears] = useState<Year[]>(() => {
    const sts = (stored?.statements ?? []) as any[];
    if (!sts.length) return [{ year: String(thisYear) }];
    return sts.slice().sort((a, b) => b.fiscal_year - a.fiscal_year).map((st) => {
      const y: Year = { year: String(st.fiscal_year) };
      for (const [k, , part, code] of FIGS) {
        const row = (st[part] ?? []).find((r: any) => r.item_code === code);
        if (row?.amount != null) y[k] = String(row.amount);
      }
      return y;
    });
  });
  const [source, setSource] = useState(stored && !hasDbd ? "" : "");
  const [confirmReplace, setConfirmReplace] = useState(false);
  const n = (v: string | undefined) => { const t = (v ?? "").replace(/,/g, "").trim(); if (!t) return null; const x = Number(t); return Number.isFinite(x) ? x : null; };
  const save = useMutation({
    mutationFn: (replaceDbd: boolean) => saveFn({ data: {
      reg, replaceDbd,
      form: {
        source,
        company: { nameTh: co.nameTh || null, nameEn: co.nameEn || null, registeredOn: co.registeredOn || "", status: co.status || null, capital: n(co.capital), address: co.address || null, directors: co.directors.split("\n").map((d: string) => d.trim()).filter(Boolean) },
        years: years.filter((y) => /^\d{4}$/.test(y.year ?? "")).map((y) => ({ year: Number(y.year), ...Object.fromEntries(FIGS.map(([k]) => [k, n(y[k])])) })),
      },
    } }),
    onSuccess: (r) => {
      if (!r.ok) { if (/Confirm to replace/.test(r.error)) setConfirmReplace(true); else toast.error(r.error); return; }
      toast.success("Data saved as entered by hand."); onSaved(); onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const submit = () => {
    if (source.trim().length < 2) { toast.error("Say where the figures come from (Source)."); return; }
    if (hasDbd) { setConfirmReplace(true); return; }
    save.mutate(false);
  };
  const field = (label: string, v: string, set: (x: string) => void, props: Record<string, unknown> = {}) => (
    <label className="grid gap-1 text-[12.5px] font-medium">{label}<Input value={v} onChange={(e) => set(e.target.value)} {...props} /></label>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[720px] overflow-y-auto">
        <DialogTitle>Enter data by hand · {reg}</DialogTitle>
        <div className="flex gap-1 border-b border-border" role="tablist">
          {(["company", "figures"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`-mb-px rounded-t-md border px-3 py-1.5 text-[13px] font-semibold ${tab === t ? "border-border border-b-background bg-background" : "border-transparent text-muted-foreground"}`}>
              {t === "company" ? "Company" : "Financial figures"}
            </button>
          ))}
        </div>
        {tab === "company" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {field("Company name (Thai)", co.nameTh, (x) => setCo({ ...co, nameTh: x }))}
            {field("Company name (English)", co.nameEn, (x) => setCo({ ...co, nameEn: x }))}
            {field("Registered on", co.registeredOn, (x) => setCo({ ...co, registeredOn: x }), { type: "date" })}
            {field("Status", co.status, (x) => setCo({ ...co, status: x }))}
            {field("Registered capital (baht)", co.capital, (x) => setCo({ ...co, capital: x }), { inputMode: "decimal" })}
            {field("Address", co.address, (x) => setCo({ ...co, address: x }))}
            <label className="grid gap-1 text-[12.5px] font-medium sm:col-span-2">Directors (one per line)
              <textarea className="min-h-[72px] rounded-md border border-input bg-background px-3 py-2 text-[13px]" value={co.directors} onChange={(e) => setCo({ ...co, directors: e.target.value })} />
            </label>
          </div>
        ) : (
          <div className="grid gap-3">
            {years.map((y, i) => (
              <fieldset key={i} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <label className="text-[12.5px] font-medium">Year</label>
                  <Input className="h-8 w-24" value={y.year ?? ""} onChange={(e) => setYears(years.map((x, j) => (j === i ? { ...x, year: e.target.value } : x)))} inputMode="numeric" />
                  {years.length > 1 && <Button size="sm" variant="ghost" className="ml-auto h-8" onClick={() => setYears(years.filter((_, j) => j !== i))}>Remove year</Button>}
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {FIGS.map(([k, label]) => field(`${label} (baht)`, y[k] ?? "", (x) => setYears(years.map((v, j) => (j === i ? { ...v, [k]: x } : v))), { inputMode: "decimal", key: k }))}
                </div>
              </fieldset>
            ))}
            {years.length < 10 && <Button size="sm" variant="outline" className="w-fit" onClick={() => setYears([...years, { year: String(Number(years[years.length - 1]?.year ?? thisYear) - 1) }])}>Add a year</Button>}
          </div>
        )}
        <label className="grid gap-1 text-[12.5px] font-medium">Source (required)
          <Input placeholder="e.g. Audited accounts FY2024 sent by the seller" value={source} onChange={(e) => setSource(e.target.value)} />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save data"}</Button>
        </div>
        <AlertDialog open={confirmReplace} onOpenChange={setConfirmReplace}>
          <AlertDialogContent>
            <AlertDialogTitle>Replace the DBD data?</AlertDialogTitle>
            <AlertDialogDescription>The data fetched from DBD will be replaced with what you entered by hand, marked as entered by hand with your source.</AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { setConfirmReplace(false); save.mutate(true); }}>Replace with my data</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
