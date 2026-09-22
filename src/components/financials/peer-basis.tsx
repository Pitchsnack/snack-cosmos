/**
 * Peers from — sector or companies chosen by hand for this one startup.
 *
 * The picker reads every listed company, in either market and any sector.
 * Nothing here creates or changes an admin peer set.
 */
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { peerMedians } from "@/lib/valuation";
import type { Peer } from "@/lib/peer-comparables";
import type { PeerCandidate } from "@/lib/startup-peers.functions";

const DASH = "—";

export function fmtNum(v: number | null | undefined, digits = 0, suffix = ""): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  return `${v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}${suffix}`;
}

function MarketTag({ market }: { market: string }) {
  return (
    <span
      className={`ml-1.5 rounded-[3px] px-[5px] py-[1px] text-[9.5px] font-bold ${
        market === "mai" ? "bg-[#EAF7EE] text-[#15803D]" : "bg-[#EEF2FB] text-[#1E3A8A]"
      }`}
    >
      {market}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* The switch                                                          */
/* ------------------------------------------------------------------ */

export function PeerBasisRow({
  basis,
  onBasis,
  onChoose,
  canEdit,
}: {
  basis: "sector" | "chosen";
  onBasis: (b: "sector" | "chosen") => void;
  onChoose: () => void;
  canEdit: boolean;
}) {
  const seg = (value: "sector" | "chosen", label: string) => (
    <button
      key={value}
      type="button"
      disabled={!canEdit}
      aria-selected={basis === value}
      onClick={() => onBasis(value)}
      className={`flex h-7 items-center rounded-[6px] px-[11px] text-[12px] font-medium whitespace-nowrap ${
        basis === value
          ? "bg-accent text-accent-foreground shadow-[inset_0_0_0_1px_var(--color-accent-dark)]"
          : "text-[#5B6576] hover:bg-[#F1F4F9]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mb-[11px] flex flex-wrap items-center gap-2.5">
      <span className="text-[11.5px] text-muted-foreground">Peers from</span>
      <span className="inline-flex gap-0.5 rounded-[8px] border border-[#DCE3EF] bg-white p-[3px]">
        {seg("sector", "Sector")}
        {seg("chosen", "Chosen companies")}
      </span>
      {canEdit && (
        <button
          type="button"
          onClick={onChoose}
          className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-[7px] bg-accent px-3 text-[12px] font-medium text-accent-foreground shadow-[inset_0_0_0_1px_var(--color-accent-dark)] hover:brightness-[.97]"
        >
          ＋ Choose companies
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The picker                                                          */
/* ------------------------------------------------------------------ */

export function PeerPickerDialog({
  open,
  onOpenChange,
  candidates,
  initialSelected,
  startupRevenueThbM,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  candidates: PeerCandidate[];
  initialSelected: string[];
  startupRevenueThbM: number | null;
  onSave: (ids: string[]) => void;
  saving?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [query, setQuery] = useState("");
  const [market, setMarket] = useState<"all" | "SET" | "mai">("all");
  const [sector, setSector] = useState<string>("any");

  // Reset each time the dialog opens.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSelected(initialSelected);
      setQuery("");
      setMarket("all");
      setSector("any");
    }
  }

  const sectors = useMemo(
    () => [...new Set(candidates.map((c) => c.sector).filter(Boolean) as string[])].sort(),
    [candidates],
  );

  const distance = (c: PeerCandidate) =>
    startupRevenueThbM === null || c.revenueThbM === null
      ? Number.POSITIVE_INFINITY
      : Math.abs(c.revenueThbM - startupRevenueThbM);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates
      .filter((c) => (market === "all" ? true : c.market === market))
      .filter((c) => (sector === "any" ? true : c.sector === sector))
      .filter(
        (c) =>
          !q ||
          (c.ticker ?? "").toLowerCase().includes(q) ||
          c.companyName.toLowerCase().includes(q),
      )
      .sort((a, b) => distance(a) - distance(b));
  }, [candidates, query, market, sector, startupRevenueThbM]);

  const chosen = candidates.filter((c) => selected.includes(c.id!));
  const medians = peerMedians(chosen as Peer[]);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const suggest = () =>
    setSelected(
      [...candidates]
        .filter((c) => c.revenueThbM !== null)
        .sort((a, b) => distance(a) - distance(b))
        .slice(0, 6)
        .map((c) => c.id!),
    );

  const plain =
    "h-8 rounded-[7px] border border-[#EAECEF] bg-white px-4 text-[12.5px] font-semibold text-[#0F1B33] hover:bg-[#EDEFF3] active:bg-[#374151] active:text-white disabled:opacity-50";

  const selectCls =
    "h-[30px] rounded-[7px] border border-[#CDD5E1] bg-white px-2 text-[12.5px] text-[#0F1B33]";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px] gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-[#EAECEF] px-3.5 py-3">
          <DialogTitle className="text-[14px] font-bold text-[#0F1B33]">
            Choose peer companies
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 border-b border-[#EAECEF] px-3.5 py-2.5">
          <div className="flex h-[30px] min-w-[180px] flex-1 items-center gap-1.5 rounded-[7px] border border-[#CDD5E1] px-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ticker or company…"
              className="w-full bg-transparent text-[12.5px] outline-none"
            />
          </div>
          <select
            value={market}
            onChange={(e) => setMarket(e.target.value as typeof market)}
            className={selectCls}
          >
            <option value="all">All markets</option>
            <option value="SET">SET</option>
            <option value="mai">mai</option>
          </select>
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className={`${selectCls} max-w-[170px]`}
          >
            <option value="any">Any sector</option>
            {sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={suggest}
            className="ml-auto h-[30px] rounded-[7px] border border-[#C9B8F3] bg-white px-[11px] text-[12px] font-semibold text-[#6D28D9]"
          >
            Suggest 6 closest in size
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-b border-[#EAECEF] bg-[#FBFCFE] px-3.5 py-2.5">
          {chosen.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#DCE3EF] bg-white px-2.5 py-[2px] text-[11.5px] font-semibold text-[#0F1B33]"
            >
              {c.ticker ?? c.companyName}
              <button type="button" onClick={() => toggle(c.id!)} aria-label={`Remove ${c.ticker}`}>
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            </span>
          ))}
          <span className="ml-auto self-center text-[11.5px] text-muted-foreground">
            {selected.length} selected · minimum 3
          </span>
        </div>

        <div className="max-h-[340px] overflow-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead className="sticky top-0 z-10">
              <tr>
                {["Company", "Revenue THB m", "EBITDA margin", "EV/EBITDA", "P/E", "P/BV"].map(
                  (h, i) => (
                    <th
                      key={h}
                      className={`border-b border-[#EAECEF] bg-[#FAFBFC] px-3 py-[7px] text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground ${
                        i === 0 ? "text-left" : "text-right"
                      }`}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const on = selected.includes(c.id!);
                return (
                  <tr
                    key={c.id}
                    onClick={() => toggle(c.id!)}
                    className={`cursor-pointer ${on ? "bg-[#F7FAFF]" : ""}`}
                  >
                    <td className="border-b border-[#F2F4F6] px-3 py-[7px] font-medium text-[#0F1B33]">
                      <span
                        className={`mr-2 inline-flex h-[15px] w-[15px] -mb-[3px] items-center justify-center rounded-[4px] border-[1.5px] text-[10px] text-white ${
                          on ? "border-[#1E3A8A] bg-[#1E3A8A]" : "border-[#C3CBDA]"
                        }`}
                      >
                        {on ? "✓" : ""}
                      </span>
                      {c.ticker ?? c.companyName}
                      <MarketTag market={c.market} />
                    </td>
                    <Cell v={c.revenueThbM} />
                    <Cell v={c.ebitdaMarginPct} digits={1} suffix="%" />
                    <Cell v={c.evEbitda} digits={1} suffix="×" />
                    <Cell v={c.pe} digits={2} suffix="×" />
                    <Cell v={c.pbv} digits={2} suffix="×" />
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-5 text-center text-muted-foreground">
                    No company matches that search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2.5 border-t border-[#EAECEF] bg-[#FCFCFD] px-3.5 py-2.5">
          <span className="text-[11.5px] text-muted-foreground">
            Median revenue <b className="text-[#0F1B33]">{fmtNum(medians.revenueThbM)}</b> ·
            EV/EBITDA <b className="text-[#0F1B33]">{fmtNum(medians.evEbitda, 2, "×")}</b> · P/E{" "}
            <b className="text-[#0F1B33]">{fmtNum(medians.pe, 2, "×")}</b> · P/BV{" "}
            <b className="text-[#0F1B33]">{fmtNum(medians.pbv, 2, "×")}</b>
            {selected.length > 0 && selected.length < 5 && (
              <span className="ml-2 text-[#B45309]">
                {selected.length} companies — a median this thin is easily moved by one company.
              </span>
            )}
          </span>
          <span className="flex-1" />
          <button type="button" className={plain} onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button
            type="button"
            className={plain}
            disabled={selected.length < 3 || saving}
            onClick={() => onSave(selected)}
          >
            OK
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Cell({
  v,
  digits = 0,
  suffix = "",
}: {
  v: number | null;
  digits?: number;
  suffix?: string;
}) {
  return (
    <td
      className={`border-b border-[#F2F4F6] px-3 py-[7px] text-right tabular-nums ${
        v === null ? "text-[#C0C6CF]" : "text-[#0F1B33]"
      }`}
    >
      {fmtNum(v, digits, suffix)}
    </td>
  );
}
