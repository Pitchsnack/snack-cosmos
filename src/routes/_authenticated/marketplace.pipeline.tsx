import { ContactRequestsSection } from "@/components/pipeline/contact-requests";
import { ShareAccessDialog } from "@/components/my-business/report-share-ui";
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RequestLoiDialog, SendLoiDialog } from "@/components/pipeline/send-loi-dialog";
import { useServerFn } from "@tanstack/react-start";
import { useAdvisorContactRow } from "@/components/pipeline/advisor-bits";
import { Check, ChevronDown, ChevronRight, Columns3, Lock } from "lucide-react";

// Open/closed Tracking cards persist across tab/role switches; reset on reload.
let sessionOpen = new Set<string>();
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { usePersona } from "@/hooks/use-marketplace";
import { useTranslation } from "@/i18n/language";
import {
  listPipeline, decideNda, shareReport, revokeReportShare, askForReport, sendLoi, withdrawLoiRequest, shareStep, pipelineEvents,
  type PipelineRow,
} from "@/lib/pipeline.functions";
import { STEPS, currentStep, isPending, waitState } from "@/lib/pipeline-state";
import { ReportViewer, CompareReports, InvestorProfile, SellerProfile, NdaDialog, LoiDialog as LoiDocDialog } from "@/components/pipeline/pipeline-dialogs";
import { Tooltip as TT, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
const Tooltip = ({ children }: { children: React.ReactNode }) => <TooltipProvider delayDuration={200}><TT>{children}</TT></TooltipProvider>;

type T = (s: string) => string;

export const Route = createFileRoute("/_authenticated/marketplace/pipeline")({
  head: () => ({
    meta: [
      { title: "Pipeline · PitchSnack Marketplace" },
      { name: "description", content: "Every buyer working on your sale, from NDA request to offer." },
      { property: "og:title", content: "Pipeline · PitchSnack Marketplace" },
      { property: "og:description", content: "Track NDA requests, letters of intent and deal steps with each buyer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PipelinePage,
});

export function money(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 1e9) return `฿${+(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `฿${+(n / 1e6).toFixed(1)}M`;
  return `฿${n.toLocaleString()}`;
}
function day(s: string | null) {
  return s ? new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short" }).replace("Sept", "Sep") : "—";
}
function initials(s: string) {
  return s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
}
function Avatar({ name, tone = "violet", logoUrl }: { name: string; tone?: "violet" | "orange"; logoUrl?: string | null }) {
  const [broken, setBroken] = useState(false);
  if (logoUrl && !broken) {
    return (
      <img
        src={logoUrl}
        alt={name}
        onError={() => setBroken(true)}
        className="h-11 w-11 shrink-0 rounded-[10px] border border-border bg-white object-contain"
      />
    );
  }
  return (
    <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-[10px] text-[15px] font-bold text-white",
      tone === "violet" ? "bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9]" : "bg-gradient-to-br from-[#fb923c] to-[#ea580c]")}>
      {initials(name)}
    </div>
  );
}
function Pill({ children, tone }: { children: React.ReactNode; tone: "blue" | "green" | "amber" | "gray" }) {
  const c = { blue: "bg-info/10 text-info", green: "bg-success/15 text-success", amber: "bg-warning/20 text-accent-dark", gray: "bg-muted text-muted-foreground" }[tone];
  return <span className={cn("inline-flex h-[22px] items-center rounded-full px-2 text-[12px] font-semibold", c)}>{children}</span>;
}

function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["pipeline"] });
}

function PipelinePage() {
  const { persona } = usePersona();
  const { t } = useTranslation();
  const fn = useServerFn(listPipeline);
  const { data = [], isLoading } = useQuery({ queryKey: ["pipeline", persona], queryFn: () => fn({ data: { as: persona } }) });
  const pending = data.filter(isPending);
  const tracking = data.filter((p) => !!p.ndaApprovedAt);
  const [tab, setTab] = useState<"pending" | "tracking">("pending");
  const [openIds, setOpenIdsState] = useState<string[]>(() => [...sessionOpen]);
  const setOpenIds = (ids: string[]) => { sessionOpen = new Set(ids); setOpenIdsState(ids); };
  const toggle = (id: string) => setOpenIds(openIds.includes(id) ? openIds.filter((x) => x !== id) : [...openIds, id]);
  const allOpen = tracking.length > 0 && tracking.every((p) => openIds.includes(p.id));
  useEffect(() => {
    const deal = new URLSearchParams(window.location.search).get("deal");
    if (!deal || !tracking.some((p) => p.id === deal)) return;
    setTab("tracking");
    if (!sessionOpen.has(deal)) setOpenIds([...sessionOpen, deal]);
    setTimeout(() => document.getElementById(`deal-${deal}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracking.length]);
  const seller = persona === "seller";
  const waiting = seller ? pending.length : data.filter((p) => p.ndaApprovedAt && !p.reportSharedAt && !p.reportRequestedAt).length;

  return (
    <div className="mx-auto max-w-[1180px] space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-link">{t("My workspace")}</div>
          <h1 className="mt-2 text-[30px] font-bold leading-tight">{t("My Pipeline")}</h1>
          <p className="mt-2 max-w-[560px] text-muted-foreground">
            {t("Find Investors Aligned With Your Business: 1 decision is waiting for you.")}
          </p>
        </div>
        {seller && data[0] && (
          <Button asChild variant="outline"><Link to="/marketplace/browse" search={{ company: data[0].hiddenProfileId }}>{t("Open my listing")}</Link></Button>
        )}
      </div>

      {seller && <SellerStats rows={data} waiting={waiting} t={t} />}

      {(persona === "seller" || persona === "buyer") && <ContactRequestsSection as={persona} />}

      <div className="flex gap-1 border-b">
        {([["pending", t("Pending approval"), pending.length], ["tracking", t("Tracking"), tracking.length]] as const).map(([k, label, n]) => (
          <button key={k} onClick={() => setTab(k)}
            className={cn("-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-[15px] font-semibold",
              tab === k ? "border-link text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {label}
            <span className={cn("rounded-full px-1.5 text-[11px] font-bold",
              k === "pending" && n > 0 ? "bg-[#FEE2E2] text-[#B91C1C]" : "bg-muted text-muted-foreground")}>{n}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">{t("Loading…")}</div>
      ) : tab === "pending" ? (
        seller ? <SellerPending rows={pending} t={t} /> : <BuyerPending rows={pending} t={t} />
      ) : (
        <TrackingList tracking={tracking} seller={seller} openIds={openIds} setOpenIds={setOpenIds} toggle={toggle} allOpen={allOpen} t={t} />
      )}
    </div>
  );
}

function TrackingList({ tracking, seller, openIds, setOpenIds, toggle, allOpen, t }: {
  tracking: PipelineRow[]; seller: boolean; openIds: string[]; setOpenIds: (ids: string[]) => void; toggle: (id: string) => void; allOpen: boolean; t: T;
}) {
  const [filter, setFilter] = useState<"all" | "you" | "other">("all");
  const [sort, setSort] = useState<"step" | "recent">("step");
  const [compare, setCompare] = useState(false);
  const [viewing, setViewing] = useState<PipelineRow | null>(null);
  const you = tracking.filter((p) => waitState(p, seller).onYou);
  const other = tracking.filter((p) => !waitState(p, seller).onYou);
  const list = (filter === "you" ? you : filter === "other" ? other : tracking).slice().sort((a, b) =>
    sort === "step" && currentStep(b) !== currentStep(a) ? currentStep(b) - currentStep(a) : +new Date(b.updatedAt) - +new Date(a.updatedAt));
  const received = tracking.filter((p) => p.reportSharedAt).length;
  const pills: [typeof filter, string, number][] = [["all", t("All"), tracking.length], ["you", t("Waiting on you"), you.length], ["other", seller ? t("Waiting on the buyer") : t("Waiting on the seller"), other.length]];
  const cmpBtn = (
    <button disabled={received < 2} onClick={() => setCompare(true)} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#2563EB] disabled:opacity-50">
      <Columns3 className="h-4 w-4" />{t("Compare reports")} {received}
    </button>
  );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-[10px] border border-[#E5E7EB] bg-white p-[3px]">
          {pills.map(([k, label, n]) => {
            const on = filter === k; const red = k === "you" && n > 0;
            return (
              <button key={k} onClick={() => setFilter(k)} className={cn("flex h-[30px] items-center gap-1.5 rounded-[7px] px-3 text-[13px] font-semibold", on ? "bg-[#111827] text-white" : "text-[#374151]")}>
                {label}
                <span className={cn("rounded-full px-1.5 text-[11px] font-bold",
                  red ? (on ? "bg-[#DC2626] text-white" : "bg-[#FEE2E2] text-[#B91C1C]") : on ? "bg-white/15 text-white" : "bg-[#F3F4F6] text-[#4B5563]")}>{n}</span>
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-2 text-[12.5px] text-[#6B7280]">{t("Sort")}
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-[30px] rounded-[8px] border border-[#E5E7EB] bg-white px-2 text-[12.5px] font-semibold text-[#111827]">
              <option value="step">{t("Furthest step first")}</option>
              <option value="recent">{t("Recently updated")}</option>
            </select>
          </label>
          {!seller && (received < 2
            ? <Tooltip><TooltipTrigger asChild><span tabIndex={0}>{cmpBtn}</span></TooltipTrigger><TooltipContent>{t("Available when you have 2 or more reports")}</TooltipContent></Tooltip>
            : cmpBtn)}
          {!seller && <span className="h-4 w-px bg-[#E5E7EB]" />}
          {tracking.length > 0 && (
            <button className="shrink-0 text-[12.5px] font-semibold text-[#2563EB]" onClick={() => setOpenIds(allOpen ? [] : tracking.map((p) => p.id))}>
              {allOpen ? t("Collapse all") : t("Expand all")}
            </button>
          )}
        </div>
      </div>
      {tracking.length === 0 && <Empty text={seller ? t("No buyers past the NDA yet.") : t("No seller has approved your NDA yet.")} />}
      {tracking.length > 0 && list.length === 0 && <Empty text={t("No cards match this filter.")} />}
      {list.map((p) => <TrackingCard key={p.id} p={p} seller={seller} open={openIds.includes(p.id)} onToggle={() => toggle(p.id)} t={t} />)}
      {compare && <CompareReports rows={tracking} onOpen={(p) => setViewing(p)} onClose={() => setCompare(false)} />}
      {viewing && <ReportViewer p={viewing} seller={false} onClose={() => setViewing(null)} />}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-[14px] border border-dashed bg-card py-14 text-center text-muted-foreground">{text}</div>;
}

function Tile({ label, value, sub, amber }: { label: string; value: React.ReactNode; sub: string; amber?: boolean }) {
  return (
    <div className="rounded-[14px] border bg-card p-4">
      <div className="text-[13px] font-semibold text-muted-foreground">{label}</div>
      <div className={cn("mt-3 text-[26px] font-bold leading-none", amber && "text-accent-dark")}>{value}</div>
      <div className="mt-3 text-[12.5px] font-semibold text-muted-foreground">{sub}</div>
    </div>
  );
}

function SellerStats({ rows, waiting, t }: { rows: PipelineRow[]; waiting: number; t: T }) {
  const ndaReq = rows.filter((p) => !p.ndaApprovedAt).length;
  const loiReq = rows.filter((p) => p.loiSentAt && !p.loiAcceptedAt).length;
  const approved = rows.filter((p) => p.ndaApprovedAt).length;
  const shared = rows.filter((p) => p.reportSharedAt).length;
  const best = Math.max(0, ...rows.map((p) => p.loiAmount ?? 0));
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile label={t("Waiting for you")} value={waiting} amber={waiting > 0}
        sub={`${ndaReq} ${t(ndaReq === 1 ? "NDA request" : "NDA requests")} · ${loiReq} ${t(loiReq === 1 ? "letter of intent" : "letters of intent")}`} />
      <Tile label={t("Interested buyers")} value={rows.length} sub={`${approved} ${t(approved === 1 ? "NDA signed" : "NDAs signed")}`} />
      <Tile label={t("Financial report shared with")} value={shared}
        sub={`${t("of")} ${approved} ${t(approved === 1 ? "approved buyer" : "approved buyers")} · ${t("case by case")}`} />
      <Tile label={t("Best offer")} value={best ? money(best) : "—"} sub={`${t("Asking")} ${money(rows[0]?.askingPrice)}`} />
    </div>
  );
}

function SellerPending({ rows, t }: { rows: PipelineRow[]; t: T }) {
  const [selId, setSelId] = useState<string | null>(null);
  const sel = rows.find((r) => r.id === selId) ?? rows[0];
  if (!rows.length) return <Empty text={t("Nothing is waiting for you.")} />;
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted-foreground">{t("Click a buyer to review. Nothing is shared with a buyer until you approve.")}</p>
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="space-y-2">
          {rows.map((p) => {
            const loi = !!p.ndaApprovedAt;
            return (
              <button key={p.id} onClick={() => setSelId(p.id)}
                className={cn("flex w-full items-center gap-3 rounded-[12px] border bg-card p-3 text-left",
                  sel?.id === p.id && "border-accent bg-accent/5")}>
                <Avatar name={p.counterparty.name} tone={loi ? "orange" : "violet"} logoUrl={p.counterparty.logoUrl} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{p.counterparty.name}</div>
                  <div className="text-[12.5px] font-semibold text-accent-dark">{loi ? t("Letter of intent") : t("NDA request")}</div>
                  <div className="truncate text-[12px] text-muted-foreground">{[p.counterparty.person, p.counterparty.sub, day(loi ? p.loiSentAt : p.ndaRequestedAt)].filter(Boolean).join(" · ")}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            );
          })}
        </div>
        {sel && (sel.ndaApprovedAt ? <LoiDecision p={sel} t={t} /> : <NdaDecision p={sel} t={t} />)}
      </div>
    </div>
  );
}

function PanelHead({ p, t, children }: { p: PipelineRow; t: T; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-3 border-b pb-4">
      <Avatar name={p.counterparty.name} logoUrl={p.counterparty.logoUrl} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[18px] font-bold">{p.counterparty.name}</span>
          <Pill tone="blue">{p.counterparty.sub}</Pill>
          {p.counterparty.verified && <Pill tone="green">✓ {t("Verified buyer")}</Pill>}
        </div>
        {p.counterparty.person && <div className="text-[13px] text-muted-foreground">{p.counterparty.person}</div>}
      </div>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

function NdaDecision({ p, t }: { p: PipelineRow; t: T }) {
  const decide = useServerFn(decideNda);
  const refresh = useRefresh();
  const [share, setShare] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async (approve: boolean) => {
    setBusy(true);
    try {
      await decide({ data: { id: p.id, approve, shareReport: share } });
      toast.success(approve ? t("NDA approved") : t("Request declined"));
      setConfirm(false);
      refresh();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4 rounded-[14px] border bg-card p-5">
      <PanelHead p={p} t={t}>
        <Button variant="outline" disabled={busy} onClick={() => run(false)}>{t("Decline")}</Button>
        <Button disabled={busy} onClick={() => setConfirm(true)}>{t("Approve NDA")}</Button>
      </PanelHead>
      {p.buyerMessage && (
        <div className="rounded-[10px] bg-muted/60 p-3">
          <div className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">{t("Message to you")}</div>
          <p className="mt-1 italic">“{p.buyerMessage}”</p>
        </div>
      )}
      <div>
        <div className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">{t("What approving unlocks for this buyer")}</div>
        <ul className="mt-2 grid gap-1.5 text-[13.5px] sm:grid-cols-2">
          {["Company name & logo", "Website & contacts", "Founder names", "Full profile"].map((s) => (
            <li key={s} className="flex items-center gap-2"><Check className="h-4 w-4 text-success" />{t(s)}</li>
          ))}
          <li className="flex items-center gap-2 text-muted-foreground"><Lock className="h-4 w-4" />{t("Verified financial report · only if you share it")}</li>
        </ul>
      </div>
      <label className="flex items-start gap-3 rounded-[10px] border border-accent/40 bg-accent/5 p-3">
        <Checkbox checked={share} onCheckedChange={(v) => setShare(!!v)} className="mt-0.5" />
        <span className="text-[13.5px]">
          <b>{t("Also share the verified financial report with")} {p.counterparty.name}.</b>{" "}
          {t("Case by case — you can share it later from Tracking instead. Buyers see only ranges until you do.")}
        </span>
      </label>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Approve NDA for")} {p.counterparty.name}?</DialogTitle>
            <DialogDescription>
              {t("Your company name, logo, website, contacts and founder names become visible to")} {p.counterparty.person ?? t("this buyer")}.
              {share ? ` ${t("The verified financial report is shared too.")}` : ` ${t("The verified financial report stays private.")}`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>{t("Back")}</Button>
            <Button disabled={busy} onClick={() => run(true)}>{t("Approve")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LoiDecision({ p, t }: { p: PipelineRow; t: T }) {
  const [review, setReview] = useState(false);
  return (
    <div className="space-y-4 rounded-[14px] border bg-card p-5">
      <PanelHead p={p} t={t}>
        <Button onClick={() => setReview(true)}>{t("Review LOI")}</Button>
      </PanelHead>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[[t("Indicative price"), money(p.loiAmount)], [t("Exclusivity"), `${p.loiExclusivityDays ?? 0} ${t("days")}`], [t("Your asking price"), money(p.askingPrice)]].map(([k, v]) => (
          <div key={k} className="rounded-[10px] bg-muted/60 p-3"><div className="text-[12px] text-muted-foreground">{k}</div><div className="font-bold">{v}</div></div>
        ))}
      </div>
      <p className="text-[12.5px] text-muted-foreground">{t("Read the full letter to the end and tick the box to accept. Non-binding, except exclusivity and confidentiality.")}</p>
      {review && <LoiDocDialog p={p} seller onClose={() => setReview(false)} />}
    </div>
  );
}

function BuyerPending({ rows, t }: { rows: PipelineRow[]; t: T }) {
  if (!rows.length) return <Empty text={t("Nothing is waiting on a seller.")} />;
  return (
    <div className="space-y-2">
      {rows.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-[12px] border bg-card p-3">
          <Avatar name={p.counterparty.name} tone="orange" logoUrl={p.counterparty.logoUrl} />
          <div className="min-w-0 flex-1">
            <div className="font-bold">{p.counterparty.name}</div>
            <div className="text-[12.5px] text-muted-foreground">
              {p.ndaApprovedAt
                ? `${t("Letter of intent")} ${money(p.loiAmount)} ${t("sent")} ${day(p.loiSentAt)}`
                : `${t("NDA requested")} ${day(p.ndaRequestedAt)}`} · {t("waiting for the seller")}
            </div>
          </div>
          <Pill tone="amber">{p.ndaApprovedAt ? t("LOI pending") : t("NDA pending")}</Pill>
        </div>
      ))}
    </div>
  );
}

function Stepper({ cur, t }: { cur: number; t: T }) {
  return (
    <div className="grid grid-cols-7 pt-3">
      {STEPS.map((s, i) => {
        const done = i < cur, now = i === cur;
        return (
          <div key={s} className="relative flex flex-col items-center">
            {i > 0 && <div className={cn("absolute right-1/2 top-[6px] h-[2px] w-[calc(100%-18px)] -translate-x-[9px]", i <= cur ? "bg-success" : "bg-border")} />}
            <div className={cn("relative z-10 h-[14px] w-[14px] rounded-full border-2",
              done ? "border-success bg-success" : now ? "border-accent bg-accent ring-4 ring-accent/20" : "border-border bg-card")} />
            <div className={cn("mt-2 text-center text-[12px]", now ? "font-bold text-foreground" : done ? "text-foreground" : "text-muted-foreground")}>{t(s)}</div>
          </div>
        );
      })}
    </div>
  );
}

function TrackingCard({ p, seller, open, onToggle, t }: { p: PipelineRow; seller: boolean; open: boolean; onToggle: () => void; t: T }) {
  const [loiOpen, setLoiOpen] = useState(false);
  const [reqOpen, setReqOpen] = useState(false);
  const withdrawReq = useServerFn(withdrawLoiRequest);
  const lr = p.loiRequest;
  const [histOpen, setHistOpen] = useState(false);
  const [dlg, setDlg] = useState<null | "report" | "investor" | "seller" | "nda" | "loi" | "share">(null);
  const cur = currentStep(p);
  const refresh = useRefresh();
  const fShare = useServerFn(shareReport);
  const fAsk = useServerFn(askForReport);
  const fStep = useServerFn(shareStep);
  const act = async (f: () => Promise<unknown>, msg: string) => {
    try { await f(); toast.success(msg); refresh(); } catch (e) { toast.error((e as Error).message); }
  };
  const ask = () => act(() => fAsk({ data: { id: p.id } }), `${t("Request sent to")} ${p.counterparty.name}. ${t("You will be notified when the report is shared.")}`);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const w = waitState(p, seller);
  const other = seller ? t("the buyer") : t("the seller");

  const reviewLoi = seller && !!p.loiSentAt && !p.loiAcceptedAt;
  const adv = useAdvisorContactRow(p.id, !!p.contactAt, !!p.paymentAt, t);
  const rows: [string, string | null, React.ReactNode, React.ReactNode?][] = [
    ["NDA", p.ndaApprovedAt, `${t("Approved by")} ${seller ? t("you") : t("the seller")} · ${t("requested")} ${day(p.ndaRequestedAt)}`,
      <>
        <Button size="sm" variant="outline" onClick={() => setDlg("nda")}>{t("View NDA")}</Button>
        <Button size="sm" variant="outline" onClick={() => setDlg(seller ? "investor" : "seller")}>{seller ? t("Investor profile") : t("Seller profile")}</Button>
      </>],
    ["Financial & Valuation", p.share ? p.share.sharedAt : null,
      seller ? sellerReportLine(p, t) : p.share ? `${sharedWhat(p.share, t)} ${t("received")}${p.share.allowDownload ? ` · ${t("download allowed")}` : ` · ${t("view only")}`}`
        : p.revokedAt ? `${t("The seller stopped sharing the report on")} ${day(p.revokedAt)}`
        : p.reportRequestedAt ? <><b>{t("You asked for the report on")} {day(p.reportRequestedAt)}</b> · {t("waiting for the seller")}</>
        : t("Not shared yet"),
      seller ? (p.share ? <><Button size="sm" variant="outline" onClick={() => setDlg("share")}>{t("Manage access")}</Button><Button size="sm" variant="outline" onClick={() => setDlg("report")}>{t("View report")}</Button></>
          : p.reports.financials || p.reports.valuation ? <Button size="sm" onClick={() => setDlg("share")}>{t("Share report")}</Button> : undefined)
        : p.share ? <Button size="sm" variant="outline" onClick={() => setDlg("report")}>{t("View report")}</Button>
        : !p.reportRequestedAt ? <Button size="sm" variant="outline" onClick={ask}>{t("Ask for the report")}</Button> : undefined],
    ["Letter of intent", p.loiAcceptedAt,
      p.loiAcceptedAt ? `${money(p.loiAmount)} · ${t("accepted by")} ${seller ? t("you") : t("the seller")} · ${t("exclusivity")} ${p.loiExclusivityDays ?? 0} ${t("days")}`
        : p.loiSentAt ? `${money(p.loiAmount)} · ${t("sent")} ${day(p.loiSentAt)} · ${t("waiting for")} ${seller ? t("you") : t("the seller")}`
        : lr ? (seller ? `${t("Requested")} ${day(lr.at)} · ${t("waiting for the buyer")}` : `${t("Seller requested a letter of intent")} · ${day(lr.at)}`)
        : t("No letter of intent yet"),
      reviewLoi ? <Button size="sm" onClick={() => setDlg("loi")}>{t("View / Accept LOI")}</Button>
        : p.loiSentAt ? <Button size="sm" variant="outline" onClick={() => setDlg("loi")}>{t("View LOI")}</Button>
        : !seller ? <Button size="sm" onClick={() => setLoiOpen(true)}>{t("Send letter of intent")}</Button>
        : lr ? <button type="button" className="text-[12.5px] font-semibold text-[#2563EB] hover:underline" onClick={async () => {
            try { await withdrawReq({ data: { id: p.id } }); toast.success(t("Request withdrawn")); refresh(); } catch (e) { toast.error((e as Error).message); }
          }}>{t("Withdraw request")}</button>
        : p.ndaApprovedAt ? <Button size="sm" onClick={() => setReqOpen(true)}>{t("Request letter of intent")}</Button> : undefined],
    ["Contact M&A", p.contactAt,
      adv.text, adv.action],
    ["Legal", p.legalAt, p.legalAt ? (seller ? t("Legal folder shared") : t("Legal folder received")) : t("Legal folder not shared yet"),
      seller && p.contactAt && !p.legalAt ? <Button size="sm" variant="outline" onClick={() => act(() => fStep({ data: { id: p.id, step: "legal" } }), t("Legal folder shared"))}>{t("Share documents")}</Button> : undefined],
    ["Offer & SPA", p.spaAt, p.spaAt ? (seller ? t("SPA draft shared") : t("SPA draft received")) : (seller ? t("SPA draft not shared yet") : t("SPA draft not received yet")),
      seller && p.legalAt && !p.spaAt ? <Button size="sm" variant="outline" onClick={() => act(() => fStep({ data: { id: p.id, step: "spa" } }), t("SPA draft shared"))}>{t("Share SPA draft")}</Button> : undefined],
    ["Payment", p.paymentAt, p.paymentAt ? t("Completed") : t("Not started · escrow and completion"),
      seller && p.spaAt && !p.paymentAt ? <Button size="sm" variant="outline" onClick={() => act(() => fStep({ data: { id: p.id, step: "payment" } }), t("Marked complete"))}>{t("Mark complete")}</Button> : undefined],
  ];

  return (
    <div id={`deal-${p.id}`} className={cn("overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-card transition-shadow hover:border-[#D9DCE2]", open && "shadow-[0_6px_20px_rgba(16,24,40,.06)]")}>
      <div role="button" tabIndex={0} onClick={onToggle} aria-expanded={open}
        onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onToggle(); } }}
        className="grid w-full cursor-pointer grid-cols-[40px_1fr_auto] items-center gap-[14px] px-5 pt-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563EB]">
        <div className="[&>*]:!h-10 [&>*]:!w-10 [&>*]:!text-[14px]">
          <Avatar name={p.counterparty.name} tone={seller ? "violet" : "orange"} logoUrl={p.counterparty.logoUrl} />
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
            <span className="truncate text-[16px] font-bold">{p.counterparty.name}</span>

          </div>
          <div className="truncate text-[12.5px] text-[#6B7280]">
            {[p.counterparty.sub, p.loiAmount ? `${seller ? t("offer") : t("your offer")} ${money(p.loiAmount)}` : null].filter(Boolean).join(" · ")}
            {" · "}
            <span className={cn("font-semibold", w.onYou ? "text-[#B45309]" : "text-[#6B7280]")}>
              {w.onYou && w.what === "send a letter of intent"
                ? `${t("Pending")}: ${t("send a letter of intent")}`
                : `${t("waiting on")} ${w.onYou ? t("you") : other}: ${t(w.what)}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-[14px] text-[12.5px] font-semibold text-[#6B7280]">
          {seller
            ? <button className="text-[12.5px] font-semibold text-[#2563EB] hover:underline" onClick={(e) => { stop(e); setDlg("investor"); }}>{t("Investor profile")}</button>
            : <button className="text-[12.5px] font-semibold text-[#2563EB] hover:underline" onClick={(e) => { stop(e); setDlg("seller"); }}>{t("Seller profile")}</button>}
          <span className="flex items-center gap-2">
            {open ? t("Hide details") : t("Details")}
            <span className="grid h-[30px] w-[30px] place-items-center rounded-[8px] border border-[#E5E7EB]">
              <ChevronDown className={cn("h-4 w-4 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} />
            </span>
          </span>
        </div>
      </div>
      <div className="px-5 pb-[18px] [&>*]:!mt-4"><Stepper cur={cur} t={t} /></div>
      <div className={cn("grid transition-[grid-template-rows] duration-[250ms] ease-in-out motion-reduce:transition-none", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="min-h-0 overflow-hidden" inert={!open || undefined}>
          <div className="mx-5 border-t border-[#F0F1F4]">
            {rows.map(([label, date, text, action]) => (
              <div key={label} className="grid min-h-[50px] grid-cols-[168px_72px_1fr_auto] items-center gap-4 border-b border-[#F0F1F4] py-2 text-[13.5px]">
                <div className={cn("font-semibold", date || STEPS.indexOf(label as typeof STEPS[number]) === cur ? "text-[#111827]" : "text-[#9CA3AF]")}>{t(label)}</div>
                <div className="text-muted-foreground">{day(date)}</div>
                <div className="text-[#374151]">{text}</div>
                <div className="flex justify-end gap-2 [&_button]:h-8">{action}</div>
              </div>
            ))}
          </div>
          <div className="flex justify-end px-5 pb-4 pt-2.5">
            <button className="text-[12.5px] font-semibold text-[#2563EB]" onClick={() => setHistOpen(true)}>{t("History")}</button>
          </div>
        </div>
      </div>
      {adv.dialogs}
      {loiOpen && <SendLoiDialog id={p.id} request={lr} onClose={() => setLoiOpen(false)} onSent={refresh} />}
      {reqOpen && <RequestLoiDialog id={p.id} onClose={() => setReqOpen(false)} onSent={refresh} />}
      {histOpen && <HistoryDialog id={p.id} other={other} onClose={() => setHistOpen(false)} t={t} />}
      {dlg === "report" && <ReportViewer p={p} seller={seller} onClose={() => setDlg(null)} />}
      {dlg === "share" && <ShareAccessDialog p={p} mode={p.share ? "manage" : "share"} onClose={() => setDlg(null)} onDone={refresh} />}
      {dlg === "investor" && <InvestorProfile p={p} onClose={() => setDlg(null)} onNda={() => setDlg("nda")} onLoi={() => setDlg("loi")} />}
      {dlg === "seller" && <SellerProfile p={p} onClose={() => setDlg(null)} onNda={() => setDlg("nda")} onLoi={() => setDlg("loi")} onReport={() => setDlg("report")} onAsk={() => { setDlg(null); ask(); }} />}
      {dlg === "nda" && <NdaDialog p={p} seller={seller} onClose={() => setDlg(null)} />}
      {dlg === "loi" && <LoiDocDialog p={p} seller={seller} onClose={() => setDlg(null)} />}
    </div>
  );
}

const EVENT_LABEL: Record<string, string> = {
  nda_requested: "NDA requested", nda_approved: "NDA approved", nda_declined: "NDA declined",
  report_requested: "Financial report requested", report_shared: "Report shared", report_share_changed: "Report sharing changed", report_revoked: "Seller stopped sharing the report",
  loi_sent: "Letter of intent sent", loi_accepted: "Letter of intent accepted", loi_declined: "Letter of intent declined", loi_changes_requested: "Changes to the letter of intent requested", loi_requested: "Seller requested a letter of intent", loi_request_withdrawn: "Letter of intent request withdrawn", loi_request_fulfilled: "Letter of intent request answered", report_viewed: "Financial report opened",
  legal_shared: "Legal folder shared", spa_shared: "SPA draft shared", payment_shared: "Payment completed",
};

function HistoryDialog({ id, onClose, t }: { id: string; other: string; onClose: () => void; t: T }) {
  const f = useServerFn(pipelineEvents);
  const { data = [] } = useQuery({ queryKey: ["pipeline", "events", id], queryFn: () => f({ data: { id } }) });
  const list = useMemo(() => data as { event: string; created_at: string }[], [data]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("History")}</DialogTitle></DialogHeader>
        <ul className="divide-y">
          {list.map((e, i) => (
            <li key={i} className="flex justify-between py-2 text-sm">
              <span>{EVENT_LABEL[e.event] ? t(EVENT_LABEL[e.event]) : e.event}</span>
              <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
            </li>
          ))}
          {list.length === 0 && <li className="py-4 text-center text-muted-foreground">{t("No events yet.")}</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

const sharedWhat = (s: { financials: boolean; valuation: boolean }, t: T) =>
  s.financials && s.valuation ? t("Financial report + valuation") : s.financials ? t("Verified financial report") : t("Estimated valuation");

function sellerReportLine(p: PipelineRow, t: T) {
  if (p.share) return `${sharedWhat(p.share, t)} ${t("shared")} ${day(p.share.sharedAt)} · ${p.share.allowDownload ? t("download allowed") : t("view only")}${p.reportViewedAt ? ` · ${t("opened")} ${day(p.reportViewedAt)}` : ` · ${t("not opened yet")}`}`;
  if (!p.reports.financials && !p.reports.valuation) return <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Lock className="h-3.5 w-3.5" />{t("Your report isn't ready yet — PitchSnack will let you know")}</span>;
  if (p.revokedAt) return `${t("You stopped sharing on")} ${day(p.revokedAt)}`;
  return p.reportRequestedAt ? `${t("Requested by the buyer")} ${day(p.reportRequestedAt)} · ${t("not shared")}` : t("Not shared yet");
}
