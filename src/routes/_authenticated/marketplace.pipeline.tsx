import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronRight, Lock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { usePersona } from "@/hooks/use-marketplace";
import {
  listPipeline, decideNda, decideLoi, shareReport, askForReport, sendLoi, shareStep, pipelineEvents,
  type PipelineRow,
} from "@/lib/pipeline.functions";

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

const STEPS = ["NDA", "Financial & Valuation", "Letter of intent", "Contact M&A", "Legal", "Offer & SPA", "Payment"] as const;

function stepDates(p: PipelineRow) {
  return [p.ndaApprovedAt, p.reportSharedAt, p.loiAcceptedAt, p.contactAt, p.legalAt, p.spaAt, p.paymentAt];
}
function currentStep(p: PipelineRow) {
  const d = stepDates(p);
  const i = d.findIndex((x) => !x);
  return i === -1 ? STEPS.length : i;
}
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
function isPending(p: PipelineRow) {
  return !p.ndaApprovedAt || (!!p.loiSentAt && !p.loiAcceptedAt);
}

function Avatar({ name, tone = "violet", logoUrl }: { name: string; tone?: "violet" | "orange"; logoUrl?: string | null }) {
  const [broken, setBroken] = React.useState(false);
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
  const fn = useServerFn(listPipeline);
  const { data = [], isLoading } = useQuery({ queryKey: ["pipeline", persona], queryFn: () => fn({ data: { as: persona } }) });
  const pending = data.filter(isPending);
  const tracking = data.filter((p) => !!p.ndaApprovedAt);
  const [tab, setTab] = useState<"pending" | "tracking">("pending");
  const seller = persona === "seller";
  const waiting = seller ? pending.length : data.filter((p) => p.ndaApprovedAt && !p.reportSharedAt && !p.reportRequestedAt).length;

  return (
    <div className="mx-auto max-w-[1180px] space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-link">My workspace</div>
          <h1 className="mt-2 text-[30px] font-bold leading-tight">My Pipeline</h1>
          <p className="mt-2 max-w-[560px] text-muted-foreground">
            Find Investors Aligned With Your Business: 1 decision is waiting for you.
          </p>
        </div>
        {seller && data[0] && (
          <Button asChild variant="outline"><Link to="/marketplace/browse" search={{ company: data[0].hiddenProfileId }}>Open my listing</Link></Button>
        )}
      </div>

      {seller && <SellerStats rows={data} waiting={waiting} />}

      <div className="flex gap-1 border-b">
        {([["pending", "Pending approval", pending.length], ["tracking", "Tracking", tracking.length]] as const).map(([k, label, n]) => (
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
        <div className="py-16 text-center text-muted-foreground">Loading…</div>
      ) : tab === "pending" ? (
        seller ? <SellerPending rows={pending} /> : <BuyerPending rows={pending} />
      ) : (
        <div className="space-y-4">
          <p className="text-[13px] text-muted-foreground">One card per {seller ? "buyer" : "business"}. Each step is a document shared, so both sides see the same record.</p>
          {tracking.length === 0 && <Empty text={seller ? "No buyers past the NDA yet." : "No seller has approved your NDA yet."} />}
          {tracking.map((p, i) => <TrackingCard key={p.id} p={p} seller={seller} defaultOpen={i === 0} />)}
        </div>
      )}
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

function SellerStats({ rows, waiting }: { rows: PipelineRow[]; waiting: number }) {
  const ndaReq = rows.filter((p) => !p.ndaApprovedAt).length;
  const loiReq = rows.filter((p) => p.loiSentAt && !p.loiAcceptedAt).length;
  const approved = rows.filter((p) => p.ndaApprovedAt).length;
  const shared = rows.filter((p) => p.reportSharedAt).length;
  const best = Math.max(0, ...rows.map((p) => p.loiAmount ?? 0));
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile label="Waiting for you" value={waiting} amber={waiting > 0} sub={`${ndaReq} NDA request${ndaReq === 1 ? "" : "s"} · ${loiReq} letter${loiReq === 1 ? "" : "s"} of intent`} />
      <Tile label="Interested buyers" value={rows.length} sub={`${approved} NDA${approved === 1 ? "" : "s"} signed`} />
      <Tile label="Financial report shared with" value={shared} sub={`of ${approved} approved buyer${approved === 1 ? "" : "s"} · case by case`} />
      <Tile label="Best offer" value={best ? money(best) : "—"} sub={`Asking ${money(rows[0]?.askingPrice)}`} />
    </div>
  );
}

function SellerPending({ rows }: { rows: PipelineRow[] }) {
  const [selId, setSelId] = useState<string | null>(null);
  const sel = rows.find((r) => r.id === selId) ?? rows[0];
  if (!rows.length) return <Empty text="Nothing is waiting for you." />;
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted-foreground">Click a buyer to review. Nothing is shared with a buyer until you approve.</p>
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="space-y-2">
          {rows.map((p) => {
            const loi = !!p.ndaApprovedAt;
            return (
              <button key={p.id} onClick={() => setSelId(p.id)}
                className={cn("flex w-full items-center gap-3 rounded-[12px] border bg-card p-3 text-left",
                  sel?.id === p.id && "border-accent bg-accent/5")}>
                <Avatar name={p.counterparty.name} tone={loi ? "orange" : "violet"} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{p.counterparty.name}</div>
                  <div className="text-[12.5px] font-semibold text-accent-dark">{loi ? "Letter of intent" : "NDA request"}</div>
                  <div className="truncate text-[12px] text-muted-foreground">{[p.counterparty.person, p.counterparty.sub, day(loi ? p.loiSentAt : p.ndaRequestedAt)].filter(Boolean).join(" · ")}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            );
          })}
        </div>
        {sel && (sel.ndaApprovedAt ? <LoiDecision p={sel} /> : <NdaDecision p={sel} />)}
      </div>
    </div>
  );
}

function PanelHead({ p, children }: { p: PipelineRow; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-3 border-b pb-4">
      <Avatar name={p.counterparty.name} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[18px] font-bold">{p.counterparty.name}</span>
          <Pill tone="blue">{p.counterparty.sub}</Pill>
          {p.counterparty.verified && <Pill tone="green">✓ Verified buyer</Pill>}
        </div>
        {p.counterparty.person && <div className="text-[13px] text-muted-foreground">{p.counterparty.person}</div>}
      </div>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

function NdaDecision({ p }: { p: PipelineRow }) {
  const decide = useServerFn(decideNda);
  const refresh = useRefresh();
  const [share, setShare] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async (approve: boolean) => {
    setBusy(true);
    try {
      await decide({ data: { id: p.id, approve, shareReport: share } });
      toast.success(approve ? "NDA approved" : "Request declined");
      setConfirm(false);
      refresh();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4 rounded-[14px] border bg-card p-5">
      <PanelHead p={p}>
        <Button variant="outline" disabled={busy} onClick={() => run(false)}>Decline</Button>
        <Button disabled={busy} onClick={() => setConfirm(true)}>Approve NDA</Button>
      </PanelHead>
      {p.buyerMessage && (
        <div className="rounded-[10px] bg-muted/60 p-3">
          <div className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Message to you</div>
          <p className="mt-1 italic">“{p.buyerMessage}”</p>
        </div>
      )}
      <div>
        <div className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">What approving unlocks for this buyer</div>
        <ul className="mt-2 grid gap-1.5 text-[13.5px] sm:grid-cols-2">
          {["Company name & logo", "Website & contacts", "Founder names", "Full profile"].map((t) => (
            <li key={t} className="flex items-center gap-2"><Check className="h-4 w-4 text-success" />{t}</li>
          ))}
          <li className="flex items-center gap-2 text-muted-foreground"><Lock className="h-4 w-4" />Verified financial report · only if you share it</li>
        </ul>
      </div>
      <label className="flex items-start gap-3 rounded-[10px] border border-accent/40 bg-accent/5 p-3">
        <Checkbox checked={share} onCheckedChange={(v) => setShare(!!v)} className="mt-0.5" />
        <span className="text-[13.5px]"><b>Also share the verified financial report with {p.counterparty.name}.</b> Case by case — you can share it later from Tracking instead. Buyers see only ranges until you do.</span>
      </label>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve NDA for {p.counterparty.name}?</DialogTitle>
            <DialogDescription>
              Your company name, logo, website, contacts and founder names become visible to {p.counterparty.person ?? "this buyer"}.
              {share ? " The verified financial report is shared too." : " The verified financial report stays private."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>Back</Button>
            <Button disabled={busy} onClick={() => run(true)}>Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LoiDecision({ p }: { p: PipelineRow }) {
  const decide = useServerFn(decideLoi);
  const refresh = useRefresh();
  const [busy, setBusy] = useState(false);
  const run = async (accept: boolean) => {
    setBusy(true);
    try { await decide({ data: { id: p.id, accept } }); toast.success(accept ? "Letter of intent accepted" : "Letter of intent declined"); refresh(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4 rounded-[14px] border bg-card p-5">
      <PanelHead p={p}>
        <Button variant="outline" disabled={busy} onClick={() => run(false)}>Decline</Button>
        <Button disabled={busy} onClick={() => run(true)}>Accept LOI</Button>
      </PanelHead>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[["Indicative price", money(p.loiAmount)], ["Exclusivity", `${p.loiExclusivityDays ?? 0} days`], ["Your asking price", money(p.askingPrice)]].map(([k, v]) => (
          <div key={k} className="rounded-[10px] bg-muted/60 p-3"><div className="text-[12px] text-muted-foreground">{k}</div><div className="font-bold">{v}</div></div>
        ))}
      </div>
      {p.loiConditions && <div><div className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Conditions</div><p className="mt-1 text-[13.5px]">{p.loiConditions}</p></div>}
      <div>
        <div className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Accepting means</div>
        <ul className="mt-2 space-y-1.5 text-[13.5px]">
          {["Contacts exchanged both ways", `Exclusivity clock starts (${p.loiExclusivityDays ?? 0} days)`].map((t) => (
            <li key={t} className="flex items-center gap-2"><Check className="h-4 w-4 text-success" />{t}</li>
          ))}
        </ul>
        <p className="mt-2 text-[12.5px] text-muted-foreground">Non-binding. The log keeps the record.</p>
      </div>
    </div>
  );
}

function BuyerPending({ rows }: { rows: PipelineRow[] }) {
  if (!rows.length) return <Empty text="Nothing is waiting on a seller." />;
  return (
    <div className="space-y-2">
      {rows.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-[12px] border bg-card p-3">
          <Avatar name={p.counterparty.name} tone="orange" />
          <div className="min-w-0 flex-1">
            <div className="font-bold">{p.counterparty.name}</div>
            <div className="text-[12.5px] text-muted-foreground">
              {p.ndaApprovedAt ? `Letter of intent ${money(p.loiAmount)} sent ${day(p.loiSentAt)}` : `NDA requested ${day(p.ndaRequestedAt)}`} · waiting for the seller
            </div>
          </div>
          <Pill tone="amber">{p.ndaApprovedAt ? "LOI pending" : "NDA pending"}</Pill>
        </div>
      ))}
    </div>
  );
}

function Stepper({ cur }: { cur: number }) {
  return (
    <div className="grid grid-cols-7 pt-3">
      {STEPS.map((s, i) => {
        const done = i < cur, now = i === cur;
        return (
          <div key={s} className="relative flex flex-col items-center">
            {i > 0 && <div className={cn("absolute right-1/2 top-[6px] h-[2px] w-[calc(100%-18px)] -translate-x-[9px]", i <= cur ? "bg-success" : "bg-border")} />}
            <div className={cn("relative z-10 h-[14px] w-[14px] rounded-full border-2",
              done ? "border-success bg-success" : now ? "border-accent bg-accent ring-4 ring-accent/20" : "border-border bg-card")} />
            <div className={cn("mt-2 text-center text-[12px]", now ? "font-bold text-foreground" : done ? "text-foreground" : "text-muted-foreground")}>{s}</div>
          </div>
        );
      })}
    </div>
  );
}

function TrackingCard({ p, seller, defaultOpen }: { p: PipelineRow; seller: boolean; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [loiOpen, setLoiOpen] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const cur = currentStep(p);
  const refresh = useRefresh();
  const fShare = useServerFn(shareReport);
  const fAsk = useServerFn(askForReport);
  const fStep = useServerFn(shareStep);
  const act = async (f: () => Promise<unknown>, msg: string) => {
    try { await f(); toast.success(msg); refresh(); } catch (e) { toast.error((e as Error).message); }
  };
  const reportPill = p.reportSharedAt
    ? <Pill tone="green">{seller ? "shared" : "received"}</Pill>
    : <Pill tone="gray">{seller ? "not shared" : "not received"}</Pill>;
  const waitingOn = seller
    ? (!p.reportSharedAt && p.reportRequestedAt ? "asked for the financial report" : cur === 4 && !p.legalAt ? "waiting on you: legal folder" : null)
    : (!p.loiSentAt && p.ndaApprovedAt ? "send a letter of intent when ready" : "nothing needed from you");
  const other = seller ? "the buyer" : "the seller";

  const rows: [string, string | null, string, React.ReactNode?][] = [
    ["NDA", p.ndaApprovedAt, `Approved by ${seller ? "you" : "the seller"} · requested ${day(p.ndaRequestedAt)}`],
    ["Financial & Valuation", p.reportSharedAt,
      p.reportSharedAt ? `Verified financial report ${seller ? "shared" : "received"}` : p.reportRequestedAt ? `Requested by the buyer ${day(p.reportRequestedAt)}` : "Not shared yet",
      seller && !p.reportSharedAt ? <Button size="sm" onClick={() => act(() => fShare({ data: { id: p.id } }), "Report shared")}>Share report</Button>
        : !seller && !p.reportSharedAt && !p.reportRequestedAt ? <Button size="sm" variant="outline" onClick={() => act(() => fAsk({ data: { id: p.id } }), "Request sent")}>Ask for the report</Button> : undefined],
    ["Letter of intent", p.loiAcceptedAt,
      p.loiAcceptedAt ? `${money(p.loiAmount)} · accepted by ${seller ? "you" : "the seller"} · exclusivity ${p.loiExclusivityDays ?? 0} days`
        : p.loiSentAt ? `${money(p.loiAmount)} · sent ${day(p.loiSentAt)} · waiting for ${seller ? "you" : "the seller"}` : "No letter of intent yet",
      !seller && !p.loiSentAt ? <Button size="sm" onClick={() => setLoiOpen(true)}>Send letter of intent</Button> : undefined],
    ["Contact M&A", p.contactAt, p.contactAt ? "Contacts exchanged" : "After the letter of intent is accepted"],
    ["Legal", p.legalAt, p.legalAt ? `Legal folder ${seller ? "shared" : "received"}` : "Legal folder not shared yet",
      seller && p.contactAt && !p.legalAt ? <Button size="sm" onClick={() => act(() => fStep({ data: { id: p.id, step: "legal" } }), "Legal folder shared")}>Share documents</Button> : undefined],
    ["Offer & SPA", p.spaAt, p.spaAt ? `SPA draft ${seller ? "shared" : "received"}` : `SPA draft not ${seller ? "shared" : "received"} yet`,
      seller && p.legalAt && !p.spaAt ? <Button size="sm" variant="outline" onClick={() => act(() => fStep({ data: { id: p.id, step: "spa" } }), "SPA draft shared")}>Share SPA draft</Button> : undefined],
    ["Payment", p.paymentAt, p.paymentAt ? "Completed" : "Not started · escrow and completion",
      seller && p.spaAt && !p.paymentAt ? <Button size="sm" variant="outline" onClick={() => act(() => fStep({ data: { id: p.id, step: "payment" } }), "Marked complete")}>Mark complete</Button> : undefined],
  ];

  return (
    <div className="rounded-[14px] border bg-card p-5">
      <div className="flex flex-wrap items-start gap-3">
        <Avatar name={p.counterparty.name} tone={seller ? "violet" : "orange"} />
        <button className="min-w-0 flex-1 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[16px] font-bold">{p.counterparty.name}</span>
            <Pill tone="blue">{STEPS[Math.min(cur, 6)]}</Pill>
            <span className="text-[13px] text-muted-foreground">Financial report</span>{reportPill}
          </div>
          <div className="text-[13px] text-muted-foreground">
            {[p.counterparty.sub, p.loiAmount ? `${seller ? "offer" : "your offer"} ${money(p.loiAmount)}` : null, waitingOn].filter(Boolean).join(" · ")}
          </div>
        </button>
      </div>
      <Stepper cur={cur} />
      {open && (
        <div className="mt-4 divide-y border-t">
          {rows.map(([label, date, text, action]) => (
            <div key={label} className="grid grid-cols-[170px_80px_1fr_auto] items-center gap-3 py-3 text-[13.5px]">
              <div className={cn("font-bold", !date && "text-muted-foreground")}>{label}</div>
              <div className="text-muted-foreground">{day(date)}</div>
              <div>{text}</div>
              <div>{action}</div>
            </div>
          ))}
          <div className="flex justify-end pt-3">
            <button className="text-[13px] font-semibold text-link" onClick={() => setHistOpen(true)}>History</button>
          </div>
        </div>
      )}
      {loiOpen && <LoiDialog id={p.id} onClose={() => setLoiOpen(false)} />}
      {histOpen && <HistoryDialog id={p.id} other={other} onClose={() => setHistOpen(false)} />}
    </div>
  );
}

function LoiDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const f = useServerFn(sendLoi);
  const refresh = useRefresh();
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("60");
  const [cond, setCond] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const a = Number(amount.replace(/,/g, "")) * 1e6;
    if (!a) return toast.error("Enter a price");
    setBusy(true);
    try { await f({ data: { id, amount: a, exclusivityDays: Number(days) || 0, conditions: cond || undefined } }); toast.success("Letter of intent sent"); refresh(); onClose(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send a letter of intent</DialogTitle>
          <DialogDescription>Non-binding. The seller can accept or decline.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm font-medium">Indicative price (฿ million)<Input className="mt-1" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
          <label className="block text-sm font-medium">Exclusivity (days)<Input className="mt-1" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} /></label>
          <label className="block text-sm font-medium">Conditions<Textarea className="mt-1" value={cond} onChange={(e) => setCond(e.target.value)} /></label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy} onClick={submit}>Send</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const EVENT_LABEL: Record<string, string> = {
  nda_requested: "NDA requested", nda_approved: "NDA approved", nda_declined: "NDA declined",
  report_requested: "Financial report requested", report_shared: "Financial report shared",
  loi_sent: "Letter of intent sent", loi_accepted: "Letter of intent accepted", loi_declined: "Letter of intent declined",
  legal_shared: "Legal folder shared", spa_shared: "SPA draft shared", payment_shared: "Payment completed",
};

function HistoryDialog({ id, onClose }: { id: string; other: string; onClose: () => void }) {
  const f = useServerFn(pipelineEvents);
  const { data = [] } = useQuery({ queryKey: ["pipeline", "events", id], queryFn: () => f({ data: { id } }) });
  const list = useMemo(() => data as { event: string; created_at: string }[], [data]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>History</DialogTitle></DialogHeader>
        <ul className="divide-y">
          {list.map((e, i) => (
            <li key={i} className="flex justify-between py-2 text-sm">
              <span>{EVENT_LABEL[e.event] ?? e.event}</span>
              <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
            </li>
          ))}
          {list.length === 0 && <li className="py-4 text-center text-muted-foreground">No events yet.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
