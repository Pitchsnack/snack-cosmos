import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { SectorPicker } from "@/components/startups/sector-fields";
import { businessModelLabel } from "@/lib/sectors";
import {
  SELLER_RELATIONS, THAI_PROVINCES, THB_REVENUE_BANDS, WIZARD_ISO, WIZARD_LICENCES, WIZARD_SIZES,
  isValidUrl, saveDraft, type SellerDraft,
} from "@/lib/seller-wizard";

void businessModelLabel;

const SECTIONS = ["About you", "About the company", "Financial & business profile", "Intangible assets", "Review"];
const STEPS = [
  { id: "role", sec: 0 },
  { id: "name", sec: 1 },
  { id: "web", sec: 1 },
  { id: "year", sec: 1 },
  { id: "loc", sec: 1 },
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

export function SellerWizard({
  userId, initial, onExit, onFinish,
}: {
  userId: string;
  initial: SellerDraft;
  onExit: () => void;
  onFinish: (d: SellerDraft) => void;
}) {
  const [d, setD] = useState<SellerDraft>(initial);
  const [otherLic, setOtherLic] = useState("");
  const [otherIso, setOtherIso] = useState("");
  const [saved, setSaved] = useState(false);
  const timer = useRef<number | null>(null);
  const step = Math.min(d.step, STEPS.length - 1);
  const cur = STEPS[step]!;

  // Autosave on every answer.
  useEffect(() => {
    saveDraft(userId, d);
    setSaved(true);
  }, [d, userId]);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const set = (patch: Partial<SellerDraft>) => setD((p) => ({ ...p, ...patch }));
  const go = (n: number) => set({ step: Math.max(0, Math.min(STEPS.length - 1, n)) });
  const pick = (patch: Partial<SellerDraft>) => {
    set(patch);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setD((p) => ({ ...p, step: Math.min(STEPS.length - 1, p.step + 1) })), 250);
  };

  const yearN = Number(d.year);
  const valid: Record<string, boolean> = {
    role: !!d.role,
    name: d.name.trim().length > 0 && /^\d{13}$/.test(d.reg),
    web: isValidUrl(d.web),
    year: /^\d{4}$/.test(d.year) && yearN >= 1800 && yearN <= THIS_YEAR,
    loc: !!d.city,
    rev: !!d.rev,
    size: !!d.size,
    sector: !!d.sector,
    lic: true,
    review: true,
  };
  const canSkip = cur.id === "web" || cur.id === "lic";

  const Radio = ({ list, value, onPick, grid }: {
    list: { value: string; label: string; hint?: string }[]; value: string | null; onPick: (v: string) => void; grid?: boolean;
  }) => (
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

  const Check = ({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) => (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-2.5 rounded-[9px] border px-3 py-2.5 text-left text-[13.5px] ${on ? "border-[#1e2a4a] bg-[#eef1f7] text-[#111827]" : "border-[#e5e7eb] bg-white text-[#374151] hover:border-[#c5cbd8]"}`}>
      <span className={`grid h-4 w-4 flex-none place-items-center rounded border-[1.5px] text-[10px] text-white ${on ? "border-[#1e2a4a] bg-[#1e2a4a]" : "border-[#c5cbd8]"}`}>{on ? "✓" : ""}</span>
      {label}
    </button>
  );

  const allLic = [...WIZARD_LICENCES, ...d.licences.filter((l) => !WIZARD_LICENCES.some((w) => w.name === l.name))];
  const allIso = [...WIZARD_ISO, ...d.iso.filter((s) => !WIZARD_ISO.includes(s))];

  const Q: Record<string, { t: string; h?: string; body: React.ReactNode }> = {
    role: { t: "Which best describes you?", h: "This determines who approves buyer requests for this listing.",
      body: <Radio list={SELLER_RELATIONS} value={d.role} onPick={(v) => pick({ role: v as SellerDraft["role"] })} /> },
    name: { t: "What is the name of your company?", h: "Use the registered company name.",
      body: (
        <div className="space-y-4">
          <div><label className={fieldLbl}>Company name</label>
            <input className={inp} value={d.name} maxLength={255} autoFocus onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Siam Foods Co., Ltd." /></div>
          <div><label className={fieldLbl}>Company Registration Number (เลขทะเบียนนิติบุคคล)</label>
            <input className={inp} inputMode="numeric" value={d.reg} maxLength={13}
              onChange={(e) => set({ reg: e.target.value.replace(/\D/g, "").slice(0, 13) })} placeholder="13 digits" />
            <p className="mt-1.5 text-[13px] text-[#6b7280]">Used to verify your company.{d.reg && d.reg.length !== 13 ? ` ${d.reg.length}/13 digits.` : ""}</p></div>
          <p className="flex items-start gap-2 text-[13px] text-destructive"><Lock className="mt-0.5 h-3.5 w-3.5" />Your company identity stays confidential until you approve the buyer's NDA.</p>
        </div>
      ) },
    web: { t: "What is your company website?", h: "We use it to auto-fill your profile. You can skip this.",
      body: <div><input className={inp} value={d.web} autoFocus onChange={(e) => set({ web: e.target.value })} placeholder="https://yourcompany.co.th" />
        {d.web.trim() && !valid.web && <p className="mt-1.5 text-[13px] text-destructive">Enter a valid web address, or click Skip.</p>}</div> },
    year: { t: "What year was the company founded?",
      body: <div><input className={`${inp} max-w-[200px]`} inputMode="numeric" value={d.year} maxLength={4} autoFocus
        onChange={(e) => set({ year: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder={`e.g. ${THIS_YEAR - 10}`} />
        {d.year.length === 4 && !valid.year && <p className="mt-1.5 text-[13px] text-destructive">Enter a year between 1800 and {THIS_YEAR}.</p>}</div> },
    loc: { t: "Where is the company located?",
      body: (
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={fieldLbl}>Country</label>
            <div className="flex items-center justify-between rounded-[10px] border border-[#e5e7eb] bg-[#f9fafb] px-3.5 py-3 text-[#374151]">Thailand <span className="text-xs text-[#9ca3af]">Fixed</span></div></div>
          <div><label className={fieldLbl}>City / province</label>
            <select className={inp} value={d.city} onChange={(e) => set({ city: e.target.value })}>
              <option value="">Select…</option>
              {THAI_PROVINCES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select></div>
        </div>
      ) },
    rev: { t: "What was your company's revenue last year?", h: "An approximate band is enough. Exact figures stay private.",
      body: <Radio list={THB_REVENUE_BANDS.map((b) => ({ value: b, label: b }))} value={d.rev} onPick={(v) => pick({ rev: v })} /> },
    size: { t: "What is the size of your company?", h: "Number of employees.",
      body: <Radio grid list={WIZARD_SIZES} value={d.size} onPick={(v) => pick({ size: v })} /> },
    sector: { t: "What is your business sector?", h: "Based on the SET sector classification.",
      body: <SectorPicker value={d.sector} onChange={(v) => set({ sector: v })} /> },
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
            ["Website", d.web && valid.web ? d.web : "", 2],
            ["Year founded", d.year, 3],
            ["Location", d.city ? `${d.city}, Thailand` : "", 4],
            ["Revenue last year", d.rev, 5],
            ["Company size", WIZARD_SIZES.find((s) => s.value === d.size)?.label, 6],
            ["Sector", d.sector, 7],
            ["Licences & standards", [...d.licences.map((l) => l.name), ...d.iso].join(", "), 8],
          ] as [string, string | null | undefined, number][]).map(([k, v, n]) => (
            <div key={k} className="flex gap-3 border-b border-[#f0f1f3] px-4 py-3 text-sm last:border-0">
              <span className="w-[170px] flex-none text-[#6b7280]">{k}</span>
              <b className={`flex-1 font-semibold ${v ? "" : "font-normal text-[#9ca3af]"}`}>{v || "Not provided"}</b>
              <button type="button" className="text-[13px] font-semibold text-[#1e2a4a] underline underline-offset-2" onClick={() => go(n)}>Edit</button>
            </div>
          ))}
        </div>
      ) },
  };
  const q = Q[cur.id]!;

  return (
    <div className="-m-4 min-h-[calc(100vh-54px)] bg-[#f5f6f8] text-[15px] text-[#111827] md:-m-6" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <div className="flex h-14 items-center gap-3 border-b border-[#e5e7eb] bg-white px-6">
        <span className="text-[14px] font-semibold">Add my business</span>
        <span className="ml-auto text-[13px] text-[#9ca3af]">{saved ? "Draft saved" : ""}</span>
        <button type="button" onClick={onExit} className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-[7px] text-[13px] font-semibold text-[#374151]">Save &amp; exit</button>
      </div>
      <div className="mx-auto max-w-[680px] px-5 pb-16 pt-10">
        <div className="mb-2.5 flex items-baseline justify-between text-[13px] text-[#6b7280]">
          <b className="font-semibold text-[#111827]">{SECTIONS[cur.sec]}</b>
          <span>Step {step + 1} of {STEPS.length}</span>
        </div>
        <div className="mb-8 h-1 overflow-hidden rounded-full bg-[#e5e7eb]">
          <i className="block h-full bg-[#1e2a4a] transition-[width] duration-300" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
        <div className="rounded-[14px] border border-[#e5e7eb] bg-white px-6 pb-7 pt-8 sm:px-9 sm:pt-9">
          <div key={cur.id} className="animate-in fade-in slide-in-from-bottom-1 duration-200">
            <h2 className="mb-1.5 text-2xl font-bold leading-snug tracking-[-0.015em]">{q.t}</h2>
            {q.h && <p className="mb-6 text-[14.5px] leading-relaxed text-[#6b7280]">{q.h}</p>}
            {!q.h && <div className="mb-6" />}
            {q.body}
          </div>
          <div className="mt-8 flex items-center gap-2.5">
            <button type="button" disabled={step === 0} onClick={() => go(step - 1)}
              className="rounded-[10px] border border-[#e5e7eb] bg-white px-[18px] py-[11px] font-semibold text-[#374151] disabled:cursor-not-allowed disabled:border-[#eef0f3] disabled:text-[#c0c4cc]">Back</button>
            {canSkip && (
              <button type="button" className="text-sm font-semibold text-[#6b7280]"
                onClick={() => { if (cur.id === "web") set({ web: "", step: step + 1 }); else go(step + 1); }}>Skip</button>
            )}
            <button type="button" disabled={!valid[cur.id]}
              onClick={() => (cur.id === "review" ? onFinish(d) : go(step + 1))}
              className="ml-auto rounded-[10px] bg-[#1e2a4a] px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#c9ced9]">
              {cur.id === "review" ? "Continue to auto-fill" : "Continue"}
            </button>
          </div>
        </div>
        <p className="mt-[18px] text-center text-[12.5px] text-[#9ca3af]">Your company name, website and exact figures stay private until you approve a buyer's NDA.</p>
      </div>
    </div>
  );
}
