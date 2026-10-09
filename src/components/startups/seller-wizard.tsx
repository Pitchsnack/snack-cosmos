import { useEffect, useRef, useState } from "react";
import { ExternalLink, Lock, AlertTriangle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { checkWebsiteReachable } from "@/lib/website-check.functions";
import { SetSectorPicker } from "@/components/common/set-sector-picker";
import { AddressBox } from "@/components/advisor/advisor-firm-fields";
import { addressLine, needCls, useFocusNeeded } from "@/components/common/need-fill";
import {
  SELLER_RELATIONS, THB_REVENUE_BANDS, addrComplete, type SellerAddr, WIZARD_ISO, WIZARD_LICENCES, WIZARD_SIZES,
  isValidUrl, saveDraft, normalizeUrl, sellerShown, sellerProgress, type SellerDraft,
} from "@/lib/seller-wizard";

const SECTIONS = ["About you", "About the company", "Financial & business profile", "Intangible assets", "Review"];
const STEPS = [
  { id: "role", sec: 0 },
  { id: "name", sec: 1 },
  { id: "web", sec: 1 },
  { id: "year", sec: 1 },
  { id: "rev", sec: 2 },
  { id: "size", sec: 2 },
  { id: "sector", sec: 2 },
  { id: "lic", sec: 3 },
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
              <b className="block text-[15px] font-semibold">{o.label}</b>
              {o.hint && <small className="mt-0.5 block text-[13.5px] text-[#6b7280]">{o.hint}</small>}
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
  userId, initial, onExit, onCancel, onFinish, fromSignup = [], persist, title = "Add my business",
}: {
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
  const [d, setD] = useState<SellerDraft>(initial);
  const [otherLic, setOtherLic] = useState("");
  const [otherIso, setOtherIso] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  // A question opened from Review shows all its fields, even ones sign-up answered.
  const [full, setFull] = useState<number | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [webState, setWebState] = useState<"idle" | "checking" | "unreachable">("idle");
  const checkWeb = useServerFn(checkWebsiteReachable);
  const timer = useRef<number | null>(null);
  const savedTimer = useRef<number | null>(null);
  const firstRun = useRef(true);
  const step = Math.min(d.step, STEPS.length - 1);
  const cur = STEPS[step]!;
  const store = (x: SellerDraft) => (persist ? persist(x) : saveDraft(userId, x));
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

  const yearN = Number(d.year);
  const valid: Record<string, boolean> = {
    role: !!d.role,
    name: d.name.trim().length > 0 && /^\d{13}$/.test(d.reg) && addrComplete(d.addr),
    web: isValidUrl(d.web),
    year: /^\d{4}$/.test(d.year) && yearN >= 1800 && yearN <= THIS_YEAR,
    rev: !!d.rev,
    size: !!d.size,
    sector: !!d.sector,
    lic: true,
    review: true,
  };
  const canSkip = cur.id === "web" || cur.id === "lic";

  const allLic = [...WIZARD_LICENCES, ...d.licences.filter((l) => !WIZARD_LICENCES.some((w) => w.name === l.name))];
  const allIso = [...WIZARD_ISO, ...d.iso.filter((s) => !WIZARD_ISO.includes(s))];

  const Q: Record<string, { t: string; h?: string; body: React.ReactNode }> = {
    role: { t: "Which best describes you?", h: "This determines who approves buyer requests for this listing.",
      body: <Radio list={SELLER_RELATIONS} value={d.role} onPick={(v) => pick({ role: v as SellerDraft["role"] })} /> },
    name: { t: "What is your company's name, registration number and business address?", h: "Check that the name matches your company registration.", body: null as unknown as React.ReactNode },
    nameBody: { t: "",
      body: (
        <div className="space-y-4">
          <div><label className={fieldLbl}>Company name</label>
            <input className={`${inp} ${needCls(!d.name.trim())}`} data-need={!d.name.trim() ? "1" : undefined} aria-required value={d.name} maxLength={255} autoFocus onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Siam Foods Co., Ltd." /></div>
          <div><label className={fieldLbl}>Company Registration Number (เลขทะเบียนนิติบุคคล)</label>
            <input className={`${inp} ${needCls(!/^\d{13}$/.test(d.reg))}`} data-need={!/^\d{13}$/.test(d.reg) ? "1" : undefined} aria-required inputMode="numeric" value={d.reg} maxLength={13}
              onChange={(e) => set({ reg: e.target.value.replace(/\D/g, "").slice(0, 13) })} placeholder="13 digits" />
            <p className="mt-1.5 text-[13px] text-[#6b7280]">Used to verify your company.{d.reg && d.reg.length !== 13 ? ` ${d.reg.length}/13 digits.` : ""}</p></div>
          <div className="pt-2">
            <AddressBox a={d.addr} thai city={d.addr.district} onChange={setAddr} need
              show={(k) => (touched[k] ? ({ street: !d.addr.street.trim() ? "Add the number and street." : null, district: !d.addr.district.trim() ? "Add the city or district." : null, province: !d.addr.province ? "Choose the province or state." : null, postal: !d.addr.postal ? "Add the postal code." : /^\d{5}$/.test(d.addr.postal) ? null : "The postal code has 5 digits.", unit: null } as Record<string, string | null>)[k] ?? null : null)}
              onBlur={(k) => setTouched((t) => ({ ...t, [k]: true }))}
              note="Buyers see only the province until you approve their NDA." />
          </div>
          <p className="flex items-start gap-2 text-[13px] text-destructive"><Lock className="mt-0.5 h-3.5 w-3.5" />Your company identity stays confidential until you approve the buyer's NDA.</p>
        </div>
      ) },
    web: { t: "What is your company website?", h: "We use it to auto-fill your profile. You can skip this.",
      body: (
        <div>
          <label className={fieldLbl}>Website URL</label>
          <div className="flex gap-2">
            <input className={inp} value={d.web} autoFocus maxLength={2048} onChange={(e) => set({ web: e.target.value })}
              onBlur={() => set({ web: d.web.trim() })} placeholder="https://www.yourcompany.com" />
            {valid.web ? (
              <a href={normalizeUrl(d.web)} target="_blank" rel="noopener noreferrer"
                className="inline-flex flex-none items-center gap-1.5 rounded-[10px] border border-[#d1d5db] bg-white px-3.5 text-[13.5px] font-semibold text-[#1e2a4a] hover:border-[#1e2a4a]">
                <ExternalLink className="h-4 w-4" />Check website
              </a>
            ) : (
              <span aria-disabled="true" className="inline-flex flex-none cursor-not-allowed items-center gap-1.5 rounded-[10px] border border-[#eef0f3] bg-white px-3.5 text-[13.5px] font-semibold text-[#c0c4cc]">
                <ExternalLink className="h-4 w-4" />Check website
              </span>
            )}
          </div>
          {d.web.trim() && !valid.web ? (
            <p className="mt-1.5 text-[13px] text-destructive">Enter a valid website address, e.g. www.yourcompany.com</p>
          ) : (
            <p className="mt-1.5 text-[13px] text-[#6b7280]">Click Check website to open it in a new tab and make sure it is your company.</p>
          )}
          {webState === "unreachable" && (
            <div className="mt-4 rounded-[10px] border border-[#fcd34d] bg-[#fffbeb] p-3.5">
              <p className="flex items-start gap-2 text-[13.5px] font-medium text-[#92400e]">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />We couldn't reach this website. Please check the address.
              </p>
              <div className="mt-3 flex gap-2">
                <button type="button" className="rounded-[9px] border border-[#e5e7eb] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#374151]"
                  onClick={() => { setWebState("idle"); (document.querySelector("input[placeholder='https://www.yourcompany.com']") as HTMLInputElement | null)?.focus(); }}>Edit address</button>
                <button type="button" className="rounded-[9px] bg-[#1e2a4a] px-3.5 py-2 text-[13px] font-semibold text-white"
                  onClick={() => advance({ web: normalizeUrl(d.web) })}>Continue anyway</button>
              </div>
            </div>
          )}
        </div>
      ) },
    year: { t: "What year was the company founded?",
      body: <div><input className={`${inp} max-w-[200px]`} inputMode="numeric" value={d.year} maxLength={4} autoFocus
        onChange={(e) => set({ year: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder={`e.g. ${THIS_YEAR - 10}`} />
        {d.year.length === 4 && !valid.year && <p className="mt-1.5 text-[13px] text-destructive">Enter a year between 1800 and {THIS_YEAR}.</p>}</div> },
    rev: { t: "What was your company's revenue last year?", h: "An approximate band is enough. Exact figures stay private.",
      body: <Radio list={THB_REVENUE_BANDS.map((b) => ({ value: b, label: b }))} value={d.rev} onPick={(v) => pick({ rev: v })} /> },
    size: { t: "What is the size of your company?", h: "Number of employees.",
      body: <Radio grid list={WIZARD_SIZES} value={d.size} onPick={(v) => pick({ size: v })} /> },
    sector: { t: "What is your business sector?", h: "Based on the SET sector classification.",
      body: <SetSectorPicker mode="single" value={d.sector ? [d.sector] : []} onChange={(v) => set({ sector: v[0] ?? null })} /> },
    lic: { t: "Licences and certifications", h: "Select any that apply. This is optional.",
      body: (
        <div className="space-y-6">
          <div><h4 className="text-[14.5px] font-semibold">Regulatory licences</h4>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {allLic.map((l) => {
                const on = d.licences.some((x) => x.name === l.name);
                return <Check key={l.name} on={on} label={l.name}
                  onClick={() => set({ licences: on ? d.licences.filter((x) => x.name !== l.name) : [...d.licences, l] })} />;
              })}
            </div>
            <div className="mt-2 flex gap-2">
              <input className="flex-1 rounded-[9px] border border-[#e5e7eb] px-3 py-2 text-[13.5px] outline-none" maxLength={120} placeholder="Other licence" value={otherLic} onChange={(e) => setOtherLic(e.target.value)} />
              <button type="button" className="rounded-[9px] border border-[#e5e7eb] bg-white px-3.5 text-[13px] font-semibold text-[#374151]"
                onClick={() => { const n = otherLic.trim(); if (n && !d.licences.some((x) => x.name.toLowerCase() === n.toLowerCase())) set({ licences: [...d.licences, { category: "Business", name: n }] }); setOtherLic(""); }}>Add</button>
            </div></div>
          <div><h4 className="text-[14.5px] font-semibold">ISO and standards</h4>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {allIso.map((s) => {
                const on = d.iso.includes(s);
                return <Check key={s} on={on} label={s} onClick={() => set({ iso: on ? d.iso.filter((x) => x !== s) : [...d.iso, s] })} />;
              })}
            </div>
            <div className="mt-2 flex gap-2">
              <input className="flex-1 rounded-[9px] border border-[#e5e7eb] px-3 py-2 text-[13.5px] outline-none" maxLength={60} placeholder="Other standard" value={otherIso} onChange={(e) => setOtherIso(e.target.value)} />
              <button type="button" className="rounded-[9px] border border-[#e5e7eb] bg-white px-3.5 text-[13px] font-semibold text-[#374151]"
                onClick={() => { const n = otherIso.trim(); if (n && !d.iso.includes(n)) set({ iso: [...d.iso, n] }); setOtherIso(""); }}>Add</button>
            </div></div>
        </div>
      ) },
    review: { t: "Review your answers", h: "Next, we'll auto-fill the rest of your profile. You can edit everything afterwards.",
      body: (
        <div className="rounded-[10px] border border-[#e5e7eb]">
          {([
            ["You are", SELLER_RELATIONS.find((r) => r.value === d.role)?.label, 0],
            ["Company name", d.name, 1],
            ["Registration no.", d.reg, 1],
            ["Business address", addressLine(d.addr), 1],
            ["Website", d.web && valid.web ? <a href={normalizeUrl(d.web)} target="_blank" rel="noopener noreferrer" className="text-[#1e2a4a] underline underline-offset-2">{d.web} ↗</a> : "", 2],
            ["Year founded", d.year, 3],
            ["Revenue last year", d.rev, 4],
            ["Company size", WIZARD_SIZES.find((s) => s.value === d.size)?.label, 5],
            ["Sector", d.sector, 6],
            ["Licences & standards", [...d.licences.map((l) => l.name), ...d.iso].join(", "), 7],
          ] as [string, React.ReactNode, number][]).map(([k, v, n]) => (
            <div key={k} className="flex gap-3 border-b border-[#f0f1f3] px-4 py-3 text-sm last:border-0">
              <span className="w-[170px] flex-none text-[#6b7280]">{k}</span>
              <b className={`flex-1 font-semibold ${v ? "" : "font-normal text-[#9ca3af]"}`}>{v || "Not provided"}</b>
              <button type="button" className="text-[13px] font-semibold text-[#1e2a4a] underline underline-offset-2" onClick={() => { setFull(n); go(n); }}>Edit</button>
            </div>
          ))}
        </div>
      ) },
  };
  useFocusNeeded(cardRef, `${cur.id}:${full ?? ""}`);
  const q = cur.id === "name" ? { ...Q.name!, body: Q.nameBody!.body } : Q[cur.id]!;

  return (
    <div className="-m-4 min-h-[calc(100vh-54px)] bg-[#f5f6f8] text-[15px] text-[#111827] md:-m-6" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <div className="flex h-14 items-center gap-3 border-b border-[#e5e7eb] bg-white px-6">
        <span className="text-[14px] font-semibold">{title}</span>
        <span className="ml-auto text-[13px] text-[#9ca3af]">{justSaved ? "Saved just now" : "All changes saved"}</span>
      </div>
      <div className="mx-auto max-w-[680px] px-5 pb-16 pt-10">
        <div className="mb-2.5 flex items-baseline justify-between text-[13px] text-[#6b7280]">
          <b className="font-semibold text-[#111827]">{SECTIONS[cur.sec]}</b>
          <span>Step {pos + 1} of {shown.length}</span>
        </div>
        <div className="mb-8 h-1 overflow-hidden rounded-full bg-[#e5e7eb]">
          <i className="block h-full bg-[#1e2a4a] transition-[width] duration-300" style={{ width: `${((pos + 1) / shown.length) * 100}%` }} />
        </div>
        <div className="rounded-[14px] border border-[#e5e7eb] bg-white px-6 pb-7 pt-8 sm:px-9 sm:pt-9">
          <div key={cur.id} ref={cardRef} className="animate-in fade-in slide-in-from-bottom-1 duration-200">
            <h2 className="mb-1.5 text-2xl font-bold leading-snug tracking-[-0.015em]">{q.t}</h2>
            {q.h && <p className="mb-6 text-[14.5px] leading-relaxed text-[#6b7280]">{q.h}</p>}
            {!q.h && <div className="mb-6" />}
            {q.body}
          </div>
          <div className="mt-8 flex items-center gap-2.5">
            <button type="button" onClick={back}
              className="rounded-[10px] border border-[#e5e7eb] bg-white px-[18px] py-[11px] font-semibold text-[#374151]">{pos === 0 && full == null ? "Cancel" : "Back"}</button>
            {canSkip && (
              <button type="button" className="text-sm font-semibold text-[#6b7280]"
                onClick={() => { if (cur.id === "web") advance({ web: "" }); else advance(); }}>Skip</button>
            )}
            <div className="ml-auto flex items-center gap-2.5">
              {pos > 0 && (
                <button type="button" onClick={() => setConfirmExit(true)}
                  className="rounded-[10px] border border-[#e5e7eb] bg-white px-[18px] py-[11px] font-semibold text-[#374151]">Save &amp; exit</button>
              )}
              <button type="button" disabled={!valid[cur.id] || (cur.id === "web" && webState === "checking")}
                onClick={async () => {
                  if (cur.id === "review") return onFinish(d);
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
                className="rounded-[10px] bg-[#1e2a4a] px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#c9ced9]">
                {cur.id === "review" ? "Continue to auto-fill" : cur.id === "web" && webState === "checking" ? "Checking…" : full != null ? "Back to review" : "Continue"}

              </button>
            </div>
          </div>
        </div>
        {confirmExit && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(17,24,39,.45)] p-4" onClick={() => setConfirmExit(false)}>
            <div role="dialog" aria-modal="true" className="w-full max-w-[400px] rounded-[14px] bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold">Save and finish later?</h3>
              <p className="mt-1 text-[14px] text-[#6b7280]">Your answers are saved. You can continue setup from My Business.</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#e5e7eb]">
                <i className="block h-full bg-[#1e2a4a]" style={{ width: `${Math.round((sellerProgress(d, fromSignup).n / sellerProgress(d, fromSignup).N) * 100)}%` }} />
              </div>
              <p className="mt-2 text-[13px] text-[#6b7280]">{sellerProgress(d, fromSignup).n} of {sellerProgress(d, fromSignup).N} questions answered</p>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setConfirmExit(false)} className="rounded-[10px] border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-semibold text-[#374151]">Keep going</button>
                <button type="button" onClick={() => { store(d); onExit(); }} className="rounded-[10px] bg-[#1e2a4a] px-4 py-2.5 text-sm font-semibold text-white">Save &amp; exit</button>
              </div>
            </div>
          </div>
        )}
        <p className="mt-[18px] text-center text-[12.5px] text-[#9ca3af]">Your company name, address, website and exact figures stay private until you approve a buyer's NDA.</p>
      </div>
    </div>
  );
}
