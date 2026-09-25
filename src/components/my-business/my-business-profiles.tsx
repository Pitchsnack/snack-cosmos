import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Bookmark, Check, EyeOff, MoreVertical, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { StartupListItem } from "@/lib/startups.functions";
import { StartupDetailPanel } from "@/components/startups/startup-detail-panel";
import { PublicationStatusBadge } from "@/components/startups/publication-actions";
import { HiddenProfileTab } from "@/components/hidden-profile/hidden-profile-tab";
import { HiddenProfileEditor } from "@/components/hidden-profile/hidden-profile-editor";
import { SectorArt } from "@/components/hidden-profile/bits";
import { useEntryFacts, useHiddenProfile, useHiddenProfileActions } from "@/hooks/use-hidden-profiles";
import { useHasFinancials } from "@/hooks/use-has-financials";
import {
  hiddenStatusOf, isStartupEntry, moneyRange, type HiddenDraft, type HiddenProfileRow,
} from "@/lib/hidden-profile";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type Sel = { id: string; kind: "full" | "hidden" };

/* ------------------------------ Completeness ------------------------------ */

type Item = { key: string; label: string; weight: number; required: boolean; done: boolean };

function useCompleteness(s: StartupListItem) {
  const { row } = useHiddenProfile(s.id);
  const { data: facts } = useEntryFacts(s.id);
  const { hasData } = useHasFinancials(s.id);
  const tags = (s.product_tags?.length ?? 0) + (s.market_tags?.length ?? 0) + (s.industry?.length ?? 0);
  const items: Item[] = [
    { key: "desc", label: "Description", weight: 15, required: false, done: !!s.short_description?.trim() && tags > 0 },
    { key: "logo", label: "Logo & photos", weight: 15, required: false, done: !!s.logo_signed_url && !!s.tile_image_signed_url },
    { key: "fin", label: "Financials FY23–25", weight: 20, required: true, done: hasData },
    { key: "terms", label: "Deal terms", weight: 15, required: true, done: !!row && row.stake_pct != null && !!row.deal_type },
    { key: "hidden", label: "Hidden profile text", weight: 20, required: true, done: !!row && !!row.code_name?.trim() && !!row.description?.trim() && !!row.customers_summary?.trim() },
    { key: "people", label: "Key people & customers", weight: 15, required: false, done: (facts?.people?.length ?? 0) > 0 && (facts?.customers?.length ?? 0) > 0 },
  ];
  const pct = items.reduce((a, i) => a + (i.done ? i.weight : 0), 0);
  return { items, pct, missingRequired: items.filter((i) => i.required && !i.done).length };
}

function Ring({ pct, size, stroke = 5 }: { pct: number; size: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          className="stroke-profile" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      </svg>
      <span className={cn("absolute inset-0 grid place-items-center font-bold text-profile", size > 44 ? "text-[13px]" : "text-[10px]")}>{pct}%</span>
    </div>
  );
}

function CompletenessStrip({ s, onHidden }: { s: StartupListItem; onHidden: () => void }) {
  const { items, pct, missingRequired } = useCompleteness(s);
  if (pct >= 100) return null;
  const target = (k: string) =>
    k === "fin" ? { to: "/my-startups/$id/financials" as const } : k === "terms" || k === "hidden" ? null : { to: "/my-startups/$id/edit" as const };
  return (
    <div className="flex gap-4 rounded-[14px] border border-profile-line bg-card px-[18px] py-[14px]">
      <Ring pct={pct} size={54} />
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-bold">{s.startup_name} is {pct}% complete</div>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          {missingRequired > 0 ? <>Finish <strong className="text-foreground">{missingRequired} required item{missingRequired === 1 ? "" : "s"}</strong> to publish on the Marketplace. </> : null}
          Complete profiles get more NDA requests.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {items.map((i) => {
            const cls = cn(
              "inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold",
              i.done ? "bg-muted text-muted-foreground"
                : i.required ? "bg-profile text-primary-foreground hover:opacity-90"
                : "border border-dashed border-profile text-profile hover:bg-profile-soft",
            );
            const body = i.done ? <><Check className="h-3 w-3" />{i.label}</> : <>+ {i.label}</>;
            if (i.done) return <span key={i.key} className={cls}>{body}</span>;
            const t = target(i.key);
            return t ? (
              <Link key={i.key} to={t.to} params={{ id: s.id }} className={cls}>{body}</Link>
            ) : (
              <button key={i.key} type="button" onClick={onHidden} className={cls}>{body}</button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- Cards ---------------------------------- */

function cardCls(selected: boolean) {
  return cn(
    "w-full cursor-pointer overflow-hidden rounded-xl bg-card text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
    selected ? "border-2 border-accent shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent)_18%,transparent)]" : "border border-border hover:border-accent/60",
  );
}

function FullCard({ s, row, selected, onSelect }: { s: StartupListItem; row: HiddenProfileRow | null; selected: boolean; onSelect: () => void }) {
  const { items, pct } = useCompleteness(s);
  const left = items.filter((i) => !i.done).length;
  const status = hiddenStatusOf(row, s.company_type);
  const tags = [s.sector, ...(s.industry ?? []), ...(s.product_tags ?? [])].filter(Boolean).slice(0, 3) as string[];
  return (
    <div role="button" tabIndex={0} onClick={onSelect} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect())} className={cn(cardCls(selected), "p-3")}>
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted text-sm font-bold">
          {s.logo_signed_url ? <img src={s.logo_signed_url} alt="" className="h-full w-full object-contain" /> : s.startup_name.slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-bold">{s.startup_name}</div>
          <div className="truncate text-[12px] text-muted-foreground">{[s.company_type, s.headquarters].filter(Boolean).join(" · ") || "—"}</div>
        </div>
        <Ring pct={pct} size={38} stroke={4} />
      </div>
      {s.short_description && <p className="mt-2 line-clamp-2 text-[12.5px] text-muted-foreground">{s.short_description}</p>}
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">{tags.map((t) => <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{t}</span>)}</div>
      )}
      <div className="mt-2.5 space-y-1 border-t border-border pt-2 text-[12px]">
        <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Directory</span><PublicationStatusBadge startupRef={s.id} /></div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Marketplace</span>
          <span className="truncate font-medium">
            {status === "live" || status === "live_edited" ? `Live · ${row?.live?.code_name ?? row?.code_name}` : status === "draft" ? `Draft · ${row?.code_name}` : "Not listed"}
          </span>
        </div>
      </div>
      {left > 0 && <div className="mt-2 text-[12px] font-semibold text-profile">{left} item{left === 1 ? "" : "s"} to finish →</div>}
    </div>
  );
}

function HiddenMiniCard({ s, row, selected, onSelect }: { s: StartupListItem; row: HiddenProfileRow | null; selected: boolean; onSelect: () => void }) {
  if (isStartupEntry(s.company_type) || !row) {
    return (
      <div role="button" tabIndex={0} onClick={onSelect} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect())}
        className={cn(cardCls(selected), "flex flex-col items-center gap-2 border-dashed p-5 text-center text-[12.5px] text-muted-foreground")}>
        <EyeOff className="h-5 w-5" />
        {isStartupEntry(s.company_type) ? "Startups can't be listed in the Marketplace yet" : "No hidden profile yet"}
      </div>
    );
  }
  const status = hiddenStatusOf(row, s.company_type);
  const d = row as HiddenDraft;
  const industry = s.sector || s.industry?.[0] || "SME";
  const rev = moneyRange(s.last_year_revenue);
  const live = status === "live" || status === "live_edited";
  return (
    <div role="button" tabIndex={0} onClick={onSelect} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect())} className={cardCls(selected)}>
      <SectorArt art={d.cover_art} className="h-[84px] w-full">
        <span className={cn("absolute left-2.5 top-2.5 rounded-full px-2 py-0.5 text-[10.5px] font-bold",
          live ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-400")}>
          {live ? "Live" : "Draft"}
        </span>
      </SectorArt>
      <div className="px-3 pb-3">
        <div className="-mt-5 flex items-end gap-2.5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border-2 border-card bg-gradient-to-br from-accent to-accent-dark text-accent-foreground">
            <EyeOff className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 pb-0.5">
            <div className="truncate text-[14px] font-bold">{d.code_name || "Untitled"}</div>
          </div>
          <Bookmark className="mb-1 h-4 w-4 text-muted-foreground" />
        </div>
        <div className="mt-1 truncate text-[11.5px] text-muted-foreground">{row.ref_no} · {industry} · {d.region || "Region not set"}</div>
        <p className="mt-1.5 line-clamp-2 text-[12.5px] text-muted-foreground">{d.description || d.headline || <em>No description yet</em>}</p>
        <div className="mt-2 space-y-0.5 text-[12px]">
          <div className="flex justify-between"><span className="text-muted-foreground">Revenue</span>{rev ? <span className="font-semibold">{rev}</span> : <Link to="/my-startups/$id/financials" params={{ id: s.id }} onClick={(e) => e.stopPropagation()} className="text-muted-foreground underline">Add financials</Link>}</div>
          <div className="flex justify-between"><span className="text-muted-foreground">Asking</span>{d.asking_price != null ? <span className="font-semibold">฿{d.asking_price}M</span> : d.stake_pct != null ? <span className="font-semibold">Price on request</span> : <span className="text-muted-foreground underline">Set terms</span>}</div>
        </div>
        <div className="mt-2.5 flex items-center gap-1.5 border-t border-dashed border-border pt-2 text-[11px] text-muted-foreground">
          <span className="shrink-0">Full profile:</span>
          {s.logo_signed_url && <img src={s.logo_signed_url} alt="" className="h-4 w-4 rounded object-contain" />}
          <span className="truncate font-medium text-foreground">{s.startup_name}</span>
        </div>
        <div className="mt-1.5 flex items-center text-[11.5px]">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground"><EyeOff className="h-3 w-3" />Identity hidden</span>
          <span className="ml-auto font-semibold text-accent">Preview →</span>
        </div>
      </div>
    </div>
  );
}

function BusinessGroup({ s, sel, onSelect }: { s: StartupListItem; sel: Sel | null; onSelect: (k: Sel) => void }) {
  const { row } = useHiddenProfile(s.id);
  return (
    <div className="rounded-2xl border border-border bg-card p-2.5">
      <div className="flex items-center justify-between px-1 pb-2 pt-0.5">
        <span className="truncate text-[13.5px] font-bold">{s.startup_name}</span>
        <span className="shrink-0 text-[11.5px] text-muted-foreground">2 profiles</span>
      </div>
      <Label>Full profile · after NDA</Label>
      <FullCard s={s} row={row} selected={sel?.id === s.id && sel.kind === "full"} onSelect={() => onSelect({ id: s.id, kind: "full" })} />
      <Label className="mt-3">Hidden profile · what buyers see</Label>
      <HiddenMiniCard s={s} row={row} selected={sel?.id === s.id && sel.kind === "hidden"} onSelect={() => onSelect({ id: s.id, kind: "hidden" })} />
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mb-1.5 px-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground", className)}>{children}</div>;
}

/* ------------------------------ Hidden panel ------------------------------ */

function HiddenPanel({ s, editing, setEditing }: { s: StartupListItem; editing: boolean; setEditing: (v: boolean) => void }) {
  const { row } = useHiddenProfile(s.id);
  const { data: facts } = useEntryFacts(s.id);
  const actions = useHiddenProfileActions();
  const [publishOnOpen, setPublishOnOpen] = useState(false);
  const industry = s.sector || s.industry?.[0] || "—";
  const startup = isStartupEntry(s.company_type);

  const create = async () => {
    if (!row && !startup) {
      try { await actions.create.mutateAsync({ startupId: s.id }); } catch { return; }
    }
    setEditing(true);
  };

  if (editing && row) {
    return (
      <HiddenProfileEditor
        row={row}
        facts={facts}
        directoryDescription={s.short_description}
        autoPublish={publishOnOpen}
        onBack={() => { setEditing(false); setPublishOnOpen(false); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {row && !startup && (
        <div className="flex items-start gap-4">
          <SectorArt art={row.cover_art} className="h-[58px] w-[110px] shrink-0 rounded-[10px]" />
          <div className="min-w-0 flex-1">
            <span className="inline-flex rounded-md bg-profile-soft px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-profile">
              Hidden profile · what buyers see before the NDA
            </span>
            <h2 className="mt-1 truncate text-[22px] font-bold leading-tight">{row.code_name || "Untitled"}</h2>
            <div className="text-[13px] text-muted-foreground">{row.ref_no} · {industry} · {row.region || "Region not set"}</div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit hidden profile</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-9 w-9" aria-label="More"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild><Link to="/marketplace">View Marketplace</Link></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}
      <HiddenProfileTab
        name={s.startup_name}
        companyType={s.company_type}
        row={row}
        facts={facts}
        industry={industry}
        showMarkers
        creating={actions.create.isPending}
        onCreate={create}
        onEdit={() => setEditing(true)}
        onPublish={() => { setPublishOnOpen(true); setEditing(true); }}
      />
    </div>
  );
}

/* --------------------------------- Layout --------------------------------- */

export function MyBusinessProfiles({ items }: { items: StartupListItem[] }) {
  const isMobile = useIsMobile();
  const [sel, setSel] = useState<Sel | null>(null);
  const [editing, setEditing] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!items.length) return;
    if (!sel || !items.some((i) => i.id === sel.id)) setSel({ id: items[0].id, kind: "hidden" });
  }, [items, sel]);

  const current = items.find((i) => i.id === sel?.id) ?? null;
  const select = (k: Sel) => { setSel(k); setEditing(false); setMobileOpen(true); };

  const right = current && sel ? (
    <div className="min-w-0 space-y-4">
      <CompletenessStrip s={current} onHidden={() => { setSel({ id: current.id, kind: "hidden" }); setEditing(true); }} />
      <div className="rounded-[14px] border border-border bg-card p-6 shadow-sm">
        {sel.kind === "full" ? (
          <StartupDetailPanel key={current.id} id={current.id} showPublication workspace="my-startups" />
        ) : (
          <HiddenPanel key={current.id} s={current} editing={editing} setEditing={setEditing} />
        )}
      </div>
    </div>
  ) : null;

  if (isMobile && mobileOpen && right) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => setMobileOpen(false)} className="gap-1.5"><ArrowLeft className="h-4 w-4" />Back to My Business</Button>
        {right}
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <div className="space-y-4">
        {items.map((s) => <BusinessGroup key={s.id} s={s} sel={sel} onSelect={select} />)}
      </div>
      <div className="hidden min-w-0 lg:block lg:self-start">{right}</div>
      {!isMobile && <div className="lg:hidden">{right}</div>}
    </div>
  );
}

export { Plus };
