import { useManagedIds } from "@/hooks/use-managed-ids";
import { OwnerHandoverBox } from "@/components/handover/owner-check";
import { useEffect, useRef, useState } from "react";
import { SignupWelcome } from "@/components/my-business/signup-welcome";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EditInfoPopup } from "@/components/common/edit-info-popup";
import { BuyerInvestorEdit } from "@/components/my-business/buyer-investor-edit";
import { useOpenProfileEdit } from "@/components/my-business/profile-edit-popup";
import { useNavigate } from "@tanstack/react-router";
import { BadgeCheck, Check, ChevronDown, Info, Lock, Eye, MoreVertical, Pencil, Plus, Trash2, Search, RefreshCw, MapPin, Coins, ArrowRight, Star, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FolderTab, Group, Intro, Ring, Row, RowLine } from "@/components/my-business/my-business-profiles";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BuyerBrowseCard, BuyerCover, TypeIcon, type CardPart } from "@/components/marketplace/buyer-browse-card";
import { getMyBuyerProfile, saveMyBuyerProfile, setBuyerListing, withdrawBuyerProfile } from "@/lib/buyer-profile.functions";
import {
  aumRange, buyerCompleteness, ticketRange, typeTone,
  type BuyerItemKey, type BuyerOrg, type BuyerProfile, type PublicBuyer,
} from "@/lib/buyer-profile";
import { cn } from "@/lib/utils";
import { CompanyMenu, DraftCompanyCard, DraftCompanyPanel } from "@/components/common/company-menu";
import { useSessionContext } from "@/hooks/use-session-context";
import { AlertTriangle, CheckCircle2, Flag } from "lucide-react";
import { bandText, descriptionLeaks, typeName } from "@/lib/investor-bands";
import { buyerProgressFor, type BuyerRelation } from "@/lib/buyer-wizard";
import { ViewToggle, type ViewMode } from "@/components/shared/view-toggle";
import { BuyerPrivateCardBody, BuyerPrivatePanel, useBuyerInvestor } from "@/components/my-business/buyer-private-view";
import { AddInvestorProfileButton, AdminInvestorProfiles, useAddInvestorProfile, useMyInvestorProfileIds } from "@/components/my-business/admin-investor-profiles";

type View = "public" | "private";
type Section = "public" | "company" | "fund" | "people" | "mandate" | "portfolio";
const KEY = ["buyer-profile", "me"];

function toPublicLocal(p: BuyerProfile, org: BuyerOrg): PublicBuyer {
  return {
    id: p.user_id, refNo: p.ref_no, codeName: typeName(org.type), name: null, type: org.type,
    city: p.city, country: p.country, headline: p.headline, description: p.description,
    ticket: ticketRange(p.ticket_min, p.ticket_max), aum: aumRange(p.aum_value),
    sectors: p.sectors, stages: p.stages, dealTypes: p.deal_types, verified: org.verified,
    proofOfFunds: !!p.pof_verified_at, status: p.status, liveSince: p.live_since,
  };
}
const monthYear = (d: string) => new Date(d).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const STATUS_LABEL = { live: "Live", draft: "Draft", paused: "Paused" } as const;

function StatusChip({ status }: { status: BuyerProfile["status"] }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-bold",
      status === "live" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-400")}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-[#F0F1F4] py-1.5 text-[12.5px] dark:border-border">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right">{children}</span>
    </div>
  );
}

/* ------------------------------ Progress pill ------------------------------ */

const HELP: Record<BuyerItemKey, { cta: string; link: string; help: string; section: Section; view: View }> = {
  mandate: { cta: "Set your mandate", link: "Set →", help: "Ticket size, sectors, stages and deal types sellers filter on.", section: "mandate", view: "private" },
  headline: { cta: "Write public headline", link: "Write →", help: "One line sellers see on your Browse investors card.", section: "public", view: "public" },
  people: { cta: "Add decision makers", link: "Add →", help: "Shared with sellers only after they approve your NDA.", section: "people", view: "private" },
  company: { cta: "Complete company details", link: "Add →", help: "Legal name, website and address for the private view.", section: "company", view: "private" },
  portfolio: { cta: "Add portfolio", link: "Add →", help: "Optional list of current holdings.", section: "portfolio", view: "private" },
};

function BuyerPill({ p, org, onItem, setup }: { p: BuyerProfile; org: BuyerOrg; onItem: (k: BuyerItemKey) => void; setup?: { label: string; onClick: () => void } | null }) {
  const { items, pct, missingRequired } = buyerCompleteness(p, org);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const full = pct >= 100;
  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", click); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", click); document.removeEventListener("keydown", key); };
  }, [open]);
  const req = items.filter((i) => i.required && !i.done);
  const next = req[0] ?? items.find((i) => !i.done);
  const opt = items.filter((i) => !i.done && i !== next && !req.includes(i));
  const done = items.filter((i) => i.done);
  const go = (k: BuyerItemKey) => { setOpen(false); onItem(k); };
  return (
    <div ref={ref} className="relative shrink-0">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className={cn("inline-flex h-9 items-center gap-2 rounded-full border pl-1.5 pr-3 text-[13px] font-bold",
          full ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400" : "border-profile-line bg-profile-soft text-profile")}>
        {full ? <span className="grid h-[26px] w-[26px] place-items-center rounded-full bg-emerald-600 text-primary-foreground"><Check className="h-3.5 w-3.5" /></span> : <Ring pct={pct} size={26} stroke={4} />}
        {pct}%<ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[340px] max-w-[calc(100vw-2rem)] rounded-[14px] border border-border bg-card p-4 text-left shadow-xl">
          <div className="flex items-center justify-between text-[14px] font-bold"><span>Profile setup</span><span className="text-profile">{pct}%</span></div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", full ? "bg-emerald-600" : "bg-profile")} style={{ width: `${pct}%` }} /></div>
          {!full && <p className="mt-1.5 text-[12px] text-muted-foreground">{missingRequired} required item{missingRequired === 1 ? "" : "s"} before you can publish</p>}
          {!full && next && (
            <div className="mt-3 rounded-[10px] border border-profile-line bg-profile-soft p-3">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-profile">Next step</div>
              <div className="mt-1 text-[13.5px] font-bold">{HELP[next.key].cta}</div>
              <p className="mt-0.5 text-[12px] text-muted-foreground">{HELP[next.key].help}</p>
              <button type="button" onClick={() => go(next.key)} className="mt-2 inline-flex h-8 items-center rounded-lg bg-profile px-3 text-[12.5px] font-semibold text-primary-foreground hover:opacity-90">{HELP[next.key].cta}</button>
            </div>
          )}
          {req.filter((i) => i !== next).length > 0 && (
            <Group title="Required">{req.filter((i) => i !== next).map((i) => <Row key={i.key} label={i.label} link={HELP[i.key].link} onClick={() => go(i.key)} circle="solid" />)}</Group>
          )}
          {opt.length > 0 && <Group title="Optional">{opt.map((i) => <Row key={i.key} label={i.label} link={HELP[i.key].link} onClick={() => go(i.key)} circle="dashed" />)}</Group>}
          {done.length > 0 && (
            <div className="mt-3 space-y-1">
              {done.map((i) => <div key={i.key} className="flex items-center gap-2 py-0.5 text-[12.5px] text-muted-foreground"><Check className="h-4 w-4 text-emerald-600" />{i.label}</div>)}
            </div>
          )}
          {setup && <button type="button" onClick={() => { setOpen(false); setup.onClick(); }} className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-lg bg-[#1E2A4A] text-[13px] font-semibold text-white hover:bg-[#101d43]">{setup.label}</button>}
          <p className="mt-3 border-t border-border pt-2 text-[11.5px] text-muted-foreground">Complete profiles get more NDA approvals.</p>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Page ---------------------------------- */

const TYPES = ["Family office", "Private equity", "Venture capital", "Corporate VC", "Corporate buyer", "Incubator"];
type Layout = "profiles" | ViewMode;

export function BuyerMyCompany() {
  const fetchMe = useServerFn(getMyBuyerProfile);
  const { data, isLoading, isFetching, refetch, error } = useQuery({ queryKey: KEY, queryFn: () => fetchMe(), meta: { pageLoading: true } });
  const [view, setView] = useState<View>("public");
  const [edit, setEdit] = useState<Section | null>(null);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [sector, setSector] = useState("");
  const [hq, setHq] = useState("");
  const [sort, setSort] = useState("updated_desc");
  const [favOnly, setFavOnly] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [layout, setLayout] = useState<Layout>("profiles");
  const inv = useBuyerInvestor();
  const navigate = useNavigate();
  const openProfileEdit = useOpenProfileEdit();
  const { data: session } = useSessionContext();
  const role = session?.user?.accountRole ?? null;
  const oneCompany = role === "seller" || role === "buyer" || role === "advisor";
  const isAdmin = role === "admin";
  const idsQ = useMyInvestorProfileIds(isAdmin);
  const addProfile = useAddInvestorProfile();
  const openId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("open") ?? undefined : undefined;
  const extraIds = (idsQ.data?.ids ?? []).filter((x) => x !== inv.data?.investor.id);
  const extras = isAdmin ? <AdminInvestorProfiles ids={extraIds} openId={openId} /> : null;
  const total = 1 + extraIds.length;

  if (isLoading) return <div className="space-y-6"><Skeleton className="h-20" /><Skeleton className="h-12" /><div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]"><Skeleton className="h-[420px]" /><Skeleton className="h-[520px]" /></div></div>;
  if (error || !data) return <p className="text-sm text-muted-foreground">Couldn't load your investor profile. Please refresh.</p>;
  const { profile: p, org } = data as { profile: BuyerProfile; org: BuyerOrg };
  const onItem = (k: BuyerItemKey) => { setView(HELP[k].view); setEdit(HELP[k].section); };
  const q = search.trim().toLowerCase();
  const has = (v: string | null | undefined, n: string) => !!v?.toLowerCase().includes(n);
  const matches = !favOnly
    && (!q || [org.name, org.type, p.code_name, p.headline, p.description, p.country, p.city, ...p.sectors, ...p.stages].some((v) => has(v, q)))
    && (type === "all" || (org.type ?? "").toLowerCase() === type.toLowerCase())
    && (status === "all" || p.status === status)
    && (!sector.trim() || p.sectors.some((x) => has(x, sector.trim().toLowerCase())))
    && (!hq.trim() || has(p.city, hq.trim().toLowerCase()) || has(p.country, hq.trim().toLowerCase()));
  const hasFilter = !!(q || type !== "all" || status !== "all" || sector || hq);
  const openProfile = () => setPanelOpen(true);
  const iv = inv.data?.investor;
  const prog = buyerProgressFor((inv.data?.buyer.relation ?? null) as BuyerRelation | null, iv);
  const openWizard = () => iv && navigate({ to: "/buyer/company/$id/setup", params: { id: iv.id }, search: {} });
  const setup = iv && !iv.setup_done_at ? { label: prog.n === 0 ? "Start setup" : "Continue setup", onClick: openWizard } : null;
  const pill = <BuyerPill p={p} org={org} onItem={onItem} setup={setup} />;
  const profilePanel = (
    <BuyerProfilePanel p={p} org={org} view={view} setView={setView} onItem={onItem} onEdit={setEdit} pill={pill} />
  );
  const rightPanel = (
    <div className="min-w-0 rounded-[14px] border border-border bg-card p-5 shadow-sm">
      {view === "public"
        ? <PublicPanel p={p} org={org} pill={pill} onEdit={setEdit} />
        : inv.data ? <BuyerPrivatePanel d={inv.data} view={view} onView={setView} /> : <Skeleton className="h-[520px]" />}
    </div>
  );

  if (iv && !iv.setup_done_at) {
    const tone = typeTone(org.type);
    const individual = inv.data?.buyer.relation === "individual";
    const nm = org.name || iv.investor_name || typeName(org.type);
    return (
      <div className="space-y-6">
        {!oneCompany && <SignupWelcome role="buyer" setupDone={false} />}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">My Company</h1>
            {isAdmin && <p className="mt-1 text-sm text-muted-foreground">{total} investor profile{total === 1 ? "" : "s"} you own or manage</p>}
          </div>
          {isAdmin && <AddInvestorProfileButton onClick={() => void addProfile.run()} busy={addProfile.busy} />}
        </div>
        {extras}
        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
          <DraftCompanyCard role="buyer" name={nm} typeLine={org.type ? typeName(org.type) : null} typeClass={tone.fg}
            founded={individual ? null : (iv as any).year_founded} size={individual ? null : (iv as any).company_size_band} website={iv.website_url} />
          <DraftCompanyPanel role="buyer" name={nm} banner={<SetupBanner n={prog.n} N={prog.N} onOpen={() => openWizard()} />}
            onEdit={() => openProfileEdit({ from: "public" })} onFinish={() => openWizard()} />
        </div>
      </div>
    );
  }

  if (oneCompany) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">My Company</h1>
        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
          <div className="space-y-5"><BuyerFolderCard p={p} org={org} view={view} onView={setView} privateBody={inv.data ? <BuyerPrivateCardBody d={inv.data} status={p.status} selected /> : <Skeleton className="h-[260px]" />} /></div>
          <div className="min-w-0 lg:self-start">{rightPanel}</div>
        </div>
        {edit && <EditDialog section={edit} p={p} org={org} onClose={() => setEdit(null)} />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SignupWelcome role="buyer" setupDone={!!iv?.setup_done_at} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">My Company</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} investor profile{total === 1 ? "" : "s"} you own or manage</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" role="switch" aria-checked={favOnly} aria-label={favOnly ? "Show all my investor profiles" : "Show only favorites"}
            onClick={() => setFavOnly((v) => !v)}
            className={cn("inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors",
              favOnly ? "border-accent/50 bg-accent/10 text-accent" : "border-input bg-background text-muted-foreground hover:text-foreground")}>
            <Star className={cn("h-4 w-4", favOnly && "fill-accent")} />
            <span>&nbsp;</span>
            <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", favOnly ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground")}>0</span>
          </button>
          <Button variant={layout === "profiles" ? "default" : "outline"} size="sm" className="h-9" onClick={() => setLayout("profiles")}>Profiles</Button>
          <ViewToggle value={layout === "profiles" ? ("" as never) : layout} onChange={(l) => { setLayout(l); if (l === "split") setView("private"); }} />
          {isAdmin
            ? <AddInvestorProfileButton onClick={() => void addProfile.run()} busy={addProfile.busy} />
            : <AddInvestorProfileButton onClick={() => (setup ? openWizard() : setNewOpen(true))} />}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-[16rem] flex-1 items-center gap-2 rounded-md bg-muted/60 px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search my investor profiles by name, type, country…" className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All types</SelectItem>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="live">Live</SelectItem><SelectItem value="paused">Paused</SelectItem></SelectContent>
        </Select>
        <Input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Sector" className="h-9 w-36" />
        <Input value={hq} onChange={(e) => setHq(e.target.value)} placeholder="HQ" className="h-9 w-32" />
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="updated_desc">Recently updated</SelectItem>
            <SelectItem value="created_desc">Recently created</SelectItem>
            <SelectItem value="name_asc">Name A–Z</SelectItem>
            <SelectItem value="name_desc">Name Z–A</SelectItem>
          </SelectContent>
        </Select>
        {hasFilter && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setType("all"); setStatus("all"); setSector(""); setHq(""); }} className="gap-1"><X className="h-4 w-4" /> Clear</Button>
        )}
        <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} /> Refresh
        </Button>
      </div>
      {extras}
      {!matches ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center text-sm text-muted-foreground shadow-card">No companies match your filters</div>
      ) : layout === "profiles" ? (
        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
          <div className="space-y-5"><BuyerFolderCard p={p} org={org} view={view} onView={setView} privateBody={inv.data ? <BuyerPrivateCardBody d={inv.data} status={p.status} selected /> : <Skeleton className="h-[260px]" />} /></div>
          <div className="min-w-0 lg:self-start">{rightPanel}</div>
        </div>
      ) : layout === "split" ? (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(320px,26rem)_1fr]">
          {inv.data ? <BuyerPrivateCardBody d={inv.data} status={p.status} selected onSelect={() => setView("private")} /> : <Skeleton className="h-[220px]" />}
          <div className="min-w-0 self-start rounded-lg border border-border bg-card p-5 shadow-sm lg:sticky lg:top-4">
            {view === "public" ? profilePanel : inv.data ? <BuyerPrivatePanel d={inv.data} view={view} onView={setView} /> : <Skeleton className="h-[520px]" />}
          </div>
        </div>
      ) : layout === "grid" ? (
        <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <BuyerDirectoryItem p={p} org={org} mode="grid" selected={false} onClick={openProfile} />
        </div>
      ) : (
        <BuyerDirectoryItem p={p} org={org} mode="list" selected={false} onClick={openProfile} />
      )}
      <Dialog open={panelOpen && (layout === "grid" || layout === "list")} onOpenChange={setPanelOpen}>
        <DialogContent className="max-h-[85vh] max-w-[760px] overflow-y-auto">{profilePanel}</DialogContent>
      </Dialog>
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Investor profile</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Your buyer account already has an investor profile. You can update it here; another profile cannot be added to this account.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button onClick={() => { setNewOpen(false); openProfileEdit({ from: "public" }); }}>Edit my profile</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {edit && <EditDialog section={edit} p={p} org={org} onClose={() => setEdit(null)} />}
    </div>
  );
}

/** Card props for the buyer's own public card (same component sellers see). */
function useOwnCard(p: BuyerProfile, org: BuyerOrg) {
  const inv = useBuyerInvestor();
  const iv = inv.data?.investor;
  const pub = { ...toPublicLocal(p, org), geography: p.geography ?? (iv?.investment_focus_raw ?? []).join(", ") };
  return {
    iv, inv,
    props: {
      b: pub as PublicBuyer, empty: "Not added", status: p.status as "live" | "draft" | "paused",
      relation: (inv.data?.buyer.relation ?? null) as BuyerRelation | null,
      bands: { aum: iv?.aum_band, ticket: iv?.ticket_band, rev: iv?.revenue_min_band },
    },
  };
}

/** Seller-style folder-tab card (Listing view / Exclusive view) for the investor profile. */
function BuyerFolderCard({ p, org, view, onView, privateBody }: { p: BuyerProfile; org: BuyerOrg; view: View; onView: (v: View) => void; privateBody: React.ReactNode }) {
  const shell = "overflow-hidden rounded-b-[14px] rounded-t-none border border-accent bg-card";
  const { iv, props } = useOwnCard(p, org);
  const managedIds = useManagedIds("investor", [iv?.id]);
  return (
    <div>
      <div role="tablist" className="relative z-10 h-[58px]">
        <FolderTab side="left" active={view === "public"} icon={<Eye className="h-4 w-4 shrink-0" />} title="Listing view" sub="Seller preview" open tone="indigo" onClick={() => onView("public")} />
        <FolderTab side="right" active={view === "private"} icon={<Lock className="h-4 w-4 shrink-0" />} title="Exclusive view" sub="Shared after NDA" open tone="green" onClick={() => onView("private")} />
      </div>
      {view === "public" ? (
        <BuyerBrowseCard {...props} managed={managedIds.has(iv?.id ?? "")} onClick={() => onView("public")} className="rounded-b-[14px] rounded-t-none border-accent" />
      ) : (
        <div className={shell}>{privateBody}</div>
      )}
    </div>
  );
}

/** Listing view card part → Edit profile section (shared Edit-at-section helper). */
const PART_SEC: Record<CardPart, string> = { description: "description", ticket: "mandate", aum: "fund", revenue: "revenue", geography: "geography", based: "country", focus: "focus" };

function BuyerProfilePanel({ p, org, view, setView, onItem, onEdit, pill }: {
  p: BuyerProfile; org: BuyerOrg; view: View; setView: (v: View) => void;
  onItem: (k: BuyerItemKey) => void; onEdit: (s: Section) => void; pill: React.ReactNode;
}) {
  return <div className="space-y-5">
    <div role="tablist" aria-label="Profile visibility" className="flex gap-1 border-b border-border pb-2">
      <Button role="tab" aria-selected={view === "public"} variant={view === "public" ? "secondary" : "ghost"} size="sm" onClick={() => setView("public")}><Eye className="mr-2 h-4 w-4" /> Listing view</Button>
      <Button role="tab" aria-selected={view === "private"} variant={view === "private" ? "secondary" : "ghost"} size="sm" onClick={() => setView("private")}><Lock className="mr-2 h-4 w-4" /> Exclusive view</Button>
    </div>
    {view === "public"
      ? <PublicPanel p={p} org={org} pill={pill} onEdit={onEdit} />
      : <SplitPrivate />}
  </div>;
}

function BuyerDirectoryItem({ p, org, mode, selected, onClick }: {
  p: BuyerProfile; org: BuyerOrg; mode: ViewMode; selected: boolean; onClick: () => void;
}) {
  const name = org.name || typeName(org.type);
  const initials = name.split(/\s+/).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
  const ticket = ticketRange(p.ticket_min, p.ticket_max);
  return <Button type="button" variant="outline" onClick={onClick}
    className={cn("group relative flex h-auto w-full items-start justify-start gap-3 whitespace-normal rounded-lg border-border bg-card p-3 text-left shadow-card hover:border-accent hover:bg-card", mode === "grid" ? "min-h-[228px] flex-col" : mode === "split" ? "min-h-[180px] flex-col" : "min-h-[100px] flex-row items-center", selected && "border-accent ring-1 ring-accent/30")}>
    <div className="flex w-full min-w-0 items-start gap-3">
      <div className="flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40">
        {p.logo_url ? <img src={p.logo_url} alt="" className="h-full w-full object-contain" /> : <span className="text-xs font-semibold text-muted-foreground">{initials}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold group-hover:text-accent">{name}</div>
        <div className="mt-1 text-xs font-normal text-muted-foreground">{org.type || <span className="text-[#9CA3AF]">Not added</span>}</div>
        <div className="mt-1"><StatusChip status={p.status} /></div>
      </div>
    </div>
    <div className={cn("min-w-0 text-xs font-normal text-foreground/80", mode === "list" ? "hidden flex-1 md:block" : "w-full")}>
      <p className="line-clamp-2">{p.private_description || p.description || p.headline || <span className="text-[#9CA3AF]">Not added</span>}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {p.sectors.length ? p.sectors.slice(0, 4).map((x) => <span key={x} className="rounded-full border border-transparent bg-muted/50 px-2 py-0.5 text-[10.5px] text-muted-foreground">{x}</span>) : <span className="text-[#9CA3AF]">Sectors not added</span>}
      </div>
    </div>
    <div className={cn("flex items-center gap-2 text-xs font-normal text-muted-foreground", mode === "list" ? "ml-auto shrink-0" : "mt-auto w-full justify-between")}>
      <span className="inline-flex items-center gap-1">{ticket ? <><Coins className="h-3 w-3" /> {ticket}</> : <><MapPin className="h-3 w-3" /> {[p.city, p.country].filter(Boolean).join(", ") || <span className="text-[#9CA3AF]">Not added</span>}</>}</span>
      <ArrowRight className="h-3.5 w-3.5 text-accent" />
    </div>
  </Button>;
}

function Logo({ p, org, size }: { p: BuyerProfile; org: BuyerOrg; size: number }) {
  const tone = typeTone(org.type);
  return p.logo_url
    ? <img src={p.logo_url} alt="" className="shrink-0 rounded-[12px] border border-border object-cover" style={{ width: size, height: size }} />
    : <div className={cn("grid shrink-0 place-items-center rounded-[12px] text-[16px] font-bold", tone.bg, tone.fg)} style={{ width: size, height: size }}>{(org.name ?? "?").slice(0, 1).toUpperCase()}</div>;
}

function PanelHead({ kind, thumb, title, meta, editLabel, onEdit, pill }: { kind: View; thumb: React.ReactNode; title: string; meta: string; editLabel: string; onEdit: () => void; pill: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3.5 border-b border-border pb-4">
      {thumb}
      <div className="min-w-0 flex-1">
        {kind === "public"
          ? <span className="inline-flex rounded-full bg-[#EEF0FF] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-[#4338CA] dark:bg-indigo-950/50 dark:text-indigo-300">Listing view · Seller preview</span>
          : <span className="inline-flex rounded-full bg-[#E8F6EE] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-[#166534] dark:bg-green-950/50 dark:text-green-400">Exclusive view · Shared after NDA</span>}
        <h2 className="mt-0.5 truncate text-[21px] font-bold leading-tight">{title}</h2>
        <div className="truncate text-[13px] text-muted-foreground">{meta}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {pill}
        <CompanyMenu name={title} onEdit={onEdit} />
      </div>
    </div>
  );
}

function Box({ title, rows }: { title: string; rows: [string, React.ReactNode][] }) {
  return (
    <div className="rounded-[12px] border border-border p-3.5">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      {rows.map(([l, v]) => <Line key={l} label={l}>{v ?? <span className="text-[#9CA3AF]">Not added</span>}</Line>)}
    </div>
  );
}

function PublicPanel({ p, org, pill, onEdit }: { p: BuyerProfile; org: BuyerOrg; pill: React.ReactNode; onEdit: (s: Section) => void }) {
  const qc = useQueryClient();
  const list = useServerFn(setBuyerListing);
  const listing = useMutation({
    mutationFn: (status: "live" | "paused") => list({ data: { status } }),
    onSuccess: (d: any, s) => { toast.success(d?.submitted ? "Sent to Admin for review. You'll be notified when it's approved." : s === "live" ? "Live again in Browse investors." : "Paused. Sellers can't find you in Browse investors."); void qc.invalidateQueries({ queryKey: KEY }); void qc.invalidateQueries({ queryKey: ["public-buyers"] }); void qc.invalidateQueries({ queryKey: ["approval-notice"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const appr = (p as any).approval_status as string | undefined;
  const tone = typeTone(org.type);
  const { iv, inv, props } = useOwnCard(p, org);
  const managedIds = useManagedIds("investor", [iv?.id]);
  const title = typeName(org.type);
  const navigate = useNavigate();
  const openProfileEdit = useOpenProfileEdit();
  const rel = (inv.data?.buyer.relation ?? null) as BuyerRelation | null;
  const prog = buyerProgressFor(rel, iv);
  const setupDone = !!iv?.setup_done_at;
  const openWizard = (q?: string) => iv && navigate({ to: "/buyer/company/$id/setup", params: { id: iv.id }, search: q ? { q } : {} });
  const leaks = descriptionLeaks(p.description ?? "", org.name ?? "", org.website ?? "");
  const since = p.status === "live" && p.live_since ? `Live since ${fmtDate(p.live_since)}` : p.status === "paused" ? `Paused since ${fmtDate(p.updated_at ?? p.live_since ?? new Date().toISOString())}` : "Not published yet";
  // One-step approval: Register your company opens the review pop-up.
  const registerFn = useServerFn(registerBuyerCompany);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [sentOpen, setSentOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [failures, setFailures] = useState<string[]>([]);
  const reg = useMutation({
    mutationFn: () => registerFn(),
    onSuccess: () => { setReviewOpen(false); setFailures([]); setSentOpen(true); void qc.invalidateQueries({ queryKey: KEY }); void qc.invalidateQueries({ queryKey: ["approval-notice"] }); },
    onError: (e: Error) => setFailures([e.message]),
  });
  const state = p.status === "live" ? "live" : p.status === "paused" ? "paused" : appr === "in_review" ? "pending" : appr === "changes_requested" ? "changes" : appr === "declined" ? "declined" : "draft";
  // Review your company data pop-up: what sellers see + what PitchSnack checks.
  const invRow = inv.data?.investor as any;
  const reviewData: ReviewCompanyData = {
    suggestedName: (p as any).suggested_listing_name ?? null,
    suggestedHeadline: (p as any).suggested_headline ?? null,
    listingRows: [
      ["Type", org.type || ""],
      ["Industries", Array.isArray(invRow?.industries) ? invRow.industries.join(", ") : ""],
      ["Ticket size", invRow?.ticket_min != null || invRow?.ticket_max != null ? `฿${Number(invRow?.ticket_min ?? 0).toLocaleString()} – ฿${Number(invRow?.ticket_max ?? 0).toLocaleString()}` : ""],
      ["Country", invRow?.country ?? ""],
      ["Headline", (p as any).suggested_headline ?? ""],
      ["Description", (p.description ?? "").slice(0, 400)],
    ],
    identityWords: leaks.words,
    identityApplies: true,
    exclusiveRows: [
      { label: "Firm name", value: org.name ?? "", note: null },
      { label: "Company type", value: org.type ?? "", note: null },
      { label: "Registration Number", value: invRow?.registration_no ?? "", note: null },
      { label: "Registered address", value: [invRow?.city, invRow?.country].filter(Boolean).join(", "), note: null },
      { label: "Year founded", value: invRow?.year_founded != null ? String(invRow.year_founded) : "", note: null },
      { label: "Revenue", value: (p as any).revenue_band ?? "", note: null },
      { label: "Your name", value: invRow?.investor_name ?? "", note: "Not shown publicly" },
      { label: "Website", value: org.website ?? "", note: "Not shown publicly" },
      { label: "Email", value: invRow?.email ?? "", note: "Not shown publicly" },
      { label: "Contact number", value: (p as any).contact_number ?? "", note: "Not shown publicly" },
    ],
  };
  return (
    <div className="overflow-hidden rounded-[14px] border border-border">
      <div className="px-5 pt-5">
        <PanelHead kind="public" title={title} meta={[p.ref_no, p.country].filter(Boolean).join(" · ")}
          thumb={<div className={cn("grid h-14 w-14 shrink-0 place-items-center rounded-[10px]", tone.bg, tone.fg)}><TypeIcon type={org.type} className="h-6 w-6" /></div>}
          editLabel="Edit information" onEdit={() => openProfileEdit({ section: "description", from: "public" })} pill={pill} />
        {iv && <div className="mt-4"><OwnerHandoverBox kind="investor" id={iv.id} onEdit={(x) => openProfileEdit({ section: x.edit.section as never, from: (x.edit.view ?? "public") as never })} /></div>}
        {iv && p.status !== "live" && !setupDone && <SetupBanner n={prog.n} N={prog.N} onOpen={() => openWizard()} />}
        <div className="flex flex-col gap-3 rounded-[14px] bg-[#EEF0F4] p-3.5 dark:bg-muted">
          <BuyerBrowseCard {...props} managed={managedIds.has(iv?.id ?? "")} expanded editable={(k) => openProfileEdit({ section: PART_SEC[k], from: "public" })} cardFooter={
            <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border pt-2 text-[11.5px] text-[#6B7280] dark:text-muted-foreground">
              <span className="truncate">{title} · {p.ref_no}</span><span className="shrink-0">{since}</span>
            </div>
          } />
        </div>
        <div className={cn("my-4 flex items-start gap-2 text-[13px]", leaks.length ? "text-[#B42318]" : "text-[#15803D] dark:text-green-400")}>
          {leaks.length ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          {leaks.length
            ? <span><b className="font-semibold">Identity check:</b> {leaks.join(", ")} · remove them in Edit public view.</span>
            : <span><b className="font-semibold">Identity check passed</b> · no firm name, website or contact details in the public text.</span>}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E9EBEF] bg-[#FAFAFB] px-5 py-3.5 text-[13px] text-[#6A7181] dark:border-border dark:bg-muted/40 dark:text-muted-foreground">
        {state === "live"
          ? <span>Live in Browse investors since {p.live_since ? fmtDate(p.live_since) : "—"} · {org.ndas} NDA{org.ndas === 1 ? "" : "s"} · {org.lois} LOI{org.lois === 1 ? "" : "s"}</span>
          : state === "pending"
            ? <span>Submitted on {p.submitted_at ? fmtDate(p.submitted_at) : "—"} · sellers can't find you yet</span>
          : state === "changes" || state === "declined"
            ? <span>Fix what PitchSnack asked with Edit information, then register again.</span>
          : state === "paused"
            ? <span>Hidden from Browse investors since {fmtDate(p.updated_at ?? p.live_since ?? new Date().toISOString())}.</span>
            : !setupDone && iv
              ? <span>Finish setting up your profile to publish it.</span>
              : <span><b className="font-semibold text-foreground">Draft</b> · not live yet. Register once: PitchSnack checks your firm and publishes your profile together.</span>}
        {state === "live"
          ? <Button variant="outline" size="sm" onClick={() => setWithdrawOpen(true)}>Remove your company profile from listing</Button>
          : state === "pending"
            ? <span className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-3.5 text-[13.5px] font-semibold text-[#1D4ED8]"><Clock className="h-4 w-4" />Pending approval</span>
          : state === "paused"
            ? <Button size="sm" className="whitespace-normal bg-[#1E2A4A] text-center text-white hover:bg-[#101d43]" disabled={listing.isPending} onClick={() => listing.mutate("live")}>List my company so that sellers can contact me</Button>
          : state === "draft" && !setupDone && iv
            ? <Button size="sm" className="bg-[#1E2A4A] text-white hover:bg-[#101d43]" onClick={() => openWizard()}>Finish setup to publish</Button>
            : <Button size="sm" className="bg-[#1E2A4A] text-white hover:bg-[#101d43]" onClick={() => { setFailures([]); setReviewOpen(true); }}><Send className="mr-1.5 h-4 w-4" />Register your company</Button>}
      </div>
      <ReviewCompanyDialog open={reviewOpen} role="buyer" data={reviewData} failures={failures} submitting={reg.isPending}
        onEdit={() => { setReviewOpen(false); openProfileEdit({ section: "description", from: "public" }); }}
        onSubmit={() => reg.mutate()} onClose={() => setReviewOpen(false)} />
      <SentForApprovalDialog open={sentOpen} role="buyer" onClose={() => setSentOpen(false)} />
      <WithdrawDialog open={withdrawOpen} role="buyer" busy={listing.isPending} onClose={() => setWithdrawOpen(false)}
        onConfirm={() => listing.mutate("paused", { onSuccess: () => setWithdrawOpen(false) })} />
    </div>
  );
}

export function SetupBanner({ n, N, onOpen }: { n: number; N: number; onOpen: () => void }) {
  const all = n >= N;
  return (
    <div data-tour-banner data-tour-n={N} data-tour-m={3} className="mb-4 flex flex-col gap-3 rounded-[14px] border border-[#CFD2FB] bg-[#EEF0FF] px-[18px] py-4 min-[860px]:flex-row min-[860px]:items-center dark:border-[#2E3570] dark:bg-[#1B2140]">
      <div className="hidden h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-card text-[#4338CA] min-[860px]:grid"><Flag className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-bold">{n === 0 ? "Set up your investor profile" : "Finish setting up your investor profile"}</div>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {all ? `All ${N} questions are answered. Check your profile and save it, then publish it to Browse investors.`
            : `Sellers can't find your profile yet. Answer ${N} short questions. It takes about 3 minutes and saves as you go.`}
        </p>
        <div className="mt-2 flex items-center gap-2 text-[12px] text-muted-foreground">
          <span>{n} of {N} answered</span>
          <div className="h-1 w-32 overflow-hidden rounded-full bg-card"><div className="h-full bg-[#1E2A4A] dark:bg-[#818CF8]" style={{ width: `${(n / N) * 100}%` }} /></div>
        </div>
      </div>
      <Button size="sm" data-tour-btn className="bg-[#1E2A4A] text-white hover:bg-[#101d43]" onClick={onOpen}>{n === 0 ? "Start setup →" : "Continue setup →"}</Button>
    </div>
  );
}

function Sec({ title, onEdit, action = "Edit", children }: { title: string; onEdit: () => void; action?: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 first:mt-0">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[#6B7280] dark:text-muted-foreground">{title}</span>
        <button type="button" onClick={onEdit} className="text-[12.5px] font-medium text-blue-600 hover:underline">{action}</button>
      </div>
      {children}
    </section>
  );
}
function R({ label, value }: { label: string; value: React.ReactNode }) {
  const empty = value == null || value === "";
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3 border-t border-[#F0F1F4] py-2 text-[13px] dark:border-border">
      <span className="text-[#6B7280] dark:text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 break-words", empty ? "text-[#9CA3AF]" : "text-[#374151] dark:text-foreground/85")}>{empty ? "Not added" : value}</span>
    </div>
  );
}

function PrivatePanel({ p, org, pill, onEdit }: { p: BuyerProfile; org: BuyerOrg; pill: React.ReactNode; onEdit: (s: Section) => void }) {
  const web = org.website ? <a href={org.website.startsWith("http") ? org.website : `https://${org.website}`} target="_blank" rel="noreferrer" className="font-medium text-blue-600">{org.website.replace(/^https?:\/\//, "")}</a> : null;
  return (
    <div>
      <PanelHead kind="private" title={org.name ?? "Your firm"} meta={[org.type ?? "Investor", [p.city, p.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
        thumb={<Logo p={p} org={org} size={56} />} editLabel="Edit profile" onEdit={() => onEdit("company")} pill={pill} />
      <div className="[&>div]:bg-[#F3F4F6] dark:[&>div]:bg-muted">
        <Intro icon={<Lock className="h-4 w-4 text-muted-foreground" />}>Your full firm details. Only sellers who approve your NDA can see this.</Intro>
      </div>
      <Sec title="Company" onEdit={() => onEdit("company")}>
        <R label="Name" value={org.name} /><R label="Legal name" value={p.legal_name} /><R label="Registration no." value={org.registrationNo} />
        <R label="Website" value={web} /><R label="Address" value={p.address} />
      </Sec>
      <Sec title="Fund" onEdit={() => onEdit("fund")}>
        <R label="Assets under management" value={p.aum_exact} /><R label="Ticket size" value={p.ticket_exact} />
        <R label="Track record" value={p.track_record} /><R label="Decision process" value={p.decision_process} />
      </Sec>
      <Sec title="Decision makers" onEdit={() => onEdit("people")}>
        {p.people.map((m, i) => (
          <div key={i} className="flex items-center gap-3 border-t border-[#F0F1F4] py-2 text-[13px] dark:border-border">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-[11.5px] font-semibold text-muted-foreground">{m.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
            <div className="min-w-0 flex-1"><div className="truncate text-[#374151] dark:text-foreground/85">{m.name}</div><div className="truncate text-[12px] text-muted-foreground">{m.role}</div></div>
            <div className="shrink-0 text-right text-[12px] text-muted-foreground"><div>{m.email}</div><div>{m.phone}</div></div>
          </div>
        ))}
        <button type="button" onClick={() => onEdit("people")} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-border py-2 text-[13px] font-medium text-muted-foreground hover:bg-muted"><Plus className="h-4 w-4" />Add a decision maker</button>
      </Sec>
      <Sec title="Mandate" onEdit={() => onEdit("mandate")}>
        <R label="Sectors" value={p.sectors.join(", ")} /><R label="Stages" value={p.stages.join(", ")} /><R label="Deal types" value={p.deal_types.join(", ")} />
        <MandateBands /><R label="Geography" value={p.geography} />
      </Sec>
      <Sec title="Portfolio" action="Add" onEdit={() => onEdit("portfolio")}>
        <R label="Current holdings" value={p.portfolio.length ? p.portfolio.map((h) => h.note ? `${h.name} (${h.note})` : h.name).join(", ") : null} />
      </Sec>
    </div>
  );
}

/* --------------------------------- Editor --------------------------------- */

function EditDialog({section,p,onClose}:{section:Section;p:BuyerProfile;org:BuyerOrg;onClose:()=>void}) {
 const mapped = section === "public" ? "description" : section === "company" ? "address" : section;
 return <EditInfoPopup open subtitle="Your company" companyName={p.legal_name ?? ""} onClosed={onClose} phoneTabs><BuyerInvestorEdit section={mapped} /></EditInfoPopup>;
}

function SplitPrivate() {
  const inv = useBuyerInvestor();
  return inv.data ? <BuyerPrivatePanel d={inv.data} /> : <Skeleton className="h-[520px]" />;
}

/** Ticket size and Min. target revenue (revenue minimum band). */
function MandateBands() {
  const iv = useBuyerInvestor().data?.investor;
  return <>
    <R label="Ticket size" value={bandText(iv?.ticket_band)} />
    <R label="Min. target revenue" value={bandText(iv?.revenue_min_band)} />
  </>;
}
