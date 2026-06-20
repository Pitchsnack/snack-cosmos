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
import { createInvestor } from "@/lib/investors.functions";
import { listAssignableUsers } from "@/lib/startup-ownership.functions";
import { useSessionContext } from "@/hooks/use-session-context";
import { useHasSession } from "@/hooks/use-has-session";

// ── Taxonomies (mirrored from PitchSnack1 AdminInvestorManager) ──
const INVESTOR_CLASSIFICATIONS = [
  "Angel",
  "Venture Capital",
  "Private Equity",
  "Corporate VC",
  "Family Office",
  "Corporate Enterprise",
  "Sovereign Fund",
  "Incubator/Accelerator",
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

// Pill button style — matches PitchSnack1 exactly
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

export function InvestorForm() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: session } = useSessionContext();
  const create = useServerFn(createInvestor);
  const fetchUsers = useServerFn(listAssignableUsers);
  const enabled = useHasSession();

  const tenants = useMemo(() => session?.tenants ?? [], [session]);
  const [tenantId, setTenantId] = useState<string>("");

  useEffect(() => {
    if (!tenantId && tenants.length) {
      setTenantId(session?.activeWorkspace.tenantId ?? tenants[0].tenantId);
    }
  }, [tenants, tenantId, session]);

  // Core fields
  const [displayName, setDisplayName] = useState("");
  const [firmName, setFirmName] = useState("");
  const [title, setTitle] = useState(""); // Investor Classification
  const [email, setEmail] = useState("");
  const [headquarters, setHeadquarters] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [yearFounded, setYearFounded] = useState<string>("");
  const [aum, setAum] = useState("");
  const [minTicket, setMinTicket] = useState("");
  const [maxTicket, setMaxTicket] = useState("");
  const [bio, setBio] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [businessModel, setBusinessModel] = useState<string[]>([]);
  const [preferredStages, setPreferredStages] = useState<string[]>([]);
  const [preferredIndustries, setPreferredIndustries] = useState<string[]>([]);
  const [customIndustry, setCustomIndustry] = useState("");
  const [investmentFocus, setInvestmentFocus] = useState<string[]>([]);
  const [focusDraft, setFocusDraft] = useState("");

  const [status, setStatus] = useState("Prospect");
  const [visibility, setVisibility] = useState("Tenant");
  const [owningAgentUserId, setOwningAgent] = useState("");
  const [owningAiAgentId, setOwningAi] = useState("");

  const humansQ = useQuery({
    queryKey: ["assignable-humans", tenantId],
    queryFn: () => fetchUsers({ data: { tenantId, userType: "Human" } }),
    enabled: enabled && !!tenantId,
  });
  const aisQ = useQuery({
    queryKey: ["assignable-ai", tenantId],
    queryFn: () => fetchUsers({ data: { tenantId, userType: "AI" } }),
    enabled: enabled && !!tenantId,
  });

  const toggle = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const addKeyword = () => {
    const t = keywordDraft.trim();
    if (!t || keywords.includes(t) || keywords.length >= 5) return;
    setKeywords([...keywords, t]);
    setKeywordDraft("");
  };

  const addFocus = () => {
    const t = focusDraft.trim();
    if (!t || investmentFocus.includes(t)) return;
    setInvestmentFocus([...investmentFocus, t]);
    setFocusDraft("");
  };

  const addCustomIndustry = () => {
    const t = customIndustry.trim();
    if (!t || preferredIndustries.includes(t)) return;
    setPreferredIndustries([...preferredIndustries, t]);
    setCustomIndustry("");
  };

  const m = useMutation({
    mutationFn: () =>
      create({
        data: {
          tenantId,
          investorName: displayName,
          firmName: firmName || null,
          email: email || null,
          businessAddress: businessAddress || null,
          yearFounded: yearFounded ? Number(yearFounded) : null,
          websiteUrl: companyUrl || null,
          country: headquarters || null,
          investorType: title || null,
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
          status: status as never,
          visibility: visibility as never,
          owningAgentUserId,
          owningAiAgentId,
        },
      }),
    onSuccess: (res) => {
      toast.success("Investor created");
      qc.invalidateQueries({ queryKey: ["investors"] });
      navigate({ to: "/investors/$id", params: { id: (res as { id: string }).id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = tenantId && displayName && owningAgentUserId && owningAiAgentId;
  const noAi = !aisQ.isLoading && (aisQ.data ?? []).length === 0;

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); m.mutate(); }}
      className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-card text-sm"
    >
      {/* Tenant */}
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

      {/* Row 1: Year Founded | Display Name | Investor Classification */}
      <div className="grid grid-cols-[100px_1fr_220px] gap-4">
        <div className="space-y-1.5">
          <Label>Year Founded</Label>
          <Input
            type="number"
            min={1900}
            max={2030}
            value={yearFounded}
            onChange={(e) => setYearFounded(e.target.value)}
            placeholder="e.g. 2020"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Display Name <span className="text-destructive">*</span></Label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Sequoia Capital"
            maxLength={100}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Investor Classification</Label>
          <Select value={title} onValueChange={setTitle}>
            <SelectTrigger><SelectValue placeholder="Select classification" /></SelectTrigger>
            <SelectContent>
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
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="investor@example.com"
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
            value={companyUrl}
            onChange={(e) => setCompanyUrl(e.target.value)}
            placeholder="https://example.com"
          />
        </div>
      </div>

      {/* Row 3: Firm Name | Business Address */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Firm Name</Label>
          <Input
            value={firmName}
            onChange={(e) => setFirmName(e.target.value)}
            placeholder="e.g. Sequoia Capital"
            maxLength={100}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Business Address</Label>
          <Input
            value={businessAddress}
            onChange={(e) => setBusinessAddress(e.target.value)}
            placeholder="123 Main St, City, Country"
            maxLength={500}
          />
        </div>
      </div>

      {/* Row 4: Fund's AUM | Min Ticket | Max Ticket */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Fund's AUM</Label>
          <Select value={aum || "none"} onValueChange={(v) => setAum(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Select Fund Size" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Select Fund Size —</SelectItem>
              {AUM_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Min Ticket Size</Label>
          <Select value={minTicket || "none"} onValueChange={(v) => setMinTicket(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Select Min" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Select Min —</SelectItem>
              {TICKET_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Max Ticket Size</Label>
          <Select value={maxTicket || "none"} onValueChange={(v) => setMaxTicket(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Select Max" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Select Max —</SelectItem>
              {TICKET_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* About */}
      <div className="space-y-1.5">
        <Label>About Company</Label>
        <Textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Brief description of the company"
          rows={3}
          maxLength={2000}
        />
      </div>

      {/* Product & Service Tags */}
      <div className="space-y-1.5">
        <Label>Product &amp; Service Tags (Up to 5)</Label>
        <div className="flex flex-wrap gap-2">
          {keywords.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKeywords(keywords.filter((x) => x !== k))}
              className="px-3 py-1 rounded-full text-xs border bg-primary text-primary-foreground border-primary inline-flex items-center gap-1"
            >
              {k} <X className="h-3 w-3" />
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={keywordDraft}
            onChange={(e) => setKeywordDraft(e.target.value)}
            placeholder="Example: Portfolio Management, Due Diligence, Venture Capital"
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") { e.preventDefault(); addKeyword(); }
            }}
            disabled={keywords.length >= 5}
            maxLength={50}
          />
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
            <button
              key={g}
              type="button"
              onClick={() => setInvestmentFocus(investmentFocus.filter((x) => x !== g))}
              className="px-3 py-1 rounded-full text-xs border bg-primary text-primary-foreground border-primary inline-flex items-center gap-1"
            >
              {g} <X className="h-3 w-3" />
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={focusDraft}
            onChange={(e) => setFocusDraft(e.target.value)}
            placeholder="Add country..."
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") { e.preventDefault(); addFocus(); }
            }}
            disabled={investmentFocus.length >= 10}
          />
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
            .map((custom) => (
              <button
                key={custom}
                type="button"
                onClick={() => setPreferredIndustries(preferredIndustries.filter((x) => x !== custom))}
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

      {/* Status & Visibility */}
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

      {/* Ownership */}
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

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => navigate({ to: "/investors" })}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!canSubmit || m.isPending}
          className="bg-accent text-accent-foreground hover:bg-accent/90"
        >
          {m.isPending ? "Creating…" : "Create investor"}
        </Button>
      </div>
    </form>
  );
}
