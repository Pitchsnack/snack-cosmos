import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, ChevronDown, Eye, EyeOff, Info, Lock, MoreVertical, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { StartupListItem } from "@/lib/startups.functions";
import { StartupDetailPanel } from "@/components/startups/startup-detail-panel";
import { usePublication } from "@/hooks/use-publication";
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

type View = "public" | "private";

/* ------------------------------ Completeness ------------------------------ */

type ItemKey = "desc" | "logo" | "fin" | "terms" | "hidden" | "people";
type Item = { key: ItemKey; label: string; weight: number; required: boolean; done: boolean };

function useCompleteness(s: StartupListItem) {
  const { row } = useHiddenProfile(s.id);
  const { data: facts } = useEntryFacts(s.id);
  const { hasData } = useHasFinancials(s.id);
  const tags = (s.product_tags?.length ?? 0) + (s.market_tags?.length ?? 0) + (s.industry?.length ?? 0);
  const items: Item[] = [
    { key: "desc", label: "Description & tags", weight: 15, required: false, done: !!s.short_description?.trim() && tags > 0 },
    { key: "logo", label: "Logo & photos", weight: 15, required: false, done: !!s.logo_signed_url && !!s.tile_image_signed_url },
    { key: "fin", label: "Financials FY23–25", weight: 20, required: true, done: hasData },
    { key: "terms", label: "Deal terms", weight: 15, required: true, done: !!row && row.stake_pct != null && !!row.deal_type },
    { key: "hidden", label: "Public description", weight: 20, required: true, done: !!row && !!row.code_name?.trim() && !!row.description?.trim() && !!row.customers_summary?.trim() },
    { key: "people", label: "Key people & customers", weight: 15, required: false, done: (facts?.people?.length ?? 0) > 0 && (facts?.customers?.length ?? 0) > 0 },
  ];
  const pct = items.reduce((a, i) => a + (i.done ? i.weight : 0), 0);
  return { items, pct, missingRequired: items.filter((i) => i.required && !i.done).length };
}

function Ring({ pct, size, stroke = 5, done }: { pct: number; size: number; stroke?: number; done?: boolean }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          className={done ? "stroke-emerald-600" : "stroke-profile"} strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      </svg>
      {size > 30 && <span className="absolute inset-0 grid place-items-center text-[10.5px] font-bold text-profile">{pct}%</span>}
    </div>
  );
}

const HELP: Record<ItemKey, { cta: string; link: string; help: string }> = {
  fin: { cta: "Add financials", link: "Add →", help: "Buyers see revenue as a range before the NDA, exact figures after." },
  terms: { cta: "Set deal terms", link: "Set →", help: "Stake, deal type and asking price shown in your public view." },
  hidden: { cta: "Write public description", link: "Write →", help: "An anonymous description buyers read before the NDA." },
  desc: { cta: "Add description", link: "Add →", help: "A short description and tags for your company." },
  logo: { cta: "Add logo & photos", link: "Add →", help: "Shown only after you approve an NDA." },
  people: { cta: "Add people & customers", link: "Add →", help: "Key people and customers, names after the NDA." },
};

function ProgressPill({ s, onItem }: { s: StartupListItem; onItem: (k: ItemKey) => void }) {
  const { items, pct, missingRequired } = useCompleteness(s);
  const [open, setOpen] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const full = pct >= 100;
  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", click); document.removeEventListener("keydown", key); };
  }, [open]);
  const req = items.filter((i) => i.required && !i.done);
  const next = req[0] ?? items.find((i) => !i.done);
  const restReq = req.filter((i) => i !== next);
  const opt = items.filter((i) => !i.required && !i.done && i !== next);
  const done = items.filter((i) => i.done);
  const go = (k: ItemKey) => { setOpen(false); onItem(k); };

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={`Profile setup: ${missingRequired} required item${missingRequired === 1 ? "" : "s"} left`}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-full border pl-1.5 pr-3 text-[13px] font-bold transition-shadow",
          full ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
            : "border-profile-line bg-profile-soft text-profile",
          open && !full && "border-profile/60 shadow-[0_0_0_3px_var(--profile-line)]",
        )}
      >
        {full ? <span className="grid h-[26px] w-[26px] place-items-center rounded-full bg-emerald-600 text-primary-foreground"><Check className="h-3.5 w-3.5" /></span> : <Ring pct={pct} size={26} stroke={4} />}
        {pct}%
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[360px] max-w-[calc(100vw-2rem)] rounded-[14px] border border-border bg-card p-4 text-left shadow-xl">
          <div className="flex items-center justify-between text-[14px] font-bold"><span>Profile setup</span><span className="text-profile">{pct}%</span></div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", full ? "bg-emerald-600" : "bg-profile")} style={{ width: `${pct}%` }} /></div>
          {!full && <p className="mt-1.5 text-[12px] text-muted-foreground">{missingRequired} required item{missingRequired === 1 ? "" : "s"} before you can publish</p>}

          {!full && next && (
            <div className="mt-3 rounded-[10px] border border-profile-line bg-profile-soft p-3">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-profile">Next step</div>
              <div className="mt-1 text-[13.5px] font-bold">{HELP[next.key].cta === "Add financials" ? "Add financials FY23–25" : HELP[next.key].cta}</div>
              <p className="mt-0.5 text-[12px] text-muted-foreground">{HELP[next.key].help}</p>
              <button type="button" onClick={() => go(next.key)} className="mt-2 inline-flex h-8 items-center rounded-lg bg-profile px-3 text-[12.5px] font-semibold text-primary-foreground hover:opacity-90">{HELP[next.key].cta}</button>
            </div>
          )}

          {!full && restReq.length > 0 && (
            <Group title="Required">
              {restReq.map((i) => <Row key={i.key} label={i.label} link={HELP[i.key].link} onClick={() => go(i.key)} circle="solid" />)}
            </Group>
          )}
          {!full && opt.length > 0 && (
            <Group title="Optional">
              {opt.map((i) => <Row key={i.key} label={i.label} link={HELP[i.key].link} onClick={() => go(i.key)} circle="dashed" />)}
            </Group>
          )}
          {done.length > 0 && (
            <div className="mt-3">
              {!full && (
                <button type="button" onClick={() => setShowDone((v) => !v)} className="inline-flex items-center gap-1 text-[12px] font-semibold text-muted-foreground">
                  {done.length} completed <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showDone && "rotate-180")} />
                </button>
              )}
              {(showDone || full) && (
                <div className="mt-1.5 space-y-1">
                  {done.map((i) => (
                    <button key={i.key} type="button" onClick={() => go(i.key)} className="flex w-full items-center gap-2 py-1 text-left text-[12.5px] text-muted-foreground">
                      <Check className="h-4 w-4 text-emerald-600" />{i.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <p className="mt-3 border-t border-border pt-2 text-[11.5px] text-muted-foreground">Complete profiles get more NDA requests.</p>
        </div>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function Row({ label, link, onClick, circle }: { label: string; link: string; onClick: () => void; circle: "solid" | "dashed" }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2 py-1.5 text-left text-[13px]">
      <span className={cn("h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/40", circle === "dashed" && "border-dashed")} />
      <span className="flex-1">{label}</span>
      <span className="text-[12.5px] font-semibold text-profile">{link}</span>
    </button>
  );
}

/* --------------------------- Left: tabbed card ---------------------------- */

function FolderTab({ active, icon, title, sub, tone, onClick }: {
  active: boolean; icon: React.ReactNode; title: string; sub: string; tone: "indigo" | "green"; onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "relative flex flex-1 items-center gap-2 rounded-t-[12px] px-3 py-2 text-left",
        active
          ? "z-10 -mb-[2px] border-2 border-b-0 border-amber-500 bg-card pb-[10px] text-foreground"
          : "mb-0 border border-b-0 border-border bg-muted text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      <span className="min-w-0">
        <span className="block text-[13px] font-bold leading-tight">{title}</span>
        <span className={cn("block text-[10.5px] leading-tight",
          active ? (tone === "indigo" ? "text-indigo-700 dark:text-indigo-300" : "text-green-800 dark:text-green-400") : "")}>{sub}</span>
      </span>
    </button>
  );
}

function RowLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-border py-1.5 text-[12.5px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-medium">{children}</span>
    </div>
  );
}

function PublicCardBody({ s, row }: { s: StartupListItem; row: HiddenProfileRow | null }) {
  if (isStartupEntry(s.company_type) || !row) {
    return (
      <div className="flex flex-col items-center gap-2 p-6 text-center text-[12.5px] text-muted-foreground">
        <EyeOff className="h-5 w-5" />
        {isStartupEntry(s.company_type) ? "Startups can't be listed on the Marketplace yet" : "No public view yet"}
      </div>
    );
  }
  const status = hiddenStatusOf(row, s.company_type);
  const d = row as HiddenDraft;
  const industry = s.sector || s.industry?.[0] || "SME";
  const rev = moneyRange(s.last_year_revenue);
  const live = status === "live" || status === "live_edited";
  return (
    <>
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
          <div className="min-w-0 flex-1 truncate pb-0.5 text-[14px] font-bold">{d.code_name || "Untitled"}</div>
        </div>
        <div className="mt-1 truncate text-[11.5px] text-muted-foreground">{row.ref_no} · {industry} · {d.region || "Region not set"}</div>
        <p className="mb-2 mt-1.5 truncate text-[12.5px] text-muted-foreground">{d.description || d.headline || <em>No description yet</em>}</p>
        <RowLine label="Revenue">{rev ?? <span className="font-normal text-muted-foreground">Add financials</span>}</RowLine>
        <RowLine label="Marketplace">{live ? "Live" : status === "draft" ? "Draft" : "Not listed"}</RowLine>
        <RowLine label="Identity">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11.5px] font-normal text-muted-foreground"><EyeOff className="h-3 w-3" />Name hidden</span>
        </RowLine>
      </div>
    </>
  );
}

function PrivateCardBody({ s }: { s: StartupListItem }) {
  const { pct } = useCompleteness(s);
  const published = usePublication(s.id).status === "published";
  const website = s.website_url ? (s.website_url.startsWith("http") ? s.website_url : `https://${s.website_url}`) : null;
  return (
    <div className="p-3.5">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[10px] border border-border bg-muted text-sm font-bold">
          {s.logo_signed_url ? <img src={s.logo_signed_url} alt="" className="h-full w-full object-contain" /> : s.startup_name.slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-bold">{s.startup_name}</div>
          <div className="truncate text-[12px] text-muted-foreground">{[s.company_type, s.headquarters].filter(Boolean).join(" · ") || "—"}</div>
        </div>
        <Ring pct={pct} size={40} stroke={4} done={pct >= 100} />
      </div>
      {s.short_description && <p className="mb-2 mt-2.5 line-clamp-2 text-[12.5px] text-muted-foreground">{s.short_description}</p>}
      <div className="mt-2">
        <RowLine label="Directory">{published ? "Published" : "Not published"}</RowLine>
        <RowLine label="Website">
          {website ? <a href={website} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-2 hover:underline">{website.replace(/^https?:\/\//, "")}</a> : <span className="font-normal text-muted-foreground">—</span>}
        </RowLine>
      </div>
    </div>
  );
}

function BusinessCard({ s, view, onView }: { s: StartupListItem; view: View | null; onView: (v: View) => void }) {
  const { row } = useHiddenProfile(s.id);
  const [local, setLocal] = useState<View>("public");
  const v = view ?? local;
  const pick = (x: View) => { setLocal(x); onView(x); };
  const selected = view != null;
  return (
    <div>
      <div role="tablist" className="flex gap-1 px-1">
        <FolderTab active={v === "public"} icon={<Eye className="h-4 w-4 shrink-0" />} title="Public view" sub="Buyer preview" tone="indigo" onClick={() => pick("public")} />
        <FolderTab active={v === "private"} icon={<Lock className="h-4 w-4 shrink-0" />} title="Private view" sub="Shared after NDA" tone="green" onClick={() => pick("private")} />
      </div>
      <div className={cn("overflow-hidden rounded-[14px] border-2 bg-card",
        selected ? "border-amber-500 shadow-[0_0_0_3px_color-mix(in_oklab,#f59e0b_18%,transparent)]" : "border-amber-500/50")}>
        {v === "public" ? <PublicCardBody s={s} row={row} /> : <PrivateCardBody s={s} />}
      </div>
    </div>
  );
}

/* ------------------------------ Right panel ------------------------------- */

function Intro({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-[10px] bg-muted px-3 py-2.5 text-[13px] leading-relaxed text-foreground/80">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function KindPill({ kind }: { kind: View }) {
  return kind === "public" ? (
    <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">Public view · Buyer preview</span>
  ) : (
    <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-green-800 dark:bg-green-950/50 dark:text-green-400">Private view · Shared after NDA</span>
  );
}

function PublicPanel({ s, editing, setEditing, pill }: { s: StartupListItem; editing: boolean; setEditing: (v: boolean) => void; pill: React.ReactNode }) {
  const { row } = useHiddenProfile(s.id);
  const { data: facts } = useEntryFacts(s.id);
  const { missingRequired } = useCompleteness(s);
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
    <div>
      <div className="mb-4 flex items-center gap-3.5 border-b border-border pb-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-accent to-accent-dark text-accent-foreground"><EyeOff className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <KindPill kind="public" />
          <h2 className="mt-0.5 truncate text-[21px] font-bold leading-tight">{row?.code_name || "Untitled"}</h2>
          <div className="truncate text-[13px] text-muted-foreground">{row ? `${row.ref_no} · ${industry} · ${row.region || "Region not set"}` : industry}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!startup && (
            <Button size="sm" variant="outline" onClick={() => void create()} disabled={actions.create.isPending}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />{row ? "Edit public view" : "Create public view"}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-9 w-9" aria-label="More"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild><Link to="/marketplace">View Marketplace</Link></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {pill}
        </div>
      </div>
      <Intro icon={<Info className="h-4 w-4" />}>
        This is your buyer preview: how your business is advertised on the Marketplace. Your name, logo, website and photos stay hidden until you approve an NDA.
      </Intro>
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
        publishBlocked={missingRequired > 0 ? `Finish ${missingRequired} required item${missingRequired === 1 ? "" : "s"} first` : null}
      />
    </div>
  );
}

/* --------------------------------- Layout --------------------------------- */

export function MyBusinessProfiles({ items: allItems }: { items: StartupListItem[] }) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [gone, setGone] = useState<string[]>([]);
  const items = allItems.filter((i) => !gone.includes(i.id));
  const [sel, setSel] = useState<{ id: string; view: View } | null>(null);
  const [editing, setEditing] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!items.length) { if (sel) setSel(null); return; }
    if (!sel || !items.some((i) => i.id === sel.id)) setSel({ id: items[0].id, view: "public" });
  }, [items, sel]);

  const current = items.find((i) => i.id === sel?.id) ?? null;
  const pick = (id: string, view: View) => { setSel({ id, view }); setEditing(false); setMobileOpen(true); };
  const closeDeleted = (id: string) => { setGone((g) => [...g, id]); setSel(null); setEditing(false); setMobileOpen(false); };

  const onItem = (k: ItemKey) => {
    if (!current) return;
    if (k === "fin") void navigate({ to: "/my-startups/$id/financials", params: { id: current.id } });
    else if (k === "terms" || k === "hidden") { setSel({ id: current.id, view: "public" }); setEditing(true); }
    else void navigate({ to: "/my-startups/$id/edit", params: { id: current.id } });
  };

  const pill = current ? <ProgressPill s={current} onItem={onItem} /> : null;

  const right = current && sel ? (
    <div className="min-w-0 rounded-[14px] border border-border bg-card p-5 shadow-sm" style={{ overflow: "visible" }}>
      {sel.view === "public" ? (
        <PublicPanel key={current.id} s={current} editing={editing} setEditing={setEditing} pill={pill} />
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between gap-3">
            <KindPill kind="private" />
            {pill}
          </div>
          <StartupDetailPanel
            key={current.id}
            id={current.id}
            showPublication
            workspace="my-startups"
            onClose={() => closeDeleted(current.id)}
            belowHeader={
              <div className="mt-3">
                <Intro icon={<Lock className="h-4 w-4" />}>Your full company details. Only buyers whose NDA you approve can see this.</Intro>
              </div>
            }
          />
        </>
      )}
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
    <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <div className="space-y-5">
        {items.map((s) => (
          <BusinessCard key={s.id} s={s} view={sel?.id === s.id ? sel.view : null} onView={(v) => pick(s.id, v)} />
        ))}
      </div>
      {!isMobile && <div className="min-w-0 lg:self-start">{right}</div>}
    </div>
  );
}
