import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
import { BuyerBrowseCard, TypeIcon } from "@/components/marketplace/buyer-browse-card";
import { getMyBuyerProfile, saveMyBuyerProfile, setBuyerListing } from "@/lib/buyer-profile.functions";
import {
  aumRange, buyerCompleteness, ticketRange, typeTone,
  type BuyerItemKey, type BuyerOrg, type BuyerProfile, type PublicBuyer,
} from "@/lib/buyer-profile";
import { cn } from "@/lib/utils";
import { ViewToggle, type ViewMode } from "@/components/shared/view-toggle";

type View = "public" | "private";
type Section = "public" | "company" | "fund" | "people" | "mandate" | "portfolio";
const KEY = ["buyer-profile", "me"];

function toPublicLocal(p: BuyerProfile, org: BuyerOrg): PublicBuyer {
  return {
    id: p.user_id, refNo: p.ref_no, codeName: p.code_name, name: p.show_name ? org.name : null, type: org.type,
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
  pof: { cta: "Add proof of funds", link: "Add →", help: "PitchSnack verifies it; sellers see a Proof of funds badge.", section: "fund", view: "private" },
  people: { cta: "Add decision makers", link: "Add →", help: "Shared with sellers only after they approve your NDA.", section: "people", view: "private" },
  company: { cta: "Complete company details", link: "Add →", help: "Legal name, website and address for the private view.", section: "company", view: "private" },
  portfolio: { cta: "Add portfolio", link: "Add →", help: "Optional list of current holdings.", section: "portfolio", view: "private" },
};

function BuyerPill({ p, org, onItem }: { p: BuyerProfile; org: BuyerOrg; onItem: (k: BuyerItemKey) => void }) {
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
  const pill = <BuyerPill p={p} org={org} onItem={onItem} />;
  const profilePanel = (
    <BuyerProfilePanel p={p} org={org} view={view} setView={setView} onItem={onItem} onEdit={setEdit} />
  );
  const rightPanel = (
    <div className="min-w-0 rounded-[14px] border border-border bg-card p-5 shadow-sm">
      {view === "public"
        ? <PublicPanel p={p} org={org} pill={pill} onEdit={setEdit} />
        : <PrivatePanel p={p} org={org} pill={pill} onEdit={setEdit} />}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">My Company</h1>
          <p className="mt-1 text-sm text-muted-foreground">1 investor profile you own or manage</p>
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
          <ViewToggle value={layout === "profiles" ? ("" as never) : layout} onChange={setLayout} />
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => setNewOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Investor Profile
          </Button>
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
      {!matches ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center text-sm text-muted-foreground shadow-card">No companies match your filters</div>
      ) : layout === "profiles" ? (
        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
          <div className="space-y-5"><BuyerFolderCard p={p} org={org} view={view} onView={setView} /></div>
          <div className="min-w-0 lg:self-start">{rightPanel}</div>
        </div>
      ) : layout === "split" ? (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(320px,26rem)_1fr]">
          <BuyerDirectoryItem p={p} org={org} mode="split" selected onClick={() => {}} />
          <div className="min-w-0 self-start rounded-lg border border-border bg-card p-5 shadow-sm lg:sticky lg:top-4">
            {profilePanel}
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
            <Button onClick={() => { setNewOpen(false); setView("private"); setEdit("company"); }}>Edit my profile</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {edit && <EditDialog section={edit} p={p} org={org} onClose={() => setEdit(null)} />}
    </div>
  );
}

/** Seller-style folder-tab card (Public view / Private view) for the investor profile. */
function BuyerFolderCard({ p, org, view, onView }: { p: BuyerProfile; org: BuyerOrg; view: View; onView: (v: View) => void }) {
  const tone = typeTone(org.type);
  const na = <span className="font-normal text-[#9CA3AF]">Not added</span>;
  const shell = "overflow-hidden rounded-b-[14px] rounded-t-none border border-accent bg-card";
  const { pct, missingRequired } = buyerCompleteness(p, org);
  return (
    <div>
      <div role="tablist" className="relative z-10 h-[58px]">
        <FolderTab side="left" active={view === "public"} icon={<Eye className="h-4 w-4 shrink-0" />} title="Public view" sub="Seller preview" open tone="indigo" onClick={() => onView("public")} />
        <FolderTab side="right" active={view === "private"} icon={<Lock className="h-4 w-4 shrink-0" />} title="Private view" sub="Shared after NDA" open tone="green" onClick={() => onView("private")} />
      </div>
      {view === "public" ? (
        <div className={shell}>
          <div className={cn("relative grid h-[120px] w-full place-items-center", tone.bg, tone.fg)}>
            <span className="absolute left-2.5 top-2.5"><StatusChip status={p.status === "live" ? "live" : "draft"} /></span>
            <TypeIcon type={org.type} className="h-10 w-10 opacity-80" />
          </div>
          <div className="px-3 pb-3">
            <div className="truncate pt-2.5 text-[14px] font-bold">{p.code_name}</div>
            <div className="mt-1 truncate text-[11.5px] text-muted-foreground">{[p.ref_no, org.type, p.country].filter(Boolean).join(" · ")}</div>
            <p className="mb-2 mt-1.5 line-clamp-2 text-[12.5px] text-muted-foreground">{p.description || p.headline || na}</p>
            <RowLine label="Ticket size">{ticketRange(p.ticket_min, p.ticket_max) ?? na}</RowLine>
            <RowLine label="Browse investors">{STATUS_LABEL[p.status]}</RowLine>
            <RowLine label="Identity">{p.show_name ? "Name shown" : "Name hidden"}</RowLine>
          </div>
        </div>
      ) : (
        <div className={shell}>
          <div className="p-3">
            <div className="flex items-start gap-3">
              <Logo p={p} org={org} size={48} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-bold">{org.name ?? na}</div>
                <div className="truncate text-[11.5px] text-muted-foreground">{[org.type, p.country].filter(Boolean).join(" · ") || na}</div>
              </div>
              <Ring pct={pct} size={36} done={missingRequired === 0 && pct >= 100} />
            </div>
            <p className="mb-2 mt-2 line-clamp-2 text-[12.5px] text-muted-foreground">{p.private_description || na}</p>
            <RowLine label="Website">{org.website ? org.website.replace(/^https?:\/\//, "") : na}</RowLine>
            <RowLine label="Verification">{org.verified ? "Verified" : "Pending"}</RowLine>
            <RowLine label="Proof of funds">{p.pof_verified_at ? "Verified" : na}</RowLine>
          </div>
        </div>
      )}
    </div>
  );
}

function BuyerProfilePanel({ p, org, view, setView, onItem, onEdit }: {
  p: BuyerProfile; org: BuyerOrg; view: View; setView: (v: View) => void;
  onItem: (k: BuyerItemKey) => void; onEdit: (s: Section) => void;
}) {
  return <div className="space-y-5">
    <div role="tablist" aria-label="Profile visibility" className="flex gap-1 border-b border-border pb-2">
      <Button role="tab" aria-selected={view === "public"} variant={view === "public" ? "secondary" : "ghost"} size="sm" onClick={() => setView("public")}><Eye className="mr-2 h-4 w-4" /> Public view</Button>
      <Button role="tab" aria-selected={view === "private"} variant={view === "private" ? "secondary" : "ghost"} size="sm" onClick={() => setView("private")}><Lock className="mr-2 h-4 w-4" /> Private view</Button>
    </div>
    {view === "public"
      ? <PublicPanel p={p} org={org} pill={<BuyerPill p={p} org={org} onItem={onItem} />} onEdit={onEdit} />
      : <PrivatePanel p={p} org={org} pill={<BuyerPill p={p} org={org} onItem={onItem} />} onEdit={onEdit} />}
  </div>;
}

function BuyerDirectoryItem({ p, org, mode, selected, onClick }: {
  p: BuyerProfile; org: BuyerOrg; mode: ViewMode; selected: boolean; onClick: () => void;
}) {
  const name = org.name || p.code_name;
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
          ? <span className="inline-flex rounded-full bg-[#EEF0FF] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-[#4338CA] dark:bg-indigo-950/50 dark:text-indigo-300">Public view · Seller preview</span>
          : <span className="inline-flex rounded-full bg-[#E8F6EE] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-[#166534] dark:bg-green-950/50 dark:text-green-400">Private view · Shared after NDA</span>}
        <h2 className="mt-0.5 truncate text-[21px] font-bold leading-tight">{title}</h2>
        <div className="truncate text-[13px] text-muted-foreground">{meta}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="mr-1.5 h-3.5 w-3.5" />{editLabel}</Button>
        {pill}
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-9 w-9" aria-label="More"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end"><DropdownMenuItem onClick={onEdit}>{editLabel}</DropdownMenuItem></DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function useSave() {
  const qc = useQueryClient();
  const save = useServerFn(saveMyBuyerProfile);
  return useMutation({
    mutationFn: (patch: Record<string, unknown>) => save({ data: patch as any }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEY }); void qc.invalidateQueries({ queryKey: ["public-buyers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
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
  const save = useSave();
  const qc = useQueryClient();
  const list = useServerFn(setBuyerListing);
  const listing = useMutation({
    mutationFn: (status: "live" | "paused") => list({ data: { status } }),
    onSuccess: (_d, s) => { toast.success(s === "live" ? "Published to Browse investors" : "Listing paused"); void qc.invalidateQueries({ queryKey: KEY }); void qc.invalidateQueries({ queryKey: ["public-buyers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const tone = typeTone(org.type);
  const pub = toPublicLocal(p, org);
  const title = p.show_name && org.name ? org.name : p.code_name;
  const LOCKS = ["Name & logo", "Website & address", "Decision makers", "Emails & phones", "Exact AUM & ticket", "Portfolio", "Decision process"];
  return (
    <div>
      <PanelHead kind="public" title={title} meta={[p.ref_no, org.type ?? "Investor", p.country].filter(Boolean).join(" · ")}
        thumb={<div className={cn("grid h-14 w-14 shrink-0 place-items-center rounded-[10px]", tone.bg, tone.fg)}><TypeIcon type={org.type} className="h-6 w-6" /></div>}
        editLabel="Edit public view" onEdit={() => onEdit("public")} pill={pill} />
      <div className="[&>div]:bg-[#F3F4F6] dark:[&>div]:bg-muted">
        <Intro icon={<Info className="h-4 w-4 text-muted-foreground" />}><b className="font-semibold">This is your seller preview:</b> how your firm appears in Browse investors. Your name, logo, website and people stay hidden until a seller approves your NDA.</Intro>
      </div>
      <div className="rounded-[14px] bg-[#F3F4F6] p-4 dark:bg-muted">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">How sellers see it in Browse investors</span>
          <StatusChip status={p.status === "live" ? "live" : "draft"} />
        </div>
        <BuyerBrowseCard b={pub} className="mx-auto max-w-[380px]" />
      </div>
      <div className="mt-4 flex items-center justify-between gap-4 rounded-[12px] border border-border p-3.5">
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold">Show my name to sellers</div>
          <p className="text-[12.5px] text-muted-foreground">
            {p.show_name ? "Your real name replaces the code name on your card and in Browse investors. Contacts, people and exact figures stay private."
              : `Sellers see the code name "${p.code_name}" until they approve your NDA.`}
          </p>
        </div>
        <Switch checked={p.show_name} disabled={save.isPending} onCheckedChange={(v) => save.mutate({ show_name: v })} aria-label="Show my name to sellers" />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Box title="Mandate" rows={[
          ["Ticket size", ticketRange(p.ticket_min, p.ticket_max)], ["Deal types", p.deal_types.join(", ") || null],
          ["Stages", p.stages.join(", ") || null], ["Target size", p.target_size], ["Geography", p.geography],
        ]} />
        <Box title="Fund · shown as ranges" rows={[
          ["Investor type", org.type], ["AUM", aumRange(p.aum_value)],
          ["Proof of funds", p.pof_verified_at ? "Verified" : null], ["Activity", `${org.ndas} NDA${org.ndas === 1 ? "" : "s"} · ${org.lois} LOI`],
          ["Verified by PitchSnack", org.verified ? "Yes" : "Pending"],
        ]} />
      </div>
      <div className="mt-4">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">In private view · shown after a seller approves your NDA</div>
        <div className="flex flex-wrap gap-1.5">
          {LOCKS.map((l) => <span key={l} className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11.5px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"><Lock className="h-3 w-3" />{l}</span>)}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-[13px]">
        {p.status === "live" && p.live_since
          ? <span className="text-muted-foreground"><b className="font-semibold text-foreground">Live in Browse investors</b> since {fmtDate(p.live_since)} · {p.profile_views_month} seller{p.profile_views_month === 1 ? "" : "s"} viewed your profile this month</span>
          : <span className="text-muted-foreground"><b className="font-semibold text-foreground">{p.status === "paused" ? "Paused" : "Draft"}</b> · not visible in Browse investors</span>}
        {p.status === "live"
          ? <Button variant="outline" size="sm" disabled={listing.isPending} onClick={() => listing.mutate("paused")}>Pause listing</Button>
          : <Button size="sm" disabled={listing.isPending} onClick={() => listing.mutate("live")}>Publish to Browse investors</Button>}
      </div>
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
        <R label="Proof of funds" value={p.pof_verified_at ? `Verified by PitchSnack · ${monthYear(p.pof_verified_at)}` : null} />
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
        <R label="Target size" value={p.target_size} /><R label="Geography" value={p.geography} />
      </Sec>
      <Sec title="Portfolio" action="Add" onEdit={() => onEdit("portfolio")}>
        <R label="Current holdings" value={p.portfolio.length ? p.portfolio.map((h) => h.note ? `${h.name} (${h.note})` : h.name).join(", ") : null} />
      </Sec>
    </div>
  );
}

/* --------------------------------- Editor --------------------------------- */

const TITLES: Record<Section, string> = { public: "Edit public view", company: "Company", fund: "Fund", people: "Decision makers", mandate: "Mandate", portfolio: "Portfolio" };
const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const num = (s: string) => { const n = Number(s.replace(/[^0-9.]/g, "")); return s.trim() && Number.isFinite(n) ? n : null; };

function F({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-[12.5px] font-medium">{label}</span>{children}{hint && <span className="block text-[11.5px] text-muted-foreground">{hint}</span>}</label>;
}

function EditDialog({ section, p, org, onClose }: { section: Section; p: BuyerProfile; org: BuyerOrg; onClose: () => void }) {
  const save = useSave();
  const [f, setF] = useState<Record<string, string>>({
    headline: p.headline ?? "", description: p.description ?? "", legal_name: p.legal_name ?? "", address: p.address ?? "",
    city: p.city ?? "", country: p.country ?? "", logo_url: p.logo_url ?? "", private_description: p.private_description ?? "",
    aum_exact: p.aum_exact ?? "", aum_value: p.aum_value?.toString() ?? "", ticket_exact: p.ticket_exact ?? "",
    ticket_min: p.ticket_min?.toString() ?? "", ticket_max: p.ticket_max?.toString() ?? "", track_record: p.track_record ?? "",
    decision_process: p.decision_process ?? "", sectors: p.sectors.join(", "), stages: p.stages.join(", "), deal_types: p.deal_types.join(", "),
    target_size: p.target_size ?? "", geography: p.geography ?? "",
  });
  const [people, setPeople] = useState(p.people.length ? p.people : [{ name: "", role: "", email: "", phone: "" }]);
  const [holdings, setHoldings] = useState(p.portfolio.length ? p.portfolio : [{ name: "", note: "" }]);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((o) => ({ ...o, [k]: e.target.value }));
  const t = (k: string) => f[k].trim() || null;

  const submit = async () => {
    const patch: Record<string, unknown> =
      section === "public" ? { headline: t("headline"), description: t("description") }
      : section === "company" ? { legal_name: t("legal_name"), address: t("address"), city: t("city"), country: t("country"), logo_url: t("logo_url"), private_description: t("private_description") }
      : section === "fund" ? { aum_exact: t("aum_exact"), aum_value: num(f.aum_value), ticket_exact: t("ticket_exact"), track_record: t("track_record"), decision_process: t("decision_process") }
      : section === "mandate" ? { ticket_min: num(f.ticket_min), ticket_max: num(f.ticket_max), sectors: list(f.sectors), stages: list(f.stages), deal_types: list(f.deal_types), target_size: t("target_size"), geography: t("geography") }
      : section === "people" ? { people: people.filter((m) => m.name.trim()) }
      : { portfolio: holdings.filter((h) => h.name.trim()) };
    await save.mutateAsync(patch);
    toast.success("Saved");
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100vh-64px)] max-w-[560px] overflow-y-auto">
        <DialogHeader><DialogTitle>{TITLES[section]}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {section === "public" && <>
            <F label="Public headline" hint="No firm, brand or people names."><Input value={f.headline} onChange={set("headline")} maxLength={140} /></F>
            <F label="Anonymous description"><Textarea value={f.description} onChange={set("description")} maxLength={600} rows={4} /></F>
            <p className="text-[12px] text-muted-foreground">Code name: <b className="font-semibold">{p.code_name}</b> (assigned by PitchSnack)</p>
          </>}
          {section === "company" && <>
            <p className="text-[12px] text-muted-foreground">Name{org.website ? ", website" : ""} and registration no. come from your buyer verification.</p>
            <F label="Legal name"><Input value={f.legal_name} onChange={set("legal_name")} /></F>
            <F label="Address"><Textarea value={f.address} onChange={set("address")} rows={2} /></F>
            <div className="grid grid-cols-2 gap-3"><F label="City"><Input value={f.city} onChange={set("city")} /></F><F label="Country"><Input value={f.country} onChange={set("country")} /></F></div>
            <F label="Logo URL"><Input value={f.logo_url} onChange={set("logo_url")} placeholder="https://" /></F>
            <F label="Short description"><Textarea value={f.private_description} onChange={set("private_description")} rows={3} /></F>
          </>}
          {section === "fund" && <>
            <div className="grid grid-cols-2 gap-3">
              <F label="AUM (exact)"><Input value={f.aum_exact} onChange={set("aum_exact")} placeholder="$320M" /></F>
              <F label="AUM in USD" hint="Sellers see a range."><Input value={f.aum_value} onChange={set("aum_value")} inputMode="numeric" placeholder="320000000" /></F>
            </div>
            <F label="Ticket size (exact)"><Input value={f.ticket_exact} onChange={set("ticket_exact")} placeholder="$4M – $12M" /></F>
            <F label="Track record"><Textarea value={f.track_record} onChange={set("track_record")} rows={2} /></F>
            <F label="Decision process"><Textarea value={f.decision_process} onChange={set("decision_process")} rows={2} /></F>
            <p className="text-[12px] text-muted-foreground">Proof of funds is added by the PitchSnack team after they check your documents.</p>
          </>}
          {section === "mandate" && <>
            <div className="grid grid-cols-2 gap-3">
              <F label="Ticket min (USD)"><Input value={f.ticket_min} onChange={set("ticket_min")} inputMode="numeric" /></F>
              <F label="Ticket max (USD)"><Input value={f.ticket_max} onChange={set("ticket_max")} inputMode="numeric" /></F>
            </div>
            <F label="Sectors" hint="Separate with commas."><Input value={f.sectors} onChange={set("sectors")} /></F>
            <F label="Stages" hint="Separate with commas."><Input value={f.stages} onChange={set("stages")} placeholder="Growth, Mature" /></F>
            <F label="Deal types" hint="Separate with commas."><Input value={f.deal_types} onChange={set("deal_types")} placeholder="Majority, Full buyout" /></F>
            <F label="Target size"><Input value={f.target_size} onChange={set("target_size")} placeholder="Revenue $5M – $50M" /></F>
            <F label="Geography"><Input value={f.geography} onChange={set("geography")} placeholder="Thailand, Southeast Asia" /></F>
          </>}
          {section === "people" && <>
            {people.map((m, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 rounded-[10px] border border-border p-2.5">
                {(["name", "role", "email", "phone"] as const).map((k) => (
                  <Input key={k} placeholder={k[0].toUpperCase() + k.slice(1)} value={m[k]} onChange={(e) => setPeople((l) => l.map((x, j) => j === i ? { ...x, [k]: e.target.value } : x))} />
                ))}
                <button type="button" onClick={() => setPeople((l) => l.filter((_, j) => j !== i))} className="col-span-2 inline-flex items-center gap-1 justify-self-end text-[12px] text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" />Remove</button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setPeople((l) => [...l, { name: "", role: "", email: "", phone: "" }])}><Plus className="mr-1 h-4 w-4" />Add a decision maker</Button>
          </>}
          {section === "portfolio" && <>
            {holdings.map((h, i) => (
              <div key={i} className="flex gap-2">
                <Input placeholder="Company" value={h.name} onChange={(e) => setHoldings((l) => l.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                <Input placeholder="Note (optional)" value={h.note} onChange={(e) => setHoldings((l) => l.map((x, j) => j === i ? { ...x, note: e.target.value } : x))} />
                <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => setHoldings((l) => l.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setHoldings((l) => [...l, { name: "", note: "" }])}><Plus className="mr-1 h-4 w-4" />Add holding</Button>
          </>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={save.isPending}><BadgeCheck className="mr-1.5 h-4 w-4" />Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
