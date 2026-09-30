import { useState, type KeyboardEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Plus, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CountryCombobox } from "@/components/ui/country-combobox";
import { EditableUrlField } from "@/components/ui/editable-url-field";
import { InvestorAutoEnrichButton } from "@/components/investors/investor-auto-enrich-button";
import type { EnrichInvestorResult } from "@/lib/auto-enrich/investor-enrich-adapter";
import {
  EntityMediaEditor, EMPTY_SLOT, uploadPending,
  type EntityMediaState, type SlotState,
} from "@/components/media/entity-media-editor";
import { supabase } from "@/integrations/supabase/client";
import { createMyBuyerUploadUrl, getMyBuyerInvestor, saveMyBuyerInvestor } from "@/lib/buyer-investor.functions";
import { REGION_OPTIONS, regionForCountry } from "@/lib/country-region";

export const BUYER_INVESTOR_KEY = ["buyer-investor", "me"];

// Same taxonomies as Investors Directory › Edit investor.
export const INVESTOR_CLASSIFICATIONS = ["Angel", "Venture Capital", "Private Equity", "Corporate VC", "Family Office", "Corporate Enterprise", "Sovereign Fund", "Incubator/Accelerator"];
const AUM_OPTIONS = [
  { value: "50M-100M", label: "50M – 100M" },
  { value: "100M-250M", label: "100M – 250M" },
  { value: "250M-500M", label: "250M – 500M" },
  { value: "500M+", label: "500M+" },
];
const TICKET_OPTIONS = [
  { value: "50K-100K", label: "50K – 100K" },
  { value: "100K-500K", label: "100K – 500K" },
  { value: "500K-1M", label: "500K – 1M" },
  { value: "1M-5M", label: "1M – 5M" },
  { value: "5M+", label: "5M+" },
];
const STAGES = ["Ideation", "Early Stage", "Growth Stage", "Maturity Stage"];
const INDUSTRIES = [
  "FinTech", "eCommerce & Marketplace", "MarTech", "HealthTech",
  "Sustainability", "Mobility & Logistics", "DeepTech", "Defense",
  "EdTech", "Gaming", "PropTech", "AgriTech", "FMCG", "Others",
];
const INVESTOR_INDUSTRIES = ["Sector Agnostic", ...INDUSTRIES];

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-muted text-muted-foreground border-border hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

const toggle = (list: string[], v: string, max = 99) =>
  list.includes(v) ? list.filter((x) => x !== v) : list.length >= max ? list : [...list, v];

/** Removable chip row + "Add" input — same look as Edit investor tags. */
function TagEditor({
  values, onChange, max, placeholder, maxLength = 80,
}: { values: string[]; onChange: (v: string[]) => void; max: number; placeholder: string; maxLength?: number }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !values.includes(v) && values.length < max) onChange([...values, v]);
    setDraft("");
  };
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {values.map((v) => (
          <button key={v} type="button" onClick={() => onChange(values.filter((x) => x !== v))}
            className="px-3 py-1 rounded-full text-xs border bg-primary text-primary-foreground border-primary inline-flex items-center gap-1">
            {v} <X className="h-3 w-3" />
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} maxLength={maxLength}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          disabled={values.length >= max} />
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={values.length >= max}>Add</Button>
      </div>
    </>
  );
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

function initialMedia(inv: Data["investor"]): EntityMediaState {
  const slots = [1, 2, 3].map((n): SlotState => {
    const m = inv.media.find((x) => x.slot === n);
    return m ? { persistedPath: m.image_path, signedUrl: m.url ?? null, pendingFile: null, isLocked: false } : EMPTY_SLOT;
  }) as [SlotState, SlotState, SlotState];
  return {
    logo: { persistedPath: inv.logo_path, signedUrl: inv.logo_signed_url, pendingFile: null, isLocked: false },
    slots,
  };
}

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
  const [customIndustry, setCustomIndustry] = useState("");
  const [portfolio, setPortfolio] = useState(inv.portfolio_extra);
  const [media, setMedia] = useState<EntityMediaState>(() => initialMedia(inv));
  const [people, setPeople] = useState(data.people.length ? data.people : []);
  const [pof, setPof] = useState<string | null>(data.pof.path);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((o) => ({ ...o, [k]: e.target.value }));
  const back = () => navigate({ to: "/marketplace/my-company" });

  /** Auto Enrich merge — back-fills ONLY empty fields, same as Edit investor. */
  const applyEnrichment = (r: EnrichInvestorResult) => {
    setF((o) => {
      const t = (cur: string, next?: string) => (!cur.trim() && next?.trim() ? next.trim() : cur);
      const country = t(o.country, r.headquarters);
      return {
        ...o,
        investor_name: t(o.investor_name, r.investorName),
        firm_name: t(o.firm_name, r.firmName),
        investor_type: t(o.investor_type, r.investorType),
        email: t(o.email, r.email),
        business_address: t(o.business_address, r.businessAddress),
        city: t(o.city, r.city),
        linkedin_url: t(o.linkedin_url, r.linkedinUrl),
        short_description: t(o.short_description, r.bio),
        aum: t(o.aum, r.aum),
        min_ticket_size: t(o.min_ticket_size, r.minTicketSize),
        max_ticket_size: t(o.max_ticket_size, r.maxTicketSize),
        year_founded: !o.year_founded.trim() && r.yearFounded ? String(r.yearFounded) : o.year_founded,
        country,
        region: !o.region && country !== o.country ? regionForCountry(country) || o.region : o.region,
      };
    });
    if (keywords.length === 0 && r.keywords?.length) setKeywords(r.keywords.slice(0, 5));
    if (stages.length === 0 && r.preferredStages?.length) setStages(r.preferredStages);
    if (industries.length === 0 && r.preferredIndustries?.length) setIndustries(r.preferredIndustries.slice(0, 5));
    if (focus.length === 0 && r.investmentFocus?.length) setFocus(r.investmentFocus.slice(0, 10));
  };

  const addCustomIndustry = () => {
    const v = customIndustry.trim();
    if (v && !industries.includes(v)) setIndustries([...industries, v]);
    setCustomIndustry("");
  };

  const pickPof = async (file?: File | null) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("File must be under 10 MB.");
    try {
      const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
      const { path, token } = await getUrl({ data: { kind: "pof", ext } });
      const { error } = await supabase.storage.from("startup-media").uploadToSignedUrl(path, token, file, { upsert: true });
      if (error) throw new Error(error.message);
      setPof(path);
    } catch (e) { toast.error((e as Error).message); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.investor_name.trim()) return toast.error("Company Name is required.");
    const yr = f.year_founded.trim() ? Number(f.year_founded) : null;
    setBusy(true);
    try {
      const t = (v: string) => v.trim() || null;
      const { logoPath, media: resolvedMedia } = await uploadPending(
        media,
        ({ kind, ext }) => getUrl({ data: { kind, ext } }),
        supabase.storage.from("startup-media"),
      );
      await save({ data: {
        investor_name: f.investor_name.trim(), investor_type: t(f.investor_type), year_founded: yr && Number.isFinite(yr) ? yr : null,
        country: t(f.country), city: t(f.city), email: t(f.email), website_url: t(f.website_url), linkedin_url: t(f.linkedin_url),
        firm_name: t(f.firm_name), business_address: t(f.business_address), aum: t(f.aum),
        min_ticket_size: t(f.min_ticket_size), max_ticket_size: t(f.max_ticket_size), short_description: t(f.short_description),
        keywords, investment_focus: focus, preferred_stages: stages, preferred_industries: industries, portfolio_extra: portfolio,
        logo_path: logoPath, media: resolvedMedia,
        people: people.filter((p) => p.name.trim()), pof_path: pof,
      } });
      await qc.invalidateQueries({ queryKey: BUYER_INVESTOR_KEY });
      await qc.invalidateQueries({ queryKey: ["buyer-profile", "me"] });
      toast.success("Profile saved");
      back();
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/marketplace/my-company" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to My Company
      </Link>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Edit profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">The same investor record Admin edits in Investors Directory. Changes show in both places.</p>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-card text-sm">
        {/* Logo + Media + Auto Enrich (right-aligned, same row) */}
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <EntityMediaEditor value={media} onChange={setMedia} screenshot={{ websiteUrl: f.website_url }} />
          </div>
          <div className="pt-6 shrink-0">
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <InvestorAutoEnrichButton
                    websiteUrl={f.website_url}
                    onEnriched={applyEnrichment}
                    disabled={busy}
                  />
                </TooltipTrigger>
                <TooltipContent side="bottom">Fills empty fields only</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Row 1: Year Founded | Company Name | Investor Classification */}
        <div className="grid grid-cols-[100px_1fr_220px] gap-4">
          <div className="space-y-1.5">
            <Label>Year Founded</Label>
            <Input type="number" min={1900} max={2030} value={f.year_founded} onChange={set("year_founded")} placeholder="e.g. 2020" />
          </div>
          <div className="space-y-1.5">
            <Label>Company Name <span className="text-destructive">*</span></Label>
            <Input value={f.investor_name} onChange={set("investor_name")} placeholder="e.g. Sequoia Capital" maxLength={100} required />
          </div>
          <div className="space-y-1.5">
            <Label>Investor Classification</Label>
            <Select value={f.investor_type || "none"} onValueChange={(v) => setF((o) => ({ ...o, investor_type: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Select classification" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Select —</SelectItem>
                {Array.from(new Set([...INVESTOR_CLASSIFICATIONS, ...(f.investor_type ? [f.investor_type] : [])])).map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2: Country | Region | City */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <div className="flex h-6 items-center"><Label>Country</Label></div>
            <CountryCombobox
              value={f.country}
              onChange={(v) => setF((o) => ({
                ...o,
                country: v,
                region: !v ? "" : o.region || regionForCountry(v) || "",
              }))}
              placeholder="Select country..."
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex h-6 items-center gap-1.5">
              <Label>Region</Label>
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Re-detect region from Country"
                      onClick={() => {
                        const suggested = regionForCountry(f.country);
                        setF((o) => ({ ...o, region: suggested || "" }));
                        toast.success(
                          suggested
                            ? `Region set to ${suggested}`
                            : f.country ? "No region mapping for this country" : "Set Country first",
                        );
                      }}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Re-detect from Country</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Select value={f.region || ""} onValueChange={(v) => setF((o) => ({ ...o, region: v === "__clear__" ? "" : v }))}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select Region" /></SelectTrigger>
              <SelectContent>
                {f.region && <SelectItem value="__clear__" className="text-muted-foreground">Clear selection</SelectItem>}
                {REGION_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    <span className="font-medium">{r.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground">— {r.description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <div className="flex h-6 items-center"><Label>City</Label></div>
            <Input value={f.city} onChange={set("city")} placeholder="City" />
          </div>
        </div>

        {/* Row 3: Email | Company URL | LinkedIn URL */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Email Address</Label>
            <Input type="email" value={f.email} onChange={set("email")} placeholder="investor@example.com" maxLength={255} />
          </div>
          <div className="space-y-1.5">
            <EditableUrlField
              label="Company URL"
              value={f.website_url}
              onChange={(v) => setF((o) => ({ ...o, website_url: v }))}
              placeholder="https://example.com"
            />
          </div>
          <EditableUrlField
            label="LinkedIn URL"
            value={f.linkedin_url}
            onChange={(v) => setF((o) => ({ ...o, linkedin_url: v }))}
            placeholder="https://www.linkedin.com/company/…"
          />
        </div>

        {/* Row 4: Firm Name | Business Address */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Firm Name</Label>
            <Input value={f.firm_name} onChange={set("firm_name")} placeholder="e.g. Sequoia Capital" maxLength={100} />
          </div>
          <div className="space-y-1.5">
            <Label>Business Address</Label>
            <Input value={f.business_address} onChange={set("business_address")} placeholder="123 Main St, City, Country" maxLength={500} />
          </div>
        </div>

        {/* Row 5: AUM | Min Ticket | Max Ticket */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Fund's AUM</Label>
            <Select value={f.aum || "none"} onValueChange={(v) => setF((o) => ({ ...o, aum: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Select Fund Size" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Select Fund Size —</SelectItem>
                {AUM_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                {f.aum && !AUM_OPTIONS.some((o) => o.value === f.aum) && <SelectItem value={f.aum}>{f.aum}</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          {(["min_ticket_size", "max_ticket_size"] as const).map((k) => (
            <div key={k} className="space-y-1.5">
              <Label>{k === "min_ticket_size" ? "Min Ticket Size" : "Max Ticket Size"}</Label>
              <Select value={f[k] || "none"} onValueChange={(v) => setF((o) => ({ ...o, [k]: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder={k === "min_ticket_size" ? "Select Min" : "Select Max"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{k === "min_ticket_size" ? "— Select Min —" : "— Select Max —"}</SelectItem>
                  {TICKET_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  {f[k] && !TICKET_OPTIONS.some((o) => o.value === f[k]) && <SelectItem value={f[k]}>{f[k]}</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        {/* About */}
        <div className="space-y-1.5">
          <Label>About Company</Label>
          <Textarea value={f.short_description} onChange={set("short_description")} rows={3} maxLength={2000}
            placeholder="Brief description of the company" />
        </div>

        {/* Tags */}
        <div className="space-y-1.5">
          <Label>Product &amp; Service Tags (Up to 5)</Label>
          <TagEditor values={keywords} onChange={setKeywords} max={5} maxLength={50}
            placeholder="Example: Portfolio Management, Due Diligence" />
        </div>

        {/* Geography */}
        <div className="space-y-1.5">
          <Label>Geography <span className="text-xs text-muted-foreground">({focus.length}/10)</span></Label>
          <TagEditor values={focus} onChange={setFocus} max={10} placeholder="Add country..." />
        </div>

        {/* Preferred Stages */}
        <div className="space-y-1.5">
          <Label>Preferred Stages</Label>
          <div className="flex flex-wrap gap-2">
            {STAGES.map((s) => (
              <Pill key={s} active={stages.includes(s)} onClick={() => setStages(toggle(stages, s))}>{s}</Pill>
            ))}
          </div>
        </div>

        {/* Preferred Industries */}
        <div className="space-y-1.5">
          <Label>Preferred Industries</Label>
          <div className="mb-2 flex flex-wrap gap-2">
            {INVESTOR_INDUSTRIES.map((ind) => (
              <Pill key={ind} active={industries.includes(ind)} onClick={() => setIndustries(toggle(industries, ind))}>{ind}</Pill>
            ))}
            {industries.filter((i) => !INVESTOR_INDUSTRIES.includes(i)).map((c) => (
              <button key={c} type="button" onClick={() => setIndustries(industries.filter((x) => x !== c))}
                className="px-3 py-1 rounded-full text-xs border bg-primary text-primary-foreground border-primary inline-flex items-center gap-1">
                {c} <X className="h-3 w-3" />
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={customIndustry} onChange={(e) => setCustomIndustry(e.target.value)} placeholder="Add custom industry..." maxLength={50}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") { e.preventDefault(); addCustomIndustry(); } }} />
            <Button type="button" variant="outline" size="sm" onClick={addCustomIndustry}>Add</Button>
          </div>
        </div>

        {/* Portfolio Startups */}
        <div className="space-y-1.5">
          <Label>Portfolio Startups</Label>
          {inv.portfolio.filter((n) => !inv.portfolio_extra.includes(n)).length > 0 && (
            <p className="text-xs text-muted-foreground">
              Linked in Investors Directory: {inv.portfolio.filter((n) => !inv.portfolio_extra.includes(n)).join(", ")}
            </p>
          )}
          <TagEditor values={portfolio} onChange={setPortfolio} max={50} placeholder="Add a portfolio company" />
        </div>

        {/* For verification */}
        <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">For verification · also visible to Admin</h3>
          <div className="space-y-1.5">
            <Label>Decision makers</Label>
            <div className="space-y-2">
              {people.map((p, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                  {(["name", "role", "email", "phone"] as const).map((k) => (
                    <Input key={k} placeholder={k[0].toUpperCase() + k.slice(1)} value={p[k]}
                      onChange={(e) => setPeople((o) => o.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} />
                  ))}
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => setPeople((o) => o.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setPeople((o) => [...o, { name: "", role: "", email: "", phone: "" }])}>
                <Plus className="mr-1 h-4 w-4" />Add decision maker
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Proof of funds</Label>
            <div className="flex items-center gap-3">
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input px-3 text-sm hover:bg-accent">
                <Upload className="h-4 w-4" />{pof ? "Replace file" : "Upload file"}
                <input type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => void pickPof(e.target.files?.[0])} />
              </label>
              {pof && <span className="truncate text-sm text-muted-foreground">{pof.split("/").pop()}</span>}
              {pof && <Button type="button" variant="ghost" size="sm" onClick={() => setPof(null)}>Remove</Button>}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4 shadow-card">
          <p className="text-xs text-muted-foreground">
            Required fields are marked with <span className="text-destructive">*</span>
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={back} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy || !f.investor_name.trim()}>{busy ? "Saving…" : "Save changes"}</Button>
          </div>
        </div>
      </form>
    </div>
  );
}
