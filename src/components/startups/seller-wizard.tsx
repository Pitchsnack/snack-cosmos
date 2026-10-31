import { tr, useTranslation } from "@/i18n/language";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Lock, AlertTriangle, Check as CheckIcon, Sparkles, Globe } from "lucide-react";
import { StepBar, MissedNote, type StepItem } from "@/components/common/step-bar";
import { Button } from "@/components/ui/button";
import { WebsiteCheckLink } from "@/components/startups/website-check-link";
import { useServerFn } from "@tanstack/react-start";
import { checkWebsiteReachable } from "@/lib/website-check.functions";
import { ConfirmWebsiteDialog } from "@/components/startups/confirm-website-dialog";
import { SellerTypeQuestion } from "@/components/common/business-type-question";
import type { SectorPick } from "@/lib/business-types";
import { AddressBox } from "@/components/advisor/advisor-firm-fields";
import { DealQ, HandoverQ, PhotosQ, PriceQ, type WizardMedia } from "@/components/startups/seller-listing-questions";
import { LISTING_KEYS } from "@/lib/seller-wizard";
import { bandInText, bandOf, fmtThb } from "@/lib/asking-price";
import { addressLine, needCls, useFocusNeeded } from "@/components/common/need-fill";
import {
  SELLER_RELATIONS, THB_REVENUE_BANDS, normRevBand, addrComplete, type SellerAddr, WIZARD_ISO, WIZARD_LICENCES, WIZARD_SIZES,
  isValidUrl, normalizeUrl, sellerShown, sellerProgress, type SellerDraft,
  sellerValid, sellerAnswered, STEP_SHORT, STEP_FULL, stepIdx, laterKey, isMissed, joinNames, type StepKey,
} from "@/lib/seller-wizard";

const SECTIONS = ["About you", "About the company", "Financial & business profile", "Intangible assets", "Review", "Company images", "Your listing"];
const STEPS = [
  { id: "role", sec: 0 },
  { id: "name", sec: 1 },
  { id: "web", sec: 1 },
  { id: "year", sec: 1 },
  { id: "rev", sec: 2 },
  { id: "size", sec: 2 },
  { id: "sector", sec: 2 },
  { id: "lic", sec: 3 },
  { id: "photos", sec: 5 },
  { id: "deal", sec: 6 },
  { id: "handover", sec: 6 },
  { id: "price", sec: 6 },
  { id: "review", sec: 4 },
] as const;
const THIS_YEAR = new Date().getFullYear();

const inp =
  "w-full rounded-[10px] border border-[#d1d5db] bg-white px-3.5 py-3 text-[15.5px] text-[#111827] outline-none focus:border-[#1e2a4a] focus:shadow-[0_0_0_3px_#e3e8f2]";
const fieldLbl = "mb-[7px] block text-[13px] font-semibold text-[#374151]";

function Radio({ list, value, onPick, grid }: {
    list: { value: string; label: string; hint?: string }[]; value: string | null; onPick: (v: string) => void; grid?: boolean;
  }): React.ReactElement {
  return (
    <div className={grid ? "grid grid-cols-2 gap-2.5 sm:grid-cols-3" : "grid gap-2"}>
      {list.map((o) => {
        const sel = value === o.value;
        return (
          <button key={o.value} type="button" onClick={() => onPick(o.value)}
            className={`flex items-center gap-3.5 rounded-[10px] border px-4 py-[13px] text-left transition-colors ${grid ? "justify-center" : ""} ${sel ? "border-[#1e2a4a] bg-[#eef1f7]" : "border-[#e5e7eb] bg-white hover:border-[#c5cbd8]"}`}>
            {!grid && (
              <span className={`grid h-[18px] w-[18px] flex-none place-items-center rounded-full border-[1.5px] ${sel ? "border-[#1e2a4a]" : "border-[#c5cbd8]"}`}>
                {sel && <span className="h-2 w-2 rounded-full bg-[#1e2a4a]" />}
              </span>
            )}
            <span>
              <b className="block text-[15px] font-semibold">{tr(o.label)}</b>
              {o.hint && <small className="mt-0.5 block text-[13.5px] text-[#6b7280]">{tr(o.hint)}</small>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Check({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }): React.ReactElement {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-2.5 rounded-[9px] border px-3 py-2.5 text-left text-[13.5px] ${on ? "border-[#1e2a4a] bg-[#eef1f7] text-[#111827]" : "border-[#e5e7eb] bg-white text-[#374151] hover:border-[#c5cbd8]"}`}>
      <span className={`grid h-4 w-4 flex-none place-items-center rounded border-[1.5px] text-[10px] text-white ${on ? "border-[#1e2a4a] bg-[#1e2a4a]" : "border-[#c5cbd8]"}`}>{on ? "✓" : ""}</span>
      {label}
    </button>
  );
}

export function SellerWizard({
  userId, initial, onExit, onCancel, onFinish, fromSignup = [], persist, title = tr("Add my business"), media,
}: {
  /** Upload target for Logo and photos (the business exists). */
  media?: WizardMedia;
  userId: string;
  initial: SellerDraft;
  onExit: () => void;
  onCancel: () => void;
  onFinish: (d: SellerDraft) => void;
  /** Fields sign-up answered (hidden while they hold a value). */
  fromSignup?: string[];
  /** Saves to an existing Draft business instead of this browser. */
  persist?: (d: SellerDraft) => void;
  title?: string;
}) {
  const th = useTranslation().language === "th"; // re-render on language change
  const L = (en: string, t: string) => (th ? t : en);
  const [d, setD] = useState<SellerDraft>(initial);
  const [otherLic, setOtherLic] = useState("");
  const [otherIso, setOtherIso] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  // A question opened from Review shows all its fields, even ones sign-up answered.
  const [full, setFull] = useState<number | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const cardRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const webRef = useRef<HTMLInputElement | null>(null);
  const skipRef = useRef<HTMLButtonElement | null>(null);
  const addWebRef = useRef<HTMLButtonElement | null>(null);
  const fwdRef = useRef<HTMLButtonElement | null>(null);
  const focusTitle = useRef(false);
  const [skipAsk, setSkipAsk] = useState(false);
  const [webAsk, setWebAsk] = useState(false);
  const [revWeb, setRevWeb] = useState("");
  const [revWebErr, setRevWebErr] = useState(false);
  const [webAdded, setWebAdded] = useState(false);
  const [webState, setWebState] = useState<"idle" | "checking" | "unreachable">("idle");
  const checkWeb = useServerFn(checkWebsiteReachable);
  const timer = useRef<number | null>(null);
  const savedTimer = useRef<number | null>(null);
  const firstRun = useRef(true);
  const step = Math.min(d.step, STEPS.length - 1);
  const cur = STEPS[step]!;
  const store = (x: SellerDraft) => persist?.(x);
  const shownOf = (x: SellerDraft, keep: number | null) => {
    const s = new Set(sellerShown(x, fromSignup));
    if (keep != null) s.add(keep);
    return STEPS.map((_, i) => i).filter((i) => i === STEPS.length - 1 || s.has(i));
  };
  const shown = shownOf(d, full ?? step);
  const pos = Math.max(0, shown.indexOf(step));

  // Autosave on every answer.
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    // Nothing is stored until the user answers something (Cancel on step 1 leaves no draft).
    store(d);
    setJustSaved(true);
    if (savedTimer.current) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setJustSaved(false), 1500);
  }, [d, userId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
    if (savedTimer.current) window.clearTimeout(savedTimer.current);
  }, []);
  useEffect(() => setWebState("idle"), [d.web]);
  // Never carry a pending check into another question.
  useEffect(() => { if (cur.id !== "web") setWebState("idle"); }, [cur.id]);


  const set = (patch: Partial<SellerDraft>) => setD((p) => ({ ...p, ...patch }));
  // The address's province answers "where is the company" (the business's City).
  const setAddr = (p: Partial<SellerAddr>) => setD((x) => { const addr = { ...x.addr, ...p }; return { ...x, addr, city: addr.province }; });
  const go = (n: number) => set({ step: Math.max(0, Math.min(STEPS.length - 1, n)) });
  /** Step after `from`: back to Review when opened from it, else the next question that shows. */
  const nextOf = (x: SellerDraft, from: number) => {
    if (full != null) return STEPS.length - 1;
    const list = shownOf(x, null);
    return list.find((i) => i > from) ?? STEPS.length - 1;
  };
  const advance = (patch: Partial<SellerDraft> = {}) => {
    setD((p) => ({ ...p, ...patch, step: nextOf({ ...p, ...patch }, step) }));
    setFull(null);
  };
  const back = () => {
    if (full != null) { setFull(null); go(STEPS.length - 1); return; }
    const list = shownOf(d, null);
    const prev = [...list].reverse().find((i) => i < step);
    if (prev == null) onCancel(); else go(prev);
  };
  const pick = (patch: Partial<SellerDraft>) => {
    set(patch);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => advance(), 250);
  };

  const ok = sellerValid(d);
  const answered = sellerAnswered(d);
  // Review moves on once Company, Revenue and Sector are answered.
  const barNow = shownOf(d, null).map((i) => STEPS[i]!.id as StepKey);
  const blockers = (["name", "rev", "sector", ...LISTING_KEYS.filter((k) => barNow.includes(k))] as StepKey[]).filter((k) => !ok[k]);
  const valid: Record<string, boolean> = { ...ok, review: blockers.length === 0 };
  const canSkip = (cur.id === "web" && !isValidUrl(d.web)) || (cur.id === "lic" && d.licences.length + d.iso.length === 0);

  // The step bar: questions that show, plus Review.
  const bar = shownOf(d, null);
  const barKeys = bar.map((i) => STEPS[i]!.id as StepKey);
  const inBar = bar.includes(step) && !(full != null && !shownOf(d, null).includes(full));
  const reached = d.reached ?? null;
  useEffect(() => {
    if (!inBar) return;
    const nx = laterKey(reached, cur.id);
    if (nx !== reached) setD((p) => ({ ...p, reached: nx }));
  }, [cur.id, inBar]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (focusTitle.current) { focusTitle.current = false; window.setTimeout(() => titleRef.current?.focus(), 30); }
  }, [cur.id]);
  const tipOf = (k: StepKey, st: StepItem["state"]) =>
    st === "here" ? L("You are here", "คุณอยู่ที่ขั้นนี้")
      : k === "review" ? L("Check your answers · click to go there", "ตรวจสอบคำตอบ · กดเพื่อไปที่ขั้นนี้")
      : st === "done" ? L("Answered · click to change", "ตอบแล้ว · กดเพื่อแก้ไข")
      : st === "missed" ? L("Not answered · click to answer", "ยังไม่ได้ตอบ · กดเพื่อตอบ")
      : L("Not reached yet · click to go there", "ยังไม่ถึงขั้นนี้ · กดเพื่อไปที่ขั้นนี้");
  const items: StepItem[] = barKeys.map((k, i) => {
    const state: StepItem["state"] = inBar && bar[i] === step ? "here" : k !== "review" && answered[k] ? "done" : k !== "review" && isMissed(k, d) ? "missed" : "todo";
    return { key: k, label: L(...STEP_SHORT[k]), full: L(...STEP_FULL[k]), state, tip: tipOf(k, state) };
  });
  const farIdx = stepIdx(laterKey(reached, inBar ? cur.id : null));
  const lineTo = Math.max(0, barKeys.filter((k) => stepIdx(k) <= farIdx).length - 1);
  const missed = items.map((it, i) => ({ key: it.key, n: i + 1, full: it.full, st: it.state })).filter((x) => x.st === "missed");
  const openStep = (k: string) => { setFull(null); focusTitle.current = true; go(STEPS.findIndex((x) => x.id === k)); };
  const stepWord = (n: number) => L(`Step ${n}`, `ขั้นที่ ${n}`);

  const privacy = (
    <p className="mt-3 flex items-start gap-2 text-[13px] text-[#434A5C]"><Lock className="mt-0.5 h-[15px] w-[15px] shrink-0" />{L("Buyers can't see your website until you approve their NDA.", "ผู้ซื้อจะไม่เห็นเว็บไซต์ของท่าน จนกว่าท่านจะอนุมัติ NDA ของผู้ซื้อ")}</p>
  );
  function addReviewWeb() {
    if (!isValidUrl(revWeb)) { setRevWebErr(true); return; }
    set({ web: normalizeUrl(revWeb) }); setWebAdded(true);
    window.setTimeout(() => (blockers.length ? document.getElementById("sw-web-added") : fwdRef.current)?.focus(), 40);
  }
  const allLic = [...WIZARD_LICENCES, ...d.licences.filter((l) => !WIZARD_LICENCES.some((w) => w.name === l.name))];
  const allIso = [...WIZARD_ISO, ...d.iso.filter((s) => !WIZARD_ISO.includes(s))];

  const Q: Record<string, { t: string; h?: string; body: React.ReactNode }> = {
    role: { t: tr("Which best describes you?"), h: tr("This determines who approves buyer requests for this listing."),
      body: <Radio list={SELLER_RELATIONS} value={d.role} onPick={(v) => pick({ role: v as SellerDraft["role"] })} /> },
    name: { t: tr("What is your company's name, registration number and business address?"), h: tr("Check that the name matches your company registration."), body: null as unknown as React.ReactNode },
    nameBody: { t: "",
      body: (
        <div className="space-y-4">
          <div><label className={fieldLbl}>{tr("Company name")}</label>
            <input className={`${inp} ${needCls(!d.name.trim())}`} data-need={!d.name.trim() ? "1" : undefined} aria-required value={d.name} maxLength={255} autoFocus onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Siam Foods Co., Ltd." /></div>
          <div><label className={fieldLbl}>{tr("Company Registration Number (เลขทะเบียนนิติบุคคล)")}</label>
            <input className={`${inp} ${needCls(!/^\d{13}$/.test(d.reg))}`} data-need={!/^\d{13}$/.test(d.reg) ? "1" : undefined} aria-required inputMode="numeric" value={d.reg} maxLength={13}
              onChange={(e) => set({ reg: e.target.value.replace(/\D/g, "").slice(0, 13) })} placeholder="13 digits" />
            <p className="mt-1.5 text-[13px] text-[#6b7280]">Used to verify your company.{d.reg && d.reg.length !== 13 ? ` ${d.reg.length}/13 digits.` : ""}</p></div>
          <div className="pt-2">
            <AddressBox a={d.addr} thai city={d.addr.district} onChange={setAddr} need stars={false}
              show={(k) => (touched[k] ? ({ street: !d.addr.street.trim() ? "Add the number and street." : null, district: !d.addr.district.trim() ? "Add the city or district." : null, province: !d.addr.province ? "Choose the province or state." : null, postal: !d.addr.postal ? "Add the postal code." : /^\d{5}$/.test(d.addr.postal) ? null : tr("The postal code has 5 digits."), unit: null } as Record<string, string | null>)[k] ?? null : null)}
              onBlur={(k) => setTouched((t) => ({ ...t, [k]: true }))}
              note={tr("Buyers see your country and province, never the full address, until you approve their NDA.")} />
          </div>
          <p className="flex items-start gap-2 text-[13px] text-destructive"><Lock className="mt-0.5 h-3.5 w-3.5" />{tr("Your company identity stays confidential until you approve the buyer's NDA.")}</p>
        </div>
      ) },
    web: { t: L("What is your company website?", "เว็บไซต์ของบริษัทคืออะไร"), h: L("Optional, but auto-fill needs it.", "ไม่บังคับ แต่การกรอกข้อมูลอัตโนมัติต้องใช้เว็บไซต์นี้"),
      body: (
        <div>
          <label htmlFor="sw-web" className={fieldLbl}>{L("Company website", "เว็บไซต์บริษัท")}</label>
          <div className="seller-web-field flex gap-2">
            <input id="sw-web" ref={webRef} className={inp} value={d.web} autoFocus maxLength={2048} onChange={(e) => set({ web: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter" && ok.web) { e.preventDefault(); fwdRef.current?.click(); } }}
              onBlur={() => set({ web: d.web.trim() })} placeholder="www.yourcompany.com" />
            <WebsiteCheckLink valid={isValidUrl(d.web)} url={normalizeUrl(d.web)} label={L("Check website", "ตรวจสอบเว็บไซต์")}
              hint={L("Checks whether the website link you entered opens correctly.", "ใช้เพื่อตรวจสอบว่าลิงก์เว็บไซต์ที่กรอกถูกต้องและเปิดใช้งานได้")} />
          </div>
          {d.web.trim() && !valid.web ? (
            <p className="mt-1.5 text-[13px] text-destructive">{tr("Enter a valid website address, e.g. www.yourcompany.com")}</p>
          ) : ok.web ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-[#15803D]"><CheckIcon className="h-3.5 w-3.5" />{L("Website found. Auto-fill will read it after Review.", "พบเว็บไซต์แล้ว ระบบจะอ่านข้อมูลหลังขั้นตรวจสอบ")}</p>
          ) : null}
          <div className="mt-[22px] rounded-[12px] border border-[#D6E7FC] bg-[#F4F9FF] px-[18px] py-4">
            <p className="flex items-center gap-2 text-[14.5px] font-bold text-[#151A28]"><Sparkles className="h-[18px] w-[18px] text-[#2563EB]" />{L("Auto-fill reads your website", "ระบบกรอกข้อมูลอัตโนมัติจะอ่านเว็บไซต์ของท่าน")}</p>
            <ul className="mt-2.5 space-y-1.5">
              {[L("Suggests your company description and corporate information", "แนะนำคำอธิบายบริษัทและข้อมูลบริษัทให้"), L("Takes a few seconds, and you can change anything later", "ใช้เวลาไม่กี่วินาที และท่านแก้ไขได้ทุกอย่างภายหลัง")].map((x) => (
                <li key={x} className="flex items-start gap-2 text-[14px] text-[#434A5C]"><CheckIcon className="mt-[3px] h-3.5 w-3.5 shrink-0 text-[#2563EB]" />{x}</li>
              ))}
            </ul>
            {privacy}
          </div>
          {webState === "unreachable" && (
            <div className="mt-4 rounded-[10px] border border-[#fcd34d] bg-[#fffbeb] p-3.5">
              <p className="flex items-start gap-2 text-[13.5px] font-medium text-[#92400e]">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />We couldn't reach this website. Please check the address.
              </p>
              <div className="mt-3 flex gap-2">
                <button type="button" className="rounded-[9px] border border-[#e5e7eb] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#374151]"
                  onClick={() => { setWebState("idle"); webRef.current?.focus(); }}>{tr("Edit address")}</button>
                <button type="button" className="rounded-[9px] bg-[#1e2a4a] px-3.5 py-2 text-[13px] font-semibold text-white"
                  onClick={() => advance({ web: normalizeUrl(d.web) })}>{tr("Continue anyway")}</button>
              </div>
            </div>
          )}
        </div>
      ) },
    year: { t: tr("What year was the company founded?"),
      body: <div><input className={`${inp} max-w-[200px]`} inputMode="numeric" value={d.year} maxLength={4} autoFocus
        onChange={(e) => set({ year: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder={`e.g. ${THIS_YEAR - 10}`} />
        {d.year.length === 4 && !valid.year && <p className="mt-1.5 text-[13px] text-destructive">Enter a year between 1800 and {THIS_YEAR}.</p>}</div> },
    rev: { t: tr("What was your company's revenue last year?"), h: tr("An approximate band is enough. Exact figures stay private."),
      body: <Radio list={THB_REVENUE_BANDS.map((b) => ({ value: b, label: b }))} value={normRevBand(d.rev)} onPick={(v) => pick({ rev: v })} /> },
    size: { t: tr("What is the size of your company?"), h: tr("Number of employees."),
      body: <Radio grid list={WIZARD_SIZES} value={d.size} onPick={(v) => pick({ size: v })} /> },
    sector: { t: tr("What does your business do?"), h: tr("Pick the closest match. We'll put you in the right sector for buyers."),
      body: <SellerTypeQuestion pick={(d.pick ?? null) as SectorPick | null} sector={d.sector} onChange={(p, s) => set({ pick: p, sector: s })} /> },
    lic: { t: tr("Licences and certifications"), h: tr("Select any that apply. This is optional."),
      body: (
        <div className="space-y-6">
          <div><h4 className="text-[14.5px] font-semibold">{tr("Regulatory licences")}</h4>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {allLic.map((l) => {
                const on = d.licences.some((x) => x.name === l.name);
                return <Check key={l.name} on={on} label={l.name}
                  onClick={() => set({ licences: on ? d.licences.filter((x) => x.name !== l.name) : [...d.licences, l] })} />;
              })}
            </div>
            <div className="mt-2 flex gap-2">
              <input className="flex-1 rounded-[9px] border border-[#e5e7eb] px-3 py-2 text-[13.5px] outline-none" maxLength={120} placeholder={tr("Other licence")} value={otherLic} onChange={(e) => setOtherLic(e.target.value)} />
              <button type="button" className="rounded-[9px] border border-[#e5e7eb] bg-white px-3.5 text-[13px] font-semibold text-[#374151]"
                onClick={() => { const n = otherLic.trim(); if (n && !d.licences.some((x) => x.name.toLowerCase() === n.toLowerCase())) set({ licences: [...d.licences, { category: "Business", name: n }] }); setOtherLic(""); }}>Add</button>
            </div></div>
          <div><h4 className="text-[14.5px] font-semibold">{tr("ISO and standards")}</h4>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {allIso.map((s) => {
                const on = d.iso.includes(s);
                return <Check key={s} on={on} label={s} onClick={() => set({ iso: on ? d.iso.filter((x) => x !== s) : [...d.iso, s] })} />;
              })}
            </div>
            <div className="mt-2 flex gap-2">
              <input className="flex-1 rounded-[9px] border border-[#e5e7eb] px-3 py-2 text-[13.5px] outline-none" maxLength={60} placeholder={tr("Other standard")} value={otherIso} onChange={(e) => setOtherIso(e.target.value)} />
              <button type="button" className="rounded-[9px] border border-[#e5e7eb] bg-white px-3.5 text-[13px] font-semibold text-[#374151]"
                onClick={() => { const n = otherIso.trim(); if (n && !d.iso.includes(n)) set({ iso: [...d.iso, n] }); setOtherIso(""); }}>Add</button>
            </div></div>
        </div>
      ) },
    photos: { t: L("Add your logo and photos", "เพิ่มโลโก้และรูปภาพ"), h: L("Add your logo and at least 1 photo (up to 3) of the premises, the team or the products. Buyers see them like this after you approve their NDA.", "เพิ่มโลโก้และรูปภาพอย่างน้อย 1 รูป (สูงสุด 3 รูป) ของสถานที่ ทีมงาน หรือสินค้า ผู้ซื้อจะเห็นแบบนี้หลังจากท่านอนุมัติ NDA"),
      body: media ? <PhotosQ media={media} d={d} set={set} L={L} sectorLine={[d.sector, d.addr.province].filter(Boolean).join(" · ")} /> : null },
    deal: { t: L("What kind of deal are you looking for?", "ท่านต้องการดีลแบบใด"), h: L("Buyers see this on your listing.", "ผู้ซื้อจะเห็นข้อมูลนี้ในประกาศของท่าน"),
      body: <DealQ d={d} pick={pick} L={L} /> },
    handover: { t: L("Will the owner stay on after the sale to hand over the business?", "เจ้าของจะอยู่ช่วยส่งมอบกิจการหลังการขายหรือไม่"), h: L("Buyers see your answer on your listing.", "ผู้ซื้อจะเห็นคำตอบนี้ในประกาศของท่าน"),
      body: <HandoverQ d={d} set={set} L={L} /> },
    price: { t: L("What is your estimated asking price?", "ราคาที่ท่านต้องการโดยประมาณคือเท่าใด"), h: L("An estimate is fine. You can change it later.", "ประมาณการได้ ท่านเปลี่ยนได้ภายหลัง"),
      body: <PriceQ d={d} set={set} L={L} th={th} /> },
    review: { t: tr("Review your answers"), h: tr("Next, we'll auto-fill the rest of your profile. You can edit everything afterwards."),
      body: (
        <div>
        <h3 className="mb-2 text-[14px] font-bold text-[#151A28]">{L("Your company", "บริษัทของท่าน")}</h3>
        <div className="overflow-hidden rounded-[10px] border border-[#e5e7eb]">
          {([
            [tr("You are"), SELLER_RELATIONS.find((r) => r.value === d.role)?.label, 0],
            [tr("Company name"), d.name, 1],
            [tr("Registration no."), d.reg, 1],
            [tr("Business address"), addressLine(d.addr), 1],
            [L("Company website", "เว็บไซต์บริษัท"), isValidUrl(d.web) ? <a href={normalizeUrl(d.web)} target="_blank" rel="noopener noreferrer" className="text-[#1e2a4a] underline underline-offset-2">{d.web} ↗</a> : L("No company website", "ไม่มีเว็บไซต์บริษัท"), 2],
            [tr("Year founded"), d.year, 3],
            [tr("Revenue last year"), d.rev ? tr(normRevBand(d.rev)) : d.rev, 4],
            [tr("Company size"), WIZARD_SIZES.find((s) => s.value === d.size)?.label, 5],
            [tr("Sector"), d.sector, 6],
            [tr("Licences & standards"), [...d.licences.map((l) => l.name), ...d.iso].join(", ") || L("None", "ไม่มี"), 7],
          ] as [string, React.ReactNode, number][]).map(([k, v, n], ri) => {
            const key = STEPS[n]!.id as StepKey;
            const rowOk = [!!d.role, !!d.name.trim(), /^\d{13}$/.test(d.reg), addrComplete(d.addr), ok.web, ok.year, ok.rev, ok.size, ok.sector, ok.lic][ri];
            const red = key !== "web" && key !== "lic" && !rowOk && barKeys.includes(key);
            return (
              <div key={k} className={`flex gap-3 border-b border-[#f0f1f3] px-4 py-3 text-sm last:border-0 ${red ? "bg-[#FEF2F2]" : ""}`}>
                <span className="w-[170px] flex-none text-[#6b7280] max-[599px]:w-[110px]">{k}</span>
                {red ? (
                  <b className="flex flex-1 items-center gap-2 font-semibold text-[#B91C1C]"><span className="h-2 w-2 rounded-full bg-[#DC2626]" />{L("Not answered", "ยังไม่ได้ตอบ")}</b>
                ) : (
                  <b className={`min-w-0 flex-1 break-words font-semibold ${v ? "" : "font-normal text-[#9ca3af]"}`}>{v || tr("Not provided")}</b>
                )}
                <button type="button" className={`text-[13px] underline underline-offset-2 ${red ? "font-bold text-[#B91C1C]" : "font-semibold text-[#1e2a4a]"}`}
                  onClick={() => { setFull(n); focusTitle.current = true; go(n); }}>{red ? L("Answer", "ตอบคำถาม") : tr("Edit")}</button>
              </div>
            );
          })}
        </div>
        <h3 className="mb-2 mt-[22px] text-[14px] font-bold text-[#151A28]">{L("Your listing", "ประกาศของท่าน")}</h3>
        <div className="overflow-hidden rounded-[10px] border border-[#e5e7eb]">
          {LISTING_KEYS.filter((k) => barKeys.includes(k)).map((k) => {
            const n = STEPS.findIndex((x) => x.id === k);
            const band = bandOf(d.price ?? null);
            const v: React.ReactNode = k === "photos" ? L(`Logo and ${d.photos ?? 0} photo${(d.photos ?? 0) === 1 ? "" : "s"}`, `โลโก้และรูปภาพ ${d.photos ?? 0} รูป`)
              : k === "deal" ? (d.deal ? L(d.deal, d.deal) : "")
              : k === "handover" ? (d.stays === "yes" ? L(`Yes, for ${d.months ?? 6} month${(d.months ?? 6) === 1 ? "" : "s"} after the sale`, `ใช่ อยู่ต่อ ${d.months ?? 6} เดือนหลังการขาย`) : d.stays === "no" ? L("No, the owner leaves at completion", "ไม่ เจ้าของออกเมื่อการขายเสร็จสิ้น") : "")
              : k === "price" ? (d.price ? <span>{fmtThb(d.price)}<span className="mt-px block text-[12.5px] font-normal text-[#6B7280]">{L(`Buyers see ${bandInText(band?.label ?? "")} until you approve their NDA`, `ผู้ซื้อจะเห็น ${band?.th ?? ""} จนกว่าท่านจะอนุมัติ NDA`)}</span></span> : "")
              : d.listingName ?? "";
            const red = !ok[k];
            return (
              <div key={k} className={`flex gap-3 border-b border-[#f0f1f3] px-4 py-3 text-sm last:border-0 ${red ? "bg-[#FEF2F2]" : ""}`}>
                <span className="w-[170px] flex-none text-[#6b7280] max-[599px]:w-[110px]">{L(...STEP_FULL[k])}</span>
                {red ? (
                  <b className="flex flex-1 items-center gap-2 font-semibold text-[#B91C1C]"><span className="h-2 w-2 rounded-full bg-[#DC2626]" />{L("Not answered", "ยังไม่ได้ตอบ")}</b>
                ) : <b className="min-w-0 flex-1 break-words font-semibold">{v}</b>}
                <button type="button" className={`text-[13px] underline underline-offset-2 ${red ? "font-bold text-[#B91C1C]" : "font-semibold text-[#1e2a4a]"}`}
                  onClick={() => { setFull(n); focusTitle.current = true; go(n); }}>{red ? L("Answer", "ตอบคำถาม") : tr("Edit")}</button>
              </div>
            );
          })}
        </div>
        {barKeys.includes("web") && (!ok.web || webAdded) && (
          webAdded && ok.web ? (
            <p tabIndex={-1} id="sw-web-added" className="mt-[18px] flex items-center gap-1.5 text-[13.5px] font-semibold text-[#15803D] outline-none">
              <CheckIcon className="h-4 w-4" />{L(`Website added. Auto-fill will read ${d.web.replace(/^https?:\/\//i, "").replace(/\/$/, "")}.`, `เพิ่มเว็บไซต์แล้ว ระบบจะอ่านข้อมูลจาก ${d.web.replace(/^https?:\/\//i, "").replace(/\/$/, "")}`)}
            </p>
          ) : (
            <div className="mt-[18px] rounded-[12px] border border-[#D6E7FC] bg-[#F4F9FF] px-[18px] py-4">
              <p className="flex items-center gap-2 text-[14.5px] font-bold text-[#151A28]"><Sparkles className="h-[18px] w-[18px] text-[#2563EB]" />{L("Add your website to use auto-fill", "เพิ่มเว็บไซต์เพื่อใช้การกรอกข้อมูลอัตโนมัติ")}</p>
              <p className="mt-1.5 text-[13.5px] text-[#434A5C]">{L("Auto-fill reads your website to suggest your company description and corporate information. Without it, you'll fill them in yourself.", "ระบบจะอ่านเว็บไซต์ของท่านเพื่อแนะนำคำอธิบายบริษัทและข้อมูลบริษัท หากไม่มีเว็บไซต์ ท่านจะต้องกรอกเอง")}</p>
              <div className="mt-3 flex gap-2.5 max-[599px]:flex-col">
                <input aria-label={L("Company website", "เว็บไซต์บริษัท")} value={revWeb} maxLength={2048} placeholder="www.yourcompany.com"
                  onChange={(e) => { setRevWeb(e.target.value); setRevWebErr(false); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addReviewWeb(); } }}
                  className={`h-11 min-w-0 flex-1 rounded-[10px] border bg-white px-3 text-[15px] outline-none ${revWebErr ? "border-[#B42318]" : "border-[#DCDFE5] focus:border-[#1e2a4a]"}`} />
                <button type="button" onClick={addReviewWeb} className="h-11 rounded-[10px] bg-[#1e2a4a] px-4 text-[14.5px] font-semibold text-white">{L("Add website", "เพิ่มเว็บไซต์")}</button>
              </div>
              {revWebErr && <p className="mt-1.5 text-[13px] text-[#B42318]">{tr("Enter a valid website address, e.g. www.yourcompany.com")}</p>}
              {privacy}
            </div>
          )
        )}
        {blockers.length > 0 && (
          <p className="mt-[18px] text-[13.5px] text-[#B91C1C]">{L(`Answer ${joinNames(blockers.map((k) => (LISTING_KEYS as readonly string[]).includes(k) ? STEP_FULL[k][0] : STEP_SHORT[k][0]), false)} before you continue.`, `กรุณาตอบ ${joinNames(blockers.map((k) => (LISTING_KEYS as readonly string[]).includes(k) ? STEP_FULL[k][1] : STEP_SHORT[k][1]), true)} ก่อนไปต่อ`)}</p>
        )}
        </div>
      ) },
  };
  useFocusNeeded(cardRef, `${cur.id}:${full ?? ""}`);
  const q = cur.id === "name" ? { ...Q.name!, body: Q.nameBody!.body } : Q[cur.id]!;

  return (
    <div className="wiz -m-4 min-h-[calc(100vh-54px)] bg-[#f5f6f8] text-[15px] text-[#111827] md:-m-6" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <div className="flex h-14 items-center gap-3 border-b border-[#e5e7eb] bg-white px-6">
        <span className="text-[14px] font-semibold">{title}</span>
        <span className="ml-auto text-[13px] text-[#9ca3af]">{justSaved ? "Saved just now" : tr("All changes saved")}</span>
      </div>
      <div className="mx-auto max-w-[680px] px-5 pb-16 pt-10">
        <div className="mb-2.5 flex items-baseline justify-between text-[13px] text-[#6b7280]">
          <b className="font-semibold text-[#111827]">{tr(SECTIONS[cur.sec])}</b>
          <span>Step {pos + 1} of {shown.length}</span>
        </div>
        <div className="mb-6 mt-5">
          <StepBar missedIcon steps={items} lineTo={lineTo} onPick={openStep} label={L("Setup steps", "ขั้นตอนการตั้งค่า")} stepWord={stepWord} missedWord={L("Not answered", "ยังไม่ได้ตอบ")} />
          <MissedNote missed={missed} onPick={openStep} answerNow={L("Answer now", "ตอบเลย")}
            desktop={th ? `มี ${missed.length} คำถามที่ยังไม่ได้ตอบ กดวงกลมสีแดงเพื่อตอบ` : missed.length === 1 ? "1 question not answered. Click the red step to answer it." : `${missed.length} questions not answered. Click a red step to answer it.`}
            row={(n, f) => L(`Step ${n} · ${f} isn't answered yet`, `ขั้นที่ ${n} · ${f} ยังไม่ได้ตอบ`)} />
        </div>
        <div className="rounded-[14px] border border-[#e5e7eb] bg-white px-6 pb-7 pt-8 sm:px-9 sm:pt-9">
          <div key={cur.id} ref={cardRef} className="animate-in fade-in slide-in-from-bottom-1 duration-200">
            <h2 ref={titleRef} tabIndex={-1} className="mb-1.5 outline-none text-2xl font-bold leading-snug tracking-[-0.015em]">{tr(q.t)}{cur.id !== "web" && cur.id !== "lic" && <span aria-hidden className="ml-1 text-destructive">*</span>}</h2>
            {q.h && <p className="mb-6 text-[14.5px] leading-relaxed text-[#6b7280]">{tr(q.h)}</p>}
            {!q.h && <div className="mb-6" />}
            {q.body}
          </div>
          <div className={cur.id === "web" ? `seller-website-actions ${canSkip ? "has-no-website" : ""}` : "mt-8 flex items-center gap-2.5"}>
            <Button variant="unstyled" size="unstyled" type="button" onClick={back}
              className={cur.id === "web" ? "seller-action seller-action-back" : "rounded-[10px] border border-[#e5e7eb] bg-white px-[18px] py-[11px] font-semibold text-[#374151]"}>{pos === 0 && full == null ? "ยกเลิก" : tr("Back")}</Button>
            {canSkip && cur.id !== "web" && (
              <button type="button" className="rounded-[10px] border border-[#e5e7eb] bg-white px-[18px] py-[11px] font-semibold text-[#374151]"
                ref={skipRef} onClick={() => { if (cur.id === "web") setSkipAsk(true); else advance(); }}>{tr("Skip")}</button>
            )}
            {cur.id === "web" && <>
              <span className="seller-actions-spacer" />
              {canSkip && <Button variant="unstyled" size="unstyled" className="seller-action seller-action-no-website" ref={skipRef} onClick={() => setSkipAsk(true)}>{L("No company website", "ไม่มีเว็บไซต์บริษัท")}</Button>}
            </>}
            <div className={cur.id === "web" ? "contents" : "ml-auto flex items-center gap-2.5"}>
              {pos > 0 && (
                <Button variant="unstyled" size="unstyled" type="button" onClick={() => setConfirmExit(true)}
                  className={cur.id === "web" ? "seller-action" : "rounded-[10px] border border-[#e5e7eb] bg-white px-[18px] py-[11px] font-semibold text-[#374151]"}>{tr("Save & exit")}</Button>
              )}
              <Button variant="unstyled" size="unstyled" type="button" ref={fwdRef} disabled={!valid[cur.id] || (cur.id === "web" && webState === "checking")}
                onClick={async () => {
                  if (cur.id === "review") {
                    // A valid website typed in Review's box is saved first; an invalid one shows its error.
                    if (revWeb.trim() && !ok.web) { if (!isValidUrl(revWeb)) { setRevWebErr(true); return; } set({ web: normalizeUrl(revWeb) }); setWebAdded(true); }
                    setWebAsk(true); return;
                  }
                  if (cur.id === "web") {
                    const url = normalizeUrl(d.web);
                    setWebState("checking");
                    let ok = false;
                    try { ok = (await checkWeb({ data: { url } })).ok; } catch { ok = false; }
                    if (!ok) { setWebState("unreachable"); return; }
                    setWebState("idle");
                    advance({ web: url });
                    return;
                  }
                  advance();
                }}
                className={cur.id === "web" ? "seller-action seller-action-primary" : "rounded-[10px] bg-[#1e2a4a] px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#c9ced9]"}>
                {cur.id === "review" ? tr("Continue to auto-fill") : cur.id === "web" && webState === "checking" ? "Checking…" : full != null ? tr("Back to review") : tr("Continue")}

              </Button>
            </div>
          </div>
        </div>
        {webAsk && (
          <ConfirmWebsiteDialog L={L} initial={revWeb.trim() && !ok.web && isValidUrl(revWeb) ? normalizeUrl(revWeb) : ok.web ? d.web : ""}
            onCancel={() => { setWebAsk(false); fwdRef.current?.focus(); }}
            onDone={(url) => { setWebAsk(false); const nd = { ...d, web: url || d.web }; if (url) set({ web: url }); onFinish(nd); }} />
        )}
        {skipAsk && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(17,24,39,.45)] p-4" onClick={() => { setSkipAsk(false); skipRef.current?.focus(); }}>
            <div role="dialog" aria-modal="true" aria-labelledby="sw-skip-t" aria-describedby="sw-skip-d"
              className="w-full max-w-[440px] rounded-[16px] bg-white p-6 shadow-xl dark:bg-card" onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Escape") { e.stopPropagation(); setSkipAsk(false); skipRef.current?.focus(); }
                if (e.key === "Tab") { const b = Array.from(e.currentTarget.querySelectorAll("button")); const i = b.indexOf(document.activeElement as HTMLButtonElement); e.preventDefault(); b[(i + (e.shiftKey ? b.length - 1 : 1)) % b.length]?.focus(); }
              }}>
              <span className="grid h-11 w-11 place-items-center rounded-[12px] bg-[#F4F9FF] dark:bg-[#16283A]"><Globe className="h-[22px] w-[22px] text-[#2563EB] dark:text-[#8CBFF0]" /></span>
              <h3 id="sw-skip-t" className="mt-3.5 text-[20px] font-bold" style={{ fontFamily: '"Space Grotesk", "DM Sans", sans-serif' }}>{L("Skip your website?", "ข้ามเว็บไซต์ใช่ไหม")}</h3>
              <p id="sw-skip-d" className="mt-2 text-[14.5px] leading-[1.55] text-[#434A5C] dark:text-muted-foreground">{L("Without your website, auto-fill can't suggest your company description or corporate information. You'll fill them in yourself after Review.", "หากไม่มีเว็บไซต์ ระบบกรอกข้อมูลอัตโนมัติจะแนะนำคำอธิบายบริษัทและข้อมูลบริษัทให้ไม่ได้ ท่านจะต้องกรอกเองหลังขั้นตรวจสอบ")}</p>
              {privacy}
              <div className="mt-[22px] flex justify-end gap-2.5 max-[599px]:flex-col-reverse">
                <button type="button" onClick={() => { setSkipAsk(false); advance({ web: "" }); }}
                  className="h-11 rounded-[10px] border border-[#DCDFE5] bg-white px-4 font-semibold text-[#374151] dark:border-border dark:bg-transparent dark:text-foreground">{L("Skip for now", "ข้ามไปก่อน")}</button>
                <button type="button" ref={addWebRef} autoFocus onClick={() => { setSkipAsk(false); window.setTimeout(() => webRef.current?.focus(), 20); }}
                  className="h-11 rounded-[10px] bg-[#1e2a4a] px-4 font-semibold text-white">{L("Add my website", "เพิ่มเว็บไซต์")}</button>
              </div>
            </div>
          </div>
        )}
        {confirmExit && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(17,24,39,.45)] p-4" onClick={() => setConfirmExit(false)}>
            <div role="dialog" aria-modal="true" className="w-full max-w-[400px] rounded-[14px] bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold">{tr("Save and finish later?")}</h3>
              <p className="mt-1 text-[14px] text-[#6b7280]">{tr("Your answers are saved. You can continue setup from My Business.")}</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#e5e7eb]">
                <i className="block h-full bg-[#1e2a4a]" style={{ width: `${Math.round((sellerProgress(d, fromSignup).n / sellerProgress(d, fromSignup).N) * 100)}%` }} />
              </div>
              <p className="mt-2 text-[13px] text-[#6b7280]">{sellerProgress(d, fromSignup).n} of {sellerProgress(d, fromSignup).N} questions answered</p>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setConfirmExit(false)} className="rounded-[10px] border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-semibold text-[#374151]">{tr("Keep going")}</button>
                <button type="button" onClick={() => { store(d); onExit(); }} className="rounded-[10px] bg-[#1e2a4a] px-4 py-2.5 text-sm font-semibold text-white">{tr("Save & exit")}</button>
              </div>
            </div>
          </div>
        )}
        <p className="mt-[18px] text-center text-[12.5px] text-[#9ca3af]">{L("Your company name, website, logo, photos and exact figures stay private until you approve a buyer's NDA.", "ชื่อบริษัท เว็บไซต์ โลโก้ รูปภาพ และตัวเลขที่แท้จริงของท่านจะถูกเก็บเป็นความลับ จนกว่าท่านจะอนุมัติ NDA ของผู้ซื้อ")}</p>
      </div>
    </div>
  );
}
