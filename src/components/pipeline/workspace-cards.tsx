import { ShareAccessDialog } from "@/components/my-business/report-share-ui";
import { DealAgreements } from './deal-agreements';
import {PipelineReportsButton} from '@/components/reports/reports-hub';
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RequestLoiDialog, SendLoiDialog } from "@/components/pipeline/send-loi-dialog";
import { useServerFn } from "@tanstack/react-start";
import { useAdvisorContactRow } from "@/components/pipeline/advisor-bits";
import { Check, ChevronDown, ChevronRight, Columns3, Lock, X, Star } from "lucide-react";

// Open/closed Tracking cards persist across tab/role switches; reset on reload.
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
import { ReviewInvestorDialog } from "@/components/marketplace/seller-invitations";
import { withdrawNdaRequest } from "@/lib/favourites.functions";
import { STEPS, currentStep, isPending, waitState } from "@/lib/pipeline-state";
import { WithdrawLink, WithdrawnPill, EndedBox, withdrewText, closedWhen } from "@/components/pipeline/withdraw-deal";
import { ReportViewer, CompareReports, InvestorProfile, SellerProfile, NdaDialog, LoiDialog as LoiDocDialog } from "@/components/pipeline/pipeline-dialogs";
import { Tooltip as TT, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
const Tooltip = ({ children }: { children: React.ReactNode }) => <TooltipProvider delayDuration={200}><TT>{children}</TT></TooltipProvider>;

type T = (s: string) => string;

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
  return () => Promise.all([qc.invalidateQueries({ queryKey: ["pipeline"] }),qc.invalidateQueries({queryKey:["invitations"]}),qc.invalidateQueries({queryKey:["reports-hub"]})]);
}

function Stepper({ cur, t, endedOn }: { cur: number; t: T; endedOn?: string }) {
  if (endedOn) return (
    <div className="grid grid-cols-7 pt-3">
      {STEPS.map((s, i) => {
        const done = i < cur, stop = i === cur;
        return (
          <div key={s} className="relative flex flex-col items-center">
            {i > 0 && <div className={cn("absolute right-1/2 top-[6px] h-[2px] w-[calc(100%-18px)] -translate-x-[9px]", i <= cur ? "bg-[#D1D5DB]" : "bg-border")} />}
            {stop
              ? <div className="relative z-10 -mt-[1px] grid h-4 w-4 place-items-center rounded-full bg-[#6B7280]"><X className="h-2.5 w-2.5 text-white" strokeWidth={3} /></div>
              : <div className={cn("relative z-10 h-[14px] w-[14px] rounded-full border-2", done ? "border-[#9CA3AF] bg-[#9CA3AF]" : "border-border bg-card")} />}
            <div className={cn("mt-2 text-center text-[12px]", stop ? "font-semibold text-[#4B5563]" : done ? "text-foreground" : "text-muted-foreground")}>{t(s)}</div>
            {stop && <div className="text-center text-[11.5px] text-[#9CA3AF]">{endedOn}</div>}
          </div>
        );
      })}
    </div>
  );
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

export function TrackingCard({ p, seller, open, onToggle, onEnded, t, starred, onStar }: { starred?: boolean; onStar?: () => void; p: PipelineRow; seller: boolean; open: boolean; onToggle: () => void; onEnded: () => void; t: T }) {
  const withdrawNda = useServerFn(withdrawNdaRequest);
  const [reviewNda,setReviewNda]=useState(false);
  const [withdrawConfirm,setWithdrawConfirm]=useState(false);
  const pendingNda=!p.ndaApprovedAt;
  const wd = p.status === "ended" ? p.withdrawal : null;
  const [loiOpen, setLoiOpen] = useState(false);
  const [reqOpen, setReqOpen] = useState(false);
  const withdrawReq = useServerFn(withdrawLoiRequest);
  const lr = p.loiRequest;
  const [histOpen, setHistOpen] = useState(false);
  const [dlg, setDlg] = useState<null | "report" | "investor" | "seller" | "nda" | "loi" | "share">(null);
  const cur = wd ? wd.step : Math.min(6,currentStep(p));
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
  if(pendingNda){rows[0]=["NDA",p.ndaRequestedAt,seller?`${t("Your turn")}: ${t("the buyer has signed it")}`:`${t("You signed and sent the NDA on")} ${day(p.ndaRequestedAt)} · ${t("waiting for the seller")}`,seller?<Button size="sm" onClick={()=>setReviewNda(true)}>{t("Review request")}</Button>:<><Button size="sm" variant="outline" onClick={()=>setDlg("nda")}>{t("View NDA")}</Button><Button size="sm" variant="outline" onClick={()=>setWithdrawConfirm(true)}>{t("Withdraw request")}</Button></>];for(let i=1;i<rows.length;i++){rows[i]=[rows[i][0],null,t("Not started"),undefined];}}
  if (wd) {
    const cw = closedWhen(wd, t);
    const by = wd.mine ? t("you") : wd.side === "seller" ? t("the seller") : t("the buyer");
    const approver = seller ? t("you") : t("the seller");
    const exp = p.ndaExpiresAt ? day(p.ndaExpiresAt) : "—";
    const ended: typeof rows = [
      ["NDA", p.ndaApprovedAt, `${t("Approved by")} ${approver} · ${t("in force until")} ${exp}`, <Button size="sm" variant="outline" onClick={() => setDlg("nda")}>{t("View NDA")}</Button>],
      ["Financial & Valuation", p.reportSharedAt ?? p.reportRequestedAt,
        wd.mine ? t("Report access ended when you withdrew") : seller ? t("Report access ended when the buyer withdrew") : t("You can no longer open the reports"), undefined],
    ];
    if (p.loiSentAt) ended.push(["Letter of intent", p.loiSentAt, `${money(p.loiAmount)} · ${t("sent")} ${day(p.loiSentAt)} · ${cw}`, <Button size="sm" variant="outline" onClick={() => setDlg("loi")}>{t("View LOI")}</Button>]);
    if (p.contactAt) ended.push(["Contact M&A", p.contactAt, `${t("Contact M&A")} · ${cw}`, undefined]);
    if (p.legalAt) ended.push(["Legal", p.legalAt, `${seller ? t("Legal folder shared") : t("Legal folder received")} · ${cw}`, undefined]);
    if (p.spaAt) ended.push(["Offer & SPA", p.spaAt, `${seller ? t("SPA draft shared") : t("SPA draft received")} · ${cw}`, undefined]);
    rows.splice(0, rows.length, ...ended.slice(0, Math.max(1, wd.step + 1)));
    void by;
  }

  return (
    <div id={`deal-${p.id}`} className={cn("overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-card transition-shadow hover:border-[#D9DCE2]", open && "shadow-[0_6px_20px_rgba(16,24,40,.06)]")}>
      <div role="button" tabIndex={0} onClick={onToggle} aria-expanded={open}
        onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onToggle(); } }}
        className="grid w-full cursor-pointer grid-cols-[40px_1fr_auto] items-center gap-[14px] px-5 pt-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563EB]">
        <div className="[&>*]:!h-10 [&>*]:!w-10 [&>*]:!text-[14px]">
          {wd
            ? <span className="grid place-items-center rounded-full bg-gradient-to-b from-[#A3A9B6] to-[#7C8496] font-bold text-white">{p.counterparty.name.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase()}</span>
            : pendingNda ? <span className="pipeline-request-tile">{initials(p.counterparty.name)}</span> : <Avatar name={p.counterparty.name} tone={seller ? "violet" : "orange"} logoUrl={p.counterparty.logoUrl} />}
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
            <span className={cn("truncate text-[16px] font-bold", wd && "text-[#374151] dark:text-[#D1D5DB]")}>{p.counterparty.name}</span>
            {wd && <WithdrawnPill t={t} />}

          </div>
          {!wd && pendingNda && <span className="hub-pill" data-tone="muted">{t("Step")} 1 · NDA</span>}
          {!wd && p.ndaApprovedAt && (!p.ndaExpiresAt || Date.parse(p.ndaExpiresAt)>Date.now()) && <div className="mt-2 flex flex-wrap items-center gap-2"><span className="hub-pill" data-tone="muted">{t('Step')} {cur+1} · {t(STEPS[cur])}</span><PipelineReportsButton pipelineId={p.id} seller={seller}/></div>}
          <div className="truncate text-[12.5px] text-[#6B7280]">
            {[p.counterparty.sub, p.loiAmount ? `${seller ? t("offer") : t("your offer")} ${money(p.loiAmount)}` : null].filter(Boolean).join(" · ")}
            {" · "}
            {wd ? <span className="font-semibold text-[#4B5563]">{withdrewText(wd, t)}</span> : <span className={cn("font-semibold", w.onYou ? "text-[#B45309]" : "text-[#6B7280]")}>
              {w.onYou && w.what === "send a letter of intent"
                ? `${t("Pending")}: ${t("send a letter of intent")}`
                : `${t("waiting on")} ${w.onYou ? t("you") : other}: ${t(w.what)}`}
            </span>}
          </div>
        </div>
        <div className="deal-header-actions flex items-center gap-[14px] text-[12.5px] font-semibold text-muted-foreground">
          {!wd&&onStar&&<Button size="icon" variant="outline" className="deal-star" aria-pressed={!!starred} aria-label={t(starred?"Remove from Deal watchlist":"Add to Deal watchlist")} title={t(starred?"On your Deal watchlist":"Add to Deal watchlist")} onClick={e=>{stop(e);onStar();}}><Star size={15}/></Button>}
          {pendingNda&&seller&&<Button size="sm" onClick={e=>{stop(e);setReviewNda(true);}}>{t("Review request")}</Button>}
          {pendingNda && !seller ? <Button variant="link" className="p-0 h-auto" asChild><Link to="/marketplace/pipeline/invitations" search={{open:p.id}}>{t("View listing")}</Link></Button> : seller
            ? <button className="text-[12.5px] font-semibold text-[#2563EB] hover:underline" onClick={(e) => { stop(e); setDlg("investor"); }}>{t("Investor profile")}</button>
            : <button className="text-[12.5px] font-semibold text-[#2563EB] hover:underline" onClick={(e) => { stop(e); setDlg("seller"); }}>{t(pendingNda?"View listing":"Seller profile")}</button>}
          <span className="flex items-center gap-2">
            {open ? t("Hide details") : t("Details")}
            <span className="grid h-[30px] w-[30px] place-items-center rounded-[8px] border border-[#E5E7EB]">
              <ChevronDown className={cn("h-4 w-4 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} />
            </span>
          </span>
        </div>
      </div>
      <div className="px-5 pb-[18px] [&>*]:!mt-4"><Stepper cur={cur} t={t} endedOn={wd ? `${t("withdrawn")} ${day(wd.at)}` : undefined} /></div>
      {!wd && <DealAgreements p={p} seller={seller} onNda={() => setDlg('nda')} onLoi={() => setDlg('loi')} />}
      <div className={cn("grid transition-[grid-template-rows] duration-[250ms] ease-in-out motion-reduce:transition-none", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="min-h-0 overflow-hidden" inert={!open || undefined}>
          {wd && <EndedBox w={wd} p={p} seller={seller} t={t} />}
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
          <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-2.5">
            {!pendingNda&&<WithdrawLink p={p} seller={seller} t={t} onDone={() => { refresh(); onEnded(); }} />}
            <button className="text-[12.5px] font-semibold text-[#2563EB]" onClick={() => setHistOpen(true)}>{t("Activity")}</button>
          </div>
        </div>
      </div>
      {reviewNda&&<ReviewInvestorDialog pipelineId={p.id} onClose={()=>{setReviewNda(false);refresh();}}/>}
      {withdrawConfirm&&<Dialog open onOpenChange={setWithdrawConfirm}><DialogContent><DialogTitle>{t("Withdraw request")}?</DialogTitle><DialogDescription>{t("The seller has not approved this NDA yet.")}</DialogDescription><DialogFooter><Button variant="outline" onClick={()=>setWithdrawConfirm(false)}>{t("Cancel")}</Button><Button onClick={()=>act(async()=>{await withdrawNda({data:{id:p.hiddenProfileId}});setWithdrawConfirm(false);},t("Request withdrawn"))}>{t("Withdraw request")}</Button></DialogFooter></DialogContent></Dialog>}
      {adv.dialogs}
      {loiOpen && <SendLoiDialog id={p.id} request={lr} onClose={() => setLoiOpen(false)} onSent={refresh} />}
      {reqOpen && <RequestLoiDialog id={p.id} onClose={() => setReqOpen(false)} onSent={refresh} />}
      {histOpen && <HistoryDialog id={p.id} other={other} onClose={() => setHistOpen(false)} t={t} />}
      {dlg === "report" && <ReportViewer p={p} seller={seller} onClose={() => setDlg(null)} />}
      {dlg === "share" && <ShareAccessDialog p={p} mode={p.share ? "manage" : "share"} onClose={() => setDlg(null)} onDone={refresh} />}
      {dlg === "investor" && <InvestorProfile p={p} onReview={pendingNda ? () => setReviewNda(true) : undefined} onClose={() => setDlg(null)} onNda={() => setDlg("nda")} onLoi={() => setDlg("loi")} />}
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
  withdrawn: "Withdrawn from the deal", legal_shared: "Legal folder shared", spa_shared: "SPA draft shared", payment_shared: "Payment completed",
};

function HistoryDialog({ id, onClose, t }: { id: string; other: string; onClose: () => void; t: T }) {
  const f = useServerFn(pipelineEvents);
  const { data = [] } = useQuery({ queryKey: ["pipeline", "events", id], queryFn: () => f({ data: { id } }) });
  const list = useMemo(() => data as { event: string; created_at: string }[], [data]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("Activity")}</DialogTitle></DialogHeader>
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
