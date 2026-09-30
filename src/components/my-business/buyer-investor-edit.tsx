import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ImagePlus, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { createMyBuyerUploadUrl, getMyBuyerInvestor, saveMyBuyerInvestor } from "@/lib/buyer-investor.functions";
import { REGION_OPTIONS, regionForCountry } from "@/lib/country-region";
import { cn } from "@/lib/utils";

export const BUYER_INVESTOR_KEY = ["buyer-investor", "me"];

// Same taxonomies as Investors Directory › Edit investor.
export const INVESTOR_CLASSIFICATIONS = ["Angel", "Venture Capital", "Private Equity", "Corporate VC", "Family Office", "Corporate Enterprise", "Sovereign Fund", "Incubator/Accelerator"];
const AUM_OPTIONS = ["50M-100M", "100M-250M", "250M-500M", "500M+"];
const TICKETS = ["50K", "100K", "250K", "500K", "1M", "5M", "10M+"];
const STAGES = ["Ideation", "Early Stage", "Growth Stage", "Maturity Stage"];
const INDUSTRIES = ["Sector Agnostic", "FinTech", "eCommerce & Marketplace", "MarTech", "HealthTech", "Sustainability", "Mobility & Logistics", "DeepTech", "Defense", "EdTech", "Gaming", "PropTech", "AgriTech", "FMCG", "Others"];
const FOCUS = ["Thailand", "Southeast Asia", "APAC", "Europe", "North America", "Global"];

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("rounded-full border px-3 py-1 text-xs transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted text-muted-foreground hover:bg-accent")}>
      {children}
    </button>
  );
}
const toggle = (list: string[], v: string, max = 99) => (list.includes(v) ? list.filter((x) => x !== v) : list.length >= max ? list : [...list, v]);

function Field({ label, children, className }: { label: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-1.5", className)}><Label>{label}</Label>{children}</div>;
}

function ChipInput({ values, onChange, max, placeholder }: { values: string[]; onChange: (v: string[]) => void; max: number; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const add = () => { const v = draft.trim(); if (v && !values.includes(v) && values.length < max) onChange([...values, v]); setDraft(""); };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} maxLength={80}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} disabled={values.length >= max} />
        <Button type="button" variant="outline" onClick={add} disabled={!draft.trim() || values.length >= max}>Add</Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
              {v}<button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

async function uploadFile(getUrl: ReturnType<typeof useServerFn<typeof createMyBuyerUploadUrl>>, kind: "logo" | "slot-1" | "slot-2" | "slot-3" | "pof", file: File) {
  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().slice(0, 5);
  const { path, token } = await getUrl({ data: { kind, ext } });
  const { error } = await supabase.storage.from("startup-media").uploadToSignedUrl(path, token, file);
  if (error) throw new Error(error.message);
  return path;
}

/** Buyer › My Company › Edit profile — same fields, same order as Edit investor. */
export function BuyerInvestorEdit() {
  const fetchMe = useServerFn(getMyBuyerInvestor);
  const { data, isLoading, error } = useQuery({ queryKey: BUYER_INVESTOR_KEY, queryFn: () => fetchMe(), meta: { pageLoading: true } });
  if (isLoading) return <div className="mx-auto max-w-3xl space-y-4"><Skeleton className="h-10" /><Skeleton className="h-[600px]" /></div>;
  if (error || !data) return <p className="text-sm text-muted-foreground">Couldn't load your profile. Please refresh.</p>;
  return <Form data={data} />;
}

type Data = Awaited<ReturnType<typeof getMyBuyerInvestor>>;

function Form({ data }: { data: Data }) {
  const inv = data.investor;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const save = useServerFn(saveMyBuyerInvestor);
  const getUrl = useServerFn(createMyBuyerUploadUrl);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    year_founded: inv.year_founded?.toString() ?? "", investor_name: inv.investor_name ?? "", investor_type: inv.investor_type ?? "",
    country: inv.country ?? "", region: regionForCountry(inv.country) || "", city: inv.city ?? "",
    email: inv.email ?? "", website_url: inv.website_url ?? "", linkedin_url: inv.linkedin_url ?? "",
    firm_name: inv.firm_name ?? "", business_address: inv.business_address ?? "",
    aum: inv.aum ?? "", min_ticket_size: inv.min_ticket_size ?? "", max_ticket_size: inv.max_ticket_size ?? "",
    short_description: inv.short_description ?? "",
  });
  const [keywords, setKeywords] = useState(inv.keywords);
  const [focus, setFocus] = useState(inv.investment_focus);
  const [stages, setStages] = useState(inv.preferred_stages);
  const [industries, setIndustries] = useState(inv.preferred_industries);
  const [portfolio, setPortfolio] = useState(inv.portfolio_extra);
  const [logo, setLogo] = useState<{ path: string | null; url: string | null }>({ path: inv.logo_path, url: inv.logo_signed_url });
  const [media, setMedia] = useState(inv.media);
  const [people, setPeople] = useState(data.people.length ? data.people : []);
  const [pof, setPof] = useState<string | null>(data.pof.path);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((o) => ({ ...o, [k]: e.target.value }));
  const back = () => navigate({ to: "/marketplace/my-company" });

  const pick = async (kind: "logo" | "slot-1" | "slot-2" | "slot-3" | "pof", file?: File | null) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("File must be under 10 MB.");
    try {
      const path = await uploadFile(getUrl, kind, file);
      const url = URL.createObjectURL(file);
      if (kind === "logo") setLogo({ path, url });
      else if (kind === "pof") setPof(path);
      else { const slot = Number(kind.slice(-1)) as 1 | 2 | 3; setMedia((m) => [...m.filter((x) => x.slot !== slot), { slot, image_path: path, url }].sort((a, b) => a.slot - b.slot)); }
    } catch (e) { toast.error((e as Error).message); }
  };

  const submit = async () => {
    if (!f.investor_name.trim()) return toast.error("Company Name is required.");
    const yr = f.year_founded.trim() ? Number(f.year_founded) : null;
    setBusy(true);
    try {
      const t = (v: string) => v.trim() || null;
      await save({ data: {
        investor_name: f.investor_name.trim(), investor_type: t(f.investor_type), year_founded: yr && Number.isFinite(yr) ? yr : null,
        country: t(f.country), city: t(f.city), email: t(f.email), website_url: t(f.website_url), linkedin_url: t(f.linkedin_url),
        firm_name: t(f.firm_name), business_address: t(f.business_address), aum: t(f.aum),
        min_ticket_size: t(f.min_ticket_size), max_ticket_size: t(f.max_ticket_size), short_description: t(f.short_description),
        keywords, investment_focus: focus, preferred_stages: stages, preferred_industries: industries, portfolio_extra: portfolio,
        logo_path: logo.path, media: media.map(({ slot, image_path }) => ({ slot: slot as 1 | 2 | 3, image_path })),
        people: people.filter((p) => p.name.trim()), pof_path: pof,
      } });
      await qc.invalidateQueries({ queryKey: BUYER_INVESTOR_KEY });
      await qc.invalidateQueries({ queryKey: ["buyer-profile", "me"] });
      toast.success("Profile saved");
      back();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const nextSlot = ([1, 2, 3] as const).find((s) => !media.some((m) => m.slot === s));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/marketplace/my-company" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to My Company
      </Link>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Edit profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">The same investor record Admin edits in Investors Directory. Changes show in both places.</p>
      </div>

      <div className="space-y-5 rounded-lg border border-border bg-card p-6 shadow-sm">
        {/* Logo · Media · Screenshot · Auto Enrich */}
        <div className="flex flex-wrap items-start gap-6">
          <Field label="Logo">
            <label className="grid h-20 w-20 cursor-pointer place-items-center overflow-hidden rounded-lg border border-dashed border-border bg-muted text-muted-foreground hover:bg-accent">
              {logo.url ? <img src={logo.url} alt="Logo" className="h-full w-full object-cover" /> : <ImagePlus className="h-5 w-5" />}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => pick("logo", e.target.files?.[0])} />
            </label>
          </Field>
          <Field label={<>Media <span className="font-normal text-muted-foreground">({media.length}/3)</span></>}>
            <div className="flex gap-2">
              {media.map((m) => (
                <div key={m.slot} className="relative h-20 w-28 overflow-hidden rounded-lg border border-border bg-muted">
                  {m.url && <img src={m.url} alt={`Media ${m.slot}`} className="h-full w-full object-cover" />}
                  <button type="button" aria-label="Remove media" onClick={() => setMedia((x) => x.filter((y) => y.slot !== m.slot))}
                    className="absolute right-1 top-1 rounded-full bg-background/90 p-0.5"><X className="h-3 w-3" /></button>
                </div>
              ))}
              {nextSlot && (
                <label className="grid h-20 w-28 cursor-pointer place-items-center rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:bg-accent">
                  Slot {nextSlot}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => pick(`slot-${nextSlot}`, e.target.files?.[0])} />
                </label>
              )}
            </div>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-[100px_1fr_220px]">
          <Field label="Year Founded"><Input type="number" min={1900} max={2030} value={f.year_founded} onChange={set("year_founded")} placeholder="e.g. 2020" /></Field>
          <Field label={<>Company Name <span className="text-destructive">*</span></>}><Input value={f.investor_name} onChange={set("investor_name")} maxLength={100} /></Field>
          <Field label="Investor Classification">
            <Select value={f.investor_type || "none"} onValueChange={(v) => setF((o) => ({ ...o, investor_type: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Select classification" /></SelectTrigger>
              <SelectContent><SelectItem value="none">— Select —</SelectItem>{Array.from(new Set([...INVESTOR_CLASSIFICATIONS, ...(f.investor_type ? [f.investor_type] : [])])).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Country"><Input value={f.country} onChange={(e) => { const c = e.target.value; setF((o) => ({ ...o, country: c, region: regionForCountry(c) || o.region })); }} placeholder="e.g. Thailand" /></Field>
          <Field label="Region">
            <Select value={f.region || "none"} onValueChange={(v) => setF((o) => ({ ...o, region: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
              <SelectContent><SelectItem value="none">— Select —</SelectItem>{REGION_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="City"><Input value={f.city} onChange={set("city")} placeholder="e.g. Bangkok" /></Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Email Address"><Input type="email" value={f.email} onChange={set("email")} /></Field>
          <Field label="Company URL"><Input value={f.website_url} onChange={set("website_url")} placeholder="https://" /></Field>
          <Field label="LinkedIn URL"><Input value={f.linkedin_url} onChange={set("linkedin_url")} placeholder="https://linkedin.com/company/…" /></Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Firm Name"><Input value={f.firm_name} onChange={set("firm_name")} /></Field>
          <Field label="Business Address"><Input value={f.business_address} onChange={set("business_address")} /></Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Fund's AUM">
            <Select value={f.aum || "none"} onValueChange={(v) => setF((o) => ({ ...o, aum: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Select AUM" /></SelectTrigger>
              <SelectContent><SelectItem value="none">— Select —</SelectItem>{Array.from(new Set([...AUM_OPTIONS, ...(f.aum ? [f.aum] : [])])).map((a) => <SelectItem key={a} value={a}>{a.replace("-", " – ")}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          {(["min_ticket_size", "max_ticket_size"] as const).map((k) => (
            <Field key={k} label={k === "min_ticket_size" ? "Min Ticket Size" : "Max Ticket Size"}>
              <Select value={f[k] || "none"} onValueChange={(v) => setF((o) => ({ ...o, [k]: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent><SelectItem value="none">— Select —</SelectItem>{Array.from(new Set([...TICKETS, ...(f[k] ? [f[k]] : [])])).map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          ))}
        </div>

        <Field label="About Company"><Textarea rows={5} value={f.short_description} onChange={set("short_description")} maxLength={4000} /></Field>
        <Field label="Product & Service Tags (Up to 5)"><ChipInput values={keywords} onChange={setKeywords} max={5} placeholder="Add a tag" /></Field>
        <Field label={<>Investment Focus <span className="text-xs text-muted-foreground">({focus.length}/10)</span></>}>
          <div className="flex flex-wrap gap-1.5">
            {Array.from(new Set([...FOCUS, ...focus])).map((v) => <Pill key={v} active={focus.includes(v)} onClick={() => setFocus(toggle(focus, v, 10))}>{v}</Pill>)}
          </div>
        </Field>
        <Field label="Preferred Stages">
          <div className="flex flex-wrap gap-1.5">{STAGES.map((v) => <Pill key={v} active={stages.includes(v)} onClick={() => setStages(toggle(stages, v))}>{v}</Pill>)}</div>
        </Field>
        <Field label="Industries">
          <div className="flex flex-wrap gap-1.5">
            {Array.from(new Set([...INDUSTRIES, ...industries])).map((v) => <Pill key={v} active={industries.includes(v)} onClick={() => setIndustries(toggle(industries, v, 20))}>{v}</Pill>)}
          </div>
        </Field>
        <Field label="Portfolio startups">
          {inv.portfolio.filter((n) => !inv.portfolio_extra.includes(n)).length > 0 && (
            <p className="text-xs text-muted-foreground">Linked in Investors Directory: {inv.portfolio.filter((n) => !inv.portfolio_extra.includes(n)).join(", ")}</p>
          )}
          <ChipInput values={portfolio} onChange={setPortfolio} max={50} placeholder="Add a portfolio company" />
        </Field>
      </div>

      <div className="space-y-5 rounded-lg border border-border bg-card p-6 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">For verification · also visible to Admin</h3>
        <Field label="Decision makers">
          <div className="space-y-2">
            {people.map((p, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                {(["name", "role", "email", "phone"] as const).map((k) => (
                  <Input key={k} placeholder={k[0].toUpperCase() + k.slice(1)} value={p[k]}
                    onChange={(e) => setPeople((o) => o.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} />
                ))}
                <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => setPeople((o) => o.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setPeople((o) => [...o, { name: "", role: "", email: "", phone: "" }])}><Plus className="mr-1 h-4 w-4" />Add decision maker</Button>
          </div>
        </Field>
        <Field label="Proof of funds">
          <div className="flex items-center gap-3">
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input px-3 text-sm hover:bg-accent">
              <Upload className="h-4 w-4" />{pof ? "Replace file" : "Upload file"}
              <input type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => pick("pof", e.target.files?.[0])} />
            </label>
            {pof && <span className="truncate text-sm text-muted-foreground">{pof.split("/").pop()}</span>}
            {pof && <Button type="button" variant="ghost" size="sm" onClick={() => setPof(null)}>Remove</Button>}
          </div>
        </Field>
      </div>

      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-background py-4">
        <Button variant="outline" onClick={back} disabled={busy}>Cancel</Button>
        <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
      </div>
    </div>
  );
}
