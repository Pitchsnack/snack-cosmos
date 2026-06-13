import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
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
import { ChipInput } from "./chip-input";
import { FounderEditor, type FounderDraft } from "./founder-editor";
import { InvestorPicker } from "./investor-picker";
import { MediaUploader } from "./media-uploader";

const STATUSES = ["Draft","Active","Fundraising","Due Diligence","Portfolio","Exited","Inactive","Archived"];
const VISIBILITIES = ["Private","Tenant","Shared","Archived"];
const STAGES = ["Pre-Seed","Seed","Series A","Series B","Series C","Growth","Other"] as const;
const COMPANY_TYPES = ["SaaS","FinTech","Marketplace","AI","Hardware","Consumer","Other"];

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
  const [logoPath, setLogoPath] = useState<string | null>(startup?.logo_url ?? null);
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
  const [marketTags, setMarketTags] = useState<string[]>(startup?.market_tags ?? []);
  const [industry, setIndustry] = useState(startup?.industry ?? "");
  const [investmentStage, setInvestmentStage] = useState<string>(startup?.investment_stage ?? "");

  // Status/visibility (create only — edit page manages elsewhere)
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

  // Media
  const [slot1, setSlot1] = useState<string | null>(startup?.media.find((m) => m.slot === 1)?.image_path ?? null);
  const [slot2, setSlot2] = useState<string | null>(startup?.media.find((m) => m.slot === 2)?.image_path ?? null);
  const [slot3, setSlot3] = useState<string | null>(startup?.media.find((m) => m.slot === 3)?.image_path ?? null);

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

  const buildProfile = () => ({
    logoPath,
    companyType: companyType || null,
    yearFounded: yearFounded ? Number(yearFounded) : null,
    email: email || null,
    headquarters: headquarters || null,
    investmentStage: (investmentStage as typeof STAGES[number]) || null,
    productTags,
    marketTags,
    investorIds,
    founders: founders.filter((f) => f.full_name.trim()),
    media: [
      slot1 && { slot: 1 as const, image_path: slot1 },
      slot2 && { slot: 2 as const, image_path: slot2 },
      slot3 && { slot: 3 as const, image_path: slot3 },
    ].filter((m): m is { slot: 1 | 2 | 3; image_path: string } => !!m),
  });

  const createM = useMutation({
    mutationFn: () =>
      create({
        data: {
          tenantId,
          startupName,
          legalName: legalName || null,
          websiteUrl: websiteUrl || null,
          country: country || null,
          industry: industry || null,
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
          industry: industry || null,
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
      className="space-y-6"
    >
      {/* Tenant */}
      {!isEdit && (
        <Section title="Workspace">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide">Tenant *</Label>
            <Select value={tenantId} onValueChange={setTenantId}>
              <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
              <SelectContent>
                {tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.tenantName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </Section>
      )}

      {/* Company Profile */}
      <Section title="Company Profile">
        <div className="grid gap-4 md:grid-cols-[8rem_1fr]">
          <MediaUploader
            tenantId={tenantId}
            startupId={startup?.id}
            kind="logo"
            path={logoPath}
            onChange={setLogoPath}
            aspect="square"
            label="Logo"
          />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Company name *"><Input value={startupName} onChange={(e) => setStartupName(e.target.value)} required /></Field>
            <Field label="Company type">
              <Select value={companyType} onValueChange={setCompanyType}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{COMPANY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Year founded">
              <Input type="number" min={1800} max={new Date().getFullYear()} value={yearFounded} onChange={(e) => setYearFounded(e.target.value)} />
            </Field>
            <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hello@company.com" /></Field>
            <Field label="Headquarters"><Input value={headquarters} onChange={(e) => setHeadquarters(e.target.value)} placeholder="Singapore" /></Field>
            <Field label="Website"><Input type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://" /></Field>
            <Field label="Legal name"><Input value={legalName} onChange={(e) => setLegalName(e.target.value)} /></Field>
            <Field label="Country"><Input value={country} onChange={(e) => setCountry(e.target.value)} /></Field>
          </div>
        </div>
      </Section>

      {/* Company Information */}
      <Section title="Company Information">
        <Field label="Short description (max 500)">
          <Textarea value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} maxLength={500} rows={2} />
        </Field>
        <Field label="Product overview">
          <Textarea value={longDescription} onChange={(e) => setLongDescription(e.target.value)} rows={6} />
        </Field>
      </Section>

      {/* Classification & tags */}
      <Section title="Classification">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Industry"><Input value={industry} onChange={(e) => setIndustry(e.target.value)} /></Field>
          <Field label="Investment stage">
            <Select value={investmentStage} onValueChange={setInvestmentStage}>
              <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
              <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="Product & service tags (max 5)">
          <ChipInput value={productTags} onChange={setProductTags} placeholder="Add product tag" />
        </Field>
        <Field label="Market tags (max 5)">
          <ChipInput value={marketTags} onChange={setMarketTags} placeholder="Add market tag" />
        </Field>
      </Section>

      {/* Investors */}
      <Section title="Investors">
        <InvestorPicker tenantId={tenantId} value={investorIds} onChange={setInvestorIds} />
      </Section>

      {/* Founders */}
      <Section title="Founding & leadership team">
        <FounderEditor value={founders} onChange={setFounders} />
      </Section>

      {/* Media gallery */}
      <Section title="Media gallery (Slots 1–3)">
        <div className="grid gap-4 md:grid-cols-3">
          <MediaUploader tenantId={tenantId} startupId={startup?.id} kind="slot-1" path={slot1} onChange={setSlot1} label="Slot 1 (primary)" />
          <MediaUploader tenantId={tenantId} startupId={startup?.id} kind="slot-2" path={slot2} onChange={setSlot2} label="Slot 2" />
          <MediaUploader tenantId={tenantId} startupId={startup?.id} kind="slot-3" path={slot3} onChange={setSlot3} label="Slot 3" />
        </div>
      </Section>

      {/* Ownership (create only) */}
      {!isEdit && (
        <Section title="Ownership (required)">
          <p className="-mt-2 mb-3 text-xs text-muted-foreground">Every startup must have one human Owning Agent and one Owning AI Agent.</p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Owning Agent *">
              <Select value={owningAgentUserId} onValueChange={setOwningAgent} disabled={!tenantId}>
                <SelectTrigger><SelectValue placeholder={humansQ.isLoading ? "Loading…" : "Select an agent"} /></SelectTrigger>
                <SelectContent>
                  {(humansQ.data ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>{[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Owning AI Agent *">
              <Select value={owningAiAgentId} onValueChange={setOwningAi} disabled={!tenantId || noAi}>
                <SelectTrigger><SelectValue placeholder={aisQ.isLoading ? "Loading…" : noAi ? "No AI users in this tenant" : "Select an AI agent"} /></SelectTrigger>
                <SelectContent>
                  {(aisQ.data ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>{[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {noAi && <p className="text-xs text-destructive">Assign an AI user to this tenant first (Users → Invite, type AI).</p>}
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2 pt-2">
            <Field label="Status">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Visibility">
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{VISIBILITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
        </Section>
      )}

      <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t border-border bg-background/80 py-4 backdrop-blur">
        <Button type="button" variant="outline" onClick={() => navigate({ to: isEdit ? "/startups/$id" : "/startups", params: isEdit ? { id: startup!.id } : undefined as never })}>Cancel</Button>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-card">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide">{label}</Label>
      {children}
    </div>
  );
}
