import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Lock, LockOpen, PanelRight, Star, X } from "lucide-react";
import { listMyInvitations, openInvitation, setInvitationChoice, myInvitedListings, type BuyerInvitation } from "@/lib/invitations.functions";
import { requestNda } from "@/lib/pipeline.functions";
import { SectorArt } from "@/components/hidden-profile/bits";
import { useSavedListings, useInvalidateListings } from "@/components/marketplace/listing-panel";
import { Reader } from "@/components/pipeline/pipeline-dialogs";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useTr } from "@/components/common/edit-info-popup";
import { useTranslation } from "@/i18n/language";
import { STANDARD_NDA_TEXT } from "@/config/standard-nda";
import { cn } from "@/lib/utils";

/** Buyer › Invitations (sections 6–7): sellers who invited this buyer's organisation. */

export function useMyInvitations(enabled = true) {
  const fn = useServerFn(listMyInvitations);
  return useQuery({ queryKey: ["invitations", "buyer"], queryFn: () => fn(), enabled, staleTime: 15_000 });
}

/** Listing ids with an invitation still New or Viewed (Invited you chip + no plan limit). */
export function useInvitedListings() {
  const fn = useServerFn(myInvitedListings);
  const { data } = useQuery({ queryKey: ["invitations", "invited-ids"], queryFn: () => fn(), staleTime: 15_000 });
  return useMemo(() => new Set(data ?? []), [data]);
}

export function InvitedYouChip() {
  const tr = useTr();
  return (
    <span className="inline-flex h-[26px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-[#EEF0FF] px-2.5 text-[12.5px] font-semibold text-[#4338CA]">
      <svg aria-hidden viewBox="0 0 24 24" className="h-[13px] w-[13px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" /><path d="m21.854 2.147-10.94 10.939" /></svg>
      {tr("Invited you", "เชิญท่าน")}
    </span>
  );
}

type Tab = "current" | "nda" | "archive";
const TAB_OF: Record<BuyerInvitation["status"], Tab> = { new: "current", viewed: "current", waiting: "current", approved: "nda", declined: "archive", not_interested: "archive", closed: "archive" };

function useFmt() {
  const { language } = useTranslation();
  return (d: string | null) => d ? new Date(d).toLocaleDateString(language === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short" }).replace("Sept", "Sep") : "";
}

function statusView(r: BuyerInvitation, tr: (e: string, t: string) => string, day: (d: string | null) => string) {
  const reason = r.closedReason === "listing_not_live" ? tr("Listing no longer live", "ประกาศไม่ได้เผยแพร่แล้ว")
    : r.closedReason === "profile_unpublished" ? tr("Your profile is unpublished", "โปรไฟล์ของท่านไม่ได้เผยแพร่") : tr("NDA ended", "NDA สิ้นสุดแล้ว");
  switch (r.status) {
    case "new": return { tone: "blue", pill: tr("New", "ใหม่"), line: tr("Not opened yet", "ยังไม่ได้เปิดดู") };
    case "viewed": return { tone: "blue", pill: tr("Viewed", "ดูแล้ว"), line: tr(`${day(r.viewedAt)} · no NDA request yet`, `${day(r.viewedAt)} · ยังไม่ได้ขอ NDA`) };
    case "waiting": return { tone: "grey", pill: tr("Waiting for the seller", "รอผู้ขาย"), line: tr(`You signed the NDA · ${day(r.ndaAt)}`, `ท่านลงนาม NDA แล้ว · ${day(r.ndaAt)}`) };
    case "approved": return { tone: "green", pill: tr("NDA approved", "อนุมัติ NDA แล้ว"), line: tr(`Contacts shared · ${day(r.approvedAt)}`, `แชร์ข้อมูลติดต่อแล้ว · ${day(r.approvedAt)}`) };
    case "declined": return { tone: "grey", pill: tr("Seller declined", "ผู้ขายปฏิเสธ"), line: tr(`Your NDA request · ${day(r.ndaAt)}`, `คำขอ NDA ของท่าน · ${day(r.ndaAt)}`) };
    case "not_interested": return { tone: "grey", pill: tr("Not interested", "ไม่สนใจ"), line: tr(`You passed · ${day(r.choiceAt)}`, `ท่านผ่าน · ${day(r.choiceAt)}`) };
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

export function BuyerInvitationsPage({ openId }: { openId?: string }) {
  const tr = useTr();
  const day = useFmt();
  const navigate = useNavigate();
  const { data: rows = [], isLoading } = useMyInvitations();
  const [tab, setTab] = useState<Tab>("current");
  const [panel, setPanel] = useState<{ ids: string[]; at: number } | null>(null);
  const opened = useRef(false);

  const byTab = (t: Tab) => rows.filter((r) => TAB_OF[r.status] === t);
  const list = byTab(tab);
  const open = (id: string) => {
    const r = rows.find((x) => x.id === id);
    if (!r) return;
    const t = TAB_OF[r.status];
    setTab(t);
    const ids = byTab(t).map((x) => x.id);
    setPanel({ ids, at: Math.max(0, ids.indexOf(id)) });
  };
  useEffect(() => {
    if (openId && rows.length && !opened.current) { opened.current = true; open(openId); }
  }, [openId, rows.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const close = () => { setPanel(null); if (openId) navigate({ to: "/marketplace/invitations", search: {}, replace: true }); };
  const current = panel ? rows.find((r) => r.id === panel.ids[panel.at]) ?? null : null;

  const tabs: Array<[Tab, string]> = [["current", tr("Current", "ปัจจุบัน")], ["nda", "NDA"], ["archive", tr("Archive", "เก็บถาวร")]];
  const empty = { current: tr("Nothing in progress.", "ไม่มีรายการที่กำลังดำเนินการ"), nda: tr("No approved NDAs yet.", "ยังไม่มี NDA ที่อนุมัติ"), archive: tr("Nothing in the archive.", "ไม่มีรายการในที่เก็บถาวร") }[tab];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-['Space_Grotesk'] text-[30px] font-bold tracking-[-0.01em]">{tr("Invitations", "คำเชิญ")}</h1>
        <p className="mt-1 text-[14px] text-[#434A5C] dark:text-muted-foreground">{tr("Sellers who invited you to view their listed profile. Open one to see the details and decide.", "ผู้ขายที่เชิญท่านให้ดูโปรไฟล์ที่ประกาศไว้ เปิดดูรายละเอียดและตัดสินใจ")}</p>
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
          <span>{tr("Listing", "ประกาศ")}</span><span>{tr("Invited", "เชิญเมื่อ")}</span><span>{tr("Status", "สถานะ")}</span><span />
        </div>
        {isLoading ? <p className="p-7 text-center text-[13.5px] text-[#6B7280]">{tr("Loading…", "กำลังโหลด…")}</p>
          : !list.length ? <p className="p-7 text-center text-[13.5px] text-[#6B7280]">{empty}</p>
          : list.map((r) => {
            const sv = statusView(r, tr, day);
            const l = r.teaser?.listing;
            const mine = r.status === "new";
            const active = current?.id === r.id;
            return (
              <div key={r.id} onClick={() => open(r.id)}
                className={cn("grid cursor-pointer grid-cols-[minmax(0,1fr)_70px_232px_148px] items-center gap-4 border-t border-[#F0F1F4] px-[18px] py-[14px] max-md:grid-cols-1 max-md:gap-2 dark:border-border",
                  active ? "bg-[#EEF2FF] shadow-[inset_3px_0_0_#1E2A4A] dark:bg-muted" : mine ? "bg-[#F8FAFF] dark:bg-muted/40" : "hover:bg-muted/40")}>
                <div className="min-w-0">
                  <div className={cn("truncate text-[14.5px] text-[#151A28] dark:text-foreground", mine ? "font-bold" : "font-semibold")}>{r.name}</div>
                  <div className="truncate text-[12.5px] text-[#6B7280]">{[r.refNo, l?.sector, l?.location?.replace(/, Thailand$/, "")].filter(Boolean).join(" · ")}</div>
                  {l && <div className="truncate text-[12.5px] text-[#434A5C] dark:text-muted-foreground">{[l.revenueBand && `${tr("Revenue", "รายได้")} ${l.revenueBand}`, r.teaser?.priceBand ? `${tr("Asking", "ราคาเสนอขาย")} ${tr(r.teaser.priceBand.label, r.teaser.priceBand.th)}` : tr("Asking on request", "ราคาตามคำขอ")].filter(Boolean).join(" · ")}</div>}
                </div>
                <span className="text-[13px] text-[#434A5C] dark:text-muted-foreground">{day(r.sentAt)}</span>
                <div className="flex min-w-0 flex-col gap-1"><Pill tone={sv.tone}>{sv.pill}</Pill><span className="whitespace-nowrap text-[12.5px] text-[#6B7280]">{sv.line}</span></div>
                <button type="button" aria-haspopup="dialog" onClick={(e) => { e.stopPropagation(); open(r.id); }}
                  className="inline-flex h-[34px] w-[148px] items-center justify-center gap-[7px] justify-self-end rounded-[9px] border border-[#DCDFE5] bg-card text-[13px] font-semibold hover:bg-muted max-md:justify-self-start dark:border-border">
                  <PanelRight className="h-[15px] w-[15px]" />{tr("View company", "ดูบริษัท")}
                </button>
              </div>
            );
          })}
      </div>
      {panel && current && (
        <InvitationPanel key={current.id} r={current} index={panel.at} total={panel.ids.length}
          onPrev={() => setPanel((p) => p && p.at > 0 ? { ...p, at: p.at - 1 } : p)}
          onNext={() => setPanel((p) => p && p.at < p.ids.length - 1 ? { ...p, at: p.at + 1 } : p)}
          onClose={close} />
      )}
    </div>
  );
}

function InvitationPanel({ r, index, total, onPrev, onNext, onClose }: { r: BuyerInvitation; index: number; total: number; onPrev: () => void; onNext: () => void; onClose: () => void }) {
  const tr = useTr();
  const day = useFmt();
  const qc = useQueryClient();
  const openFn = useServerFn(openInvitation);
  const ref = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLElement | null>(null);

  useEffect(() => {
    back.current = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => back.current?.focus?.();
  }, []);
  useEffect(() => {
    if (r.status !== "new") return;
    qc.setQueryData<BuyerInvitation[]>(["invitations", "buyer"], (prev) => prev?.map((x) => x.id === r.id ? { ...x, status: "viewed", viewedAt: new Date().toISOString() } : x));
    openFn({ data: { id: r.id } }).finally(() => qc.invalidateQueries({ queryKey: ["invitations"] }));
  }, [r.id]); // eslint-disable-line react-hooks/exhaustive-deps
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
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const sv = statusView(r, tr, day);
  const l = r.teaser?.listing;
  const approved = r.status === "approved";
  const gone = r.status === "closed" && !r.teaser;
  const navBtn = "grid h-[34px] w-[34px] place-items-center rounded-[9px] border border-[#E5E7EB] aria-disabled:cursor-default aria-disabled:text-[#C3C8D2] dark:border-border";
  const figures: Array<[string, string | null | undefined]> = l ? [
    [tr("Revenue", "รายได้"), l.revenueBand],
    [tr("Asking price", "ราคาเสนอขาย"), r.teaser?.priceBand ? tr(r.teaser.priceBand.label, r.teaser.priceBand.th) : tr("On request", "ตามคำขอ")],
    [tr("Employees", "พนักงาน"), l.employees],
    [tr("Founded", "ก่อตั้ง"), l.typeFounded],
    [tr("Deal type", "รูปแบบดีล"), r.teaser?.dealType],
  ].filter(([, v]) => !!v) as Array<[string, string]> : [];

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 bg-[rgba(16,24,40,.45)]" onClick={onClose} />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={r.name} onKeyDown={trap}
        className="fixed inset-y-0 right-0 z-50 flex w-[560px] max-w-full flex-col bg-card shadow-[-16px_0_40px_rgba(16,24,40,.18)] outline-none motion-safe:animate-in motion-safe:slide-in-from-right motion-safe:duration-[250ms] max-[640px]:w-full">
        <div className="flex h-[58px] shrink-0 items-center gap-2 border-b border-[#EEF0F3] pl-6 pr-4 dark:border-border">
          <span className="text-[13px] font-semibold text-[#6B7280]">{tr(`Invitation ${index + 1} of ${total}`, `คำเชิญที่ ${index + 1} จาก ${total}`)}</span>
          <button type="button" aria-label={tr("Previous invitation", "คำเชิญก่อนหน้า")} aria-disabled={index === 0 || undefined} onClick={() => index > 0 && onPrev()} className={navBtn}><ChevronLeft className="h-[17px] w-[17px]" /></button>
          <button type="button" aria-label={tr("Next invitation", "คำเชิญถัดไป")} aria-disabled={index >= total - 1 || undefined} onClick={() => index < total - 1 && onNext()} className={navBtn}><ChevronRight className="h-[17px] w-[17px]" /></button>
          <button type="button" aria-label={tr("Close", "ปิด")} onClick={onClose} className="ml-auto grid h-[34px] w-[34px] place-items-center rounded-[9px] hover:bg-muted"><X className="h-[18px] w-[18px]" /></button>
        </div>
        <div className="relative min-h-0 flex-1 overflow-y-auto">
          {!gone && l && (
            <SectorArt className="relative h-[112px] w-full" sector={l.sector} art={l.coverArt} imageId={l.publicImageId} src={l.coverUrl}>
              <span className={cn("absolute bottom-[14px] left-6 inline-flex h-[26px] items-center gap-1 rounded-full bg-white px-2.5 text-[12px] font-semibold", approved ? "text-[#15803D]" : "text-[#151A28]")}>
                {approved ? <LockOpen className="h-[13px] w-[13px]" /> : <Lock className="h-[13px] w-[13px]" />}
                {approved ? tr("NDA approved · name unlocked", "อนุมัติ NDA แล้ว · เปิดเผยชื่อแล้ว") : tr("Identity hidden until NDA", "ซ่อนตัวตนจนกว่าจะมี NDA")}
              </span>
            </SectorArt>
          )}
          <div className="space-y-[18px] px-6 pb-6 pt-5">
            <div>
              <h2 className="font-['Space_Grotesk'] text-[22px] font-bold">{r.name}</h2>
              <p className="text-[13px] text-[#6B7280]">{[r.refNo, l?.sector, l?.location?.replace(/, Thailand$/, "")].filter(Boolean).join(" · ")}</p>
              <div className="mt-2.5 flex items-center gap-1.5"><Pill tone={sv.tone}>{sv.pill}</Pill><span className="text-[12.5px] text-[#6B7280]">· {tr(`Invited ${day(r.sentAt)}`, `เชิญเมื่อ ${day(r.sentAt)}`)}</span></div>
            </div>
            {!gone && (
              <>
                {approved && r.companyName && (
                  <div className="rounded-[12px] border border-[#BBE8CA] bg-[#F3FBF6] px-[14px] py-3 dark:bg-transparent">
                    <div className="text-[12px] font-semibold text-[#15803D]">{tr("Company name", "ชื่อบริษัท")}</div>
                    <div className="text-[15px] font-bold">{r.companyName}</div>
                    <div className="text-[13px] text-[#434A5C] dark:text-muted-foreground">{tr("The exclusive view has the logo, exact figures and the seller's email and phone.", "มุมมองส่วนตัวมีโลโก้ ตัวเลขที่แน่นอน และอีเมลและโทรศัพท์ของผู้ขาย")}</div>
                  </div>
                )}
                {l?.description && <p className="text-[14px] text-[#434A5C] dark:text-muted-foreground">{l.description}</p>}
                {figures.length > 0 && (
                  <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[12px] border border-[#E9EBF0] bg-[#E9EBF0] dark:border-border dark:bg-border">
                    {figures.map(([k, v]) => (
                      <div key={k} className="bg-card px-[14px] py-[11px]">
                        <div className="text-[12px] text-[#6B7280]">{k}</div>
                        <div className="text-[14.5px] font-bold">{v}</div>
                      </div>
                    ))}
                  </div>
                )}
                {!approved && (
                  <div className="flex items-start gap-2.5 rounded-[12px] bg-[#F6F7F9] px-[14px] py-3 text-[13px] text-[#434A5C] dark:bg-muted dark:text-muted-foreground">
                    <Lock className="mt-0.5 h-[15px] w-[15px] shrink-0" />
                    {tr("With an approved NDA you see the company name and logo, exact figures, and the seller's email and phone, and you can message them.", "เมื่อ NDA ได้รับอนุมัติ ท่านจะเห็นชื่อและโลโก้บริษัท ตัวเลขที่แน่นอน อีเมลและโทรศัพท์ของผู้ขาย และส่งข้อความหากันได้")}
                  </div>
                )}
              </>
            )}
          </div>
          <div aria-hidden className="pointer-events-none sticky bottom-0 h-4 bg-gradient-to-t from-card to-transparent" />
        </div>
        <DecisionBar r={r} reason={(sv as { reason?: string }).reason} onClose={onClose} />
      </div>
    </>,
    document.body,
  );
}

function DecisionBar({ r, reason, onClose }: { r: BuyerInvitation; reason?: string; onClose: () => void }) {
  const tr = useTr();
  const day = useFmt();
  const qc = useQueryClient();
  const invalidate = useInvalidateListings();
  const choice = useServerFn(setInvitationChoice);
  const nda = useServerFn(requestNda);
  const { ids: saved, toggle } = useSavedListings();
  const [mode, setMode] = useState<"decide" | "sign" | "pass">("decide");
  const [tick, setTick] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  useEffect(() => { setMode("decide"); setTick(false); }, [r.id, r.status]);

  const refresh = () => { qc.invalidateQueries({ queryKey: ["invitations"] }); invalidate(); qc.invalidateQueries({ queryKey: ["plan-strip"] }); };
  const setStatus = (status: BuyerInvitation["status"], patch: Partial<BuyerInvitation> = {}) =>
    qc.setQueryData<BuyerInvitation[]>(["invitations", "buyer"], (prev) => prev?.map((x) => x.id === r.id ? { ...x, status, ...patch } : x));
  const run = async (f: () => Promise<unknown>, ok: () => void) => {
    setBusy(true);
    try { await f(); ok(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); refresh(); }
  };
  const consent = tr("I have read the NDA and agree to its terms.", "ข้าพเจ้าได้อ่าน NDA และตกลงตามเงื่อนไข");

  const b = "inline-flex h-10 items-center justify-center gap-[7px] rounded-[10px] px-[15px] text-[14px] font-semibold disabled:opacity-60";
  const outline = cn(b, "border border-[#DCDFE5] bg-card hover:bg-muted dark:border-border");
  const navy = cn(b, "bg-[#1E2A4A] text-white hover:bg-[#2A3860] dark:bg-[#E8ECF5] dark:text-[#1E2A4A]");
  const line = "flex-1 text-[13.5px] text-[#434A5C] dark:text-muted-foreground";
  const inFav = saved.has(r.listingId);

  let body: React.ReactNode;
  if (r.status === "new" || r.status === "viewed") {
    if (mode === "sign") {
      body = (
        <div>
          <div className="text-[15px] font-bold">{tr("Sign the NDA and send your request", "ลงนาม NDA และส่งคำขอ")}</div>
          <p className="mt-0.5 text-[13.5px] text-[#434A5C] dark:text-muted-foreground">
            {tr("PitchSnack's standard mutual NDA, for 2 years. The seller sees your profile and approves it. ", "NDA แบบร่วมกันมาตรฐานของ PitchSnack อายุ 2 ปี ผู้ขายจะเห็นโปรไฟล์ของท่านและอนุมัติ ")}
            <button type="button" onClick={() => setReading(true)} className="font-semibold text-[#1D4ED8] underline">{tr("Read the NDA", "อ่าน NDA")}</button>
          </p>
          <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-[14px]">
            <input type="checkbox" checked={tick} onChange={(e) => setTick(e.target.checked)} className="h-[18px] w-[18px] rounded-[4px] accent-[#1E2A4A]" />
            {consent}
          </label>
          <div className="mt-3.5 flex justify-end gap-2">
            <button type="button" className={outline} onClick={() => setMode("decide")}>{tr("Cancel", "ยกเลิก")}</button>
            <button type="button" aria-disabled={!tick || undefined} title={!tick ? tr("Tick the box to sign", "ทำเครื่องหมายเพื่อลงนาม") : undefined} disabled={busy}
              className={cn(navy, !tick && "cursor-not-allowed opacity-40")}
              onClick={() => tick && run(() => nda({ data: { listingId: r.listingId, consent } }), () => {
                setStatus("waiting", { ndaAt: new Date().toISOString() });
                toast.success(tr("NDA signed. The seller has received your NDA request.", "ลงนาม NDA แล้ว ผู้ขายได้รับคำขอ NDA ของท่านแล้ว"));
              })}>
              {tr("Sign and request NDA", "ลงนามและขอ NDA")}
            </button>
          </div>
        </div>
      );
    } else if (mode === "pass") {
      body = (
        <div>
          <div className="text-[15px] font-bold">{tr(`Not interested in ${r.name}?`, `ไม่สนใจ ${r.name}?`)}</div>
          <p className="text-[13.5px] text-[#434A5C] dark:text-muted-foreground">{tr("The seller sees that you passed. You can reconsider later from this list.", "ผู้ขายจะเห็นว่าท่านผ่าน ท่านพิจารณาใหม่ได้ภายหลังจากรายการนี้")}</p>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" className={outline} onClick={() => setMode("decide")}>{tr("Cancel", "ยกเลิก")}</button>
            <button type="button" disabled={busy} className={cn(b, "border border-[#F3C5C0] bg-card text-[#B42318] hover:bg-[#FEF3F2] dark:bg-transparent")}
              onClick={() => run(() => choice({ data: { id: r.id, notInterested: true } }), () => {
                setStatus("not_interested", { choiceAt: new Date().toISOString() });
                toast(tr("Marked as not interested. It's in Archive now.", "ทำเครื่องหมายว่าไม่สนใจแล้ว ย้ายไปที่เก็บถาวรแล้ว"));
              })}>{tr("Not interested", "ไม่สนใจ")}</button>
          </div>
        </div>
      );
    } else {
      body = (
        <div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={outline} onClick={() => setMode("pass")}>{tr("Not interested", "ไม่สนใจ")}</button>
            <button type="button" aria-pressed={inFav} onClick={() => toggle(r.listingId)} className={cn(outline, inFav && "text-[#92400E]")}>
              <Star className={cn("h-4 w-4", inFav && "fill-[#F6A823] text-[#F6A823]")} />{inFav ? tr("In my watchlist", "อยู่ในรายการโปรด") : tr("Add to my watchlist", "เพิ่มในรายการโปรด")}
            </button>
            <span className="flex-1" />
            <button type="button" className={navy} onClick={() => setMode("sign")}>{tr("Request NDA", "ขอ NDA")}</button>
          </div>
          <p className="mt-2 text-[12.5px] text-[#6B7280]">{tr("Request NDA to see the company name, exact figures and contacts. The seller approves it.", "ขอ NDA เพื่อดูชื่อบริษัท ตัวเลขที่แน่นอน และข้อมูลติดต่อ ผู้ขายเป็นผู้อนุมัติ")}</p>
        </div>
      );
    }
  } else if (r.status === "waiting") {
    body = <div className="flex items-center gap-3"><span className={line}>{tr(`You signed the NDA on ${day(r.ndaAt)}. Waiting for the seller to approve it.`, `ท่านลงนาม NDA เมื่อ ${day(r.ndaAt)} รอผู้ขายอนุมัติ`)}</span><Link to="/marketplace/favourites" search={{ id: r.listingId }} className={outline}>{tr("Open in Favourites", "เปิดในรายการโปรด")}</Link></div>;
  } else if (r.status === "approved") {
    body = (
      <div className="flex flex-wrap items-center gap-2">
        <span className={line}>{tr(`NDA approved on ${day(r.approvedAt)}. The seller is in your contacts.`, `อนุมัติ NDA เมื่อ ${day(r.approvedAt)} ผู้ขายอยู่ในรายชื่อติดต่อของท่านแล้ว`)}</span>
        <Link to="/marketplace/messages" className={outline}>{tr("Message seller", "ส่งข้อความถึงผู้ขาย")}</Link>
        <Link to="/marketplace/favourites" search={{ id: r.listingId }} className={navy}>{tr("Open exclusive view", "เปิดมุมมองส่วนตัว")}</Link>
      </div>
    );
  } else if (r.status === "not_interested") {
    body = <div className="flex items-center gap-3"><span className={line}>{tr(`You marked this as not interested on ${day(r.choiceAt)}.`, `ท่านทำเครื่องหมายว่าไม่สนใจเมื่อ ${day(r.choiceAt)}`)}</span>
      <button type="button" disabled={busy} className={outline} onClick={() => run(() => choice({ data: { id: r.id, notInterested: false } }), () => { setStatus("viewed"); toast(tr("Moved back to Current.", "ย้ายกลับไปที่ปัจจุบันแล้ว")); })}>{tr("Reconsider", "พิจารณาใหม่")}</button></div>;
  } else {
    body = <div className="flex items-center gap-3"><span className={line}>{r.status === "declined" ? tr("The seller declined your NDA request.", "ผู้ขายปฏิเสธคำขอ NDA ของท่าน") : `${reason ?? ""}.`}</span><button type="button" className={outline} onClick={onClose}>{tr("Close", "ปิด")}</button></div>;
  }

  return (
    <div className="shrink-0 border-t border-[#EEF0F3] bg-card px-6 pb-[18px] pt-4 dark:border-border">
      {body}
      {reading && (
        <Dialog open onOpenChange={(o) => !o && setReading(false)}>
          <DialogContent className="max-h-[calc(100vh-32px)] overflow-y-auto sm:max-w-[640px]">
            <DialogTitle>{tr("Mutual NDA", "NDA แบบร่วมกัน")}</DialogTitle>
            <DialogDescription className="sr-only">{tr("PitchSnack's standard mutual NDA", "NDA แบบร่วมกันมาตรฐานของ PitchSnack")}</DialogDescription>
            <Reader label="NDA" text={STANDARD_NDA_TEXT} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export type NdaSent = { listingId: string; name: string; invitationId: string | null; saved: boolean };

/** Section 5: shown after Sign and request NDA from Browse listings or Favourites. Done/Esc plays the flight into the menu. */
export function NdaSentDialog({ sent, fromWatchlist = false, onClose }: { sent: NdaSent; fromWatchlist?: boolean; onClose: () => void }) {
  const tr = useTr();
  const navigate = useNavigate();
  const box = useRef<HTMLDivElement>(null);
  const done = () => {
    const r = box.current?.getBoundingClientRect();
    const fallback = r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: innerWidth / 2, y: innerHeight / 2 };
    onClose();
    const w = "รายการโปรด";
    void import("@/lib/nda-flight").then(({ playNdaFlight }) => playNdaFlight({
      listingId: sent.listingId, name: sent.name, invitationId: sent.invitationId, fromWatchlist, alreadySaved: sent.saved, fallback,
      text: {
        added: tr("Added to My watchlist", `เพิ่มใน${w}แล้ว`), inList: tr("In My watchlist", `อยู่ใน${w}แล้ว`),
        inv: tr("NDA Invitations", "คำเชิญ NDA"), waiting: tr("Waiting for the seller", "รอผู้ขาย"), view: tr("View", "ดู"),
        toast: tr("Added to My watchlist", `เพิ่มใน${w}แล้ว`), toastBoth: tr("Added to My watchlist and NDA Invitations", `เพิ่มใน${w}และคำเชิญ NDA แล้ว`),
        requested: tr("NDA requested", "ขอ NDA แล้ว"),
      },
      go: (to) => void navigate(to as never),
      toast: (msg, view) => toast(msg, { position: "bottom-center", duration: 4000, action: { label: tr("View", "ดู"), onClick: view } }),
    }));
  };
  const w = "รายการโปรด";
  return (
    <Dialog open onOpenChange={(o) => !o && done()}>
      <DialogContent ref={box} className="nda-sent-dialog max-w-[calc(100vw-32px)] rounded-2xl p-6 sm:max-w-[460px] [&>button.absolute]:hidden">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-[#E9F6EE]"><Check className="h-[22px] w-[22px] text-[#15803D]" /></span>
        <DialogTitle className="mt-3.5 font-['Space_Grotesk'] text-[21px] font-bold">{tr("The seller has received your NDA request", "ผู้ขายได้รับคำขอ NDA ของท่านแล้ว")}</DialogTitle>
        <DialogDescription className="mt-2 text-[14.5px] text-[#434A5C] dark:text-muted-foreground">
          {tr(`${sent.name} has your signed request. They usually reply within 2–3 business days, and we'll email you as soon as they approve.`, `${sent.name} ได้รับคำขอที่ลงนามของท่านแล้ว โดยปกติจะตอบกลับภายใน 2–3 วันทำการ และเราจะส่งอีเมลแจ้งทันทีที่อนุมัติ`)}
        </DialogDescription>
        <p className="mt-1.5 text-[13.5px] text-[#6B7280]">{sent.invitationId
          ? tr("The listing is in My watchlist and NDA Invitations in the meantime.", `ระหว่างนี้ประกาศนี้อยู่ใน${w}และคำเชิญ NDA ของท่าน`)
          : tr("The listing is in My watchlist in the meantime.", `ระหว่างนี้ประกาศนี้อยู่ใน${w}ของท่าน`)}</p>
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={done} className="inline-flex h-11 items-center rounded-[10px] bg-[#1E2A4A] px-[18px] text-[14.5px] font-semibold text-white dark:bg-[#E8ECF5] dark:text-[#1E2A4A]">{tr("Done", "เสร็จสิ้น")}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
