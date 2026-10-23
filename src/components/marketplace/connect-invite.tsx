import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Check, CircleSlash, Inbox, Lock, Send } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { myConnectStates, sendInvitation, type ConnectState } from "@/lib/invitations.functions";
import { requestLock, usePlanStrip, LOCK_STYLE } from "@/components/marketplace/plan-strip";
import { GlossaryTerm } from "@/components/marketplace/browse-header";
import { useTr } from "@/components/common/edit-info-popup";
import { ReviewInvestorDialog } from "@/components/marketplace/seller-invitations";
import { useTranslation } from "@/i18n/language";
import { cn } from "@/lib/utils";
import { PendingContactButton } from "@/components/marketplace/pending-contact-button";
import { playConnectFlight } from "@/lib/connect-flight";

/**
 * Seller › Browse investors / Favourites: the Connect button and what replaces
 * it (section 1), plus the two-step Connect pop-up (section 2).
 */
export function useConnectStates() {
  const fn = useServerFn(myConnectStates);
  return useQuery({ queryKey: ["connect-states"], queryFn: () => fn(), staleTime: 15_000, refetchOnMount: "always", refetchInterval: (query) => query.state.data?.pendingVerification ? 15_000 : false });
}

function useDay() {
  const { language } = useTranslation();
  return (d: string | null) => d ? new Date(d).toLocaleDateString(language === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short" }) : "";
}

const NAVY = "bg-[#1E2A4A] text-white hover:bg-[#2A3860] dark:bg-[#E8ECF5] dark:text-[#1E2A4A]";
const CHIP = {
  green: "border-[#BBE8CA] bg-[#E9F6EE] text-[#15803D]",
  blue: "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]",
  grey: "border-[#E5E7EB] bg-[#F3F4F6] text-[#4B5563]",
};

function Chip({ tone, icon: I, children, big }: { tone: keyof typeof CHIP; icon: typeof Check; children: React.ReactNode; big?: boolean }) {
  return (
    <span role="status" className={cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] border font-semibold", CHIP[tone], big ? "h-10 px-[14px] text-[14px]" : "h-[34px] px-3 text-[13px]")}>
      <I className={big ? "h-4 w-4" : "h-3.5 w-3.5"} />{children}
    </span>
  );
}

function counterText(tr: (en: string, th: string) => string, left: unknown, total: number | null | undefined, termMonths: number | null | undefined) {
  if (left === "unlimited" || typeof left !== "number" || total == null) return null;
  return termMonths === 12
    ? tr(`${left} of ${total} requests left this year`, `เหลือ ${left} จาก ${total} คำขอในปีนี้`)
    : tr(`${left} of ${total} requests left this term`, `เหลือ ${left} จาก ${total} คำขอในรอบนี้`);
}

/** Connect, or the chip for what's already open with this investor. */
export function ConnectButton({ investorId, investorRef, big }: { investorId: string; investorRef: string; big?: boolean }) {
  const tr = useTr();
  const day = useDay();
  const { data: strip } = usePlanStrip();
  const { data: st } = useConnectStates();
  const [open, setOpen] = useState(false);
  const s: ConnectState | undefined = st?.by[investorId];
  const h = big ? "h-10 px-4 text-[14.5px]" : "h-[34px] px-3 text-[13.5px]";

  if (s?.kind === "invited") return (
    <>
      <Chip big={big} tone="green" icon={Check}>{tr(`Invited · ${day(s.at)}`, `เชิญแล้ว · ${day(s.at)}`)}</Chip>
      {open && <ConnectDialog investorId={investorId} investorRef={investorRef} listingRef={st?.listingRef ?? ""} onClose={() => setOpen(false)} />}
    </>
  );
  if (s?.kind === "not_interested") return <Chip big={big} tone="grey" icon={CircleSlash}>{tr(`Not interested · ${day(s.at)}`, `ไม่สนใจ · ${day(s.at)}`)}</Chip>;
  if (s?.kind === "declined") return <Chip big={big} tone="grey" icon={CircleSlash}>{tr(`You declined · ${day(s.at)}`, `ท่านปฏิเสธ · ${day(s.at)}`)}</Chip>;
  if (s?.kind === "nda_requested" || s?.kind === "approved") {
    const approved = s.kind === "approved";
    return (
      <span className="flex shrink-0 items-center gap-2">
        <Chip big={big} tone={approved ? "green" : "blue"} icon={approved ? Check : Inbox}>{approved ? tr("NDA approved", "อนุมัติ NDA แล้ว") : tr("They requested an NDA", "ขอ NDA กับท่านแล้ว")}</Chip>
        {approved || !s.pipelineId ? (
          <Link to="/marketplace/pipeline" onClick={(e) => e.stopPropagation()} className={cn("inline-flex items-center rounded-[10px] font-semibold", h, NAVY)}>
            {approved ? tr("Open in Pipeline", "เปิดใน Pipeline") : tr("Review investor", "ตรวจสอบนักลงทุน")}
          </Link>
        ) : (
          <button type="button" aria-haspopup="dialog" onClick={(e) => { e.stopPropagation(); setOpen(true); }} className={cn("inline-flex items-center rounded-[10px] font-semibold", h, NAVY)}>
            {tr("Review investor", "ตรวจสอบนักลงทุน")}
          </button>
        )}
        {open && s.pipelineId && <ReviewInvestorDialog pipelineId={s.pipelineId} onClose={() => setOpen(false)} />}
      </span>
    );
  }

  const planLock = requestLock(strip);
  const lock = planLock ?? (st && !st.hasListing && !st.pendingVerification ? "Add your business first" : null);
  const lockLabel = lock === "Professional plan" ? tr("Professional plan", "แผน Professional")
    : lock === "No requests left" ? tr("No requests left", "ไม่มีคำขอเหลือ")
    : lock === "Add your business first" ? tr("Add your business first", "เพิ่มธุรกิจของท่านก่อน") : lock;
  if (!lock && st?.pendingVerification) return (
    <PendingContactButton className={cn("inline-flex shrink-0 items-center gap-2 rounded-[10px] font-semibold", h)} iconClassName={big ? "h-4 w-4" : "h-3.5 w-3.5"}>
      {tr("Connect", "เชื่อมต่อ")}
    </PendingContactButton>
  );
  return (
    <>
      <button
        type="button"
        aria-disabled={!!lock || undefined}
        aria-haspopup={lock ? undefined : "dialog"}
        onClick={(e) => {
          e.stopPropagation();
          if (planLock === "Professional plan") { toast(tr("Connecting with investors needs Professional. On Entry, investors can still find you and request an NDA.", "การเชื่อมต่อกับนักลงทุนต้องใช้แผน Professional ในแผน Entry นักลงทุนยังค้นหาท่านและขอ NDA ได้"), { action: { label: tr("See plans", "ดูแผน"), onClick: () => { window.location.href = "/preferences#subscription"; } } }); return; }
          if (lock === "Add your business first") { toast(lockLabel, { action: { label: tr("My Company", "บริษัทของฉัน"), onClick: () => { window.location.href = "/my-startups"; } } }); return; }
          if (lock) { toast(lockLabel); return; }
          setOpen(true);
        }}
        className={cn("inline-flex shrink-0 items-center gap-2 rounded-[10px] font-semibold", h, lock ? `cursor-pointer border border-dashed ${LOCK_STYLE}` : NAVY)}
      >
        {lock ? <Lock className="h-3.5 w-3.5" /> : <Send className={big ? "h-4 w-4" : "h-3.5 w-3.5"} />}
        {lock ? lockLabel : tr("Connect", "เชื่อมต่อ")}
      </button>
      {open && <ConnectDialog investorId={investorId} investorRef={investorRef} listingRef={st?.listingRef ?? ""} onClose={() => setOpen(false)} />}
    </>
  );
}

function ConnectDialog({ investorId, investorRef, listingRef, onClose }: { investorId: string; investorRef: string; listingRef: string; onClose: () => void }) {
  const tr = useTr();
  const qc = useQueryClient();
  const send = useServerFn(sendInvitation);
  const { data: strip } = usePlanStrip();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ id: string; left: unknown; termMonths: number | null } | null>(null);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const total = strip?.total ?? null;
  const counter = sent ? counterText(tr, sent.left, total, sent.termMonths) : counterText(tr, strip?.left, total, strip?.plan?.termMonths);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["connect-states"] }); qc.invalidateQueries({ queryKey: ["plan-strip"] }); };

  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (!sent) { onClose(); return; }
    const rect = dialogRef.current?.getBoundingClientRect();
    setClosing(true);
    playConnectFlight({
      invitationId: sent.id, investorRef,
      fallback: rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: innerWidth / 2, y: innerHeight / 2 },
      text: { invitations: tr('NDA Invitations', 'คำเชิญ NDA'), sent: tr('Invitation Sent', 'ส่งคำเชิญแล้ว'), view: tr('View', 'ดู') },
      view: () => { void navigate({ to: '/marketplace/pipeline/invitations', search: { open: sent.id, view: 'sent' } }); },
      toast: (message, view) => toast(message, { duration: 4000, action: { label: tr('View', 'ดู'), onClick: view } }),
    });
    window.setTimeout(() => { refresh(); onClose(); }, 180);
  };

  const onSend = async () => {
    setBusy(true);
    try {
      const r = await send({ data: { investorId } });
      setSent({ id: r.id, left: r.left, termMonths: r.termMonths });
    } catch (e) {
      const m = (e as Error).message;
      const th: Record<string, string> = {
        "You have no Connect requests left.": "ท่านไม่มีคำขอเชื่อมต่อเหลือแล้ว",
        "Your listing isn't live.": "ประกาศของท่านยังไม่เผยแพร่",
        "This investor's profile is no longer published.": "โปรไฟล์ของนักลงทุนรายนี้ไม่ได้เผยแพร่แล้ว",
        "You've already invited this investor.": "ท่านเชิญนักลงทุนรายนี้แล้ว",
        "This investor has just asked you for an NDA. Review it now.": "นักลงทุนรายนี้เพิ่งขอ NDA กับท่าน โปรดตรวจสอบตอนนี้",
      };
      toast.error(tr(m, th[m] ?? m));
      refresh();
    } finally { setBusy(false); }
  };

  const btn = "inline-flex h-11 items-center justify-center rounded-[10px] px-[18px] text-[14.5px] font-semibold";
  return (
    <Dialog open={!closing} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent ref={dialogRef} onClick={(e) => e.stopPropagation()} className={cn("max-h-[calc(100vh-32px)] max-w-[calc(100vw-32px)] overflow-y-auto rounded-2xl p-6", sent ? "sm:max-w-[660px] connect-sent-dialog" : "sm:max-w-[540px]")}>
        {!sent ? (
          <>
            <DialogTitle className="pr-6 font-['Space_Grotesk'] text-[21px] font-bold leading-[1.3]">{tr(`Connect with investor (${investorRef})`, `เชื่อมต่อกับนักลงทุน (${investorRef})`)}</DialogTitle>
            <DialogDescription className="mt-2 text-[14.5px] leading-[1.5] text-[#434A5C] dark:text-muted-foreground">
              {tr("The buyer will receive an invitation to view your listed profile (", "ผู้ซื้อจะได้รับคำเชิญให้ดูโปรไฟล์ที่ท่านประกาศไว้ (")}
              <b className="font-semibold text-[#151A28] dark:text-foreground">{listingRef}</b>
              {tr("). Your company name and confidential details will remain hidden.", ") ชื่อบริษัทและข้อมูลที่เป็นความลับของท่านจะยังคงถูกซ่อนไว้")}
            </DialogDescription>
            <div className="mt-[22px] flex flex-wrap items-center justify-between gap-3">
              <span className="min-w-0 flex-1 text-[12.5px] text-[#6B7280]">{counter}</span>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className={cn(btn, "border border-[#DCDFE5] bg-card hover:bg-muted dark:border-border")}>{tr("Cancel", "ยกเลิก")}</button>
                <button type="button" disabled={busy} onClick={onSend} className={cn(btn, NAVY, "disabled:opacity-60")}>{tr("Send invitation", "ส่งคำเชิญ")}</button>
              </div>
            </div>
          </>
        ) : (
          <>
            <span className="inline-flex h-7 w-fit items-center gap-1.5 rounded-full border border-[#BBE8CA] bg-[#E9F6EE] px-3 text-[13px] font-semibold text-[#15803D]">
              <Check className="h-3.5 w-3.5" />{tr(`Invitation sent to investor (${investorRef})`, `ส่งคำเชิญถึงนักลงทุน (${investorRef}) แล้ว`)}
            </span>
            <DialogTitle className="mt-4 font-['Space_Grotesk'] text-[21px] font-bold">{tr("What's next", "ขั้นตอนต่อไป")}</DialogTitle>
            <DialogDescription className="sr-only">{tr("What happens after your invitation", "สิ่งที่จะเกิดขึ้นหลังจากส่งคำเชิญ")}</DialogDescription>
            <div role="list" className="relative mt-[18px] grid grid-cols-3 gap-3">
              <div aria-hidden className="absolute left-[16.66%] right-[16.66%] top-[14px] h-[2px] bg-[#D6DAE3]" />
              {[
                [tr("The buyer receives your invitation", "ผู้ซื้อได้รับคำเชิญของท่าน"), null],
                [tr("If the buyer wants to know more about your company", "หากผู้ซื้อต้องการทราบข้อมูลเพิ่มเติมเกี่ยวกับบริษัทของท่าน"), <>{tr("The buyer will sign the ", "ผู้ซื้อจะลงนาม ")}<GlossaryTerm term="nda" />.</>],
                [tr("You approve the NDA", "ท่านอนุมัติ NDA"), tr("Both sides can see full company details and message each other directly.", "ทั้งสองฝ่ายจะเห็นข้อมูลบริษัทครบถ้วนและส่งข้อความหากันได้โดยตรง")],
              ].map(([t, line], i) => (
                <div role="listitem" key={i} className="relative flex flex-col items-center text-center">
                  <span className={cn("grid h-[30px] w-[30px] place-items-center rounded-full", i === 0 ? "bg-[#1E2A4A] text-white" : "border-2 border-[#C9CEDA] bg-card text-[14px] font-bold text-[#6B7280]")}>
                    {i === 0 ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="mt-3 text-[14px] font-bold leading-[1.35]">{t}</span>
                  {line && <span className="mt-1 text-[13px] leading-[1.45] text-[#434A5C] dark:text-muted-foreground">{line}</span>}
                </div>
              ))}
            </div>
            <div className="mt-[22px] flex flex-wrap items-center justify-between gap-3">
              <span className="text-[12.5px] text-[#6B7280]">{counter}</span>
              <button type="button" onClick={close} className={cn(btn, NAVY)}>{tr("Done", "เสร็จสิ้น")}</button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The blue line under the Split panel header after Connect (section 3). */
export function InvitedLine({ investorId }: { investorId: string }) {
  const tr = useTr();
  const { data: st } = useConnectStates();
  const s = st?.by[investorId];
  const { language } = useTranslation();
  if (s?.kind !== "invited") return null;
  const d = s.at ? new Date(s.at).toLocaleDateString(language === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
  return (
    <div className="border-b border-[#D6E7FC] bg-[#F4F9FF] px-[22px] py-[10px] text-[13.5px] text-[#434A5C] dark:border-border dark:bg-[#16283A] dark:text-muted-foreground">
      {tr(`You invited them to browse your listed profile on ${d}. If they're interested, their NDA request will arrive in `, `ท่านเชิญให้ดูโปรไฟล์ที่ประกาศไว้เมื่อ ${d} หากสนใจ คำขอ NDA จะมาที่ `)}
      <b className="font-bold">{tr("NDA Invitations", "คำเชิญ NDA")}</b>{tr(". We'll email you too.", " เราจะส่งอีเมลแจ้งท่านด้วย")}
    </div>
  );
}
