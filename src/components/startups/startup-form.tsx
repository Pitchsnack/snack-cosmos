import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Image as ImageIcon, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  createStartup,
  updateStartup,
  type StartupDetail,
} from "@/lib/startups.functions";
import { listAssignableUsers } from "@/lib/startup-ownership.functions";
import { listAssignableTenants } from "@/lib/tenants.functions";
import { useSessionContext } from "@/hooks/use-session-context";
import { useHasSession } from "@/hooks/use-has-session";
import { FounderEditor, type FounderDraft } from "./founder-editor";
import { InvestorPicker } from "./investor-picker";

// ── Taxonomies (mirrored from PitchSnack1 AdminStartupManager) ──
const COMPANY_TYPES = ["SME", "Startup", "Corporate Enterprise"];
const STAGES = [
  "Pre-Seed", "Seed", "Series A", "Series B", "Series C+",
  "Growth", "IPO", "Inactive", "Acquired",
];
const INDUSTRIES = [
  "FinTech", "eCommerce & Marketplace", "MarTech", "HealthTech",
  "Sustainability", "Mobility & Logistics", "DeepTech", "Defense",
  "EdTech", "Gaming", "PropTech", "AgriTech", "FMCG", "Others",
];
const STATUSES = ["Draft","Active","Fundraising","Due Diligence","Portfolio","Exited","Inactive","Archived"];
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

// ── Logo upload zone (PitchSnack1 visual replica, local-only) ──
function LogoUploadZone({
  file, onChange,
}: { file: File | null; onChange: (f: File | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  return (
    <div className="space-y-1.5">
      <Label>Logo</Label>
      <div
        className={`flex items-center gap-4 rounded-lg p-2 -m-2 transition-colors ${
          dragging ? "bg-accent/50 ring-2 ring-primary/30" : ""
        }`}
        onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault(); setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f && f.type.startsWith("image/")) onChange(f);
        }}
      >
        {preview ? (
          <div className="relative group cursor-pointer" onClick={() => ref.current?.click()}>
            <img
              src={preview}
              alt="Logo"
              className="w-[168px] h-[56px] rounded-lg object-contain border border-border group-hover:opacity-60 transition-opacity"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Upload className="h-4 w-4 text-muted-foreground" />
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div
            className={`relative w-[168px] h-[56px] rounded-lg border border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${
              dragging ? "bg-accent border-primary/40" : "bg-muted border-border hover:bg-accent/40 hover:border-primary/30"
            }`}
            onClick={() => ref.current?.click()}
          >
            <Upload className={`h-4 w-4 ${dragging ? "text-primary" : "text-muted-foreground"}`} />
            <span className="text-[10px] text-muted-foreground mt-0.5">Drop or click</span>
          </div>
        )}
        <input
          ref={ref}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onChange(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

// ── Media panel: 3 product image slots (PitchSnack1 visual replica) ──
function MediaPanel({
  files, onChange, maxImages = 3,
}: { files: (File | null)[]; onChange: (next: (File | null)[]) => void; maxImages?: number }) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const [dragSlot, setDragSlot] = useState<number | null>(null);
  const previews = useMemo(
    () => files.map((f) => (f ? URL.createObjectURL(f) : null)),
    [files],
  );
  useEffect(() => () => { previews.forEach((u) => { if (u) URL.revokeObjectURL(u); }); }, [previews]);

  const setSlot = (i: number, f: File | null) => {
    const next = [...files];
    next[i] = f;
    onChange(next);
  };

  const filled = files.filter(Boolean).length;

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
        Media
        <span className="text-[10px] text-muted-foreground font-normal">({filled}/{maxImages})</span>
      </Label>
      <div className="flex items-center gap-2">
        {Array.from({ length: maxImages }).map((_, i) => {
          const p = previews[i];
          return (
            <div key={i} className="relative">
              {p ? (
                <div className="group relative">
                  <img
                    src={p}
                    alt={`Product ${i + 1}`}
                    className="w-[96px] h-[64px] rounded-md object-cover border border-border"
                  />
                  <div className="absolute inset-0 rounded-md bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => inputs.current[i]?.click()}
                      className="p-1 rounded-full bg-background/80 hover:bg-background text-foreground"
                      title="Replace"
                    >
                      <Upload className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSlot(i, null)}
                      className="p-1 rounded-full bg-background/80 hover:bg-background text-destructive"
                      title="Remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={`flex flex-col items-center justify-center rounded-md border border-dashed cursor-pointer transition-colors ${
                    dragSlot === i
                      ? "bg-accent border-primary/40"
                      : "bg-muted border-border hover:bg-accent/40 hover:border-primary/30"
                  }`}
                  style={{ width: 96, height: 64 }}
                  onClick={() => inputs.current[i]?.click()}
                  onDragEnter={(e) => { e.preventDefault(); setDragSlot(i); }}
                  onDragLeave={(e) => { e.preventDefault(); setDragSlot(null); }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault(); setDragSlot(null);
                    const f = e.dataTransfer.files?.[0];
                    if (f && f.type.startsWith("image/")) setSlot(i, f);
                  }}
                >
                  <Upload className={`h-4 w-4 ${dragSlot === i ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-[10px] text-muted-foreground mt-0.5">Slot {i + 1}</span>
                </div>
              )}
              <input
                ref={(el) => { inputs.current[i] = el; }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setSlot(i, f);
                  e.target.value = "";
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface Props {
  /** When provided, the form is in edit mode. */
  startup?: StartupDetail;
}

export function StartupForm({ startup }: Props) {
  const isEdit = !!startup;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: session } = useSessionContext();
  const create = useServerFn(createStartup);
  const update = useServerFn(updateStartup);
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
  const [websiteUrl, setWebsiteUrl] = useState(startup?.website_url ?? "");
  const [legalName, setLegalName] = useState(startup?.legal_name ?? "");
  const [country, setCountry] = useState(startup?.country ?? "");

  // Company information
  const [shortDescription, setShortDescription] = useState(startup?.short_description ?? "");
  const [longDescription, setLongDescription] = useState(startup?.long_description ?? "");

  // Tags & classification
  const [productTags, setProductTags] = useState<string[]>(startup?.product_tags ?? []);
  const [productTagDraft, setProductTagDraft] = useState("");
  const [marketTags, setMarketTags] = useState<string[]>(startup?.market_tags ?? []);
  const [marketTagDraft, setMarketTagDraft] = useState("");
  // Industry: stored as a single string in DB; UI multi-select joined by ", "
  const initialIndustries = (startup?.industry ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
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

  // Logo + Media (visual replica — local-only, no backend wiring yet)
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [mediaFiles, setMediaFiles] = useState<(File | null)[]>([null, null, null]);

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

  const buildProfile = () => ({
    logoPath: null,
    companyType: companyType || null,
    yearFounded: yearFounded ? Number(yearFounded) : null,
    email: email || null,
    headquarters: headquarters || null,
    investmentStage: (investmentStage as typeof STAGES[number]) || null,
    productTags,
    marketTags,
    investorIds,
    founders: founders.filter((f) => f.full_name.trim()),
    media: [] as { slot: 1 | 2 | 3; image_path: string }[],
  });

  const industryJoined = industries.join(", ") || null;

  const createM = useMutation({
    mutationFn: () =>
      create({
        data: {
          tenantId,
          startupName,
          legalName: legalName || null,
          websiteUrl: websiteUrl || null,
          country: country || null,
          industry: industryJoined,
          shortDescription: shortDescription || null,
          longDescription: longDescription || null,
          status: status as never,
          visibility: visibility as never,
          owningAgentUserId,
          owningAiAgentId,
          ...buildProfile(),
        },
      }),
    onSuccess: (res) => {
      toast.success("Startup created");
      qc.invalidateQueries({ queryKey: ["startups"] });
      navigate({ to: "/startups/$id", params: { id: (res as { id: string }).id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateM = useMutation({
    mutationFn: () =>
      update({
        data: {
          id: startup!.id,
          startupName,
          legalName: legalName || null,
          websiteUrl: websiteUrl || null,
          country: country || null,
          industry: industryJoined,
          shortDescription: shortDescription || null,
          longDescription: longDescription || null,
          ...buildProfile(),
        },
      }),
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

      {/* Logo + Media (PitchSnack1 replica, visual only) */}
      <div className="flex items-start gap-10 flex-wrap">
        <LogoUploadZone file={logoFile} onChange={setLogoFile} />
        <MediaPanel files={mediaFiles} onChange={setMediaFiles} maxImages={3} />
      </div>

      {/* Row 1: Year Founded | Company Name | Company Type — PitchSnack1 [120px_1fr_160px] */}
      <div className="grid grid-cols-[120px_1fr_160px] gap-4">
        <div className="space-y-1.5">
          <Label>Year Founded</Label>
          <Input
            type="number"
            min={1900}
            max={new Date().getFullYear()}
            value={yearFounded}
            onChange={(e) => setYearFounded(e.target.value)}
            placeholder="e.g. 2023"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Company Name <span className="text-destructive">*</span></Label>
          <Input
            value={startupName}
            onChange={(e) => setStartupName(e.target.value)}
            placeholder="e.g. Acme Corp"
            maxLength={100}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Company Type</Label>
          <Select value={companyType} onValueChange={setCompanyType}>
            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              {COMPANY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 2: Email | Headquarters | Company URL */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Email Address</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contact@company.com"
            maxLength={255}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Headquarters</Label>
          <Input
            value={headquarters}
            onChange={(e) => setHeadquarters(e.target.value)}
            placeholder="Country"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Company URL</Label>
          <Input
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://example.com"
          />
        </div>
      </div>

      {/* Row 3: Legal Name | Country (extras kept from existing schema) */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Legal Name</Label>
          <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Country</Label>
          <Input value={country} onChange={(e) => setCountry(e.target.value)} />
        </div>
      </div>

      {/* Short Description */}
      <div className="space-y-1.5">
        <Label>Short Description (2-liner)</Label>
        <Textarea
          value={shortDescription}
          onChange={(e) => setShortDescription(e.target.value)}
          placeholder="One-line description"
          maxLength={300}
          rows={2}
        />
      </div>

      {/* Product Overview */}
      <div className="space-y-1.5">
        <Label>Product Overview</Label>
        <Textarea
          value={longDescription}
          onChange={(e) => setLongDescription(e.target.value)}
          placeholder="Describe the product"
          maxLength={2000}
          rows={3}
        />
      </div>

      {/* Product & Service Tags */}
      <div className="space-y-1.5">
        <Label>Product &amp; Service Tags (Up to 5)</Label>
        <div className="flex flex-wrap gap-2">
          {productTags.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setProductTags(productTags.filter((x) => x !== k))}
              className="px-3 py-1 rounded-full text-xs border bg-primary text-primary-foreground border-primary inline-flex items-center gap-1"
            >
              {k} <X className="h-3 w-3" />
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={productTagDraft}
            onChange={(e) => setProductTagDraft(e.target.value)}
            placeholder="Example: LinkedIn — Networking, Recruiting, Advertising, Freemium, Database"
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") { e.preventDefault(); addProductTag(); }
            }}
            disabled={productTags.length >= 5}
            maxLength={50}
          />
          <Button type="button" variant="outline" size="sm" onClick={addProductTag} disabled={productTags.length >= 5}>
            Add
          </Button>
        </div>
      </div>

      {/* Market Tag */}
      <div className="space-y-1.5">
        <Label>Market Tag (Up to 5)</Label>
        <div className="flex flex-wrap gap-2">
          {marketTags.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setMarketTags(marketTags.filter((x) => x !== k))}
              className="px-3 py-1 rounded-full text-xs border bg-primary text-primary-foreground border-primary inline-flex items-center gap-1"
            >
              {k} <X className="h-3 w-3" />
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={marketTagDraft}
            onChange={(e) => setMarketTagDraft(e.target.value)}
            placeholder="User, System, Species, Role, Vertical"
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") { e.preventDefault(); addMarketTag(); }
            }}
            disabled={marketTags.length >= 5}
            maxLength={50}
          />
          <Button type="button" variant="outline" size="sm" onClick={addMarketTag} disabled={marketTags.length >= 5}>
            Add
          </Button>
        </div>
      </div>

      {/* Industry (multi-pill) */}
      <div className="space-y-1.5">
        <Label>Industry</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {INDUSTRIES.map((ind) => (
            <Pill key={ind} active={industries.includes(ind)} onClick={() => setIndustries(toggle(industries, ind))}>
              {ind}
            </Pill>
          ))}
          {industries
            .filter((i) => !INDUSTRIES.includes(i))
            .map((custom) => (
              <button
                key={custom}
                type="button"
                onClick={() => setIndustries(industries.filter((x) => x !== custom))}
                className="px-3 py-1 rounded-full text-xs border bg-primary text-primary-foreground border-primary inline-flex items-center gap-1"
              >
                {custom} <X className="h-3 w-3" />
              </button>
            ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={customIndustry}
            onChange={(e) => setCustomIndustry(e.target.value)}
            placeholder="Add custom industry..."
            maxLength={50}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") { e.preventDefault(); addCustomIndustry(); }
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={addCustomIndustry}>
            Add
          </Button>
        </div>
      </div>

      {/* Investment Stage */}
      <div className="space-y-1.5">
        <Label>Investment Stage</Label>
        <Select value={investmentStage} onValueChange={setInvestmentStage}>
          <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
          <SelectContent>
            {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Investors */}
      <div className="space-y-1.5">
        <Label>Investors</Label>
        <InvestorPicker tenantId={tenantId} value={investorIds} onChange={setInvestorIds} />
      </div>

      {/* Founders */}
      <div className="space-y-1.5">
        <Label>Founding &amp; Leadership Team</Label>
        <FounderEditor value={founders} onChange={setFounders} />
      </div>

      {/* Status & Visibility (create only) */}
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

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate({ to: isEdit ? "/startups/$id" : "/startups", params: isEdit ? { id: startup!.id } : undefined as never })}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!canSubmit || submitting}
          className="bg-accent text-accent-foreground hover:bg-accent/90"
        >
          {submitting ? "Saving…" : isEdit ? "Save changes" : "Create startup"}
        </Button>
      </div>
    </form>
  );
}
