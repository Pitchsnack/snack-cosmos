import { tr } from "@/i18n/language";
import { LangTag, useTextLang } from "@/components/common/text-lang";
import { supabase } from "@/integrations/supabase/client";
import { AttachmentCard } from "@/components/startups/attachment-card";
import { EMPTY_SLOT, uploadPending, type EntityMediaState } from "@/components/media/entity-media-editor";
import { usePermissions, useSessionContext } from "@/hooks/use-session-context";
import { EditSec, useOpenAtSection } from "@/components/common/edit-section";
import { CompactFields, EditInfoFooter, EditInfoTabsSlot, TabHead, TabRow, useEditInfo } from "@/components/common/edit-info-popup";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Check, Globe, Pencil, Plus, Shield, Trash2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ServiceTiles, useMyAdvisorFirms, ADVISOR_FIRMS_KEY } from "@/components/advisor/advisor-my-company";
import { AddressBox, FeeControl, LogoRow, addrErrors, logoFileError, useLogoUpload, type Addr, type LogoState } from "@/components/advisor/advisor-firm-fields";
import { createAdvisorFirmForAdmin, createAdvisorUploadUrl, saveAdvisorFirm } from "@/lib/advisor-firm.functions";
import {
  DEAL_BANDS, FIRM_TYPES, LANGUAGES, cityError, dealBandLabels, descError, emailError, feeWords, firmChecklist, mergeServiceOrder, nameError,
  newFee, phoneError, teamSizeError, webError, type AdvisorFirm, type EditSection, type FeeDetail,
} from "@/lib/advisor-firm";
import { COUNTRIES, THAI_PROVINCES_77, yearError } from "@/lib/investor-bands";
import { normalizeUrl } from "@/lib/seller-wizard";
import { SetSectorPicker } from "@/components/common/set-sector-picker";
import { cn } from "@/lib/utils";

export type FirmForm = {
  name: string; firmType: string; logo: LogoState; media: EntityMediaState; description: string; descriptionTh: string; yearFounded: string;
  city: string; country: string; services: string[]; fees: Record<string, FeeDetail>;
  dealBand: string; teamSize: string; languages: string[]; sectors: string[]; sectorAgnostic: boolean;
  legalName: string; thaiName: string; registrationNo: string; addr: Addr;
  website: string; email: string; phone: string;
  team: { id?: string; name: string; role: string; roleTh?: string; email: string }[];
  credentials: { id?: string; name: string; nameTh?: string; note: string; noteTh?: string; status?: string }[];
  documents: { id?: string; path: string; name: string; type: string; checked?: boolean }[];
  /** One-step approval: the advisor's suggested listing name and headline. */
  suggestedListingName: string; suggestedHeadline: string;
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
  media: {
    logo: { ...EMPTY_SLOT, persistedPath: f?.logoPath ?? null, signedUrl: f?.logoUrl ?? null },
    slots: [1, 2, 3].map((n) => { const m = f?.media?.find((x) => x.slot === n); return { ...EMPTY_SLOT, persistedPath: m?.path ?? null, signedUrl: m?.url ?? null }; }) as EntityMediaState["slots"],
  },
  description: f?.description ?? "", descriptionTh: f?.descriptionTh ?? "", yearFounded: f?.yearFounded ? String(f.yearFounded) : "",
  city: f?.city ?? "", country: f?.country ?? "Thailand", services: f?.services ?? [],
  fees: Object.fromEntries((f?.services ?? []).map((s) => [s, f?.feeDetails[s] ?? newFee()])),
  dealBand: f?.dealBand ?? "", teamSize: f?.teamSize ? String(f.teamSize) : "", languages: f?.languages ?? [], sectors: f?.sectors ?? [], sectorAgnostic: !!f?.sectorAgnostic,
  legalName: f?.legalName ?? "", thaiName: f?.thaiName ?? "", registrationNo: f?.registrationNo ?? "",
  addr: { street: f?.addrStreet ?? "", unit: f?.addrUnit ?? "", district: f?.country === "Thailand" ? f?.addrDistrict ?? "" : "", province: f?.addrProvince ?? "", postal: f?.addrPostal ?? "" },
  website: f?.website ?? "", email: f?.email ?? "", phone: f?.phone ?? "",
  team: (f?.team ?? []).map((t) => ({ id: t.id, name: t.name, role: t.role ?? "", roleTh: t.roleTh ?? "", email: t.email ?? "" })),
  credentials: (f?.credentials ?? []).map((c) => ({ id: c.id, name: c.name, nameTh: c.nameTh ?? "", note: c.note ?? "", noteTh: c.noteTh ?? "", status: c.status })),
  documents: (f?.documents ?? []).map((d) => ({ id: d.id, path: d.path, name: d.name, type: d.type ?? "", checked: !!d.checkedAt })),
  suggestedListingName: f?.suggestedListingName ?? "", suggestedHeadline: f?.suggestedHeadline ?? "",
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
  const pop = useEditInfo();
  return (
    <section id={`sec-${id}`} className={pop ? "scroll-mt-6" : "scroll-mt-6 rounded-[14px] border border-border bg-card p-5 shadow-card"}>
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
    <div className={cn("space-y-1.5", className)} data-edit-sec={htmlFor === "fe-teamSize" ? "team-size" : undefined}>
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

export function FirmEditForm({ firm, section, setup, initial, onDone, adminCreate }: { firm: AdvisorFirm | null; section?: EditSection; setup?: SetupMode; initial?: FirmForm | null; onDone?: () => void; adminCreate?: (id: string) => void }) {
  const {data:session} = useSessionContext();
  const {isControl} = usePermissions();
  const asAdmin = session?.user?.accountRole === "admin" && isControl;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const save = useServerFn(saveAdvisorFirm);
  const create = useServerFn(createAdvisorFirmForAdmin);
  const upUrl = useServerFn(createAdvisorUploadUrl);
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
  const pop = useEditInfo();
  type Tab = "logo" | "about" | "address" | "services" | "team" | "documents" | "admin";
  const sectionTab: Record<string, Tab> = { firm: "about", work: "about", company: "address", services: "services", team: "team", credentials: "documents", documents: "documents" };
  const [tab, setTab] = useState<Tab>(section ? sectionTab[section] ?? "about" : "about");
  const visible = (t: Tab) => !pop || !!setup || tab === t;

  const back = () => (pop ? pop.requestClose() : onDone ? onDone() : navigate({ to: "/marketplace/my-company", search: firm ? ({ open: firm.id } as never) : undefined }));
  useEffect(() => { pop?.setPresentation(f.name); }, [f.name]);
  const thai = f.country === "Thailand";
  const src = setup?.sources ?? {};
  // Bilingual texts: Edit information's text switch picks which language's boxes are edited.
  const { lang: tl, switchable: tlSw } = useTextLang();
  const pick = (en: string | undefined, th: string | undefined) => tl === "th" ? (th || (tlSw ? "" : en || "")) : (en || (tlSw ? "" : th || ""));
  const descV = pick(f.description, f.descriptionTh);
  const setDesc = (v: string) => set(tl === "th" ? "descriptionTh" : "description", v);

  useEffect(() => { pop?.setDirty(JSON.stringify(f) !== JSON.stringify(base.current)); }, [f]); // eslint-disable-line react-hooks/exhaustive-deps
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
    ["city", cityError(thai ? f.addr.province : f.city, f.country)],
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
  const show = (k: string) => ((firm?.status === "draft" || adminCreate) && errOf[k] ? (adminCreate && k === "name" && forced ? "Needed to add the advisor." : "Missing") : (touched[k] || forced) ? errOf[k] : null);
  const blur = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));
  const addrErr = addrErrors(f.addr, thai, f.city);
  const showAddr = (k: keyof Addr) => (touched[`a-${k}`] ? (addrErr as Record<string, string | null>)[k] ?? null : null);
  const firstBad = errs.find(([, e]) => e)?.[0];
  const missingCounts = {about:errs.filter(([k,e])=>e && !["city","legalName"].includes(k)).length + (f.firmType ? 0 : 1) + (f.languages.length ? 0 : 1), address:errs.filter(([k,e])=>e && ["city","legalName"].includes(k)).length};

  const changeCountry = (c: string) => setF((p) => ({ ...p, country: c, city: "", registrationNo: "", addr: { street: "", unit: "", district: "", province: "", postal: "" } }));

  async function submit() {
    if (adminCreate && nameError(f.name)) { setForced(true); setTab("about"); setTimeout(() => document.getElementById("fe-name")?.focus(), 60); return; }

    if (!adminCreate && firm?.status !== "draft" && !f.services.length) { toast.error("Pick at least one service."); return; }
    if (!adminCreate && firm?.status !== "draft" && firstBad) {
      setForced(true);
      setTimeout(() => (document.getElementById(`fe-${firstBad}`) as HTMLElement | null)?.focus(), 0);
      return;
    }
    setBusy(true);
    try {
      const nul = (v: string) => (v.trim() ? v.trim() : null);
      const up = await uploadPending(f.media, ({ kind, ext }) => upUrl({ data: { kind, ext } }), supabase.storage.from("startup-media"));
      const logoChanged = up.logoPath !== f.logo.path;
      const created = adminCreate ? await create({data:{name:f.name.trim()}}) : null;
      await save({
        data: {
          id: created?.id ?? firm?.id ?? null, name: f.name.trim(), firmType: f.firmType, logoPath: up.logoPath, logoSource: logoChanged ? "upload" : f.logo.source, media: up.media,
          description: f.description.trim(), descriptionTh: f.descriptionTh.trim() || null, yearFounded: f.yearFounded ? Number(f.yearFounded) : null, city: (thai ? f.addr.province : f.city).trim(), country: f.country,
          services: f.services, fees: Object.fromEntries(f.services.map((s) => [s, f.fees[s] ?? newFee()])),
          dealBand: f.dealBand || null, teamSize: f.teamSize ? Number(f.teamSize) : null, languages: f.languages, sectors: f.sectors, sectorAgnostic: f.sectorAgnostic,
          legalName: f.legalName.trim(), thaiName: nul(f.thaiName), registrationNo: nul(f.registrationNo),
          addrStreet: nul(f.addr.street), addrUnit: nul(f.addr.unit), addrDistrict: thai ? nul(f.addr.district) : nul(f.city),
          addrProvince: nul(f.addr.province), addrPostal: nul(f.addr.postal),
          website: f.website.trim() ? normalizeUrl(f.website) : "", email: f.email.trim(), phone: f.phone.trim(),
          team: f.team.filter((t) => t.name.trim()).map((t) => ({ id: t.id, name: t.name, role: nul(t.role), roleTh: nul(t.roleTh ?? ""), email: nul(t.email) })),
          credentials: f.credentials.filter((c) => c.name.trim()).map((c) => ({ id: c.id, name: c.name, nameTh: nul(c.nameTh ?? ""), note: nul(c.note), noteTh: nul(c.noteTh ?? "") })),
          documents: f.documents.map((d) => ({ id: d.id, path: d.path, name: d.name || "Document", type: nul(d.type) })),
          suggested_listing_name: nul(f.suggestedListingName), suggested_headline: nul(f.suggestedHeadline),
        },
      });
      await qc.invalidateQueries({ queryKey: ADVISOR_FIRMS_KEY });
      await qc.invalidateQueries({ queryKey: ["advisor-admin-edit", firm?.id] });
      await qc.invalidateQueries({ queryKey: ["advisors-admin"] });
      const fresh = qc.getQueryData<AdvisorFirm[]>(ADVISOR_FIRMS_KEY)?.find((x) => x.id === firm?.id);
      const complete = fresh ? firmChecklist(fresh).every((i) => i.done) : false;
      const msg = complete ? "Profile saved as a draft. Publish it when you're ready." : "Profile saved as a draft. Finish the checklist to publish.";
      if (created && adminCreate) { pop?.setDirty(false); toast.success(`${f.name.trim()} created`); adminCreate(created.id); return; }
      base.current = f;
      if (setup) { setup.onDirty(null); setup.onSaved(msg); return; }
      toast.success(firm?.setupDoneAt || firm?.status !== "draft" ? "Profile saved." : msg);
      if (pop) { pop.setDirty(false); pop.done(); } else back();
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
    <div className={cn("mx-auto space-y-5", pop ? "pt-5" : setup ? "max-w-[880px] pb-8" : "max-w-[920px] pb-24")}>
      {!setup && !pop && (
        <div>
          <button type="button" onClick={back} className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> {onDone ? "Advisors Directory" : "My Company"}</button>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{firm ? "Edit profile" : "Add Firm Profile"}</h1>
          <p className="text-sm text-muted-foreground">{firm ? `${firm.refNo} · everything here is open to sellers and buyers.` : "A new profile starts as a Draft."}</p>
        </div>
      )}

      {pop && !setup ? <>
        <EditInfoTabsSlot><span className="inline-flex h-9 items-center gap-2 rounded-md bg-help-advisor px-3.5 text-sm font-semibold text-primary-foreground"><Globe className="h-4 w-4" />{tr("Open to sellers and buyers")}</span></EditInfoTabsSlot>
        <TabRow value={tab} onChange={setTab} label="Advisor information" idBase="advisor-edit" tabs={[
          {key:"logo",label:tr("Logo")},{key:"about",label:tr("About Company"),count:missingCounts.about,error:!!adminCreate && forced && !!nameError(f.name)},{key:"address",label:tr("Address"),count:missingCounts.address},
          {key:"services",label:tr("Services & Fees")},{key:"team",label:tr("Team")},{key:"documents",label:tr("Licences & Documents")},
          ...(asAdmin ? [{key:"admin" as const,label:tr("Admin settings"),icon:<Shield className="h-3.5 w-3.5" />}]:[]),
        ]} />
        {visible("logo") && <div className="space-y-4"><TabHead title={tr("Logo")} />        <F label={tr("Logo and photos")} opt tag={f.logo.url ? (f.logo.source === "enrich" ? "Auto Enrich" : src.logo) : undefined}>
          <AttachmentCard value={f.media} onChange={(m) => set("media", m)} name={f.name || tr("Your firm")} sectorLine={[f.firmType, [f.city || f.addr.province, f.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
            intro={tr("Your firm's logo and up to 3 photos of your office, your team or your work.")} showGuidance={false} />
        </F>
</div>}
        {visible("about") && <EditSec id={section === "work" ? "work" : "firm"} active={section === "work" || section === "firm"} tone="buyer" className="space-y-4"><TabHead title={tr("Company Info")} /><CompactFields>          <F label="Year founded" req tag={src.yearFounded} err={show("year")} htmlFor="fe-year">
            <Input id="fe-year" aria-required className={cn(inp, show("year") && errB)} inputMode="numeric" maxLength={4} placeholder="e.g. 2014" value={f.yearFounded} onBlur={blur("year")} onChange={(e) => set("yearFounded", e.target.value.replace(/\D/g, "").slice(0, 4))} />
          </F>
          <F label="Firm name" req tag={src.name} err={show("name")} htmlFor="fe-name"><Input id="fe-name" aria-required className={cn(inp, show("name") && (adminCreate && forced ? "creation-invalid" : errB))} maxLength={80} value={f.name} onBlur={blur("name")} onChange={(e) => set("name", e.target.value)} /></F>
          <F label={thai ? "Registration no. (เลขทะเบียนนิติบุคคล)" : "Registration no."} req={thai} opt={!thai} tag={f.registrationNo ? src.registrationNo : undefined} err={show("reg")} htmlFor="fe-reg">
            <Input id="fe-reg" aria-required={thai} inputMode={thai ? "numeric" : undefined} maxLength={thai ? 13 : 50} placeholder={thai ? "13 digits" : undefined}
              className={cn(inp, thai && "border-[#93C5FD] bg-[#EFF6FF] dark:border-[#1E40AF] dark:bg-[#172554]", show("reg") && errB)}
              value={f.registrationNo} onBlur={blur("reg")} onChange={(e) => set("registrationNo", thai ? e.target.value.replace(/\D/g, "").slice(0, 13) : e.target.value.slice(0, 50))} />
          </F>
</CompactFields><CompactFields>          <F label="Firm type" req tag={src.firmType}>
            <select aria-required className={sel} value={f.firmType} onChange={(e) => set("firmType", e.target.value)}>
              <option value="" disabled>Select type</option>
              {FIRM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </F>
          <F label="Team size" req tag={src.teamSize} err={show("teamSize")} htmlFor="fe-teamSize">
            <Input id="fe-teamSize" aria-required className={cn(inp, show("teamSize") && errB)} inputMode="numeric" maxLength={5} placeholder="e.g. 8" value={f.teamSize} onBlur={blur("teamSize")} onChange={(e) => set("teamSize", e.target.value.replace(/\D/g, "").slice(0, 5))} />
          </F>
          <F label="Typical deal size" opt tag={f.dealBand ? src.dealBand : undefined} hint={deal ? <>Your card shows <b>{deal.usd}</b> ({deal.thb}).</> : undefined}>
            <select className={sel} value={f.dealBand} onChange={(e) => set("dealBand", e.target.value)}>
              <option value="">Choose a range</option>
              {DEAL_BANDS.map((b) => <option key={b.key} value={b.key}>{dealBandLabels(b.key)?.full ?? b.key}</option>)}
            </select>
          </F>
</CompactFields><CompactFields>          <F label="Website" req tag={src.website} err={show("web")} htmlFor="fe-web"><Input id="fe-web" aria-required className={cn(inp, show("web") && errB)} maxLength={200} placeholder="https://www.yourfirm.com" value={f.website} onBlur={blur("web")} onChange={(e) => set("website", e.target.value)} /></F>
          <F label="Email" req tag={src.email} err={show("email")} htmlFor="fe-email"><Input id="fe-email" aria-required type="email" className={cn(inp, show("email") && errB)} maxLength={120} placeholder="hello@yourfirm.com" value={f.email} onBlur={blur("email")} onChange={(e) => set("email", e.target.value)} /></F>
          <F label="Phone" req tag={src.phone} err={show("phone")} htmlFor="fe-phone"><Input id="fe-phone" aria-required className={cn(inp, show("phone") && errB)} maxLength={30} placeholder="+66 2 123 4567" value={f.phone} onBlur={blur("phone")} onChange={(e) => set("phone", e.target.value)} /></F>
</CompactFields>        <F label="Languages" req tag={f.languages.length ? src.languages : undefined}>
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
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Listing name" hint={`${f.suggestedListingName.length} / 120`} htmlFor="fe-sug-name">
            <Input id="fe-sug-name" maxLength={120} value={f.suggestedListingName} onChange={(e) => set("suggestedListingName", e.target.value)} placeholder={f.name || ""} />
          </F>
          <F label="Headline" hint={`${f.suggestedHeadline.length} / 120`} htmlFor="fe-sug-head">
            <Input id="fe-sug-head" maxLength={120} value={f.suggestedHeadline} onChange={(e) => set("suggestedHeadline", e.target.value)} />
          </F>
        </div>
        <p className="-mt-2 flex gap-1.5 text-[12.5px] text-muted-foreground"><Pencil size={14} />{tr("Your suggestion. We adjusted your listing name and headline to reduce duplication and make your listing easier to distinguish.")}</p>
        <F label={<>Description<LangTag /></>} req tag={f.description.trim() ? src.description : undefined} err={show("desc")} hint={`${descV.length} / 300 · your card shows 3 lines`} htmlFor="fe-desc">
          <Textarea id="fe-desc" aria-required className={cn("text-[14px]", show("desc") && errB)} maxLength={300} rows={4} lang={tl} value={descV} onBlur={blur("desc")} onChange={(e) => setDesc(e.target.value)} />
        </F>
</EditSec>}
        {visible("address") && <EditSec id="company" active={section === "company"} tone="buyer" className="space-y-4"><TabHead title={tr("Company Address")} /><CompactFields two>          <F label="Legal name" req tag={f.legalName ? src.legalName : undefined} err={show("legalName")} htmlFor="fe-legalName"
            hint={firm?.verifiedAt ? "Changing this sends your firm back to Admin for a check." : undefined}>
            <Input id="fe-legalName" aria-required className={cn(inp, show("legalName") && errB)} maxLength={200} placeholder="e.g. Acme Advisory Co., Ltd." value={f.legalName} onBlur={blur("legalName")} onChange={(e) => set("legalName", e.target.value)} />
          </F>
          <F label="Thai name" opt={!thai} tag={f.thaiName ? src.thaiName : undefined}><Input className={inp} maxLength={200} placeholder="บริษัท … จำกัด" value={f.thaiName} onChange={(e) => set("thaiName", e.target.value)} /></F>
</CompactFields><CompactFields two>
          <F label={tr("Country")} req><select id="fe-country" className={sel} value={f.country} onChange={e=>changeCountry(e.target.value)}><option value="">{tr("Choose a country")}</option>{COUNTRIES.map(c=><option key={c} value={c}>{tr(c)}</option>)}</select></F>
          <F label={tr("City / province")} req err={show("city")}><Input id="fe-city" value={thai ? f.addr.province : f.city} onChange={e=>thai ? set("addr", {...f.addr,province:e.target.value}) : set("city",e.target.value)} /></F>
        </CompactFields><div>
          <AddressBox noteOutside compact a={f.addr} thai={thai} city={f.city} onCity={(v) => set("city", v)} note={tr("Sellers and buyers see it as a link that opens a map. PitchSnack checks it against your registered address.")}
            onChange={(p) => set("addr", { ...f.addr, ...p })} show={showAddr} onBlur={(k) => setTouched((t) => ({ ...t, [`a-${k}`]: true }))} />
          {src.addr && f.addr.street && <div className="mt-1.5"><Tag t={src.addr} /></div>}
        </div>
</EditSec>}
        {visible("services") && <div className="space-y-4"><TabHead title={tr("Services & Fees")} />      <Section id="services" active={section === "services"} title="Services and fees">
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

</div>}
        {visible("team") && <div className="space-y-4"><TabHead title={tr("Team")} />      <Section id="team" active={!setup && section === "team"} title="Team" setup={!!setup}>
        <p className="text-[12.5px] text-muted-foreground">{tr("Your name is checked against your firm's list of directors.")}</p>
        {f.team.map((t, i) => (
          <div key={i} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <F label="Name" req><Input className={inp} value={t.name} onChange={(e) => set("team", f.team.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></F>
            <F label="Role"><Input className={inp} placeholder="Role, e.g. Partner · M&A" lang={tl} value={pick(t.role, t.roleTh)} onChange={(e) => set("team", f.team.map((x, j) => (j === i ? { ...x, [tl === "th" ? "roleTh" : "role"]: e.target.value } : x)))} /></F>
            <F label="Work email"><Input className={inp} value={t.email} onChange={(e) => set("team", f.team.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} /></F>
            <Button type="button" variant="ghost" size="icon" aria-label="Remove person" onClick={() => set("team", f.team.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => set("team", [...f.team, { name: "", role: "", email: "" }])}><Plus className="mr-1.5 h-4 w-4" /> Add person</Button>
        {setup && <p className="text-[12px] text-muted-foreground">You're added from your account. Add the people sellers and buyers will work with.</p>}
      </Section>

</div>}
        {visible("documents") && <div className="space-y-4"><TabHead title={tr("Licences & Documents")} />      <Section id="credentials" active={!setup && section === "credentials"} title="Licences and credentials" setup={!!setup}>
        {f.credentials.length === 0 && <p className="text-[13px] text-muted-foreground">No licences or credentials yet. Add the ones your firm holds; Admin checks each one before it shows as Verified.</p>}
        {f.credentials.map((c, i) => (
          <div key={i} className="grid items-end gap-3 sm:grid-cols-[1fr_1.4fr_auto_auto]">
            <F label="Licence or credential" req><Input className={inp} placeholder="e.g. Financial advisor licence" lang={tl} value={tl === "th" ? pick(c.name, c.nameTh) : c.name} onChange={(e) => set("credentials", f.credentials.map((x, j) => (j === i ? { ...x, [tl === "th" ? "nameTh" : "name"]: e.target.value, ...(tl === "th" && !x.name ? { name: e.target.value } : {}), status: "pending" } : x)))} /></F>
            <F label="Note"><Input className={inp} placeholder="Note, e.g. 2 licensed advisers on the team" lang={tl} value={pick(c.note, c.noteTh)} onChange={(e) => set("credentials", f.credentials.map((x, j) => (j === i ? { ...x, [tl === "th" ? "noteTh" : "note"]: e.target.value, status: "pending" } : x)))} /></F>
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

</div>}
        {asAdmin && visible("admin") && <div className="space-y-4"><TabHead title={tr("Admin settings")} /><p className="text-sm text-muted-foreground">Only Admin sees this tab.</p><CompactFields two><F label="Verification status"><Input readOnly value={firm?.verification?.state ?? "unverified"} /></F><F label="Verified on"><Input readOnly value={firm?.verifiedAt ?? "—"} /></F>{firm?.verification?.state === "declined" && <F label="Decline reason"><Textarea readOnly value={firm.verification.reason ?? ""} /></F>}<F label="More information requested"><Textarea readOnly value={firm?.verification?.note ?? ""} /></F></CompactFields><Button variant="link" onClick={() => { pop.requestClose(); void navigate({to:"/approvals",search:{tab:"advisors",adv:firm?.id} as never}); }}>Change it in Approvals</Button></div>}
      </> : <>      <Section id="firm" active={false} title="Firm" setup={!!setup}>
        <F label={tr("Logo and photos")} opt tag={f.logo.url ? (f.logo.source === "enrich" ? "Auto Enrich" : src.logo) : undefined}>
          <AttachmentCard value={f.media} onChange={(m) => set("media", m)} name={f.name || tr("Your firm")} sectorLine={[f.firmType, [f.city || f.addr.province, f.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
            intro={tr("Your firm's logo and up to 3 photos of your office, your team or your work.")} showGuidance={false} />
        </F>
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Firm name" req tag={src.name} err={show("name")} htmlFor="fe-name"><Input id="fe-name" aria-required className={cn(inp, show("name") && errB)} maxLength={80} value={f.name} onBlur={blur("name")} onChange={(e) => set("name", e.target.value)} /></F>
          <F label="Firm type" req tag={src.firmType}>
            <select aria-required className={sel} value={f.firmType} onChange={(e) => set("firmType", e.target.value)}>
              <option value="" disabled>Select type</option>
              {FIRM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </F>
          <F label="Year founded" req tag={src.yearFounded} err={show("year")} htmlFor="fe-year">
            <Input id="fe-year" aria-required className={cn(inp, show("year") && errB)} inputMode="numeric" maxLength={4} placeholder="e.g. 2014" value={f.yearFounded} onBlur={blur("year")} onChange={(e) => set("yearFounded", e.target.value.replace(/\D/g, "").slice(0, 4))} />
          </F>
        </div>
        <F label={<>Description<LangTag /></>} req tag={f.description.trim() ? src.description : undefined} err={show("desc")} hint={`${descV.length} / 300 · your card shows 3 lines`} htmlFor="fe-desc">
          <Textarea id="fe-desc" aria-required className={cn("text-[14px]", show("desc") && errB)} maxLength={300} rows={4} lang={tl} value={descV} onBlur={blur("desc")} onChange={(e) => setDesc(e.target.value)} />
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
              {DEAL_BANDS.map((b) => <option key={b.key} value={b.key}>{dealBandLabels(b.key)?.full ?? b.key}</option>)}
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
          <AddressBox compact a={f.addr} thai={thai} city={f.city} onCity={(v) => set("city", v)} note={tr("Sellers and buyers see it as a link that opens a map. PitchSnack checks it against your registered address.")}
            country={f.country} onCountry={changeCountry}
            onChange={(p) => set("addr", { ...f.addr, ...p })} show={showAddr} onBlur={(k) => setTouched((t) => ({ ...t, [`a-${k}`]: true }))} />
          {src.addr && f.addr.street && <div className="mt-1.5"><Tag t={src.addr} /></div>}
        </div>
      </Section>

      <Section id="team" active={!setup && section === "team"} title="Team" setup={!!setup}>
        <p className="text-[12.5px] text-muted-foreground">{tr("Your name is checked against your firm's list of directors.")}</p>
        {f.team.map((t, i) => (
          <div key={i} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <F label="Name" req><Input className={inp} value={t.name} onChange={(e) => set("team", f.team.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></F>
            <F label="Role"><Input className={inp} placeholder="Role, e.g. Partner · M&A" lang={tl} value={pick(t.role, t.roleTh)} onChange={(e) => set("team", f.team.map((x, j) => (j === i ? { ...x, [tl === "th" ? "roleTh" : "role"]: e.target.value } : x)))} /></F>
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
            <F label="Licence or credential" req><Input className={inp} placeholder="e.g. Financial advisor licence" lang={tl} value={tl === "th" ? pick(c.name, c.nameTh) : c.name} onChange={(e) => set("credentials", f.credentials.map((x, j) => (j === i ? { ...x, [tl === "th" ? "nameTh" : "name"]: e.target.value, ...(tl === "th" && !x.name ? { name: e.target.value } : {}), status: "pending" } : x)))} /></F>
            <F label="Note"><Input className={inp} placeholder="Note, e.g. 2 licensed advisers on the team" lang={tl} value={pick(c.note, c.noteTh)} onChange={(e) => set("credentials", f.credentials.map((x, j) => (j === i ? { ...x, [tl === "th" ? "noteTh" : "note"]: e.target.value, status: "pending" } : x)))} /></F>
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

</>}
      {pop ? (
        <EditInfoFooter>
          {adminCreate && forced && nameError(f.name) && <p className="mr-auto text-[13px] font-medium text-destructive">To add the advisor, fill in: Firm name (About Company).</p>}
          <Button variant="outline" onClick={back}>Cancel</Button>
          <Button disabled={busy || uploading} onClick={submit} className="bg-accent text-accent-foreground hover:bg-accent/90">{adminCreate ? "Add advisor" : "Save changes"}</Button>
        </EditInfoFooter>
      ) : (
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
      )}
    </div>
  );
}
