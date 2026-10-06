import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, ChevronDown, Eye, EyeOff, Lock, MoreVertical, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { StartupListItem } from "@/lib/startups.functions";
import { StartupDetailPanel } from "@/components/startups/startup-detail-panel";
import { StartupCard } from "@/components/startups/startup-card";
import { HiddenProfileTab } from "@/components/hidden-profile/hidden-profile-tab";
import { HiddenProfileEditor } from "@/components/hidden-profile/hidden-profile-editor";
import { useEntryFacts, useHiddenProfile, useHiddenProfileActions } from "@/hooks/use-hidden-profiles";
import { useHasFinancials } from "@/hooks/use-has-financials";
import {
  hiddenStatusOf, isStartupEntry, type HiddenDraft, type HiddenProfileRow,
} from "@/lib/hidden-profile";
import { buildPublicListing, type ListingSource } from "@/lib/public-listing";
import { TagChips } from "@/components/hidden-profile/public-listing-card";
import { useIsMobile } from "@/hooks/use-mobile";
import { runIdentityCheck } from "@/lib/hidden-profile";
import { ApprovalFooter, ApprovalNotice, ApprovedChip, APPROVAL_LABEL, APPROVAL_TONE, approvalOf } from "@/components/my-business/approval-bits";
import { cn } from "@/lib/utils";
import { SectionEditLink } from "@/components/common/edit-section";
import { useAdminReview } from "@/components/my-business/admin-review-context";
import { SectorArt } from "@/components/hidden-profile/bits";
import { DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ReportOffers, ReportHeaderAction, reportPrice } from "@/components/my-business/report-offers";

type View = "public" | "private";

/* ------------------------------ Completeness ------------------------------ */

type ItemKey = "desc" | "logo" | "fin" | "valuation" | "terms" | "hidden" | "people";
type Item = { key: ItemKey; label: string; weight: number; required: boolean; done: boolean };

function useCompleteness(s: StartupListItem) {
  const { row } = useHiddenProfile(s.id);
  const { data: facts } = useEntryFacts(s.id);
  const { hasData } = useHasFinancials(s.id);
  const tags = (s.product_tags?.length ?? 0) + (s.market_tags?.length ?? 0) + (s.industry?.length ?? 0);
  const items: Item[] = [
    { key: "desc", label: "Description & tags", weight: 20, required: false, done: !!s.short_description?.trim() && tags > 0 },
    { key: "logo", label: "Logo & photos", weight: 20, required: false, done: !!s.logo_signed_url && !!s.tile_image_signed_url },
    { key: "fin", label: `Verified financial report ${reportPrice("financials")}`, weight: 0, required: false, done: false },
    { key: "valuation", label: `Estimated valuation ${reportPrice("valuation")}`, weight: 0, required: false, done: false },
    { key: "terms", label: "Deal terms", weight: 20, required: true, done: !!row && row.stake_pct != null && !!row.deal_type },
    { key: "hidden", label: "Public headline", weight: 25, required: true, done: !!row && !!row.headline?.trim() },
    { key: "people", label: "Key people & customers", weight: 15, required: false, done: (facts?.people?.length ?? 0) > 0 && (facts?.customers?.length ?? 0) > 0 },
  ];
  const pct = items.reduce((a, i) => a + (i.done ? i.weight : 0), 0);
  return { items, pct, missingRequired: items.filter((i) => i.required && !i.done).length, hasData };
}

export function Ring({ pct, size, stroke = 5, done }: { pct: number; size: number; stroke?: number; done?: boolean }) {
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
  fin: { cta: "Verified financial report", link: "View →", help: "Optional analyst-verified FY23–25 report, available to buyers after the NDA." },
  valuation: { cta: "Estimated valuation", link: "View →", help: "Optional independent valuation, after the verified financial report." },
  terms: { cta: "Set deal terms", link: "Set →", help: "Stake, deal type and asking price shown in your public view." },
  hidden: { cta: "Write public headline", link: "Write →", help: "One line buyers read first. No company or product names." },
  desc: { cta: "Add description", link: "Add →", help: "A short description and tags for your company." },
  logo: { cta: "Add logo & photos", link: "Add →", help: "Shown only after you approve an NDA." },
  people: { cta: "Add people & customers", link: "Add →", help: "Key people and customers, names after the NDA." },
};

function ProgressPill({ s, onItem }: { s: StartupListItem; onItem: (k: ItemKey) => void }) {
  const { items, pct, missingRequired, hasData } = useCompleteness(s);
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
  const next = req[0] ?? items.find((i) => !i.done && i.key !== "fin" && i.key !== "valuation");
  const restReq = req.filter((i) => i !== next);
  const recommended = items.filter((i) => i.key === "fin" || i.key === "valuation");
  const opt = items.filter((i) => !i.required && !i.done && i !== next && !recommended.includes(i));
  const done = items.filter((i) => i.done && !recommended.includes(i));
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
          {!full && <p className="mt-1.5 text-[12px] text-muted-foreground">{missingRequired} required item{missingRequired === 1 ? "" : "s"} before you can submit</p>}

          {!full && next && (
            <div className="mt-3 rounded-[10px] border border-profile-line bg-profile-soft p-3">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-profile">Next step</div>
              <div className="mt-1 text-[13.5px] font-bold">{HELP[next.key].cta}</div>
              <p className="mt-0.5 text-[12px] text-muted-foreground">{HELP[next.key].help}</p>
              <button type="button" onClick={() => go(next.key)} className="mt-2 inline-flex h-8 items-center rounded-lg bg-profile px-3 text-[12.5px] font-semibold text-primary-foreground hover:opacity-90">{HELP[next.key].cta}</button>
            </div>
          )}

          {!full && restReq.length > 0 && (
            <Group title="Required">
              {restReq.map((i) => <Row key={i.key} label={i.label} link={HELP[i.key].link} onClick={() => go(i.key)} circle="solid" />)}
            </Group>
          )}
          <Group title="Recommended">
            {recommended.map((i) => <Row key={i.key} label={i.label} link="View →" onClick={() => go(i.key)} circle="dashed" />)}
          </Group>
          {hasData && <p className="mt-1 text-[11px] text-muted-foreground">Your own figures: Provided by seller, not verified.</p>}
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

export function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

export function Row({ label, link, onClick, circle }: { label: string; link: string; onClick: () => void; circle: "solid" | "dashed" }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2 py-1.5 text-left text-[13px]">
      <span className={cn("h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/40", circle === "dashed" && "border-dashed")} />
      <span className="flex-1">{label}</span>
      <span className="text-[12.5px] font-semibold text-profile">{link}</span>
    </button>
  );
}

/* --------------------------- Left: tabbed card ---------------------------- */

export function FolderTab({ active, open, side, icon, title, sub, tone, onClick }: {
  active: boolean; open?: boolean; side: "left" | "right"; icon: React.ReactNode; title: string; sub: string; tone: "indigo" | "green"; onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "absolute flex items-center overflow-hidden rounded-t-[12px] border border-b-0 text-left transition-[width,height,background-color] duration-200 ease-in-out",
        side === "left" ? "left-0" : "right-0",
        active
          ? cn("bottom-[-1px] z-[2] h-[59px] w-[56%] gap-2.5 bg-card px-4 text-foreground",
              open ? "border-accent" : "border-border",
              side === "left" ? "shadow-[7px_0_8px_-7px_rgba(16,24,40,.16)]" : "shadow-[-7px_0_8px_-7px_rgba(16,24,40,.16)]")
          : cn("bottom-0 z-[1] h-[52px] w-[50%] gap-2 border-[#E1E4EA] bg-[#ECEEF2] text-[#6B7385] hover:bg-[#E4E7EC] dark:border-border dark:bg-muted dark:text-muted-foreground",
              side === "right" ? "pl-[calc(6%+12px)] pr-[14px]" : "pl-[14px] pr-[calc(6%+12px)]"),
      )}
    >
      {icon}
      <span className="min-w-0">
        <span className={cn("block truncate whitespace-nowrap text-[14px] leading-tight", active ? "font-bold" : "font-semibold")}>{title}</span>
        {active && (
          <span className={cn("mt-px block truncate whitespace-nowrap text-[11.5px] leading-snug",
            tone === "indigo" ? "text-indigo-700 dark:text-indigo-300" : "text-green-800 dark:text-green-400")}>{sub}</span>
        )}
      </span>
    </button>
  );
}

export function RowLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-border py-1.5 text-[12.5px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-medium">{children}</span>
    </div>
  );
}

function PublicCardBody({ s, row }: { s: StartupListItem; row: HiddenProfileRow | null }) {
  const status = hiddenStatusOf(row, s.company_type);
  const d = row as HiddenDraft | null;
  const industry = s.sector || s.industry?.[0] || "SME";
  const listing = buildPublicListing(s as ListingSource, row ? { ...row, live: status === "live" || status === "live_edited" } : null, false);
  const live = status === "live" || status === "live_edited";
  const adminReview = useAdminReview();
  const cover = adminReview ? adminReview.pendingCover : row?.live ? row?.cover_image_url ?? null : null;
  const ap = approvalOf(row);
  const badge = (
    <span className={cn("absolute left-2.5 top-2.5 z-10 rounded-full bg-background/90 px-2 py-0.5 text-[10.5px] font-bold", row ? APPROVAL_TONE[ap] : "bg-amber-500/15 text-amber-700 dark:text-amber-400")}>
      {row ? (ap === "live_edits_pending" ? "Live · edits pending" : APPROVAL_LABEL[ap]) : "Preview"}
    </span>
  );
  return (
    <>
      <SectorArt art={d?.cover_art ?? s.sector ?? s.industry?.[0]} sector={s.sector} imageId={(row as { public_image_id?: string | null } | null)?.public_image_id ?? null} className="h-[120px] w-full rounded-none">
        {badge}
      </SectorArt>
      <div className="px-3 pb-3">
        <div className="pt-2.5">
          <div className="truncate text-[14px] font-bold">{d?.code_name || listing.headline || "Public view"}</div>
        </div>
        <div className="mt-1 truncate text-[11.5px] text-muted-foreground">{[row?.ref_no, industry, d?.region].filter(Boolean).join(" · ")}</div>
        <p className="mb-2 mt-1.5 line-clamp-2 text-[12.5px] text-muted-foreground">{listing.headline || listing.description || <em>No description yet</em>}</p>
        <RowLine label="Revenue">
          {listing.revenueBand ? <>{listing.revenueBand} <span className="ml-1 rounded bg-[#EEF0FF] px-1 py-0.5 text-[9.5px] font-semibold text-[#4338CA]">Range</span></> : "—"}
        </RowLine>
        <div className="space-y-1.5 border-t border-border pt-2">
          <div><div className="mb-0.5 text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">Products & services</div><TagChips tags={listing.productTags.slice(0, 4)} /></div>
          <div><div className="mb-0.5 text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">Markets</div><TagChips tags={listing.marketTags.slice(0, 4)} green /></div>
        </div>
      </div>
    </>
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
      <div role="tablist" className="relative z-10 h-[58px]">
        <FolderTab side="left" active={v === "public"} icon={<Eye className="h-4 w-4 shrink-0" />} title="Public view" sub="Buyer preview" open={selected} tone="indigo" onClick={() => pick("public")} />
        <FolderTab side="right" active={v === "private"} icon={<Lock className="h-4 w-4 shrink-0" />} title="Private view" sub="Shared after NDA" open={selected} tone="green" onClick={() => pick("private")} />
      </div>
      {v === "public" ? (
        <div role="button" tabIndex={0} onClick={() => pick("public")} onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) pick("public"); }} className={cn("cursor-pointer overflow-hidden rounded-b-[14px] rounded-t-none border bg-card transition-shadow hover:shadow-md [&_.rounded-t-xl]:rounded-t-none", selected ? "border-accent" : "border-border")}>
          <PublicCardBody s={s} row={row} />
        </div>
      ) : (
        <div className={cn("overflow-hidden rounded-b-[14px] rounded-t-none border bg-card [&_.rounded-t-xl]:rounded-t-none [&>button]:rounded-none [&>button]:border-0 [&>button]:shadow-none", selected ? "border-accent" : "border-border")}>
          <StartupCard s={s} onClick={() => pick("private")} />
        </div>
      )}
    </div>
  );
}

export function Intro({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-[10px] bg-muted px-3 py-2.5 text-[13px] leading-relaxed text-foreground/80">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}



function KindPill({ kind, row }: { kind: View; row?: HiddenProfileRow | null }) {
  return <span className="inline-flex flex-wrap items-center gap-2"><KindLabel kind={kind} /><ApprovedChip row={row} /></span>;
}

function KindLabel({ kind }: { kind: View }) {
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
  const { hasData: hasFinancials } = useHasFinancials(s.id);
  const actions = useHiddenProfileActions();
  const [publishOnOpen, setPublishOnOpen] = useState(false);
  const industry = s.sector || s.industry?.[0] || "—";
  const startup = isStartupEntry(s.company_type);
  const adminReview = useAdminReview();
  void startup;

  const create = async () => {
    if (!row) {
      try { await actions.create.mutateAsync({ startupId: s.id }); } catch { return; }
    }
    setEditing(true);
  };

  if (editing && row) {
    return (
      <HiddenProfileEditor
        row={row}
        facts={facts}
        source={{ ...(s as unknown as ListingSource), people: facts?.people ?? [] }}
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
          <KindPill kind="public" row={row} />
          <h2 className="mt-0.5 truncate text-[21px] font-bold leading-tight">{row?.code_name || "Public view"}</h2>
          <div className="truncate text-[13px] text-muted-foreground">{row ? `${row.ref_no} · ${industry} · ${row.region || "Region not set"}` : industry}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {adminReview ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline"><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit as Admin<ChevronDown className="ml-1 h-3.5 w-3.5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuItem onClick={() => void create()}>Edit public view <span className="ml-auto text-[11px] text-muted-foreground">headline, description, chips</span></DropdownMenuItem>
                <DropdownMenuItem onClick={adminReview.onEditPrivate}>Edit private view <span className="ml-auto text-[11px] text-muted-foreground">NDA details</span></DropdownMenuItem>
                <DropdownMenuItem onClick={adminReview.onSetImage}>Set public image <span className="ml-auto text-[11px] text-muted-foreground">admin only</span></DropdownMenuItem>
                <DropdownMenuItem onClick={adminReview.onEditMedia}>Change logo & private photos</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem checked={adminReview.notify} onCheckedChange={(v) => adminReview.onToggleNotify(!!v)} onSelect={(e) => e.preventDefault()}>Notify seller of admin changes</DropdownMenuCheckboxItem>
                <DropdownMenuLabel className="cursor-pointer text-[12px] font-medium text-muted-foreground" onClick={adminReview.onShowEdits}>
                  {adminReview.editsCount} admin edit{adminReview.editsCount === 1 ? "" : "s"} on this version · view / undo
                </DropdownMenuLabel>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
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
      <HiddenProfileTab
        name={s.startup_name}
        companyType={s.company_type}
        row={row}
        facts={facts}
        industry={industry}
        showMarkers
        source={s as ListingSource}
        hasFinancials={hasFinancials}
        onPart={(k) => void navigate({ to: "/my-startups/$id/edit", params: { id: s.id }, search: { section: k === "chips" ? "tags" : k === "employees" ? "size" : "revenue" } as never })}
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

/** Checklist item → Edit My Startup section (shared Edit-at-section helper). */
const ITEM_SECTION: Partial<Record<string, string>> = { desc: "description", logo: "media", people: "founders" };

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
    if (k === "fin" || k === "valuation") { setSel({ id: current.id, view: "private" }); setEditing(false); requestAnimationFrame(() => document.getElementById(`reports-${current.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })); }
    else if (k === "terms" || k === "hidden") { setSel({ id: current.id, view: "public" }); setEditing(true); }
    else void navigate({ to: "/my-startups/$id/edit", params: { id: current.id }, search: (ITEM_SECTION[k] ? { section: ITEM_SECTION[k] } : {}) as never });
  };

  const adminReview = useAdminReview();
  const pill = current ? <ProgressPill s={current} onItem={onItem} /> : null;

  const right = current && sel ? (
    <div className="min-w-0 rounded-[14px] border border-border bg-card p-5 shadow-sm" style={{ overflow: "visible" }}>
      {!adminReview && !(editing && sel.view === "public") && (
        <PanelNotice s={current} onEditPublic={() => { setSel({ id: current.id, view: "public" }); setEditing(true); }} />
      )}
      {sel.view === "public" ? (
        <PublicPanel key={current.id} s={current} editing={editing} setEditing={setEditing} pill={pill} />
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between gap-3">
            <PrivateKindPill id={current.id} />
            {pill}
          </div>
          <StartupDetailPanel
            key={current.id}
            id={current.id}
            showPublication
            workspace="my-startups"
             afterFounders={!adminReview && <ReportOffers id={current.id} />}
             sectionEdit={adminReview ? undefined : (k) => (
               <SectionEditLink tone="seller" label={k === "founders-add" ? "Add founder" : "Edit"}
                 onClick={() => void navigate({ to: "/my-startups/$id/edit", params: { id: current.id }, search: { section: k === "photos" ? "media" : k } as never })} />
             )}
             financialsHeaderAction={!adminReview ? <ReportHeaderAction id={current.id} /> : undefined}
            onClose={() => closeDeleted(current.id)}
            belowHeader={
              <div className="mt-3">
                <Intro icon={<Lock className="h-4 w-4" />}>Your full company details. Only buyers whose NDA you approve can see this.</Intro>
              </div>
            }
          />
        </>
      )}
      {!adminReview && !(editing && sel.view === "public") && (
        <PanelFooter s={current} onItem={(k) => (k === "private" ? navigate({ to: "/my-startups/$id/edit", params: { id: current.id } }) : onItem(k as ItemKey))} />
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

function PanelNotice({ s, onEditPublic }: { s: StartupListItem; onEditPublic: () => void }) {
  const { row } = useHiddenProfile(s.id);
  return <ApprovalNotice row={row} onEditPublic={onEditPublic} />;
}

function PanelFooter({ s, onItem }: { s: StartupListItem; onItem: (k: string) => void }) {
  const { row } = useHiddenProfile(s.id);
  const { data: facts } = useEntryFacts(s.id);
  const { items } = useCompleteness(s);
  const actions = useHiddenProfileActions();
  const missing = items.filter((i) => i.required && !i.done).map((i) => ({ key: i.key, label: i.label }));
  const flagged = row && facts ? runIdentityCheck(row as HiddenDraft, facts).length : 0;
  return (
    <ApprovalFooter
      startupId={s.id}
      row={row}
      missing={missing}
      flagged={flagged}
      onItem={onItem}
      onCreate={() => actions.create.mutate({ startupId: s.id })}
    />
  );
}

function PrivateKindPill({ id }: { id: string }) {
  const { row } = useHiddenProfile(id);
  return <KindPill kind="private" row={row} />;
}
