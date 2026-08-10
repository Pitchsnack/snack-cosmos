import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { DefaultIntakeOwnershipModeSection } from "@/components/intake/default-intake-ownership-mode-section";
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
import { switchWorkspace } from "@/lib/session-context.functions";
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
import { RelationshipLinksEditor, type RelationshipRow } from "@/components/relationships/relationship-links-editor";
import { CreateInvestorDialog } from "@/components/relationships/create-investor-dialog";
import { WorkspaceConflictNotice } from "@/components/workspace/workspace-conflict-notice";
import { investorStartupLinksAdapter } from "@/adapters/investorStartupLinksAdapter";
import type { StartupInvestorLinkView } from "@/adapters/investor-startup-links-types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AutoEnrichButton } from "./auto-enrich-button";
import type { EnrichStartupResult } from "@/lib/auto-enrich/auto-enrich-adapter";
import { buildStartupFormSnapshot } from "@/lib/forms/build-startup-form-snapshot";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { UnsavedChangesDialog } from "@/components/common/unsaved-changes-dialog";
// Preview-only feature flag. Production stays OFF pending Option A backend
// PRD (MASTER_AGENT authorization + physical tenant-database readiness).
const WORKSPACE_ENFORCEMENT_ENABLED =
  import.meta.env.VITE_WORKSPACE_ENFORCEMENT === "true";

// Preview-only, non-persistent fixture tenants. Rendered ONLY when the flag
// is ON and the merged real list is empty. Never call switchWorkspace, never
// mutate session state, never select a physical database, never persist.
const FIXTURE_TENANT_PREFIX = "fixture-preview-";
const FIXTURE_TENANTS = [
  { id: `${FIXTURE_TENANT_PREFIX}alpha`, tenantName: "Acme Ventures (preview fixture)", tenantCode: "ACME-FX" },
  { id: `${FIXTURE_TENANT_PREFIX}beta`, tenantName: "Nova Capital (preview fixture)", tenantCode: "NOVA-FX" },
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
  /** Where to navigate after a successful create. Defaults to the new startup's detail page. */
  redirectAfterCreate?: "detail" | "my-startups";
  /** Which module owns this form — keeps post-save navigation inside that module. */
  workspace?: "startups" | "my-startups";
  /** My Startups list state to restore after a successful edit. */
  myStartupsReturnSearch?: {
    q?: string;
    stage?: string;
    industry?: string;
    hq?: string;
    ct?: string;
    ptag?: string;
    mtag?: string;
    sort?: "updated_desc" | "created_desc" | "name_asc" | "name_desc";
    view?: "grid" | "split" | "list";
    selected?: string;
    page?: number;
    fav?: boolean;
  };
  /** Startup Directory list state to restore after a successful edit. */
  directoryReturnSearch?: {
    q?: string;
    stage?: string;
    industry?: string;
    hq?: string;
    ct?: string;
    ptag?: string;
    mtag?: string;
    sort?: "updated_desc" | "created_desc" | "name_asc" | "name_desc";
    view?: "grid" | "split" | "list";
    selected?: string;
    page?: number;
    fav?: boolean;
  };
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

export function StartupForm({
  startup,
  redirectAfterCreate = "detail",
  workspace = "startups",
  myStartupsReturnSearch,
  directoryReturnSearch,
}: Props) {
  const isEdit = !!startup;
  const isMyWorkspace = workspace === "my-startups" || redirectAfterCreate === "my-startups";
  const isMyStartupsCreate = !isEdit && redirectAfterCreate === "my-startups";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: session } = useSessionContext();
  const create = useServerFn(createStartup);
  const update = useServerFn(updateStartup);
  const getUploadUrl = useServerFn(createStartupMediaUploadUrl);
  const fetchUsers = useServerFn(listAssignableUsers);
  const fetchTenants = useServerFn(listAssignableTenants);
  const doSwitch = useServerFn(switchWorkspace);
  const [switchPending, setSwitchPending] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const enabled = useHasSession();

  const principalRef = session?.user?.id ?? null;
  const tenantsQ = useQuery({
    queryKey: WORKSPACE_ENFORCEMENT_ENABLED
      ? ["assignable-tenants", principalRef]
      : ["assignable-tenants"],
    queryFn: () => fetchTenants(),
    enabled: enabled && !isEdit,
    staleTime: 60_000,
  });
  const sessionTenants = useMemo(() => session?.tenants ?? [], [session]);

  // Merged tenant list (flag ON only). Authorized-choice list; not
  // authorization, membership, routing, or physical-database selection.
  const mergedTenants = useMemo(() => {
    const raw = tenantsQ.data ?? [];
    if (!WORKSPACE_ENFORCEMENT_ENABLED) {
      return raw.map((t) => ({ id: t.id, tenantName: t.tenantName, tenantCode: t.tenantCode }));
    }
    const map = new Map<string, { id: string; tenantName: string; tenantCode: string }>();
    for (const t of sessionTenants) {
      map.set(t.tenantId, { id: t.tenantId, tenantName: t.tenantName, tenantCode: t.tenantCode });
    }
    for (const t of raw) {
      if (!map.has(t.id)) map.set(t.id, { id: t.id, tenantName: t.tenantName, tenantCode: t.tenantCode });
    }
    const merged = Array.from(map.values()).sort((a, b) =>
      a.tenantName.localeCompare(b.tenantName, undefined, { sensitivity: "base" }),
    );
    if (
      WORKSPACE_ENFORCEMENT_ENABLED &&
      merged.length === 0 &&
      !tenantsQ.isLoading &&
      !tenantsQ.isError
    ) {
      return [...FIXTURE_TENANTS];
    }
    return merged;
  }, [tenantsQ.data, tenantsQ.isLoading, tenantsQ.isError, sessionTenants]);
  const tenants = mergedTenants;

  const activeTenantId = session?.activeWorkspace.tenantId ?? null;
  const activeTenantName = session?.activeWorkspace.tenantName ?? null;

  const [tenantId, setTenantId] = useState<string>(startup?.tenant_id ?? "");

  const tenantMatchesActive =
    !!activeTenantId && !!tenantId && activeTenantId === tenantId;
  const selectedTenantName =
    mergedTenants.find((t) => t.id === tenantId)?.tenantName ?? null;

  useEffect(() => {
    if (isEdit) return;
    if (tenantId) return;
    if (!tenants.length) return;
    if (WORKSPACE_ENFORCEMENT_ENABLED) {
      // Preselect active only if it's in the authorized list. Never silently
      // pick tenants[0] under the flag.
      if (activeTenantId && tenants.some((t) => t.id === activeTenantId)) {
        setTenantId(activeTenantId);
      }
    } else {
      setTenantId(activeTenantId ?? tenants[0].id);
    }
  }, [tenants, tenantId, activeTenantId, isEdit]);

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
  const [visibility, setVisibility] = useState<string>(startup?.visibility ?? (isMyStartupsCreate ? "Private" : "Tenant"));

  // Investor Relationships (V3) — staged in local UI state until Save.
  //
  // The legacy `investorIds` submit path is preserved ONLY so today's
  // linked-investor behavior does not regress. It does NOT persist
  // Acquisition markers, pending rows, or duplicate-review state — those
  // stay in `investorLinks` and are passed to
  // `adapter.saveStartupInvestorRelationships(...)` (currently a stub;
  // future SnackPortal2 API Gateway).
  const [investorLinks, setInvestorLinks] = useState<StartupInvestorLinkView[]>(
    startup?.investors.map((i): StartupInvestorLinkView => ({
      id: i.investor_id,
      investorId: i.investor_id,
      investorName: i.investor_name,
      investorType: null,
      country: null,
      relationshipType: "investment",
      status: "linked",
    })) ?? [],
  );
  const investorIds = useMemo(
    () => investorLinks.filter((l) => l.status === "linked" && l.investorId).map((l) => l.investorId!),
    [investorLinks],
  );
  const pendingInvestorCount = useMemo(
    () => investorLinks.filter((l) => l.status === "pending").length,
    [investorLinks],
  );

  // "Create investor" inline promotion dialog — replaces the pending row
  // with a linked row carrying the newly-persisted investor id.
  const [createInvestorRowId, setCreateInvestorRowId] = useState<string | null>(null);
  const [createInvestorName, setCreateInvestorName] = useState("");
  const [pendingSaveOpen, setPendingSaveOpen] = useState(false);

  // Defaults for the create-investor dialog: reuse the startup's own
  // ownership so the new investor lands with matching agents. StartupDetail
  // carries these as pass-through rows typed at query time.
  const startupOwn = startup as unknown as {
    startup_ownership?: Array<{ owning_agent_user_id: string }>;
    startup_ai_ownership?: Array<{ owning_ai_agent_id: string }>;
  } | undefined;
  const startupAgentDefault = startupOwn?.startup_ownership?.[0]?.owning_agent_user_id ?? null;
  const startupAiAgentDefault = startupOwn?.startup_ai_ownership?.[0]?.owning_ai_agent_id ?? null;

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

  // Under the flag, tenant-dependent queries fire only when selected tenant
  // equals the active workspace. Options are hidden when mismatched.
  const ownershipEnabled =
    enabled && !!tenantId && !isEdit && (!WORKSPACE_ENFORCEMENT_ENABLED || tenantMatchesActive);
  const humansQ = useQuery({
    queryKey: ["assignable-humans", tenantId],
    queryFn: () => fetchUsers({ data: { tenantId, userType: "Human" } }),
    enabled: ownershipEnabled,
  });
  const aisQ = useQuery({
    queryKey: ["assignable-ai", tenantId],
    queryFn: () => fetchUsers({ data: { tenantId, userType: "AI" } }),
    enabled: ownershipEnabled,
  });
  const baseHumanOptions =
    !WORKSPACE_ENFORCEMENT_ENABLED || tenantMatchesActive ? (humansQ.data ?? []) : [];
  const currentHumanOption = principalRef
    ? {
        id: principalRef,
        email: session?.user?.email ?? "Current user",
        first_name: session?.user?.firstName ?? null,
        last_name: session?.user?.lastName ?? null,
      }
    : null;
  const humanOptions =
    isMyStartupsCreate && currentHumanOption && !baseHumanOptions.some((u) => u.id === principalRef)
      ? [currentHumanOption, ...baseHumanOptions]
      : baseHumanOptions;
  const aiOptions =
    !WORKSPACE_ENFORCEMENT_ENABLED || tenantMatchesActive ? (aisQ.data ?? []) : [];
  const noAi = !aisQ.isLoading && aiOptions.length === 0;

  // Clear ownership when tenant changes or active-match is lost — create
  // mode only, flag ON only. Edit mode preserved.
  useEffect(() => {
    if (isEdit) return;
    if (!WORKSPACE_ENFORCEMENT_ENABLED) return;
    setOwningAgent("");
    setOwningAi("");
  }, [isEdit, tenantId, tenantMatchesActive]);

  // My Startups flow: force the human Owning Agent to the current user so the
  // created startup immediately remains visible in /my-startups. This does not
  // rely on created_by and does not change backend ownership/RLS contracts.
  useEffect(() => {
    if (!isMyStartupsCreate || !principalRef) return;
    if (owningAgentUserId !== principalRef) setOwningAgent(principalRef);
  }, [isMyStartupsCreate, principalRef, owningAgentUserId]);


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
    mutationFn: async (vars: { selectedTenantId: string; activeTenantId: string | null }) => {
      // Defensive re-check under the flag using EXPLICIT ids captured at
      // submit time (positive-match rule; missing active = mismatch).
      if (WORKSPACE_ENFORCEMENT_ENABLED) {
        if (
          !vars.activeTenantId ||
          !vars.selectedTenantId ||
          vars.activeTenantId !== vars.selectedTenantId
        ) {
          throw new Error(
            "Selected tenant is not the active workspace. Switch workspace to continue.",
          );
        }
      }
      const res = await create({
        data: {
          tenantId: vars.selectedTenantId,
          startupName,
          websiteUrl: websiteUrl || null,
          city: city || null,
          industry: industryArray,
          shortDescription: shortDescription || null,
          longDescription: longDescription || null,
          status: status as never,
          visibility: visibility as never,
          owningAgentUserId: isMyStartupsCreate && principalRef ? principalRef : owningAgentUserId,
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
      // Stub adapter save — future SnackPortal2 API Gateway. UI-staged only.
      void investorStartupLinksAdapter.saveStartupInvestorRelationships(res.id, investorLinks);
      toast.success("Startup created");
      qc.invalidateQueries({ queryKey: ["startups"] });
      guard.markSaved();
      if (redirectAfterCreate === "my-startups") {
        navigate({ to: "/my-startups", search: { panel: res.id } });
      } else {
        navigate({ to: "/startups/$id", params: { id: res.id } });
      }

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
    onSuccess: async () => {
      // Stub adapter save — future SnackPortal2 API Gateway. UI-staged only.
      void investorStartupLinksAdapter.saveStartupInvestorRelationships(startup!.id, investorLinks);
      toast.success("Saved");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["startup", startup!.id] }),
        qc.invalidateQueries({ queryKey: ["startups"] }),
      ]);
      guard.markSaved();
      if (isMyWorkspace) {
        navigate({
          to: "/my-startups",
          search: { ...myStartupsReturnSearch, panel: startup!.id },
        });
      } else {
        // Return to the Startup Directory with the information panel reopened,
        // so the cards stay visible behind the same panel UX.
        navigate({
          to: "/startups",
          search: { ...directoryReturnSearch, panel: startup!.id },
        });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = useMemo(() => {
    if (!startupName) return false;
    if (isEdit) return true;
    const matchOk = !WORKSPACE_ENFORCEMENT_ENABLED || tenantMatchesActive;
    return !!(tenantId && owningAgentUserId && owningAiAgentId && matchOk);
  }, [isEdit, startupName, tenantId, owningAgentUserId, owningAiAgentId, tenantMatchesActive]);

  const submitting = createM.isPending || updateM.isPending;

  // ── Unsaved Changes: snapshot-diff dirty detection ──
  const currentSnapshot = buildStartupFormSnapshot({
    isEdit,
    tenantId, startupName, companyType, yearFounded, email, headquarters,
    region, city, websiteUrl, linkedinUrl, shortDescription, longDescription,
    industries, productTags, marketTags, investmentStage,
    status, visibility, investorIds, founders,
    owningAgentUserId, owningAiAgentId, media,
  });
  const [initialSnapshot, setInitialSnapshot] = useState("");
  useEffect(() => {
    // Capture baseline once on mount, and re-capture when a loaded startup
    // (edit mode) first hydrates the state.
    setInitialSnapshot(currentSnapshot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startup?.id]);
  const isDirty = initialSnapshot !== "" && currentSnapshot !== initialSnapshot;

  const performSave = () => {
    if (isEdit) updateM.mutate();
    else createM.mutate({ selectedTenantId: tenantId, activeTenantId });
  };

  const submitForm = () => {
    if (!canSubmit || submitting) return;
    // Pending investor rows never persist — block save so the user can
    // either create real records or remove them, rather than losing them
    // silently after the toast.
    if (pendingInvestorCount > 0) {
      setPendingSaveOpen(true);
      return;
    }
    performSave();
  };

  const guard = useUnsavedChangesGuard({
    isDirty,
    isSaving: submitting,
    onSave: submitForm,
    canSave: canSubmit,
  });

  // Missing-field highlights (edit mode only). Derived from current state so
  // they clear automatically as the user types. Matches the existing
  // "⚠ Missing: Headquarters" placeholder pattern, extended uniformly.
  const isStrEmpty = (s: string | null | undefined) => !s || !s.trim();
  const miss = (empty: boolean) => isEdit && empty;
  const MISSING_INPUT =
    "border-destructive focus-visible:ring-destructive placeholder:text-destructive/70";
  const MISSING_LABEL = "text-destructive";
  const missingPh = (field: string) => `⚠ Missing: ${field}`;

  /**
   * Empty-field-only merge of an Auto Enrich result. Never overwrites
   * a populated field — preserves all user input. Returns what was applied
   * vs skipped so the UI can explain "nothing happened" cases.
   */
  function applyEnrichment(r: EnrichStartupResult): { applied: string[]; skippedBecauseFilled: string[] } {
    const applied: string[] = [];
    const skipped: string[] = [];
    const isEmpty = (s: string | null | undefined) => !s || !s.trim();
    const handle = (label: string, hasValue: boolean, targetEmpty: boolean, apply: () => void) => {
      if (!hasValue) return;
      if (targetEmpty) { apply(); applied.push(label); }
      else { skipped.push(label); }
    };
    handle("Company Name", !!r.startupName, isEmpty(startupName), () => setStartupName(r.startupName!));
    handle("Company Type", !!r.companyType, isEmpty(companyType), () => setCompanyType(r.companyType!));
    handle("Year Founded", !!r.yearFounded, isEmpty(yearFounded), () => setYearFounded(String(r.yearFounded)));
    handle("Email", !!r.email, isEmpty(email), () => setEmail(r.email!));
    handle("Headquarters", !!r.headquarters, isEmpty(headquarters), () => {
      setHeadquarters(r.headquarters!);
      if (isEmpty(region)) {
        const suggested = regionForCountry(r.headquarters!);
        if (suggested) setRegion(suggested);
      }
    });
    handle("City", !!r.city, isEmpty(city), () => setCity(r.city!));
    handle("LinkedIn URL", !!r.linkedinUrl, isEmpty(linkedinUrl), () => setLinkedinUrl(r.linkedinUrl!));
    handle("Short Description", !!r.shortDescription, isEmpty(shortDescription), () => setShortDescription(r.shortDescription!));
    handle("Long Description", !!r.longDescription, isEmpty(longDescription), () => setLongDescription(r.longDescription!));
    handle("Investment Stage", !!r.investmentStage, isEmpty(investmentStage), () => setInvestmentStage(r.investmentStage!));
    handle("Industries", !!r.industries?.length, industries.length === 0, () => setIndustries(r.industries!.slice(0, 5)));
    handle("Product Tags", !!r.productTags?.length, productTags.length === 0, () => setProductTags(r.productTags!.slice(0, 5)));
    handle("Market Tags", !!r.marketTags?.length, marketTags.length === 0, () => setMarketTags(r.marketTags!.slice(0, 5)));
    handle("Founders", !!r.founders?.length, founders.length === 0, () => {
      setFounders(
        r.founders!.slice(0, 10).map((f) => ({
          full_name: f.full_name ?? "",
          position: f.position ?? "",
          linkedin_url: f.linkedin_url ?? "",
          bio: f.bio ?? "",
        })),
      );
    });
    return { applied, skippedBecauseFilled: skipped };
  }

  const ADVANCE_INPUT_TYPES = ["text", "email", "url", "tel", "password", "search", "number", "date", "datetime-local", "month", "time", "week"];

  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== "Enter" || e.defaultPrevented || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement;
    if (!(target instanceof HTMLInputElement)) return;
    if (!ADVANCE_INPUT_TYPES.includes(target.type)) return;
    // Prevent implicit form submission.
    e.preventDefault();

    const form = e.currentTarget;
    const selector = [
      "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset])",
      "select",
      "textarea",
      "button",
      "[tabindex]",
    ].join(",");
    const isEligible = (el: Element): el is HTMLElement => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.hasAttribute("disabled")) return false;
      if ((el as HTMLInputElement).readOnly) return false;
      if (el.getAttribute("aria-hidden") === "true") return false;
      if (el.tabIndex < 0) return false;
      if (el.offsetParent === null && el.getClientRects().length === 0) return false;
      return true;
    };
    const focusables = Array.from(form.querySelectorAll<HTMLElement>(selector)).filter(isEligible);
    const idx = focusables.indexOf(target);
    if (idx === -1) return;
    const next = focusables[idx + 1];
    if (!next) return; // last field: do nothing (no submit, no wrap)
    next.focus();
    if (next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement) {
      try { next.select?.(); } catch { /* no-op */ }
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (isEdit) {
          updateM.mutate();
        } else {
          createM.mutate({ selectedTenantId: tenantId, activeTenantId });
        }
      }}
      onKeyDown={handleFormKeyDown}
      className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-card text-sm"
    >
      {/* Tenant (create only) */}
      {!isEdit && (
        <div className="space-y-1.5">
          <Label>Tenant <span className="text-destructive">*</span></Label>
          <Select value={tenantId} onValueChange={setTenantId}>
            <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
            <SelectContent>
              {tenants.map((t) => {
                const fx = isFixtureTenant(t.id);
                return (
                  <SelectItem key={t.id} value={t.id}>
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
          {WORKSPACE_ENFORCEMENT_ENABLED && tenantId && !tenantMatchesActive && (
            <WorkspaceConflictNotice
              recordWorkspaceName={selectedTenantName}
              activeWorkspaceName={activeTenantName}
              switching={switchPending}
              switchDisabled={isFixtureTenant(tenantId)}
              switchDisabledReason={
                isFixtureTenant(tenantId)
                  ? "Preview fixture — activation disabled (no backend call)."
                  : undefined
              }
              error={switchError}
              onSwitch={async () => {
                setSwitchError(null);
                setSwitchPending(true);
                try {
                  await doSwitch({ data: { tenantId, workspaceType: "TENANT" } });
                  await qc.invalidateQueries({ queryKey: ["session-context"] });
                  await qc.invalidateQueries({ queryKey: ["assignable-tenants", principalRef] });
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

      {/* Logo + Media + Auto Enrich (right-aligned, same row) */}
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <EntityMediaEditor
            value={media}
            onChange={setMedia}
            screenshot={{ websiteUrl }}
          />
        </div>
        <div className="pt-6 shrink-0">
          <AutoEnrichButton
            websiteUrl={websiteUrl}
            disabled={submitting}
            onEnriched={(r) => {
              const { applied, skippedBecauseFilled } = applyEnrichment(r);
              const fieldsReturned = Object.entries(r).filter(([k, v]) => {
                if (k === "_debug" || v == null) return false;
                if (Array.isArray(v)) return v.length > 0;
                if (typeof v === "string") return v.trim().length > 0;
                return true;
              }).length;
              if (fieldsReturned > 0 && applied.length === 0) {
                const preview = skippedBecauseFilled.slice(0, 5).join(", ");
                toast.info(
                  `Auto Enrich returned data but all target fields were already filled` +
                    (preview ? ` (skipped: ${preview}${skippedBecauseFilled.length > 5 ? "…" : ""})` : "") +
                    `. Clear a field and try again to overwrite.`,
                );
              }
            }}
          />
        </div>
      </div>

      {/* Row 1: Year Founded | Company Name | Company Type — PitchSnack1 [120px_1fr_160px] */}
      <div className="grid grid-cols-[120px_1fr_160px] gap-4">
        <div className="space-y-1.5">
          <Label className={miss(isStrEmpty(yearFounded)) ? MISSING_LABEL : undefined}>Year Founded</Label>
          <Input type="number" min={1800} max={new Date().getFullYear()}
            value={yearFounded} onChange={(e) => setYearFounded(e.target.value)}
            placeholder={miss(isStrEmpty(yearFounded)) ? missingPh("Year Founded") : "e.g. 2020"}
            className={miss(isStrEmpty(yearFounded)) ? MISSING_INPUT : undefined} />
        </div>
        <div className="space-y-1.5">
          <Label className={miss(isStrEmpty(startupName)) ? MISSING_LABEL : undefined}>Company Name <span className="text-destructive">*</span></Label>
          <Input value={startupName} onChange={(e) => setStartupName(e.target.value)}
            placeholder={miss(isStrEmpty(startupName)) ? missingPh("Company Name") : "Acme Inc."}
            className={miss(isStrEmpty(startupName)) ? MISSING_INPUT : undefined}
            required maxLength={255} />
        </div>
        <div className="space-y-1.5">
          <Label className={miss(isStrEmpty(companyType)) ? MISSING_LABEL : undefined}>Company Type</Label>
          <Select value={companyType || "none"} onValueChange={(v) => setCompanyType(v === "none" ? "" : v)}>
            <SelectTrigger className={miss(isStrEmpty(companyType)) ? MISSING_INPUT : undefined}>
              <SelectValue placeholder={miss(isStrEmpty(companyType)) ? missingPh("Type") : "Type"} />
            </SelectTrigger>
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
          <Label className={miss(isStrEmpty(investmentStage)) ? MISSING_LABEL : undefined}>Investment Stage</Label>
          <Select value={investmentStage || "none"} onValueChange={(v) => setInvestmentStage(v === "none" ? "" : v)}>
            <SelectTrigger className={miss(isStrEmpty(investmentStage)) ? MISSING_INPUT : undefined}>
              <SelectValue placeholder={miss(isStrEmpty(investmentStage)) ? missingPh("Investment Stage") : "Stage"} />
            </SelectTrigger>
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
            <Label className={miss(isStrEmpty(headquarters)) ? MISSING_LABEL : undefined}>Headquarters</Label>
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
            placeholder={miss(isStrEmpty(headquarters)) ? missingPh("Headquarters") : "Select country..."}
            className={miss(isStrEmpty(headquarters)) ? MISSING_INPUT : undefined}
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
            <Label className={miss(isStrEmpty(city)) ? MISSING_LABEL : undefined}>City</Label>
          </div>
          <Input value={city} onChange={(e) => setCity(e.target.value)}
            placeholder={miss(isStrEmpty(city)) ? missingPh("City") : "City"}
            className={miss(isStrEmpty(city)) ? MISSING_INPUT : undefined} />
        </div>
      </div>

      {/* Row 3: Email | Website | LinkedIn URL */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label className={miss(isStrEmpty(email)) ? MISSING_LABEL : undefined}>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255}
            placeholder={miss(isStrEmpty(email)) ? missingPh("Email") : undefined}
            className={miss(isStrEmpty(email)) ? MISSING_INPUT : undefined} />
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
          placeholder={miss(isStrEmpty(linkedinUrl)) ? missingPh("LinkedIn URL") : "https://www.linkedin.com/company/…"}
        />

      </div>


      {/* Descriptions */}
      <div className="space-y-1.5">
        <Label className={miss(isStrEmpty(shortDescription)) ? MISSING_LABEL : undefined}>Short Description</Label>
        <Textarea rows={2} maxLength={500} value={shortDescription} onChange={(e) => setShortDescription(e.target.value)}
          placeholder={miss(isStrEmpty(shortDescription)) ? missingPh("Short Description") : undefined}
          className={miss(isStrEmpty(shortDescription)) ? MISSING_INPUT : undefined} />
      </div>
      <div className="space-y-1.5">
        <Label className={miss(isStrEmpty(longDescription)) ? MISSING_LABEL : undefined}>Long Description</Label>
        <Textarea rows={4} maxLength={5000} value={longDescription} onChange={(e) => setLongDescription(e.target.value)}
          placeholder={miss(isStrEmpty(longDescription)) ? missingPh("Long Description") : undefined}
          className={miss(isStrEmpty(longDescription)) ? MISSING_INPUT : undefined} />
      </div>

      {/* Industry pills */}
      <div className="space-y-1.5">
        <Label className={miss(industries.length === 0) ? MISSING_LABEL : undefined}>Industry</Label>
        {miss(industries.length === 0) && (
          <p className="text-xs text-destructive">⚠ Missing: pick at least one industry</p>
        )}
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
        <Label className={miss(productTags.length === 0) ? MISSING_LABEL : undefined}>Product & Service Tags ({productTags.length}/5)</Label>
        {miss(productTags.length === 0) && (
          <p className="text-xs text-destructive">⚠ Missing: add at least one product tag</p>
        )}
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
        <Label className={miss(marketTags.length === 0) ? MISSING_LABEL : undefined}>Market Tags ({marketTags.length}/5)</Label>
        {miss(marketTags.length === 0) && (
          <p className="text-xs text-destructive">⚠ Missing: add at least one market tag</p>
        )}
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
      {miss(founders.filter((f) => f.full_name.trim()).length === 0) && (
        <p className="text-xs text-destructive">⚠ Missing: add at least one founder</p>
      )}
      <FounderEditor value={founders} onChange={setFounders} tenantId={tenantId} startupId={startup?.id} />


      {/* Investor Relationships (V3) — replaces the legacy InvestorPicker */}
      <RelationshipLinksEditor
        mode="investors"
        title="Investor Relationships"
        rows={investorLinks.map((l): RelationshipRow => ({
          id: l.id,
          refId: l.investorId,
          name: l.investorName,
          subtitle: l.investorType,
          industry: null,
          relationshipType: l.relationshipType,
          status: l.status,
        }))}
        onChange={(next) =>
          setInvestorLinks(
            next.map((r): StartupInvestorLinkView => ({
              id: r.id,
              investorId: r.refId,
              investorName: r.name,
              investorType: r.subtitle,
              country: null,
              relationshipType: r.relationshipType,
              status: r.status,
            })),
          )
        }
        onPromotePending={(row) => {
          setCreateInvestorRowId(row.id);
          setCreateInvestorName(row.name);
        }}
        promoteLabel="Create investor"
      />

      {tenantId && (
        <CreateInvestorDialog
          open={createInvestorRowId !== null}
          onOpenChange={(o) => {
            if (!o) setCreateInvestorRowId(null);
          }}
          tenantId={tenantId}
          initialName={createInvestorName}
          defaultAgentUserId={startupAgentDefault ?? owningAgentUserId ?? null}
          defaultAiAgentId={startupAiAgentDefault ?? owningAiAgentId ?? null}
          onCreated={({ id, name }) => {
            setInvestorLinks((prev) =>
              prev.map((l) =>
                l.id === createInvestorRowId
                  ? {
                      ...l,
                      id,
                      investorId: id,
                      investorName: name,
                      status: "linked",
                    }
                  : l,
              ),
            );
            setCreateInvestorRowId(null);
          }}
        />
      )}

      <AlertDialog open={pendingSaveOpen} onOpenChange={setPendingSaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingInvestorCount} pending investor
              {pendingInvestorCount === 1 ? "" : "s"} won't be saved
            </AlertDialogTitle>
            <AlertDialogDescription>
              Pending investors are typed names, not real records. Use
              "Create investor" on each pending row to persist it, or remove
              them and save. Removing pending rows only clears them from this
              form — no existing investors are affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back to edit</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setInvestorLinks((prev) => prev.filter((l) => l.status !== "pending"));
                setPendingSaveOpen(false);
                // Defer save one tick so the state update applies first.
                setTimeout(performSave, 0);
              }}
            >
              Remove pending and save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


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
          <DefaultIntakeOwnershipModeSection
            domain="startup"
            className="mb-4"
            helperText={
              isMyStartupsCreate
                ? "My Startups keeps you as the Owning Agent so this private profile remains visible in My Startups."
                : "This Startup will be assigned temporarily to the Startup Intake team and added to the Default Intake Queue."
            }
          />
          <h3 className="text-sm font-semibold">Ownership (required)</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Every startup must have one human Owning Agent and one Owning AI Agent.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Owning Agent <span className="text-destructive">*</span></Label>
              <Select value={owningAgentUserId} onValueChange={setOwningAgent} disabled={isMyStartupsCreate || !tenantId || (WORKSPACE_ENFORCEMENT_ENABLED && !tenantMatchesActive)}>
                <SelectTrigger>
                  <SelectValue placeholder={humansQ.isLoading ? "Loading…" : "Select an agent"} />
                </SelectTrigger>
                <SelectContent>
                  {humanOptions.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isMyStartupsCreate && (
                <p className="text-xs text-muted-foreground">
                  Locked to your account for My Startups visibility.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Owning AI Agent <span className="text-destructive">*</span></Label>
              <Select value={owningAiAgentId} onValueChange={setOwningAi} disabled={!tenantId || noAi || (WORKSPACE_ENFORCEMENT_ENABLED && !tenantMatchesActive)}>
                <SelectTrigger>
                  <SelectValue placeholder={aisQ.isLoading ? "Loading…" : noAi ? "No AI users in this tenant" : "Select an AI agent"} />
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
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            guard.confirmNavigate(() =>
              isMyWorkspace
                ? navigate({
                    to: "/my-startups",
                    search: { ...myStartupsReturnSearch, panel: startup?.id },
                  })
                : navigate({
                    to: "/startups",
                    search: { ...directoryReturnSearch, panel: startup?.id },
                  }),
            )
          }

        >
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
      <UnsavedChangesDialog {...guard.dialogProps} />
    </form>
  );
}
