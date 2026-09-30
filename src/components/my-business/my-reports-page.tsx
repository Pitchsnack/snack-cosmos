import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calculator, Check, ChevronDown, FileBarChart } from "lucide-react";
import { toast } from "sonner";
import { getMyReportsState, saveMyReportsPrefs, type MyReportCompany, type ReportStatus } from "@/lib/my-reports.functions";
import { LockedReportPage } from "@/components/my-business/locked-report-page";
import { SharePanel, ShareButton, ShareAccessDialog } from "@/components/my-business/report-share-ui";
import { dayMonth } from "@/components/reports/report-order-bits";
import type { PipelineRow } from "@/lib/pipeline.functions";
import { HatSkeleton } from "@/components/ui/PitchSnackLoader";

/**
 * Seller My Financials + Company Valuation as one page with two tabs. Each tab
 * is its own route so the title, breadcrumb, menu highlight and URL follow it;
 * ?company= keeps the company across tabs and reloads.
 */
type Kind = "financials" | "valuation";
const ROUTE: Record<Kind, "/my-financials" | "/my-valuation"> = { financials: "/my-financials", valuation: "/my-valuation" };
const REPORT: Record<Kind, string> = { financials: "verified financial report", valuation: "estimated valuation" };
const TILE_COLOURS = ["#2563EB", "#0F766E", "#B45309", "#7C3AED", "#BE123C", "#0369A1"];

const PILL = {
  ready: { bg: "#ECFDF3", fg: "#15803D", dot: "#16A34A", label: "Ready" },
  preparing: { bg: "#FFFBEB", fg: "#B45309", dot: "#F59E0B", label: "Being prepared" },
  none: { bg: "#F3F4F6", fg: "#4B5563", dot: "#C4C9D2", label: "Not ordered" },
} as const;

function Pill({ s, small, bg }: { s: ReportStatus["status"]; small?: boolean; bg?: string }) {
  const p = PILL[s];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 font-semibold ${small ? "h-5 text-[11px]" : "h-[22px] text-[11.5px]"}`}
      style={{ background: bg ?? p.bg, color: p.fg }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.fg }} />
      {p.label}
    </span>
  );
}

function Tile({ c, index }: { c: MyReportCompany; index: number }) {
  const initials = c.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <span className="grid h-[30px] w-[30px] shrink-0 place-items-center overflow-hidden rounded-[8px] text-[11px] font-bold text-white"
      style={{ background: c.logoUrl ? "#FFFFFF" : TILE_COLOURS[index % TILE_COLOURS.length] }}>
      {c.logoUrl ? <img src={c.logoUrl} alt="" className="h-full w-full object-contain" /> : initials}
    </span>
  );
}

function subtitle(c: MyReportCompany, kind: Kind) {
  const s = c[kind];
  if (s.status === "ready") return `${c.name} · ${REPORT[kind]} delivered ${dayMonth(s.at)}`;
  if (s.status === "preparing") return `${c.name} · ${REPORT[kind]} ordered ${dayMonth(s.at)}, being prepared`;
  return `${c.name} · ${REPORT[kind]} not ordered yet`;
}

function Switcher({ companies, selected, kind, onPick }: { companies: MyReportCompany[]; selected: MyReportCompany; kind: Kind; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const btn = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const single = companies.length < 2;
  const selIdx = companies.findIndex((c) => c.id === selected.id);

  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, selIdx));
    box.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (box.current?.contains(e.target as Node) || btn.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, selIdx]);

  const pick = (id: string) => { setOpen(false); btn.current?.focus(); if (id !== selected.id) onPick(id); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(companies.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(companies[active].id); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); btn.current?.focus(); }
  };

  return (
    <div className="relative flex flex-col items-end max-md:w-full max-md:items-stretch">
      <span className="mb-[5px] text-right text-[11px] font-semibold uppercase tracking-[.07em] text-[#9CA3AF]">Company</span>
      <button ref={btn} type="button" aria-haspopup="listbox" aria-expanded={open} disabled={single && false}
        onClick={() => !single && setOpen(!open)}
        className={`flex h-[46px] min-w-[300px] items-center gap-2.5 rounded-[11px] border bg-white pl-2 pr-3 text-left shadow-[0_1px_2px_rgba(16,24,40,.04)] max-md:w-full ${open ? "border-[#9CA3AF] ring-[3px] ring-[rgba(17,24,39,.06)]" : "border-[#DCDFE5] hover:border-[#C7CBD4]"} ${single ? "cursor-default" : ""}`}>
        <Tile c={selected} index={Math.max(0, selIdx)} />
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[#111827]">{selected.name}</span>
        <Pill s={selected[kind].status} />
        {!single && <ChevronDown className={`h-4 w-4 shrink-0 text-[#6B7280] transition-transform ${open ? "rotate-180" : ""}`} />}
      </button>
      {open && (
        <div ref={box} role="listbox" tabIndex={-1} aria-label="Your companies" aria-activedescendant={`co-${companies[active]?.id}`} onKeyDown={onKey}
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-[440px] max-w-[calc(100vw-32px)] rounded-[14px] border border-[#E5E7EB] bg-white p-1.5 shadow-[0_18px_40px_rgba(16,24,40,.16)] focus:outline-none max-md:w-full">
          <div className="px-2.5 pb-1.5 pt-2 text-[10.5px] font-bold uppercase text-[#9CA3AF]">Your companies</div>
          {companies.map((c, i) => {
            const sel = c.id === selected.id;
            return (
              <div key={c.id} id={`co-${c.id}`} role="option" aria-selected={sel} onClick={() => pick(c.id)} onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-[11px] rounded-[10px] px-2.5 py-[9px] ${sel ? "bg-[#F2F3F6]" : i === active ? "bg-[#F7F8FA]" : "hover:bg-[#F7F8FA]"}`}>
                <Tile c={c} index={i} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold text-[#111827]">{c.name}</div>
                  <div className="mt-0.5 grid gap-x-3 text-[12px] text-[#6B7280] [grid-template-columns:164px_auto]">
                    {(["financials", "valuation"] as Kind[]).map((k) => (
                      <span key={k} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: PILL[c[k].status].dot }} />
                        {k === "financials" ? "Financials" : "Valuation"}: {PILL[c[k].status].label}
                      </span>
                    ))}
                  </div>
                </div>
                <Check className={`h-4 w-4 shrink-0 text-[#111827] ${sel ? "" : "invisible"}`} />
              </div>
            );
          })}
          <div className="mt-1 border-t border-[#F0F1F4] px-2.5 pb-1.5 pt-2 text-[12px] text-[#6B7280]">Next time, this page opens the company you pick.</div>
        </div>
      )}
    </div>
  );
}

function Tabs({ kind, company, onChange }: { kind: Kind; company: MyReportCompany; onChange: (k: Kind) => void }) {
  const tabs: { k: Kind; label: string; Icon: typeof FileBarChart }[] = [
    { k: "financials", label: "Financial report", Icon: FileBarChart },
    { k: "valuation", label: "Estimated valuation", Icon: Calculator },
  ];
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); onChange(kind === "financials" ? "valuation" : "financials"); }
  };
  return (
    <div role="tablist" onKeyDown={onKey} className="inline-flex gap-1 rounded-[10px] border border-[#E3E8F0] bg-[#F1F4F9] p-[5px]">
      {tabs.map(({ k, label, Icon }) => {
        const on = k === kind;
        const s = company[k].status;
        return (
          <button key={k} id={`tab-${k}`} type="button" role="tab" aria-selected={on} aria-controls="my-reports-panel" tabIndex={on ? 0 : -1}
            onClick={() => onChange(k)}
            className={`flex h-[38px] items-center gap-2 whitespace-nowrap rounded-[7px] pl-[14px] pr-3 text-[13px] font-medium ${on
              ? "bg-[#F6A823] text-[#0E162F] shadow-[inset_0_0_0_1px_#DD971F,0_1px_2px_rgba(15,23,42,.10)]"
              : "text-[#5B6576] hover:bg-[#E6EBF3] hover:text-[#0F1B33]"}`}>
            <Icon className="h-[15px] w-[15px]" />
            {label}
            {s !== "ready" && <Pill s={s} small bg={on ? "rgba(255,255,255,.8)" : s === "none" ? "#FFFFFF" : undefined} />}
          </button>
        );
      })}
    </div>
  );
}

export function MyReportsPage({ kind, company: linked, from }: { kind: Kind; company?: string; from?: string }) {
  const fnState = useServerFn(getMyReportsState);
  const fnSave = useServerFn(saveMyReportsPrefs);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["my-reports-state"], queryFn: () => fnState() });
  const [popOpen, setPopOpen] = useState(false);
  const [win, setWin] = useState<{ p: PipelineRow; mode: "share" | "manage" } | null>(null);
  const [hiddenLocal, setHiddenLocal] = useState<boolean | null>(null);
  const shareBtn = useRef<HTMLButtonElement>(null);

  if (isLoading || !data) return <div className="p-6"><HatSkeleton lines={5} headMessage="Loading your reports…" delay={0} /></div>;
  const companies = data.companies;
  if (!companies.length) {
    return (
      <div className="p-4 md:p-7">
        <h1 className="text-[26px] font-bold tracking-tight">{kind === "financials" ? "My Financials" : "Company Valuation"}</h1>
        <p className="mt-2 text-[13.5px] text-muted-foreground">Add your company first to order its reports.</p>
      </div>
    );
  }

  const byId = (id?: string | null) => companies.find((c) => c.id === id);
  const latestDelivered = [...companies].filter((c) => c[kind].status === "ready").sort((a, b) => String(b[kind].at).localeCompare(String(a[kind].at)))[0];
  const company = byId(linked) ?? byId(data.lastCompanyId) ?? latestDelivered ?? companies[0];
  const panelHidden = hiddenLocal ?? data.sharePanelHidden;
  const ready = company[kind].status === "ready";
  const deliveredDates = { financialsAt: company.financials.status === "ready" ? company.financials.at : null, valuationAt: company.valuation.status === "ready" ? company.valuation.at : null };
  const showNotice = from === "notification" && linked === company.id;

  const goTab = (k: Kind) => navigate({ to: ROUTE[k], search: { company: company.id } as never });
  const pickCompany = async (id: string) => {
    const c = byId(id)!;
    navigate({ to: ROUTE[kind], search: { company: id } as never, replace: true });
    toast.success(`Showing ${c.name}. This page opens it next time.`);
    try { await fnSave({ data: { lastCompanyId: id } }); qc.invalidateQueries({ queryKey: ["my-reports-state"] }); } catch (e) { toast.error((e as Error).message); }
  };
  const setPanel = async (hidden: boolean) => {
    setHiddenLocal(hidden);
    if (hidden) {
      toast.success("Closed. Share with a buyer stays next to the tabs.");
      setTimeout(() => shareBtn.current?.focus(), 0);
    } else setPopOpen(false);
    try { await fnSave({ data: { sharePanelHidden: hidden } }); qc.invalidateQueries({ queryKey: ["my-reports-state"] }); } catch { /* keep local */ }
  };
  const openWindow = (p: PipelineRow, mode: "share" | "manage") => { setPopOpen(false); setWin({ p, mode }); };

  const button = (
    <ShareButton startupId={company.id} open={popOpen} setOpen={setPopOpen} panelHidden={panelHidden}
      onShowOnPage={() => setPanel(false)} onOpenWindow={openWindow} buttonRef={shareBtn} />
  );

  return (
    <div className="font-sans" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div className="px-4 pt-4 md:px-7 md:pt-7">
        {showNotice && (
          <div className="mb-3 flex items-center gap-2 rounded-[10px] border border-[#BBF7D0] bg-[#F0FDF4] px-3.5 py-[9px] text-[13px] text-[#166534]">
            <Check className="h-4 w-4 shrink-0 text-[#16A34A]" />
            Opened from your notification: “Your {REPORT[kind]} for {company.name} is ready.”
          </div>
        )}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">My Workspace</div>
            <h1 className="text-[26px] font-bold tracking-tight">{kind === "financials" ? "My Financials" : "Company Valuation"}</h1>
            <p className="text-[13.5px] text-muted-foreground">{subtitle(company, kind)}</p>
          </div>
          <Switcher companies={companies} selected={company} kind={kind} onPick={pickCompany} />
        </div>
        <div className="mb-4 mt-4 flex flex-wrap items-center justify-between gap-3">
          <Tabs kind={kind} company={company} onChange={goTab} />
          {ready && panelHidden && button}
        </div>
        {ready && !panelHidden && (
          <SharePanel startupId={company.id} onClose={() => setPanel(true)} onOpenPopover={() => setPopOpen(true)} anchor={button} />
        )}
      </div>
      <div id="my-reports-panel" role="tabpanel" aria-labelledby={`tab-${kind}`} className="px-4 pb-6 md:px-7">
        <LockedReportPage key={`${kind}-${company.id}`} kind={kind} companyId={company.id} embedded onGoFinancials={() => goTab("financials")} />
      </div>
      {win && (
        <ShareAccessDialog p={win.p} mode={win.mode} delivered={deliveredDates}
          onClose={() => setWin(null)}
          onDone={(r) => setTimeout(() => {
            const sel = r === "revoked" ? `[data-share="${win.p.id}"]` : `[data-manage="${win.p.id}"]`;
            if (r !== "shared") { setPopOpen(true); setTimeout(() => document.querySelector<HTMLElement>(sel)?.focus(), 50); }
          }, 0)} />
      )}
    </div>
  );
}
