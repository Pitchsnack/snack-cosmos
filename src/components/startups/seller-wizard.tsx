import { setupText } from "@/i18n/language";
import { tr, useTranslation } from "@/i18n/language";
import { useEffect, useRef, useState } from "react";
import { Lock, Check as CheckIcon, Sparkles, Loader2, Calendar, Users } from "lucide-react";
import { StepBar, MissedNote, type StepItem } from "@/components/common/step-bar";
import { Button } from "@/components/ui/button";
import { WebsiteCheckLink } from "@/components/startups/website-check-link";
import { SellerWebsiteFields, websiteMissing, type WebsiteField, type ReadingState } from "./seller-website-fields";
import { strengthCount } from '@/lib/seller-strengths';
import { FounderEditor, PositionMultiSelect } from "./founder-editor";
import { ContinueBlockedLine, continueBlockedLine } from "@/components/setup/continue-blocked";
import { FilledFrom } from "@/components/setup/filled-from";
import { useWebsiteEnrichment } from "@/components/setup/use-website-enrichment";
import { ContactPersonFields } from "@/components/setup/contact-person-fields";
import { SectionBand, SectionHeading } from "@/components/setup/section-band";
import { founderRevenueLabel } from "@/lib/founder-story";
import { mergeWebsiteEnrich } from "@/lib/seller-website-enrich";
import { SellerTypeQuestion } from "@/components/common/business-type-question";
import type { SectorPick } from "@/lib/business-types";
import { AddressBox } from "@/components/advisor/advisor-firm-fields";
import { DealQ, HandoverQ, PhotosQ, PriceQ, type WizardMedia } from "@/components/startups/seller-listing-questions";
import { LISTING_KEYS, validFoundedYear, fallbackSellerFounder } from "@/lib/seller-wizard";
import { bandInText, bandOf, fmtThb } from "@/lib/asking-price";
import { addressLine, needCls, useFocusNeeded } from "@/components/common/need-fill";
import {
  SELLER_RELATIONS, THB_REVENUE_BANDS, normRevBand, addrComplete, type SellerAddr, WIZARD_ISO, WIZARD_LICENCES, WIZARD_SIZES,
  isValidUrl, normalizeUrl, sellerShown, sellerProgress, type SellerDraft, SELLER_STEPS, foundedYearError, normalizeSellerStep,
  sellerValid, sellerAnswered, STEP_SHORT, STEP_FULL, stepIdx, laterKey, isMissed, joinNames, type StepKey,
} from "@/lib/seller-wizard";

const STEPS = [...SELLER_STEPS, { id: "review", sec: "Review" }] as const;

const inp = "w-full rounded-[10px] border border-input bg-card px-3.5 py-3 text-[15.5px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";
const fieldLbl = "mb-[7px] block text-[13px] font-semibold text-foreground";

function Radio({ list, value, onPick, grid }: {
    list: { value: string; label: string; hint?: string }[]; value: string | null; onPick: (v: string) => void; grid?: boolean;
  }): React.ReactElement {
  return (
    <div className={grid ? "grid grid-cols-2 gap-2.5 sm:grid-cols-3" : "grid gap-2"}>
      {list.map((o) => {
        const sel = value === o.value;
        return (
          <button key={o.value} type="button" onClick={() => onPick(o.value)}
            className={`flex items-center gap-3.5 rounded-[10px] border px-4 py-[13px] text-left transition-colors ${grid ? "justify-center" : ""} ${sel ? "border-primary bg-secondary" : "border-border bg-card hover:border-input"}`}>
            {!grid && (
              <span className={`grid h-[18px] w-[18px] flex-none place-items-center rounded-full border-[1.5px] ${sel ? "border-primary" : "border-input"}`}>
                {sel && <span className="h-2 w-2 rounded-full bg-primary" />}
              </span>
            )}
            <span>
              <b className="block text-[15px] font-semibold">{tr(o.label)}</b>
              {o.hint && <small className="mt-0.5 block text-[13.5px] text-muted-foreground">{tr(o.hint)}</small>}
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
      className={`flex items-center gap-2.5 rounded-[9px] border px-3 py-2.5 text-left text-[13.5px] ${on ? "border-primary bg-secondary text-foreground" : "border-border bg-card text-foreground hover:border-input"}`}>
      <span className={`grid h-4 w-4 flex-none place-items-center rounded border-[1.5px] text-[10px] text-primary-foreground ${on ? "border-primary bg-primary" : "border-input"}`}>{on ? "✓" : ""}</span>
      {label}
    </button>
  );
}

export function SellerWizard({
  userId, initial, onExit, onCancel, onFinish, fromSignup = [], persist, title = tr("Add my business"), media, owner,
}: {
  /** Upload target for Logo and photos (the business exists). */
  media?: WizardMedia;
  owner?: { fullName: string; position: string };
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
  const [d, setD] = useState<SellerDraft>(() => ({...initial, reached: normalizeSellerStep(initial.reached), founders: initial.founders?.length ? initial.founders : [fallbackSellerFounder(initial.role, owner?.fullName ?? "")]}));
  /** Step 1's wording in the current language; the stored answer is always the key. */
  const roleLabel = () => { const r = SELLER_RELATIONS.find((x) => x.value === d.role); return r ? L(...r.label) : ""; };
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
  const fwdRef = useRef<HTMLButtonElement | null>(null);
  const focusTitle = useRef(false);
  // The website from sign-up opens the full page at once (descriptions, tags, highlights).
  const [webExpanded, setWebExpanded] = useState(() => (fromSignup.includes("web") && isValidUrl(initial.web)) || !!(initial.shortDescription?.trim() || initial.longDescription?.trim() || initial.shortDescriptionTh?.trim()));
  const enrichment = useWebsiteEnrichment("seller", media?.startupId ?? "", d.web, fromSignup.includes("web") && isValidUrl(d.web));
  const reading = enrichment.state.status === "running" && isValidUrl(d.web);
  const readDone = enrichment.state.status === "done";
  const readDomain = enrichment.state.domain;
  const readingStates: ReadingState[] = Array.from({ length: 5 }, () => readDone ? "found" : "reading");
  const [marks, setMarks] = useState<Partial<Record<WebsiteField, boolean>>>({});
  const timer = useRef<number | null>(null);
  const savedTimer = useRef<number | null>(null);
  const firstRun = useRef(true);
  const step = Math.min(d.step, STEPS.length - 1);
  const cur = STEPS[step] ?? STEPS[0];
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
  const set = (patch: Partial<SellerDraft>) => setD((p) => ({ ...p, ...patch }));
  // The address's province answers "where is the company" (the business's City).
  const setAddr = (p: Partial<SellerAddr>) => setD((x) => { const addr = { ...x.addr, ...p }; return { ...x, addr, city: addr.province }; });
  const go = (n: number) => {
    if (STEPS[n]?.id === "web") setWebExpanded(isValidUrl(d.web) || !!(d.shortDescription?.trim() || d.longDescription?.trim()));
    set({ step: Math.max(0, Math.min(STEPS.length - 1, n)) });
  };
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
    if (cur.id === "web" && webExpanded) { if (!reading) setWebExpanded(false); return; }
    if (full != null) { setFull(null); go(STEPS.length - 1); return; }
    const list = shownOf(d, null);
    const prev = [...list].reverse().find((i) => i < step);
    if (prev == null) onCancel(); else { go(prev); if(STEPS[prev]?.id === "web") setWebExpanded(true); }
  };
  const pick = (patch: Partial<SellerDraft>) => {
    set(patch);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => advance(), 250);
  };

  const ok = sellerValid(d);
  const answered = sellerAnswered(d);
  // Review moves on once Company, Revenue and Sector are answered.
  const barNow = shownOf(d, full ?? step).map((i) => STEPS[i]?.id as StepKey);
  const blockers = barNow.filter(k => k !== "review" && k !== "lic" && !ok[k]);
  const valid: Record<string, boolean> = { ...ok, review: blockers.length === 0 };
  const canSkip = cur.id === "lic" && d.licences.length + d.iso.length === 0;

  // The step bar: questions that show, plus Review.
  const bar = shownOf(d, full ?? step);
  const barKeys = bar.map((i) => STEPS[i]?.id as StepKey);
  const inBar = bar.includes(step);
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
    st === "here" ? L("You are here", "ท่านอยู่ที่ขั้นนี้")
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
    <p className="mt-3 flex items-start gap-2 text-[13px] text-muted-foreground"><Lock className="mt-0.5 h-[15px] w-[15px] shrink-0" />{L("Buyers can't see your website until you approve their NDA.", "ผู้ซื้อจะไม่เห็นเว็บไซต์ของท่าน จนกว่าท่านจะอนุมัติ NDA ของผู้ซื้อ")}</p>
  );
  async function runEnrich() {
    if (!isValidUrl(d.web) || reading) return;
    setWebExpanded(true);
    await enrichment.start(d.web, true);
  }
  const appliedRead = useRef<string | null>(null);
  useEffect(() => {
    const state = enrichment.state;
    if (state.status === "running") setWebExpanded(true);
    if (state.status !== "done" || !state.websiteKey || appliedRead.current === state.websiteKey) return;
    appliedRead.current = state.websiteKey;
    const merged = mergeWebsiteEnrich(d, state.result ?? {}, marks, th);
    if (Object.keys(merged.patch).length) set(merged.patch);
    setMarks((prev) => ({ ...prev, ...merged.marks }));
    setWebExpanded(true);
    if (Object.keys(merged.marks).length) requestAnimationFrame(() => document.getElementById("sw-shortDescription")?.focus());
  }, [enrichment.state.status, enrichment.state.websiteKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const editWebsiteField = (key: WebsiteField) => setMarks(p => ({...p,[key]:false}));
  const editRow = (n: number) => {setFull(n); focusTitle.current = true; go(n); if(STEPS[n]?.id === "web") setWebExpanded(true);};
  const allLic = [...WIZARD_LICENCES, ...d.licences.filter((l) => !WIZARD_LICENCES.some((w) => w.name === l.name))];
  const allIso = [...WIZARD_ISO, ...d.iso.filter((s) => !WIZARD_ISO.includes(s))];

  const Q: Record<string, { t: string; h?: string; body: React.ReactNode }> = {
    role: { t: tr("Which best describes you?"), h: tr("This determines who approves buyer requests for this listing."),
      body: <Radio list={SELLER_RELATIONS.map((r) => ({ value: r.value, label: L(...r.label), hint: L(...r.hint) }))} value={d.role} onPick={(v) => pick({ role: v as SellerDraft["role"] })} /> },
    name: { t: tr("What is your company's name, registration number and business address?"), h: tr("Check that the name matches your company registration."), body: null as unknown as React.ReactNode },
    nameBody: { t: "",
      body: (
        <div className="space-y-4">
          <div className="seller-company-identity">
          <div><label className={fieldLbl}>{tr("Company name")}</label>
            <input className={`${inp} ${needCls(!d.name.trim())}`} data-need={!d.name.trim() ? "1" : undefined} aria-required value={d.name} maxLength={255} autoFocus onChange={(e) => set({ name: e.target.value })} placeholder={setupText("e.g. Siam Foods Co., Ltd.")} /></div>
          <div><label className={fieldLbl}>{tr("Company Registration Number (เลขทะเบียนนิติบุคคล)")}</label>
            <input className={`${inp} ${needCls(!/^\d{13}$/.test(d.reg))}`} data-need={!/^\d{13}$/.test(d.reg) ? "1" : undefined} aria-required inputMode="numeric" value={d.reg} maxLength={13} readOnly={fromSignup.includes("reg")} style={fromSignup.includes("reg") ? { background: "#F3F4F6" } : undefined}
              onChange={(e) => { if (fromSignup.includes("reg")) return; set({ reg: e.target.value.replace(/\D/g, "").slice(0, 13) }); }} placeholder={setupText("13 digits")} />
            <p className="mt-1.5 text-[13px] text-muted-foreground">{setupText("Used to verify your company.")}{d.reg && d.reg.length !== 13 ? L(` ${d.reg.length}/13 digits.`, ` ${d.reg.length}/13 หลัก`) : ""}</p></div>
          </div>
          <div className="pt-2">
            <AddressBox a={d.addr} thai city={d.addr.district} onChange={setAddr} need stars={false}
              show={(k) => (touched[k] ? ({ street: !d.addr.street.trim() ? "Add the number and street." : null, district: !d.addr.district.trim() ? "Add the city or district." : null, province: !d.addr.province ? "Choose the province or state." : null, postal: !d.addr.postal ? "Add the postal code." : /^\d{5}$/.test(d.addr.postal) ? null : tr("The postal code has 5 digits."), unit: null } as Record<string, string | null>)[k] ?? null : null)}
              onBlur={(k) => setTouched((t) => ({ ...t, [k]: true }))}
              note={tr("Buyers see your country and province, never the full address, until you approve their NDA.")} />
          </div>
          <p className="flex items-start gap-2 text-[13px] text-destructive"><Lock className="mt-0.5 h-3.5 w-3.5" />{tr("Your company identity stays confidential until you approve the buyer's NDA.")}</p>
        </div>
      ) },
    web: { t: webExpanded ? L("Describe your business", "อธิบายธุรกิจของท่าน") : L("What is your company website?", "เว็บไซต์ของบริษัทคืออะไร"),
      h: webExpanded ? d.web.trim() ? L("Buyers read these on your profile.", "ผู้ซื้อจะอ่านข้อมูลเหล่านี้ในโปรไฟล์ของท่าน") : L("You have no website, so auto-fill can't suggest these. Fill them in yourself.", "ท่านไม่มีเว็บไซต์ ระบบจึงแนะนำข้อมูลเหล่านี้ให้ไม่ได้ กรุณากรอกเอง") : L("Optional, but auto-fill needs it.", "ไม่บังคับ แต่การกรอกข้อมูลอัตโนมัติต้องใช้เว็บไซต์นี้"),
      body: <div>
        {readDone && !reading && readDomain && <FilledFrom domain={readDomain} L={L}/>}
        {enrichment.state.status === "failed" && <p className="mb-4 text-sm text-destructive">{L("We couldn't read your website. Please fill these in yourself.", "เราไม่สามารถอ่านเว็บไซต์ของท่านได้ กรุณากรอกข้อมูลเหล่านี้ด้วยตนเอง")}</p>}
        <label htmlFor="sw-web" className={fieldLbl}>{L("Company website","เว็บไซต์บริษัท")}</label>
        <div className={`seller-web-field ${webExpanded ? "is-expanded" : "is-initial"}`}>
          <input id="sw-web" ref={webRef} className={inp} value={d.web} readOnly={reading} maxLength={2048} onChange={e => set({web:e.target.value})} onKeyDown={e => {if(e.key === "Enter") e.preventDefault();}} placeholder="www.yourcompany.com"/>
          {webExpanded ? null : <><WebsiteCheckLink valid={isValidUrl(d.web)} url={normalizeUrl(d.web)} label={L("Check website","ตรวจสอบเว็บไซต์")} hint={L("Checks whether the website link you entered opens correctly.","ใช้เพื่อตรวจสอบว่าลิงก์เว็บไซต์ที่กรอกถูกต้องและเปิดใช้งานได้")}/><Button variant="unstyled" size="unstyled" className="seller-no-website-inline" onClick={() => {set({web:""}); setWebExpanded(true);}}>{L("No company website", "ไม่มีเว็บไซต์บริษัท")}</Button></>}
        </div>
        {webExpanded ? <>
                    <div className="seller-website-more"><SectionBand bleed="-mx-6 sm:-mx-9" /><SectionHeading>{L("Company description", "คำอธิบายบริษัท")}</SectionHeading><SellerWebsiteFields d={d} set={set} marks={marks} edit={editWebsiteField} reading={reading} readingStates={readingStates} openSector={() => openStep("sector")}/></div>
        </> : <div className="seller-autofill-info">
          <p className="flex items-center gap-2 font-bold"><Sparkles size={18}/>{L("Auto-fill reads your website","ระบบกรอกข้อมูลอัตโนมัติจะอ่านเว็บไซต์ของท่าน")}</p>
          <ul className="mt-2.5 space-y-1.5">{[L("Suggests your company description and corporate information","แนะนำคำอธิบายบริษัทและข้อมูลบริษัทให้"),L("Takes a few seconds, and you can change anything later","ใช้เวลาไม่กี่วินาที และท่านแก้ไขได้ทุกอย่างภายหลัง")].map(x => <li key={x} className="flex gap-2"><CheckIcon size={15}/>{x}</li>)}</ul>{privacy}
        </div>}
      </div> },
    founded: {t:L("When was your company founded, and how big is it?","บริษัทของท่านก่อตั้งเมื่อไร และมีขนาดเท่าไร"),h:L("The year it was registered or started trading, and how many people work there today.","ปีที่จดทะเบียนหรือเริ่มดำเนินธุรกิจ และจำนวนพนักงานในปัจจุบัน"),body:<div>
      <div className="seller-founded-row">
        <div><label htmlFor="sw-year" className={fieldLbl}>{L("Year founded","ปีที่ก่อตั้ง")} <span className="text-destructive">*</span></label><div className={`seller-founded-input ${touched.year && foundedYearError(d.year) ? "has-error" : ""}`}><Calendar size={18}/><input id="sw-year" inputMode="numeric" maxLength={4} value={d.year} onChange={e => set({year:e.target.value.replace(/\D/g,"").slice(0,4)})} onBlur={() => setTouched(p => ({...p,year:true}))} aria-invalid={!!touched.year && !!foundedYearError(d.year)} placeholder="e.g. 2014"/></div></div>
        <div><label htmlFor="sw-size" className={fieldLbl}>{L("Company size (employees)","ขนาดบริษัท (พนักงาน)")} <span className="text-destructive">*</span></label><div className="seller-founded-input"><Users size={18}/><select id="sw-size" value={d.size ?? ""} onChange={e => set({size:e.target.value || null})}><option value="">{L("Choose a range","เลือกช่วงจำนวน")}</option>{WIZARD_SIZES.map(x => <option value={x.value} key={x.value}>{tr(x.label)}</option>)}</select></div></div>
      </div>
      {(touched.year || d.year.length === 4) && foundedYearError(d.year) && <p className="mt-2 text-[13.5px] text-destructive" role="alert">{foundedYearError(d.year) === "digits" ? L("Enter the year with 4 digits, for example 2014","กรุณากรอกปีเป็นตัวเลข 4 หลัก เช่น 2014") : foundedYearError(d.year) === "thai" ? L(`That looks like a Thai year (พ.ศ.). Enter it in ค.ศ.: ${Number(d.year)-543}`,`ดูเหมือนเป็นปี พ.ศ. กรุณากรอกเป็นปี ค.ศ.: ${Number(d.year)-543}`) : L(`Enter a year between 1800 and ${new Date().getFullYear()}`,`กรุณากรอกปีระหว่าง 1800 ถึง ${new Date().getFullYear()}`)}</p>}
    </div>},
    rev: { t: tr("What was your company's revenue last year?"), h: tr("An approximate band is enough. Exact figures stay private."),
      body: <Radio list={THB_REVENUE_BANDS.map((b) => ({ value: b, label: b }))} value={normRevBand(d.rev)} onPick={(v) => pick({ rev: v })} /> },
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
              <input className="flex-1 rounded-[9px] border border-border px-3 py-2 text-[13.5px] outline-none" maxLength={120} placeholder={tr("Other licence")} value={otherLic} onChange={(e) => setOtherLic(e.target.value)} />
              <button type="button" className="rounded-[9px] border border-border bg-card px-3.5 text-[13px] font-semibold text-foreground"
                onClick={() => { const n = otherLic.trim(); if (n && !d.licences.some((x) => x.name.toLowerCase() === n.toLowerCase())) set({ licences: [...d.licences, { category: "Business", name: n }] }); setOtherLic(""); }}>{setupText("Add")}</button>
            </div></div>
          <div><h4 className="text-[14.5px] font-semibold">{tr("ISO and standards")}</h4>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {allIso.map((s) => {
                const on = d.iso.includes(s);
                return <Check key={s} on={on} label={s} onClick={() => set({ iso: on ? d.iso.filter((x) => x !== s) : [...d.iso, s] })} />;
              })}
            </div>
            <div className="mt-2 flex gap-2">
              <input className="flex-1 rounded-[9px] border border-border px-3 py-2 text-[13.5px] outline-none" maxLength={60} placeholder={tr("Other standard")} value={otherIso} onChange={(e) => setOtherIso(e.target.value)} />
              <button type="button" className="rounded-[9px] border border-border bg-card px-3.5 text-[13px] font-semibold text-foreground"
                onClick={() => { const n = otherIso.trim(); if (n && !d.iso.includes(n)) set({ iso: [...d.iso, n] }); setOtherIso(""); }}>{setupText("Add")}</button>
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
    founder: {t:L("Tell buyers about the founder","เล่าให้ผู้ซื้อรู้จักผู้ก่อตั้ง"),h:L("Buyers read this after you approve their NDA. Your name, the year founded and the sales are filled in from your answers: click a highlighted part to change it.","ผู้ซื้อจะอ่านส่วนนี้หลังจากท่านอนุมัติ NDA ชื่อของท่าน ปีที่ก่อตั้ง และยอดขาย กรอกไว้ให้จากคำตอบของท่าน คลิกส่วนที่ไฮไลต์เพื่อแก้ไข"),body:<>
      <FounderEditor value={d.founders ?? []} onChange={founders => set({founders})} tenantId={media?.tenantId} startupId={media?.startupId} year={d.year} sales={founderRevenueLabel(d.rev ?? "",th ? "th":"en")} salesFor={lang => founderRevenueLabel(d.rev ?? "",lang)} requiredName keepOne
        contactFields={(f, i) => <ContactPersonFields idPrefix={`seller-founder-${i}`} contact={i === 0} value={{ name: f.full_name, position: f.position ?? "", email: f.email ?? "", phone: f.phone ?? "" }}
          positionControl={<PositionMultiSelect language={th ? "th" : "en"} value={(f.position ?? "").split(",").map((x) => x.trim()).filter(Boolean)} onChange={(next) => set({ founders: (d.founders ?? []).map((x, n) => n === i ? { ...x, position: next.join(", ") || null } : x) })} />}
          onChange={(key, value) => set({ founders: (d.founders ?? []).map((x, n) => n === i ? { ...x, [key === "name" ? "full_name" : key]: value } : x) })} />} />
      {!ok.founder && <p className="mt-2 text-[13px] text-destructive">{L("Add the founder's full name and a valid email address.","กรุณากรอกชื่อ-นามสกุลและอีเมลที่ถูกต้องของผู้ก่อตั้ง")}</p>}
      <p className="mt-3 text-[13px] text-muted-foreground">{L("PitchSnack checks the owner's name against your company's list of directors, and the year founded and the sales against your company's records.","PitchSnack ตรวจสอบชื่อเจ้าของกับรายชื่อกรรมการบริษัท และปีที่ก่อตั้งกับยอดขายตามข้อมูลบริษัทของท่าน")}</p>
    </>},
    review: { t: tr("Review your answers"), h: tr("Next, we'll auto-fill the rest of your profile. You can edit everything afterwards."),
      body: (
        <div>
        <h3 className="mb-2 text-[14px] font-bold text-foreground">{L("Your company", "บริษัทของท่าน")}</h3>
        <div className="overflow-hidden rounded-[10px] border border-border">
          {([
            ["role",tr("You are"),roleLabel()], ["name",tr("Company name"),d.name],
            ["name",tr("Registration no."),d.reg], ["name",tr("Business address"),addressLine(d.addr)],
            ["sector",tr("Sector"),tr(d.sector ?? "")],
            ["web",L(...STEP_FULL.web),`${d.web || L("No company website","ไม่มีเว็บไซต์บริษัท")} · ${L(`${strengthCount(d)} key business strengths`,`จุดแข็งหลักของธุรกิจ ${strengthCount(d)} ข้อ`)} · ${th ? d.shortDescriptionTh || d.shortDescription || "" : d.shortDescription || d.shortDescriptionTh || ""}`],
            ["founded",L(...STEP_SHORT.founded),`${d.year} · ${tr(WIZARD_SIZES.find(x => x.value === d.size)?.label ?? "")} ${L("employees","คน")}`],
            ["rev",tr("Revenue last year"),d.rev ? tr(normRevBand(d.rev)) : ""],
            ["lic",tr("Licences & standards"),[...d.licences.map(l => l.name),...d.iso].join(", ") || L("None","ไม่มี")],
          ] as [StepKey,string,React.ReactNode][]).map(([key,label,value],ri) => {
            const n = STEPS.findIndex(x => x.id === key); const red = !answered[key] && key !== "lic" && barKeys.includes(key);
            return <div key={`${key}-${ri}`} className="seller-review-row"><span>{label}</span><b className={red ? "text-destructive" : ""}>{red ? L("Not answered","ยังไม่ได้ตอบ") : value || tr("Not provided")}</b><Button variant="link" size="unstyled" onClick={() => editRow(n)}>{red ? L("Answer","ตอบคำถาม") : tr("Edit")}</Button></div>;
          })}
        </div>
        <h3 className="mb-2 mt-[22px] text-[14px] font-bold text-foreground">{L("Your listing", "ประกาศของท่าน")}</h3>
        <div className="overflow-hidden rounded-[10px] border border-border">
          {LISTING_KEYS.filter((k) => barKeys.includes(k)).map((k) => {
            const n = STEPS.findIndex((x) => x.id === k);
            const band = bandOf(d.price ?? null);
            const v: React.ReactNode = k === "photos" ? L(`Logo and ${d.photos ?? 0} photo${(d.photos ?? 0) === 1 ? "" : "s"}`, `โลโก้และรูปภาพ ${d.photos ?? 0} รูป`)
              : k === "deal" ? (d.deal ? tr(d.deal) : "")
              : k === "handover" ? (d.stays === "yes" ? L(`Yes, for ${d.months ?? 6} month${(d.months ?? 6) === 1 ? "" : "s"} after the sale`, `ใช่ อยู่ต่อ ${d.months ?? 6} เดือนหลังการขาย`) : d.stays === "no" ? L("No, the owner leaves at completion", "ไม่ เจ้าของออกเมื่อการขายเสร็จสิ้น") : "")
              : k === "price" ? (d.price ? <span>{fmtThb(d.price)}<span className="mt-px block text-[12.5px] font-normal text-muted-foreground">{L(`Buyers see ${bandInText(band?.label ?? "")} until you approve their NDA`, `ผู้ซื้อจะเห็น ${band?.th ?? ""} จนกว่าท่านจะอนุมัติ NDA`)}</span></span> : "")
              : d.listingName ?? "";
            const red = !ok[k];
            return (
              <div key={k} className={`flex gap-3 border-b border-border px-4 py-3 text-sm last:border-0 ${red ? "bg-destructive/10" : ""}`}>
                <span className="w-[170px] flex-none text-muted-foreground max-[599px]:w-[110px]">{L(...STEP_FULL[k])}</span>
                {red ? (
                  <b className="flex flex-1 items-center gap-2 font-semibold text-destructive"><span className="h-2 w-2 rounded-full bg-destructive" />{L("Not answered", "ยังไม่ได้ตอบ")}</b>
                ) : <b className="min-w-0 flex-1 break-words font-semibold">{v}</b>}
                <button type="button" className={`text-[13px] underline underline-offset-2 ${red ? "font-bold text-destructive" : "font-semibold text-link"}`}
                  onClick={() => editRow(n)}>{red ? L("Answer", "ตอบคำถาม") : tr("Edit")}</button>
              </div>
            );
          })}
        </div>
        <div className="seller-review-row mt-5"><span>{L(...STEP_FULL.founder)}</span><b className={d.founders?.[0]?.full_name.trim() ? "" : "text-destructive"}>{d.founders?.filter(f => f.full_name.trim()).map(f => f.full_name).join(", ") || L("Not answered","ยังไม่ได้ตอบ")}</b><Button variant="link" size="unstyled" onClick={() => editRow(STEPS.findIndex(x => x.id === "founder"))}>{ok.founder ? tr("Edit") : L("Answer","ตอบคำถาม")}</Button></div>
        <div className="seller-review-row"><span>{L("Contact email and phone", "อีเมลและเบอร์โทรศัพท์")}</span><b className={ok.founder ? "" : "text-destructive"}>{[d.founders?.[0]?.email, d.founders?.[0]?.phone].filter(Boolean).join(" · ") || L("Not answered","ยังไม่ได้ตอบ")}</b><Button variant="link" size="unstyled" onClick={() => editRow(STEPS.findIndex(x => x.id === "founder"))}>{ok.founder ? tr("Edit") : L("Answer","ตอบคำถาม")}</Button></div>
        {blockers.length > 0 && (
          <p className="mt-[18px] text-[13.5px] text-destructive">{L(`Answer ${joinNames(blockers.map((k) => (LISTING_KEYS as readonly string[]).includes(k) ? STEP_FULL[k][0] : STEP_SHORT[k][0]), false)} before you continue.`, `กรุณาตอบ ${joinNames(blockers.map((k) => (LISTING_KEYS as readonly string[]).includes(k) ? STEP_FULL[k][1] : STEP_SHORT[k][1]), true)} ก่อนไปต่อ`)}</p>
        )}
        </div>
      ) },
  };
  useFocusNeeded(cardRef, `${cur.id}:${full ?? ""}`);
  const q = cur.id === "name" ? { ...Q.name, body: Q.nameBody?.body } : Q[cur.id];
  if (!q) return null;
  // Continue off: name what's missing (Website, Licences and the founder keep their own messages).
  const lang: "en" | "th" = th ? "th" : "en";
  const missingNow: string[] = cur.id === "name" ? [
      !d.name.trim() && L("Company name", "ชื่อบริษัท"), !/^\d{13}$/.test(d.reg) && L("Registration number", "เลขทะเบียนนิติบุคคล"),
      !d.addr.street.trim() && L("No. and street", "เลขที่และถนน"), !d.addr.district.trim() && L("City/District", "เขต/อำเภอ"),
      !d.addr.province && L("Province", "จังหวัด"), !/^\d{5}$/.test(d.addr.postal) && L("Postal code", "รหัสไปรษณีย์"),
    ].filter((x): x is string => !!x)
    : cur.id === "founded" ? [!validFoundedYear(d.year) && L("Year founded", "ปีที่ก่อตั้ง"), !d.size && L("Company size", "ขนาดบริษัท")].filter((x): x is string => !!x)
    : cur.id === "price" ? [L("Asking price", "ราคาที่ต้องการขาย")] : [];
  const blockedText = reading || valid[cur.id] || cur.id === "review" ? null
    : cur.id === "photos" ? (d.hasLogo ? continueBlockedLine([], lang, true) : null)
    : continueBlockedLine(missingNow, lang);

  return (
    <div className="wiz seller-setup -m-4 min-h-[calc(100vh-54px)] text-[15px] md:-m-6" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <div className="flex h-14 items-center gap-3 border-b border-border bg-card px-6">
        <span className="text-[14px] font-semibold">{setupText(title)}</span>
        <span className="ml-auto text-[13px] text-muted-foreground">{setupText(justSaved ? "Saved just now" : tr("All changes saved"))}</span>
      </div>
      <div className={`mx-auto ${cur.id === "web" ? "max-w-[800px]" : "max-w-[900px]"} px-5 pb-16 pt-10`}>
        <div className="mb-2.5 flex items-baseline justify-between text-[13px] text-muted-foreground">
          <b className="font-semibold text-foreground">{tr(cur.sec)}</b>
          <span>{setupText(`Step ${pos + 1} of ${shown.length}`)}</span>
        </div>
        <div className="mb-6 mt-5">
          <StepBar missedIcon steps={items} lineTo={lineTo} onPick={openStep} label={L("Setup steps", "ขั้นตอนการตั้งค่า")} stepWord={stepWord} missedWord={L("Not answered", "ยังไม่ได้ตอบ")} />
          <MissedNote missed={missed} onPick={openStep} answerNow={L("Answer now", "ตอบเลย")}
            desktop={th ? `มี ${missed.length} คำถามที่ยังไม่ได้ตอบ กดวงกลมสีแดงเพื่อตอบ` : missed.length === 1 ? "1 question not answered. Click the red step to answer it." : `${missed.length} questions not answered. Click a red step to answer it.`}
            row={(n, f) => L(`Step ${n} · ${f} isn't answered yet`, `ขั้นที่ ${n} · ${f} ยังไม่ได้ตอบ`)} />
        </div>
        <div className="seller-wizard-card rounded-[14px] border border-border px-6 pb-7 pt-8 sm:px-9 sm:pt-9">
          <div key={cur.id} ref={cardRef} className="animate-in fade-in slide-in-from-bottom-1 duration-200">
            <h2 ref={titleRef} tabIndex={-1} className="mb-1.5 outline-none text-2xl font-bold leading-snug tracking-normal text-foreground">{tr(q.t)}{(cur.id !== "web" || webExpanded && !reading && !readDone) && cur.id !== "lic" && <span aria-hidden className="ml-1 text-destructive">*</span>}</h2>
            {q.h && <p className="mb-6 text-[14.5px] leading-relaxed text-muted-foreground">{tr(q.h)}</p>}
            {!q.h && <div className="mb-6" />}
            {q.body}
          </div>
          <div className={cur.id === "web" ? `seller-website-actions ${!webExpanded ? "has-no-website" : ""}` : "seller-setup-actions mt-8 flex items-center gap-2.5"}>
            <Button variant="unstyled" size="unstyled" type="button" onClick={back}
              className={cur.id === "web" ? "seller-action seller-action-back" : "rounded-[10px] border border-border bg-card px-[18px] py-[11px] font-semibold text-foreground"}>{pos === 0 && full == null ? tr("Cancel") : tr("Back")}</Button>
            {canSkip && (
              <button type="button" className="rounded-[10px] border border-border bg-card px-[18px] py-[11px] font-semibold text-foreground"
                ref={skipRef} onClick={() => advance()}>{cur.id === "lic" ? L("Have no license","ไม่มีใบอนุญาต") : tr("Skip")}</button>
            )}
            {cur.id === "web" && <>
              <span className="seller-actions-spacer" />

            </>}
            <div className={cur.id === "web" ? "contents" : "ml-auto flex items-center gap-2.5"}>
              {pos > 0 && (
                <Button variant="unstyled" size="unstyled" type="button" onClick={() => setConfirmExit(true)}
                  className={cur.id === "web" ? "seller-action" : "rounded-[10px] border border-border bg-card px-[18px] py-[11px] font-semibold text-foreground"}>{tr("Save & exit")}</Button>
              )}
              <Button variant="unstyled" size="unstyled" type="button" ref={fwdRef} disabled={reading || (cur.id === "web" && !webExpanded ? !isValidUrl(d.web) : !valid[cur.id])}
                onClick={async () => {
                  if (cur.id === "review") {onFinish(d); return;}
                  if (cur.id === "web" && !webExpanded) {void runEnrich(); return;}
                  advance();
                }}
                className={cur.id === "web" ? "seller-action seller-action-primary" : "rounded-[10px] bg-primary px-6 py-3 font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:bg-muted"}>
                {setupText(cur.id === "review" ? L("Finish setup","เสร็จสิ้นการตั้งค่า") : reading ? L("Reading…","กำลังอ่าน…") : full != null ? tr("Back to review") : tr("Continue"))}

              </Button>
            </div>
          </div>
          {cur.id === "web" && webExpanded && !reading && <p className="seller-website-left" aria-live="polite">{websiteMissing(d,th)}</p>}
          {cur.id !== "web" && <ContinueBlockedLine text={blockedText} />}
        </div>
        {confirmExit && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(17,24,39,.45)] p-4" onClick={() => setConfirmExit(false)}>
            <div role="dialog" aria-modal="true" className="w-full max-w-[400px] rounded-[14px] bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold">{tr("Save and finish later?")}</h3>
              <p className="mt-1 text-[14px] text-muted-foreground">{tr("Your answers are saved. You can continue setup from My Business.")}</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                <i className="block h-full bg-primary" style={{ width: `${Math.round((sellerProgress(d, fromSignup).n / sellerProgress(d, fromSignup).N) * 100)}%` }} />
              </div>
              <p className="mt-2 text-[13px] text-muted-foreground">{setupText(`${sellerProgress(d, fromSignup).n} of ${sellerProgress(d, fromSignup).N} questions answered`)}</p>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setConfirmExit(false)} className="rounded-[10px] border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground">{tr("Keep going")}</button>
                <button type="button" onClick={() => { store(d); onExit(); }} className="rounded-[10px] bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">{tr("Save & exit")}</button>
              </div>
            </div>
          </div>
        )}
        <p className="mt-[18px] text-center text-[12.5px] text-muted-foreground">{L("Your company name, website, logo, photos and exact figures stay private until you approve a buyer's NDA.", "ชื่อบริษัท เว็บไซต์ โลโก้ รูปภาพ และตัวเลขที่แท้จริงของท่านจะถูกเก็บเป็นความลับ จนกว่าท่านจะอนุมัติ NDA ของผู้ซื้อ")}</p>
      </div>
    </div>
  );
}
