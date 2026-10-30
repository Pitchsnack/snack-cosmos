import { localizeCard } from "@/lib/buy-orders";
import { Link } from "@tanstack/react-router";
import { Building, Share2 } from "lucide-react";
import { useEffect } from "react";
import { Calendar, Check, Lock, Plus, X, EyeOff } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { addMonths, bkkToday, fmtDay, placeOf, raiSqm } from "@/lib/buy-orders";
import { citiesDisplay, profitLabel } from "@/lib/buy-order-defaults";
import { recordBuyOrderView, type ApplyContext, type BoCard } from "@/lib/buy-orders.functions";
import { AppState, ApplyButton, BuyerChip, Cover, ForCompany, KindPill, managedCardState, ShareButton, StatusPill, useBw, useSectorName } from "./bw-card";
import { cn } from "@/lib/utils";

export function BuyOrderDetails({ card: rawCard, persona, applyCtx, onClose, onApply, onShare }: {
  card: BoCard | null; persona: "seller" | "buyer" | "advisor"; applyCtx?: ApplyContext;
  onClose: () => void; onApply: (c: BoCard) => void; onShare: (c: BoCard) => void;
}) {
  const { c, th } = useBw();
  const card = rawCard && localizeCard(rawCard, th);
  const sectorName = useSectorName();
  const record = useServerFn(recordBuyOrderView);
  useEffect(() => {
    if (card && !card.yours && !card.client) record({ data: { id: card.id } }).catch(() => {});
  }, [card?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!card) return null;
  const posted = card.status === "posted";
  const closed = card.status === "closed";
  const sealed = card.kind === "sealed";
  const managedState = managedCardState(card, applyCtx);
  const date = closed
    ? c(`Closed ${fmtDay(card.closesOn ?? card.closedAt)}`, `ปิดแล้ว ${fmtDay(card.closesOn ?? card.closedAt, true)}`)
    : card.postedAt
    ? c(`Posted ${fmtDay(card.postedAt)} · Applications close ${fmtDay(card.closesOn)}`, `ลงประกาศ ${fmtDay(card.postedAt, true)} · ปิดรับสมัคร ${fmtDay(card.closesOn, true)}`)
    : c(`Applications close ${fmtDay(addMonths(bkkToday(), card.periodMonths))}`, `ปิดรับสมัคร ${fmtDay(addMonths(bkkToday(), card.periodMonths), true)}`);
  const any = (v: string | null) => (v === "Any" ? c("Any", "ไม่จำกัด") : v);
  const sqm = raiSqm(card.propertySize);
  const Row = ({ l, v }: { l: string; v: React.ReactNode }) => (v == null || v === "" ? null : <div className="bw-drow"><span>{l}</span><span>{v}</span></div>);

  let aboutLine: string | null = null;
  if (card.client) aboutLine = null;
  else if (card.yours) aboutLine = c(`This is your advertisement. Sellers see “${card.buyerType} · ${card.country ?? ""}” until they approve your NDA.`, `นี่คือประกาศของคุณ ผู้ขายจะเห็น “${card.buyerType} · ${card.country ?? ""}” จนกว่าจะอนุมัติ NDA ของคุณ`);
  else if (persona === "seller") aboutLine = sealed
    ? c("PitchSnack manages and supports this buyer throughout the acquisition process. The buyer’s name remains confidential. If your company is shortlisted, the PitchSnack team will contact you directly on the buyer’s behalf to move forward.", "PitchSnack ดูแลและสนับสนุนผู้ซื้อรายนี้ตลอดกระบวนการซื้อกิจการ ชื่อของผู้ซื้อถูกเก็บเป็นความลับ หากบริษัทของคุณผ่านการคัดเลือก ทีม PitchSnack จะติดต่อคุณโดยตรงในนามของผู้ซื้อเพื่อดำเนินการต่อ")
    : c("The buyer posted this advertisement. Their name stays private until you approve their NDA.", "ผู้ซื้อลงประกาศนี้เอง ชื่อของผู้ซื้อถูกเก็บเป็นความลับจนกว่าคุณจะอนุมัติ NDA")
  else aboutLine = sealed ? c("PitchSnack keeps this buyer’s name private.", "PitchSnack เก็บชื่อผู้ซื้อรายนี้เป็นความลับ") : c("This buyer’s name stays private until a seller approves their NDA.", "ชื่อผู้ซื้อรายนี้ถูกเก็บเป็นความลับจนกว่าผู้ขายจะอนุมัติ NDA");

  const steps = sealed
    ? [[c("Apply", "สมัคร"), c("With your listing", "ด้วยประกาศของคุณ")], [c("Review", "พิจารณา"), c("By PitchSnack, within 5 business days", "โดย PitchSnack ภายใน 5 วันทำการ")], [c("NDA approved", "อนุมัติ NDA"), c("The buyer sees your company’s name", "ผู้ซื้อเห็นชื่อบริษัทของคุณ")], [c("LOI accepted", "ยอมรับ LOI"), c("You see the buyer’s name", "คุณเห็นชื่อผู้ซื้อ")]]
    : [[c("Apply", "สมัคร"), c("With your listing", "ด้วยประกาศของคุณ")], [c("Review", "พิจารณา"), c("Shortlisted by the buyer", "ผู้ซื้อคัดเลือก")], [c("NDA requested", "ขอ NDA"), c("By the buyer", "โดยผู้ซื้อ")], [c("NDA approved", "อนุมัติ NDA"), c("You see each other’s names", "เห็นชื่อของกันและกัน")]];
  const lockLine = sealed
    ? c("Until the LOI is signed, the buyer is shown as a PitchSnack Private Client, and the PitchSnack team communicates on the buyer’s behalf.", "จนกว่าจะลงนาม LOI ผู้ซื้อจะแสดงเป็นลูกค้าส่วนตัวของ PitchSnack และทีม PitchSnack จะสื่อสารในนามของผู้ซื้อ")
    : c("Until you approve the NDA, the buyer sees your Listing view, never your company’s name.", "จนกว่าคุณจะอนุมัติ NDA ผู้ซื้อจะเห็นเฉพาะมุมมองประกาศ ไม่เห็นชื่อบริษัทของคุณ");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bw-dialog bw-details [&>button.absolute]:hidden">
        <Cover card={card} height={96} top={<><StatusPill card={card} /><span /></>} />
        <button type="button" className="bw-x" aria-label={c("Close", "ปิด")} onClick={onClose}><X className="h-4 w-4" /></button>
        <div className="bw-dbody">
          <DialogTitle className="bw-dtitle">{card.name} <span>{card.ref} · {placeOf(citiesDisplay(card.cities, th), card.location)}</span></DialogTitle>
          <DialogDescription className="bw-ddesc">{card.description}</DialogDescription>
          <div className="mt-2.5 flex flex-wrap items-center gap-2"><BuyerChip card={card} solid /><KindPill kind={card.kind} bordered /></div>
          <div className="bw-dline"><Calendar className="h-[13px] w-[13px]" />{date}</div>
          {card.sharedBy && (
            <div className="bw-sharedbox"><Share2 className="h-4 w-4 shrink-0" /><div>
              <b>{c(`${card.sharedBy} shared this buy order with you.`, `${card.sharedBy} แชร์ประกาศซื้อนี้ให้คุณ`)}</b>{" "}
              {persona !== "seller" ? c("Only sellers apply to buy orders. You can share it with someone whose business may fit.", "เฉพาะผู้ขายที่สมัครประกาศซื้อได้ คุณสามารถแชร์ให้คนที่มีธุรกิจที่อาจเหมาะได้")
                : applyCtx?.state === "approved" ? c("Your company is approved: you can apply.", "บริษัทของคุณได้รับการอนุมัติแล้ว: คุณสมัครได้")
                : applyCtx?.state === "pending" ? c("PitchSnack is checking your company, usually within 1 business day. You can apply once it’s approved.", "PitchSnack กำลังตรวจสอบบริษัทของคุณ โดยปกติภายใน 1 วันทำการ คุณสมัครได้เมื่อได้รับอนุมัติ")
                : <>{c("To apply, set up your company on My Company and click Register your company. PitchSnack checks it, usually within 1 business day.", "หากต้องการสมัคร ให้ตั้งค่าบริษัทในบริษัทของฉัน แล้วกดลงทะเบียนบริษัท PitchSnack จะตรวจสอบ โดยปกติภายใน 1 วันทำการ")}
                  <div className="mt-2"><Link to="/my-startups" className="bw-sharedgo"><Building className="h-3.5 w-3.5" />{c("Go to My Company", "ไปที่บริษัทของฉัน")}</Link></div></>}
            </div></div>
          )}

          {card.client && (
            <div className="bw-violet"><Lock className="h-4 w-4 shrink-0" /><span><b>{c(`For ${card.client.name ?? "—"} · ${card.client.ref ?? "—"}.`, `สำหรับ ${card.client.name ?? "—"} · ${card.client.ref ?? "—"}`)}</b> {c(`Only PitchSnack sees the client. Sellers and buyers see “${card.buyerType} · ${card.country ?? ""}”. Written by ${card.client.writer ?? "—"}.`, `เฉพาะ PitchSnack ที่เห็นลูกค้า ผู้ขายและผู้ซื้อเห็น “${card.buyerType} · ${card.country ?? ""}” เขียนโดย ${card.client.writer ?? "—"}`)}</span></div>
          )}
          {persona === "seller" && (card.managedApps?.length ? card.managedApps.map((a) => <div className="mt-3" key={a.id}><AppState card={{ ...card, myApp: { status: a.status, appliedAt: a.appliedAt } }} /><ForCompany company={{ name: a.company, ref: a.ref }} /></div>) : card.myApp ? <div className="mt-3"><AppState card={card} /></div> : null)}

          <div className="bw-dgrid">
            <section className="bw-dsec">
              <h4>{c("What the buyer wants", "สิ่งที่ผู้ซื้อต้องการ")}</h4>
              <Row l={c("Industry", "อุตสาหกรรม")} v={<>{sectorName(card.sector)} <span className="text-[#9CA3AF]">(SET)</span></>} />
              <Row l={c("Products and services", "สินค้าและบริการ")} v={card.products} />
              <Row l={c("Location", "ที่ตั้ง")} v={card.location} />
              <Row l={c("City", "เมือง")} v={citiesDisplay(card.cities, th)} />
              <Row l={c("Property size", "ขนาดที่ดิน")} v={<>{any(card.propertySize)}{sqm && <span className="text-[#9CA3AF]"> ({sqm} {c("sqm", "ตร.ม.")})</span>}</>} />
              <Row l={c("Factory size", "ขนาดโรงงาน")} v={any(card.factorySize)} />
            </section>
            <section className="bw-dsec">
              <h4>{c("Size and deal", "ขนาดและดีล")}</h4>
              <Row l={c("Target revenue", "รายได้เป้าหมาย")} v={card.targetRevenue} />
              <Row l={c("Profit", "กำไร")} v={profitLabel(card.profit, th)} />
              <Row l={c("Deal type", "รูปแบบดีล")} v={card.dealTypes.join(" · ")} />
              <Row l={c("Target company price range", "ช่วงราคาบริษัทเป้าหมาย")} v={card.priceRange} />
              <Row l={c("Timing", "ระยะเวลา")} v={card.timing} />
            </section>
            <section className="bw-dsec">
              <h4>{c("Must have", "ต้องมี")}</h4>
              {card.mustHave.length ? <ul className="bw-list">{card.mustHave.map((m) => <li key={m}><Check className="h-4 w-4 text-[#16A34A]" />{m}</li>)}</ul> : <p className="text-[#9CA3AF] text-[13.5px]">{c("Nothing set.", "ไม่ได้กำหนด")}</p>}
            </section>
            <section className="bw-dsec">
              <h4>{c("Nice to have", "มีก็ดี")}</h4>
              {card.niceToHave.length ? <ul className="bw-list">{card.niceToHave.map((m) => <li key={m}><Plus className="h-4 w-4 text-[#9CA3AF]" />{m}</li>)}</ul> : <p className="text-[#9CA3AF] text-[13.5px]">{c("Nothing more.", "ไม่มีเพิ่มเติม")}</p>}
            </section>
            <section className="bw-dsec bw-wide">
              <h4>{c("About the buyer", "เกี่ยวกับผู้ซื้อ")}</h4>
              {card.aboutBuyer && <p className="bw-about">{card.aboutBuyer}</p>}
              {aboutLine && <div className={cn("bw-aboutline", card.yours && "bw-aboutline-own")}>{card.yours ? <EyeOff className="h-3.5 w-3.5 shrink-0" /> : <Lock className="h-3.5 w-3.5 shrink-0" />}<span>{aboutLine}</span></div>}
            </section>
            {persona === "seller" && !card.yours && (
              <section className="bw-dsec bw-wide">
                <h4>{c("How it works", "ขั้นตอน")}</h4>
                <ol className="bw-steps">
                  {steps.map(([t, s], i) => <li key={i}><span className={cn("bw-stepdot", i === 3 && "bw-stepdot-last")}>{i + 1}</span><div><b>{t}</b><small>{s}</small></div></li>)}
                </ol>
                <div className="bw-lockline"><Lock className="h-3.5 w-3.5 shrink-0" />{lockLine}</div>
              </section>
            )}
          </div>
        </div>
        <div className="bw-dfoot">
          <button type="button" className="bw-btn bw-outline flex-none px-4" onClick={onClose}>{c("Close", "ปิด")}</button>
          {persona === "seller" && posted && (managedState ? managedState === "available" : !card.myApp && !card.forCompany) && <span className="flex-none"><ApplyButton ctx={applyCtx} onApply={() => onApply(card)} /></span>}
          {persona === "seller" && posted && managedState === "applied" && <span className="bw-btn bw-applied flex-none"><Check className="h-4 w-4" />{c("Applied", "สมัครแล้ว")}</span>}
          {posted && !card.yours && !card.client && <span className="flex-none"><ShareButton onShare={() => onShare(card)} /></span>}
        </div>
        <span className="sr-only">{th ? "" : ""}</span>
      </DialogContent>
    </Dialog>
  );
}
