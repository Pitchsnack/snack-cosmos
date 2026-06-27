import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { REGION_OPTIONS, regionForCountry } from "@/lib/country-region";
import { EditableUrlField } from "@/components/ui/editable-url-field";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CountryCombobox } from "@/components/ui/country-combobox";
import {
  createStartup,
  updateStartup,
  createStartupMediaUploadUrl,
  type StartupDetail,
} from "@/lib/startups.functions";
import { listAssignableUsers } from "@/lib/startup-ownership.functions";
import { listAssignableTenants } from "@/lib/tenants.functions";
import { useSessionContext } from "@/hooks/use-session-context";
import { useHasSession } from "@/hooks/use-has-session";
import { supabase } from "@/integrations/supabase/client";
import {
  EntityMediaEditor,
  EMPTY_MEDIA_STATE,
  uploadPending,
  type EntityMediaState,
  type SlotState,
} from "@/components/media/entity-media-editor";
import { FounderEditor, type FounderDraft } from "./founder-editor";
import { InvestorPicker } from "./investor-picker";
import { AutoEnrichButton } from "./auto-enrich-button";
import type { EnrichStartupResult } from "@/lib/auto-enrich/auto-enrich-adapter";

// ── Taxonomies (mirrored from PitchSnack1 AdminStartupManager) ──
const COMPANY_TYPES = ["SME", "Startup", "Corporate Enterprise"];
const STAGES = [
  "Pre-Seed", "Seed", "Series A", "Series B", "Series C+",
  "Growth", "IPO", "Acquired", "Inactive",
];
const INDUSTRIES = [
  "FinTech", "eCommerce & Marketplace", "MarTech", "HealthTech",
  "Sustainability", "Mobility & Logistics", "DeepTech", "Defense",
  "EdTech", "Gaming", "PropTech", "AgriTech", "FMCG", "Others",
];
const STATUSES = ["Draft","Active","Fundraising","Due Diligence","Portfolio","Exited"];

const VISIBILITIES = ["Private","Tenant","Shared","Archived"];

// ── Pill button (PitchSnack1 spec: px-3 py-1 rounded-full text-xs) ──
function Pill({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

interface Props {
  /** When provided, the form is in edit mode. */
  startup?: StartupDetail;
}

function hydrateMediaState(startup?: StartupDetail): EntityMediaState {
  if (!startup) return EMPTY_MEDIA_STATE;
  const logo: SlotState = {
    persistedPath: startup.logo_url,
    signedUrl: startup.logo_signed_url,
    pendingFile: null,
  };
  const slots: [SlotState, SlotState, SlotState] = [
    { persistedPath: null, signedUrl: null, pendingFile: null },
    { persistedPath: null, signedUrl: null, pendingFile: null },
    { persistedPath: null, signedUrl: null, pendingFile: null },
  ];
  for (const m of startup.media) {
    if (m.slot >= 1 && m.slot <= 3) {
      slots[m.slot - 1] = {
        persistedPath: m.image_path,
        signedUrl: m.image_signed_url,
        pendingFile: null,
      };
    }
  }
  return { logo, slots };
}

export function StartupForm({ startup }: Props) {
  const isEdit = !!startup;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: session } = useSessionContext();
  const create = useServerFn(createStartup);
  const update = useServerFn(updateStartup);
  const getUploadUrl = useServerFn(createStartupMediaUploadUrl);
  const fetchUsers = useServerFn(listAssignableUsers);
  const fetchTenants = useServerFn(listAssignableTenants);
  const enabled = useHasSession();

  const tenantsQ = useQuery({ queryKey: ["assignable-tenants"], queryFn: () => fetchTenants(), enabled: enabled && !isEdit });
  const tenants = tenantsQ.data ?? [];
  const [tenantId, setTenantId] = useState<string>(startup?.tenant_id ?? "");
  useEffect(() => {
    if (!isEdit && !tenantId && tenants.length) {
      setTenantId(session?.activeWorkspace.tenantId ?? tenants[0].id);
    }
  }, [tenants, tenantId, session, isEdit]);

  // Company profile
  const [startupName, setStartupName] = useState(startup?.startup_name ?? "");
  const [companyType, setCompanyType] = useState<string>(startup?.company_type ?? "");
  const [yearFounded, setYearFounded] = useState<string>(startup?.year_founded?.toString() ?? "");
  const [email, setEmail] = useState(startup?.email ?? "");
  const [headquarters, setHeadquarters] = useState(startup?.headquarters ?? "");
  const [region, setRegion] = useState<string>(startup?.region ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(startup?.website_url ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(startup?.linkedin_url ?? "");
  
  const [city, setCity] = useState(startup?.city ?? "");

  // Company information
  const [shortDescription, setShortDescription] = useState(startup?.short_description ?? "");
  const [longDescription, setLongDescription] = useState(startup?.long_description ?? "");

  // Tags & classification
  const [productTags, setProductTags] = useState<string[]>(startup?.product_tags ?? []);
  const [productTagDraft, setProductTagDraft] = useState("");
  const [marketTags, setMarketTags] = useState<string[]>(startup?.market_tags ?? []);
  const [marketTagDraft, setMarketTagDraft] = useState("");
  const initialIndustries = startup?.industry ?? [];
  const [industries, setIndustries] = useState<string[]>(initialIndustries);
  const [customIndustry, setCustomIndustry] = useState("");
  const [investmentStage, setInvestmentStage] = useState<string>(startup?.investment_stage ?? "");

  // Status/visibility (create only)
  const [status, setStatus] = useState<string>(startup?.status ?? "Draft");
  const [visibility, setVisibility] = useState<string>(startup?.visibility ?? "Tenant");

  // Investors
  const [investorIds, setInvestorIds] = useState<string[]>(
    startup?.investors.map((i) => i.investor_id) ?? [],
  );

  // Founders
  const [founders, setFounders] = useState<FounderDraft[]>(
    startup?.founders.map((f) => ({
      full_name: f.full_name, position: f.position, linkedin_url: f.linkedin_url, bio: f.bio,
    })) ?? [],
  );

  // Logo + Media — hydrated from persisted paths in edit mode.
  const [media, setMedia] = useState<EntityMediaState>(() => hydrateMediaState(startup));

  // Ownership (create only — required by current API)
  const [owningAgentUserId, setOwningAgent] = useState("");
  const [owningAiAgentId, setOwningAi] = useState("");

  const humansQ = useQuery({
    queryKey: ["assignable-humans", tenantId],
    queryFn: () => fetchUsers({ data: { tenantId, userType: "Human" } }),
    enabled: enabled && !!tenantId && !isEdit,
  });
  const aisQ = useQuery({
    queryKey: ["assignable-ai", tenantId],
    queryFn: () => fetchUsers({ data: { tenantId, userType: "AI" } }),
    enabled: enabled && !!tenantId && !isEdit,
  });
  const noAi = !aisQ.isLoading && (aisQ.data ?? []).length === 0;

  const toggle = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const addProductTag = () => {
    const t = productTagDraft.trim();
    if (!t || productTags.includes(t) || productTags.length >= 5) return;
    setProductTags([...productTags, t]);
    setProductTagDraft("");
  };
  const addMarketTag = () => {
    const t = marketTagDraft.trim();
    if (!t || marketTags.includes(t) || marketTags.length >= 5) return;
    setMarketTags([...marketTags, t]);
    setMarketTagDraft("");
  };
  const addCustomIndustry = () => {
    const t = customIndustry.trim();
    if (!t || industries.includes(t)) return;
    setIndustries([...industries, t]);
    setCustomIndustry("");
  };

  const industryArray = industries;

  // Upload helper bound to a target startup id.
  async function uploadAllForStartup(targetStartupId: string) {
    return uploadPending(
      media,
      ({ kind, ext }) =>
        getUploadUrl({ data: { tenantId, startupId: targetStartupId, kind, ext } }),
      supabase.storage.from("startup-media"),
    );
  }

  const buildProfileBase = () => ({
    companyType: companyType || null,
    yearFounded: yearFounded ? Number(yearFounded) : null,
    email: email || null,
    headquarters: headquarters || null,
    region: (region || null) as "APAC" | "EMEA" | "LATAM" | "NA" | null,
    linkedinUrl: linkedinUrl || null,
    investmentStage: (investmentStage as typeof STAGES[number]) || null,
    productTags,
    marketTags,
    investorIds,
    founders: founders.filter((f) => f.full_name.trim()),
  });

  const createM = useMutation({
    mutationFn: async () => {
      // Create the row first so we have a real id for the storage path
      // (storage SELECT RLS authorizes via folder[2] = entity id; uploads
      // under a draft id would be unreadable on the next page load).
      const res = await create({
        data: {
          tenantId,
          startupName,
          websiteUrl: websiteUrl || null,
          city: city || null,
          industry: industryArray,
          shortDescription: shortDescription || null,
          longDescription: longDescription || null,
          status: status as never,
          visibility: visibility as never,
          owningAgentUserId,
          owningAiAgentId,
          logoPath: null,
          media: [],
          ...buildProfileBase(),
        },
      });
      const newId = (res as { id: string }).id;
      const { logoPath, media: uploadedMedia } = await uploadAllForStartup(newId);
      if (logoPath || uploadedMedia.length > 0) {
        await update({ data: { id: newId, logoPath, media: uploadedMedia } });
      }
      return { id: newId };
    },
    onSuccess: (res) => {
      toast.success("Startup created");
      qc.invalidateQueries({ queryKey: ["startups"] });
      navigate({ to: "/startups/$id", params: { id: res.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateM = useMutation({
    mutationFn: async () => {
      const { logoPath, media: resolvedMedia } = await uploadAllForStartup(startup!.id);
      return update({
        data: {
          id: startup!.id,
          startupName,
          
          websiteUrl: websiteUrl || null,
          city: city || null,
          industry: industryArray,
          shortDescription: shortDescription || null,
          longDescription: longDescription || null,
          logoPath,
          media: resolvedMedia,
          ...buildProfileBase(),
        },
      });
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["startup", startup!.id] });
      qc.invalidateQueries({ queryKey: ["startups"] });
      navigate({ to: "/startups/$id", params: { id: startup!.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = useMemo(() => {
    if (!startupName) return false;
    if (isEdit) return true;
    return !!(tenantId && owningAgentUserId && owningAiAgentId);
  }, [isEdit, startupName, tenantId, owningAgentUserId, owningAiAgentId]);

  const submitting = createM.isPending || updateM.isPending;

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); isEdit ? updateM.mutate() : createM.mutate(); }}
      className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-card text-sm"
    >
      {/* Tenant (create only) */}
      {!isEdit && (
        <div className="space-y-1.5">
          <Label>Tenant <span className="text-destructive">*</span></Label>
          <Select value={tenantId} onValueChange={setTenantId}>
            <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
            <SelectContent>
              {tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.tenantName}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Logo + Media + Auto Enrich (right-aligned, same row) */}
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <EntityMediaEditor value={media} onChange={setMedia} />
        </div>
        <div className="pt-6 shrink-0">
          <AutoEnrichButton
            websiteUrl={websiteUrl}
            disabled={submitting}
            onEnriched={(r) => applyEnrichment(r)}
          />
        </div>
      </div>

      {/* Row 1: Year Founded | Company Name | Company Type — PitchSnack1 [120px_1fr_160px] */}
      <div className="grid grid-cols-[120px_1fr_160px] gap-4">
        <div className="space-y-1.5">
          <Label>Year Founded</Label>
          <Input type="number" min={1800} max={new Date().getFullYear()}
            value={yearFounded} onChange={(e) => setYearFounded(e.target.value)} placeholder="e.g. 2020" />
        </div>
        <div className="space-y-1.5">
          <Label>Company Name <span className="text-destructive">*</span></Label>
          <Input value={startupName} onChange={(e) => setStartupName(e.target.value)} placeholder="Acme Inc." required maxLength={255} />
        </div>
        <div className="space-y-1.5">
          <Label>Company Type</Label>
          <Select value={companyType || "none"} onValueChange={(v) => setCompanyType(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Select —</SelectItem>
              {COMPANY_TYPES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 2: Investment Stage */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Investment Stage</Label>
          <Select value={investmentStage || "none"} onValueChange={(v) => setInvestmentStage(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Stage" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Select —</SelectItem>
              {STAGES.map((s) => (
                <SelectItem
                  key={s}
                  value={s}
                  className={s === "Inactive" ? "text-red-600 focus:text-red-600 data-[highlighted]:text-red-600" : undefined}
                >
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 3: Headquarters | Region | City */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <div className="flex h-6 items-center">
            <Label>Headquarters</Label>
          </div>
          <CountryCombobox
            value={headquarters}
            onChange={(v) => {
              setHeadquarters(v);
              // Auto-suggest region when empty / when HQ cleared
              if (!v) {
                setRegion("");
              } else if (!region) {
                const suggested = regionForCountry(v);
                if (suggested) setRegion(suggested);
              }
            }}
            placeholder={isEdit && !headquarters ? "⚠ Missing: Headquarters" : "Select country..."}
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
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    onClick={() => {
                      const suggested = regionForCountry(headquarters);
                      setRegion(suggested || "");
                      toast.success(
                        suggested
                          ? `Region set to ${suggested}`
                          : headquarters
                            ? "No region mapping for this country"
                            : "Set Headquarters first",
                      );
                    }}
                    aria-label="Re-detect region from Headquarters"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Re-detect from Headquarters</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <TooltipProvider delayDuration={150}>
            <Select
              value={region || ""}
              onValueChange={(v) => setRegion(v === "__clear__" ? "" : v)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select Region" />
              </SelectTrigger>
              <SelectContent>
                {region && (
                  <SelectItem value="__clear__" className="text-muted-foreground">
                    Clear selection
                  </SelectItem>
                )}
                {REGION_OPTIONS.map((r) => (
                  <Tooltip key={r.value}>
                    <TooltipTrigger asChild>
                      <SelectItem value={r.value}>
                        <span className="font-medium">{r.label}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          — {r.description}
                        </span>
                      </SelectItem>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <span className="font-medium">{r.label}</span> — {r.description}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </SelectContent>
            </Select>
          </TooltipProvider>
        </div>
        <div className="space-y-1.5">
          <div className="flex h-6 items-center">
            <Label>City</Label>
          </div>
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
        </div>
      </div>

      {/* Row 3: Email | Website | LinkedIn URL */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
        </div>
        <EditableUrlField
          label="Website"
          value={websiteUrl}
          onChange={setWebsiteUrl}
          placeholder="https://"
        />
        <EditableUrlField
          label="LinkedIn URL"
          value={linkedinUrl}
          onChange={setLinkedinUrl}
          placeholder="https://www.linkedin.com/company/…"
        />
      </div>

      {/* Descriptions */}
      <div className="space-y-1.5">
        <Label>Short Description</Label>
        <Textarea rows={2} maxLength={500} value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Long Description</Label>
        <Textarea rows={4} maxLength={5000} value={longDescription} onChange={(e) => setLongDescription(e.target.value)} />
      </div>

      {/* Industry pills */}
      <div className="space-y-1.5">
        <Label>Industry</Label>
        <div className="flex flex-wrap gap-2">
          {INDUSTRIES.map((ind) => (
            <Pill key={ind} active={industries.includes(ind)} onClick={() => setIndustries(toggle(industries, ind))}>
              {ind}
            </Pill>
          ))}
          {industries.filter((i) => !INDUSTRIES.includes(i)).map((c) => (
            <button key={c} type="button" onClick={() => setIndustries(industries.filter((x) => x !== c))}
              className="px-3 py-1 rounded-full text-xs border bg-primary text-primary-foreground border-primary inline-flex items-center gap-1">
              {c} <X className="h-3 w-3" />
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <Input value={customIndustry} onChange={(e) => setCustomIndustry(e.target.value)}
            placeholder="Add custom industry…" maxLength={50}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") { e.preventDefault(); addCustomIndustry(); }}} />
          <Button type="button" variant="outline" size="sm" onClick={addCustomIndustry}>Add</Button>
        </div>
      </div>

      {/* Product tags */}
      <div className="space-y-1.5">
        <Label>Product & Service Tags ({productTags.length}/5)</Label>
        <div className="flex flex-wrap gap-2">
          {productTags.map((t) => (
            <button key={t} type="button" onClick={() => setProductTags(productTags.filter((x) => x !== t))}
              className="px-3 py-1 rounded-full text-xs border bg-primary text-primary-foreground border-primary inline-flex items-center gap-1">
              {t} <X className="h-3 w-3" />
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={productTagDraft} onChange={(e) => setProductTagDraft(e.target.value)} maxLength={50}
            disabled={productTags.length >= 5}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") { e.preventDefault(); addProductTag(); }}} />
          <Button type="button" variant="outline" size="sm" onClick={addProductTag} disabled={productTags.length >= 5}>Add</Button>
        </div>
      </div>

      {/* Market tags */}
      <div className="space-y-1.5">
        <Label>Market Tags ({marketTags.length}/5)</Label>
        <div className="flex flex-wrap gap-2">
          {marketTags.map((t) => (
            <button key={t} type="button" onClick={() => setMarketTags(marketTags.filter((x) => x !== t))}
              className="px-3 py-1 rounded-full text-xs border bg-primary text-primary-foreground border-primary inline-flex items-center gap-1">
              {t} <X className="h-3 w-3" />
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={marketTagDraft} onChange={(e) => setMarketTagDraft(e.target.value)} maxLength={50}
            disabled={marketTags.length >= 5}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") { e.preventDefault(); addMarketTag(); }}} />
          <Button type="button" variant="outline" size="sm" onClick={addMarketTag} disabled={marketTags.length >= 5}>Add</Button>
        </div>
      </div>

      {/* Founders */}
      <FounderEditor value={founders} onChange={setFounders} />

      {/* Investors */}
      {tenantId && (
        <InvestorPicker tenantId={tenantId} value={investorIds} onChange={setInvestorIds} />
      )}

      {/* Status / visibility (create only) */}
      {!isEdit && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Visibility</Label>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{VISIBILITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Ownership (create only) */}
      {!isEdit && (
        <div className="border-t border-border pt-4">
          <h3 className="text-sm font-semibold">Ownership (required)</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Every startup must have one human Owning Agent and one Owning AI Agent.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Owning Agent <span className="text-destructive">*</span></Label>
              <Select value={owningAgentUserId} onValueChange={setOwningAgent} disabled={!tenantId}>
                <SelectTrigger>
                  <SelectValue placeholder={humansQ.isLoading ? "Loading…" : "Select an agent"} />
                </SelectTrigger>
                <SelectContent>
                  {(humansQ.data ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Owning AI Agent <span className="text-destructive">*</span></Label>
              <Select value={owningAiAgentId} onValueChange={setOwningAi} disabled={!tenantId || noAi}>
                <SelectTrigger>
                  <SelectValue placeholder={aisQ.isLoading ? "Loading…" : noAi ? "No AI users in this tenant" : "Select an AI agent"} />
                </SelectTrigger>
                <SelectContent>
                  {(aisQ.data ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {noAi && (
                <p className="text-xs text-destructive">
                  Assign an AI user to this tenant first (Users → Invite, type AI).
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => navigate({ to: "/startups" })}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!canSubmit || submitting}
          className="bg-accent text-accent-foreground hover:bg-accent/90"
        >
          {submitting ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save Changes" : "Create startup"}
        </Button>
      </div>
    </form>
  );
}
