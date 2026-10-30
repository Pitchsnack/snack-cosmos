import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Eye, Send } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  addMonths, bkkToday, BO_DEAL_TYPES, BO_GROUPS, BO_LOCATIONS, BO_RANGES, boSector, checkDraft, draftRow, emptyDraft, FACTORY_SIZES, fmtDay,
  lines, PERIODS, periodLabel, PROPERTY_SIZES, type BoDraft, type BoField,
} from "@/lib/buy-orders";
import { saveBuyOrder, type BoCard, type BoClient } from "@/lib/buy-orders.functions";
import { BuyOrderCard, useBw } from "./bw-card";

/** A card from the form's values, as sellers will see it once posted. */
export function draftCard(d: BoDraft, who: { buyerType: string; country: string | null }, base?: Partial<BoCard>): BoCard {
  const r = draftRow(d);
  const today = bkkToday();
  return {
    id: base?.id ?? "preview", ref: base?.ref ?? "BO-····", kind: base?.kind ?? "advertisement", status: "posted",
    sector: r.sector, name: r.name_on_card || "—", description: r.description, location: r.location, cities: r.cities,
    propertySize: r.property_size, factorySize: r.factory_size, products: r.products, targetRevenue: r.target_revenue || "—", priceRange: r.price_range || "—",
    dealTypes: r.deal_types, mustHave: r.must_have, niceToHave: r.nice_to_have, profit: r.profit, timing: r.timing, periodMonths: r.period_months,
    postedAt: new Date().toISOString(), closesOn: addMonths(today, d.periodMonths), closedAt: null,
    buyerType: who.buyerType, country: who.country, aboutBuyer: null, views: 0, applied: 0, yours: false, myApp: null,
    appsTotal: null, appsNew: null, sentToAdminAt: null, adminNote: null, extendedCount: 0, client: null,
    cover: base?.sector === d.sector ? base.cover : undefined,
  };
}

export function cardToDraft(c: BoCard): BoDraft {
  return {
    clientId: c.client?.id ?? null, sector: c.sector, name: c.name, description: c.description, location: c.location,
    cities: c.cities === "Any" ? "" : c.cities, propertySize: c.propertySize, factorySize: c.factorySize, products: c.products ?? "",
    targetRevenue: c.targetRevenue, priceRange: c.priceRange, dealTypes: c.dealTypes, mustHave: c.mustHave.join("\n"), niceToHave: c.niceToHave.join("\n"),
    profit: c.profit ?? "", timing: c.timing ?? "", periodMonths: c.periodMonths,
  };
}

const ORDER: BoField[] = ["clientId", "sector", "name", "description", "location", "cities", "propertySize", "factorySize", "products", "targetRevenue", "priceRange", "dealTypes", "mustHave", "niceToHave", "profit", "periodMonths", "timing"];

/** The fields; Admin's check shows only some of them (section 11.5). */
export function BoFields({ d, set, errs, clients, only }: {
  d: BoDraft; set: (p: Partial<BoDraft>) => void; errs: Partial<Record<BoField, string>>; clients?: BoClient[] | null; only?: BoField[];
}) {
  const { c, th } = useBw();
  const show = (f: BoField) => !only || only.includes(f);
  const errText = (f: BoField) => {
    const e = errs[f];
    if (!e) return null;
    const t = e === "description" ? c("Write a description of 10 to 280 characters.", "เขียนคำอธิบาย 10 ถึง 280 ตัวอักษร")
      : e === "deal" ? c("Pick at least one deal type.", "เลือกรูปแบบดีลอย่างน้อยหนึ่งแบบ")
      : e === "long" ? c("At most 40 characters.", "ไม่เกิน 40 ตัวอักษร") : c("Pick one.", "เลือกหนึ่งรายการ");
    return <p className="bw-err" id={`bo-${f}-err`}>{t}</p>;
  };
  const inv = (f: BoField) => ({ "aria-invalid": errs[f] ? true : undefined, "aria-describedby": errs[f] ? `bo-${f}-err` : undefined, id: `bo-${f}` } as const);
  const client = clients?.find((x) => x.id === d.clientId);
  const sel = (f: BoField, opts: readonly string[], placeholder?: string) => (
    <select {...inv(f)} className="bw-in" value={String(d[f] ?? "")} onChange={(e) => set({ [f]: e.target.value } as Partial<BoDraft>)}>
      {placeholder && <option value="">{placeholder}</option>}
      {opts.map((o) => <option key={o} value={o}>{o === "Any" ? c("Any", "ไม่จำกัด") : o}</option>)}
    </select>
  );
  const pick = c("Pick one", "เลือก");
  const closes = fmtDay(addMonths(bkkToday(), d.periodMonths), th);
  return (
    <div className="bw-form">
      {clients && show("clientId") && (
        <div className="bw-span2">
          <label className="bw-lab" htmlFor="bo-clientId">{c("For which buyer", "สำหรับผู้ซื้อรายใด")}</label>
          <select {...inv("clientId")} className="bw-in" value={d.clientId ?? ""} onChange={(e) => set({ clientId: e.target.value || null })}>
            <option value="">{pick}</option>
            {clients.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.ref ?? "—"}</option>)}
          </select>
          {client && <p className="bw-hint">{c(`Sellers and buyers see “${client.buyerType}${client.country ? ` · ${client.country}` : ""}”.`, `ผู้ขายและผู้ซื้อจะเห็น “${client.buyerType}${client.country ? ` · ${client.country}` : ""}”`)}</p>}
          {errText("clientId")}
        </div>
      )}
      {show("sector") && (
        <div>
          <label className="bw-lab" htmlFor="bo-sector">{c("Industry (SET sector)", "อุตสาหกรรม (กลุ่ม SET)")}</label>
          <select {...inv("sector")} className="bw-in" value={d.sector} onChange={(e) => {
            const s = e.target.value;
            const prev = d.sector;
            set({ sector: s, ...(!d.name.trim() || d.name === prev ? { name: s } : {}) });
          }}>
            <option value="">{pick}</option>
            {BO_GROUPS.map((g) => <optgroup key={g.group} label={th ? g.th : g.group}>{g.sectors.map((x) => <option key={x.name} value={x.name}>{th ? x.th : x.name}</option>)}</optgroup>)}
          </select>
          {errText("sector")}
        </div>
      )}
      {show("name") && (
        <div>
          <label className="bw-lab" htmlFor="bo-name">{c("Name on the card", "ชื่อบนการ์ด")}</label>
          <input {...inv("name")} className="bw-in" maxLength={40} value={d.name} placeholder={boSector(d.sector)?.name ?? ""} onChange={(e) => set({ name: e.target.value })} />
          {errText("name")}
        </div>
      )}
      {show("description") && (
        <div className="bw-span2">
          <label className="bw-lab" htmlFor="bo-description">{c("Description", "คำอธิบาย")} {only && <em>{c("up to two sentences", "ไม่เกินสองประโยค")}</em>}</label>
          <textarea {...inv("description")} className="bw-in" rows={3} maxLength={280} value={d.description} onChange={(e) => set({ description: e.target.value })} />
          <div className="flex justify-between gap-3"><p className="bw-hint">{c("Up to two sentences: who the buyer is, what they want and why. No names.", "ไม่เกินสองประโยค: ผู้ซื้อคือใคร ต้องการอะไร และเพราะอะไร ห้ามใส่ชื่อ")}</p><p className="bw-hint shrink-0">{d.description.length} / 280</p></div>
          {errText("description")}
        </div>
      )}
      {show("targetRevenue") && only && <><div><label className="bw-lab" htmlFor="bo-targetRevenue">{c("Target revenue", "รายได้เป้าหมาย")}</label>{sel("targetRevenue", BO_RANGES.map((r) => r.label), pick)}{errText("targetRevenue")}</div>
        <div><label className="bw-lab" htmlFor="bo-priceRange">{c("Price range", "ช่วงราคา")}</label>{sel("priceRange", BO_RANGES.map((r) => r.label), pick)}{errText("priceRange")}</div></>}
      {show("location") && <div><label className="bw-lab" htmlFor="bo-location">{c("Location", "ที่ตั้ง")}</label>{sel("location", BO_LOCATIONS)}</div>}
      {show("cities") && <div><label className="bw-lab" htmlFor="bo-cities">{c("City", "เมือง")}</label><input {...inv("cities")} className="bw-in" maxLength={200} value={d.cities} placeholder={c("For example Bangkok, or Any", "เช่น กรุงเทพฯ หรือ ไม่จำกัด")} onChange={(e) => set({ cities: e.target.value })} /></div>}
      {show("propertySize") && <div><label className="bw-lab" htmlFor="bo-propertySize">{c("Property size", "ขนาดที่ดิน")}</label>{sel("propertySize", PROPERTY_SIZES)}<p className="bw-hint">{c("The land, in rai (1 rai = 1,600 sqm).", "ที่ดิน หน่วยเป็นไร่ (1 ไร่ = 1,600 ตร.ม.)")}</p></div>}
      {show("factorySize") && <div><label className="bw-lab" htmlFor="bo-factorySize">{c("Factory size", "ขนาดโรงงาน")}</label>{sel("factorySize", FACTORY_SIZES)}<p className="bw-hint">{c("The factory’s floor area.", "พื้นที่ใช้สอยของโรงงาน")}</p></div>}
      {show("products") && <div className="bw-span2"><label className="bw-lab" htmlFor="bo-products">{c("Products", "สินค้า")}</label><input id="bo-products" className="bw-in" maxLength={500} value={d.products} onChange={(e) => set({ products: e.target.value })} /></div>}
      {show("targetRevenue") && !only && <><div><label className="bw-lab" htmlFor="bo-targetRevenue">{c("Target revenue", "รายได้เป้าหมาย")}</label>{sel("targetRevenue", BO_RANGES.map((r) => r.label), pick)}{errText("targetRevenue")}</div>
        <div><label className="bw-lab" htmlFor="bo-priceRange">{c("Price range", "ช่วงราคา")}</label>{sel("priceRange", BO_RANGES.map((r) => r.label), pick)}{errText("priceRange")}</div></>}
      {show("dealTypes") && (
        <div className="bw-span2" role="group" aria-labelledby="bo-deal-l">
          <span id="bo-deal-l" className="bw-lab">{c("Deal type", "รูปแบบดีล")}</span>
          <div className="flex flex-wrap gap-2" id="bo-dealTypes" tabIndex={-1}>
            {BO_DEAL_TYPES.map((x) => {
              const on = d.dealTypes.includes(x);
              return <button key={x} type="button" className="bw-chipt" aria-pressed={on} onClick={() => set({ dealTypes: on ? d.dealTypes.filter((y) => y !== x) : [...d.dealTypes, x] })}>{on ? "✓ " : ""}{x}</button>;
            })}
          </div>
          {errText("dealTypes")}
        </div>
      )}
      {show("mustHave") && <div className="bw-span2"><label className="bw-lab" htmlFor="bo-mustHave">{c("Must have", "ต้องมี")} <em>{c("one per line", "บรรทัดละหนึ่งข้อ")}</em></label><textarea id="bo-mustHave" className="bw-in" rows={3} value={d.mustHave} onChange={(e) => set({ mustHave: e.target.value })} /></div>}
      {show("niceToHave") && <div className="bw-span2"><label className="bw-lab" htmlFor="bo-niceToHave">{c("Nice to have", "มีก็ดี")} <em>{c("one per line", "บรรทัดละหนึ่งข้อ")}</em></label><textarea id="bo-niceToHave" className="bw-in" rows={3} value={d.niceToHave} onChange={(e) => set({ niceToHave: e.target.value })} /></div>}
      {show("profit") && <div className="bw-span2"><label className="bw-lab" htmlFor="bo-profit">{c("Profit", "กำไร")}</label><input id="bo-profit" className="bw-in" maxLength={200} value={d.profit} onChange={(e) => set({ profit: e.target.value })} /></div>}
      {show("periodMonths") && (
        <div className={only ? "bw-span2" : undefined}>
          <span className="bw-lab" id="bo-period-l">{c("Applications close", "ปิดรับสมัคร")}</span>
          <div role="radiogroup" aria-labelledby="bo-period-l" className="flex gap-2">
            {PERIODS.map((m) => <button key={m} type="button" role="radio" aria-checked={d.periodMonths === m} className="bw-period" onClick={() => set({ periodMonths: m })}>{periodLabel(m, th)}</button>)}
          </div>
          <p className="bw-hint">{c(`From the day it’s posted: posted today, it closes ${closes}.`, `นับจากวันที่ลงประกาศ: ถ้าลงวันนี้ จะปิด ${closes}`)}</p>
        </div>
      )}
      {show("timing") && <div><label className="bw-lab" htmlFor="bo-timing">{c("Timing", "ช่วงเวลา")}</label><input id="bo-timing" className="bw-in" maxLength={200} value={d.timing} onChange={(e) => set({ timing: e.target.value })} /></div>}
    </div>
  );
}

export function focusFirst(errs: Partial<Record<BoField, string>>) {
  const f = ORDER.find((k) => errs[k]);
  if (f) requestAnimationFrame(() => document.getElementById(`bo-${f}`)?.focus());
}

/** Post an advertisement (buyers) · Write a sealed buy order (PitchSnack Control). */
export function BuyOrderForm({ control, clients, me, editing, onClose, onSaved }: {
  control: boolean; clients: BoClient[]; me: { buyerType: string; country: string | null } | null; editing: BoCard | null;
  onClose: () => void; onSaved: (id: string) => void;
}) {
  const { c } = useBw();
  const save = useServerFn(saveBuyOrder);
  const [d, setD] = useState<BoDraft>(() => (editing ? cardToDraft(editing) : emptyDraft()));
  const [errs, setErrs] = useState<Partial<Record<BoField, string>>>({});
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const tried = useRef(false);
  const set = (p: Partial<BoDraft>) => setD((v) => { const n = { ...v, ...p }; if (tried.current) setErrs(checkDraft(n, control)); return n; });
  const check = () => { tried.current = true; const e = checkDraft(d, control); setErrs(e); if (Object.keys(e).length) { setPreview(false); focusFirst(e); return false; } return true; };
  const who = useMemo(() => {
    const cl = clients.find((x) => x.id === d.clientId);
    return cl ? { buyerType: cl.buyerType, country: cl.country } : me ?? { buyerType: "Buyer", country: null };
  }, [clients, d.clientId, me]);
  const run = async (send: boolean) => {
    if (!check()) return;
    setBusy(true);
    try {
      const r = await save({ data: { id: editing?.id ?? null, draft: d, send } });
      toast.success(!send ? c("Saved as a draft.", "บันทึกเป็นฉบับร่างแล้ว") : control ? c("Sent to Admin. Admin checks it, edits it and posts it.", "ส่งให้แอดมินแล้ว แอดมินจะตรวจ แก้ไข และลงประกาศ") : c("Submitted. Admin checks it before it goes live.", "ส่งแล้ว แอดมินจะตรวจก่อนเผยแพร่"));
      onSaved(r.id);
    } catch (e) {
      const m = String((e as Error).message);
      toast.error(m.startsWith("BO_CHANGED") ? c("This buy order has changed. Refresh and try again.", "ประกาศนี้มีการเปลี่ยนแปลง กรุณารีเฟรชแล้วลองอีกครั้ง") : m);
    } finally { setBusy(false); }
  };
  const title = control ? c("Write a sealed buy order", "เขียนประกาศซื้อแบบปิดผนึก") : c("Post an advertisement", "ลงประกาศ");
  const line = control
    ? c("For a buyer PitchSnack looks after. Sellers see the buyer’s name only when they accept the buyer’s LOI. Admin checks it, edits it and posts it.", "สำหรับผู้ซื้อที่ PitchSnack ดูแล ผู้ขายจะเห็นชื่อผู้ซื้อเมื่อยอมรับ LOI ของผู้ซื้อเท่านั้น แอดมินจะตรวจ แก้ไข และลงประกาศ")
    : c(`Your own buy order. Sellers apply to you directly, and Admin checks it before it goes live. Sellers see “${who.buyerType}${who.country ? ` · ${who.country}` : ""}”, not your name, until they approve your NDA.`, `ประกาศซื้อของคุณเอง ผู้ขายสมัครกับคุณโดยตรง และแอดมินจะตรวจก่อนเผยแพร่ ผู้ขายจะเห็น “${who.buyerType}${who.country ? ` · ${who.country}` : ""}” ไม่ใช่ชื่อของคุณ จนกว่าจะอนุมัติ NDA ของคุณ`);
  const sendLabel = control ? c("Send to Admin", "ส่งให้แอดมิน") : c("Submit", "ส่ง");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-32px)] max-w-[780px] overflow-y-auto">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{line}</DialogDescription>
        {preview ? (
          <div>
            <p className="mb-3 flex items-start gap-2 text-[13.5px]"><Eye className="mt-0.5 h-4 w-4 shrink-0" /><span><b>{c("Preview.", "ตัวอย่าง")}</b> {c("This is how sellers will see your advertisement in Businesses Wanted, once Admin posts it.", "นี่คือสิ่งที่ผู้ขายจะเห็นประกาศของคุณในธุรกิจที่ผู้ซื้อต้องการ เมื่อแอดมินลงประกาศแล้ว")}</span></p>
            <div className="bw-preview-panel"><div className="mx-auto max-w-[380px]"><BuyOrderCard card={draftCard(d, who, editing ?? undefined)} persona="buyer" mode="preview" onDetails={() => {}} onApply={() => {}} onShare={() => {}} /></div></div>
          </div>
        ) : <BoFields d={d} set={set} errs={errs} clients={control ? clients : null} />}
        <DialogFooter className="gap-2 sm:justify-end">
          {preview
            ? <Button variant="outline" className="sm:mr-auto" onClick={() => setPreview(false)}><ChevronLeft className="h-4 w-4" />{c("Back to edit", "กลับไปแก้ไข")}</Button>
            : <Button variant="outline" onClick={onClose}>{c("Cancel", "ยกเลิก")}</Button>}
          <Button variant="outline" disabled={busy} onClick={() => run(false)}>{c("Save draft", "บันทึกฉบับร่าง")}</Button>
          {!control && !preview && <Button variant="outline" onClick={() => check() && setPreview(true)}><Eye className="h-4 w-4" />{c("Preview", "ดูตัวอย่าง")}</Button>}
          <Button disabled={busy} onClick={() => run(true)}><Send className="h-4 w-4" />{sendLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { lines };
