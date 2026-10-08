import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import {
  Briefcase, Building2, Calendar, ExternalLink, FileText, Globe, Languages, Mail, MapPin, MessageSquare, MoreVertical, Phone,
  RefreshCw, Search, ShieldCheck, Star, Tag, Users, Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ViewToggle, type ViewMode } from "@/components/shared/view-toggle";
import { FirmEditForm } from "@/components/advisor/advisor-firm-edit";
import { CredMark, DocMark, FirmStatusPill, VerificationBox, VerificationChip, chipKey, businessDays } from "@/components/advisor/advisor-verification";
import { listAdminAdvisorFirms, decideAdvisor, type AdminFirm } from "@/lib/advisor-admin.functions";
import { getAdvisorFirmForAdmin } from "@/lib/advisor-firm.functions";
import { ADVISOR_SERVICES, FIRM_TYPES, dealBandLabels, initials } from "@/lib/advisor-firm";
import { SECTOR_GROUPS } from "@/lib/sectors";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const VFILTER = ["all", "unverified", "pending", "verified", "more_info", "declined"] as const;
const SORTS = ["updated", "newest", "waiting", "name"] as const;

export const Route = createFileRoute("/_authenticated/advisors/")({
  head: () => ({
    meta: [
      { title: "Advisors Directory — PitchSnack Admin" },
      { name: "description", content: "Every advisor firm profile on PitchSnack, with its verification." },
    ],
  }),
  validateSearch: z.object({
    view: z.enum(["grid", "split", "list"]).optional(),
    selected: z.string().optional(),
    q: z.string().optional(), service: z.string().optional(), type: z.string().optional(), status: z.string().optional(),
    sector: z.string().optional(), city: z.string().optional(), sort: z.enum(SORTS).optional(), v: z.enum(VFILTER).optional(),
    fav: z.boolean().optional(),
  }),
  component: AdvisorsDirectory,
});

const ALL = "__all";

function AdvisorsDirectory() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/advisors/" });
  const fn = useServerFn(listAdminAdvisorFirms);
  const qc = useQueryClient();
  const { data, isLoading, isFetching, refetch, error } = useQuery({ queryKey: ["advisors-admin"], queryFn: () => fn() });
  const view: ViewMode = s.view ?? "split";
  const set = (p: Partial<typeof s>) => navigate({ search: (prev: typeof s) => ({ ...prev, ...p }) });
  const [editing, setEditing] = useState<string | null>(null);
  const favs = new Set(data?.favourites ?? []);
  const toggleFav = async (id: string) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    if (favs.has(id)) await (supabase as any).from("advisor_favourites").delete().eq("user_id", u.user.id).eq("item_kind", "firm").eq("item_id", id).eq("view", "admin");
    else await (supabase as any).from("advisor_favourites").insert({ user_id: u.user.id, item_kind: "firm", item_id: id, view: "admin" });
    qc.invalidateQueries({ queryKey: ["advisors-admin"] });
  };

  const all = data?.firms ?? [];
  const base = useMemo(() => {
    const q = (s.q ?? "").toLowerCase().trim();
    let l = all.filter((f) => {
      if (s.fav && !favs.has(f.id)) return false;
      if (q && ![f.name, f.legalName, f.ref, f.city, f.ownerName, f.ownerEmail, ...f.team.flatMap((t) => [t.name, t.email])].some((x) => x?.toLowerCase().includes(q))) return false;
      if (s.service && !f.services.includes(s.service)) return false;
      if (s.type && f.firmType !== s.type) return false;
      if (s.status && f.status !== s.status) return false;
      if (s.sector && !f.sectorAgnostic && !f.sectors.includes(s.sector)) return false;
      if (s.city && !(f.city ?? "").toLowerCase().includes(s.city.toLowerCase())) return false;
      return true;
    });
    const sort = s.sort ?? "updated";
    l = [...l].sort((a, b) => sort === "name" ? a.name.localeCompare(b.name)
      : sort === "newest" ? +new Date(b.createdAt) - +new Date(a.createdAt)
      : sort === "waiting" ? (a.v.state === "pending" ? +new Date(a.v.requestedAt ?? 0) : Infinity) - (b.v.state === "pending" ? +new Date(b.v.requestedAt ?? 0) : Infinity)
      : +new Date(b.updatedAt) - +new Date(a.updatedAt));
    return l;
  }, [all, s, data?.favourites]); // eslint-disable-line react-hooks/exhaustive-deps
  const vCount = (k: (typeof VFILTER)[number]) => k === "all" ? base.length : k === "verified" ? base.filter((f) => !!f.v.verifiedAt).length : base.filter((f) => f.v.state === k).length;
  const items = s.v && s.v !== "all" ? base.filter((f) => (s.v === "verified" ? !!f.v.verifiedAt : f.v.state === s.v)) : base;
  const selected = items.find((f) => f.id === s.selected) ?? (view === "split" ? items[0] : undefined);
  const hasFilter = !!(s.q || s.service || s.type || s.status || s.sector || s.city);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground"><Briefcase className="h-3.5 w-3.5" /> Advisor Directory{s.fav ? " · Favorites" : ""}</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Advisors</h1>
          <p className="mt-1 text-sm text-muted-foreground">{all.length} advisor firm{all.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" role="switch" aria-checked={!!s.fav} title={s.fav ? "Show all firms" : "Show only favorites"} onClick={() => set({ fav: s.fav ? undefined : true })}
            className={cn("inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors", s.fav ? "border-accent/50 bg-accent/10 text-accent" : "border-input bg-background text-muted-foreground hover:text-foreground")}>
            <Star className={cn("h-4 w-4", s.fav && "fill-accent")} /><span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", s.fav ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground")}>{favs.size}</span>
          </button>
          <ViewToggle value={view} onChange={(v) => set({ view: v })} />
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => toast("New firms without an owner need one more database change — see the chat.")}>+ New firm</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-[16rem] flex-1 items-center gap-2 rounded-md bg-muted/60 px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input value={s.q ?? ""} onChange={(e) => set({ q: e.target.value || undefined })} placeholder="Search firms, ADV ref, city or person" className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" />
        </div>
        <Pick label="All services" value={s.service} opts={ADVISOR_SERVICES.map((x) => x.name)} onChange={(v) => set({ service: v })} />
        <Pick label="All firm types" value={s.type} opts={FIRM_TYPES} onChange={(v) => set({ type: v })} />
        <Pick label="All statuses" value={s.status} opts={["draft", "live", "paused"]} label2={(v) => v[0]!.toUpperCase() + v.slice(1)} onChange={(v) => set({ status: v })} />
        <Select value={s.sector ?? ALL} onValueChange={(v) => set({ sector: v === ALL ? undefined : v })}>
          <SelectTrigger className="h-9 w-44"><SelectValue placeholder="All sectors" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All sectors</SelectItem>
            {SECTOR_GROUPS.map((g) => <SelectGroup key={g.group}><SelectLabel>{g.group}</SelectLabel>{g.sectors.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectGroup>)}
          </SelectContent>
        </Select>
        <Input value={s.city ?? ""} onChange={(e) => set({ city: e.target.value || undefined })} placeholder="City" className="h-9 w-32" />
        <Select value={s.sort ?? "updated"} onValueChange={(v) => set({ sort: v as (typeof SORTS)[number] })}>
          <SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Recently updated</SelectItem><SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="waiting">Oldest waiting for verification</SelectItem><SelectItem value="name">Name A–Z</SelectItem>
          </SelectContent>
        </Select>
        {hasFilter && <Button variant="ghost" size="sm" onClick={() => navigate({ search: { view: s.view } })}>Clear</Button>}
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2"><RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} /> Refresh</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-md bg-muted/60 p-1 text-xs">
          <span className="px-2 text-muted-foreground">Verification:</span>
          {VFILTER.map((k) => (
            <button key={k} type="button" aria-pressed={(s.v ?? "all") === k} onClick={() => set({ v: k === "all" ? undefined : k })}
              className={cn("rounded px-2 py-1 font-medium", (s.v ?? "all") === k ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {{ all: "All", unverified: "Not verified yet", pending: "Pending", verified: "Verified", more_info: "More info", declined: "Declined" }[k]} <span className="opacity-60">{vCount(k)}</span>
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">Verified firms show the Verified advisor badge to sellers and buyers.</span>
      </div>

      {error ? <p className="text-sm text-destructive">{(error as Error).message}</p> : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 w-full" />)}</div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center text-sm text-muted-foreground shadow-card"><Briefcase className="mx-auto mb-2 h-8 w-8 opacity-50" /><p>No firms match your filters.</p></div>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((f) => <div key={f.id} className="space-y-1.5"><GridCard f={f} fav={favs.has(f.id)} onFav={() => toggleFav(f.id)} onOpen={() => set({ view: "split", selected: f.id })} /><Under f={f} /></div>)}
        </div>
      ) : view === "list" ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>{["Firm", "Firm type", "Services", "Status", "Verification", "Owner", "Updated"].map((h) => <th key={h} className="p-3 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <tr key={f.id} className="cursor-pointer border-t border-border hover:bg-muted/30" onClick={() => set({ view: "split", selected: f.id })}>
                  <td className="p-3"><div className="flex items-center gap-2.5"><Logo f={f} size={32} /><div className="min-w-0"><div className="truncate font-medium">{f.name}</div><div className="truncate text-xs text-muted-foreground">{[f.ref, f.city].filter(Boolean).join(" · ")}</div></div></div></td>
                  <td className="p-3">{f.firmType || "—"}</td>
                  <td className="p-3 text-xs">{f.services.slice(0, 2).join(", ")}{f.services.length > 2 && ` +${f.services.length - 2}`}</td>
                  <td className="p-3"><FirmStatusPill status={f.status} /></td>
                  <td className="p-3"><VerificationChip v={f.v} /></td>
                  <td className="p-3">{f.ownerName ?? <span className="text-[#9CA3AF]">No owner yet</span>}</td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(f.updatedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(320px,26rem)_1fr]">
          <div className="h-[calc(100vh-18rem)] space-y-1.5 overflow-y-auto pr-1">
            {items.map((f) => <div key={f.id}><SplitCard f={f} selected={selected?.id === f.id} fav={favs.has(f.id)} onFav={() => toggleFav(f.id)} onSelect={() => set({ selected: f.id })} /><div className="px-2 pt-1"><Under f={f} /></div></div>)}
          </div>
          <div className="min-w-0 self-start rounded-lg border border-border bg-card p-6 shadow-sm lg:sticky lg:top-4">
            {selected ? <Panel f={selected} fav={favs.has(selected.id)} onFav={() => toggleFav(selected.id)} onEdit={() => setEditing(selected.id)} /> : <p className="text-sm text-muted-foreground">Pick a firm to see its profile.</p>}
          </div>
        </div>
      )}
      {editing && <EditDialog id={editing} onClose={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["advisors-admin"] }); }} />}
    </div>
  );
}

function Pick({ label, value, opts, onChange, label2 }: { label: string; value?: string; opts: string[]; onChange: (v?: string) => void; label2?: (v: string) => string }) {
  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : v)}>
      <SelectTrigger className="h-9 w-40"><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent><SelectItem value={ALL}>{label}</SelectItem>{opts.map((o) => <SelectItem key={o} value={o}>{label2 ? label2(o) : o}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function Logo({ f, size = 44 }: { f: AdminFirm; size?: number }) {
  return f.logoUrl
    ? <img src={f.logoUrl} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-lg border border-border bg-white object-contain p-1" />
    : <span style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-lg bg-[#0F766E] text-[13px] font-bold text-white">{initials(f.name)}</span>;
}
function Bookmark({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <button type="button" aria-label={on ? "Remove from favourites" : "Add to favourites"} onClick={(e) => { e.stopPropagation(); onClick(); }} className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"><Star className={cn("h-4 w-4", on && "fill-accent text-accent")} /></button>;
}
const isNew = (f: AdminFirm) => Date.now() - +new Date(f.createdAt) < 14 * 86_400_000;

function GridCard({ f, fav, onFav, onOpen }: { f: AdminFirm; fav: boolean; onFav: () => void; onOpen: () => void }) {
  const deal = dealBandLabels(f.dealBand);
  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === "Enter" && onOpen()} className="cursor-pointer overflow-hidden rounded-lg border border-border bg-card shadow-card transition hover:shadow-md">
      <div className="relative grid h-28 place-items-center bg-white" style={f.logoUrl ? undefined : { backgroundImage: "repeating-linear-gradient(45deg,#0F766E 0 14px,#13867C 14px 28px)" }}>
        {f.logoUrl ? <img src={f.logoUrl} alt="" className="max-h-20 max-w-[70%] object-contain" /> : <span className="text-3xl font-bold text-white">{initials(f.name)}</span>}
        {isNew(f) && <span className="absolute left-2 top-2 rounded bg-[#F6A823] px-1.5 py-0.5 text-[10px] font-bold text-[#0E162F]">NEW</span>}
        <div className="absolute right-1 top-1"><Bookmark on={fav} onClick={onFav} /></div>
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-center gap-2.5"><Logo f={f} size={36} /><div className="min-w-0"><div className="truncate font-semibold">{f.name}</div><div className="truncate text-xs text-muted-foreground">{[f.firmType, f.city].filter(Boolean).join(" · ")}</div></div></div>
        {f.description && <p className="line-clamp-2 text-sm text-muted-foreground">{f.description}</p>}
        <div className="flex flex-wrap gap-1">{f.services.slice(0, 4).map((x) => <span key={x} className="rounded-full bg-[#E0F5F2] px-2 py-0.5 text-[11px] font-medium text-[#0F766E]">{x}</span>)}</div>
        <div className="space-y-0.5 text-xs text-muted-foreground">
          {f.yearFounded && <div>Est. {f.yearFounded}</div>}
          <div>Sectors: {f.sectorAgnostic ? "Sector agnostic" : f.sectors.join(", ") || "—"}</div>
          {deal && <div>Deal size: {deal.usd}</div>}
          {f.languages.length > 0 && <div className="flex flex-wrap items-center gap-1">Languages: {f.languages.map((l) => <span key={l} className="rounded bg-muted px-1.5 py-0.5 text-[10.5px]">{l}</span>)}</div>}
        </div>
      </div>
    </div>
  );
}

function SplitCard({ f, selected, fav, onFav, onSelect }: { f: AdminFirm; selected: boolean; fav: boolean; onFav: () => void; onSelect: () => void }) {
  return (
    <div role="button" tabIndex={0} onClick={onSelect} onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={cn("cursor-pointer rounded-lg border bg-card p-3 transition", selected ? "border-accent ring-2 ring-accent/30" : "border-border hover:border-muted-foreground/40")}>
      <div className="flex items-start gap-3">
        <Logo f={f} />
        <div className="min-w-0 flex-1"><div className="truncate font-semibold">{f.name}</div><div className="truncate text-xs text-muted-foreground">{f.firmType || "—"}</div><div className="truncate text-xs text-muted-foreground">{f.city ?? ""}</div></div>
        <Bookmark on={fav} onClick={onFav} />
      </div>
      {f.description && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{f.description}</p>}
      <div className="mt-2 flex flex-wrap gap-1">{f.services.slice(0, 3).map((x) => <span key={x} className="rounded-full bg-[#E0F5F2] px-2 py-0.5 text-[11px] font-medium text-[#0F766E]">{x}</span>)}</div>
      <div className="mt-1.5 truncate text-xs text-muted-foreground">Sectors: {f.sectorAgnostic ? "Sector agnostic" : f.sectors.join(", ") || "—"}</div>
      <div className="mt-1 text-right text-xs font-medium text-[#2563EB]">View details</div>
    </div>
  );
}

function Under({ f }: { f: AdminFirm }) {
  return <div className="flex items-center gap-2 px-1 text-[11px] text-muted-foreground"><span>Verification:</span><VerificationChip v={f.v} /><span className="ml-auto"><FirmStatusPill status={f.status} /></span></div>;
}

function Sec({ icon: I, title, children }: { icon: typeof Tag; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground"><I className="h-3.5 w-3.5" />{title}</h3>
      {children}
    </section>
  );
}

function Panel({ f, fav, onFav, onEdit }: { f: AdminFirm; fav: boolean; onFav: () => void; onEdit: () => void }) {
  const qc = useQueryClient();
  const decide = useServerFn(decideAdvisor);
  const deal = dealBandLabels(f.dealBand);
  const act = async (action: "reopen" | "send") => {
    try {
      await decide({ data: { id: f.id, action } });
      toast.success(action === "reopen" ? `Verification reopened. ${f.name} is back in Approvals › Advisors.` : `${f.name} is in Approvals › Advisors, waiting for a first check.`);
      qc.invalidateQueries({ queryKey: ["advisors-admin"] }); qc.invalidateQueries({ queryKey: ["approvals"] });
    } catch (e) { toast.error((e as Error).message); }
  };
  const facts: [typeof Tag, string | null][] = [
    [Calendar, f.yearFounded ? `Est. ${f.yearFounded}` : null], [Building2, f.firmType || null], [Users, f.teamSize ? `Team ${f.teamSize}` : null],
    [Wallet, deal ? `Deal size ${deal.usd}` : null], [MapPin, f.city], [Languages, f.languages.join(", ") || null], [Mail, f.email], [Phone, f.phone],
  ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <Logo f={f} size={52} />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold">{f.name}</h2>
          <div className="text-sm text-muted-foreground">{[f.ref, f.firmType, f.city].filter(Boolean).join(" · ")}</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5"><FirmStatusPill status={f.status} /><VerificationChip v={f.v} /></div>
          <div className="mt-1.5 text-[13px]">Owner {f.ownerId ? <Link to="/users" search={{ selected: f.ownerId } as never} className="font-semibold text-[#2563EB] hover:underline">{f.ownerName} ↗</Link> : <span className="text-[#9CA3AF]">No owner yet</span>}</div>
        </div>
        <div className="flex items-center gap-1.5">
          {["pending", "more_info"].includes(f.v.state) && <Button size="sm" variant="outline" asChild><Link to="/approvals" search={{ tab: "advisors", adv: f.id } as never}>Review in Approvals</Link></Button>}
          <Button size="sm" variant="outline" onClick={onEdit}>Edit</Button>
          <Bookmark on={fav} onClick={onFav} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button type="button" aria-label="More" className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted"><MoreVertical className="h-4 w-4" /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {f.v.state === "unverified" && <DropdownMenuItem onSelect={() => act("send")}>Send to verification</DropdownMenuItem>}
              {f.v.state === "declined" && <DropdownMenuItem onSelect={() => act("reopen")}>Reopen verification</DropdownMenuItem>}
              {f.ownerId && <DropdownMenuItem asChild><Link to="/users" search={{ selected: f.ownerId } as never}>Open the owner in Users</Link></DropdownMenuItem>}
              <DropdownMenuItem onSelect={() => { void navigator.clipboard.writeText(f.ref); toast.success(`Copied ${f.ref}`); }}>Copy {f.ref}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <VerificationBox f={f} />
      {f.description && <p className="text-sm leading-relaxed">{f.description}</p>}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground">
        {facts.filter(([, t]) => t).map(([I, t]) => <span key={t} className="inline-flex items-center gap-1.5"><I className="h-3.5 w-3.5" />{t}</span>)}
        {f.website && <a href={/^https?:/.test(f.website) ? f.website : `https://${f.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[#2563EB]"><Globe className="h-3.5 w-3.5" />Website →</a>}
      </div>
      <Sec icon={Tag} title="Services and fees">
        {f.services.length ? <div className="divide-y divide-border rounded-md border border-border text-[13px]">{f.services.map((sv) => <div key={sv} className="flex justify-between gap-3 px-3 py-2"><span>{sv}</span><span className="text-muted-foreground">{f.fees.find((x) => x.service === sv)?.fee || "—"}</span></div>)}</div> : <p className="text-[13px] text-muted-foreground">None yet.</p>}
      </Sec>
      <Sec icon={Briefcase} title="Sectors">
        {f.sectorAgnostic ? <p className="text-[13px]">Sector agnostic</p> : <div className="flex flex-wrap gap-1">{f.sectors.map((x) => <span key={x} className="rounded-full bg-muted px-2 py-0.5 text-[11.5px]">{x}</span>)}{!f.sectors.length && <span className="text-[13px] text-muted-foreground">—</span>}</div>}
      </Sec>
      <Sec icon={Building2} title="Company">
        <dl className="grid grid-cols-[150px_1fr] gap-y-1 text-[13px]">
          {([["Legal name", f.legalName], ["Thai name", f.thaiName], ["Registration no.", f.registrationNo], ["Business address", f.address]] as const).map(([k, v]) => <><dt key={k} className="text-muted-foreground">{k}</dt><dd key={`${k}v`}>{v || "—"}</dd></>)}
        </dl>
      </Sec>
      <Sec icon={Users} title="Team">
        {f.team.length ? <ul className="space-y-1 text-[13px]">{f.team.map((t, i) => <li key={i}><b className="font-medium">{t.name}</b>{t.role && ` · ${t.role}`}{t.email && <span className="text-muted-foreground"> · {t.email}</span>}</li>)}</ul> : <p className="text-[13px] text-muted-foreground">—</p>}
      </Sec>
      <Sec icon={ShieldCheck} title="Licences and credentials">
        {f.credentials.length ? <ul className="space-y-1.5 text-[13px]">{f.credentials.map((c) => <li key={c.id} className="flex items-center justify-between gap-3"><span>{c.name}{c.note && <span className="text-muted-foreground"> · {c.note}</span>}</span><CredMark status={c.status} /></li>)}</ul> : <p className="text-[13px] text-muted-foreground">None added.</p>}
      </Sec>
      <Sec icon={FileText} title="Documents">
        {f.documents.length ? <ul className="space-y-1.5 text-[13px]">{f.documents.map((d) => <li key={d.id} className="flex items-center justify-between gap-3">{d.url ? <a href={d.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#2563EB] hover:underline">{d.name}<ExternalLink className="h-3 w-3" /></a> : <span>{d.name}</span>}<DocMark checked={!!d.checkedAt} /></li>)}</ul> : <p className="text-[13px] text-muted-foreground">None added.</p>}
      </Sec>
      <Sec icon={MessageSquare} title="Client feedback">
        {f.reviews.length ? <ul className="space-y-2 text-[13px]">{f.reviews.map((r, i) => <li key={i}><span className="text-[#F59E0B]">{"★".repeat(r.stars)}</span> {r.comment}{r.role && <span className="text-muted-foreground"> · {r.role}</span>}</li>)}</ul> : <p className="text-[13px] text-muted-foreground">No feedback yet.</p>}
      </Sec>
      {f.v.state === "pending" && <p className="text-xs text-muted-foreground">Waiting {businessDays(f.v.requestedAt)} business day(s) · {chipKey(f.v) === "re_check" ? "re-check" : "first check"}</p>}
    </div>
  );
}

function EditDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const fn = useServerFn(getAdvisorFirmForAdmin);
  const { data } = useQuery({ queryKey: ["advisor-admin-edit", id], queryFn: () => fn({ data: { id } }) });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[900px]">
        {data ? <FirmEditForm firm={data} onDone={onClose} /> : <Skeleton className="h-[500px]" />}
      </DialogContent>
    </Dialog>
  );
}
