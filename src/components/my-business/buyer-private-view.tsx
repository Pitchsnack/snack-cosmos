import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronDown, Eye, ImagePlus, Lock, MoreVertical, Plus, Users } from "lucide-react";
import { InvestorListItem } from "@/components/investors/investor-list-item";
import { InvestorDetailPanel, Section, type InvestorDetail } from "@/components/investors/investor-detail-panel";
import type { InvestorListItem as InvestorListItemDTO } from "@/lib/investors.functions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Group, Intro, Ring, Row } from "@/components/my-business/my-business-profiles";
import { getMyBuyerInvestor, submitMyBuyerForVerification } from "@/lib/buyer-investor.functions";
import { BUYER_INVESTOR_KEY } from "@/components/my-business/buyer-investor-edit";
import { cn } from "@/lib/utils";

export type BuyerInvestorData = Awaited<ReturnType<typeof getMyBuyerInvestor>>;

export function useBuyerInvestor() {
  const fn = useServerFn(getMyBuyerInvestor);
  return useQuery({ queryKey: BUYER_INVESTOR_KEY, queryFn: () => fn(), staleTime: 30_000 });
}

const initials = (s: string) => s.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 3).join("").toUpperCase() || "?";

/** Directory list-item DTO from the buyer's own investor record. */
function toListItem(d: BuyerInvestorData) {
  const i = d.investor;
  return {
    ...i,
    ticket_size: null,
    related_startups: i.portfolio_links,
  } as unknown as InvestorListItemDTO;
}

function toDetail(d: BuyerInvestorData): InvestorDetail {
  const i = d.investor;
  return {
    ...i,
    ticket_size: null,
    long_description: null,
    status: null,
    visibility: null,
    media: i.media.map((m) => ({ slot: m.slot, image_signed_url: m.url })),
    linked_startups: i.portfolio_links.map((x) => ({ id: x.id, startup_name: x.name, logo_signed_url: null })),
    portfolio_investors: [],
  };
}

export function BuyerStatusBadge({ status }: { status: string }) {
  const live = status === "live";
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-bold",
      live ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-400")}>
      {live ? "Live" : "Draft"}
    </span>
  );
}

/** Left card — the Investors Directory's own list card, with the status badge instead of the bookmark. */
export function BuyerPrivateCardBody({ d, status = "draft", selected = false, onSelect }: { d: BuyerInvestorData; status?: string; selected?: boolean; onSelect?: () => void }) {
  return <InvestorListItem i={toListItem(d)} selected={selected} onSelect={onSelect ?? (() => {})} badge={<BuyerStatusBadge status={status} />} />;
}

type Item = { key: string; label: string; required: boolean; done: boolean };
export function privateChecklist(d: BuyerInvestorData): Item[] {
  const i = d.investor;
  return [
    { key: "ticket", label: "Ticket size", required: true, done: !!(i.min_ticket_size || i.max_ticket_size) },
    { key: "about", label: "About Company", required: true, done: !!i.short_description?.trim() },
    { key: "aum", label: "Fund's AUM", required: true, done: !!i.aum?.trim() },
    { key: "logo", label: "Logo", required: false, done: !!i.logo_path },
    { key: "web", label: "Company URL", required: false, done: !!i.website_url },
    { key: "focus", label: "Industries & stages", required: false, done: i.preferred_industries.length > 0 && i.preferred_stages.length > 0 },
    { key: "people", label: "Decision makers", required: false, done: d.people.length > 0 },
  ];
}

function Pill({ d, onEdit }: { d: BuyerInvestorData; onEdit: () => void }) {
  const items = privateChecklist(d);
  const pct = Math.round((items.filter((x) => x.done).length / items.length) * 100);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const c = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", c);
    return () => document.removeEventListener("mousedown", c);
  }, [open]);
  const req = items.filter((x) => x.required && !x.done);
  const opt = items.filter((x) => !x.required && !x.done);
  const done = items.filter((x) => x.done);
  const full = pct >= 100;
  return (
    <div ref={ref} className="relative shrink-0">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className={cn("inline-flex h-9 items-center gap-2 rounded-full border pl-1.5 pr-3 text-[13px] font-bold",
          full ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400" : "border-profile-line bg-profile-soft text-profile")}>
        {full ? <span className="grid h-[26px] w-[26px] place-items-center rounded-full bg-emerald-600 text-primary-foreground"><Check className="h-3.5 w-3.5" /></span> : <Ring pct={pct} size={26} stroke={4} />}
        {pct}%<ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[320px] max-w-[calc(100vw-2rem)] rounded-[14px] border border-border bg-card p-4 text-left shadow-xl">
          <div className="flex items-center justify-between text-[14px] font-bold"><span>Profile setup</span><span className="text-profile">{pct}%</span></div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", full ? "bg-emerald-600" : "bg-profile")} style={{ width: `${pct}%` }} /></div>
          {req.length > 0 && <p className="mt-1.5 text-[12px] text-muted-foreground">{req.length} required item{req.length === 1 ? "" : "s"} before you can submit for verification</p>}
          {req.length > 0 && <Group title="Required">{req.map((x) => <Row key={x.key} label={x.label} link="Add →" onClick={() => { setOpen(false); onEdit(); }} circle="solid" />)}</Group>}
          {opt.length > 0 && <Group title="Optional">{opt.map((x) => <Row key={x.key} label={x.label} link="Add →" onClick={() => { setOpen(false); onEdit(); }} circle="dashed" />)}</Group>}
          {done.length > 0 && <div className="mt-3 space-y-1">{done.map((x) => <div key={x.key} className="flex items-center gap-2 py-0.5 text-[12.5px] text-muted-foreground"><Check className="h-4 w-4 text-emerald-600" />{x.label}</div>)}</div>}
        </div>
      )}
    </div>
  );
}

const V_CHIP = {
  none: { label: "Not verified yet", cls: "bg-muted text-muted-foreground" },
  pending: { label: "Pending verification", cls: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" },
  verified: { label: "✓ Verified buyer", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
  more_info: { label: "More info needed", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  declined: { label: "Not verified yet", cls: "bg-muted text-muted-foreground" },
} as const;

/** Right panel — the Investors Directory detail panel with the buyer options on. */
export function BuyerPrivatePanel({ d, view = "private", onView }: { d: BuyerInvestorData; view?: "public" | "private"; onView?: (v: "public" | "private") => void }) {
  const i = d.investor;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const submitFn = useServerFn(submitMyBuyerForVerification);
  const edit = () => navigate({ to: "/marketplace/my-company/edit" });
  const v = V_CHIP[d.verification.status];
  const req = privateChecklist(d).filter((x) => x.required && !x.done);
  const submit = useMutation({
    mutationFn: () => submitFn(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: BUYER_INVESTOR_KEY }); qc.invalidateQueries({ queryKey: ["my-verification"] }); toast.success("Submitted for verification"); },
    onError: (e) => toast.error((e as Error).message),
  });
  const web = i.website_url ? (i.website_url.startsWith("http") ? i.website_url : `https://${i.website_url}`) : null;
  const canSubmit = d.verification.status === "none" || d.verification.status === "more_info" || d.verification.status === "declined";

  const topBar = (
    <div className="-mx-5 -mt-5 mb-1 flex items-center gap-2 border-b border-border px-5 py-3">
      {onView && (
        <div role="tablist" className="flex gap-1">
          <Button role="tab" aria-selected={view === "public"} variant={view === "public" ? "secondary" : "ghost"} size="sm" onClick={() => onView("public")}><Eye className="mr-2 h-4 w-4" />Public view</Button>
          <Button role="tab" aria-selected={view === "private"} variant={view === "private" ? "secondary" : "ghost"} size="sm" onClick={() => onView("private")}><Lock className="mr-2 h-4 w-4" />Private view</Button>
        </div>
      )}
      <span className="flex-1" />
      <Button variant="outline" size="sm" className="h-9" onClick={edit}>Edit profile</Button>
      <Pill d={d} onEdit={edit} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9" aria-label="More"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={edit}>Edit profile</DropdownMenuItem>
          {web && <DropdownMenuItem onClick={() => window.open(web, "_blank", "noopener")}>Open website</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
  const chips = (
    <>
      <span className="inline-flex rounded-full bg-[#E8F6EE] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#166534] dark:bg-green-950/50 dark:text-green-400">Private view · Shared after NDA</span>
      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold", v.cls)}>{v.label}</span>
    </>
  );
  const intro = (
    <>
      <div className="[&>div]:bg-[#F3F4F6] dark:[&>div]:bg-muted">
        <Intro icon={<Lock className="h-4 w-4 text-muted-foreground" />}>Your full firm details. Only sellers who approve your NDA can see this.</Intro>
      </div>
      {d.verification.status === "more_info" && d.verification.note && (
        <p className="rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">More info needed: {d.verification.note}</p>
      )}
    </>
  );
  const mediaAdd = (
    <button type="button" onClick={edit} className="grid aspect-video place-items-center rounded-lg border border-dashed border-border text-[12.5px] text-muted-foreground hover:bg-muted">
      <span className="inline-flex items-center gap-1.5"><ImagePlus className="h-4 w-4" />Add media</span>
    </button>
  );
  const afterPortfolio = (
    <Section icon={Users} title="Decision makers">
      {d.people.length ? <div className="space-y-2">{d.people.map((m, k) => (
        <div key={k} className="flex items-center gap-3 text-[13px]">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-[11.5px] font-semibold text-muted-foreground">{initials(m.name)}</span>
          <div className="min-w-0 flex-1"><div className="truncate">{m.name}</div><div className="truncate text-[12px] text-muted-foreground">{m.role}</div></div>
          <div className="shrink-0 text-right text-[12px] text-muted-foreground"><div>{m.email}</div><div>{m.phone}</div></div>
        </div>
      ))}</div> : (
        <button type="button" onClick={edit} className="flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-border py-3 text-[13px] font-medium text-muted-foreground hover:bg-muted">
          <Users className="h-4 w-4" />Add decision maker<Plus className="h-4 w-4" />
        </button>
      )}
    </Section>
  );
  const footer = canSubmit ? (
    <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
      <span className="text-[12.5px] text-muted-foreground">
        {req.length
          ? <>{req.length} required item{req.length === 1 ? "" : "s"} before you can submit for verification: {req.map((x, k) => <span key={x.key}>{k > 0 && " · "}<button type="button" onClick={edit} className="font-medium text-blue-600">{x.label}</button></span>)}</>
          : "Ready to submit. Admin usually reviews within 1 business day."}
      </span>
      <span className="flex-1" />
      <Button disabled={req.length > 0 || submit.isPending} onClick={() => submit.mutate()} className="bg-accent text-accent-foreground hover:bg-accent/90">
        {submit.isPending ? "Submitting…" : "Submit for verification"}
      </Button>
    </div>
  ) : null;

  return (
    <InvestorDetailPanel
      id={i.id}
      onSelectStartup={() => {}}
      buyer={{ data: toDetail(d), topBar, chips, intro, mediaAdd, afterPortfolio, footer }}
    />
  );
}
