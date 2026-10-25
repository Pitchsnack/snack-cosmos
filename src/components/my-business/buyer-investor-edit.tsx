import { missingCreationFields } from "@/lib/profile-edit-rules";
import { RelationshipLinksEditor, type RelationshipRow } from "@/components/relationships/relationship-links-editor";
import { tr } from "@/i18n/language";
import { CompanyTypeField, companyTypeForRelation } from "@/components/common/company-type-field";
import { ActsForField } from "@/components/investors/acts-for-field";
import { SetSectorPicker } from "@/components/common/set-sector-picker";
import { CompanySizeField } from "@/components/investors/company-size-field";
import { EditSec, useOpenAtSection } from "@/components/common/edit-section";
import { CompactFields, EditInfoFooter, EditInfoTabsSlot, MainTabs, TabHead, TabRow, useEditInfo } from "@/components/common/edit-info-popup";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { isCorporateBuyer } from "@/lib/investor-browse";
import {
  AUM_BANDS, DEAL_TYPES, GEOGRAPHY, INDIVIDUAL_TYPE, REV_BANDS, SECTOR_AGNOSTIC, STAGE_OPTIONS, TICKET_BANDS,
  descriptionError, descriptionLeaks, regError, showsStages, sortActsFor, yearError,
} from "@/lib/investor-bands";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Eye, Lock, Shield, Plus, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AddressBox, addrErrors, type Addr } from "@/components/common/business-address";
import { EditableUrlField } from "@/components/ui/editable-url-field";
import { InvestorAutoEnrichButton } from "@/components/investors/investor-auto-enrich-button";
import type { EnrichInvestorResult } from "@/lib/auto-enrich/investor-enrich-adapter";
import {
  EntityMediaEditor, EMPTY_SLOT, uploadPending,
  type EntityMediaState, type SlotState,
} from "@/components/media/entity-media-editor";
import { supabase } from "@/integrations/supabase/client";
import { createMyBuyerUploadUrl, getBuyerInvestorById, getMyBuyerInvestor, saveMyBuyerInvestor } from "@/lib/buyer-investor.functions";
import { useInvestor } from "@/hooks/use-investor";
import { createInvestor, updateInvestor } from "@/lib/investors.functions";
import { listAssignableTenants } from "@/lib/tenants.functions";
import { listAssignableUsers } from "@/lib/startup-ownership.functions";
import { useSessionContext } from "@/hooks/use-session-context";
import { REGION_OPTIONS, regionForCountry } from "@/lib/country-region";

export const BUYER_INVESTOR_KEY = ["buyer-investor", "me"];
/** One investor profile by id (the wizard, Buyer › My Company with several profiles). */
export const buyerInvestorKey = (id: string) => ["buyer-investor", "id", id];

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
function S({ id, cur, className, children }: { id: string; cur?: string; className?: string; children: React.ReactNode }) {
  return <EditSec id={id} tone="buyer" active={cur === id} className={className}>{children}</EditSec>;
}

export function BuyerInvestorEdit({ section, add, id, directory, initialView }: { section?: string; add?: boolean; id?: string; directory?: boolean; initialView?: "public" | "private" } = {}) {
  const fetchMe = useServerFn(getMyBuyerInvestor);
  const fetchById = useServerFn(getBuyerInvestorById);
  const directoryData = useInvestor(directory ? id : undefined);
  const { data, isLoading, error } = useQuery({
    // Own key: the card and setup page cache an { ok, data } wrapper under buyerInvestorKey(id).
    queryKey: id ? [...buyerInvestorKey(id), "edit"] : BUYER_INVESTOR_KEY,
    queryFn: async () => { if (!id) return fetchMe(); const r = await fetchById({ data: { id } }); if (!r.ok) throw new Error("This profile isn't yours."); return r.data as Data; },
    meta: { pageLoading: true },
  });
  if (isLoading || (directory && directoryData.isLoading)) return <div className="mx-auto max-w-3xl space-y-4"><Skeleton className="h-10" /><Skeleton className="h-[600px]" /></div>;
  if (error || !data) return <p className="text-sm text-muted-foreground">Couldn't load your profile. Please refresh.</p>;
  return <Form data={data} section={section} add={add} directory={directory} initialView={initialView} directoryRecord={directoryData.data} />;
}

export type SourceTag = "Your answer" | "Auto Enrich" | "Company registry";
export type SetupMode = { onBack: () => void; sources: Record<string, SourceTag>; onSaved: (msg: string) => void; enrich?: EnrichInvestorResult | null };

/** Review & complete in the setup wizard: the same form, with source tags. */
export function BuyerInvestorForm({ data, setup, onCreated }: { data: Data; setup?: SetupMode; onCreated?: (id:string) => void; directoryRecord?: NonNullable<ReturnType<typeof useInvestor>["data"]> }) {
  return <Form data={data} setup={setup} directory={!!onCreated} onCreated={onCreated} />;
}

function Tag({ s }: { s?: SourceTag }) {
  if (!s) return null;
  const cls = s === "Your answer" ? "bg-[#EEF1F7] text-[#1E2A4A] dark:bg-[#1B2140] dark:text-[#C7CEF5]" : s === "Auto Enrich" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-muted text-muted-foreground";
  return <span className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>{s}</span>;
}

export type Data = Awaited<ReturnType<typeof getMyBuyerInvestor>>;

function mediaMissing(inv: Data["investor"]) { return inv.logo_path ? 0 : 1; }

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

function Form({ data, setup, section, add, directory, initialView, onCreated, directoryRecord }: { data: Data; setup?: SetupMode; section?: string; add?: boolean; directory?: boolean; initialView?: "public" | "private"; onCreated?: (id:string) => void; directoryRecord?: NonNullable<ReturnType<typeof useInvestor>["data"]> }) {
  const {data:session} = useSessionContext();
  const admin = session?.user?.accountRole === "admin";
  const create = useServerFn(createInvestor);
  const updateDirectory = useServerFn(updateInvestor);
  const [companyType,setCompanyType] = useState(data.investor.company_type ?? "");
  const [companyTypeDirty,setCompanyTypeDirty] = useState(false);
  const [companyTypeReset,setCompanyTypeReset] = useState(false);
  const getTenants = useServerFn(listAssignableTenants);
  const getUsers = useServerFn(listAssignableUsers);
  const [tenant,setTenant] = useState(directoryRecord?.tenant_id ?? session?.activeWorkspace.tenantId ?? "");
  const [directoryStatus,setDirectoryStatus] = useState(directoryRecord?.status ?? "Prospect");
  const [directoryVisibility,setDirectoryVisibility] = useState(directoryRecord?.visibility ?? "Tenant");
  const [legalName,setLegalName] = useState(directoryRecord?.legal_name ?? "");
  const [longDescription,setLongDescription] = useState(directoryRecord?.long_description ?? "");
  const [human,setHuman] = useState(directoryRecord?.investor_ownership?.owning_agent_user_id ?? "");
  const [ai,setAi] = useState(directoryRecord?.investor_ai_ownership?.owning_ai_agent_id ?? "");
  const tenants = useQuery({queryKey:["investor-form-tenants"],queryFn:()=>getTenants(),enabled:admin && !!directory});
  const humans = useQuery({queryKey:["investor-form-humans",tenant],queryFn:()=>getUsers({data:{tenantId:tenant,userType:"Human"}}),enabled:admin && !!directory && !!tenant});
  const ais = useQuery({queryKey:["investor-form-ais",tenant],queryFn:()=>getUsers({data:{tenantId:tenant,userType:"AI"}}),enabled:admin && !!directory && !!tenant});

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
    year_founded: inv.year_founded?.toString() ?? "", company_size_band: inv.company_size_band ?? "", investor_name: inv.investor_name ?? "", investor_type: inv.investor_type ?? "",
    country: inv.country ?? "", region: regionForCountry(inv.country) || "", city: inv.city ?? "",
    email: inv.email ?? "", website_url: inv.website_url ?? "", linkedin_url: inv.linkedin_url ?? "",
    firm_name: inv.firm_name ?? "", business_address: inv.business_address ?? "",
    aum: inv.aum ?? "", min_ticket_size: inv.min_ticket_size ?? "", max_ticket_size: inv.max_ticket_size ?? "",
    short_description: inv.short_description ?? "",
    aum_band: inv.aum_band ?? "", ticket_band: inv.ticket_band ?? "", rev_band: inv.revenue_min_band ?? "",
    aum_exact: inv.aum_exact_usd != null ? inv.aum_exact_usd.toLocaleString("en-US") : "",
    registration_no: inv.registration_no ?? "", description: data.buyer.description ?? "",
  });
  const [addr, setAddrS] = useState<Addr>({ street: inv.address_line1 ?? "", unit: inv.address_line2 ?? "", district: inv.address_city_district ?? "", province: inv.address_province_state ?? "", postal: inv.postal_code ?? "" });
  const [addrDirty, setAddrDirty] = useState(false);
  const [addrShow, setAddrShow] = useState(false);
  const thaiAddr = (f.country || "Thailand") === "Thailand";
  const setAddr = (p: Partial<Addr>) => { setAddrS((o) => ({ ...o, ...p })); setAddrDirty(true); };
  const changeCountry = (c: string) => {
    setF((o) => ({ ...o, country: c, registration_no: "", region: !c ? "" : regionForCountry(c) || o.region }));
    setAddrS({ street: "", unit: "", district: "", province: "", postal: "" }); setAddrDirty(true);
  };
  const addrErr = addrDirty ? addrErrors(addr, thaiAddr, addr.district) : null;
  const agent = rel === "agent";
  const [actsFor, setActsFor] = useState<string[]>(() => sortActsFor(inv.acts_for_types?.length ? inv.acts_for_types : inv.investor_type ? [inv.investor_type] : []));
  const typeOf = agent ? actsFor[0] ?? "" : f.investor_type;
  const [deals, setDeals] = useState<string[]>(data.buyer.deal_types);
  const [keywords, setKeywords] = useState(inv.keywords ?? []);
  const [focus, setFocus] = useState(inv.investment_focus);
  const [stages, setStages] = useState(inv.preferred_stages);
  const showsFund = !individual && rel !== "agent";
  const buyerMissing = {media: mediaMissing(inv),about:[!individual && !!yearError(f.year_founded),!f.investor_name.trim(),!f.website_url.trim()].filter(Boolean).length,address:0,people:!individual && !!regError(f.registration_no,f.country) ? 1 : 0};
  // Fund falls back to Investor Classification when the form hides the band.
  type Tab = "media" | "about" | "address" | "industries" | "people" | "description" | "mandate" | "admin";
  const tabFor = (field?: string): Tab => field === "description" ? "description" : ["fund","mandate","revenue","focus","geography"].includes(field ?? "") ? "mandate" : ["country","address"].includes(field ?? "") ? "address" : ["industries","portfolio","keywords","stages"].includes(field ?? "") ? "industries" : field === "people" ? "people" : field === "media" ? "media" : "about";
  const [tab, setTab] = useState<Tab>(onCreated ? "about" : section ? tabFor(section) : initialView === "public" ? "description" : "media");
  const [view, setView] = useState<"public" | "private">(initialView ?? (section && ["description","mandate"].includes(tabFor(section)) ? "public" : "private"));
  const sec = section === "fund" && !showsFund ? "classification" : section;
  useOpenAtSection(setup ? undefined : sec, true, sec === "people" && add ? { focusSelector: "div[data-row]:last-of-type input" } : sec === "industries" ? { focusSelector: "button[role=checkbox]" } : undefined);
  const [industries, setIndustries] = useState(inv.preferred_industries);
  const [customIndustry, setCustomIndustry] = useState("");
  const [linkedPortfolio, setLinkedPortfolio] = useState<RelationshipRow[]>(()=>(directoryRecord?.linked_startups ?? []).map(x=>({id:x.id,refId:x.id,name:x.startup_name,subtitle:null,industry:null,relationshipType:"investment",status:"linked"})));
  const [linkedDirty,setLinkedDirty] = useState(false);
  const [revenueMin,setRevenueMin] = useState(inv.revenue_min_m?.toString() ?? "");
  const [revenueMax,setRevenueMax] = useState(inv.revenue_max_m?.toString() ?? "");
  const [portfolioDirty, setPortfolioDirty] = useState(false);
  const [portfolio, setPortfolio] = useState(inv.portfolio_extra);
  const [media, setMedia] = useState<EntityMediaState>(() => initialMedia(inv));
  const [people, setPeople] = useState(() => {
    if (section === "people" && add) return [...data.people, { name: "", role: "", email: "", phone: "" }];
    if (data.people.length) return data.people;
    if (setup && rel !== "agent" && data.account.name) return [{ name: data.account.name, role: data.account.title, email: "", phone: "" }];
    return [];
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((o) => ({ ...o, [k]: e.target.value }));
  const pop = useEditInfo();
  const editSnapshot = JSON.stringify([f,addr,companyType,companyTypeDirty,companyTypeReset,tenant,directoryStatus,directoryVisibility,legalName,longDescription,human,ai,deals,keywords,focus,stages,actsFor,industries,portfolio,media,people,linkedPortfolio,revenueMin,revenueMax]);
  const originalSnapshot = useRef(editSnapshot);
  useEffect(()=>{pop?.setDirty(editSnapshot !== originalSnapshot.current);},[editSnapshot]);

  useEffect(() => { pop?.setPresentation(f.investor_name, tr(view === "public" ? "Public view" : "Private view")); }, [f.investor_name, view]);
  const back = () => (setup ? setup.onBack() : pop ? pop.requestClose() : navigate({ to: "/marketplace/my-company" }));

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

  const autoEnrich = <InvestorAutoEnrichButton websiteUrl={f.website_url} onEnriched={applyEnrichment} disabled={busy} />;
  const leaks = descriptionLeaks(f.description, f.investor_name, f.website_url);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onCreated && (missingCreationFields("investor",f.investor_name,tenant,human,ai).length)) {
      setView("private");setTab(f.investor_name.trim() ? "admin" : "about");
      setTimeout(()=>document.getElementById(f.investor_name.trim() ? "investor-tenant" : "f-investor_name")?.focus(),80);
      setErrs({investor_name:!f.investor_name.trim() ? "Needed to add the investor." : "",creation:"To add the investor, fill in Company Name (About Company), Tenant and required ownership (Admin settings)."});return;
    }
    const checks: [string, string | null][] = [
      ["year_founded", individual ? null : yearError(f.year_founded)],
      ["investor_name", f.investor_name.trim().length < 2 ? "Add your firm's name." : null],
      ["website_url", /^(https?:\/\/)?[\w-]+(\.[\w-]+)+/i.test(f.website_url.trim()) ? null : "Enter a valid website address, e.g. www.yourfirm.com"],
      ["description", f.description.trim() ? descriptionError(f.description) || (leaks.length ? "leak" : null) : null],
      ["registration_no", individual ? null : regError(f.registration_no, f.country)],
      ["acts_for", agent && !actsFor.length ? "Pick at least one investor type." : null],
    ];
    const aBad = addrErr && (!f.country ? "Choose a country." : Object.values(addrErr).find(Boolean));
    if (!directory && aBad) { setAddrShow(true); setErrs({ address: aBad }); setView("private");setTab("address"); document.getElementById(f.country ? "addr-street" : "addr-country")?.focus(); return; }
    const bad = checks.find(([, m]) => m);
    if (!directory && bad) {
      setErrs({ [bad[0]]: bad[1] ?? "Check this field." });
      const target = bad[0] === "registration_no" ? "people" : bad[0] === "description" ? "description" : "about";
      setView(target === "description" ? "public" : "private"); setTab(target);
      setTimeout(()=>document.getElementById(`f-${bad[0]}`)?.focus(),60);
      return;
    }
    setErrs({});
    const yr = individual ? null : Number(f.year_founded);
    setBusy(true);
    try {
      const t = (v: string) => v.trim() || null;
      if (onCreated) {
        const result = await create({data:{tenantId:tenant,investorName:f.investor_name.trim(),owningAgentUserId:human,owningAiAgentId:ai,websiteUrl:t(f.website_url),linkedinUrl:t(f.linkedin_url),country:t(f.country),investorType:t(f.investor_type),yearFounded:f.year_founded ? Number(f.year_founded) : null,firmName:t(f.firm_name),email:t(f.email),address:addr,bio:t(f.short_description),shortDescription:t(f.short_description),longDescription:t(longDescription),legalName:t(legalName),status:directoryStatus,visibility:directoryVisibility,companySizeBand:(f.company_size_band || null) as "1-10" | null,preferredIndustries:industries,preferredStages:stages,keywords,investmentFocus:focus,aumBand:t(f.aum_band),ticketBand:t(f.ticket_band)}});
        const uploaded = await uploadPending(media,({kind,ext})=>getUrl({data:{kind,ext,investor_id:result.id}}),supabase.storage.from("startup-media"));
        await save({data:{investor_id:result.id,investor_name:f.investor_name.trim(),investor_type:t(f.investor_type),year_founded:f.year_founded ? Number(f.year_founded) : null,company_size_band:(f.company_size_band || null) as "1-10" | null,country:t(f.country),city:t(f.city),email:t(f.email),website_url:t(f.website_url),linkedin_url:t(f.linkedin_url),firm_name:t(f.firm_name),short_description:t(f.short_description),aum:t(f.aum),min_ticket_size:t(f.min_ticket_size),max_ticket_size:t(f.max_ticket_size),...(f.aum_band ? {aum_band:f.aum_band as never} : {}),...(f.ticket_band ? {ticket_band:f.ticket_band as never} : {}),revenue_min_band:(f.rev_band || null) as never,registration_no:t(f.registration_no),description:f.description,deal_types:deals,people,portfolio_extra:portfolio,keywords,preferred_stages:stages,preferred_industries:industries,investment_focus:focus,logo_path:uploaded.logoPath,media:uploaded.media,address_line1:t(addr.street),address_line2:t(addr.unit),address_city_district:t(addr.district),address_province_state:t(addr.province),postal_code:t(addr.postal)}});
        if(companyType) await updateDirectory({data:{id:result.id,companyType:companyType as "SME" | "Corporate Enterprise" | "Individual"}});
        await qc.invalidateQueries({queryKey:["investors"]});pop?.setDirty(false);toast.success(`${f.investor_name.trim()} created`);onCreated(result.id);return;
      }

      const { logoPath, media: resolvedMedia } = await uploadPending(
        media,
        ({ kind, ext }) => getUrl({ data: { kind, ext, investor_id: inv.id } }),
        supabase.storage.from("startup-media"),
      );
      const exact = Number(f.aum_exact.replace(/[^\d.]/g, ""));
      await save({ data: {
        investor_name: f.investor_name.trim(), investor_type: t(typeOf), ...(agent ? { acts_for_types: actsFor } : {}), year_founded: yr && Number.isFinite(yr) ? yr : null,
        company_size_band: individual ? null : ((f.company_size_band || null) as "1-10" | null),
        country: t(f.country), city:t(f.city), email: t(f.email), website_url: t(f.website_url), linkedin_url: t(f.linkedin_url),
        firm_name: t(f.firm_name),
        business_address: [addr.unit, addr.street, addr.district, [addr.province, addr.postal].filter(Boolean).join(" "), f.country].map((x) => x.trim()).filter(Boolean).join(", ") || null,
        address_line1: t(addr.street), address_line2: t(addr.unit), address_city_district: t(addr.district), address_province_state: t(addr.province), postal_code: t(addr.postal),
        short_description: t(f.short_description),
        ...(directory ? {aum:t(f.aum),min_ticket_size:t(f.min_ticket_size),max_ticket_size:t(f.max_ticket_size)}:{}),
        ...(directory && !f.aum_band && !inv.aum_band ? {} : {aum_band: individual || rel === "agent" ? null : (f.aum_band || null) as never}),
        ...(directory && !f.ticket_band && !inv.ticket_band ? {} : {ticket_band: (f.ticket_band || null) as never}),
        revenue_min_band: (f.rev_band || null) as never,
        aum_exact_usd: f.aum_exact.trim() && Number.isFinite(exact) ? exact : null,
        registration_no: individual ? null : t(f.registration_no),
        description: f.description.trim(), deal_types: deals,
        keywords, investment_focus: focus, preferred_stages: stages, preferred_industries: industries, ...(portfolioDirty ? {portfolio_extra: portfolio} : {}),
        logo_path: logoPath, media: resolvedMedia,
        people: people.filter((p) => p.name.trim()),
        investor_id: inv.id,
      } });
      if (admin && directoryRecord) await updateDirectory({data:{id:inv.id,...(linkedDirty ? {startupIds:linkedPortfolio.flatMap(x=>x.refId ? [x.refId] : [])} : {}),revenueMinM:revenueMin ? Number(revenueMin) : null,revenueMaxM:revenueMax ? Number(revenueMax) : null,tenantId:tenant,legalName:legalName || null,longDescription:longDescription || null,status:directoryStatus,visibility:directoryVisibility,...(human ? {owningAgentUserId:human}:{}),...(ai ? {owningAiAgentId:ai}:{})}});
      if (admin && companyTypeDirty) await updateDirectory({data:{id:inv.id,...(companyTypeReset ? {companyTypeReset:true} : companyType ? {companyType:companyType as "SME" | "Corporate Enterprise" | "Individual"} : {})}});
      await qc.invalidateQueries({ queryKey: ["buyer-investor"] });
      await qc.invalidateQueries({ queryKey: ["investors"] });
      await qc.invalidateQueries({ queryKey: ["investor", inv.id] });
      await qc.invalidateQueries({ queryKey: ["buyer-profile", "me"] });
      const live = data.buyer.status === "live";
      const ready = !!f.ticket_band && deals.length > 0 && industries.length > 0 && (!showsStages(typeOf, agent ? actsFor : null) || stages.length > 0);
      const msg = live ? "Profile saved. Sellers see the changes in Browse investors."
        : ready ? "Profile saved as a draft. Publish it when you're ready." : "Profile saved as a draft. Finish the required items to publish.";
      if (setup) setup.onSaved(msg);
      else { toast.success(msg); if (pop) { pop.setDirty(false); pop.done(); } else back(); }
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };
  const Err = ({ k }: { k: string }) => errs[k] && errs[k] !== "leak" ? <p className="text-[12.5px] text-[#B42318]">{errs[k]}</p> : null;
  const req = <span className="ml-[3px] text-[12px] font-semibold text-[#B42318] relative -top-0.5">*</span>;
  const corp = isCorporateBuyer(typeOf);
  const allStages = Array.from(new Set([...STAGE_OPTIONS, ...stages]));
  const allGeo = Array.from(new Set([...GEOGRAPHY, ...focus]));
  const allDeals = Array.from(new Set([...DEAL_TYPES, ...deals]));
  const agnostic = industries.includes(SECTOR_AGNOSTIC);

  return (
    <div className={setup || pop ? "space-y-6" : "mx-auto max-w-3xl space-y-6"}>
      {!setup && !pop && (
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

      <form noValidate={!!pop} id="buyer-edit-form" onSubmit={submit} onChange={() => pop?.setDirty(true)} className={pop ? "space-y-4 pt-5 text-sm" : "space-y-4 rounded-lg border border-border bg-card p-6 shadow-card text-sm"}>
        {pop && !setup ? <>
          <EditInfoTabsSlot><MainTabs tone="buyer" idBase="buyer-edit" value={view} onChange={(v) => {setView(v);setTab(v === "public" ? "description" : "media");}} tabs={[{key:"public",label:tr("Public view"),icon:<Eye />,count:0},{key:"private",label:tr("Private view"),icon:<Lock />,count:buyerMissing.about+buyerMissing.media+buyerMissing.people}]} /></EditInfoTabsSlot>
          <TabRow idBase="buyer-edit" label="Buyer information" value={tab} onChange={setTab} tabs={view === "public" ? [{key:"description",label:tr("Public Description")},{key:"mandate",label:tr("Mandate")}] : [{key:"media",label:tr("Images & Logo"),count:buyerMissing.media},{key:"about",label:tr("About Company"),count:buyerMissing.about,error:!!onCreated && !!errs.creation && !f.investor_name.trim()},{key:"address",label:tr("Address")},{key:"industries",label:tr("Industries & Portfolio")},{key:"people",label:tr("Decision Makers"),count:buyerMissing.people},...(admin && directory ? [{key:"admin" as const,label:tr("Admin settings"),icon:<Shield className="h-3.5 w-3.5" />,error:!!onCreated && !!errs.creation && (!tenant || !human || !ai)}]:[])]} />
          {tab === "media" && <div className="space-y-4"><TabHead title={tr("Images & Logo")} />        {/* Logo + Media + Auto Enrich (right-aligned, same row) */}
        <S cur={setup ? undefined : sec} id="media"><div className="flex items-start gap-4">
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

</div>}
          {tab === "about" && <div className="space-y-4"><TabHead title={tr("Company Info")}>{autoEnrich}</TabHead>        {/* Row 1: Year Founded | Company Name | Investor Classification */}
        <div className={agent ? "grid gap-4 sm:grid-cols-2" : "grid gap-4 sm:grid-cols-3"}>
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
              className={errs.investor_name && !f.investor_name.trim() ? "creation-invalid" : ""} />
            {!f.investor_name.trim() && <Err k="investor_name" />}
          </div>
          {!agent && <S cur={setup ? undefined : sec} id="classification" className="space-y-1.5">
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
          </S>}
        </div>
        {agent && <S cur={setup ? undefined : sec} id="classification">
          <ActsForField value={actsFor} onChange={(v) => { setActsFor(v); setErrs((e) => ({ ...e, acts_for: "" })); }} error={errs.acts_for || null} label={<>Acts for<Tag s={src.investor_type} /></>} />
        </S>}

<CompactFields two={individual}>        <>
          <CompanyTypeField value={companyType || companyTypeForRelation(rel)} source={onCreated ? "" : (inv as { company_type_source?: string }).company_type_source ?? "account"} admin={admin} onReset={()=>{setCompanyType(companyTypeForRelation(rel) ?? "");setCompanyTypeReset(true);setCompanyTypeDirty(true);}} onChange={(v)=>{setCompanyType(v);setCompanyTypeReset(false);setCompanyTypeDirty(true);}} />
        </>
        {!individual && (
          <>
            <S id="size" cur={sec}><CompanySizeField value={f.company_size_band} onChange={(v) => setF((o) => ({ ...o, company_size_band: v }))} /></S>
          </>
        )}

        {/* Row 2: Region (Country lives in the address box) */}

          <div data-edit-sec="region" className="relative space-y-1.5">
            {sec === "region" && <div aria-hidden className="edit-sec-box is-buyer" />}
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
</CompactFields>        {/* Row 3: Email | Company URL | LinkedIn URL */}
        <div className="grid sm:grid-cols-3 gap-4">
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

        {/* About */}
        <div className="space-y-1.5">
          <Label>About Company</Label>
          <Textarea value={f.short_description} onChange={set("short_description")} rows={3} maxLength={2000}
            placeholder="Brief description of the company" />
        </div>

{directory && <div className="space-y-1.5"><Label>Long Description</Label><Textarea value={longDescription} onChange={e=>setLongDescription(e.target.value)} maxLength={5000} /></div>}</div>}
          {tab === "address" && <div className="space-y-4"><TabHead title={tr("Company Address")}>{autoEnrich}</TabHead>{directory && <div className="space-y-1.5"><Label>Legal name</Label><Input value={legalName} onChange={e=>setLegalName(e.target.value)} maxLength={255} /></div>}        {/* Row 4: Firm Name, then the address box */}
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label>Firm Name</Label>
            <Input id="f-firm_name" value={f.firm_name} onChange={set("firm_name")} placeholder="e.g. Sequoia Capital" maxLength={100} />
          </div>
        </div>
        <div className="relative [&>*:not(.edit-sec-box)]:relative" data-edit-sec={sec === "address" ? "address" : "country"}>
          {!setup && sec === "country" && <div aria-hidden="true" className="edit-sec-box is-buyer" />}
          <AddressBox noteOutside compact a={addr} thai={thaiAddr} city={addr.district} onCity={(v) => setAddr({ district: v })} onChange={setAddr}
            title={individual ? tr("Address") : tr("Business address")}
            note={tr("Sellers see your country and province, never the full address, until they approve your NDA.")}
            country={f.country} onCountry={changeCountry} countryErr={addrShow && addrDirty && !f.country ? tr("Choose a country.") : null}
            show={(k) => (addrShow && addrErr ? (addrErr as Record<string, string | null>)[k] ?? null : null)} onBlur={() => {}} />
        </div>

</div>}
          {tab === "mandate" && <div className="space-y-4"><TabHead title={tr("Mandate")} />        {/* Fund & ticket — US$ bands */}
        {directory && <CompactFields><div className="space-y-1.5"><Label>AUM</Label><Input value={f.aum} onChange={set("aum")} /></div><div className="space-y-1.5"><Label>Min Ticket Size</Label><Input value={f.min_ticket_size} onChange={set("min_ticket_size")} /></div><div className="space-y-1.5"><Label>Max Ticket Size</Label><Input value={f.max_ticket_size} onChange={set("max_ticket_size")} /></div></CompactFields>}
        {showsFund && (
          <S cur={setup ? undefined : sec} id="fund"><div className="grid sm:grid-cols-2 gap-4">
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
        <S cur={setup ? undefined : sec} id="mandate" className="space-y-1.5">
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
          <S cur={setup ? undefined : sec} id="revenue" className="space-y-1.5">
          <Label>Min. target revenue<Tag s={src.revenue_min_band} /></Label>
          <Select value={f.rev_band || "none"} onValueChange={(v) => setF((o) => ({ ...o, rev_band: v === "none" ? "" : v }))}>
            <SelectTrigger className="max-w-[360px]"><SelectValue placeholder="Not set" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not set</SelectItem>
              {REV_BANDS.map((b) => <SelectItem key={b.key} value={b.key}>{b.label} ({b.baht})</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-[12px] text-muted-foreground">The smallest company revenue you'll buy. Sellers can filter by it.</p>
          </S>
        </div>
        <S cur={setup ? undefined : sec} id="focus" className="space-y-1.5">
          <Label>Investment Focus<Tag s={src.deal_types} /></Label>
          <div className="flex flex-wrap gap-2">
            {allDeals.map((d) => <Pill key={d} active={deals.includes(d)} onClick={() => setDeals(toggle(deals, d))}>{d}</Pill>)}
          </div>
        </S>

        {/* Geography */}
        <S cur={setup ? undefined : sec} id="geography" className="space-y-1.5">
          <Label>Geography<Tag s={src.geography} /></Label>
          <div className="flex flex-wrap gap-2">
            {allGeo.map((g) => <Pill key={g} active={focus.includes(g)} onClick={() => setFocus(toggle(focus, g, 10))}>{g}</Pill>)}
          </div>
        </S>

</div>}
          {tab === "industries" && <div className="space-y-4"><TabHead title={tr("Industries & Portfolio")} />        {/* Tags */}
        <S cur={setup ? undefined : sec} id="keywords" className="space-y-1.5">
          <Label>Product &amp; Service Tags (Up to 5)</Label>
          <TagEditor values={keywords} onChange={setKeywords} max={5} maxLength={50}
            placeholder="Example: Portfolio Management, Due Diligence" />
        </S>

        {/* Preferred Stages */}
        {showsStages(typeOf, agent ? actsFor : null) && <S cur={setup ? undefined : sec} id="stages" className="space-y-1.5">
          <Label>Preferred Stages</Label>
          <div className="flex flex-wrap gap-2">
            {allStages.map((s) => (
              <Pill key={s} active={stages.includes(s)} onClick={() => setStages(toggle(stages, s))}>{s}</Pill>
            ))}
          </div>
        </S>}

        {/* Preferred Industries */}
        <S cur={setup ? undefined : sec} id="industries" className="space-y-1.5">
          <Label>Preferred Industries<Tag s={src.preferred_industries} /></Label>
          <SetSectorPicker mode="multi" value={industries.filter((x) => x !== SECTOR_AGNOSTIC)}
            onChange={(v) => setIndustries([...(agnostic ? [SECTOR_AGNOSTIC] : []), ...v])}
            limitMsg="Pick up to 5 industries, or Sector agnostic."
            agnostic={{ on: agnostic, onToggle: (on) => setIndustries(on ? [SECTOR_AGNOSTIC, ...industries.filter((x) => x !== SECTOR_AGNOSTIC)] : industries.filter((x) => x !== SECTOR_AGNOSTIC)),
              line: "I look at companies in every industry",
              note: "Sellers may avoid sector-agnostic investors because there's no clear focus. Picking up to 5 industries helps the right sellers find you.",
              summary: <>Sellers see <b className="text-foreground">Sector agnostic</b> on your card.</> }} />
        </S>

        {directory && <><CompactFields two><div className="space-y-1.5"><Label>Min. target revenue (US$M)</Label><Input type="number" min={0} value={revenueMin} onChange={e=>setRevenueMin(e.target.value)} /></div><div className="space-y-1.5"><Label>Max. target revenue (US$M)</Label><Input type="number" min={0} value={revenueMax} onChange={e=>setRevenueMax(e.target.value)} /></div></CompactFields><RelationshipLinksEditor mode="startups" title="Portfolio Startups" rows={linkedPortfolio} onChange={r=>{setLinkedPortfolio(r);setLinkedDirty(true);}} /></>}
        {/* Portfolio Startups */}
        <S cur={setup ? undefined : sec} id="portfolio" className="space-y-1.5">
          <Label>Portfolio Startups</Label>
          {inv.portfolio.filter((n) => !inv.portfolio_extra.includes(n)).length > 0 && (
            <p className="text-xs text-muted-foreground">
              Linked in Investors Directory: {inv.portfolio.filter((n) => !inv.portfolio_extra.includes(n)).join(", ")}
            </p>
          )}
          <TagEditor values={portfolio} onChange={(v)=>{setPortfolio(v);setPortfolioDirty(true);}} max={50} placeholder="Add a portfolio company" />
        </S>

</div>}
          {tab === "description" && <div className="space-y-4"><TabHead title={tr("Public Description")} />        {/* Public view */}
        <div className="space-y-1.5 rounded-lg border border-[#CFD2FB] bg-[#EEF0FF]/50 p-4 dark:border-[#2E3570] dark:bg-[#1B2140]/50">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Public view · sellers see this before an NDA</h3>
          <S cur={setup ? undefined : sec} id="description" className="space-y-1.5">
          <Label>Description <span className="font-normal text-[#9CA3AF]">10 to 140 characters</span><Tag s={src.description} /></Label>
          <Textarea id="f-description" value={f.description} onChange={(e) => setF((o) => ({ ...o, description: e.target.value.slice(0, 140) }))} rows={3} maxLength={140}
            placeholder="e.g. Family office backing profitable Thai companies with succession or growth plans" className={errs.description ? "border-[#B42318]" : ""} />
          <div className="flex justify-between text-[12px]">
            <span className="text-[#B42318]">{errs.description && errs.description !== "leak" ? errs.description : ""}</span>
            <span className="text-muted-foreground">{f.description.length} / 140</span>
          </div>
          </S>
          {leaks.length > 0 && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">Your description mentions <b>{leaks.join(", ")}</b>. Sellers read it before an NDA, so leave out names, websites and contact details.</p>}
        </div>

</div>}
          {tab === "people" && <div className="space-y-4"><TabHead title={tr("Decision Makers")} />        {/* For verification */}
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
          <S cur={setup ? undefined : sec} id="people" className="space-y-1.5">
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

</div>}
          {tab === "admin" && admin && <div className="space-y-4"><TabHead title={tr("Admin settings")} /><p className="text-sm text-muted-foreground">Only Admin sees this tab.</p>
          {directory ? <CompactFields two><div className="space-y-1.5"><Label>Tenant *</Label><Select value={tenant} onValueChange={setTenant}><SelectTrigger id="investor-tenant" className={errs.creation && !tenant ? "creation-invalid" : undefined}><SelectValue placeholder="Choose tenant" /></SelectTrigger><SelectContent>{tenants.data?.map(t=><SelectItem key={t.id} value={t.id}>{t.tenantName}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label className={errs.creation && !human ? "text-destructive" : undefined}>Owning Agent *</Label><Select value={human} onValueChange={setHuman}><SelectTrigger className={errs.creation && !human ? "creation-invalid" : undefined}><SelectValue placeholder="Choose agent" /></SelectTrigger><SelectContent>{humans.data?.map(u=><SelectItem key={u.id} value={u.id}>{u.email}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label className={errs.creation && !ai ? "text-destructive" : undefined}>Owning AI Agent *</Label><Select value={ai} onValueChange={setAi}><SelectTrigger className={errs.creation && !ai ? "creation-invalid" : undefined}><SelectValue placeholder="Choose AI agent" /></SelectTrigger><SelectContent>{ais.data?.map(u=><SelectItem key={u.id} value={u.id}>{u.email}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label>Status</Label><Select value={directoryStatus} onValueChange={(v)=>setDirectoryStatus(v as typeof directoryStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Prospect","Active","Engaged","Investing","Inactive","Archived"].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label>Visibility</Label><Select value={directoryVisibility} onValueChange={(v)=>setDirectoryVisibility(v as typeof directoryVisibility)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Private","Tenant","Shared","Archived"].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div></CompactFields> : <><Label>Verification status</Label><Input readOnly value={data.verification.status} /><p className="text-sm text-muted-foreground">Change it in Approvals.</p></>}
          <Label>Verification status</Label><Input readOnly value={data.verification.status} /><Button type="button" variant="link" onClick={()=>{pop?.requestClose();void navigate({to:"/approvals",search:{tab:"buyers"} as never});}}>Change it in Approvals</Button></div>}
        </> : <>        {/* Logo + Media + Auto Enrich (right-aligned, same row) */}
        <S cur={setup ? undefined : sec} id="media"><div className="flex items-start gap-4">
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
        <div className={agent ? "grid grid-cols-[100px_1fr] gap-4" : "grid grid-cols-[100px_1fr_220px] gap-4"}>
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
          {!agent && <S cur={setup ? undefined : sec} id="classification" className="space-y-1.5">
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
          </S>}
        </div>
        {agent && <S cur={setup ? undefined : sec} id="classification">
          <ActsForField value={actsFor} onChange={(v) => { setActsFor(v); setErrs((e) => ({ ...e, acts_for: "" })); }} error={errs.acts_for || null} label={<>Acts for<Tag s={src.investor_type} /></>} />
        </S>}

        <div className="grid grid-cols-[220px_1fr] gap-4">
          <CompanyTypeField value={companyType || companyTypeForRelation(rel)} source={onCreated ? "" : (inv as { company_type_source?: string }).company_type_source ?? "account"} admin={admin} onReset={()=>{setCompanyType(companyTypeForRelation(rel) ?? "");setCompanyTypeReset(true);setCompanyTypeDirty(true);}} onChange={(v)=>{setCompanyType(v);setCompanyTypeReset(false);setCompanyTypeDirty(true);}} />
        </div>
        {!individual && (
          <div className="grid grid-cols-[220px_1fr] gap-4">
            <CompanySizeField value={f.company_size_band} onChange={(v) => setF((o) => ({ ...o, company_size_band: v }))} />
          </div>
        )}

        {/* Row 2: Region (Country lives in the address box) */}
        <div className="grid grid-cols-3 gap-4">
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

        {/* Row 4: Firm Name, then the address box */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Firm Name</Label>
            <Input value={f.firm_name} onChange={set("firm_name")} placeholder="e.g. Sequoia Capital" maxLength={100} />
          </div>
        </div>
        <div className="relative [&>*:not(.edit-sec-box)]:relative" data-edit-sec="country">
          {!setup && sec === "country" && <div aria-hidden="true" className="edit-sec-box is-buyer" />}
          <AddressBox noteOutside compact a={addr} thai={thaiAddr} city={addr.district} onCity={(v) => setAddr({ district: v })} onChange={setAddr}
            title={individual ? tr("Address") : tr("Business address")}
            note={tr("Sellers see your country and province, never the full address, until they approve your NDA.")}
            country={f.country} onCountry={changeCountry} countryErr={addrShow && addrDirty && !f.country ? tr("Choose a country.") : null}
            show={(k) => (addrShow && addrErr ? (addrErr as Record<string, string | null>)[k] ?? null : null)} onBlur={() => {}} />
        </div>

        {/* Fund & ticket — US$ bands */}
        {showsFund && (
          <S cur={setup ? undefined : sec} id="fund"><div className="grid grid-cols-2 gap-4">
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
        <S cur={setup ? undefined : sec} id="mandate" className="space-y-1.5">
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
          <S cur={setup ? undefined : sec} id="revenue" className="space-y-1.5">
          <Label>Min. target revenue<Tag s={src.revenue_min_band} /></Label>
          <Select value={f.rev_band || "none"} onValueChange={(v) => setF((o) => ({ ...o, rev_band: v === "none" ? "" : v }))}>
            <SelectTrigger className="max-w-[360px]"><SelectValue placeholder="Not set" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not set</SelectItem>
              {REV_BANDS.map((b) => <SelectItem key={b.key} value={b.key}>{b.label} ({b.baht})</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-[12px] text-muted-foreground">The smallest company revenue you'll buy. Sellers can filter by it.</p>
          </S>
        </div>
        <S cur={setup ? undefined : sec} id="focus" className="space-y-1.5">
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
        <S cur={setup ? undefined : sec} id="keywords" className="space-y-1.5">
          <Label>Product &amp; Service Tags (Up to 5)</Label>
          <TagEditor values={keywords} onChange={setKeywords} max={5} maxLength={50}
            placeholder="Example: Portfolio Management, Due Diligence" />
        </S>

        {/* Geography */}
        <S cur={setup ? undefined : sec} id="geography" className="space-y-1.5">
          <Label>Geography<Tag s={src.geography} /></Label>
          <div className="flex flex-wrap gap-2">
            {allGeo.map((g) => <Pill key={g} active={focus.includes(g)} onClick={() => setFocus(toggle(focus, g, 10))}>{g}</Pill>)}
          </div>
        </S>

        {/* Preferred Stages */}
        {showsStages(typeOf, agent ? actsFor : null) && <S cur={setup ? undefined : sec} id="stages" className="space-y-1.5">
          <Label>Preferred Stages</Label>
          <div className="flex flex-wrap gap-2">
            {allStages.map((s) => (
              <Pill key={s} active={stages.includes(s)} onClick={() => setStages(toggle(stages, s))}>{s}</Pill>
            ))}
          </div>
        </S>}

        {/* Preferred Industries */}
        <S cur={setup ? undefined : sec} id="industries" className="space-y-1.5">
          <Label>Preferred Industries<Tag s={src.preferred_industries} /></Label>
          <SetSectorPicker mode="multi" value={industries.filter((x) => x !== SECTOR_AGNOSTIC)}
            onChange={(v) => setIndustries([...(agnostic ? [SECTOR_AGNOSTIC] : []), ...v])}
            limitMsg="Pick up to 5 industries, or Sector agnostic."
            agnostic={{ on: agnostic, onToggle: (on) => setIndustries(on ? [SECTOR_AGNOSTIC, ...industries.filter((x) => x !== SECTOR_AGNOSTIC)] : industries.filter((x) => x !== SECTOR_AGNOSTIC)),
              line: "I look at companies in every industry",
              note: "Sellers may avoid sector-agnostic investors because there's no clear focus. Picking up to 5 industries helps the right sellers find you.",
              summary: <>Sellers see <b className="text-foreground">Sector agnostic</b> on your card.</> }} />
        </S>

        {/* Public view */}
        <div className="space-y-1.5 rounded-lg border border-[#CFD2FB] bg-[#EEF0FF]/50 p-4 dark:border-[#2E3570] dark:bg-[#1B2140]/50">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Public view · sellers see this before an NDA</h3>
          <S cur={setup ? undefined : sec} id="description" className="space-y-1.5">
          <Label>Description <span className="font-normal text-[#9CA3AF]">10 to 140 characters</span><Tag s={src.description} /></Label>
          <Textarea id="f-description" value={f.description} onChange={(e) => setF((o) => ({ ...o, description: e.target.value.slice(0, 140) }))} rows={3} maxLength={140}
            placeholder="e.g. Family office backing profitable Thai companies with succession or growth plans" className={errs.description ? "border-[#B42318]" : ""} />
          <div className="flex justify-between text-[12px]">
            <span className="text-[#B42318]">{errs.description && errs.description !== "leak" ? errs.description : ""}</span>
            <span className="text-muted-foreground">{f.description.length} / 140</span>
          </div>
          </S>
          {leaks.length > 0 && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">Your description mentions <b>{leaks.join(", ")}</b>. Sellers read it before an NDA, so leave out names, websites and contact details.</p>}
        </div>

        {/* Portfolio Startups */}
        <S cur={setup ? undefined : sec} id="portfolio" className="space-y-1.5">
          <Label>Portfolio Startups</Label>
          {inv.portfolio.filter((n) => !inv.portfolio_extra.includes(n)).length > 0 && (
            <p className="text-xs text-muted-foreground">
              Linked in Investors Directory: {inv.portfolio.filter((n) => !inv.portfolio_extra.includes(n)).join(", ")}
            </p>
          )}
          <TagEditor values={portfolio} onChange={(v)=>{setPortfolio(v);setPortfolioDirty(true);}} max={50} placeholder="Add a portfolio company" />
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
          <S cur={setup ? undefined : sec} id="people" className="space-y-1.5">
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

</>}
        {pop ? (
          <EditInfoFooter>
          {errs.creation && missingCreationFields("investor",f.investor_name,tenant,human,ai).length > 0 && <p className="basis-full text-[13px] font-medium text-destructive">To add the investor, fill in: {missingCreationFields("investor",f.investor_name,tenant,human,ai).join(", ")}. Company Name is in About Company; ownership is in Admin settings.</p>}
            <Button type="button" variant="outline" onClick={back} disabled={busy}>Cancel</Button>
            <Button type="submit" form="buyer-edit-form" disabled={busy}>{busy ? "Saving…" : onCreated ? "Add investor" : "Save changes"}</Button>
          </EditInfoFooter>
        ) : (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4 shadow-card">
          <p className="text-xs text-muted-foreground">
            Required fields are marked with <span className="text-destructive">*</span>
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={back} disabled={busy}>{setup ? "Back to answers" : "Cancel"}</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : setup ? "Save profile" : "Save changes"}</Button>
          </div>
        </div>
        )}
      </form>
    </div>
  );
}
