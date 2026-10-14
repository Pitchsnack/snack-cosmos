import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowDownWideNarrow, ArrowRight, Briefcase, Check, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, Eye, FileText,
  Info, Lock, MessageSquare, Scale, Search, Send, ShieldCheck, UserCheck, X,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ViewToggle, type ViewMode } from "@/components/shared/view-toggle";
import { pillCls, useDismissedHints } from "@/components/marketplace/browse-header";
import { FirmCard, FirmLogo, ServiceChip, Stars } from "@/components/advisor/advisor-firm-card";
import { FirmPanel } from "@/components/advisor/advisor-my-company";
import { ADVISOR_SERVICES, DEAL_BANDS, FIRM_TYPES, LANGUAGES, dealBandLabels, reviewStats, type AdvisorFirm } from "@/lib/advisor-firm";
import { fmtShort, reasonText, type EnquiryState, type Me } from "@/lib/advisor-enquiry";
import { browseAdvisors, markAdvisorsIntroSeen, recordFirmView } from "@/lib/advisor-enquiries.functions";
import { AcceptProposalDialog, DeclineProposalDialog, ProposalRows, RateDialog, SendEnquiryButton, SendEnquiryDialog, StatusChip, canEnquire, tf } from "./enquiry-dialogs";
import { tr, useTranslation } from "@/i18n/language";
import { cn } from "@/lib/utils";

type Side = "seller" | "buyer";
type Sort = "rated" | "reviews" | "newest" | "name";
const SORTS: { v: Sort; l: string }[] = [{ v: "rated", l: "Best rated" }, { v: "reviews", l: "Most reviews" }, { v: "newest", l: "Newest on PitchSnack" }, { v: "name", l: "Name A–Z" }];
const TIP = "advisors_tip";
const ACCENT: Record<Side, string> = { seller: "#F0A93B", buyer: "#4F46E5" };

/* ───────────────────────── Multi-choice filter pill ───────────────────────── */

function MultiPill({ label, options, value, onChange, countFor }: {
  label: string; options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; countFor: (v: string) => number;
}) {
  const [open, setOpen] = useState(false);
  const on = value.length > 0;
  const text = !on ? label : value.length === 1 ? `${label}: ${options.find((o) => o.value === value[0])?.label ?? value[0]}` : `${label} · ${value.length}`;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-expanded={open} className={cn(pillCls(on, open), "h-[34px]")}><span className="truncate">{text}</span><ChevronDown className="h-3.5 w-3.5 shrink-0" /></button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} collisionPadding={16} className="max-h-[min(420px,calc(100vh-150px))] w-[290px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-[12px] p-1.5">
        {options.map((o) => {
          const sel = value.includes(o.value);
          return (
            <button key={o.value} type="button" role="checkbox" aria-checked={sel}
              onClick={() => onChange(sel ? value.filter((x) => x !== o.value) : [...value, o.value])}
              className="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-[13px] hover:bg-muted">
              <span className={cn("grid h-4 w-4 shrink-0 place-items-center rounded border", sel ? "border-[var(--r-acc)] bg-[var(--r-acc)] text-white" : "border-border")}>{sel && <Check className="h-3 w-3" />}</span>
              <span className="min-w-0 flex-1">{o.label}</span><span className="text-[12px] text-muted-foreground">{countFor(o.value)}</span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

/* ───────────────────────── First-visit boxes ───────────────────────── */

function Dots({ n }: { n: 1 | 2 }) {
  return (
    <span className="flex items-center gap-2 text-[12.5px] font-semibold text-muted-foreground">
      <span className="flex gap-[5px]"><span className={cn("h-[7px] w-[7px] rounded-full", n === 1 ? "bg-[#1E2A4A] dark:bg-foreground" : "bg-[#D5D9E1] dark:bg-muted")} /><span className={cn("h-[7px] w-[7px] rounded-full", n === 2 ? "bg-[#1E2A4A] dark:bg-foreground" : "bg-[#D5D9E1] dark:bg-muted")} /></span>
      {n === 1 ? tr("1 of 2") : tr("2 of 2")}
    </span>
  );
}
const NAVY = "bg-[#1E2A4A] text-white hover:bg-[#1E2A4A]/90 dark:bg-primary dark:text-primary-foreground";

function IntroBoxes({ step, setStep, alone, me, firm, onClose }: { step: 1 | 2; setStep: (s: 1 | 2) => void; alone: boolean; me: Me; firm: string; onClose: () => void }) {
  const seller = me.side === "seller";
  const hidden = seller
    ? [["Your listing", "that your business is for sale, and its details"], ["The buyers you're talking to", "their names, NDAs and offers"], ["Your reports and messages", "financials, valuation, risk"]]
    : [["Your investor profile", "what you want to buy, and your budget"], ["The sellers you're talking to", "their names, NDAs and offers"], ["Your reports and messages", "what sellers shared with you"]];
  const steps: [any, string, string][] = [[Send, "Send an enquiry", "Free on every plan"], [MessageSquare, "The firm replies", "In your Messages"], [FileText, "Accept its proposal", "The scope, fee and timing"], [UserCheck, "Your advisor", "Bring them into a deal"]];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      {step === 1 ? (
        <DialogContent className="w-[calc(100vw-32px)] max-w-[540px] gap-0 rounded-[16px] p-0" onOpenAutoFocus={(e) => { e.preventDefault(); (document.getElementById("intro-continue") as HTMLButtonElement | null)?.focus(); }}>
          <div className="flex flex-col items-center gap-2.5 px-10 pb-2 pt-10 text-center">
            <span className="mb-1 grid h-[60px] w-[60px] place-items-center rounded-[18px] bg-[#EEF1F8] text-[#1E2A4A] dark:bg-muted dark:text-foreground"><Scale className="h-7 w-7" /></span>
            <span className="text-[11px] font-bold uppercase tracking-[.08em] text-muted-foreground">{tr("Welcome to Browse advisors")}</span>
            <DialogTitle className="text-balance font-heading text-[22px] font-bold leading-[1.3]">{tr("PitchSnack takes no commission from advisers or partners.")}</DialogTitle>
            <DialogDescription className="max-w-[40ch] text-[15px] leading-[1.55] text-[#434A5C] dark:text-muted-foreground">{tr("The choice of provider, and the decision to engage them, remains yours.")}</DialogDescription>
          </div>
          <div className="flex items-center justify-between px-6 pb-[22px] pt-[18px]">
            <Dots n={1} />
            <Button id="intro-continue" className={cn("h-10 gap-1.5 rounded-[10px]", NAVY)} onClick={() => setStep(2)}>{tr("Continue")}<ArrowRight className="h-[15px] w-[15px]" /></Button>
          </div>
        </DialogContent>
      ) : (
        <DialogContent className="max-h-[calc(100vh-32px)] w-[calc(100vw-32px)] max-w-[700px] gap-4 overflow-y-auto rounded-[16px]" onOpenAutoFocus={(e) => { e.preventDefault(); (document.getElementById("intro-start") as HTMLButtonElement | null)?.focus(); }}>
          <div className="flex gap-3.5 pr-6">
            <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-[14px]", seller ? "bg-[#FEF3DE] text-[#8A4B06]" : "bg-[#EEF0FF] text-[#4338CA]")}><Briefcase className="h-6 w-6" /></span>
            <div><DialogTitle className="font-heading text-[21px] font-bold">{tr("Find the right advisor")}</DialogTitle>
              <DialogDescription className="mt-1 text-[14px] text-[#434A5C] dark:text-muted-foreground">{tr("M&A advisers, valuers, lawyers, accountants and other firms show their services, fees and client reviews here. Asking a firm for help is free on every plan.")}</DialogDescription></div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground">{tr("An example: who sees what")}</div>
            <p className="mt-1.5 flex gap-2 text-[14px]"><Eye className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span>{tr("While you browse, no firm knows who you are. If you send an enquiry to {firm}:").split("{firm}")[0]}<b>{firm}</b>{tr("While you browse, no firm knows who you are. If you send an enquiry to {firm}:").split("{firm}")[1]}</span></p>
          </div>
          <div className="grid gap-3 min-[640px]:grid-cols-[1.4fr_1fr]">
            <div className="space-y-2.5 rounded-[12px] border border-[#BBE8CA] bg-[#F3FBF6] p-3.5 dark:border-green-900 dark:bg-green-950/30">
              <div className="flex items-center gap-1.5 text-[13.5px] font-bold text-[#15803D] dark:text-green-300"><Check className="h-[15px] w-[15px]" />{tf("{firm} sees", { firm })}</div>
              <div className="rounded-[10px] border border-[#D9EFE1] bg-card dark:border-border">
                {[["Name", [me.name, me.title].filter(Boolean).join(", ")], ["Company", me.company ?? "—"], ["Email", me.email ?? "—"], ["Phone", me.phone ?? "—"], ["On PitchSnack", seller ? tr("Seller") : tr("Buyer")]].map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[88px_1fr] gap-2 border-b border-[#EEF6F1] px-[11px] py-[7px] text-[12.5px] last:border-0 dark:border-border"><span className="text-muted-foreground">{tr(k)}</span><span className={cn("min-w-0", k === "Email" ? "break-all" : "break-words")}>{v}</span></div>
                ))}
              </div>
              <p className="text-[12px] text-muted-foreground">{tr("So they can reply to you and send you a proposal.")}</p>
            </div>
            <div className="space-y-2.5 rounded-[12px] border border-[#E3E6EB] bg-[#F6F7F9] p-3.5 dark:border-border dark:bg-muted/40">
              <div className="flex items-center gap-1.5 text-[13.5px] font-bold text-[#374151] dark:text-foreground"><Lock className="h-[15px] w-[15px]" />{tf("{firm} doesn't see", { firm })}</div>
              {hidden.map(([a, b]) => (
                <div key={a} className="flex gap-2"><Lock className="mt-0.5 h-[15px] w-[15px] shrink-0 text-muted-foreground" /><div className="text-[13px]"><div className="font-semibold">{tr(a)}</div><div className="text-muted-foreground">{tr(b)}</div></div></div>
              ))}
              <p className="text-[12px] text-muted-foreground">{tr("Share any of it in Messages, only if you choose to.")}</p>
            </div>
          </div>
          <div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground">{tr("How it works")}</div>
            <div className="grid grid-cols-2 gap-2 min-[640px]:grid-cols-4">
              {steps.map(([I, t, l], i) => (
                <div key={t} className="relative rounded-[11px] border border-[#EEF0F3] bg-[#FBFBFC] px-[11px] py-2.5 dark:border-border dark:bg-muted/30">
                  <span className="grid h-7 w-7 place-items-center rounded-[8px] bg-[#E0F5F2] text-[#0F766E]"><I className="h-4 w-4" /></span>
                  <div className="mt-1.5 text-[13px] font-bold">{tr(t)}</div><div className="text-[12px] text-muted-foreground">{tr(l)}</div>
                  {i < 3 && <ChevronRight className="absolute -right-[11px] top-1/2 hidden h-3.5 w-3.5 -translate-y-1/2 text-[#C4C9D2] min-[640px]:block" />}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {!alone ? <span className="flex flex-wrap items-center gap-3"><Dots n={2} /><span className="text-[12.5px] text-muted-foreground">{tr("Open this again from How it works, next to the page title.")}</span></span> : <span />}
            <span className="flex gap-2">
              {!alone && <Button variant="outline" className="h-10" onClick={() => setStep(1)}>{tr("Back")}</Button>}
              <Button id="intro-start" className={cn("h-10", NAVY)} onClick={onClose}>{tr("Start browsing")}</Button>
            </span>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}

/* ───────────────────────── The relationship box ───────────────────────── */

function RelationBox({ f, s, me, side, detail, onMessages, onEnquire }: {
  f: AdvisorFirm; s: EnquiryState; me: Me | null; side: Side; detail: string | null; onMessages: () => void; onEnquire: () => void;
}) {
  const [dlg, setDlg] = useState<null | "accept" | "decline" | "rate">(null);
  const grey = { box: "border-[#E3E6EB] bg-[#F8F9FB] dark:border-border dark:bg-muted/40", tile: "bg-[#ECEEF2] text-[#4B5563] dark:bg-muted dark:text-muted-foreground", eb: "text-[#6B7280]" };
  const blue = { box: "border-[#CFE0FB] bg-[#F4F8FF] dark:border-blue-900 dark:bg-blue-950/30", tile: "bg-[#DBEAFE] text-[#1D4ED8] dark:bg-blue-950 dark:text-blue-300", eb: "text-[#1D4ED8] dark:text-blue-300" };
  const green = { box: "border-[#BBE8CA] bg-[#F3FBF6] dark:border-green-900 dark:bg-green-950/30", tile: "bg-[#DCFCE7] text-[#15803D] dark:bg-green-950 dark:text-green-300", eb: "text-[#15803D] dark:text-green-300" };
  const msgBtn = (label = "Open in Messages") => <Button variant="outline" size="sm" className="h-[34px] gap-1.5 text-[13px]" onClick={onMessages}><MessageSquare className="h-4 w-4" />{tr(label)}</Button>;
  let c = grey, Icon: any = Send, eb = "", title = "", line: React.ReactNode = "", extra: React.ReactNode = null, btns: React.ReactNode = msgBtn();
  const firm = f.name;
  switch (s.status) {
    case "enquiry":
      eb = tf("Enquiry sent · {date}", { date: fmtShort(s.createdAt) }); title = tf("Your enquiry about {service}", { service: tr(s.service) });
      line = s.readAt ? tf("{firm} read it on {date}. Their reply, and any proposal, will arrive in Messages.", { firm, date: fmtShort(s.readAt) }) : tf("{firm} hasn't opened it yet. Their reply, and any proposal, will arrive in Messages.", { firm });
      break;
    case "talking":
      Icon = MessageSquare;
      eb = s.lastOutcome?.kind === "expired" ? tf("Proposal expired · {date}", { date: fmtShort(s.lastOutcome.at) }) : tf("Proposal declined · {date}", { date: fmtShort(s.lastOutcome?.at ?? s.createdAt) });
      title = tf("You're still talking with {firm}", { firm }); line = tf("{firm} can send you a new proposal in Messages.", { firm });
      break;
    case "proposal":
      c = blue; Icon = FileText;
      eb = tf("Proposal to review · {date}", { date: fmtShort(s.proposal?.sentAt) }); title = tf("{firm}'s proposal for {service}", { firm, service: tr(s.proposal?.service ?? s.service) });
      line = tf("From {person}. Valid until {date}.", { person: s.firmPerson ?? firm, date: fmtShort(s.proposal?.validUntil) });
      extra = s.proposal && <ProposalRows p={s.proposal} />;
      btns = <div className="flex w-full flex-wrap justify-between gap-2">{msgBtn()}<span className="flex gap-2">
        <Button variant="outline" size="sm" className="h-[34px] border-[#F3C5C0] text-[13px] text-[#B42318] hover:bg-[#FEF2F2] dark:border-red-900" onClick={() => setDlg("decline")}>{tr("Decline")}</Button>
        <Button size="sm" className={cn("h-[34px] text-[13px]", NAVY)} onClick={() => setDlg("accept")}>{tr("Accept proposal")}</Button></span></div>;
      break;
    case "engaged":
      c = green; Icon = UserCheck;
      eb = tf("Your advisor · since {date}", { date: fmtShort(s.engagedAt) }); title = tf("{firm} works for you on {service}", { firm, service: tr(s.service) });
      line = tf("Fee: {fee}. You pay {firm} directly, under its engagement letter.", { fee: s.engagedFee ?? "", firm });
      extra = <ul className="space-y-1 pl-[45px]">
        <li className="flex gap-2 text-[13px]"><CheckCircle2 className="mt-0.5 h-[15px] w-[15px] shrink-0 text-[#16A34A]" />{tf("In your Contacts › Advisors, with {person}'s email and phone.", { person: s.firmPerson ?? firm })}</li>
        <li className="flex gap-2 text-[13px]"><CheckCircle2 className="mt-0.5 h-[15px] w-[15px] shrink-0 text-[#16A34A]" />{tf("When one of your deals reaches Contact M&A, Introduce advisor lists {firm} first.", { firm })}</li></ul>;
      btns = <>{msgBtn("Message")}<Button variant="outline" size="sm" className="h-[34px] gap-1.5 text-[13px]" onClick={() => setDlg("rate")}><Check className="h-4 w-4" />{tr("The work is done")}</Button></>;
      break;
    case "done":
      c = green; Icon = Check;
      eb = tf("Work done · {date}", { date: fmtShort(s.doneAt) }); title = tf("You rated {firm}", { firm });
      line = <>{s.review?.comment && <>“{s.review.comment}” </>}{tf("Your review is on their profile as {line}.", { line: s.review?.line ?? "" })}</>;
      btns = msgBtn("Message");
      break;
    case "declined":
      eb = tf("Declined · {date}", { date: fmtShort(s.declinedAt) }); title = tf("{firm} declined your enquiry", { firm });
      line = `${tr(reasonText(s.declinedReason))}. ${tr("You can send a new enquiry, or try another firm.")}`;
      break;
    default: return null;
  }
  return (
    <div className={cn("space-y-2.5 rounded-[12px] border px-4 py-3.5", c.box)}>
      <div className="flex gap-3">
        <span className={cn("grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px]", c.tile)}><Icon className="h-4 w-4" /></span>
        <div className="min-w-0">
          <div className={cn("text-[10.5px] font-bold uppercase tracking-[.07em]", c.eb)}>{eb}</div>
          <div className="flex flex-wrap items-center gap-2 text-[14.5px] font-bold">{title}{s.status === "done" && s.review && <Stars value={s.review.stars} size={15} />}</div>
          <p className="text-[13px] text-[#434A5C] dark:text-muted-foreground">{line}</p>
        </div>
      </div>
      {extra}
      <div className="flex flex-wrap justify-end gap-2">{btns}</div>
      {dlg === "accept" && s.proposal && me && <AcceptProposalDialog firm={firm} p={s.proposal} me={me} onClose={() => setDlg(null)} />}
      {dlg === "decline" && s.proposal && <DeclineProposalDialog firm={firm} p={s.proposal} onClose={() => setDlg(null)} />}
      {dlg === "rate" && <RateDialog firm={firm} enquiryId={s.enquiryId} service={s.service} side={side} detail={detail} onClose={() => setDlg(null)} />}
    </div>
  );
}

/* ───────────────────────── The page ───────────────────────── */

export function BrowseAdvisorsPage({ side, firmParam, enquire }: { side: Side; firmParam?: string; enquire?: boolean }) {
  useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fn = useServerFn(browseAdvisors);
  const seenFn = useServerFn(markAdvisorsIntroSeen);
  const viewFn = useServerFn(recordFirmView);
  const hints = useDismissedHints();
  const { data, isLoading } = useQuery({ queryKey: ["browse-advisors", side], queryFn: () => fn({ data: { side } }), staleTime: 15_000 });
  const firms = data?.firms ?? [];
  const states = data?.states ?? {};
  const canAct = !!data && !data.isAdmin;

  const [view, setView] = useState<ViewMode>("split");
  useEffect(() => { const v = localStorage.getItem("sp2.advisors.view"); if (v === "grid" || v === "split" || v === "list") setView(v); }, []);
  const persist = (v: ViewMode) => { setView(v); try { localStorage.setItem("sp2.advisors.view", v); } catch { /* noop */ } };
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("rated");
  const [sortOpen, setSortOpen] = useState(false);
  const [mine, setMine] = useState(false);
  const [fs, setFs] = useState<{ svc: string[]; type: string[]; loc: string[]; deal: string[]; lang: string[] }>({ svc: [], type: [], loc: [], deal: [], lang: [] });
  const [verified, setVerified] = useState(false);
  const [sel, setSel] = useState<string | null>(firmParam ?? null);
  const [intro, setIntro] = useState<null | { step: 1 | 2; alone: boolean }>(null);
  const [enq, setEnq] = useState<null | { firm: AdvisorFirm; service: string | null }>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(true);
  useEffect(() => { const m = window.matchMedia("(min-width: 1100px)"); const on = () => setWide(m.matches); on(); m.addEventListener("change", on); return () => m.removeEventListener("change", on); }, []);

  // First visit, once per user (stored on the server).
  useEffect(() => { if (data && !data.introSeen && !intro) setIntro({ step: 1, alone: false }); }, [data?.introSeen]);
  const closeIntro = () => {
    setIntro(null);
    if (data && !data.introSeen) { seenFn().catch(() => {}); qc.setQueryData(["browse-advisors", side], (o: any) => (o ? { ...o, introSeen: true } : o)); }
  };

  useEffect(() => { if (firmParam) { setSel(firmParam); setView("split"); } }, [firmParam]);
  useEffect(() => {
    if (enquire && firmParam && canAct) { const f = firms.find((x) => x.id === firmParam); if (f && canEnquire(states[f.id])) setEnq({ firm: f, service: null }); }
  }, [enquire, firmParam, canAct, firms.length]);

  const needle = q.trim().toLowerCase();
  const passes = (f: AdvisorFirm, skip?: keyof typeof fs) => {
    if (mine && !states[f.id]) return false;
    if (needle && ![f.name, f.refNo, f.city, f.firmType, f.description, ...f.services].some((v) => v?.toLowerCase().includes(needle))) return false;
    const has = (k: keyof typeof fs, ok: boolean) => skip === k || !fs[k].length || ok;
    if (!has("svc", f.services.some((s) => fs.svc.includes(s)))) return false;
    if (!has("type", fs.type.includes(f.firmType))) return false;
    if (!has("loc", !!f.city && fs.loc.includes(f.city))) return false;
    if (!has("deal", !!f.dealBand && fs.deal.includes(f.dealBand))) return false;
    if (!has("lang", f.languages.some((l) => fs.lang.includes(l)))) return false;
    if (verified && !f.verifiedAt) return false;
    return true;
  };
  const stat = useMemo(() => Object.fromEntries(firms.map((f) => [f.id, reviewStats(f.reviews)])), [firms]);
  const shown = useMemo(() => {
    const list = firms.filter((f) => passes(f));
    const by = (a: AdvisorFirm, b: AdvisorFirm) => {
      const A = stat[a.id], B = stat[b.id];
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "newest") return (b.liveSince ?? "").localeCompare(a.liveSince ?? "");
      if (sort === "reviews") return B.n - A.n || B.avg - A.avg || a.name.localeCompare(b.name);
      if (!A.n !== !B.n) return A.n ? -1 : 1;
      return B.avg - A.avg || B.n - A.n || a.name.localeCompare(b.name);
    };
    return list.sort(by);
  }, [firms, states, needle, fs, verified, mine, sort, stat]);
  const anyFilter = Object.values(fs).some((v) => v.length) || verified;
  const current = shown.find((f) => f.id === sel) ?? (view === "split" ? shown[0] : undefined);

  // One view per user, firm and day.
  const viewed = useRef(new Set<string>());
  useEffect(() => { if (current && canAct && view === "split" && !viewed.current.has(current.id)) { viewed.current.add(current.id); viewFn({ data: { firmId: current.id } }).catch(() => {}); } }, [current?.id, canAct, view]);

  const openSplit = (id: string) => { setSel(id); persist("split"); };
  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const i = shown.findIndex((f) => f.id === current?.id);
    const n = shown[Math.max(0, Math.min(shown.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))];
    if (n) { setSel(n.id); listRef.current?.querySelector(`[data-key="${n.id}"]`)?.scrollIntoView({ block: "nearest" }); }
  };
  const toMessages = (key: string) => navigate({ to: "/marketplace/messages", search: { thread: key } as any });
  const action = (f: AdvisorFirm, big?: boolean) => {
    const s = states[f.id];
    if (!canAct) return null;
    if (s && !canEnquire(s)) return <StatusChip s={s} big={big} />;
    if (s?.status === "done" && !big) return <StatusChip s={s} />;
    return <SendEnquiryButton big={big} onClick={() => setEnq({ firm: f, service: null })} />;
  };
  const tileAction = (f: AdvisorFirm) => (svc: string) => {
    const s = states[f.id];
    if (!canAct) return null;
    if (s && (s.status === "engaged" || s.status === "done") && s.service === svc) return <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#15803D]"><UserCheck className="h-3.5 w-3.5" />{tr("Your advisor for this")}</span>;
    if (s && ["enquiry", "talking", "proposal"].includes(s.status)) return s.service === svc
      ? <span className="inline-flex items-center gap-1 font-semibold text-[#1D4ED8]">{s.status === "proposal" ? <><FileText className="h-3.5 w-3.5" />{tr("Proposal to review")}</> : <><Send className="h-3.5 w-3.5" />{tr("Enquiry open")}</>}</span> : null;
    if (s?.status === "engaged") return null;
    return <button type="button" onClick={() => setEnq({ firm: f, service: svc })} className="inline-flex items-center gap-1 font-semibold text-[#2563EB] hover:underline">{tr("Enquire about this")}<ArrowRight className="h-[13px] w-[13px]" /></button>;
  };
  const cities = [...new Set(firms.map((f) => f.city).filter(Boolean) as string[])].sort();
  const count = (k: keyof typeof fs, test: (f: AdvisorFirm, v: string) => boolean) => (v: string) => firms.filter((f) => passes(f, k) && test(f, v)).length;
  const set = (k: keyof typeof fs) => (v: string[]) => setFs((o) => ({ ...o, [k]: v }));
  const clearAll = () => { setQ(""); setFs({ svc: [], type: [], loc: [], deal: [], lang: [] }); setVerified(false); };
  const splitFixed = wide && view === "split" && !isLoading && shown.length > 0;
  const tipFirm = current?.name ?? shown[0]?.name ?? firms[0]?.name ?? "the firm";
  const seller = side === "seller";

  const empty = mine && !Object.keys(states).length ? (
    <div className="rounded-[14px] border border-dashed border-border py-16 text-center"><p className="text-sm font-semibold">{tr("No advisors yet")}</p><p className="mt-1 text-sm text-muted-foreground">{tr("Send an enquiry from a firm's profile. Firms you contact or engage show here.")}</p></div>
  ) : (
    <div className="rounded-[14px] border border-dashed border-border py-16 text-center"><p className="text-sm font-semibold">{tr("No firm matches")}</p><p className="mt-1 text-sm text-muted-foreground">{tr("Try another search, or clear the filters.")}</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={clearAll}>{tr("Clear search and filters")}</Button></div>
  );

  const panel = (f: AdvisorFirm) => (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <FirmPanel f={f} client={{
        headerRight: action(f, true),
        top: states[f.id] && canAct ? <RelationBox f={f} s={states[f.id]} me={data?.me ?? null} side={side} detail={data?.orgDetail ?? null} onMessages={() => toMessages(states[f.id].conversationKey)} onEnquire={() => setEnq({ firm: f, service: null })} /> : null,
        tileAction: tileAction(f),
      }} />
    </div>
  );

  return (
    <div className={cn(`browse-head role-${side}`, "mx-auto w-full max-w-[1440px] px-4 pb-10 pt-6 md:px-8", splitFixed && "flex h-[calc(100vh-4rem)] min-h-[560px] flex-col")}>
      <div className="shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">{tr("Browse advisors")}</h1>
            <button type="button" onClick={() => setIntro({ step: 1, alone: false })} className="inline-flex h-[30px] items-center gap-1.5 rounded-full border border-[#DCDFE5] bg-card px-2.5 text-[12.5px] font-semibold text-[#394153] hover:border-[#B9C0CC] dark:border-border dark:text-foreground">
              <CircleHelp className="h-[15px] w-[15px]" />{tr("How it works")}</button>
          </div>
          <ViewToggle value={view} onChange={persist} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {needle || anyFilter || mine
            ? <>{tf("{x} of {n} firms match", { x: shown.length, n: firms.length })}{(needle || anyFilter) && <> · <button type="button" onClick={clearAll} className="font-semibold text-[#2563EB] hover:underline">{tr("Clear search and filters")}</button></>}</>
            : <><b className="text-foreground">{firms.length}</b> {tr("advisers and professional firms. Compare their services, fees and reviews, then send an enquiry.")}</>}
        </p>
        <div className="mt-5 flex gap-2.5">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-[14px] top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search firms by name, service or city")} aria-label={tr("Search firms by name, service or city")}
              className="h-11 w-full rounded-[10px] border border-border bg-card pl-10 pr-3 text-[15px] outline-none placeholder:text-muted-foreground focus:border-[var(--r-acc)] focus:ring-[3px] focus:ring-[var(--r-ring)]" />
          </div>
          <Popover open={sortOpen} onOpenChange={setSortOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[11px] border border-border bg-card px-3 text-[13.5px] hover:bg-muted">
                <ArrowDownWideNarrow className="h-4 w-4" /><span className="max-[640px]:hidden">{tr("Sort:")} {tr(SORTS.find((x) => x.v === sort)!.l)}</span><ChevronDown className="h-3.5 w-3.5" /></button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[230px] rounded-[12px] p-1.5">
              <div role="radiogroup">{SORTS.map((o) => (
                <button key={o.v} type="button" role="radio" aria-checked={sort === o.v} onClick={() => { setSort(o.v); setSortOpen(false); }} className="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-[13px] hover:bg-muted">
                  <Check className={cn("h-3.5 w-3.5", sort === o.v ? "opacity-100" : "opacity-0")} />{tr(o.l)}</button>
              ))}</div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <div role="tablist" className="inline-flex gap-1 rounded-full border border-border bg-card p-0.5">
            {([[false, "All firms", firms.length], [true, "Your advisors", Object.keys(states).filter((k) => firms.some((f) => f.id === k)).length]] as const).map(([v, l, n]) => (
              <button key={l} role="tab" aria-selected={mine === v} type="button" onClick={() => setMine(v)} title={v ? tr("Firms you've sent an enquiry to or engaged") : undefined}
                className={cn("inline-flex h-8 items-center gap-2 rounded-full px-3 text-sm font-medium", mine === v ? "bg-[#E0F5F2] font-semibold text-[#0F766E] dark:bg-[#0F766E]/25 dark:text-[#5EEAD4]" : "text-muted-foreground hover:text-foreground")}>
                {tr(l)}<span className={cn("rounded-full px-1.5 text-[11.5px] font-semibold", mine === v ? "bg-[#0F766E] text-white" : "bg-muted text-muted-foreground")}>{n}</span></button>
            ))}
          </div>
          <span className="h-6 w-px bg-[#DDE1E8] dark:bg-border" />
          <MultiPill label={tr("Service")} value={fs.svc} onChange={set("svc")} options={ADVISOR_SERVICES.map((s) => ({ value: s.name, label: tr(s.name) }))} countFor={count("svc", (f, v) => f.services.includes(v))} />
          <MultiPill label={tr("Firm type")} value={fs.type} onChange={set("type")} options={FIRM_TYPES.map((t) => ({ value: t, label: tr(t) }))} countFor={count("type", (f, v) => f.firmType === v)} />
          <MultiPill label={tr("Location")} value={fs.loc} onChange={set("loc")} options={cities.map((c) => ({ value: c, label: c }))} countFor={count("loc", (f, v) => f.city === v)} />
          <MultiPill label={tr("Deal size")} value={fs.deal} onChange={set("deal")} options={DEAL_BANDS.map((b) => ({ value: b.key, label: dealBandLabels(b.key)!.full }))} countFor={count("deal", (f, v) => f.dealBand === v)} />
          <MultiPill label={tr("Language")} value={fs.lang} onChange={set("lang")} options={LANGUAGES.map((l) => ({ value: l, label: tr(l) }))} countFor={count("lang", (f, v) => f.languages.includes(v))} />
          <button type="button" aria-pressed={verified} onClick={() => setVerified(!verified)} className={cn(pillCls(verified), "h-[34px] gap-1.5")}><ShieldCheck className="h-3.5 w-3.5" />{tr("Verified only")}</button>
          {anyFilter && <button type="button" onClick={() => { setFs({ svc: [], type: [], loc: [], deal: [], lang: [] }); setVerified(false); }} className="px-1 text-[13px] font-semibold text-[#2563EB]">{tr("Clear filters")}</button>}
        </div>
        {hints.ready && !hints.has(TIP) && (
          <div className="mt-3 flex items-start gap-2.5 rounded-[12px] border border-[#CFEAE5] bg-[#F2FAF8] py-2.5 pl-3.5 pr-3 text-[13.5px] text-[#134E4A] dark:border-[#1F5A52] dark:bg-[#10302C] dark:text-[#CCFBF1]">
            <Info className="mt-0.5 h-[17px] w-[17px] shrink-0 text-[#0F766E] dark:text-[#5EEAD4]" />
            <p className="min-w-0 flex-1">{seller ? tr("Enquiries are free on every plan. A firm sees your name, company and contact details only when you send it an enquiry; your listing and your deals stay hidden.") : tr("Enquiries are free on every plan. A firm sees your name, company and contact details only when you send it an enquiry; your investor profile and your deals stay hidden.")}{" "}
              {canAct && <button type="button" onClick={() => setIntro({ step: 2, alone: true })} className="font-semibold text-[#2563EB] hover:underline">{tr("See an example")}</button>}</p>
            <button type="button" aria-label={tr("Close")} onClick={() => void hints.dismiss(TIP)} className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] hover:bg-black/5"><X className="h-4 w-4" /></button>
          </div>
        )}
      </div>

      <div className={cn("mt-5", splitFixed && "flex min-h-0 flex-1 flex-col")}>
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[380px] rounded-[14px]" />)}</div>
        ) : shown.length === 0 ? empty : view === "grid" ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((f) => <FirmCard key={f.id} f={f} noStatus className="h-full" accent={ACCENT[side]} onClick={() => openSplit(f.id)} foot={action(f) ?? <span />} />)}
          </div>
        ) : view === "split" ? (
          <div className={splitFixed ? "grid min-h-0 flex-1 grid-cols-[372px_minmax(0,1fr)] gap-5" : "grid items-start gap-5 min-[1100px]:grid-cols-[372px_minmax(0,1fr)]"}>
            <div ref={listRef} tabIndex={-1} onKeyDown={onListKey} className={cn("space-y-[18px] outline-none", splitFixed && "min-h-0 overflow-y-auto pr-2 [scrollbar-gutter:stable]")}>
              {shown.map((f) => (
                <div key={f.id} data-key={f.id} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) setSel(f.id); }} className="rounded-[14px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--r-acc)]">
                  <FirmCard f={f} noStatus accent={ACCENT[side]} selected={wide && current?.id === f.id} onClick={() => (wide ? setSel(f.id) : setSel(sel === f.id ? null : f.id))} foot={action(f) ?? <span />} />
                  {!wide && sel === f.id && <div className="mt-3 flex flex-col">{panel(f)}</div>}
                </div>
              ))}
            </div>
            {wide && <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">{current ? panel(current) : null}</div>}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[14px] border border-[#E9EBF0] bg-card dark:border-border">
            <div className="min-w-[860px]">
              <div className="grid grid-cols-[2fr_1.6fr_92px_136px_168px] gap-4 bg-[#FAFAFB] px-[18px] py-2.5 text-[11px] font-bold uppercase text-muted-foreground dark:bg-muted/40">
                <span>{tr("Firm")}</span><span>{tr("Services")}</span><span>{tr("Rating")}</span><span>{tr("Deal size · team")}</span><span />
              </div>
              {shown.map((f) => {
                const st = stat[f.id]; const band = dealBandLabels(f.dealBand);
                return (
                  <div key={f.id} role="button" tabIndex={0} onClick={() => openSplit(f.id)} onKeyDown={(e) => { if (e.key === "Enter") openSplit(f.id); }}
                    className="grid cursor-pointer grid-cols-[2fr_1.6fr_92px_136px_168px] items-center gap-4 border-t border-[#F0F1F4] px-[18px] py-3 hover:bg-muted/40 dark:border-border">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-10 w-[60px] shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-white">{f.logoUrl ? <img src={f.logoUrl} alt="" className="max-h-8 max-w-[52px] object-contain" /> : <FirmLogo f={f} size={40} radius={6} ring={false} />}</span>
                      <div className="min-w-0"><div className="truncate text-[14px] font-semibold">{f.name}</div><div className="truncate text-[12px] text-muted-foreground">{[f.refNo, f.firmType, f.city].filter(Boolean).join(" · ")}</div>
                        {f.verifiedAt && <span className="mt-0.5 inline-flex h-5 items-center gap-1 rounded-full border border-[#BBE8CA] bg-[#E9F6EE] px-2 text-[11px] font-semibold text-[#15803D]">✓ {tr("Verified")}</span>}</div>
                    </div>
                    <div className="flex flex-wrap gap-1">{f.services.slice(0, 3).map((s) => <ServiceChip key={s} name={s} />)}{f.services.length > 3 && <span className="text-[12px] text-muted-foreground">+{f.services.length - 3}</span>}</div>
                    <div className="text-[13px]">{st.n ? <><div className="font-semibold"><span className="text-[#F59E0B]">★</span> {st.avg.toFixed(1)}</div><div className="text-[12px] text-muted-foreground">{st.n} {tr(st.n === 1 ? "review" : "reviews")}</div></> : <span className="text-[12px] text-muted-foreground">{tr("No reviews yet")}</span>}</div>
                    <div className="text-[13px]"><div>{band?.usd ?? "—"}</div><div className="text-[12px] text-muted-foreground">{f.teamSize ? `${f.teamSize} ${tr("people")}` : ""}</div></div>
                    <div className="flex justify-end">{action(f)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {intro && canAct && data && <IntroBoxes step={intro.step} setStep={(s) => setIntro({ ...intro, step: s })} alone={intro.alone} me={data.me} firm={tipFirm} onClose={closeIntro} />}
      {enq && data && <SendEnquiryDialog firm={{ id: enq.firm.id, name: enq.firm.name, services: enq.firm.services }} me={data.me} service={enq.service} onClose={() => setEnq(null)} onOpenMessages={(k) => { setEnq(null); toMessages(k); }} />}
    </div>
  );
}
