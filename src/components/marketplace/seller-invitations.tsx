import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, FileText, Lock, LockOpen, PanelRight, X } from "lucide-react";
import { listSellerInvitations, sellerNdaReview, type SellerInvitation } from "@/lib/invitations.functions";
import { decideNda } from "@/lib/pipeline.functions";
import type { PublicInvestor } from "@/lib/investor-browse";
import { Reader } from "@/components/pipeline/pipeline-dialogs";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useTr } from "@/components/common/edit-info-popup";
import { useTranslation } from "@/i18n/language";
import { STANDARD_NDA_TEXT } from "@/config/standard-nda";
import { cn } from "@/lib/utils";
import { SellerApprovedBox } from "@/components/pipeline/nda-approval";

/** Seller › Invitations (sections 6 and 10) and the Review investor dialog (section 9). */

type Tab = "current" | "nda" | "archive";
const TAB_OF: Record<SellerInvitation["status"], Tab> = { new: "current", viewed: "current", waiting: "current", approved: "nda", declined: "archive", not_interested: "archive", closed: "archive" };
const KEY = ["invitations", "seller"];

export function useSellerInvitations(enabled = true) {
  const fn = useServerFn(listSellerInvitations);
  return useQuery({ queryKey: KEY, queryFn: () => fn(), enabled, staleTime: 15_000 });
}

function useFmt() {
  const { language } = useTranslation();
  return (d: string | null) => d ? new Date(d).toLocaleDateString(language === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short" }).replace("Sept", "Sep") : "";
}

function statusView(r: SellerInvitation, tr: (e: string, t: string) => string, day: (d: string | null) => string) {
  const reason = r.closedReason === "listing_not_live" ? tr("Your listing is no longer live", "ประกาศของท่านไม่ได้เผยแพร่แล้ว")
    : r.closedReason === "profile_unpublished" ? tr("Their profile is unpublished", "โปรไฟล์ของผู้ซื้อไม่ได้เผยแพร่แล้ว") : tr("NDA ended", "NDA สิ้นสุดแล้ว");
  switch (r.status) {
    case "new": return { tone: "grey", pill: tr("Not opened yet", "ยังไม่ได้เปิดดู"), line: tr("The buyer hasn't looked yet", "ผู้ซื้อยังไม่ได้เปิดดู") };
    case "viewed": return { tone: "grey", pill: tr("Viewed your profile", "ดูประกาศของท่านแล้ว"), line: tr(`${day(r.viewedAt)} · no NDA request yet`, `${day(r.viewedAt)} · ยังไม่ได้ขอ NDA`) };
    case "waiting": return { tone: "blue", pill: tr("Needs your review", "รอท่านตรวจสอบ"), line: tr(`Buyer signed the NDA · ${day(r.ndaAt)}`, `ผู้ซื้อลงนาม NDA แล้ว · ${day(r.ndaAt)}`) };
    case "approved": return { tone: "green", pill: tr("NDA approved", "อนุมัติ NDA แล้ว"), line: tr(`Contacts shared · ${day(r.approvedAt)}`, `แชร์ข้อมูลติดต่อแล้ว · ${day(r.approvedAt)}`) };
    case "declined": return { tone: "grey", pill: tr("You declined", "ท่านปฏิเสธแล้ว"), line: tr(`Their NDA request · ${day(r.ndaAt)}`, `คำขอ NDA ของผู้ซื้อ · ${day(r.ndaAt)}`) };
    case "not_interested": return { tone: "grey", pill: tr("Not interested", "ไม่สนใจ"), line: tr(`The buyer passed · ${day(r.choiceAt)}`, `ผู้ซื้อไม่สนใจ · ${day(r.choiceAt)}`) };
    default: return { tone: "grey", pill: tr("Closed", "ปิดแล้ว"), line: `${reason} · ${day(r.closedAt)}`, reason };
  }
}

const PILL: Record<string, string> = {
  blue: "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]",
  green: "border-[#BBE8CA] bg-[#E9F6EE] text-[#15803D]",
  grey: "border-[#E5E7EB] bg-[#F3F4F6] text-[#4B5563]",
};
function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex h-6 w-fit items-center whitespace-nowrap rounded-full border px-2.5 text-[12.5px] font-semibold", PILL[tone])}>{children}</span>;
}

const initials = (s: string | null | undefined) => (s ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "IN";
const typeOf = (i: PublicInvestor | null) => i?.codeName || "Investor";

const B = "inline-flex h-10 items-center justify-center gap-[7px] rounded-[10px] px-[15px] text-[14px] font-semibold disabled:opacity-40";
const OUTLINE = cn(B, "border border-[#DCDFE5] bg-card hover:bg-muted dark:border-border");
const NAVY = cn(B, "bg-[#1E2A4A] text-white hover:bg-[#2A3860] dark:bg-[#E8ECF5] dark:text-[#1E2A4A]");

/** Approve / Decline, shared by the panel and the dialog. Approve does what Pipeline's Approve does. */
function useDecide() {
  const fn = useServerFn(decideNda);
  const qc = useQueryClient();
  return async (pipelineId: string, approve: boolean, consent?: string) => {
    await fn({ data: { id: pipelineId, approve, consent } });
    for (const k of [["invitations"], ["connect-states"], ["pipeline"], ["plan-strip"]]) qc.invalidateQueries({ queryKey: k });
  };
}

function ApproveButton({ disabled, busy, onClick }: { disabled: boolean; busy: boolean; onClick: () => void }) {
  const tr = useTr();
  const btn = <button type="button" disabled={disabled || busy} onClick={onClick} className={cn(NAVY, "h-11")}>{tr("Approve NDA", "อนุมัติ NDA")}</button>;
  if (!disabled) return btn;
  return <span tabIndex={0} title={tr("Tick the box to approve", "ทำเครื่องหมายในช่องเพื่ออนุมัติ")}>{btn}</span>;
}

export function SellerInvitationsPage({ openId }: { openId?: string }) {
  const tr = useTr();
  const day = useFmt();
  const navigate = useNavigate();
  const { data: rows = [], isLoading } = useSellerInvitations();
  const [tab, setTab] = useState<Tab>("current");
  const [panelId, setPanelId] = useState<string | null>(null);
  const opened = useRef(false);

  const byTab = (t: Tab) => rows.filter((r) => TAB_OF[r.status] === t);
  const list = byTab(tab);
  const open = (id: string) => {
    const r = rows.find((x) => x.id === id);
    if (!r) return;
    setTab(TAB_OF[r.status]);
    setPanelId(id);
  };
  useEffect(() => {
    if (openId && rows.length && !opened.current) { opened.current = true; open(openId); }
  }, [openId, rows.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = panelId ? rows.find((r) => r.id === panelId) ?? null : null;
  // The panel stays on its row while the row moves tab.
  useEffect(() => { if (current && TAB_OF[current.status] !== tab) setTab(TAB_OF[current.status]); }, [current?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const ids = current ? byTab(TAB_OF[current.status]).map((x) => x.id) : [];
  const at = current ? ids.indexOf(current.id) : -1;
  const close = () => { setPanelId(null); if (openId) navigate({ to: "/marketplace/invitations", search: {}, replace: true }); };

  const tabs: Array<[Tab, string]> = [["current", tr("Current", "ปัจจุบัน")], ["nda", "NDA"], ["archive", tr("Archive", "เก็บถาวร")]];
  const empty = { current: tr("Nothing in progress.", "ไม่มีรายการที่กำลังดำเนินการ"), nda: tr("No approved NDAs yet.", "ยังไม่มี NDA ที่อนุมัติ"), archive: tr("Nothing in the archive.", "ไม่มีรายการในที่เก็บถาวร") }[tab];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-['Space_Grotesk'] text-[30px] font-bold tracking-[-0.01em]">{tr("Invitations", "คำเชิญ")}</h1>
        <p className="mt-1 text-[14px] text-[#434A5C] dark:text-muted-foreground">{tr("Buyers you invited with Connect. Open one to see their profile and answer their NDA request.", "ผู้ซื้อที่ท่านเชิญด้วยการเชื่อมต่อ เปิดดูโปรไฟล์และตอบคำขอ NDA ของผู้ซื้อ")}</p>
      </div>
      <div role="tablist" className="flex gap-7 border-b border-[#E3E6EC] dark:border-border">
        {tabs.map(([k, label]) => {
          const on = tab === k;
          return (
            <button key={k} type="button" role="tab" aria-selected={on} onClick={() => setTab(k)}
              className={cn("-mb-px flex h-[42px] items-center gap-2 border-b-2 text-[14.5px] font-semibold", on ? "border-[#1E2A4A] text-[#151A28] dark:border-foreground dark:text-foreground" : "border-transparent text-[#6B7280]")}>
              {label}
              <span className={cn("inline-flex h-5 min-w-[22px] items-center justify-center rounded-full px-[7px] text-[12px] font-bold", on ? "bg-[#1E2A4A] text-white dark:bg-foreground dark:text-background" : "bg-[#EEF0F3] text-[#434A5C] dark:bg-muted dark:text-muted-foreground")}>{byTab(k).length}</span>
            </button>
          );
        })}
      </div>
      <div className="overflow-hidden rounded-[14px] border border-[#E9EBF0] bg-card dark:border-border">
        <div className="grid grid-cols-[minmax(0,1fr)_70px_232px_148px] gap-4 px-[18px] py-2.5 text-[11px] font-bold uppercase tracking-[.07em] text-[#6B7280] max-md:hidden">
          <span>{tr("Buyer", "ผู้ซื้อ")}</span><span>{tr("Invited", "เชิญเมื่อ")}</span><span>{tr("Status", "สถานะ")}</span><span />
        </div>
        {isLoading ? <p className="p-7 text-center text-[13.5px] text-[#6B7280]">{tr("Loading…", "กำลังโหลด…")}</p>
          : !list.length ? <p className="p-7 text-center text-[13.5px] text-[#6B7280]">{empty}</p>
          : list.map((r) => {
            const sv = statusView(r, tr, day);
            const i = r.investor;
            const mine = r.status === "waiting";
            const active = current?.id === r.id;
            return (
              <div key={r.id} onClick={() => open(r.id)}
                className={cn("grid cursor-pointer grid-cols-[minmax(0,1fr)_70px_232px_148px] items-center gap-4 border-t border-[#F0F1F4] px-[18px] py-[14px] max-md:grid-cols-1 max-md:gap-2 dark:border-border",
                  active ? "bg-[#EEF2FF] shadow-[inset_3px_0_0_#1E2A4A] dark:bg-muted" : mine ? "bg-[#F8FAFF] dark:bg-muted/40" : "hover:bg-muted/40")}>
                <div className="min-w-0">
                  <div className={cn("truncate text-[14.5px] text-[#151A28] dark:text-foreground", mine ? "font-bold" : "font-semibold")}>{typeOf(i)}</div>
                  <div className="truncate text-[12.5px] text-[#6B7280]">{[i?.refNo, i?.country].filter(Boolean).join(" · ")}</div>
                  {i && (i.ticketLabel || i.geography) && <div className="truncate text-[12.5px] text-[#434A5C] dark:text-muted-foreground">{[i.ticketLabel && `${tr("Ticket size", "ขนาดการลงทุน")} ${i.ticketLabel}`, i.geography && `${tr("Invests in", "ลงทุนใน")} ${i.geography}`].filter(Boolean).join(" · ")}</div>}
                </div>
                <span className="text-[13px] text-[#434A5C] dark:text-muted-foreground">{day(r.sentAt)}</span>
                <div className="flex min-w-0 flex-col gap-1"><Pill tone={sv.tone}>{sv.pill}</Pill><span className="whitespace-nowrap text-[12.5px] text-[#6B7280]">{sv.line}</span></div>
                <button type="button" aria-haspopup="dialog" onClick={(e) => { e.stopPropagation(); open(r.id); }}
                  className="inline-flex h-[34px] w-[148px] items-center justify-center gap-[7px] justify-self-end rounded-[9px] border border-[#DCDFE5] bg-card text-[13px] font-semibold hover:bg-muted max-md:justify-self-start dark:border-border">
                  <PanelRight className="h-[15px] w-[15px]" />{tr("View buyer", "ดูผู้ซื้อ")}
                </button>
              </div>
            );
          })}
      </div>
      {current && (
        <SellerPanel key={current.id} r={current} index={Math.max(0, at)} total={ids.length}
          onPrev={() => at > 0 && setPanelId(ids[at - 1]!)}
          onNext={() => at < ids.length - 1 && setPanelId(ids[at + 1]!)}
          onClose={close} />
      )}
    </div>
  );
}

function Figures({ i }: { i: PublicInvestor }) {
  const tr = useTr();
  const figures = ([
    [tr("Ticket size", "ขนาดการลงทุน"), i.ticketLabel],
    [tr("Min. target revenue", "รายได้เป้าหมายขั้นต่ำ"), i.revLabel],
    [tr("Invests in", "ลงทุนใน"), i.geography],
    [tr("Sectors", "อุตสาหกรรม"), i.sectors?.length ? i.sectors.slice(0, 3).join(", ") : null],
  ] as Array<[string, string | null | undefined]>).filter(([, v]) => !!v) as Array<[string, string]>;
  if (!figures.length) return null;
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[12px] border border-[#E9EBF0] bg-[#E9EBF0] dark:border-border dark:bg-border">
      {figures.map(([k, v]) => (
        <div key={k} className="bg-card px-[14px] py-[11px]">
          <div className="text-[12px] text-[#6B7280]">{k}</div>
          <div className="text-[14.5px] font-bold">{v}</div>
        </div>
      ))}
    </div>
  );
}

function SellerPanel({ r, index, total, onPrev, onNext, onClose }: { r: SellerInvitation; index: number; total: number; onPrev: () => void; onNext: () => void; onClose: () => void }) {
  const tr = useTr();
  const day = useFmt();
  const ref = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLElement | null>(null);
  useEffect(() => {
    back.current = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => back.current?.focus?.();
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const trap = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !ref.current) return;
    const f = ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input, [tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last!.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first!.focus(); }
  };

  const sv = statusView(r, tr, day);
  const i = r.investor;
  const approved = r.status === "approved";
  const gone = r.status === "closed" && r.closedReason === "profile_unpublished";
  const looks = i ? [...(i.dealTypes ?? []), ...(i.stages ?? [])].slice(0, 3) : [];
  const navBtn = "grid h-[34px] w-[34px] place-items-center rounded-[9px] border border-[#E5E7EB] aria-disabled:cursor-default aria-disabled:text-[#C3C8D2] dark:border-border";
  const terms = `${r.listingName}${r.listingRef ? ` (${r.listingRef})` : ""} ${tr("and", "และ")} ${typeOf(i)}${i?.refNo ? ` (${i.refNo})` : ""} · ${tr("2 years from the day you approve", "2 ปีนับจากวันที่ท่านอนุมัติ")} · ${tr("Only to consider this deal.", "ใช้เพื่อพิจารณาดีลนี้เท่านั้น")}`;

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 bg-[rgba(16,24,40,.45)]" onClick={onClose} />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={typeOf(i)} onKeyDown={trap}
        className="fixed inset-y-0 right-0 z-50 flex w-[560px] max-w-full flex-col bg-card shadow-[-16px_0_40px_rgba(16,24,40,.18)] outline-none motion-safe:animate-in motion-safe:slide-in-from-right motion-safe:duration-[250ms] max-[640px]:w-full">
        <div className="flex h-[58px] shrink-0 items-center gap-2 border-b border-[#EEF0F3] pl-6 pr-4 dark:border-border">
          <span className="text-[13px] font-semibold text-[#6B7280]">{tr(`Buyer ${index + 1} of ${total}`, `ผู้ซื้อรายที่ ${index + 1} จาก ${total}`)}</span>
          <button type="button" aria-label={tr("Previous buyer", "ผู้ซื้อก่อนหน้า")} aria-disabled={index === 0 || undefined} onClick={() => index > 0 && onPrev()} className={navBtn}><ChevronLeft className="h-[17px] w-[17px]" /></button>
          <button type="button" aria-label={tr("Next buyer", "ผู้ซื้อถัดไป")} aria-disabled={index >= total - 1 || undefined} onClick={() => index < total - 1 && onNext()} className={navBtn}><ChevronRight className="h-[17px] w-[17px]" /></button>
          <button type="button" aria-label={tr("Close", "ปิด")} onClick={onClose} className="ml-auto grid h-[34px] w-[34px] place-items-center rounded-[9px] hover:bg-muted"><X className="h-[18px] w-[18px]" /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-[18px] overflow-y-auto p-6">
          <div>
            <div className="flex items-center gap-[14px]">
              <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[14px] bg-[#EEF0FF] font-['Space_Grotesk'] text-[17px] font-bold text-[#4338CA]">{initials(typeOf(i))}</span>
              <div className="min-w-0">
                <h2 className="font-['Space_Grotesk'] text-[22px] font-bold">{typeOf(i)}</h2>
                <p className="text-[13px] text-[#6B7280]">{[i?.refNo, i?.country].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
            <div className="mt-2.5 flex items-center gap-1.5"><Pill tone={sv.tone}>{sv.pill}</Pill><span className="text-[12.5px] text-[#6B7280]">· {tr(`Invited ${day(r.sentAt)}`, `เชิญเมื่อ ${day(r.sentAt)}`)}</span></div>
          </div>
          {!gone && i && (
            <>
              {approved && r.investorName && (
                <div className="rounded-[12px] border border-[#BBE8CA] bg-[#F3FBF6] px-[14px] py-3 dark:bg-transparent">
                  <div className="text-[12px] font-semibold text-[#15803D]">{tr("Name", "ชื่อ")}</div>
                  <div className="text-[15px] font-bold">{r.investorName}</div>
                  <div className="text-[13px] text-[#434A5C] dark:text-muted-foreground">{tr("Their email and phone are in Pipeline › Contacts.", "อีเมลและโทรศัพท์ของผู้ซื้ออยู่ใน Pipeline › รายชื่อติดต่อ")}</div>
                </div>
              )}
              {i.description && <p className="text-[14px] text-[#434A5C] dark:text-muted-foreground">{i.description}</p>}
              <Figures i={i} />
              {looks.length > 0 && (
                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-[.07em] text-[#6B7280]">{tr("What they look for", "สิ่งที่ผู้ซื้อมองหา")}</div>
                  <ul className="space-y-1.5">{looks.map((x) => <li key={x} className="flex items-start gap-2 text-[13.5px]"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#15803D]" />{x}</li>)}</ul>
                </div>
              )}
              {r.status === "waiting" && (
                <div className="rounded-[12px] border border-[#FDE68A] bg-[#FFFBEB] px-4 py-[14px] dark:bg-transparent">
                  <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#92400E]"><FileText className="h-[15px] w-[15px]" />{tr(`The NDA they signed · ${day(r.ndaAt)}`, `NDA ที่ผู้ซื้อลงนาม · ${day(r.ndaAt)}`)}</div>
                  <p className="mt-2 text-[13px] text-[#434A5C] dark:text-muted-foreground">{terms}</p>
                  <div className="mt-2"><Reader label={tr("Read the NDA", "อ่าน NDA")} text={STANDARD_NDA_TEXT} /></div>
                </div>
              )}
              {!approved && (
                <div className="flex items-start gap-2.5 rounded-[12px] bg-[#F6F7F9] px-[14px] py-3 text-[13px] text-[#434A5C] dark:bg-muted dark:text-muted-foreground">
                  <Lock className="mt-0.5 h-[15px] w-[15px] shrink-0" />
                  {tr("Their name, email and phone open once you approve their NDA. Your company name stays hidden until then too.", "ชื่อ อีเมล และโทรศัพท์ของผู้ซื้อจะเปิดเผยเมื่อท่านอนุมัติ NDA ชื่อบริษัทของท่านก็จะถูกซ่อนไว้จนถึงตอนนั้นเช่นกัน")}
                </div>
              )}
            </>
          )}
        </div>
        <SellerDecisionBar r={r} reason={(sv as { reason?: string }).reason} onClose={onClose} />
      </div>
    </>,
    document.body,
  );
}

function SellerDecisionBar({ r, reason, onClose }: { r: SellerInvitation; reason?: string; onClose: () => void }) {
  const tr = useTr();
  const day = useFmt();
  const qc = useQueryClient();
  const decide = useDecide();
  const [tick, setTick] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => setTick(false), [r.id, r.status]);
  const line = "flex-1 text-[13.5px] text-[#434A5C] dark:text-muted-foreground";
  const consent = tr("I have reviewed this buyer and the NDA they signed.", "ข้าพเจ้าได้ตรวจสอบผู้ซื้อรายนี้และ NDA ที่ผู้ซื้อลงนามแล้ว");

  const act = async (approve: boolean) => {
    if (!r.pipelineId) return;
    setBusy(true);
    try {
      await decide(r.pipelineId, approve, approve ? `${consent} (on behalf of ${r.companyName ?? r.listingName})` : undefined);
      qc.setQueryData<SellerInvitation[]>(KEY, (prev) => prev?.map((x) => x.id === r.id ? { ...x, status: approve ? "approved" : "declined", ...(approve ? { approvedAt: new Date().toISOString() } : { declinedAt: new Date().toISOString() }) } : x));
      toast.success(approve ? tr("NDA approved. The buyer is in the NDA tab and in your contacts.", "อนุมัติ NDA แล้ว ผู้ซื้ออยู่ในแท็บ NDA และในรายชื่อติดต่อของท่าน") : tr("Declined. The buyer is told, and it's in Archive now.", "ปฏิเสธแล้ว ผู้ซื้อได้รับแจ้ง และย้ายไปที่เก็บถาวรแล้ว"));
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  let body: React.ReactNode;
  if (r.status === "waiting") {
    body = (
      <div className="w-full">
        <label className="flex cursor-pointer items-start gap-2.5 text-[13.5px]">
          <input type="checkbox" checked={tick} onChange={(e) => setTick(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#1E2A4A]" />
          {consent}
        </label>
        <div className="mt-[14px] flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={() => act(false)} className={OUTLINE}>{tr("Decline", "ปฏิเสธ")}</button>
          <ApproveButton disabled={!tick} busy={busy} onClick={() => act(true)} />
        </div>
      </div>
    );
  } else if (r.status === "approved") {
    body = (
      <>
        <span className={line}>{tr(`NDA approved on ${day(r.approvedAt)}.`, `อนุมัติ NDA เมื่อ ${day(r.approvedAt)}`)}</span>
        <Link to="/marketplace/pipeline" className={OUTLINE}>{tr("Open in Pipeline", "เปิดใน Pipeline")}</Link>
        <Link to="/marketplace/messages" className={NAVY}>{tr("Message buyer", "ส่งข้อความถึงผู้ซื้อ")}</Link>
      </>
    );
  } else {
    const text = r.status === "new" ? tr("They haven't opened your listed profile yet. Their NDA request will show here.", "ผู้ซื้อยังไม่ได้เปิดดูประกาศของท่าน คำขอ NDA ของผู้ซื้อจะแสดงที่นี่")
      : r.status === "viewed" ? tr(`They viewed your listed profile on ${day(r.viewedAt)}. Waiting for their NDA request.`, `ผู้ซื้อดูประกาศของท่านเมื่อ ${day(r.viewedAt)} รอคำขอ NDA`)
      : r.status === "declined" ? tr(`You declined their NDA request on ${day(r.declinedAt ?? r.ndaAt)}.`, `ท่านปฏิเสธคำขอ NDA เมื่อ ${day(r.declinedAt ?? r.ndaAt)}`)
      : r.status === "not_interested" ? tr(`The buyer isn't interested (${day(r.choiceAt)}).`, `ผู้ซื้อไม่สนใจ (${day(r.choiceAt)})`)
      : `${reason ?? ""}.`;
    body = <><span className={line}>{text}</span><button type="button" onClick={onClose} className={OUTLINE}>{tr("Close", "ปิด")}</button></>;
  }
  return <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[#EEF0F3] px-6 py-4 dark:border-border">{body}</div>;
}

/** Review investor (section 9): opens over the current page for a waiting NDA request. */
export function ReviewInvestorDialog({ pipelineId, onClose }: { pipelineId: string; onClose: () => void }) {
  const tr = useTr();
  const day = useFmt();
  const navigate = useNavigate();
  const fn = useServerFn(sellerNdaReview);
  const decide = useDecide();
  const { data: d, error } = useQuery({ queryKey: ["nda-review", pipelineId], queryFn: () => fn({ data: { pipelineId } }), staleTime: 0 });
  const [tick, setTick] = useState(false);
  const [busy, setBusy] = useState(false);
  const [approvedId, setApprovedId] = useState<string | null>(null);

  useEffect(() => {
    if (!d?.answered || approvedId) return;
    toast(tr("This NDA request has already been answered.", "คำขอ NDA นี้ได้รับการตอบแล้ว"));
    onClose();
    if (d.invitationId) navigate({ to: "/marketplace/invitations", search: { open: d.invitationId } });
  }, [d?.answered]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (error) { toast.error((error as Error).message); onClose(); } }, [error]); // eslint-disable-line react-hooks/exhaustive-deps

  const i = d?.investor ?? null;
  const company = d?.companyName ?? d?.listingName ?? "";
  const consent = tr(`I have read the NDA and approve it on behalf of ${company}.`, `ข้าพเจ้าได้อ่าน NDA และอนุมัติในนามของ ${company}`);
  const act = async (approve: boolean) => {
    setBusy(true);
    try {
      await decide(pipelineId, approve, approve ? consent : undefined);
      if (approve) { setApprovedId(pipelineId); return; }
      toast.success(tr("NDA request declined. The investor is told.", "ปฏิเสธคำขอ NDA แล้ว นักลงทุนได้รับแจ้ง"));
      onClose();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const rows: Array<[string, string | null | undefined]> = i ? [
    [tr("Type", "ประเภท"), i.codeName], [tr("Based in", "ตั้งอยู่ที่"), [i.city, i.country].filter(Boolean).join(", ")],
    [tr("Ticket size", "ขนาดการลงทุน"), i.ticketLabel], [tr("Min. revenue", "รายได้ขั้นต่ำ"), i.revLabel], [tr("Invests in", "ลงทุนใน"), i.geography],
  ] : [];
  const terms: Array<[string, string]> = [
    [tr("Parties", "คู่สัญญา"), `${d?.listingName ?? ""}${d?.listingRef ? ` (${d.listingRef})` : ""} ${tr("and", "และ")} ${typeOf(i)}${i?.refNo ? ` (${i.refNo})` : ""}`],
    [tr("Term", "ระยะเวลา"), tr("2 years ", "2 ปีนับจากวันที่ท่านอนุมัติ")],
    [tr("Use", "การใช้"), tr("Only to consider this deal", "ใช้เพื่อพิจารณาดีลนี้เท่านั้น")],
    [tr("Contact", "การติดต่อ"), tr("No direct contact with your staff, customers or suppliers", "ห้ามติดต่อพนักงาน ลูกค้า หรือซัพพลายเออร์ของท่านโดยตรง")],
    [tr("Non-solicitation", "การไม่ชักชวน"), tr("12 months", "12 เดือน")],
  ];
  const box = "rounded-[12px] border border-[#E9EBF0] px-4 py-[14px] dark:border-border";
  const label = "mb-2 text-[11px] font-bold uppercase tracking-[.07em] text-[#6B7280]";

  if (approvedId) return <SellerApprovedBox pipelineId={approvedId} onClose={onClose} />;
  return (
    <Dialog open={!!d && !d.answered} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[760px] max-w-[calc(100vw-32px)] rounded-[16px] p-6 sm:max-w-[760px]">
        <div className="text-[11px] font-bold uppercase tracking-[.07em] text-[#6B7280]">{tr("NDA to approve", "NDA ที่รออนุมัติ")} · {i?.refNo}</div>
        <DialogTitle className="mt-1 font-['Space_Grotesk'] text-[21px] font-bold">{tr("Review investor", "ตรวจสอบนักลงทุน")}</DialogTitle>
        <DialogDescription className="text-[14.5px] text-[#434A5C] dark:text-muted-foreground">{tr("The investor signed PitchSnack's standard mutual NDA.  Review investor profile and the NDA agreement.  You decide to approve or decline. ", "นักลงทุนลงนาม NDA มาตรฐานของ PitchSnack และส่งถึงท่าน ตรวจสอบโปรไฟล์และ NDA แล้วอนุมัติหรือปฏิเสธ")}</DialogDescription>
        <span className="mt-1 inline-flex h-7 w-fit items-center gap-1.5 rounded-full border border-[#BBE8CA] bg-[#E9F6EE] px-3 text-[12.5px] font-semibold text-[#15803D]"><Check className="h-3.5 w-3.5" />{tr(`Signed by the investor · ${day(d?.signedAt ?? null)}`, `นักลงทุนลงนามแล้ว · ${day(d?.signedAt ?? null)}`)}</span>
        <div className="mt-2 grid gap-3 min-[720px]:grid-cols-2">
          <div className={box}>
            <div className={label}>{tr("Investor profile · name hidden", "โปรไฟล์นักลงทุน · ซ่อนชื่อ")}</div>
            {i?.description && <p className="mb-2 text-[13.5px] text-[#434A5C] dark:text-muted-foreground">{tr("About the company", "เกี่ยวกับบริษัท")}</p>}
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13.5px]">
              {rows.filter(([, v]) => !!v).flatMap(([k, v]) => [<dt key={`${k}-k`} className="text-[#6B7280]">{k}</dt>, <dd key={`${k}-v`} className="font-medium">{v}</dd>])}
            </dl>
          </div>
          <div className={box}>
            <div className={label}>{tr("NDA AGREEMENT", "ข้อตกลง NDA")}</div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13.5px]">
              {terms.flatMap(([k, v]) => [<dt key={`${k}-k`} className="text-[#6B7280]">{k}</dt>, <dd key={`${k}-v`} className="font-medium">{v}</dd>])}
            </dl>
            <div className="mt-3"><Reader label="NDA" openText={tr("Read the full NDA", "อ่าน NDA ฉบับเต็ม")} hideText={tr("Hide the full NDA", "ซ่อน NDA ฉบับเต็ม")} text={STANDARD_NDA_TEXT} /></div>
          </div>
        </div>
        <p className="mt-1 flex items-start gap-2 text-[13.5px] text-[#434A5C] dark:text-muted-foreground"><LockOpen className="mt-0.5 h-4 w-4 shrink-0 text-[#15803D]" />{tr("When you approve, you both see each other's names, exact figures, email and phone, you're added to each other's contact list, and you can message each other.", "เมื่อท่านอนุมัติ ทั้งสองฝ่ายจะเห็นชื่อ ตัวเลขที่แน่นอน อีเมลและโทรศัพท์ของกันและกัน เพิ่มในรายชื่อติดต่อของกันและกัน และส่งข้อความหากันได้")}</p>
        <label className="flex cursor-pointer items-start gap-2.5 rounded-[12px] border border-[#E5E7EB] px-[14px] py-3 text-[13.5px] dark:border-border">
          <input type="checkbox" checked={tick} onChange={(e) => setTick(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#1E2A4A]" />
          {consent}
        </label>
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={() => act(false)} className={OUTLINE}>{tr("Decline", "ปฏิเสธ")}</button>
          <ApproveButton disabled={!tick} busy={busy} onClick={() => act(true)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
