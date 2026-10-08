import { EditSec, useOpenAtSection } from "@/components/common/edit-section";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Check, Plus, Trash2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ServiceTiles, useMyAdvisorFirms, ADVISOR_FIRMS_KEY } from "@/components/advisor/advisor-my-company";
import { AddressBox, FeeControl, LogoRow, addrErrors, logoFileError, useLogoUpload, type Addr, type LogoState } from "@/components/advisor/advisor-firm-fields";
import { createAdvisorUploadUrl, saveAdvisorFirm } from "@/lib/advisor-firm.functions";
import {
  DEAL_BANDS, FIRM_TYPES, LANGUAGES, cityError, dealBandLabels, descError, emailError, feeWords, firmChecklist, mergeServiceOrder, nameError,
  newFee, phoneError, teamSizeError, webError, type AdvisorFirm, type EditSection, type FeeDetail,
} from "@/lib/advisor-firm";
import { COUNTRIES, THAI_PROVINCES_77, yearError } from "@/lib/investor-bands";
import { normalizeUrl } from "@/lib/seller-wizard";
import { SetSectorPicker } from "@/components/common/set-sector-picker";
import { cn } from "@/lib/utils";

export type FirmForm = {
  name: string; firmType: string; logo: LogoState; description: string; yearFounded: string;
  city: string; country: string; services: string[]; fees: Record<string, FeeDetail>;
  dealBand: string; teamSize: string; languages: string[]; sectors: string[]; sectorAgnostic: boolean;
  legalName: string; thaiName: string; registrationNo: string; addr: Addr;
  website: string; email: string; phone: string;
  team: { id?: string; name: string; role: string; email: string }[];
  credentials: { id?: string; name: string; note: string; status?: string }[];
  documents: { id?: string; path: string; name: string; type: string; checked?: boolean }[];
};
export type SourceTag = "Your answer" | "Auto Enrich" | "Company registry";
export type SetupMode = {
  sources: Partial<Record<keyof FirmForm | "addr", SourceTag>>;
  onBack: () => void;
  onChangeServices: () => void;
  onSaved: (msg: string) => void;
  onDirty: (f: FirmForm | null) => void;
};

export const toFirmForm = (f: AdvisorFirm | null): FirmForm => ({
  name: f?.name ?? "", firmType: f?.firmType ?? "",
  logo: { path: f?.logoPath ?? null, url: f?.logoUrl ?? null, name: null, sizeKb: null, source: f?.logoSource ?? null },
  description: f?.description ?? "", yearFounded: f?.yearFounded ? String(f.yearFounded) : "",
  city: f?.city ?? "", country: f?.country ?? "Thailand", services: f?.services ?? [],
  fees: Object.fromEntries((f?.services ?? []).map((s) => [s, f?.feeDetails[s] ?? newFee()])),
  dealBand: f?.dealBand ?? "", teamSize: f?.teamSize ? String(f.teamSize) : "", languages: f?.languages ?? [], sectors: f?.sectors ?? [], sectorAgnostic: !!f?.sectorAgnostic,
  legalName: f?.legalName ?? "", thaiName: f?.thaiName ?? "", registrationNo: f?.registrationNo ?? "",
  addr: { street: f?.addrStreet ?? "", unit: f?.addrUnit ?? "", district: f?.country === "Thailand" ? f?.addrDistrict ?? "" : "", province: f?.addrProvince ?? "", postal: f?.addrPostal ?? "" },
  website: f?.website ?? "", email: f?.email ?? "", phone: f?.phone ?? "",
  team: (f?.team ?? []).map((t) => ({ id: t.id, name: t.name, role: t.role ?? "", email: t.email ?? "" })),
  credentials: (f?.credentials ?? []).map((c) => ({ id: c.id, name: c.name, note: c.note ?? "", status: c.status })),
  documents: (f?.documents ?? []).map((d) => ({ id: d.id, path: d.path, name: d.name, type: d.type ?? "", checked: !!d.checkedAt })),
});

const extOf = (n: string) => (n.split(".").pop() ?? "").toLowerCase();

export function AdvisorFirmEdit({ firmId, section }: { firmId: string | null; section?: EditSection }) {
  const { data, isLoading } = useMyAdvisorFirms();
  const firm = firmId ? data?.find((f) => f.id === firmId) ?? null : null;
  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-[600px]" /></div>;
  if (firmId && !firm) return <p className="text-sm text-muted-foreground">This firm profile wasn't found.</p>;
  return <FirmEditForm key={firm?.id ?? "new"} firm={firm} section={section} />;
}

function Section({ id, title, action, setup, active, children }: { id: EditSection; title: string; action?: React.ReactNode; setup?: boolean; active?: boolean; children: React.ReactNode }) {
  return (
    <section id={`sec-${id}`} className="scroll-mt-6 rounded-[14px] border border-border bg-card p-5 shadow-card">
      <EditSec id={id} tone="buyer" active={active}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className={setup ? "text-[11px] font-bold uppercase tracking-[.07em] text-[#6B7280]" : "text-[16px] font-semibold"}>{title}</h2>
          {action}
        </div>
        <div className="space-y-4">{children}</div>
      </EditSec>
    </section>
  );
}
function Tag({ t }: { t?: SourceTag }) {
  if (!t) return null;
  return (
    <span className={cn("ml-1.5 inline-flex h-[18px] items-center rounded-[5px] border px-1.5 align-[1px] text-[10.5px] font-semibold",
      t === "Your answer" ? "border-[#D5DAE6] bg-[#F4F6FA] text-[#1E2A4A]" : "border-[#BBE8CA] bg-[#E9F6EE] text-[#15803D]")}>{t}</span>
  );
}
function F({ label, req, opt, hint, err, tag, children, className, htmlFor }: {
  label: string; req?: boolean; opt?: boolean; hint?: React.ReactNode; err?: string | null; tag?: SourceTag; children: React.ReactNode; className?: string; htmlFor?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {req && <span aria-hidden className="relative -top-0.5 ml-[3px] text-[12px] font-semibold text-[#B42318]">*</span>}
        {opt && <span className="ml-1.5 font-normal text-[#9CA3AF]">optional</span>}
        <Tag t={tag} />
      </Label>
      {children}
      {err ? <p className="text-[12.5px] text-[#B42318]">{err}</p> : hint ? <p className="text-[12px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}


const sel = "flex h-[42px] w-full rounded-md border border-input bg-background px-3 pr-8 text-[14px] outline-none focus:border-[#1E2A4A]";
const errB = "border-[#B42318]";

export function FirmEditForm({ firm, section, setup, initial, onDone }: { firm: AdvisorFirm | null; section?: EditSection; setup?: SetupMode; initial?: FirmForm | null; onDone?: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const save = useServerFn(saveAdvisorFirm);
  const upload = useServerFn(createAdvisorUploadUrl);
  const uploadLogo = useLogoUpload();
  const base = useRef(toFirmForm(firm));
  const [f, setF] = useState<FirmForm>(() => initial ?? base.current);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoErr, setLogoErr] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [forced, setForced] = useState(false);
  const docInput = useRef<HTMLInputElement>(null);
  const set = <K extends keyof FirmForm>(k: K, v: FirmForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const back = () => (onDone ? onDone() : navigate({ to: "/marketplace/my-company", search: firm ? ({ open: firm.id } as never) : undefined }));
  const thai = f.country === "Thailand";
  const src = setup?.sources ?? {};

  useEffect(() => { setup?.onDirty(JSON.stringify(f) === JSON.stringify(base.current) ? null : f); }, [f]); // eslint-disable-line react-hooks/exhaustive-deps

  useOpenAtSection(section && section !== "firm" ? section : undefined);

  async function onLogo(file: File) {
    const e = logoFileError(file);
    setLogoErr(e);
    if (e) return;
    setUploading(true);
    try { const r = await uploadLogo(file); set("logo", { path: r.path, url: r.url, name: file.name, sizeKb: Math.max(1, Math.round(file.size / 1024)), source: "upload" }); }
    catch (er) { toast.error((er as Error).message); } finally { setUploading(false); }
  }
  async function onDoc(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const ext = extOf(file.name);
      const { path, url } = await upload({ data: { kind: "doc", ext } });
      const res = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream", "x-upsert": "false" } });
      if (!res.ok) throw new Error("Upload failed.");
      setF((p) => ({ ...p, documents: [...p.documents, { path, name: file.name.replace(/\.[^.]+$/, ""), type: ext === "pdf" ? "PDF" : ext.startsWith("doc") ? "DOCX" : "Image" }] }));
    } catch (e) { toast.error((e as Error).message); } finally { setUploading(false); }
  }

  // Save checks, in order.
  const errs: [string, string | null][] = [
    ["name", nameError(f.name)],
    ["city", cityError(f.city, f.country)],
    ["year", yearError(f.yearFounded)],
    ["desc", descError(f.description)],
    ["teamSize", teamSizeError(f.teamSize)],
    ["legalName", f.legalName.trim() ? null : "Add your firm's legal name."],
    ["reg", thai && !/^\d{13}$/.test(f.registrationNo) ? "The registration number has 13 digits." : null],
    ["web", webError(f.website)],
    ["email", emailError(f.email)],
    ["phone", phoneError(f.phone)],
  ];
  const errOf = Object.fromEntries(errs) as Record<string, string | null>;
  const show = (k: string) => ((touched[k] || forced) ? errOf[k] : null);
  const blur = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));
  const addrErr = addrErrors(f.addr, thai, f.city);
  const showAddr = (k: keyof Addr) => (touched[`a-${k}`] ? (addrErr as Record<string, string | null>)[k] ?? null : null);
  const firstBad = errs.find(([, e]) => e)?.[0];

  const changeCountry = (c: string) => setF((p) => ({ ...p, country: c, city: "", registrationNo: "", addr: { street: "", unit: "", district: "", province: "", postal: "" } }));

  async function submit() {
    if (!f.services.length) { toast.error("Pick at least one service."); return; }
    if (firstBad) {
      setForced(true);
      setTimeout(() => (document.getElementById(`fe-${firstBad}`) as HTMLElement | null)?.focus(), 0);
      return;
    }
    setBusy(true);
    try {
      const nul = (v: string) => (v.trim() ? v.trim() : null);
      await save({
        data: {
          id: firm?.id ?? null, name: f.name.trim(), firmType: f.firmType || "Other", logoPath: f.logo.path, logoSource: f.logo.source,
          description: f.description.trim(), yearFounded: Number(f.yearFounded), city: f.city.trim(), country: f.country,
          services: f.services, fees: Object.fromEntries(f.services.map((s) => [s, f.fees[s] ?? newFee()])),
          dealBand: f.dealBand || null, teamSize: Number(f.teamSize), languages: f.languages, sectors: f.sectors, sectorAgnostic: f.sectorAgnostic,
          legalName: f.legalName.trim(), thaiName: nul(f.thaiName), registrationNo: nul(f.registrationNo),
          addrStreet: nul(f.addr.street), addrUnit: nul(f.addr.unit), addrDistrict: thai ? nul(f.addr.district) : nul(f.city),
          addrProvince: nul(f.addr.province), addrPostal: nul(f.addr.postal),
          website: normalizeUrl(f.website), email: f.email.trim(), phone: f.phone.trim(),
          team: f.team.filter((t) => t.name.trim()).map((t) => ({ id: t.id, name: t.name, role: nul(t.role), email: nul(t.email) })),
          credentials: f.credentials.filter((c) => c.name.trim()).map((c) => ({ id: c.id, name: c.name, note: nul(c.note) })),
          documents: f.documents.map((d) => ({ id: d.id, path: d.path, name: d.name || "Document", type: nul(d.type) })),
        },
      });
      await qc.invalidateQueries({ queryKey: ADVISOR_FIRMS_KEY });
      const fresh = qc.getQueryData<AdvisorFirm[]>(ADVISOR_FIRMS_KEY)?.find((x) => x.id === firm?.id);
      const complete = fresh ? firmChecklist(fresh).every((i) => i.done) : false;
      const msg = complete ? "Profile saved as a draft. Publish it when you're ready." : "Profile saved as a draft. Finish the checklist to publish.";
      base.current = f;
      if (setup) { setup.onDirty(null); setup.onSaved(msg); return; }
      toast.success(firm?.setupDoneAt || firm?.status !== "draft" ? "Profile saved." : msg);
      back();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  const toggleService = (s: string) => setF((p) => {
    const on = p.services.includes(s);
    const services = on ? p.services.filter((x) => x !== s) : mergeServiceOrder(p.services, [...p.services, s]);
    const fees = { ...p.fees };
    if (!on && !fees[s]) fees[s] = firm?.feeDetails[s] ?? newFee();
    return { ...p, services, fees };
  });
  const deal = dealBandLabels(f.dealBand);
  const inp = "h-[42px] text-[14px]";

  return (
    <div className={cn("mx-auto space-y-5", setup ? "max-w-[880px] pb-8" : "max-w-[920px] pb-24")}>
      {!setup && (
        <div>
          <button type="button" onClick={back} className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> {onDone ? "Advisors Directory" : "My Company"}</button>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{firm ? "Edit profile" : "Add Firm Profile"}</h1>
          <p className="text-sm text-muted-foreground">{firm ? `${firm.refNo} · everything here is open to sellers and buyers.` : "A new profile starts as a Draft."}</p>
        </div>
      )}

      <Section id="firm" active={false} title="Firm" setup={!!setup}>
        <F label="Logo" opt tag={f.logo.url ? (f.logo.source === "enrich" ? "Auto Enrich" : src.logo) : undefined}>
          <LogoRow logo={f.logo} busy={uploading} error={logoErr} onFile={onLogo} onRemove={() => set("logo", { path: null, url: null, name: null, sizeKb: null, source: null })} />
        </F>
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Firm name" req tag={src.name} err={show("name")} htmlFor="fe-name"><Input id="fe-name" aria-required className={cn(inp, show("name") && errB)} maxLength={80} value={f.name} onBlur={blur("name")} onChange={(e) => set("name", e.target.value)} /></F>
          <F label="Firm type" req tag={src.firmType}>
            <select aria-required className={sel} value={f.firmType} onChange={(e) => set("firmType", e.target.value)}>
              <option value="" disabled>Select type</option>
              {FIRM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </F>
          <F label="Country" req tag={src.country}>
            <select aria-required className={sel} value={COUNTRIES.includes(f.country) ? f.country : "Other"} onChange={(e) => changeCountry(e.target.value)}>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </F>
          <F label={thai ? "City / province" : "City"} req tag={src.city} err={show("city")} htmlFor="fe-city">
            {thai ? (
              <select id="fe-city" aria-required className={cn(sel, show("city") && errB)} value={f.city} onBlur={blur("city")}
                onChange={(e) => setF((p) => ({ ...p, city: e.target.value, addr: { ...p.addr, province: p.addr.province || e.target.value } }))}>
                <option value="">Choose a province</option>
                {THAI_PROVINCES_77.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            ) : <Input id="fe-city" aria-required className={cn(inp, show("city") && errB)} maxLength={80} placeholder="e.g. Singapore" value={f.city} onBlur={blur("city")} onChange={(e) => set("city", e.target.value)} />}
          </F>
          <F label="Year founded" req tag={src.yearFounded} err={show("year")} htmlFor="fe-year">
            <Input id="fe-year" aria-required className={cn(inp, show("year") && errB)} inputMode="numeric" maxLength={4} placeholder="e.g. 2014" value={f.yearFounded} onBlur={blur("year")} onChange={(e) => set("yearFounded", e.target.value.replace(/\D/g, "").slice(0, 4))} />
          </F>
        </div>
        <F label="Description" req tag={f.description.trim() ? src.description : undefined} err={show("desc")} hint={`${f.description.length} / 300 · your card shows 3 lines`} htmlFor="fe-desc">
          <Textarea id="fe-desc" aria-required className={cn("text-[14px]", show("desc") && errB)} maxLength={300} rows={4} value={f.description} onBlur={blur("desc")} onChange={(e) => set("description", e.target.value)} />
        </F>
      </Section>

      <Section id="services" active={!setup && section === "services"} title="Services and fees" setup={!!setup}
        action={setup ? <button type="button" onClick={setup.onChangeServices} className="text-[13px] font-semibold text-[#1E2A4A] hover:underline dark:text-foreground">Change services</button> : undefined}>
        {!setup && <ServiceTiles picked={f.services} onToggle={toggleService} />}
        {f.services.length === 0 && <p className="text-[13px] font-semibold text-[#B42318]">Pick at least one service.</p>}
        {f.services.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {f.services.map((s) => (
              <F key={s} label={`${s} · fee`} tag={src.fees && feeWords(f.fees[s] ?? newFee()) ? src.fees : undefined}>
                <FeeControl service={s} value={f.fees[s] ?? newFee()} showErr={!!touched[`fee-${s}`]} onBlurAll={blur(`fee-${s}`)}
                  onChange={(v) => set("fees", { ...f.fees, [s]: v })} />
              </F>
            ))}
          </div>
        )}
      </Section>

      <Section id="work" active={!setup && section === "work"} title="Work" setup={!!setup}>
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Typical deal size" opt tag={f.dealBand ? src.dealBand : undefined} hint={deal ? <>Your card shows <b>{deal.usd}</b> ({deal.thb}).</> : undefined}>
            <select className={sel} value={f.dealBand} onChange={(e) => set("dealBand", e.target.value)}>
              <option value="">Choose a range</option>
              {DEAL_BANDS.map((b) => <option key={b.key} value={b.key}>{dealBandLabels(b.key)!.full}</option>)}
            </select>
          </F>
          <F label="Team size" req tag={src.teamSize} err={show("teamSize")} htmlFor="fe-teamSize">
            <Input id="fe-teamSize" aria-required className={cn(inp, show("teamSize") && errB)} inputMode="numeric" maxLength={5} placeholder="e.g. 8" value={f.teamSize} onBlur={blur("teamSize")} onChange={(e) => set("teamSize", e.target.value.replace(/\D/g, "").slice(0, 5))} />
          </F>
        </div>
        <F label="Languages" tag={f.languages.length ? src.languages : undefined}>
          <div className="flex flex-wrap gap-1.5">
            {LANGUAGES.map((l) => {
              const on = f.languages.includes(l);
              return (
                <button key={l} type="button" aria-pressed={on} onClick={() => set("languages", on ? f.languages.filter((x) => x !== l) : [...f.languages, l])}
                  className={cn("inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[13px]", on ? "border-[#1E2A4A] bg-[#F4F6FA] font-semibold text-[#1E2A4A] dark:bg-muted dark:text-foreground" : "border-border hover:bg-muted")}>
                  {on && <Check className="h-3.5 w-3.5" />}{l}
                </button>
              );
            })}
          </div>
        </F>
        <F label="Sectors" opt><SetSectorPicker mode="multi" value={f.sectors} onChange={(v) => set("sectors", v)}
          limitMsg="Pick up to 5 sectors, or Sector agnostic."
          agnostic={{ on: f.sectorAgnostic, onToggle: (on) => set("sectorAgnostic", on), line: "I work with companies in every industry",
            summary: <>Sellers and buyers see <b className="text-foreground">Sector agnostic</b> on your card.</> }} /></F>
      </Section>

      <Section id="company" active={!setup && section === "company"} title="Company" setup={!!setup}>
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Legal name" req tag={f.legalName ? src.legalName : undefined} err={show("legalName")} htmlFor="fe-legalName"
            hint={firm?.verifiedAt ? "Changing this sends your firm back to Admin for a check." : undefined}>
            <Input id="fe-legalName" aria-required className={cn(inp, show("legalName") && errB)} maxLength={200} placeholder="e.g. Acme Advisory Co., Ltd." value={f.legalName} onBlur={blur("legalName")} onChange={(e) => set("legalName", e.target.value)} />
          </F>
          <F label="Thai name" opt={!thai} tag={f.thaiName ? src.thaiName : undefined}><Input className={inp} maxLength={200} placeholder="บริษัท … จำกัด" value={f.thaiName} onChange={(e) => set("thaiName", e.target.value)} /></F>
          <F label={thai ? "Registration no. (เลขทะเบียนนิติบุคคล)" : "Registration no."} req={thai} opt={!thai} tag={f.registrationNo ? src.registrationNo : undefined} err={show("reg")} htmlFor="fe-reg">
            <Input id="fe-reg" aria-required={thai} inputMode={thai ? "numeric" : undefined} maxLength={thai ? 13 : 50} placeholder={thai ? "13 digits" : undefined}
              className={cn(inp, thai && "border-[#93C5FD] bg-[#EFF6FF] dark:border-[#1E40AF] dark:bg-[#172554]", show("reg") && errB)}
              value={f.registrationNo} onBlur={blur("reg")} onChange={(e) => set("registrationNo", thai ? e.target.value.replace(/\D/g, "").slice(0, 13) : e.target.value.slice(0, 50))} />
          </F>
          <F label="Website" req tag={src.website} err={show("web")} htmlFor="fe-web"><Input id="fe-web" aria-required className={cn(inp, show("web") && errB)} maxLength={200} placeholder="https://www.yourfirm.com" value={f.website} onBlur={blur("web")} onChange={(e) => set("website", e.target.value)} /></F>
          <F label="Email" req tag={src.email} err={show("email")} htmlFor="fe-email"><Input id="fe-email" aria-required type="email" className={cn(inp, show("email") && errB)} maxLength={120} placeholder="hello@yourfirm.com" value={f.email} onBlur={blur("email")} onChange={(e) => set("email", e.target.value)} /></F>
          <F label="Phone" req tag={src.phone} err={show("phone")} htmlFor="fe-phone"><Input id="fe-phone" aria-required className={cn(inp, show("phone") && errB)} maxLength={30} placeholder="+66 2 123 4567" value={f.phone} onBlur={blur("phone")} onChange={(e) => set("phone", e.target.value)} /></F>
        </div>
        <div>
          <AddressBox compact a={f.addr} thai={thai} city={f.city} onCity={(v) => set("city", v)} note="Sellers and buyers see it as a link that opens a map."
            onChange={(p) => set("addr", { ...f.addr, ...p })} show={showAddr} onBlur={(k) => setTouched((t) => ({ ...t, [`a-${k}`]: true }))} />
          {src.addr && f.addr.street && <div className="mt-1.5"><Tag t={src.addr} /></div>}
        </div>
      </Section>

      <Section id="team" active={!setup && section === "team"} title="Team" setup={!!setup}>
        {f.team.map((t, i) => (
          <div key={i} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <F label="Name" req><Input className={inp} value={t.name} onChange={(e) => set("team", f.team.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></F>
            <F label="Role"><Input className={inp} placeholder="Role, e.g. Partner · M&A" value={t.role} onChange={(e) => set("team", f.team.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))} /></F>
            <F label="Work email"><Input className={inp} value={t.email} onChange={(e) => set("team", f.team.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} /></F>
            <Button type="button" variant="ghost" size="icon" aria-label="Remove person" onClick={() => set("team", f.team.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => set("team", [...f.team, { name: "", role: "", email: "" }])}><Plus className="mr-1.5 h-4 w-4" /> Add person</Button>
        {setup && <p className="text-[12px] text-muted-foreground">You're added from your account. Add the people sellers and buyers will work with.</p>}
      </Section>

      <Section id="credentials" active={!setup && section === "credentials"} title="Licences and credentials" setup={!!setup}>
        {f.credentials.length === 0 && <p className="text-[13px] text-muted-foreground">No licences or credentials yet. Add the ones your firm holds; Admin checks each one before it shows as Verified.</p>}
        {f.credentials.map((c, i) => (
          <div key={i} className="grid items-end gap-3 sm:grid-cols-[1fr_1.4fr_auto_auto]">
            <F label="Licence or credential" req><Input className={inp} placeholder="e.g. Financial advisor licence" value={c.name} onChange={(e) => set("credentials", f.credentials.map((x, j) => (j === i ? { ...x, name: e.target.value, status: "pending" } : x)))} /></F>
            <F label="Note"><Input className={inp} placeholder="Note, e.g. 2 licensed advisers on the team" value={c.note} onChange={(e) => set("credentials", f.credentials.map((x, j) => (j === i ? { ...x, note: e.target.value, status: "pending" } : x)))} /></F>
            <span className={cn("mb-2 rounded-full border px-2 py-0.5 text-[11.5px] font-semibold", c.status === "verified" ? "border-[#BBF7D0] bg-[#ECFDF3] text-[#15803D]" : "border-[#F3D9A6] bg-[#FFF4E0] text-[#8A5A06]")}>
              {c.status === "verified" ? "✓ Verified" : "Pending check"}
            </span>
            <Button type="button" variant="ghost" size="icon" aria-label="Remove credential" onClick={() => set("credentials", f.credentials.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => set("credentials", [...f.credentials, { name: "", note: "", status: "pending" }])}><Plus className="mr-1.5 h-4 w-4" /> Add licence or credential</Button>
      </Section>

      <Section id="documents" active={!setup && section === "documents"} title="Documents" setup={!!setup}>
        {f.documents.length === 0 && <p className="text-[13px] text-muted-foreground">No documents yet. Upload your company certificate and licences: PDF, DOCX or an image.</p>}
        {f.documents.map((d, i) => (
          <div key={d.id ?? d.path} className="grid items-end gap-3 sm:grid-cols-[1.4fr_auto_auto]">
            <F label={`Name · ${d.type || "File"}`}><Input className={inp} value={d.name} onChange={(e) => set("documents", f.documents.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></F>
            <span className={cn("mb-2 rounded-full border px-2 py-0.5 text-[11.5px] font-semibold", d.checked ? "border-[#BBF7D0] bg-[#ECFDF3] text-[#15803D]" : "border-border bg-muted text-muted-foreground")}>{d.checked ? "✓ Checked" : "Not checked yet"}</span>
            <Button type="button" variant="ghost" size="icon" aria-label="Remove document" onClick={() => set("documents", f.documents.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <input ref={docInput} type="file" accept=".pdf,.docx,.doc,image/*" className="hidden" onChange={(e) => { onDoc(e.target.files?.[0]); e.target.value = ""; }} />
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => docInput.current?.click()}><Upload className="mr-1.5 h-4 w-4" /> Upload a document</Button>
      </Section>

      <div className="sticky bottom-0 z-10 -mx-1 flex items-center justify-between gap-3 rounded-[12px] border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
        {setup ? (
          <>
            <Button variant="outline" className="h-11" onClick={setup.onBack}>Back to answers</Button>
            <Button disabled={busy || uploading} onClick={submit} className="h-11 bg-[#1E2A4A] text-white hover:bg-[#1E2A4A]/90">Save profile</Button>
          </>
        ) : (
          <>
            <span className="text-[13px] text-muted-foreground">{firstBad ? "Check the fields marked in red before saving." : "Ready to save."}</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={back}>Cancel</Button>
              <Button disabled={busy || uploading} onClick={submit} className="bg-accent text-accent-foreground hover:bg-accent/90">Save changes</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
