import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { DefaultIntakeOwnershipModeSection } from "@/components/intake/default-intake-ownership-mode-section";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { X, RefreshCw, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { REGION_OPTIONS, regionForCountry } from "@/lib/country-region";
import { CountryCombobox } from "@/components/ui/country-combobox";
import { EditableUrlField } from "@/components/ui/editable-url-field";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  createInvestor, updateInvestor, createInvestorMediaUploadUrl,
} from "@/lib/investors.functions";
import { listAssignableUsers } from "@/lib/startup-ownership.functions";
import { listAssignableTenants } from "@/lib/tenants.functions";
import { switchWorkspace } from "@/lib/session-context.functions";
import { useSessionContext, usePermissions } from "@/hooks/use-session-context";
import { useHasSession } from "@/hooks/use-has-session";
import { supabase } from "@/integrations/supabase/client";
import { TenantFormDialog } from "@/components/tenant-form-dialog";
import {
  EntityMediaEditor, EMPTY_MEDIA_STATE, uploadPending,
  type EntityMediaState, type SlotState,
} from "@/components/media/entity-media-editor";
import { RelationshipLinksEditor, type RelationshipRow } from "@/components/relationships/relationship-links-editor";
import { investorStartupLinksAdapter } from "@/adapters/investorStartupLinksAdapter";
import type { InvestorPortfolioEntryView } from "@/adapters/investor-startup-links-types";
import { WorkspaceConflictNotice } from "@/components/workspace/workspace-conflict-notice";
import { InvestorAutoEnrichButton } from "@/components/investors/investor-auto-enrich-button";
import type { EnrichInvestorResult } from "@/lib/auto-enrich/investor-enrich-adapter";
// Preview-only feature flag. Production stays OFF pending Option A backend
// PRD (MASTER_AGENT authorization + physical tenant-database readiness).
const WORKSPACE_ENFORCEMENT_ENABLED =
  import.meta.env.VITE_WORKSPACE_ENFORCEMENT === "true";

// Preview-only fixtures. Rendered ONLY when the enforcement flag is ON and
// the real merged list is empty. Fixtures never call switchWorkspace, never
// mutate session state, never select a physical database, never persist.
// Selecting one leaves the tenant/active-workspace mismatch banner active
// and the Create button disabled; the inline switch button is disabled with
// a preview-only message.
const FIXTURE_TENANT_PREFIX = "fixture-preview-";
const FIXTURE_TENANTS = [
  { tenantId: `${FIXTURE_TENANT_PREFIX}alpha`, tenantName: "Acme Ventures (preview fixture)", tenantCode: "ACME-FX" },
  { tenantId: `${FIXTURE_TENANT_PREFIX}beta`, tenantName: "Nova Capital (preview fixture)", tenantCode: "NOVA-FX" },
];
const isFixtureTenant = (id: string | null | undefined): boolean =>
  !!id && id.startsWith(FIXTURE_TENANT_PREFIX);

function mapSwitchError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("forbidden") || lower.includes("not a member") || lower.includes("access")) {
    return "You do not have access to this tenant workspace.";
  }
  if (lower.includes("not ready") || lower.includes("provision") || lower.includes("readiness")) {
    return "This tenant workspace is still being prepared.";
  }
  return "Unable to switch workspace. Please try again.";
}


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
  linkedin_url: string | null;
  country: string | null;
  investor_type: string | null;
  aum: string | null;
  min_ticket_size: string | null;
  max_ticket_size: string | null;
  bio: string | null;
  keywords: string[] | null;
  
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
  const fetchAssignableTenants = useServerFn(listAssignableTenants);
  const doSwitch = useServerFn(switchWorkspace);
  const [switchPending, setSwitchPending] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const enabled = useHasSession();
  const perms = usePermissions();

  const sessionTenants = useMemo(() => session?.tenants ?? [], [session]);
  // Principal-scoped cache key. Cross-principal cleanup is delegated to the
  // existing centralized session framework (session-context invalidation +
  // WorkspaceSwitcher.invalidateQueries). No new auth listener here.
  const principalRef = session?.user?.id ?? null;
  const assignableQ = useQuery({
    queryKey: ["assignable-tenants", principalRef],
    queryFn: () => fetchAssignableTenants(),
    enabled: enabled && !!principalRef,
    staleTime: 60_000,
  });

  // Merge session.tenants with listAssignableTenants; dedup by tenant id;
  // sort by tenantName (case-insensitive). Treated as an authorized-choice
  // list only — never as authorization or routing authority.
  const mergedTenants = useMemo(() => {
    const map = new Map<string, { tenantId: string; tenantName: string; tenantCode: string }>();
    for (const t of sessionTenants) {
      map.set(t.tenantId, { tenantId: t.tenantId, tenantName: t.tenantName, tenantCode: t.tenantCode });
    }
    for (const t of assignableQ.data ?? []) {
      if (!map.has(t.id)) {
        map.set(t.id, { tenantId: t.id, tenantName: t.tenantName, tenantCode: t.tenantCode });
      }
    }
    const merged = Array.from(map.values()).sort((a, b) =>
      a.tenantName.localeCompare(b.tenantName, undefined, { sensitivity: "base" }),
    );
    if (
      WORKSPACE_ENFORCEMENT_ENABLED &&
      merged.length === 0 &&
      !assignableQ.isLoading &&
      !assignableQ.isError
    ) {
      return [...FIXTURE_TENANTS];
    }
    return merged;
  }, [sessionTenants, assignableQ.data, assignableQ.isLoading, assignableQ.isError]);

  const activeTenantId = session?.activeWorkspace.tenantId ?? null;
  const activeTenantName = session?.activeWorkspace.tenantName ?? null;

  const [tenantId, setTenantId] = useState<string>(investor?.tenant_id ?? "");
  const [newTenantOpen, setNewTenantOpen] = useState(false);

  // Positive-match rule: missing active tenant is a mismatch; missing
  // selection is a mismatch; only a non-null equal pair matches.
  const tenantMatchesActive =
    !!activeTenantId && !!tenantId && activeTenantId === tenantId;

  // Preselect active workspace tenant only in create mode, only when no
  // deliberate selection exists, and only when it is present in the merged
  // authorized list. Never silently pick the first tenant. Never overwrite
  // a deliberate selection after refetch.
  useEffect(() => {
    if (isEdit) return;
    if (tenantId) return;
    if (!activeTenantId) return;
    if (!mergedTenants.some((t) => t.tenantId === activeTenantId)) return;
    setTenantId(activeTenantId);
  }, [isEdit, tenantId, activeTenantId, mergedTenants]);

  const selectedTenantName =
    mergedTenants.find((t) => t.tenantId === tenantId)?.tenantName ?? null;

  // Core fields (hydrated from investor in edit mode)
  const [displayName, setDisplayName] = useState(investor?.investor_name ?? "");
  const [firmName, setFirmName] = useState(investor?.firm_name ?? "");
  const [title, setTitle] = useState(investor?.investor_type ?? "");
  const [email, setEmail] = useState(investor?.email ?? "");
  const [headquarters, setHeadquarters] = useState(investor?.country ?? "");
  const [region, setRegion] = useState<string>(() => regionForCountry(investor?.country ?? "") || "");
  const [city, setCity] = useState("");
  const [businessAddress, setBusinessAddress] = useState(investor?.business_address ?? "");
  const [companyUrl, setCompanyUrl] = useState(investor?.website_url ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(investor?.linkedin_url ?? "");
  const [yearFounded, setYearFounded] = useState<string>(investor?.year_founded?.toString() ?? "");
  const [aum, setAum] = useState(investor?.aum ?? "");
  const [minTicket, setMinTicket] = useState(investor?.min_ticket_size ?? "");
  const [maxTicket, setMaxTicket] = useState(investor?.max_ticket_size ?? "");
  const [bio, setBio] = useState(investor?.bio ?? "");
  const [keywords, setKeywords] = useState<string[]>(investor?.keywords ?? []);
  const [keywordDraft, setKeywordDraft] = useState("");
  
  const [preferredStages, setPreferredStages] = useState<string[]>(investor?.preferred_stages ?? []);
  const [preferredIndustries, setPreferredIndustries] = useState<string[]>(investor?.preferred_industries ?? []);
  const [customIndustry, setCustomIndustry] = useState("");
  const [investmentFocus, setInvestmentFocus] = useState<string[]>(investor?.investment_focus ?? []);
  const [focusDraft, setFocusDraft] = useState("");

  const [status, setStatus] = useState(investor?.status ?? "Prospect");
  const [visibility, setVisibility] = useState(investor?.visibility ?? "Tenant");
  const [owningAgentUserId, setOwningAgent] = useState("");
  const [owningAiAgentId, setOwningAi] = useState("");

  // Clear ownership when the tenant changes or its active-workspace match is
  // lost — CREATE mode only. Edit mode preserves existing ownership values.
  useEffect(() => {
    if (isEdit) return;
    setOwningAgent("");
    setOwningAi("");
  }, [isEdit, tenantId, tenantMatchesActive]);

  const [media, setMedia] = useState<EntityMediaState>(() => hydrateMedia(investor));

  // Investment Portfolio (V3) — staged in local UI state until Save. Save is
  // a stub via investorStartupLinksAdapter (future SnackPortal2 API Gateway).
  const [portfolioEntries, setPortfolioEntries] = useState<InvestorPortfolioEntryView[]>([]);

  const humansQ = useQuery({
    queryKey: ["assignable-humans", tenantId],
    queryFn: () => fetchUsers({ data: { tenantId, userType: "Human" } }),
    enabled: enabled && !!tenantId && tenantMatchesActive && !isEdit,
  });
  const aisQ = useQuery({
    queryKey: ["assignable-ai", tenantId],
    queryFn: () => fetchUsers({ data: { tenantId, userType: "AI" } }),
    enabled: enabled && !!tenantId && tenantMatchesActive && !isEdit,
  });
  const humanOptions = tenantMatchesActive ? (humansQ.data ?? []) : [];
  const aiOptions = tenantMatchesActive ? (aisQ.data ?? []) : [];
  const noAi = tenantMatchesActive && !aisQ.isLoading && aiOptions.length === 0;

  const toggle = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  /**
   * Auto Enrich merge — back-fills ONLY currently empty fields, so nothing the
   * user already entered is overwritten. Mirrors PitchSnack1 Admin behaviour.
   */
  const applyEnrichment = (r: EnrichInvestorResult) => {
    const fillText = (cur: string, next: string | undefined, set: (v: string) => void) => {
      if (!cur.trim() && next && next.trim()) set(next.trim());
    };
    fillText(displayName, r.investorName, setDisplayName);
    fillText(firmName, r.firmName, setFirmName);
    fillText(title, r.investorType, setTitle);
    fillText(email, r.email, setEmail);
    fillText(businessAddress, r.businessAddress, setBusinessAddress);
    fillText(city, r.city, setCity);
    fillText(linkedinUrl, r.linkedinUrl, setLinkedinUrl);
    fillText(bio, r.bio, setBio);
    fillText(aum, r.aum, setAum);
    fillText(minTicket, r.minTicketSize, setMinTicket);
    fillText(maxTicket, r.maxTicketSize, setMaxTicket);
    if (!yearFounded.trim() && r.yearFounded) setYearFounded(String(r.yearFounded));
    if (!headquarters.trim() && r.headquarters?.trim()) {
      const country = r.headquarters.trim();
      setHeadquarters(country);
      if (!region) {
        const suggested = regionForCountry(country);
        if (suggested) setRegion(suggested);
      }
    }
    if (keywords.length === 0 && r.keywords?.length) setKeywords(r.keywords.slice(0, 5));
    if (preferredStages.length === 0 && r.preferredStages?.length)
      setPreferredStages(r.preferredStages);
    if (preferredIndustries.length === 0 && r.preferredIndustries?.length)
      setPreferredIndustries(r.preferredIndustries.slice(0, 5));
    if (investmentFocus.length === 0 && r.investmentFocus?.length)
      setInvestmentFocus(r.investmentFocus.slice(0, 10));
  };

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
      preferredStages,
      preferredIndustries,
      investmentFocus,
    };
  }

  const createM = useMutation({
    mutationFn: async (vars: { selectedTenantId: string; activeTenantId: string | null }) => {
      // Defensive re-check inside the mutation using EXPLICIT ids captured at
      // submit time (positive-match rule; missing active = mismatch).
      if (
        !vars.activeTenantId ||
        !vars.selectedTenantId ||
        vars.activeTenantId !== vars.selectedTenantId
      ) {
        throw new Error(
          "Selected tenant is not the active workspace. Switch workspace to continue.",
        );
      }
      // Create first so storage RLS authorizes reads under the real investor id.
      const res = await create({
        data: {
          tenantId: vars.selectedTenantId,
          investorName: displayName,
          websiteUrl: companyUrl || null,
          linkedinUrl: linkedinUrl || null,
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
      // Stub adapter save — future SnackPortal2 API Gateway. UI-staged only.
      void investorStartupLinksAdapter.saveInvestorInvestmentPortfolio(res.id, portfolioEntries);
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
          linkedinUrl: linkedinUrl || null,
          country: headquarters || null,
          investorType: title || null,
          logoPath,
          media: resolvedMedia,
          ...buildProfile(),
        },
      });
    },
    onSuccess: () => {
      // Stub adapter save — future SnackPortal2 API Gateway. UI-staged only.
      void investorStartupLinksAdapter.saveInvestorInvestmentPortfolio(investor!.id, portfolioEntries);
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["investor", investor!.id] });
      qc.invalidateQueries({ queryKey: ["investors"] });
      navigate({ to: "/investors/$id", params: { id: investor!.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = isEdit
    ? !!displayName
    : !!(
        tenantMatchesActive &&
        displayName &&
        owningAgentUserId &&
        owningAiAgentId
      );
  const submitting = createM.isPending || updateM.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isEdit) {
      updateM.mutate();
      return;
    }
    // Positive-match validation BEFORE calling the mutation. Do not rely on
    // onMutate alone; the mutation itself repeats this defensively using the
    // explicit ids passed as variables.
    if (!tenantMatchesActive) {
      toast.error(
        activeTenantId
          ? "Selected tenant is not the active workspace. Switch workspace to continue."
          : "No active workspace. Switch to the target tenant workspace before creating an investor.",
      );
      return;
    }
    if (!displayName || !owningAgentUserId || !owningAiAgentId) {
      toast.error("Complete required fields.");
      return;
    }
    createM.mutate({ selectedTenantId: tenantId, activeTenantId });
  }

  const tenantsLoading = assignableQ.isLoading && mergedTenants.length === 0;
  const tenantsError = assignableQ.isError && mergedTenants.length === 0;
  const tenantsEmpty =
    !assignableQ.isLoading && !assignableQ.isError && mergedTenants.length === 0;
  const canCreateTenant = perms.isResolved && perms.has("tenants.write");

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-card text-sm"
    >
      {/* Tenant (create only) */}
      {!isEdit && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Tenant <span className="text-destructive">*</span></Label>
            {canCreateTenant && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setNewTenantOpen(true)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> New tenant…
              </Button>
            )}
          </div>
          <Select
            value={tenantId}
            onValueChange={setTenantId}
            disabled={tenantsLoading || tenantsEmpty}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  tenantsLoading
                    ? "Loading tenants…"
                    : tenantsError
                      ? "Couldn't load tenants"
                      : tenantsEmpty
                        ? "No tenants available"
                        : "Select tenant"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {mergedTenants.map((t) => {
                const fx = isFixtureTenant(t.tenantId);
                return (
                  <SelectItem key={t.tenantId} value={t.tenantId}>
                    <span className="flex items-center gap-2">
                      <span>{t.tenantName}</span>
                      {fx && (
                        <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
                          PREVIEW FIXTURE
                        </span>
                      )}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {tenantsError && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <span>Couldn't load tenants.</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => assignableQ.refetch()}
              >
                Retry
              </Button>
            </div>
          )}
          {tenantsEmpty && (
            <p className="text-xs text-muted-foreground">
              You must create or gain access to a tenant before creating an investor.
            </p>
          )}
          {tenantId && !tenantMatchesActive && (
            <WorkspaceConflictNotice
              recordWorkspaceName={selectedTenantName}
              activeWorkspaceName={activeTenantName}
              switching={switchPending}
              switchDisabled={!WORKSPACE_ENFORCEMENT_ENABLED || isFixtureTenant(tenantId)}
              switchDisabledReason={
                isFixtureTenant(tenantId)
                  ? "Preview fixture — activation disabled (no backend call)."
                  : !WORKSPACE_ENFORCEMENT_ENABLED
                    ? "Workspace switching from this form is currently unavailable."
                    : undefined
              }
              error={switchError}
              onSwitch={async () => {
                setSwitchError(null);
                setSwitchPending(true);
                try {
                  await doSwitch({ data: { tenantId, workspaceType: "TENANT" } });
                  await qc.invalidateQueries({ queryKey: ["session-context"] });
                  await qc.invalidateQueries({
                    queryKey: ["assignable-tenants", principalRef],
                  });
                } catch (e) {
                  setSwitchError(mapSwitchError((e as Error).message ?? ""));
                } finally {
                  setSwitchPending(false);
                }
              }}
            />
          )}

        </div>
      )}

      <TenantFormDialog
        open={newTenantOpen}
        onOpenChange={setNewTenantOpen}
        tenant={null}
        onSaved={() => {
          assignableQ.refetch();
          qc.invalidateQueries({ queryKey: ["session-context"] });
          // NOTE: AssignableTenantDTO exposes no readiness/status field, so
          // we cannot safely auto-select a newly created tenant. Reported as
          // an out-of-scope contract gap. User must activate the new tenant
          // via WorkspaceSwitcher before the form will accept it.
          toast.success("Tenant created — provisioning pending");
        }}
      />


      {/* Logo + Media + Auto Enrich (right-aligned, same row) */}
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <EntityMediaEditor value={media} onChange={setMedia} screenshot={{ websiteUrl: companyUrl }} />
        </div>
        <div className="pt-6 shrink-0">
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <InvestorAutoEnrichButton
                  websiteUrl={companyUrl}
                  onEnriched={applyEnrichment}
                  disabled={submitting}
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
          <Input type="number" min={1900} max={2030} value={yearFounded}
            onChange={(e) => setYearFounded(e.target.value)} placeholder="e.g. 2020" />
        </div>
        <div className="space-y-1.5">
          <Label>Company Name <span className="text-destructive">*</span></Label>
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

      {/* Row 2: Headquarters | Region | City */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <div className="flex h-6 items-center">
            <Label className="whitespace-pre">Country{"\n"}</Label>
          </div>
          <CountryCombobox
            value={headquarters}
            onChange={(v) => {
              setHeadquarters(v);
              if (!v) {
                setRegion("");
              } else if (!region) {
                const suggested = regionForCountry(v);
                if (suggested) setRegion(suggested);
              }
            }}
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

      {/* Row 3: Email | Company URL | LinkedIn URL */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Email Address</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="investor@example.com" maxLength={255} />
        </div>
        <div className="space-y-1.5">
          <EditableUrlField
            label="Company URL"
            value={companyUrl}
            onChange={setCompanyUrl}
            placeholder="https://example.com"
          />
        </div>

        <EditableUrlField
          label="LinkedIn URL"
          value={linkedinUrl}
          onChange={setLinkedinUrl}
          placeholder="https://www.linkedin.com/company/…"
        />
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

      {/* Investment Portfolio (V3) — UI-staged only; backend persistence pending. */}
      <RelationshipLinksEditor
        mode="startups"
        title="Investment Portfolio"
        rows={portfolioEntries.map((e): RelationshipRow => ({
          id: e.id,
          refId: e.startupId,
          name: e.companyName,
          subtitle: e.industry,
          industry: e.industry,
          relationshipType: e.relationshipType,
          status: e.status,
        }))}
        onChange={(next) =>
          setPortfolioEntries(
            next.map((r): InvestorPortfolioEntryView => ({
              id: r.id,
              startupId: r.refId,
              companyName: r.name,
              industry: r.industry,
              relationshipType: r.relationshipType,
              status: r.status,
            })),
          )
        }
      />


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
          <DefaultIntakeOwnershipModeSection
            domain="investor"
            className="mb-4"
            helperText="This Investor will be assigned temporarily to the Investor Intake team and added to the Default Intake Queue."
          />
          <h3 className="text-sm font-semibold">Ownership (required)</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Every investor must have one human Owning Agent and one Owning AI Agent.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Owning Agent <span className="text-destructive">*</span></Label>
              <Select
                value={owningAgentUserId}
                onValueChange={setOwningAgent}
                disabled={!tenantMatchesActive}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !tenantMatchesActive
                        ? "Select a matching tenant first"
                        : humansQ.isLoading
                          ? "Loading…"
                          : "Select an agent"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {humanOptions.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Owning AI Agent <span className="text-destructive">*</span></Label>
              <Select
                value={owningAiAgentId}
                onValueChange={setOwningAi}
                disabled={!tenantMatchesActive || noAi}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !tenantMatchesActive
                        ? "Select a matching tenant first"
                        : aisQ.isLoading
                          ? "Loading…"
                          : noAi
                            ? "No AI users in this tenant"
                            : "Select an AI agent"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {aiOptions.map((u) => (
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
