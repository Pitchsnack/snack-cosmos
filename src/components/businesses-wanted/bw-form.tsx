import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Eye, Send } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  addMonths, bkkToday, BO_DEAL_TYPES, BO_GROUPS, BO_LOCATIONS, BO_RANGES, boSector, checkDraft, draftRow, emptyDraft, FACTORY_SIZES, fmtDay,
  lines, PERIODS, periodLabel, PROPERTY_SIZES, textKey, type BoDraft, type BoField, type BoText,
} from "@/lib/buy-orders";
import {
  BO_PROFITS, BULLET, choiceLabel, DEFAULT_NICE_TO_HAVE, DEFAULT_TIMING, defaultDescription, ensureBullets, GENERAL_MUST_HAVE, industryText, stripBullets,
} from "@/lib/buy-order-defaults";
import { saveBuyOrder, type BoCard, type BoClient } from "@/lib/buy-orders.functions";
import { BuyOrderCard, BwLang, useBw } from "./bw-card";
import { CityPicker } from "./bw-city";

/** A card from the form's values, as sellers will see it once posted. */
export function draftCard(d: BoDraft, who: { buyerType: string; country: string | null }, base?: Partial<BoCard>): BoCard {
  const r = draftRow(d);
  const today = bkkToday();
  return {
    id: base?.id ?? "preview", ref: base?.ref ?? "BO-····", kind: base?.kind ?? "advertisement", status: "posted",
    sector: r.sector, name: r.name_on_card || "—", description: r.description, location: r.location, cities: r.cities,
    propertySize: r.property_size, factorySize: r.factory_size, products: r.products, targetRevenue: r.target_revenue || "—", priceRange: r.price_range || "—",
    dealTypes: r.deal_types, mustHave: r.must_have, niceToHave: r.nice_to_have, profit: r.profit, timing: r.timing, periodMonths: r.period_months,
    nameTh: r.name_on_card_th, descriptionTh: r.description_th, productsTh: r.products_th, mustHaveTh: r.must_have_th, niceToHaveTh: r.nice_to_have_th,
    timingTh: r.timing_th, textLang: r.text_lang as "en" | "th",
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
    profit: c.profit ?? "not_stated", timing: c.timing ?? "", periodMonths: c.periodMonths,
    lang: c.textLang ?? "en", nameTh: c.nameTh ?? "", descriptionTh: c.descriptionTh ?? "", productsTh: c.productsTh ?? "",
    mustHaveTh: (c.mustHaveTh ?? []).join("\n"), niceToHaveTh: (c.niceToHaveTh ?? []).join("\n"), timingTh: c.timingTh ?? "",
  };
}

const ORDER: BoField[] = ["clientId", "sector", "name", "nameTh", "description", "descriptionTh", "location", "cities", "propertySize", "factorySize", "products", "productsTh", "targetRevenue", "priceRange", "dealTypes", "mustHave", "mustHaveTh", "niceToHave", "niceToHaveTh", "profit", "periodMonths", "timing", "timingTh"];

/** The language tag after a text's label. */
export const LangTag = ({ lang }: { lang: "en" | "th" }) => <span className={`bw-ltag bw-ltag-${lang}`}>{lang === "th" ? "TH" : "EN"}</span>;

/** The English | ไทย switch: its options read the same in both app languages. */
export function LangSwitch({ value, onChange, label }: { value: "en" | "th"; onChange: (v: "en" | "th") => void; label: string }) {
  return (
    <span className="bw-seg" role="radiogroup" aria-label={label}>
      {(["en", "th"] as const).map((l) => <button key={l} type="button" role="radio" aria-checked={value === l} onClick={() => onChange(l)}>{l === "en" ? "English" : "ไทย"}</button>)}
    </span>
  );
}

/** A bullet-point box: every line starts with "• ", Enter starts a new point, saved without the bullets. */
export function BulletArea({ id, rows, value, onChange, invalid }: { id: string; rows: number; value: string; onChange: (v: string) => void; invalid?: boolean }) {
  const { c } = useBw();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(() => (value ? ensureBullets(value) : ""));
  useEffect(() => { setText(value ? ensureBullets(value) : ""); }, [value]);
  const emit = (next: string) => { setText(next); onChange(stripBullets(next)); };
  return (
    <>
      <textarea
        ref={ref} id={id} aria-invalid={invalid || undefined} className="bw-in bw-bullet-area" rows={rows} wrap="soft" value={text}
        onFocus={() => { if (!text) emit(BULLET); }}
        onChange={(e) => {
          const raw = e.target.value;
          const pos = e.target.selectionStart ?? raw.length;
          const fixed = raw.split("\n").map((l) => (l && !l.startsWith(BULLET) ? BULLET + l : l)).join("\n");
          const added = raw.slice(0, pos).split("\n").filter((l) => l && !l.startsWith(BULLET)).length * BULLET.length;
          emit(fixed);
          requestAnimationFrame(() => { if (ref.current) ref.current.selectionStart = ref.current.selectionEnd = pos + added; });
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || !ref.current) return;
          e.preventDefault();
          const el = ref.current;
          const pos = el.selectionStart ?? text.length;
          const next = `${text.slice(0, pos)}\n${BULLET}${text.slice(el.selectionEnd ?? pos)}`;
          emit(next);
          requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = pos + 1 + BULLET.length; });
        }}
        onBlur={() => {
          const pts = stripBullets(text).split("\n").filter(Boolean);
          const next = pts.map((p) => BULLET + p).join("\n");
          if (next !== text) setText(next);
          onChange(pts.join("\n"));
        }}
      />
      <p className="bw-hint">{c("Press Enter for a new point.", "กด Enter เพื่อเพิ่มข้อใหม่")}</p>
    </>
  );
}

/** The fields; Admin's check shows only some of them (section 11.5). */
export function BoFields({ d, set, errs, clients, only, tl: tlIn, choiceTh, tags }: {
  d: BoDraft; set: (p: Partial<BoDraft>) => void; errs: Partial<Record<BoField, string>>; clients?: BoClient[] | null; only?: BoField[];
  /** Which language's text boxes to show (default: the writer's). */ tl?: "en" | "th";
  /** The choices' language (default: the app's). */ choiceTh?: boolean;
  /** EN / TH tags after the six texts' labels. */ tags?: boolean;
}) {
  const { c, th } = useBw();
  const tl = tlIn ?? d.lang ?? "en";
  const K = (f: BoText) => textKey(f, tl);
  const V = (f: BoText) => String(d[K(f)] ?? "");
  const S = (f: BoText, v: string) => set({ [K(f)]: v } as Partial<BoDraft>);
  const tag = tags ? <> <LangTag lang={tl} /></> : null;
  const ct = choiceTh ?? th;
  const cc = (en: string, t: string) => (ct ? t : en);
  const show = (f: BoField) => !only || only.includes(f);
  const errText = (f: BoField) => {
    const e = errs[f];
    if (!e) return null;
    const t = e === "description" ? c("Write a description of 10 to 400 characters.", "เขียนคำอธิบายความยาว 10 ถึง 400 ตัวอักษร")
      : e === "deal" ? c("Pick at least one deal type.", "เลือกรูปแบบดีลอย่างน้อยหนึ่งแบบ")
      : e === "long" ? c("At most 40 characters.", "ไม่เกิน 40 ตัวอักษร") : c("Pick one.", "เลือกหนึ่งรายการ");
    return <p className="bw-err" id={`bo-${f}-err`}>{t}</p>;
  };
  const inv = (f: BoField) => ({ "aria-invalid": errs[f] ? true : undefined, "aria-describedby": errs[f] ? `bo-${f}-err` : undefined, id: `bo-${f}` } as const);
  const client = clients?.find((x) => x.id === d.clientId);
  const sel = (f: BoField, opts: readonly string[], placeholder?: string) => (
    <select {...inv(f)} className="bw-in" value={String(d[f] ?? "")} onChange={(e) => set({ [f]: e.target.value } as Partial<BoDraft>)}>
      {placeholder && <option value="">{placeholder}</option>}
      {opts.map((o) => <option key={o} value={o}>{choiceLabel(o, ct)}</option>)}
    </select>
  );
  const pick = cc("Pick one", "เลือกหนึ่งรายการ");
  const closes = fmtDay(addMonths(bkkToday(), d.periodMonths), th);
  const sec = boSector(d.sector);
  const ranges = (first: BoField) => (
    <>
      <div><label className="bw-lab" htmlFor="bo-targetRevenue">{c("Target revenue", "รายได้เป้าหมาย")}</label>{sel("targetRevenue", BO_RANGES.map((r) => r.label), pick)}{errText("targetRevenue")}</div>
      <div><label className="bw-lab" htmlFor="bo-priceRange">{c("Target company price range", "ช่วงราคาบริษัทเป้าหมาย")}</label>{sel("priceRange", BO_RANGES.map((r) => r.label), pick)}{errText("priceRange")}</div>
    </>
  );
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
            const prevTh = boSector(prev)?.th ?? "";
            const nextTh = boSector(s)?.th ?? "";
            const followTh = d.lang === "th" || !!clients;
            set({ sector: s, ...(!d.name.trim() || d.name === prev ? { name: d.lang === "th" && !clients ? "" : s } : {}),
              ...(followTh && (!(d.nameTh ?? "").trim() || d.nameTh === prevTh) ? { nameTh: nextTh } : {}) });
          }}>
            <option value="">{pick}</option>
            {BO_GROUPS.map((g) => <optgroup key={g.group} label={ct ? g.th : g.group}>{g.sectors.map((x) => <option key={x.name} value={x.name}>{ct ? x.th : x.name}</option>)}</optgroup>)}
          </select>
          {errText("sector")}
        </div>
      )}
      {show("name") && (
        <div>
          <label className="bw-lab" htmlFor={`bo-${K("name")}`}>{c("Name on the card", "ชื่อบนการ์ด")}{tag}</label>
          <input {...inv(K("name"))} className="bw-in" maxLength={40} value={V("name")} placeholder={(tl === "th" ? sec?.th : sec?.name) ?? ""} onChange={(e) => S("name", e.target.value)} />
          {errText(K("name"))}
        </div>
      )}
      {show("description") && (
        <div className="bw-span2">
          <label className="bw-lab" htmlFor={`bo-${K("description")}`}>{c("Description", "คำอธิบาย")}{tag} {only && <em>{c("up to three sentences", "ไม่เกิน 3 ประโยค")}</em>}</label>
          <textarea {...inv(K("description"))} className="bw-in" rows={4} wrap="soft" maxLength={400} value={V("description")} onChange={(e) => S("description", e.target.value)} />
          <div className="flex justify-between gap-3"><p className="bw-hint">{c("Up to three sentences: who the buyer is, what they want and why. No names.", "ไม่เกิน 3 ประโยค: ผู้ซื้อคือใคร ต้องการอะไร และเพราะเหตุใด ห้ามระบุชื่อ")}</p><p className="bw-hint shrink-0">{V("description").length} / 400</p></div>
          {errText(K("description"))}
        </div>
      )}
      {show("targetRevenue") && only && ranges("targetRevenue")}
      {show("location") && <div><label className="bw-lab" htmlFor="bo-location">{c("Location", "ที่ตั้ง")}</label>{sel("location", BO_LOCATIONS)}</div>}
      {show("cities") && (
        <div>
          <label className="bw-lab" htmlFor="bo-cities">{c("City", "เมือง")}</label>
          {d.location === "Thailand"
            ? <CityPicker id="bo-cities" value={d.cities} invalid={!!errs.cities} describedBy={errs.cities ? "bo-cities-err" : undefined} namesTh={ct} onChange={(v) => set({ cities: v })} />
            : <input {...inv("cities")} className="bw-in" maxLength={200} value={d.cities} placeholder={c("For example Bangkok, or Any", "เช่น กรุงเทพฯ หรือ ไม่จำกัด")} onChange={(e) => set({ cities: e.target.value })} />}
        </div>
      )}
      {show("propertySize") && <div><label className="bw-lab" htmlFor="bo-propertySize">{c("Property size", "ขนาดที่ดิน")}</label>{sel("propertySize", PROPERTY_SIZES)}<p className="bw-hint">{c("The land, in rai (1 rai = 1,600 sqm).", "ที่ดิน หน่วยเป็นไร่ (1 ไร่ = 1,600 ตร.ม.)")}</p></div>}
      {show("factorySize") && <div><label className="bw-lab" htmlFor="bo-factorySize">{c("Factory size", "ขนาดโรงงาน")}</label>{sel("factorySize", FACTORY_SIZES)}<p className="bw-hint">{c("The factory’s floor area.", "พื้นที่ใช้สอยของโรงงาน")}</p></div>}
      {show("products") && <div className="bw-span2"><label className="bw-lab" htmlFor={`bo-${K("products")}`}>{c("Products and services", "สินค้าและบริการ")}{tag}</label><textarea {...inv(K("products"))} className="bw-in" rows={2} wrap="soft" maxLength={500} value={V("products")} onChange={(e) => S("products", e.target.value)} /></div>}
      {show("targetRevenue") && !only && ranges("targetRevenue")}
      {show("dealTypes") && (
        <div className="bw-span2" role="group" aria-labelledby="bo-deal-l">
          <span id="bo-deal-l" className="bw-lab">{c("Deal type", "รูปแบบดีล")}</span>
          <div className="flex flex-wrap gap-2" id="bo-dealTypes" tabIndex={-1}>
            {BO_DEAL_TYPES.map((x) => {
              const on = d.dealTypes.includes(x);
              return <button key={x} type="button" className="bw-chipt" aria-pressed={on} onClick={() => set({ dealTypes: on ? d.dealTypes.filter((y) => y !== x) : [...d.dealTypes, x] })}>{on ? "✓ " : ""}{choiceLabel(x, ct)}</button>;
            })}
          </div>
          {errText("dealTypes")}
        </div>
      )}
      {show("mustHave") && <div className="bw-span2"><label className="bw-lab" htmlFor={`bo-${K("mustHave")}`}>{c("Must have", "ต้องมี")}{tag}</label><BulletArea key={K("mustHave")} id={`bo-${K("mustHave")}`} invalid={!!errs[K("mustHave")]} rows={4} value={V("mustHave")} onChange={(v) => S("mustHave", v)} /></div>}
      {show("niceToHave") && <div className="bw-span2"><label className="bw-lab" htmlFor={`bo-${K("niceToHave")}`}>{c("Nice to have", "มีก็ดี")}{tag}</label><BulletArea key={K("niceToHave")} id={`bo-${K("niceToHave")}`} invalid={!!errs[K("niceToHave")]} rows={2} value={V("niceToHave")} onChange={(v) => S("niceToHave", v)} /></div>}
      {show("profit") && (
        <div className="bw-span2" role="group" aria-labelledby="bo-profit-l">
          <span className="bw-lab" id="bo-profit-l">{c("Profit", "กำไร")}</span>
          <div role="radiogroup" aria-labelledby="bo-profit-l" className="flex flex-wrap gap-2" id="bo-profit">
            {BO_PROFITS.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={d.profit === p} className="bw-period" onClick={() => set({ profit: p })}>
                {p === "yes" ? cc("Yes", "ใช่") : p === "no" ? cc("No", "ไม่ใช่") : cc("Prefer not to say", "ไม่ระบุ")}
              </button>
            ))}
          </div>
          <p className="bw-hint">{c("Should the business be profitable?", "ธุรกิจต้องมีกำไรหรือไม่")}</p>
        </div>
      )}
      {show("periodMonths") && (
        <div className={only ? "bw-span2" : undefined}>
          <span className="bw-lab" id="bo-period-l">{c("Applications close", "ปิดรับสมัคร")}</span>
          <div role="radiogroup" aria-labelledby="bo-period-l" className="flex gap-2">
            {PERIODS.map((m) => <button key={m} type="button" role="radio" aria-checked={d.periodMonths === m} className="bw-period" onClick={() => set({ periodMonths: m })}>{periodLabel(m, ct)}</button>)}
          </div>
          <p className="bw-hint">{c(`From the day it’s posted: posted today, it closes ${closes}.`, `นับจากวันที่ลงประกาศ: ถ้าลงวันนี้ จะปิด ${closes}`)}</p>
        </div>
      )}
      {show("timing") && <div><label className="bw-lab" htmlFor={`bo-${K("timing")}`}>{c("Timing", "ช่วงเวลา")}{tag}</label><input {...inv(K("timing"))} className="bw-in" maxLength={200} value={V("timing")} onChange={(e) => S("timing", e.target.value)} /></div>}
    </div>
  );
}

export function focusFirst(errs: Partial<Record<BoField, string>>) {
  const f = ORDER.find((k) => errs[k]);
  if (f) setTimeout(() => document.getElementById(`bo-${f}`)?.focus(), 30);
}

/** Post an advertisement (buyers) · Write a sealed buy order (PitchSnack Control). */
export function BuyOrderForm({ control, clients, me, editing, onClose, onSaved }: {
  control: boolean; clients: BoClient[]; me: { buyerType: string; country: string | null } | null; editing: BoCard | null;
  onClose: () => void; onSaved: (id: string) => void;
}) {
  const { c, th } = useBw();
  const save = useServerFn(saveBuyOrder);
  const appLang: "en" | "th" = th ? "th" : "en";
  // Control types both languages; a buyer writes in the app's language.
  const langs: ("en" | "th")[] = control ? ["en", "th"] : [appLang];
  // The text boxes that follow the buyer, industry and location until the writer types in them.
  const touched = useRef<Set<string>>(new Set(editing ? ["description", "products", "mustHave", "descriptionTh", "productsTh", "mustHaveTh"] : []));
  const [tl, setTl] = useState<"en" | "th">(appLang);
  const [d, setD] = useState<BoDraft>(() => {
    if (editing) return { ...cardToDraft(editing), ...(control ? { lang: "en" as const } : {}) };
    const n: BoDraft = { ...emptyDraft(), lang: control ? "en" : appLang, profit: "not_stated" };
    for (const l of langs) {
      const i = l === "th" ? 1 : 0;
      Object.assign(n, {
        [textKey("description", l)]: defaultDescription({ country: null, sector: "", location: "Thailand" }, l === "th"),
        [textKey("mustHave", l)]: GENERAL_MUST_HAVE[i].join("\n"),
        [textKey("niceToHave", l)]: DEFAULT_NICE_TO_HAVE[i].join("\n"),
        [textKey("timing", l)]: DEFAULT_TIMING[i],
      });
    }
    return n;
  });
  const [errs, setErrs] = useState<Partial<Record<BoField, string>>>({});
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const tried = useRef(false);
  const set = (p: Partial<BoDraft>) => setD((v) => {
    const n = { ...v, ...p };
    for (const k of Object.keys(p)) if (/^(description|products|mustHave)(Th)?$/.test(k)) touched.current.add(k);
    if (!editing && ("clientId" in p || "sector" in p || "location" in p)) {
      const country = clients.find((x) => x.id === n.clientId)?.country ?? me?.country ?? null;
      const it = industryText(n.sector);
      for (const l of langs) {
        const i = l === "th" ? 1 : 0;
        const k = (f: BoText) => textKey(f, l) as string;
        const w = n as unknown as Record<string, string>;
        if (!touched.current.has(k("description"))) w[k("description")] = defaultDescription({ country, sector: n.sector, location: n.location }, l === "th");
        if (!touched.current.has(k("products"))) w[k("products")] = it ? it.products[i] : "";
        if (!touched.current.has(k("mustHave"))) w[k("mustHave")] = (it ? it.mustHave[i] : GENERAL_MUST_HAVE[i]).join("\n");
      }
      if ("location" in p && p.location !== v.location) n.cities = "";
    }
    if (tried.current) setErrs(checkDraft(n, control));
    return n;
  });
  const check = () => {
    tried.current = true;
    const e = checkDraft(d, control);
    setErrs(e);
    if (!Object.keys(e).length) return true;
    setPreview(false);
    if (control) {
      const first = Object.keys(e).find((k) => /^(name|description|products|mustHave|niceToHave|timing)(Th)?$/.test(k));
      if (first) setTl(first.endsWith("Th") ? "th" : "en");
    }
    focusFirst(e);
    return false;
  };
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
  const switchLabel = c("Texts in", "ภาษาของข้อความ");
  const card = <BuyOrderCard card={draftCard(d, who, editing ?? undefined)} persona="buyer" mode="preview" onDetails={() => {}} onApply={() => {}} onShare={() => {}} />;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-32px)] max-w-[780px] overflow-y-auto">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{line}</DialogDescription>
        {preview ? (
          <div>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <p className="flex min-w-0 flex-1 items-start gap-2 text-[13.5px]"><Eye className="mt-0.5 h-4 w-4 shrink-0" /><span><b>{c("Preview.", "ดูตัวอย่าง")}</b> {control
                ? c("This is how sellers will see this buy order in Businesses Wanted, once Admin posts it.", "ผู้ขายจะเห็นประกาศรับซื้อนี้แบบนี้ในหน้า ธุรกิจที่ผู้ซื้อต้องการ เมื่อแอดมินเผยแพร่แล้ว")
                : c("This is how sellers will see your advertisement in Businesses Wanted, once Admin posts it.", "นี่คือสิ่งที่ผู้ขายจะเห็นประกาศของคุณในธุรกิจที่ผู้ซื้อต้องการ เมื่อแอดมินลงประกาศแล้ว")}</span></p>
              {control && <LangSwitch value={tl} onChange={setTl} label={switchLabel} />}
            </div>
            <div className="bw-preview-panel"><div className="mx-auto max-w-[380px]">{control ? <BwLang value={tl}>{card}</BwLang> : card}</div></div>
          </div>
        ) : (
          <>
            {control && (
              <div className="bw-langrow">
                <span className="bw-lab mb-0">{switchLabel}</span>
                <LangSwitch value={tl} onChange={setTl} label={switchLabel} />
                <span className="bw-langrow-hint">{c("Type each text in English and Thai. Sellers and buyers read it in their app’s language.", "พิมพ์ข้อความแต่ละช่องทั้งภาษาอังกฤษและภาษาไทย ผู้ขายและผู้ซื้อจะอ่านตามภาษาที่ตั้งไว้ในแอป")}</span>
              </div>
            )}
            <BoFields d={d} set={set} errs={errs} clients={control ? clients : null} tl={control ? tl : d.lang} choiceTh={control ? tl === "th" : undefined} tags={control} />
          </>
        )}
        <DialogFooter className="gap-2 sm:justify-end">
          {preview
            ? <Button variant="outline" className="sm:mr-auto" onClick={() => setPreview(false)}><ChevronLeft className="h-4 w-4" />{c("Back to edit", "กลับไปแก้ไข")}</Button>
            : <Button variant="outline" onClick={onClose}>{c("Cancel", "ยกเลิก")}</Button>}
          <Button variant="outline" disabled={busy} onClick={() => run(false)}>{c("Save draft", "บันทึกฉบับร่าง")}</Button>
          {!preview && <Button variant="outline" onClick={() => check() && setPreview(true)}><Eye className="h-4 w-4" />{c("Preview", "ดูตัวอย่าง")}</Button>}
          <Button disabled={busy} onClick={() => run(true)}><Send className="h-4 w-4" />{sendLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { lines };
