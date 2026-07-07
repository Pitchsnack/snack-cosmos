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
import { CountryCombobox } from "@/components/ui/country-combobox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  createInvestor, updateInvestor, createInvestorMediaUploadUrl,
} from "@/lib/investors.functions";
import { listAssignableUsers } from "@/lib/startup-ownership.functions";
import { useSessionContext } from "@/hooks/use-session-context";
import { useHasSession } from "@/hooks/use-has-session";
import { supabase } from "@/integrations/supabase/client";
import {
  EntityMediaEditor, EMPTY_MEDIA_STATE, uploadPending,
  type EntityMediaState, type SlotState,
} from "@/components/media/entity-media-editor";

// ── Taxonomies (mirrored from PitchSnack1 AdminInvestorManager) ──
const INVESTOR_CLASSIFICATIONS = [
  "Angel", "Venture Capital", "Private Equity", "Corporate VC",
  "Family Office", "Corporate Enterprise", "Sovereign Fund", "Incubator/Accelerator",
];
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
const BUSINESS_MODELS = ["B2B", "B2C", "D2C", "B2B2C", "B2G"];
const STAGES = ["Ideation", "Early Stage", "Growth Stage", "Maturity Stage"];
const INDUSTRIES = [
  "FinTech", "eCommerce & Marketplace", "MarTech", "HealthTech",
  "Sustainability", "Mobility & Logistics", "DeepTech", "Defense",
  "EdTech", "Gaming", "PropTech", "AgriTech", "FMCG", "Others",
];
const INVESTOR_INDUSTRIES = ["Sector Agnostic", ...INDUSTRIES];
const STATUSES = ["Prospect","Active","Engaged","Investing","Inactive","Archived"];
const VISIBILITIES = ["Private","Tenant","Shared","Archived"];

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

/** Shape of the existing investor passed to the form in edit mode. Matches
 *  the projection returned by `getInvestor`. */
export interface InvestorEditModel {
  id: string;
  tenant_id: string;
  investor_name: string;
  firm_name: string | null;
  email: string | null;
  business_address: string | null;
  year_founded: number | null;
  website_url: string | null;
  country: string | null;
  investor_type: string | null;
  aum: string | null;
  min_ticket_size: string | null;
  max_ticket_size: string | null;
  bio: string | null;
  keywords: string[] | null;
  business_model: string[] | null;
  preferred_stages: string[] | null;
  preferred_industries: string[] | null;
  investment_focus: string[] | null;
  status: string;
  visibility: string;
  logo_url: string | null;
  logo_signed_url: string | null;
  media: Array<{ slot: 1 | 2 | 3; image_path: string; image_signed_url: string | null }>;
}

function hydrateMedia(investor?: InvestorEditModel): EntityMediaState {
  if (!investor) return EMPTY_MEDIA_STATE;
  const logo: SlotState = {
    persistedPath: investor.logo_url,
    signedUrl: investor.logo_signed_url,
    pendingFile: null,
  };
  const slots: [SlotState, SlotState, SlotState] = [
    { persistedPath: null, signedUrl: null, pendingFile: null },
    { persistedPath: null, signedUrl: null, pendingFile: null },
    { persistedPath: null, signedUrl: null, pendingFile: null },
  ];
  for (const m of investor.media ?? []) {
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

interface Props {
  investor?: InvestorEditModel;
}

export function InvestorForm({ investor }: Props) {
  const isEdit = !!investor;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: session } = useSessionContext();
  const create = useServerFn(createInvestor);
  const update = useServerFn(updateInvestor);
  const getUploadUrl = useServerFn(createInvestorMediaUploadUrl);
  const fetchUsers = useServerFn(listAssignableUsers);
  const enabled = useHasSession();

  const tenants = useMemo(() => session?.tenants ?? [], [session]);
  const [tenantId, setTenantId] = useState<string>(investor?.tenant_id ?? "");
  useEffect(() => {
    if (!isEdit && !tenantId && tenants.length) {
      setTenantId(session?.activeWorkspace.tenantId ?? tenants[0].tenantId);
    }
  }, [tenants, tenantId, session, isEdit]);

  // Core fields (hydrated from investor in edit mode)
  const [displayName, setDisplayName] = useState(investor?.investor_name ?? "");
  const [firmName, setFirmName] = useState(investor?.firm_name ?? "");
  const [title, setTitle] = useState(investor?.investor_type ?? "");
  const [email, setEmail] = useState(investor?.email ?? "");
  const [headquarters, setHeadquarters] = useState(investor?.country ?? "");
  const [businessAddress, setBusinessAddress] = useState(investor?.business_address ?? "");
  const [companyUrl, setCompanyUrl] = useState(investor?.website_url ?? "");
  const [yearFounded, setYearFounded] = useState<string>(investor?.year_founded?.toString() ?? "");
  const [aum, setAum] = useState(investor?.aum ?? "");
  const [minTicket, setMinTicket] = useState(investor?.min_ticket_size ?? "");
  const [maxTicket, setMaxTicket] = useState(investor?.max_ticket_size ?? "");
  const [bio, setBio] = useState(investor?.bio ?? "");
  const [keywords, setKeywords] = useState<string[]>(investor?.keywords ?? []);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [businessModel, setBusinessModel] = useState<string[]>(investor?.business_model ?? []);
  const [preferredStages, setPreferredStages] = useState<string[]>(investor?.preferred_stages ?? []);
  const [preferredIndustries, setPreferredIndustries] = useState<string[]>(investor?.preferred_industries ?? []);
  const [customIndustry, setCustomIndustry] = useState("");
  const [investmentFocus, setInvestmentFocus] = useState<string[]>(investor?.investment_focus ?? []);
  const [focusDraft, setFocusDraft] = useState("");

  const [status, setStatus] = useState(investor?.status ?? "Prospect");
  const [visibility, setVisibility] = useState(investor?.visibility ?? "Tenant");
  const [owningAgentUserId, setOwningAgent] = useState("");
  const [owningAiAgentId, setOwningAi] = useState("");

  const [media, setMedia] = useState<EntityMediaState>(() => hydrateMedia(investor));

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

  const addKeyword = () => {
    const t = keywordDraft.trim();
    if (!t || keywords.includes(t) || keywords.length >= 5) return;
    setKeywords([...keywords, t]); setKeywordDraft("");
  };
  const addFocus = () => {
    const t = focusDraft.trim();
    if (!t || investmentFocus.includes(t)) return;
    setInvestmentFocus([...investmentFocus, t]); setFocusDraft("");
  };
  const addCustomIndustry = () => {
    const t = customIndustry.trim();
    if (!t || preferredIndustries.includes(t)) return;
    setPreferredIndustries([...preferredIndustries, t]); setCustomIndustry("");
  };

  async function uploadAllForInvestor(targetInvestorId: string) {
    return uploadPending(
      media,
      ({ kind, ext }) =>
        getUploadUrl({ data: { tenantId, investorId: targetInvestorId, kind, ext } }),
      supabase.storage.from("startup-media"),
    );
  }

  function buildProfile() {
    return {
      firmName: firmName || null,
      email: email || null,
      businessAddress: businessAddress || null,
      yearFounded: yearFounded ? Number(yearFounded) : null,
      aum: aum || null,
      minTicketSize: minTicket || null,
      maxTicketSize: maxTicket || null,
      ticketSize:
        minTicket && maxTicket ? `${minTicket} – ${maxTicket}` : minTicket || maxTicket || null,
      bio: bio || null,
      shortDescription: bio ? bio.slice(0, 500) : null,
      keywords,
      businessModel,
      preferredStages,
      preferredIndustries,
      investmentFocus,
    };
  }

  const createM = useMutation({
    mutationFn: async () => {
      // Create first so storage RLS authorizes reads under the real investor id.
      const res = await create({
        data: {
          tenantId,
          investorName: displayName,
          websiteUrl: companyUrl || null,
          country: headquarters || null,
          investorType: title || null,
          status: status as never,
          visibility: visibility as never,
          owningAgentUserId,
          owningAiAgentId,
          logoPath: null,
          media: [],
          ...buildProfile(),
        },
      });
      const newId = (res as { id: string }).id;
      const { logoPath, media: uploadedMedia } = await uploadAllForInvestor(newId);
      if (logoPath || uploadedMedia.length > 0) {
        await update({ data: { id: newId, logoPath, media: uploadedMedia } });
      }
      return { id: newId };
    },
    onSuccess: (res) => {
      toast.success("Investor created");
      qc.invalidateQueries({ queryKey: ["investors"] });
      navigate({ to: "/investors/$id", params: { id: res.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateM = useMutation({
    mutationFn: async () => {
      const { logoPath, media: resolvedMedia } = await uploadAllForInvestor(investor!.id);
      return update({
        data: {
          id: investor!.id,
          investorName: displayName,
          websiteUrl: companyUrl || null,
          country: headquarters || null,
          investorType: title || null,
          logoPath,
          media: resolvedMedia,
          ...buildProfile(),
        },
      });
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["investor", investor!.id] });
      qc.invalidateQueries({ queryKey: ["investors"] });
      navigate({ to: "/investors/$id", params: { id: investor!.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = isEdit
    ? !!displayName
    : !!(tenantId && displayName && owningAgentUserId && owningAiAgentId);
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
              {tenants.map((t) => (
                <SelectItem key={t.tenantId} value={t.tenantId}>{t.tenantName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Logo + Media */}
      <EntityMediaEditor value={media} onChange={setMedia} />

      {/* Row 1: Year Founded | Display Name | Investor Classification */}
      <div className="grid grid-cols-[100px_1fr_220px] gap-4">
        <div className="space-y-1.5">
          <Label>Year Founded</Label>
          <Input type="number" min={1900} max={2030} value={yearFounded}
            onChange={(e) => setYearFounded(e.target.value)} placeholder="e.g. 2020" />
        </div>
        <div className="space-y-1.5">
          <Label>Display Name <span className="text-destructive">*</span></Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Sequoia Capital" maxLength={100} required />
        </div>
        <div className="space-y-1.5">
          <Label>Investor Classification</Label>
          <Select value={title || "none"} onValueChange={(v) => setTitle(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Select classification" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Select —</SelectItem>
              {INVESTOR_CLASSIFICATIONS.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 2: Email | Headquarters | Company URL */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Email Address</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="investor@example.com" maxLength={255} />
        </div>
        <div className="space-y-1.5">
          <Label>Headquarters</Label>
          <Input value={headquarters} onChange={(e) => setHeadquarters(e.target.value)} placeholder="Country" />
        </div>
        <div className="space-y-1.5">
          <Label>Company URL</Label>
          <Input type="url" value={companyUrl} onChange={(e) => setCompanyUrl(e.target.value)} placeholder="https://example.com" />
        </div>
      </div>

      {/* Row 3: Firm Name | Business Address */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Firm Name</Label>
          <Input value={firmName} onChange={(e) => setFirmName(e.target.value)}
            placeholder="e.g. Sequoia Capital" maxLength={100} />
        </div>
        <div className="space-y-1.5">
          <Label>Business Address</Label>
          <Input value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)}
            placeholder="123 Main St, City, Country" maxLength={500} />
        </div>
      </div>

      {/* Row 4: AUM | Min Ticket | Max Ticket */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Fund's AUM</Label>
          <Select value={aum || "none"} onValueChange={(v) => setAum(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Select Fund Size" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Select Fund Size —</SelectItem>
              {AUM_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Min Ticket Size</Label>
          <Select value={minTicket || "none"} onValueChange={(v) => setMinTicket(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Select Min" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Select Min —</SelectItem>
              {TICKET_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Max Ticket Size</Label>
          <Select value={maxTicket || "none"} onValueChange={(v) => setMaxTicket(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Select Max" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Select Max —</SelectItem>
              {TICKET_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* About */}
      <div className="space-y-1.5">
        <Label>About Company</Label>
        <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={2000}
          placeholder="Brief description of the company" />
      </div>

      {/* Tags */}
      <div className="space-y-1.5">
        <Label>Product &amp; Service Tags (Up to 5)</Label>
        <div className="flex flex-wrap gap-2">
          {keywords.map((k) => (
            <button key={k} type="button"
              onClick={() => setKeywords(keywords.filter((x) => x !== k))}
              className="px-3 py-1 rounded-full text-xs border bg-primary text-primary-foreground border-primary inline-flex items-center gap-1">
              {k} <X className="h-3 w-3" />
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={keywordDraft} onChange={(e) => setKeywordDraft(e.target.value)}
            placeholder="Example: Portfolio Management, Due Diligence"
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") { e.preventDefault(); addKeyword(); }
            }}
            disabled={keywords.length >= 5} maxLength={50} />
          <Button type="button" variant="outline" size="sm" onClick={addKeyword} disabled={keywords.length >= 5}>
            Add
          </Button>
        </div>
      </div>

      {/* Business Model */}
      <div className="space-y-1.5">
        <Label>Business Model</Label>
        <div className="flex flex-wrap gap-2">
          {BUSINESS_MODELS.map((bm) => (
            <Pill key={bm} active={businessModel.includes(bm)} onClick={() => setBusinessModel(toggle(businessModel, bm))}>
              {bm}
            </Pill>
          ))}
        </div>
      </div>

      {/* Geography */}
      <div className="space-y-1.5">
        <Label>Geography <span className="text-xs text-muted-foreground">({investmentFocus.length}/10)</span></Label>
        <div className="flex flex-wrap gap-2">
          {investmentFocus.map((g) => (
            <button key={g} type="button"
              onClick={() => setInvestmentFocus(investmentFocus.filter((x) => x !== g))}
              className="px-3 py-1 rounded-full text-xs border bg-primary text-primary-foreground border-primary inline-flex items-center gap-1">
              {g} <X className="h-3 w-3" />
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={focusDraft} onChange={(e) => setFocusDraft(e.target.value)}
            placeholder="Add country..."
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") { e.preventDefault(); addFocus(); }
            }}
            disabled={investmentFocus.length >= 10} />
          <Button type="button" variant="outline" size="sm" onClick={addFocus} disabled={investmentFocus.length >= 10}>
            Add
          </Button>
        </div>
      </div>

      {/* Preferred Stages */}
      <div className="space-y-1.5">
        <Label>Preferred Stages</Label>
        <div className="flex flex-wrap gap-2">
          {STAGES.map((s) => (
            <Pill key={s} active={preferredStages.includes(s)} onClick={() => setPreferredStages(toggle(preferredStages, s))}>
              {s}
            </Pill>
          ))}
        </div>
      </div>

      {/* Preferred Industries */}
      <div className="space-y-1.5">
        <Label>Preferred Industries</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {INVESTOR_INDUSTRIES.map((ind) => (
            <Pill key={ind} active={preferredIndustries.includes(ind)} onClick={() => setPreferredIndustries(toggle(preferredIndustries, ind))}>
              {ind}
            </Pill>
          ))}
          {preferredIndustries
            .filter((i) => !INVESTOR_INDUSTRIES.includes(i))
            .map((c) => (
              <button key={c} type="button"
                onClick={() => setPreferredIndustries(preferredIndustries.filter((x) => x !== c))}
                className="px-3 py-1 rounded-full text-xs border bg-primary text-primary-foreground border-primary inline-flex items-center gap-1">
                {c} <X className="h-3 w-3" />
              </button>
            ))}
        </div>
        <div className="flex gap-2">
          <Input value={customIndustry} onChange={(e) => setCustomIndustry(e.target.value)}
            placeholder="Add custom industry..." maxLength={50}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") { e.preventDefault(); addCustomIndustry(); }
            }} />
          <Button type="button" variant="outline" size="sm" onClick={addCustomIndustry}>Add</Button>
        </div>
      </div>

      {/* Status & Visibility (create only — edit page has its own controls) */}
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
            Every investor must have one human Owning Agent and one Owning AI Agent.
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
        <Button type="button" variant="outline" onClick={() => navigate({ to: "/investors" })}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!canSubmit || submitting}
          className="bg-accent text-accent-foreground hover:bg-accent/90"
        >
          {submitting ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save Changes" : "Create investor"}
        </Button>
      </div>
    </form>
  );
}
