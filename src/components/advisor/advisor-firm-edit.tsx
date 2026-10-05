import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CountryCombobox } from "@/components/ui/country-combobox";
import { ServiceTiles, useMyAdvisorFirms, ADVISOR_FIRMS_KEY } from "@/components/advisor/advisor-my-company";
import { FirmLogo } from "@/components/advisor/advisor-firm-card";
import { createAdvisorUploadUrl, saveAdvisorFirm } from "@/lib/advisor-firm.functions";
import { FIRM_TYPES, LANGUAGES, dealSizeLabels, mergeServiceOrder, type AdvisorFirm, type EditSection } from "@/lib/advisor-firm";
import { SECTORS } from "@/lib/sectors";
import { cn } from "@/lib/utils";

type Form = {
  name: string; firmType: string; logoPath: string | null; logoUrl: string | null; description: string; yearFounded: string;
  city: string; country: string; services: string[]; fees: Record<string, string>;
  dealMin: string; dealMax: string; teamSize: string; languages: string[]; sectors: string[];
  legalName: string; thaiName: string; registrationNo: string;
  addrStreet: string; addrUnit: string; addrSubdistrict: string; addrDistrict: string; addrProvince: string; addrPostal: string;
  website: string; email: string; phone: string;
  team: { id?: string; name: string; role: string; email: string }[];
  credentials: { id?: string; name: string; note: string; status?: string }[];
  documents: { id?: string; path: string; name: string; type: string; checked?: boolean }[];
};

const toForm = (f: AdvisorFirm | null): Form => ({
  name: f?.name ?? "", firmType: f?.firmType ?? "", logoPath: f?.logoPath ?? null, logoUrl: f?.logoUrl ?? null,
  description: f?.description ?? "", yearFounded: f?.yearFounded ? String(f.yearFounded) : "",
  city: f?.city ?? "", country: f?.country ?? "Thailand", services: f?.services ?? [], fees: { ...(f?.fees ?? {}) },
  dealMin: f?.dealMinUsdM != null ? String(f.dealMinUsdM) : "", dealMax: f?.dealMaxUsdM != null ? String(f.dealMaxUsdM) : "",
  teamSize: f?.teamSize ? String(f.teamSize) : "", languages: f?.languages ?? [], sectors: f?.sectors ?? [],
  legalName: f?.legalName ?? "", thaiName: f?.thaiName ?? "", registrationNo: f?.registrationNo ?? "",
  addrStreet: f?.addrStreet ?? "", addrUnit: f?.addrUnit ?? "", addrSubdistrict: f?.addrSubdistrict ?? "",
  addrDistrict: f?.addrDistrict ?? "", addrProvince: f?.addrProvince ?? "", addrPostal: f?.addrPostal ?? "",
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
  return <EditForm key={firm?.id ?? "new"} firm={firm} section={section} />;
}

function Section({ id, title, children }: { id: EditSection; title: string; children: React.ReactNode }) {
  return (
    <section id={`sec-${id}`} className="scroll-mt-6 rounded-[14px] border border-border bg-card p-5 shadow-card">
      <h2 className="mb-4 text-[16px] font-semibold">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
function F({ label, req, hint, children, className }: { label: string; req?: boolean; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}{req && <span className="text-destructive"> *</span>}</Label>
      {children}
      {hint && <p className="text-[12px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function MultiPick({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState("");
  const shown = options.filter((o) => !value.includes(o) && o.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-[12.5px]">
              {v}<button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))}><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type to add…" className="h-9" />
      {q && shown.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {shown.map((o) => <button key={o} type="button" onClick={() => { onChange([...value, o]); setQ(""); }} className="rounded-full border border-dashed border-border px-2.5 py-0.5 text-[12.5px] hover:bg-muted">+ {o}</button>)}
        </div>
      )}
    </div>
  );
}

function EditForm({ firm, section }: { firm: AdvisorFirm | null; section?: EditSection }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const save = useServerFn(saveAdvisorFirm);
  const upload = useServerFn(createAdvisorUploadUrl);
  const [f, setF] = useState<Form>(() => toForm(firm));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);
  const docInput = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const back = () => navigate({ to: "/marketplace/my-company" });

  useEffect(() => {
    if (!section || section === "firm") return;
    const t = setTimeout(() => document.getElementById(`sec-${section}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    return () => clearTimeout(t);
  }, [section]);

  const deal = useMemo(() => dealSizeLabels({ dealMinUsdM: f.dealMin ? Number(f.dealMin) : null, dealMaxUsdM: f.dealMax ? Number(f.dealMax) : null }), [f.dealMin, f.dealMax]);

  async function uploadFile(file: File, kind: "logo" | "doc") {
    const { path, url } = await upload({ data: { kind, ext: extOf(file.name) } });
    const res = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream", "x-upsert": "false" } });
    if (!res.ok) throw new Error("Upload failed.");
    return path;
  }
  async function onLogo(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try { const path = await uploadFile(file, "logo"); setF((p) => ({ ...p, logoPath: path, logoUrl: URL.createObjectURL(file) })); }
    catch (e) { toast.error((e as Error).message); } finally { setUploading(false); }
  }
  async function onDoc(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const path = await uploadFile(file, "doc");
      const ext = extOf(file.name);
      setF((p) => ({ ...p, documents: [...p.documents, { path, name: file.name.replace(/\.[^.]+$/, ""), type: ext === "pdf" ? "PDF" : ext.startsWith("doc") ? "DOCX" : "Image" }] }));
    } catch (e) { toast.error((e as Error).message); } finally { setUploading(false); }
  }

  const missing = [
    !f.name.trim() && "Firm name", !f.firmType && "Firm type", !f.description.trim() && "Description",
    !f.city.trim() && "City", !f.country && "Country", !f.services.length && "Services",
    !f.dealMin && !f.dealMax && "Typical deal size", !f.teamSize && "Team size", !f.legalName.trim() && "Legal name", !f.email.trim() && "Email",
    f.registrationNo && !/^\d{13}$/.test(f.registrationNo) && "Registration no. (13 digits)",
    f.team.some((t) => !t.name.trim()) && "Team member name", f.credentials.some((c) => !c.name.trim()) && "Licence name",
  ].filter(Boolean) as string[];

  async function submit() {
    if (missing.length) { toast.error(`Add ${missing.join(", ")} first.`); return; }
    setBusy(true);
    try {
      const nul = (v: string) => (v.trim() ? v.trim() : null);
      await save({
        data: {
          id: firm?.id ?? null, name: f.name, firmType: f.firmType, logoPath: f.logoPath, description: f.description,
          yearFounded: f.yearFounded ? Number(f.yearFounded) : null, city: f.city, country: f.country,
          services: f.services, fees: Object.fromEntries(f.services.map((s) => [s, f.fees[s] ?? ""])),
          dealMinUsdM: f.dealMin ? Number(f.dealMin) : null, dealMaxUsdM: f.dealMax ? Number(f.dealMax) : null,
          teamSize: Number(f.teamSize), languages: f.languages, sectors: f.sectors,
          legalName: f.legalName, thaiName: nul(f.thaiName), registrationNo: nul(f.registrationNo),
          addrStreet: nul(f.addrStreet), addrUnit: nul(f.addrUnit), addrSubdistrict: nul(f.addrSubdistrict),
          addrDistrict: nul(f.addrDistrict), addrProvince: nul(f.addrProvince), addrPostal: nul(f.addrPostal),
          website: nul(f.website), email: f.email.trim(), phone: nul(f.phone),
          team: f.team.map((t) => ({ id: t.id, name: t.name, role: nul(t.role), email: nul(t.email) })),
          credentials: f.credentials.map((c) => ({ id: c.id, name: c.name, note: nul(c.note) })),
          documents: f.documents.map((d) => ({ id: d.id, path: d.path, name: d.name, type: nul(d.type) })),
        },
      });
      await qc.invalidateQueries({ queryKey: ADVISOR_FIRMS_KEY });
      toast.success(firm ? "Profile saved." : "Firm profile created as a draft.");
      back();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  const toggleService = (s: string) => set("services", f.services.includes(s) ? f.services.filter((x) => x !== s) : mergeServiceOrder(f.services, [...f.services, s]));

  return (
    <div className="mx-auto max-w-[920px] space-y-5 pb-24">
      <div className="flex items-center justify-between gap-3">
        <div>
          <button type="button" onClick={back} className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> My Company</button>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{firm ? "Edit profile" : "Add Firm Profile"}</h1>
          <p className="text-sm text-muted-foreground">{firm ? `${firm.refNo} · everything here is open to sellers and buyers.` : "A new profile starts as a Draft."}</p>
        </div>
      </div>

      <Section id="firm" title="Firm">
        <div className="flex items-center gap-4">
          <FirmLogo f={{ name: f.name || "?", logoUrl: f.logoUrl }} ring={false} />
          <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
          <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => logoInput.current?.click()}><Upload className="mr-1.5 h-4 w-4" /> {f.logoPath ? "Change logo" : "Upload logo"}</Button>
          {f.logoPath && <Button type="button" variant="ghost" size="sm" onClick={() => setF((p) => ({ ...p, logoPath: null, logoUrl: null }))}>Remove</Button>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Firm name" req><Input maxLength={80} value={f.name} onChange={(e) => set("name", e.target.value)} /></F>
          <F label="Firm type" req>
            <Select value={f.firmType} onValueChange={(v) => set("firmType", v)}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>{FIRM_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </F>
          <F label="Year founded"><Input inputMode="numeric" maxLength={4} value={f.yearFounded} onChange={(e) => set("yearFounded", e.target.value.replace(/\D/g, "").slice(0, 4))} /></F>
          <F label="City" req><Input maxLength={100} value={f.city} onChange={(e) => set("city", e.target.value)} /></F>
          <F label="Country" req className="sm:col-span-2"><CountryCombobox value={f.country} onChange={(v: string) => set("country", v)} /></F>
        </div>
        <F label="Description" req hint={`Your card shows 3 lines · ${f.description.length}/300`}>
          <Textarea maxLength={300} rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} />
        </F>
      </Section>

      <Section id="services" title="Services and fees">
        <ServiceTiles picked={f.services} onToggle={toggleService} />
        {f.services.length === 0 && <p className="text-[13px] font-semibold text-[#B45309]">Pick at least one service.</p>}
        {f.services.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {f.services.map((s) => (
              <F key={s} label={`Fee · ${s}`}>
                <Input maxLength={80} placeholder="e.g. Retainer + success fee 2–4%" value={f.fees[s] ?? ""} onChange={(e) => set("fees", { ...f.fees, [s]: e.target.value })} />
              </F>
            ))}
          </div>
        )}
      </Section>

      <Section id="work" title="Work">
        <div className="grid gap-4 sm:grid-cols-3">
          <F label="Typical deal size, min (US$ M)" req><Input inputMode="decimal" value={f.dealMin} onChange={(e) => set("dealMin", e.target.value.replace(/[^\d.]/g, ""))} /></F>
          <F label="Typical deal size, max (US$ M)"><Input inputMode="decimal" value={f.dealMax} onChange={(e) => set("dealMax", e.target.value.replace(/[^\d.]/g, ""))} /></F>
          <F label="Team size" req><Input inputMode="numeric" value={f.teamSize} onChange={(e) => set("teamSize", e.target.value.replace(/\D/g, ""))} /></F>
        </div>
        {deal && <p className="text-[13px] text-muted-foreground">Shown as {deal.usd} ({deal.thb})</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Languages"><MultiPick options={LANGUAGES} value={f.languages} onChange={(v) => set("languages", v)} /></F>
          <F label="Sectors"><MultiPick options={SECTORS} value={f.sectors} onChange={(v) => set("sectors", v)} /></F>
        </div>
      </Section>

      <Section id="company" title="Company">
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Legal name" req hint={firm?.verifiedAt ? "Changing this sends your firm back to Admin for a check." : undefined}><Input maxLength={200} value={f.legalName} onChange={(e) => set("legalName", e.target.value)} /></F>
          <F label="Thai name"><Input maxLength={200} value={f.thaiName} onChange={(e) => set("thaiName", e.target.value)} /></F>
          <F label="Registration no." hint="13 digits"><Input inputMode="numeric" maxLength={13} value={f.registrationNo} onChange={(e) => set("registrationNo", e.target.value.replace(/\D/g, "").slice(0, 13))} /></F>
        </div>
        <div className="rounded-[12px] border border-border p-4">
          <div className="mb-3 text-[13px] font-semibold">Address</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="No. and street"><Input value={f.addrStreet} onChange={(e) => set("addrStreet", e.target.value)} /></F>
            <F label="Floor / unit / soi"><Input value={f.addrUnit} onChange={(e) => set("addrUnit", e.target.value)} /></F>
            <F label="Sub-district"><Input value={f.addrSubdistrict} onChange={(e) => set("addrSubdistrict", e.target.value)} /></F>
            <F label="District"><Input value={f.addrDistrict} onChange={(e) => set("addrDistrict", e.target.value)} /></F>
            <F label="Province"><Input value={f.addrProvince} onChange={(e) => set("addrProvince", e.target.value)} /></F>
            <F label="Postal code"><Input inputMode="numeric" maxLength={10} value={f.addrPostal} onChange={(e) => set("addrPostal", e.target.value)} /></F>
          </div>
          <p className="mt-2 text-[12px] text-muted-foreground">Country: {f.country || "set it under Firm"}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <F label="Website"><Input value={f.website} onChange={(e) => set("website", e.target.value)} /></F>
          <F label="Email" req><Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></F>
          <F label="Phone"><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></F>
        </div>
      </Section>

      <Section id="team" title="Team">
        {f.team.map((t, i) => (
          <div key={i} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <F label="Name" req><Input value={t.name} onChange={(e) => set("team", f.team.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></F>
            <F label="Role"><Input value={t.role} onChange={(e) => set("team", f.team.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))} /></F>
            <F label="Email"><Input value={t.email} onChange={(e) => set("team", f.team.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} /></F>
            <Button type="button" variant="ghost" size="icon" aria-label="Remove person" onClick={() => set("team", f.team.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => set("team", [...f.team, { name: "", role: "", email: "" }])}><Plus className="mr-1.5 h-4 w-4" /> Add person</Button>
      </Section>

      <Section id="credentials" title="Licences and credentials">
        {f.credentials.map((c, i) => (
          <div key={i} className="grid items-end gap-3 sm:grid-cols-[1fr_1.4fr_auto_auto]">
            <F label="Name" req><Input value={c.name} onChange={(e) => set("credentials", f.credentials.map((x, j) => (j === i ? { ...x, name: e.target.value, status: "pending" } : x)))} /></F>
            <F label="Note"><Input value={c.note} onChange={(e) => set("credentials", f.credentials.map((x, j) => (j === i ? { ...x, note: e.target.value, status: "pending" } : x)))} /></F>
            <span className={cn("mb-2 rounded-full border px-2 py-0.5 text-[11.5px] font-semibold", c.status === "verified" ? "border-[#BBF7D0] bg-[#ECFDF3] text-[#15803D]" : "border-[#F3D9A6] bg-[#FFF4E0] text-[#8A5A06]")}>
              {c.status === "verified" ? "✓ Verified" : "Pending check"}
            </span>
            <Button type="button" variant="ghost" size="icon" aria-label="Remove credential" onClick={() => set("credentials", f.credentials.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => set("credentials", [...f.credentials, { name: "", note: "", status: "pending" }])}><Plus className="mr-1.5 h-4 w-4" /> Add licence or credential</Button>
      </Section>

      <Section id="documents" title="Documents">
        {f.documents.map((d, i) => (
          <div key={d.id ?? d.path} className="grid items-end gap-3 sm:grid-cols-[1.4fr_auto_auto]">
            <F label={`Name · ${d.type || "File"}`}><Input value={d.name} onChange={(e) => set("documents", f.documents.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></F>
            <span className={cn("mb-2 rounded-full border px-2 py-0.5 text-[11.5px] font-semibold", d.checked ? "border-[#BBF7D0] bg-[#ECFDF3] text-[#15803D]" : "border-border bg-muted text-muted-foreground")}>{d.checked ? "✓ Checked" : "Not checked yet"}</span>
            <Button type="button" variant="ghost" size="icon" aria-label="Remove document" onClick={() => set("documents", f.documents.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <input ref={docInput} type="file" accept=".pdf,.docx,.doc,image/*" className="hidden" onChange={(e) => { onDoc(e.target.files?.[0]); e.target.value = ""; }} />
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => docInput.current?.click()}><Upload className="mr-1.5 h-4 w-4" /> Upload document</Button>
        <p className="text-[12px] text-muted-foreground">PDF, DOCX or image. Admin checks each document.</p>
      </Section>

      <div className="sticky bottom-0 z-10 -mx-1 flex items-center justify-between gap-3 rounded-[12px] border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
        <span className="text-[13px] text-muted-foreground">{missing.length ? `Required: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "…" : ""}` : "Ready to save."}</span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={back}>Cancel</Button>
          <Button disabled={busy || uploading} onClick={submit} className="bg-accent text-accent-foreground hover:bg-accent/90">Save changes</Button>
        </div>
      </div>
    </div>
  );
}
