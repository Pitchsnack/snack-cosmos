import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { Undo2, Calendar, ChevronDown, Eye, EyeOff, Lock, Megaphone, Send, Share2, User, Users, Check, Clock, CircleCheck, Info } from "lucide-react";
import { useTranslation } from "@/i18n/language";
import { boSector, closesInDays, coverOf, fmtDay, isNew, managedApplyState } from "@/lib/buy-orders";
import { citiesDisplay } from "@/lib/buy-order-defaults";
import { Button } from "@/components/ui/button";
import { Building } from "lucide-react";
import type { ApplyContext, BoCard } from "@/lib/buy-orders.functions";
import { sectorIcon } from "./bw-icons";
import { cn } from "@/lib/utils";
import { resolveBuyOrderCover } from "@/lib/buy-order-cover";
import { useSectorImages } from "@/hooks/use-sector-images";
import { typeLabel } from "@/lib/investor-bands";

export function useBw() {
  const { language } = useTranslation();
  const th = language === "th";
  return { th, c: (en: string, t: string) => (th ? t : en) };
}

export const SEALED_TIP_EN = "Professionally managed by PitchSnack. Buyers are certified by PitchSnack and have a proven track record of acquiring businesses. Their identity remains confidential and is revealed only if your business is shortlisted.";
export const SEALED_TIP_TH = "ดูแลโดยทีมงานมืออาชีพของ PitchSnack ผู้ซื้อผ่านการรับรองจาก PitchSnack และมีประวัติการซื้อกิจการที่พิสูจน์ได้ ชื่อของผู้ซื้อจะถูกเก็บเป็นความลับ และจะเปิดเผยเมื่อธุรกิจของคุณผ่านการคัดเลือกเท่านั้น";

/** Sector name in the viewer's language. */
export function useSectorName() {
  const { th } = useBw();
  return (s: string | null | undefined) => (s ? (th ? boSector(s)?.th ?? s : s) : "");
}

/** The status pill: NEW, Closes in, Closed, or the writer's states. */
export function StatusPill({ card, preview }: { card: BoCard; preview?: boolean }) {
  const { c, th } = useBw();
  const fresh = preview || (card.status === "posted" && isNew(card.postedAt));
  const n = card.status === "posted" ? closesInDays(card.closesOn) : null;
  let dot: string | null = null, text = "";
  if (card.status === "closed") { dot = "muted"; text = c(`Closed ${fmtDay(card.closesOn ?? card.closedAt, false, false)}`, `ปิดแล้ว ${fmtDay(card.closesOn ?? card.closedAt, true, false)}`); }
  else if (n) { dot = "soon"; text = n === 1 ? c("Closes in 1 day", "ปิดในอีก 1 วัน") : c(`Closes in ${n} days`, `ปิดในอีก ${n} วัน`); }
  else if (card.status === "waiting") { dot = "waiting"; text = c("Waiting for Admin", "รอแอดมินตรวจ"); }
  else if (card.status === "sent_back") { dot = "back"; text = c("Sent back by Admin", "แอดมินส่งกลับ"); }
  else if (card.status === "draft") { dot = "muted"; text = c("Draft", "ฉบับร่าง"); }
  const newTag = <span className="bw-new" title={c("Posted in the last 7 days", "ลงประกาศใน 7 วันที่ผ่านมา")}>{th ? "ใหม่" : "NEW"}</span>;
  if (!dot) return fresh ? newTag : null;
  return (
    <span className={cn("bw-pill bw-status", `bw-status-${dot}`, fresh && card.status === "posted" && "bw-status-new")}>
      <i />{text}
      {fresh && card.status === "posted" && <b className="bw-new-end">{th ? "ใหม่" : "NEW"}</b>}
    </span>
  );
}

/** Sealed pill with its hover box (kept inside the window, closed on Esc, click and scroll). */
export function KindPill({ kind, bordered }: { kind: BoCard["kind"]; bordered?: boolean }) {
  const { c, th } = useBw();
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; up: boolean } | null>(null);
  const id = useId();
  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("keydown", key); window.removeEventListener("pointerdown", close); };
  }, [pos]);
  if (kind === "advertisement")
    return <span className={cn("bw-pill bw-advertisement", bordered && "bw-bordered")} title={c("Posted by the buyer", "ผู้ซื้อลงประกาศเอง")}><Megaphone className="h-3 w-3" />{c("Advertisement", "ประกาศ")}</span>;
  const open = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const w = Math.min(416, window.innerWidth - 16);
    const up = r.bottom + 8 + 120 > window.innerHeight;
    setPos({ x: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)), y: up ? r.top - 8 : r.bottom + 8, up });
  };
  const text = th ? SEALED_TIP_TH : SEALED_TIP_EN;
  return (
    <>
      <span ref={ref} tabIndex={0} aria-describedby={id} className="bw-pill bw-sealed" onMouseEnter={open} onMouseLeave={() => setPos(null)} onFocus={open} onBlur={() => setPos(null)}>
        <Lock className="h-3 w-3" />{c("Sealed", "ปิดผนึก")}
      </span>
      <span id={id} hidden>{text}</span>
      {pos && typeof document !== "undefined" && createPortal(
        <div role="tooltip" className="bw-sealed-box" style={{ left: pos.x, top: pos.y, transform: pos.up ? "translateY(-100%)" : undefined }}>{text}</div>,
        document.body,
      )}
    </>
  );
}

export function BuyerChip({ card, solid }: { card: BoCard; solid?: boolean }) {
  const { c, th } = useBw();
  const { t } = useTranslation();
  const label = `${card.buyerType.split(" · ").map((part) => th ? t(typeLabel(part)) : part).join(" · ")}${card.country ? ` · ${t(card.country)}` : ""}`;
  return (
    <span className={cn("bw-pill bw-chip", solid && "bw-chip-solid")} title={c("The buyer’s name stays private", "ชื่อผู้ซื้อถูกเก็บเป็นความลับ")}>
      <EyeOff className="h-3 w-3 shrink-0" />
      <span>{card.yours ? label : label}</span>
    </span>
  );
}

export function Cover({ card, height, top, bottom }: { card: BoCard; height: number; top?: ReactNode; bottom?: ReactNode }) {
  const Icon = sectorIcon(card.sector);
  const { data: images } = useSectorImages(!card.cover);
  const cover = card.cover ?? resolveBuyOrderCover(images, card.sector);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const picture = cover.url && failedUrl !== cover.url;
  return (
    <div className={cn("bw-cover", card.status === "closed" && "bw-cover-closed")} style={{ height, background: coverOf(card.sector).gradient }}>
      {picture ? <img src={cover.url ?? undefined} alt="" className="bw-cover-photo" onError={() => setFailedUrl(cover.url)} /> : <Icon aria-hidden className="bw-cover-icon" strokeWidth={1.3} />}
      {top && <div className="bw-cover-top">{top}</div>}
      {bottom && <div className="bw-cover-bottom">{bottom}</div>}
    </div>
  );
}

/** The seller's application state box (section 6.4). */
export function AppState({ card }: { card: BoCard }) {
  const { c, th } = useBw();
  const a = card.myApp;
  if (!a) return null;
  const sealed = card.kind === "sealed";
  const d = fmtDay(a.appliedAt, th, false);
  const m = a.status === "new"
    ? { cls: "bw-st-amber", Icon: Clock, b: c(`Applied ${d}.`, `สมัครแล้ว ${d}`), t: sealed ? c("PitchSnack is checking the fit, usually within 5 business days.", "PitchSnack กำลังตรวจความเหมาะสม โดยปกติภายใน 5 วันทำการ") : c("The buyer reviews it.", "ผู้ซื้อกำลังพิจารณา") }
    : a.status === "nda_requested"
    ? { cls: "bw-st-green", Icon: CircleCheck, b: sealed ? c("PitchSnack requested an NDA for its client.", "PitchSnack ขอ NDA ให้ลูกค้า") : c("The buyer requested an NDA.", "ผู้ซื้อขอ NDA แล้ว"),
        t: sealed ? c("Approve it in Pipeline › NDA Invitations: the buyer then sees your company’s name, and you see theirs when you accept their LOI.", "อนุมัติได้ที่ ดีล › คำเชิญ NDA: จากนั้นผู้ซื้อจะเห็นชื่อบริษัทของคุณ และคุณจะเห็นชื่อผู้ซื้อเมื่อยอมรับ LOI")
          : c("Approve it in Pipeline › NDA Invitations to see each other’s names.", "อนุมัติได้ที่ ดีล › คำเชิญ NDA เพื่อเห็นชื่อของกันและกัน") }
    : { cls: "bw-st-grey", Icon: Info, b: c("Not a fit this time.", "ครั้งนี้ยังไม่เหมาะ"), t: sealed ? c("PitchSnack won’t take it further for this buyer.", "PitchSnack จะไม่ดำเนินการต่อสำหรับผู้ซื้อรายนี้") : c("The buyer didn’t take it further.", "ผู้ซื้อไม่ได้ดำเนินการต่อ") };
  return <div className={cn("bw-state", m.cls)}><m.Icon className="h-4 w-4 shrink-0" /><span><b>{m.b}</b> {m.t}</span></div>;
}

export function ForCompany({ company }: { company?: BoCard["forCompany"] }) {
  const { c } = useBw();
  return company ? <div className="bw-for-company"><Building className="h-3 w-3 shrink-0" />{c(`For ${company.name} · ${company.ref ?? "—"}`, `สำหรับ ${company.name} · ${company.ref ?? "—"}`)}</div> : null;
}

export function managedCardState(card: BoCard, ctx?: ApplyContext) {
  return ctx?.managed ? managedApplyState((ctx.companies ?? []).map((x) => x.listing.id), (card.managedApps ?? []).map((x) => x.businessId)) : null;
}

export function ApplyButton({ ctx, onApply, size }: { ctx: ApplyContext | undefined; onApply: () => void; size?: "lg" }) {
  const { c } = useBw();
  const [tip, setTip] = useState(false);
  if (ctx?.managed && !ctx.companies?.length) return null;
  if (ctx?.state === "approved")
    return <Button variant="unstyled" type="button" className={cn("bw-btn bw-amber", size)} onClick={onApply}><Send className="h-4 w-4" />{c("Apply", "สมัคร")}</Button>;
  const why = ctx?.state === "pending"
    ? c("Your account is pending approval. You can apply once PitchSnack approves it.", "บัญชีของคุณกำลังรอการอนุมัติ คุณจะสมัครได้เมื่อ PitchSnack อนุมัติแล้ว")
    : c("Register your company first. You can apply once PitchSnack approves it.", "ลงทะเบียนบริษัทของคุณก่อน คุณจะสมัครได้เมื่อ PitchSnack อนุมัติแล้ว");
  return (
    <span className="relative flex flex-1">
      <button type="button" aria-disabled="true" className={cn("bw-btn bw-locked", size)} onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)} onFocus={() => setTip(true)} onBlur={() => setTip(false)} onClick={() => setTip((v) => !v)}>
        <Lock className="h-3.5 w-3.5" />{c("Apply", "สมัคร")}
      </button>
      {tip && <span role="tooltip" className="bw-tip">{why}</span>}
    </span>
  );
}

export function ShareButton({ narrow, onShare }: { narrow?: boolean; onShare: () => void }) {
  const { c } = useBw();
  return (
    <Button variant="unstyled" type="button" className={cn("bw-btn bw-outline", narrow && "bw-icon-only")} title={c("Share", "แชร์")} aria-label={c("Share", "แชร์")} onClick={onShare}>
      <Share2 className="h-4 w-4" />{!narrow && <span>{c("Share", "แชร์")}</span>}
    </Button>
  );
}

export type CardMode = "browse" | "applications" | "preview" | "mine";

export function BuyOrderCard({ card, persona, applyCtx, mode = "browse", sharedWithYou, onDetails, onApply, onShare, onEdit, onSend, busy }: {
  card: BoCard; persona: "seller" | "buyer" | "advisor"; applyCtx?: ApplyContext; mode?: CardMode; sharedWithYou?: boolean;
  onDetails: () => void; onApply: () => void; onShare: () => void; onEdit?: () => void; onSend?: () => void; busy?: boolean;
}) {
  const { c, th } = useBw();
  const sectorName = useSectorName();
  const [more, setMore] = useState(false);
  const boxId = useId();
  const closed = card.status === "closed";
  const posted = card.status === "posted";
  const managedState = managedCardState(card, applyCtx);
  const applied = mode === "browse" && persona === "seller" && (managedState ? managedState === "applied" : !!card.myApp);
  const grey = closed || applied;
  const rootRef = useRef<HTMLElement>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setNarrow(el.clientWidth - 32 < 320));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const canShare = posted && !card.yours && !card.client && mode !== "preview";
  const buttons: ReactNode[] = [];
  const unposted = card.status === "draft" || card.status === "waiting" || card.status === "sent_back";
  let stateBox: ReactNode = null;
  if (unposted) {
    if (card.status === "waiting") stateBox = <div className="bw-state bw-st-violet"><Clock className="h-4 w-4 shrink-0" /><span><b>{c("Waiting for Admin", "รอแอดมินตรวจ")}</b> {c(`since ${fmtDay(card.sentToAdminAt, false, false)}. Admin checks it, edits it and posts it.`, `ตั้งแต่ ${fmtDay(card.sentToAdminAt, true, false)} แอดมินจะตรวจ แก้ไข และลงประกาศ`)}</span></div>;
    if (card.status === "sent_back") stateBox = <div className="bw-state bw-st-red"><Undo2 className="h-4 w-4 shrink-0" /><span><b>{c("Sent back by Admin:", "แอดมินส่งกลับ:")}</b> {card.adminNote}</span></div>;
    if (card.status !== "waiting" && onEdit) {
      buttons.push(<button key="ed" type="button" className="bw-btn bw-outline" onClick={onEdit}>{c("Edit", "แก้ไข")}</button>);
      buttons.push(<button key="sd" type="button" className="bw-btn bw-navy" disabled={busy} onClick={onSend}><Send className="h-4 w-4" />{card.status === "sent_back" ? c("Send to Admin again", "ส่งให้แอดมินอีกครั้ง") : c("Send to Admin", "ส่งให้แอดมิน")}</button>);
    }
  } else if (card.appsTotal != null) {
    const n = card.appsNew ?? 0;
    const label = card.client
      ? (n ? c(`Applications · ${n} to check`, `ใบสมัคร · รอตรวจ ${n}`) : c(`Applications · ${card.appsTotal}`, `ใบสมัคร · ${card.appsTotal}`))
      : (n ? c(`Applications · ${n} new`, `ใบสมัคร · ใหม่ ${n}`) : c(`Applications · ${card.appsTotal}`, `ใบสมัคร · ${card.appsTotal}`));
    buttons.push(<Link key="apps" to="/marketplace/pipeline/invitations" search={{ view: "applications" }} className="bw-btn bw-navy"><Users className="h-4 w-4" />{label}</Link>);
  } else if (persona === "seller") {
    if (mode === "applications" && card.myApp) buttons.push(<div key="st" className="flex-[2] min-w-0"><AppState card={card} /><ForCompany company={card.forCompany} /></div>);
    else if (applied || (!managedState && card.myApp)) buttons.push(<span key="ap" className="bw-btn bw-applied"><Check className="h-4 w-4" />{c("Applied", "สมัครแล้ว")}</span>);
    else if (posted) buttons.push(<ApplyButton key="ap" ctx={applyCtx} onApply={onApply} />);
  }
  buttons.push(<Button variant="unstyled" key="vd" type="button" className="bw-btn bw-outline" onClick={onDetails}>{c("View details", "ดูรายละเอียด")}</Button>);
  const three = canShare && buttons.length >= 2;
  if (canShare) buttons.push(<ShareButton key="sh" narrow={three && narrow} onShare={onShare} />);

  const date = closed ? c(`Closed ${fmtDay(card.closesOn ?? card.closedAt)}`, `ปิดแล้ว ${fmtDay(card.closesOn ?? card.closedAt, true)}`) : card.closesOn ? c(`Closes ${fmtDay(card.closesOn)}`, `ปิดรับ ${fmtDay(card.closesOn, true)}`) : "";
  const any = (v: string) => (v === "Any" ? c("Any", "ไม่จำกัด") : v);

  return (
    <article ref={rootRef} className={cn("bw-card", grey && "bw-grey", more && "bw-open")} aria-label={`${card.name} · ${card.ref}`}>
      <div className="bw-card-cover">
        <Cover card={card} height={112}
          top={<><div className="bw-row-l"><StatusPill card={card} preview={mode === "preview"} />{card.yours && <span className="bw-pill bw-yours"><User className="h-3 w-3" />{c("Yours", "ของคุณ")}</span>}{sharedWithYou && <span className="bw-pill bw-shared"><Share2 className="h-3 w-3" />{c("Shared with you", "แชร์ให้คุณ")}</span>}</div><BuyerChip card={card} /></>}
          bottom={<><KindPill kind={card.kind} />{card.client == null && (posted || closed || mode === "preview") && (
            <span className="bw-pill bw-stats">
              <span title={c("People who opened this buy order", "คนที่เปิดดูประกาศนี้")} className="inline-flex items-center gap-1"><Eye className="h-[13px] w-[13px]" />{mode !== "preview" && card.views === 1 ? c("1 view", "เข้าชม 1 ครั้ง") : c(`${mode === "preview" ? 0 : card.views} views`, `เข้าชม ${mode === "preview" ? 0 : card.views} ครั้ง`)}</span>
              <i className="bw-dot" />
              <span title={c("Sellers who applied", "ผู้ขายที่สมัคร")} className="inline-flex items-center gap-1"><Users className="h-[13px] w-[13px]" />{c(`${mode === "preview" ? 0 : card.applied} applied`, `สมัคร ${mode === "preview" ? 0 : card.applied}`)}</span>
            </span>
          )}</>} />
      </div>
      <div className="bw-card-head">
        {card.kind === "sealed" && <span aria-hidden className="bw-watermark">{th ? "ปิดผนึก" : "SEALED"}</span>}
        <div className="bw-title-row"><h3>{card.name}</h3><span>{card.ref}</span></div>
        <p className="bw-desc">{card.description}</p>
        {card.client && <p className="bw-client"><Lock className="h-[13px] w-[13px]" />{c(`For ${card.client.name ?? "—"} · ${card.client.ref ?? "—"} · only PitchSnack sees this`, `สำหรับ ${card.client.name ?? "—"} · ${card.client.ref ?? "—"} · เห็นเฉพาะ PitchSnack`)}</p>}
        <div className="bw-req">{c("Buying requirement", "ความต้องการซื้อ")}</div>
      </div>
      <div className="bw-card-box">
        <div className="bw-box" id={boxId}>
          <div className="bw-cell bw-span bw-loc">
            <div><small>{c("Location", "ที่ตั้ง")}</small><b className="bw-one">{card.location}</b></div>
            <div className="min-w-0"><small>{c("City", "เมือง")}</small><b className="bw-one" title={card.cities}>{citiesDisplay(card.cities || "Any", th)}</b></div>
          </div>
          <div className="bw-cell"><small>{c("Property size", "ขนาดที่ดิน")}</small><b className="bw-one bw-sm">{any(card.propertySize)}</b></div>
          <div className="bw-cell"><small>{c("Factory size", "ขนาดโรงงาน")}</small><b className="bw-one bw-sm">{any(card.factorySize)}</b></div>
          <div className="bw-cell"><small>{c("Target revenue", "รายได้เป้าหมาย")}</small><b>{card.targetRevenue}</b></div>
          <div className="bw-cell"><small>{c("Target company price range", "ช่วงราคาบริษัทเป้าหมาย")}</small><b>{card.priceRange}</b></div>
          {more && <>
            <div className="bw-cell bw-span bw-deal"><small>{c("Deal type", "รูปแบบดีล")}</small><b className="bw-sm">{card.dealTypes.join(" · ") || "—"}</b></div>
            <div className="bw-cell bw-span"><small>{c("Must have", "ต้องมี")}</small><b className="bw-sm">{card.mustHave.join(" · ") || "—"}</b></div>
          </>}
        </div>
        <div className="bw-foot">
          <span><Calendar className="h-[13px] w-[13px]" />{date}</span>
          <button type="button" className="bw-more" aria-expanded={more} aria-controls={boxId} onClick={() => setMore((v) => !v)}>
            {more ? c("Show less", "แสดงน้อยลง") : c("Show more", "แสดงเพิ่ม")}<ChevronDown className={cn("h-3.5 w-3.5 transition-transform", more && "rotate-180")} />
          </button>
        </div>
      </div>
      {stateBox && <div className="px-4 pb-2">{stateBox}</div>}
      <div className="bw-buttons">{buttons}</div>
      <span className="sr-only">{sectorName(card.sector)}</span>
    </article>
  );
}
