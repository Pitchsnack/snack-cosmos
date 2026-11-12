import { useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, LoaderCircle, X } from "lucide-react";
import { DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { toWebp } from "@/lib/media/to-webp";
import type { RegCompany } from "@/lib/signup-reg.functions";
import { R, type SetupReason } from "./signup-reg-copy";
import "@/styles/signup-reg.css";

type Lang = "th" | "en";
type T = { th: string; en: string };
const tx = (lang: Lang, x: T, vars: Record<string, string | number> = {}) =>
  Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), x[lang]);

/** The app's dialog shape for the six sign-up pop-ups; focus goes to the main button. */
export function SrDialog({ open, onClose, closable, title, lang, children, mainRef }: {
  open: boolean; onClose?: () => void; closable: boolean; title: string; lang: Lang; children: React.ReactNode; mainRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => { if (!o && closable) onClose?.(); }}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content className="sr sr-dlg fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 shadow-lg"
          onEscapeKeyDown={(e) => { if (!closable) e.preventDefault(); }} onPointerDownOutside={(e) => { if (!closable) e.preventDefault(); }}
          onOpenAutoFocus={(e) => { if (mainRef?.current) { e.preventDefault(); mainRef.current.focus(); } }} aria-describedby={undefined}>
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          {children}
          {closable && (
            <DialogPrimitive.Close className="absolute right-3 top-3 grid h-[38px] w-[38px] place-items-center rounded-full hover:bg-muted" aria-label={R.close[lang]}>
              <X size={18} />
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}

/** 6.1 Confirm your registration number. */
export function ConfirmRegDialog({ open, lang, reg, change, onCancel, onConfirm }: { open: boolean; lang: Lang; reg: string; change: number; onCancel: () => void; onConfirm: () => void }) {
  const main = useRef<HTMLButtonElement>(null);
  return (
    <SrDialog open={open} onClose={onCancel} closable title={R.cTitle[lang]} lang={lang} mainRef={main}>
      <h2>{R.cTitle[lang]}</h2>
      <p className="sr-lead">{change > 0 ? <>{tx(lang, R.cChange, { k: change })}{change >= 2 ? ` ${R.cLast[lang]}` : ""}</> : R.cLead[lang]}</p>
      <div className="sr-numbox"><small>{R.regLabel[lang]}</small><b>{reg}</b></div>
      {change === 0 && <p className="sr-cwarn">{R.cWarn[lang]}</p>}
      <div className="sr-btns"><button type="button" className="sr-btn" onClick={onCancel}>{R.cancel[lang]}</button>
        <button ref={main} type="button" className="sr-btn navy" onClick={onConfirm}>{R.confirmGo[lang]}</button></div>
    </SrDialog>
  );
}

/** 6.2 Verifying (can't be closed). */
export function VerifyingDialog({ open, lang, reg }: { open: boolean; lang: Lang; reg: string }) {
  return (
    <SrDialog open={open} closable={false} title={R.isYours[lang]} lang={lang}>
      <h2>{R.isYours[lang]}</h2>
      <div className="sr-spin" role="status"><LoaderCircle size={16} className="lg-spin" />{tx(lang, R.verifying, { number: reg })}</div>
    </SrDialog>
  );
}

const MONTH_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_TH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
export function regDates(iso: string | null) {
  const m = iso && /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
  return { year: y, th: `จดทะเบียนเมื่อ ${d} ${MONTH_TH[mo]} ${y + 543}`, en: `Registered ${d} ${MONTH_EN[mo]} ${y}` };
}

/** Business name / Registered address rows, both languages. */
export function CompanyRows({ lang, co, full }: { lang: Lang; co: RegCompany; full?: boolean }) {
  const dt = regDates(co.regDate);
  return (
    <div className="sr-rows">
      <div className="sr-row"><span>{R.bizName[lang]}</span><div>{co.nameTh && <p>{co.nameTh}</p>}{co.nameEn && <p>{co.nameEn}</p>}</div></div>
      {full && dt && <div className="sr-row"><span>{R.yearF[lang]}</span><div><p>{dt.year}</p><p className="sm">{dt.th}</p><p className="sm">{dt.en}</p></div></div>}
      <div className="sr-row"><span>{R.addr[lang]}</span><div>{co.addressTh && <p>{co.addressTh}</p>}{co.addressEn && <p>{co.addressEn}{co.translated && <span className="sr-tag">{R.translated[lang]}</span>}</p>}</div></div>
      {full && <div className="sr-row"><span>{R.status[lang]}</span><div><span className="sr-status" style={co.active ? undefined : { color: "var(--sr-muted)" }}><i />{co.active ? R.active[lang] : co.statusTh ?? "—"}</span></div></div>}
    </div>
  );
}

/** 6.3 Is this your company? */
export function FoundDialog({ open, lang, reg, co, noChangeLeft, busy, onClose, onNo, onYes }: {
  open: boolean; lang: Lang; reg: string; co: RegCompany; noChangeLeft: boolean; busy: boolean; onClose: () => void; onNo: () => void; onYes: () => void;
}) {
  const main = useRef<HTMLButtonElement>(null);
  return (
    <SrDialog open={open} onClose={busy ? undefined : onClose} closable title={R.isYours[lang]} lang={lang} mainRef={main}>
      <h2>{R.isYours[lang]}</h2>
      <p className="sr-sub">{tx(lang, R.regNo, { number: reg })}</p>
      <CompanyRows lang={lang} co={co} full />
      <p className="sr-note">{R.addrLater[lang]}</p>
      <p className="sr-note">{noChangeLeft ? R.usedBoth[lang] : R.ifNot[lang]}</p>
      <div className="sr-btns">
        <button type="button" className="sr-btn" disabled={busy} onClick={onNo}>{R.no[lang]}</button>
        <button ref={main} type="button" className="sr-btn navy" disabled={busy} onClick={onYes}>
          {busy ? <span className="inline-flex items-center gap-2">{R.registering[lang]}<LoaderCircle size={16} className="lg-spin" /></span> : R.yes[lang]}
        </button>
      </div>
    </SrDialog>
  );
}

function Head({ title, sub, ok }: { title: string; sub?: string; ok?: boolean }) {
  return <div className="sr-head"><span className={`sr-circle${ok ? " ok" : ""}`} aria-hidden>{ok ? <Check size={22} /> : "!"}</span><div><h2>{title}</h2>{sub && <p className="sr-sub" style={{ margin: 0 }}>{sub}</p>}</div></div>;
}

/** 6.4 We couldn't verify your company. */
export function NotFoundDialog({ open, lang, reg, onEdit, onContact }: { open: boolean; lang: Lang; reg: string; onEdit: () => void; onContact: () => void }) {
  const main = useRef<HTMLButtonElement>(null);
  return (
    <SrDialog open={open} closable={false} title={R.nfTitle[lang]} lang={lang} mainRef={main}>
      <Head title={R.nfTitle[lang]} sub={tx(lang, R.regNo, { number: reg })} />
      <p className="sr-p">{R.nfA[lang]}</p><p className="sr-p">{R.nfB[lang]}</p>
      <div className="sr-stack"><button ref={main} type="button" className="sr-btn navy" onClick={onEdit}>{R.edit[lang]}</button>
        <button type="button" className="sr-btn" onClick={onContact}>{R.contact[lang]}</button></div>
    </SrDialog>
  );
}

/** 6.5 Too many checks · 6.6 Please contact the team · register not answering (retry). */
export function SimpleDialog({ open, lang, kind, count, onMain, busy }: { open: boolean; lang: Lang; kind: "limit" | "contact" | "unavailable"; count?: number; onMain: () => void; busy?: boolean }) {
  const main = useRef<HTMLButtonElement>(null);
  const title = kind === "limit" ? R.limTitle[lang] : kind === "contact" ? R.pcTitle[lang] : R.unTitle[lang];
  return (
    <SrDialog open={open} closable={false} title={title} lang={lang} mainRef={main}>
      <Head title={title} />
      {kind === "limit" && <><p className="sr-p">{R.limA[lang]}</p><p className="sr-p">{R.limB[lang]}</p></>}
      {kind === "contact" && <><p className="sr-p">{tx(lang, R.pcA, { count: count ?? 0 })}</p><p className="sr-p">{R.pcB[lang]}</p></>}
      {kind === "unavailable" && <p className="sr-p">{R.unA[lang]}</p>}
      <div className="sr-btns end"><button ref={main} type="button" className="sr-btn navy" disabled={busy} onClick={onMain}>{kind === "unavailable" ? R.tryAgain[lang] : R.contact[lang]}</button></div>
    </SrDialog>
  );
}

/** 6.7 Welcome, over My Company once the account is registered. */
export function WelcomeDialog({ open, lang, name, onClose, onCreate }: { open: boolean; lang: Lang; name: string; onClose: () => void; onCreate: () => void }) {
  const main = useRef<HTMLButtonElement>(null);
  return (
    <SrDialog open={open} onClose={onClose} closable title={tx(lang, R.wTitle, { name })} lang={lang} mainRef={main}>
      <Head ok title={tx(lang, R.wTitle, { name })} />
      <p className="sr-p">{R.wA[lang]}</p><p className="sr-p">{R.wB[lang]}</p>
      <div className="sr-btns end"><button ref={main} type="button" className="sr-btn navy" onClick={onCreate}>{R.wBtn[lang]}</button></div>
    </SrDialog>
  );
}

/* ---------------------------------- Logo --------------------------------- */
export type HeldLogo = { data: string; type: "image/webp" | "image/svg+xml" | "image/png" | "image/jpeg" };
const TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
async function cleanSvgText(file: File) {
  const txt = await file.text();
  return txt.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "").replace(/(href|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, "");
}
const toDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(b); });
/** Browser-side: checks type/size, converts with toWebp(file, "logo"); SVGs cleaned and kept. */
export async function prepareLogo(file: File): Promise<{ logo?: HeldLogo; error?: "type" | "size" }> {
  if (!TYPES.includes(file.type)) return { error: "type" };
  if (file.size > 2 * 1024 * 1024) return { error: "size" };
  if (file.type === "image/svg+xml") {
    const blob = new Blob([await cleanSvgText(file)], { type: "image/svg+xml" });
    return { logo: { data: await toDataUrl(blob), type: "image/svg+xml" } };
  }
  const conv = await toWebp(file, "logo");
  const type = (TYPES.includes(conv.type) ? conv.type : "image/webp") as HeldLogo["type"];
  return { logo: { data: await toDataUrl(conv), type } };
}

export function LogoPicker({ lang, role, logo, onChange, showRequiredError }: { lang: Lang; role: "seller" | "buyer" | "advisor"; logo: HeldLogo | null; onChange: (l: HeldLogo | null) => void; showRequiredError: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<null | "type" | "size">(null);
  const [busy, setBusy] = useState(false);
  async function take(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    try { const r = await prepareLogo(f); if (r.error) setErr(r.error); else { setErr(null); onChange(r.logo!); } }
    catch { setErr("type"); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  }
  const bad = !!err || (showRequiredError && !logo);
  return (
    <div className="sr">
      <div className="lg-label">{R.logoLabel[lang]}<span className="sr-req" aria-hidden>*</span></div>
      <div className="sr-logo">
        <div>
          <button type="button" className={`sr-drop${bad ? " bad" : ""}`} aria-required onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void take(e.dataTransfer.files?.[0]); }}>
            {busy ? <LoaderCircle className="lg-spin" /> : logo ? <img src={logo.data} alt="" /> : R.addLogo[lang]}
          </button>
          {logo && <button type="button" className="sr-link" onClick={() => onChange(null)}>{R.remove[lang]}</button>}
          <input ref={input} type="file" hidden accept=".png,.jpg,.jpeg,.svg,.webp,image/png,image/jpeg,image/svg+xml,image/webp" onChange={(e) => void take(e.target.files?.[0])} />
        </div>
        <div className="sr-logo-side">
          <p>{R.logoTypes[lang]}</p><p>{R.logoSquare[lang]}</p>
          {err && <p className="err" role="alert">{err === "type" ? R.logoBadType[lang] : R.logoBig[lang]}</p>}
        </div>
      </div>
      <p className="sr-hint">{R.logoUnder[role][lang]}</p>
    </div>
  );
}

/* --------------------------- Set-up request form -------------------------- */
export type SetupInit = { name: string; email: string; company: string; country: string };
export function SetupRequest({ lang, reason, init, tried, onBackToFields, onSend, card }: {
  lang: Lang; reason: SetupReason; init: SetupInit; tried: string[]; card?: boolean;
  onBackToFields?: () => void;
  onSend: (v: { name: string; email: string; phone: string; company: string | null; country: string; note: string | null }) => Promise<void>;
}) {
  const [v, setV] = useState({ name: init.name, email: init.email, phone: "", company: init.company, country: init.country, note: "" });
  useEffect(() => { setV((o) => ({ ...o, name: o.name || init.name, email: o.email || init.email, company: o.company || init.company, country: init.country || o.country })); }, [init.name, init.email, init.company, init.country]);
  const [errs, setErrs] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false); const [fail, setFail] = useState(false); const [done, setDone] = useState(false);
  const companyOptional = reason === "individual";
  const canGoBack = ["no_number", "individual", "outside_buyer", "outside_advisor"].includes(reason);
  async function send() {
    const e = { name: v.name.trim().length < 2, email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim()), phone: v.phone.replace(/\D/g, "").length < 6, company: !companyOptional && !v.company.trim(), country: v.country.trim().length < 2 };
    setErrs(e);
    if (Object.values(e).some(Boolean)) return;
    setBusy(true); setFail(false);
    try { await onSend({ name: v.name.trim(), email: v.email.trim(), phone: v.phone.trim(), company: v.company.trim() || null, country: v.country.trim(), note: v.note.trim() || null }); setDone(true); }
    catch { setFail(true); }
    finally { setBusy(false); }
  }
  if (done) return (
    <div className="sr"><div className={card ? "" : "sr-setup"}><div className="sr-thanks" role="status">
      <span className="sr-circle ok" aria-hidden><Check size={22} /></span><b>{R.thanksA[lang]}</b><p>{R.thanksB[lang]}</p>
      {canGoBack && onBackToFields && <div className="sr-btns end" style={{ justifyContent: "center" }}><button type="button" className="sr-btn" onClick={onBackToFields}>{R.backSignup[lang]}</button></div>}
    </div></div></div>
  );
  const F = (k: keyof typeof v, label: string, req: boolean, type = "text", full = false) => (
    <label className={full ? "full" : ""}>{label}{req ? <span className="sr-req" aria-hidden>*</span> : <span className="su-opt"> {lang === "th" ? "ไม่บังคับ" : "optional"}</span>}
      {k === "note" ? <textarea rows={3} value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} maxLength={2000} />
        : <input type={type} aria-required={req} className={errs[k] ? "bad" : ""} value={v[k]} onChange={(e) => { setV({ ...v, [k]: e.target.value }); setErrs((x) => ({ ...x, [k]: false })); }} />}
      {errs[k] && <em>{R.required[lang]}</em>}
    </label>
  );
  return (
    <div className="sr"><div className="sr-setup">
      <h3>{R.sTitle[lang]}</h3>
      <p>{R.why[reason][lang]} {R.sLead[lang]}</p>
      <div className="sr-grid">
        {F("name", R.fullName[lang], true)}{F("email", R.workEmail[lang], true, "email")}
        {F("phone", R.phone[lang], true, "tel")}{F("company", companyOptional ? R.coIf[lang] : R.coFirm[lang], !companyOptional)}
        {F("country", R.country[lang], true)}{F("note", R.anything[lang], false, "text", true)}
      </div>
      {(reason === "check_failed" || reason === "too_many") && tried.length > 0 && <p className="sr-hint">{tx(lang, R.triedLine, { numbers: tried.join(", ") })}</p>}
      {fail && <p className="sr-hint bad" role="alert">{lang === "th" ? "ส่งคำขอไม่สำเร็จ กรุณาลองอีกครั้ง" : "We couldn't send your request. Please try again."}</p>}
      <div className="sr-foot">
        {canGoBack && onBackToFields ? <button type="button" className="sr-link" style={{ marginTop: 0 }} onClick={onBackToFields}>{R.haveAfter[lang]}</button> : <span />}
        <button type="button" className="sr-btn navy" disabled={busy} onClick={() => void send()}>{busy ? R.sending[lang] : R.send[lang]}</button>
      </div>
    </div></div>
  );
}
