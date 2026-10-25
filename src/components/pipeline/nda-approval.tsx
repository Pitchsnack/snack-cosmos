import { useEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, Calendar, Check, Eye, GitBranch, Lock, MessageSquare, PhoneOff, UserX, Users, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Reader } from "./pipeline-dialogs";
import { STANDARD_NDA_TEXT } from "@/config/standard-nda";
import { decideNda, listPipeline } from "@/lib/pipeline.functions";
import { nextBuyerApproval, sellerApprovalSummary, type ApprovalSummary } from "@/lib/invitations.functions";
import { pipelineStep } from "@/lib/pipeline-pages";
import { STEPS } from "@/lib/pipeline-state";
import { useTranslation } from "@/i18n/language";
import { usePersona } from "@/hooks/use-marketplace";
import { cn } from "@/lib/utils";

/** Pipeline › NDA Invitations: key terms, confirm boxes, Review and approve, and the NDA approved box. */
export function useC() {
  const { language, t } = useTranslation();
  const th = language === "th";
  return { c: (en: string, thai: string) => (th ? thai : en), t, th, day: (s: string | null) => s ? new Date(s).toLocaleDateString(th ? "th-TH" : "en-GB", { day: "numeric", month: "short" }).replace("Sept", "Sep") : "" };
}

export function NdaKeyTerms({ side, parties }: { side: "buyer" | "seller"; parties: string }) {
  const { c } = useC();
  const rows: Array<[typeof Users, string, string]> = [
    [Users, c("Parties", "คู่สัญญา"), parties],
    [Calendar, c("Term", "ระยะเวลา"), side === "buyer" ? c("2 years from the day the seller approves", "2 ปีนับจากวันที่ผู้ขายอนุมัติ") : c("2 years from the day you approve", "2 ปีนับจากวันที่ท่านอนุมัติ")],
    [Eye, c("Use of information", "การใช้ข้อมูล"), c("Only to consider this deal", "ใช้เพื่อพิจารณาดีลนี้เท่านั้น")],
    [PhoneOff, c("Contact", "การติดต่อ"), side === "buyer" ? c("No direct contact with the seller's staff, customers or suppliers", "ไม่ติดต่อพนักงาน ลูกค้า หรือซัพพลายเออร์ของผู้ขายโดยตรง") : c("No direct contact with your staff, customers or suppliers", "ไม่ติดต่อพนักงาน ลูกค้า หรือซัพพลายเออร์ของท่านโดยตรง")],
    [UserX, c("Non-solicitation", "การห้ามชักชวน"), c("12 months", "12 เดือน")],
  ];
  return (
    <div className="nda-terms">
      <div className="nda-terms-caption">{c("Key terms both parties agree to", "ข้อกำหนดสำคัญที่ทั้งสองฝ่ายตกลงกัน")}</div>
      <dl className="nda-terms-box">
        {rows.map(([I, k, v]) => (
          <div key={k} className="nda-terms-row">
            <span aria-hidden className="nda-terms-icon"><I size={15} /></span>
            <dt>{k}</dt><dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function FullNda() {
  const { c } = useC();
  return <Reader label="NDA" openText={c("Read the full NDA", "อ่าน NDA ฉบับเต็ม")} hideText={c("Hide the full NDA", "ซ่อน NDA ฉบับเต็ม")} text={STANDARD_NDA_TEXT} />;
}

export function ConfirmBox({ title, text, small, confirm, tone = "danger", busy, onConfirm, onClose }: { title: string; text: string; small?: string; confirm: string; tone?: "danger" | "navy"; busy?: boolean; onConfirm: () => void; onClose: () => void }) {
  const { c } = useC();
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent role="alertdialog" className="nda-confirm" onOpenAutoFocus={(e) => { e.preventDefault(); cancel.current?.focus(); }} onClick={(e) => e.stopPropagation()}>
        <div className="nda-confirm-head"><DialogTitle>{title}</DialogTitle></div>
        <div className="nda-confirm-body"><DialogDescription>{text}</DialogDescription>{small && <p className="nda-small">{small}</p>}</div>
        <div className="nda-confirm-foot">
          <button ref={cancel} type="button" className="nda-btn nda-btn-outline" onClick={onClose}>{c("Cancel", "ยกเลิก")}</button>
          <button type="button" disabled={busy} className={cn("nda-btn", tone === "danger" ? "nda-btn-danger" : "nda-btn-navy")} onClick={onConfirm}>{confirm}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type ReviewInfo = { pipelineId: string; typeName: string; investorRef: string | null; listingName: string; listingRef: string | null; companyName: string; signedAt: string | null };

export function ReviewApproveDialog({ info, onClose, onApproved }: { info: ReviewInfo; onClose: () => void; onApproved: (pipelineId: string) => void }) {
  const { c, day } = useC();
  const qc = useQueryClient();
  const decide = useServerFn(decideNda);
  const [tick, setTick] = useState(false);
  const [busy, setBusy] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const who = `${info.typeName}${info.investorRef ? ` (${info.investorRef})` : ""}`;
  const listing = `${info.listingName}${info.listingRef ? ` (${info.listingRef})` : ""}`;
  const consent = c(`I have read the NDA and approve it on behalf of ${info.companyName}.`, `ข้าพเจ้าได้อ่าน NDA แล้ว และอนุมัติในนามของ ${info.companyName}`);
  const approve = async () => {
    if (!tick || busy) return;
    setBusy(true);
    try {
      await decide({ data: { id: info.pipelineId, approve: true, consent } });
      for (const k of [["invitations"], ["connect-states"], ["pipeline"], ["plan-strip"]]) void qc.invalidateQueries({ queryKey: k });
      onApproved(info.pipelineId);
    } catch (e) {
      toast(c("This NDA request has already been answered.", "คำขอ NDA นี้ได้รับการตอบแล้ว"));
      void qc.invalidateQueries({ queryKey: ["invitations"] });
      onClose();
      void e;
    } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="nda-sign" onOpenAutoFocus={(e) => { e.preventDefault(); title.current?.focus(); }} onClick={(e) => e.stopPropagation()}>
        <DialogTitle ref={title} tabIndex={-1} className="nda-sign-title">{c("Review and approve the NDA", "ตรวจสอบและอนุมัติ NDA")}</DialogTitle>
        <DialogDescription className="nda-sign-line">{c(`${who} signed PitchSnack's standard mutual NDA for your listing ${listing}. Read it before you approve.`, `${who} ลงนาม NDA มาตรฐานแบบสองฝ่ายของ PitchSnack สำหรับประกาศ ${listing} ของท่าน โปรดอ่านก่อนอนุมัติ`)}</DialogDescription>
        <span className="nda-signed-pill"><Check size={14} />{c(`Signed by the buyer · ${day(info.signedAt)}`, `ผู้ซื้อลงนามแล้ว · ${day(info.signedAt)}`)}</span>
        <NdaKeyTerms side="seller" parties={c(`${info.companyName} (you) and ${who}`, `${info.companyName} (ท่าน) และ ${who}`)} />
        <FullNda />
        <p className="nda-opens"><Lock size={15} aria-hidden />{c("When you approve, you both see each other's names, exact figures, email and phone, you're added to each other's contact list, and you can message each other.", "เมื่อท่านอนุมัติ ทั้งสองฝ่ายจะเห็นชื่อ ตัวเลขจริง อีเมล และเบอร์โทรของกันและกัน ถูกเพิ่มในรายชื่อติดต่อของกันและกัน และส่งข้อความถึงกันได้")}</p>
        <label className="nda-tick"><input type="checkbox" checked={tick} onChange={(e) => setTick(e.target.checked)} />{consent}</label>
        <div className="nda-confirm-foot nda-sign-foot">
          <button type="button" className="nda-btn nda-btn-outline" onClick={onClose}>{c("Cancel", "ยกเลิก")}</button>
          <button type="button" aria-disabled={!tick || undefined} title={!tick ? c("Tick the box to approve", "ทำเครื่องหมายในช่องเพื่ออนุมัติ") : undefined} disabled={busy} className={cn("nda-btn nda-btn-navy", !tick && "opacity-40 cursor-not-allowed")} onClick={approve}>{c("Approve NDA", "อนุมัติ NDA")}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function useStep(seller: boolean, pipelineId: string | undefined) {
  const list = useServerFn(listPipeline);
  const qc = useQueryClient();
  const [step, setStep] = useState<number | null>(null);
  useEffect(() => {
    if (!pipelineId) return;
    void qc.fetchQuery({ queryKey: ["pipeline", seller ? "seller" : "buyer"], queryFn: () => list({ data: { as: seller ? "seller" : "buyer" } }), staleTime: 0 })
      .then((rows) => { const p = rows.find((r) => r.id === pipelineId); if (p) setStep(pipelineStep(p)); }).catch(() => {});
  }, [pipelineId]); // eslint-disable-line react-hooks/exhaustive-deps
  return step;
}

export function ApprovedBox({ s, seller, onClose }: { s: ApprovalSummary; seller: boolean; onClose: () => void }) {
  const { c, t, day } = useC();
  const nav = useNavigate();
  const go = useRef<HTMLButtonElement>(null);
  const step = useStep(seller, s.pipelineId);
  const name = seller ? s.other : s.name;
  const stepText = step == null ? "" : `${c("Step", "ขั้นที่")} ${step + 1} · ${t(STEPS[step])}`;
  const rows: Array<[typeof Eye, string, React.ReactNode]> = [
    [Eye, c("Name revealed", "เปิดเผยชื่อแล้ว"), seller
      ? <>{c("The buyer is ", "ผู้ซื้อคือ ")}<b className="nda-name">{s.other}</b>{c(` (${s.typeName} · ${s.investorRef ?? ""}), and they now see ${s.name}.`, ` (${s.typeName} · ${s.investorRef ?? ""}) และผู้ซื้อเห็นชื่อ ${s.name} แล้ว`)}</>
      : <>{c("The company is ", "กิจการนี้คือ ")}<b className="nda-name">{s.name}</b>{c(` (${s.listingName} · ${s.listingRef ?? ""}), and the seller now sees ${s.other}.`, ` (${s.listingName} · ${s.listingRef ?? ""}) และผู้ขายเห็นชื่อ ${s.other} แล้ว`)}</>],
    [Users, c("Profiles opened", "เปิดโปรไฟล์แล้ว"), seller ? c("You see their full investor profile, and they see your company's private view.", "ท่านเห็นโปรไฟล์นักลงทุนฉบับเต็มของผู้ซื้อ และผู้ซื้อเห็นมุมมองพิเศษของกิจการท่าน") : c("You see the company's private view, and the seller sees your full investor profile.", "ท่านเห็นมุมมองพิเศษของกิจการ และผู้ขายเห็นโปรไฟล์นักลงทุนฉบับเต็มของท่าน")],
    [MessageSquare, c("Contacts shared", "แชร์ข้อมูลติดต่อแล้ว"), c("Your email and phone are shared both ways, and you can message each other.", "อีเมลและเบอร์โทรถูกแชร์ให้กันและกันแล้ว และส่งข้อความถึงกันได้")],
    [GitBranch, c("In All deals", "อยู่ในดีลทั้งหมด"), c(`The deal is on your All deals timeline, at ${stepText}.`, `ดีลนี้อยู่ในไทม์ไลน์ดีลทั้งหมดของท่านแล้ว ที่${stepText}`)],
  ];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="nda-sign nda-approved" onOpenAutoFocus={(e) => { e.preventDefault(); go.current?.focus(); }} onClick={(e) => e.stopPropagation()}>
        <span className="nda-approved-tick" aria-hidden><Check size={22} /></span>
        <button type="button" className="nda-x" aria-label={c("Close", "ปิด")} onClick={onClose}><X size={18} /></button>
        <DialogTitle className="nda-approved-title">{c(`NDA approved with ${name}`, `อนุมัติ NDA กับ ${name} แล้ว`)}</DialogTitle>
        <DialogDescription className="nda-approved-line">{seller ? c("Here's what has opened for both of you.", "สิ่งที่เปิดให้ทั้งสองฝ่ายแล้วมีดังนี้") : c(`The seller approved your NDA on ${day(s.approvedAt)}. Here's what has opened for both of you.`, `ผู้ขายอนุมัติ NDA ของท่านเมื่อ ${day(s.approvedAt)} สิ่งที่เปิดให้ทั้งสองฝ่ายแล้วมีดังนี้`)}</DialogDescription>
        <ul className="nda-approved-list">
          {rows.map(([I, k, v]) => <li key={k}><span aria-hidden className="nda-approved-icon"><I size={16} /></span><div><b>{k}</b><p>{v}</p></div></li>)}
        </ul>
        <div className="nda-confirm-foot nda-approved-foot">
          <button type="button" className="nda-btn nda-btn-outline" onClick={onClose}>{c("Close", "ปิด")}</button>
          <button ref={go} type="button" className="nda-btn nda-btn-navy" onClick={() => { onClose(); void nav({ to: "/marketplace/pipeline/all-deals", search: { deal: s.pipelineId } }); }}>{c("Go to All deals", "ไปที่ดีลทั้งหมด")}<ArrowRight size={16} /></button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Seller: loads the summary after an approval, then shows the box. */
export function SellerApprovedBox({ pipelineId, onClose }: { pipelineId: string; onClose: () => void }) {
  const fn = useServerFn(sellerApprovalSummary);
  const [s, setS] = useState<ApprovalSummary | null>(null);
  useEffect(() => { void fn({ data: { pipelineId } }).then((r) => r ? setS(r) : onClose()).catch(() => onClose()); }, [pipelineId]); // eslint-disable-line react-hooks/exhaustive-deps
  return s ? <ApprovedBox s={s} seller onClose={onClose} /> : null;
}

/** Buyer: once per approved NDA, on the next page they open. Mounted in the Marketplace frame. */
export function BuyerApprovalWatcher() {
  const { persona } = usePersona();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const fn = useServerFn(nextBuyerApproval);
  const [s, setS] = useState<ApprovalSummary | null>(null);
  const busy = useRef(false);
  useEffect(() => {
    if (persona !== "buyer" || s || busy.current) return;
    busy.current = true;
    void fn().then((r) => { if (r) setS(r); }).catch(() => {}).finally(() => { busy.current = false; });
  }, [persona, path, s]); // eslint-disable-line react-hooks/exhaustive-deps
  return s ? <ApprovedBox s={s} seller={false} onClose={() => setS(null)} /> : null;
}
