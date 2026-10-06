import { EditSec, useOpenAtSection } from "@/components/common/edit-section";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { isCorporateBuyer } from "@/lib/investor-browse";
import {
  AUM_BANDS, DEAL_TYPES, GEOGRAPHY, INDIVIDUAL_TYPE, REV_BANDS, SECTOR_AGNOSTIC, STAGE_OPTIONS, TICKET_BANDS,
  descriptionError, descriptionLeaks, regError, showsStages, yearError,
} from "@/lib/investor-bands";
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
export const INVESTOR_CLASSIFICATIONS = [INDIVIDUAL_TYPE, "Angel", "Venture Capital", "Private Equity", "Corporate VC", "Family Office", "Corporate Enterprise", "Sovereign Fund", "Incubator/Accelerator"];
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
export function BuyerInvestorEdit({ section, add }: { section?: string; add?: boolean } = {}) {
  const fetchMe = useServerFn(getMyBuyerInvestor);
  const { data, isLoading, error } = useQuery({ queryKey: BUYER_INVESTOR_KEY, queryFn: () => fetchMe(), meta: { pageLoading: true } });
  if (isLoading) return <div className="mx-auto max-w-3xl space-y-4"><Skeleton className="h-10" /><Skeleton className="h-[600px]" /></div>;
  if (error || !data) return <p className="text-sm text-muted-foreground">Couldn't load your profile. Please refresh.</p>;
  return <Form data={data} section={section} add={add} />;
}

export type SourceTag = "Your answer" | "Auto Enrich" | "Company registry" | "From your account";
export type SetupMode = { onBack: () => void; sources: Record<string, SourceTag>; onSaved: (msg: string) => void; enrich?: EnrichInvestorResult | null };

/** Review & complete in the setup wizard: the same form, with source tags. */
export function BuyerInvestorForm({ data, setup }: { data: Data; setup?: SetupMode }) {
  return <Form data={data} setup={setup} />;
}

function Tag({ s }: { s?: SourceTag }) {
  if (!s) return null;
  const cls = s === "Your answer" ? "bg-[#EEF1F7] text-[#1E2A4A] dark:bg-[#1B2140] dark:text-[#C7CEF5]" : s === "Auto Enrich" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-muted text-muted-foreground";
  return <span className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>{s}</span>;
}

export type Data = Awaited<ReturnType<typeof getMyBuyerInvestor>>;

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

function Form({ data, setup, section, add }: { data: Data; setup?: SetupMode; section?: string; add?: boolean }) {
  const inv = data.investor;
  const src = setup?.sources ?? {};
  const rel = data.buyer.relation;
  const individual = rel === "individual";
  const [errs, setErrs] = useState<Record<string, string>>({});
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
    aum_band: inv.aum_band ?? "", ticket_band: inv.ticket_band ?? "", rev_band: inv.revenue_min_band ?? "",
    aum_exact: inv.aum_exact_usd != null ? inv.aum_exact_usd.toLocaleString("en-US") : "",
    registration_no: inv.registration_no ?? "", description: data.buyer.description ?? "",
  });
  const [deals, setDeals] = useState<string[]>(data.buyer.deal_types);
  const [keywords, setKeywords] = useState(inv.keywords);
  const [focus, setFocus] = useState(inv.investment_focus);
  const [stages, setStages] = useState(inv.preferred_stages);
  const showsFund = !individual && rel !== "agent";
  // Fund falls back to Investor Classification when the form hides the band.
  const sec = section === "fund" && !showsFund ? "classification" : section;
  const S = ({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) => (
    <EditSec id={id} tone="buyer" active={!setup && sec === id} className={className}>{children}</EditSec>
  );
  useOpenAtSection(setup ? undefined : sec, true, sec === "people" && add ? { focusSelector: "[data-row]:last-child input" } : sec === "industries" ? { focusSelector: "input[type=checkbox]" } : undefined);
  const [industries, setIndustries] = useState(inv.preferred_industries);
  const [customIndustry, setCustomIndustry] = useState("");
  const [portfolio, setPortfolio] = useState(inv.portfolio_extra);
  const [media, setMedia] = useState<EntityMediaState>(() => initialMedia(inv));
  const [people, setPeople] = useState(() => {
    if (section === "people" && add) return [...data.people, { name: "", role: "", email: "", phone: "" }];
    if (data.people.length) return data.people;
    if (setup && rel !== "agent" && data.account.name) return [{ name: data.account.name, role: data.account.title, email: "", phone: "" }];
    return [];
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((o) => ({ ...o, [k]: e.target.value }));
  const back = () => (setup ? setup.onBack() : navigate({ to: "/marketplace/my-company" }));

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

  const enrichedOnce = useRef(false);
  useEffect(() => {
    if (setup?.enrich && !enrichedOnce.current) { enrichedOnce.current = true; applyEnrichment(setup.enrich); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup?.enrich]);

  const addCustomIndustry = () => {
    const v = customIndustry.trim();
    if (v && !industries.includes(v)) setIndustries([...industries, v]);
    setCustomIndustry("");
  };

  const leaks = descriptionLeaks(f.description, f.investor_name, f.website_url);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const checks: [string, string | null][] = [
      ["year_founded", individual ? null : yearError(f.year_founded)],
      ["investor_name", f.investor_name.trim().length < 2 ? "Add your firm's name." : null],
      ["website_url", /^(https?:\/\/)?[\w-]+(\.[\w-]+)+/i.test(f.website_url.trim()) ? null : "Enter a valid website address, e.g. www.yourfirm.com"],
      ["description", f.description.trim() ? descriptionError(f.description) || (leaks.length ? "leak" : null) : null],
      ["registration_no", individual ? null : regError(f.registration_no, f.country)],
    ];
    const bad = checks.find(([, m]) => m);
    if (bad) {
      setErrs({ [bad[0]]: bad[1]! });
      document.getElementById(`f-${bad[0]}`)?.focus();
      return;
    }
    setErrs({});
    const yr = individual ? null : Number(f.year_founded);
    setBusy(true);
    try {
      const t = (v: string) => v.trim() || null;
      const { logoPath, media: resolvedMedia } = await uploadPending(
        media,
        ({ kind, ext }) => getUrl({ data: { kind, ext } }),
        supabase.storage.from("startup-media"),
      );
      const exact = Number(f.aum_exact.replace(/[^\d.]/g, ""));
      await save({ data: {
        investor_name: f.investor_name.trim(), investor_type: t(f.investor_type), year_founded: yr && Number.isFinite(yr) ? yr : null,
        country: t(f.country), city: t(f.city), email: t(f.email), website_url: t(f.website_url), linkedin_url: t(f.linkedin_url),
        firm_name: t(f.firm_name), business_address: t(f.business_address),
        short_description: t(f.short_description),
        aum_band: individual || rel === "agent" ? null : (f.aum_band || null) as never,
        ticket_band: (f.ticket_band || null) as never,
        revenue_min_band: (f.rev_band || null) as never,
        aum_exact_usd: f.aum_exact.trim() && Number.isFinite(exact) ? exact : null,
        registration_no: individual ? null : t(f.registration_no),
        description: f.description.trim(), deal_types: deals,
        keywords, investment_focus: focus, preferred_stages: stages, preferred_industries: industries, portfolio_extra: portfolio,
        logo_path: logoPath, media: resolvedMedia,
        people: people.filter((p) => p.name.trim()),
      } });
      await qc.invalidateQueries({ queryKey: BUYER_INVESTOR_KEY });
      await qc.invalidateQueries({ queryKey: ["buyer-profile", "me"] });
      const live = data.buyer.status === "live";
      const ready = !!f.ticket_band && deals.length > 0 && industries.length > 0 && (!showsStages(f.investor_type) || stages.length > 0);
      const msg = live ? "Profile saved. Sellers see the changes in Browse investors."
        : ready ? "Profile saved as a draft. Publish it when you're ready." : "Profile saved as a draft. Finish the required items to publish.";
      if (setup) setup.onSaved(msg);
      else { toast.success(msg); back(); }
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };
  const Err = ({ k }: { k: string }) => errs[k] && errs[k] !== "leak" ? <p className="text-[12.5px] text-[#B42318]">{errs[k]}</p> : null;
  const req = <span className="ml-[3px] text-[12px] font-semibold text-[#B42318] relative -top-0.5">*</span>;
  const corp = isCorporateBuyer(f.investor_type);
  const allStages = Array.from(new Set([...STAGE_OPTIONS, ...stages]));
  const allGeo = Array.from(new Set([...GEOGRAPHY, ...focus]));
  const allDeals = Array.from(new Set([...DEAL_TYPES, ...deals]));
  const agnostic = industries.includes(SECTOR_AGNOSTIC);

  return (
    <div className={setup ? "space-y-6" : "mx-auto max-w-3xl space-y-6"}>
      {!setup && (
        <>
          <Link to="/marketplace/my-company" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to My Company
          </Link>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Edit profile</h1>
            <p className="mt-1 text-sm text-muted-foreground">The same investor record Admin edits in Investors Directory. Changes show in both places.</p>
          </div>
        </>
      )}

      <form onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-card text-sm">
        {/* Logo + Media + Auto Enrich (right-aligned, same row) */}
        <S id="media"><div className="flex items-start gap-4">
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
        </div></S>

        {/* Row 1: Year Founded | Company Name | Investor Classification */}
        <div className="grid grid-cols-[100px_1fr_220px] gap-4">
          <div className="space-y-1.5">
            <Label>Year Founded{!individual && req}<Tag s={src.year_founded} /></Label>
            <Input id="f-year_founded" inputMode="numeric" maxLength={4} aria-required={!individual} value={f.year_founded}
              onChange={(e) => setF((o) => ({ ...o, year_founded: e.target.value.replace(/\D/g, "").slice(0, 4) }))} placeholder="e.g. 2014"
              className={errs.year_founded ? "border-[#B42318]" : ""} />
            <Err k="year_founded" />
          </div>
          <div className="space-y-1.5">
            <Label>Company Name{req}<Tag s={src.investor_name} /></Label>
            <Input id="f-investor_name" aria-required value={f.investor_name} onChange={set("investor_name")} placeholder="e.g. Acme Ventures" maxLength={120}
              className={errs.investor_name ? "border-[#B42318]" : ""} />
            <Err k="investor_name" />
          </div>
          <S id="classification" className="space-y-1.5">
            <Label>Investor Classification<Tag s={src.investor_type} /></Label>
            <Select value={f.investor_type || "none"} onValueChange={(v) => setF((o) => ({ ...o, investor_type: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Select classification" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Select —</SelectItem>
                {Array.from(new Set([...INVESTOR_CLASSIFICATIONS, ...(f.investor_type ? [f.investor_type] : [])])).map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </S>
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
              label="Company URL *"
              value={f.website_url}
              onChange={(v) => setF((o) => ({ ...o, website_url: v }))}
              placeholder="https://www.yourfirm.com"
            />
            <input id="f-website_url" className="sr-only" readOnly tabIndex={-1} aria-hidden value={f.website_url} />
            <Err k="website_url" />
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

        {/* Fund & ticket — US$ bands */}
        {showsFund && (
          <S id="fund"><div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{corp ? "Group revenue band" : "Fund's AUM band"}<Tag s={src.aum_band} /></Label>
              <Select value={f.aum_band || "none"} onValueChange={(v) => setF((o) => ({ ...o, aum_band: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Not set" /></SelectTrigger>
                <SelectContent>
                  {!inv.aum_band && <SelectItem value="none">Not set</SelectItem>}
                  {AUM_BANDS.map((b) => <SelectItem key={b.key} value={b.key}>{b.label} ({b.baht})</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[12px] text-muted-foreground">Sellers see this band on your card.</p>
            </div>
            <div className="space-y-1.5">
              <Label>{corp ? "Exact group revenue (US$)" : "Exact AUM (US$)"} <span className="text-[#9CA3AF] font-normal">optional</span></Label>
              <Input inputMode="numeric" value={f.aum_exact} placeholder="e.g. 120,000,000"
                onChange={(e) => { const d = e.target.value.replace(/[^\d]/g, ""); setF((o) => ({ ...o, aum_exact: d ? Number(d).toLocaleString("en-US") : "" })); }} />
              <p className="text-[12px] text-muted-foreground">Private. Only sellers who approve your NDA see it.</p>
            </div>
          </div></S>
        )}
        <S id="mandate" className="space-y-1.5">
          <Label>Average investment per deal<Tag s={src.ticket_band} /></Label>
          <Select value={f.ticket_band || "none"} onValueChange={(v) => setF((o) => ({ ...o, ticket_band: v === "none" ? "" : v }))}>
            <SelectTrigger><SelectValue placeholder="Not set" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not set</SelectItem>
              {TICKET_BANDS.map((b) => <SelectItem key={b.key} value={b.key}>{b.label} ({b.baht})</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-[12px] text-muted-foreground">Fills Min / Max Ticket Size. Sellers see this range on your card and filter Browse investors by it.</p>
        </S>
        {/* Buying Requirement */}
        <div className="space-y-1.5 border-t border-[#F0F1F4] pt-4 dark:border-border">
          <div className="text-[11px] font-bold uppercase tracking-[.07em] text-[#6B7280]">Buying Requirement</div>
          <Label>Min. target revenue<Tag s={src.revenue_min_band} /></Label>
          <Select value={f.rev_band || "none"} onValueChange={(v) => setF((o) => ({ ...o, rev_band: v === "none" ? "" : v }))}>
            <SelectTrigger className="max-w-[360px]"><SelectValue placeholder="Not set" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not set</SelectItem>
              {REV_BANDS.map((b) => <SelectItem key={b.key} value={b.key}>{b.label} ({b.baht})</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-[12px] text-muted-foreground">The smallest company revenue you'll buy. Sellers can filter by it.</p>
        </div>
        <S id="focus" className="space-y-1.5">
          <Label>Investment Focus<Tag s={src.deal_types} /></Label>
          <div className="flex flex-wrap gap-2">
            {allDeals.map((d) => <Pill key={d} active={deals.includes(d)} onClick={() => setDeals(toggle(deals, d))}>{d}</Pill>)}
          </div>
        </S>

        {/* About */}
        <div className="space-y-1.5">
          <Label>About Company</Label>
          <Textarea value={f.short_description} onChange={set("short_description")} rows={3} maxLength={2000}
            placeholder="Brief description of the company" />
        </div>

        {/* Tags */}
        <S id="keywords" className="space-y-1.5">
          <Label>Product &amp; Service Tags (Up to 5)</Label>
          <TagEditor values={keywords} onChange={setKeywords} max={5} maxLength={50}
            placeholder="Example: Portfolio Management, Due Diligence" />
        </S>

        {/* Geography */}
        <div className="space-y-1.5">
          <Label>Geography<Tag s={src.geography} /></Label>
          <div className="flex flex-wrap gap-2">
            {allGeo.map((g) => <Pill key={g} active={focus.includes(g)} onClick={() => setFocus(toggle(focus, g, 10))}>{g}</Pill>)}
          </div>
        </div>

        {/* Preferred Stages */}
        {showsStages(f.investor_type) && <S id="stages" className="space-y-1.5">
          <Label>Preferred Stages</Label>
          <div className="flex flex-wrap gap-2">
            {allStages.map((s) => (
              <Pill key={s} active={stages.includes(s)} onClick={() => setStages(toggle(stages, s))}>{s}</Pill>
            ))}
          </div>
        </S>}

        {/* Preferred Industries */}
        <S id="industries" className="space-y-1.5">
          <Label>Preferred Industries<Tag s={src.preferred_industries} /></Label>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={agnostic} onChange={() => setIndustries(agnostic ? industries.filter((x) => x !== SECTOR_AGNOSTIC) : [SECTOR_AGNOSTIC, ...industries])} />
            <b className="font-semibold">Sector agnostic</b> <span className="text-muted-foreground">I look at companies in every industry</span>
          </label>
          {agnostic && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">Sellers may avoid sector-agnostic investors because there's no clear focus. Picking up to 5 industries helps the right sellers find you.</p>}
          <div className={`mb-2 flex flex-wrap gap-2 ${agnostic ? "pointer-events-none opacity-50" : ""}`}>
            {INVESTOR_INDUSTRIES.filter((x) => x !== SECTOR_AGNOSTIC).map((ind) => (
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
        </S>

        {/* Public view */}
        <div className="space-y-1.5 rounded-lg border border-[#CFD2FB] bg-[#EEF0FF]/50 p-4 dark:border-[#2E3570] dark:bg-[#1B2140]/50">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Public view · sellers see this before an NDA</h3>
          <Label>Description <span className="font-normal text-[#9CA3AF]">10 to 140 characters</span><Tag s={src.description} /></Label>
          <Textarea id="f-description" value={f.description} onChange={(e) => setF((o) => ({ ...o, description: e.target.value.slice(0, 140) }))} rows={3} maxLength={140}
            placeholder="e.g. Family office backing profitable Thai companies with succession or growth plans" className={errs.description ? "border-[#B42318]" : ""} />
          <div className="flex justify-between text-[12px]">
            <span className="text-[#B42318]">{errs.description && errs.description !== "leak" ? errs.description : ""}</span>
            <span className="text-muted-foreground">{f.description.length} / 140</span>
          </div>
          {leaks.length > 0 && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">Your description mentions <b>{leaks.join(", ")}</b>. Sellers read it before an NDA, so leave out names, websites and contact details.</p>}
        </div>

        {/* Portfolio Startups */}
        <S id="portfolio" className="space-y-1.5">
          <Label>Portfolio Startups</Label>
          {inv.portfolio.filter((n) => !inv.portfolio_extra.includes(n)).length > 0 && (
            <p className="text-xs text-muted-foreground">
              Linked in Investors Directory: {inv.portfolio.filter((n) => !inv.portfolio_extra.includes(n)).join(", ")}
            </p>
          )}
          <TagEditor values={portfolio} onChange={setPortfolio} max={50} placeholder="Add a portfolio company" />
        </S>

        {/* For verification */}
        <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">For verification · also visible to Admin</h3>
          {!individual && (
            <div className="space-y-1.5">
              <Label>{f.country === "Thailand" ? <>Company Registration Number (เลขทะเบียนนิติบุคคล){req}</> : <>Company registration number <span className="font-normal text-[#9CA3AF]">optional</span></>}<Tag s={src.registration_no} /></Label>
              <Input id="f-registration_no" value={f.registration_no} aria-required={f.country === "Thailand"}
                maxLength={f.country === "Thailand" ? 13 : 50} placeholder={f.country === "Thailand" ? "13 digits" : ""}
                inputMode={f.country === "Thailand" ? "numeric" : undefined}
                onChange={(e) => setF((o) => ({ ...o, registration_no: o.country === "Thailand" ? e.target.value.replace(/\D/g, "").slice(0, 13) : e.target.value }))}
                className={errs.registration_no ? "border-[#B42318]" : ""} />
              <Err k="registration_no" />
            </div>
          )}
          <S id="people" className="space-y-1.5">
            <Label>Decision makers</Label>
            <div className="space-y-2">
              {people.map((p, i) => (
                <div key={i} data-row className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
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
          </S>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4 shadow-card">
          <p className="text-xs text-muted-foreground">
            Required fields are marked with <span className="text-destructive">*</span>
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={back} disabled={busy}>{setup ? "Back to answers" : "Cancel"}</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : setup ? "Save profile" : "Save changes"}</Button>
          </div>
        </div>
      </form>
    </div>
  );
}
