import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronDown, ExternalLink, FileCheck2, ImagePlus, Lock, MoreVertical, Plus, Users } from "lucide-react";
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

const na = <span className="font-normal text-[#9CA3AF]">Not added</span>;
const ticket = (a: string | null, b: string | null) => (a && b ? `${a} – ${b}` : a ? `From ${a}` : b ? `Up to ${b}` : null);
const initials = (s: string) => s.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 3).join("").toUpperCase() || "?";

function InvLogo({ d, size }: { d: BuyerInvestorData; size: number }) {
  const i = d.investor;
  return i.logo_signed_url
    ? <img src={i.logo_signed_url} alt="" className="shrink-0 rounded-[12px] border border-border object-cover" style={{ width: size, height: size }} />
    : <div className="grid shrink-0 place-items-center rounded-[12px] bg-muted text-[13px] font-bold text-muted-foreground" style={{ width: size, height: size }}>{initials(i.investor_name)}</div>;
}

function Chips({ label, items, max = 3, tone = "muted" }: { label?: string; items: string[]; max?: number; tone?: "muted" | "stage" }) {
  if (!items.length) return null;
  const shown = items.slice(0, max);
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {label && <span className="text-[11.5px] text-muted-foreground">{label}</span>}
      {shown.map((s) => (
        <span key={s} className={cn("rounded-full px-2 py-0.5 text-[11px]", tone === "stage" ? "bg-[#EEF0FF] text-[#4338CA] dark:bg-indigo-950/50 dark:text-indigo-300" : "bg-muted text-foreground/80")}>{s}</span>
      ))}
      {items.length > max && <span className="text-[11px] text-muted-foreground">+{items.length - max}</span>}
    </div>
  );
}

/** Left card body — the Investors Directory card inside the Private view folder tab. */
export function BuyerPrivateCardBody({ d }: { d: BuyerInvestorData }) {
  const i = d.investor;
  const [more, setMore] = useState(false);
  return (
    <div className="p-3">
      <div className="flex items-start gap-3">
        <InvLogo d={d} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-[14px] font-bold">{i.investor_name}</span>
            {i.investor_type && <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">{i.investor_type}</span>}
          </div>
          <div className="truncate text-[11.5px] text-muted-foreground">{i.country ?? na}</div>
          <div className="truncate text-[11.5px] text-muted-foreground">{i.aum ? `AUM ${i.aum}` : na}</div>
        </div>
      </div>
      <p className={cn("mt-2 text-[12.5px] text-muted-foreground", !more && "line-clamp-3")}>{i.short_description || na}</p>
      <Chips items={i.preferred_stages} tone="stage" max={more ? 99 : 3} />
      <Chips label="Focus:" items={i.preferred_industries} max={more ? 99 : 3} />
      <Chips label="Startups:" items={i.portfolio} max={more ? 99 : 3} />
      <button type="button" onClick={() => setMore((v) => !v)} className="mt-2 text-[12px] font-medium text-blue-600">{more ? "Show less" : "Show more"}</button>
    </div>
  );
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
    { key: "pof", label: "Proof of funds", required: false, done: !!d.pof.path },
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

function Cap({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">{children}</div>;
}
function Tags({ items }: { items: string[] }) {
  if (!items.length) return <span className="text-[12.5px] text-[#9CA3AF]">Not added</span>;
  return <div className="flex flex-wrap gap-1.5">{items.map((s) => <span key={s} className="rounded-full bg-muted px-2.5 py-0.5 text-[12px]">{s}</span>)}</div>;
}
function Empty({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-border py-3 text-[13px] font-medium text-muted-foreground hover:bg-muted">
      {icon}{label}<Plus className="h-4 w-4" />
    </button>
  );
}

/** Right panel — Private view (shared after NDA), directory detail + seller-style functions. */
export function BuyerPrivatePanel({ d }: { d: BuyerInvestorData }) {
  const i = d.investor;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const submitFn = useServerFn(submitMyBuyerForVerification);
  const [aboutMore, setAboutMore] = useState(false);
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
  const t = ticket(i.min_ticket_size, i.max_ticket_size);

  return (
    <div>
      <div className="mb-4 flex items-center gap-3.5 border-b border-border pb-4">
        <InvLogo d={d} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex rounded-full bg-[#E8F6EE] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-[#166534] dark:bg-green-950/50 dark:text-green-400">Private view · Shared after NDA</span>
            <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-bold", v.cls)}>{v.label}</span>
          </div>
          <h2 className="mt-0.5 truncate text-[21px] font-bold leading-tight">{i.investor_name}</h2>
          <div className="truncate text-[12.5px] text-muted-foreground">{[i.investor_type, i.country, i.firm_name].filter(Boolean).join(" · ") || "Add your firm details"}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
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
      </div>
      <div className="[&>div]:bg-[#F3F4F6] dark:[&>div]:bg-muted">
        <Intro icon={<Lock className="h-4 w-4 text-muted-foreground" />}>Your full firm details. Only sellers who approve your NDA can see this.</Intro>
      </div>
      {d.verification.status === "more_info" && d.verification.note && (
        <p className="mt-3 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">More info needed: {d.verification.note}</p>
      )}

      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {i.media.map((m) => (
            <div key={m.slot} className="aspect-video overflow-hidden rounded-[10px] bg-muted">{m.url && <img src={m.url} alt={`Media ${m.slot}`} className="h-full w-full object-cover" />}</div>
          ))}
          {i.media.length < 3 && (
            <button type="button" onClick={edit} className="grid aspect-video place-items-center rounded-[10px] border border-dashed border-border text-[12.5px] text-muted-foreground hover:bg-muted">
              <span className="inline-flex items-center gap-1.5"><ImagePlus className="h-4 w-4" />Add media</span>
            </button>
          )}
        </div>

        <div>
          <p className={cn("whitespace-pre-line text-[13.5px] leading-relaxed", !aboutMore && "line-clamp-4")}>{i.short_description || <span className="text-[#9CA3AF]">Not added</span>}</p>
          {(i.short_description?.length ?? 0) > 280 && <button type="button" onClick={() => setAboutMore((x) => !x)} className="text-[12.5px] font-medium text-blue-600">{aboutMore ? "Less" : "More"}</button>}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
          <span>{i.year_founded ? `Est. ${i.year_founded}` : "Est. · Not added"}</span>
          {i.investor_type && <span>{i.investor_type}</span>}
          {i.country && <span>{i.country}</span>}
          <span>{i.aum ? `AUM ${i.aum}` : "AUM · Not added"}</span>
          <span className={cn(!t && "text-[#9CA3AF]")}>{t ? `Ticket ${t}` : "Ticket size · Not added"}</span>
        </div>
        {web && <a href={web} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium text-blue-600">Website <ExternalLink className="h-3.5 w-3.5" /></a>}

        <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
          <div><Cap>Investment focus</Cap><Tags items={i.investment_focus} /></div>
          <div><Cap>Preferred stages</Cap><Tags items={i.preferred_stages} /></div>
          <div><Cap>Industries</Cap><Tags items={i.preferred_industries} /></div>
          <div><Cap>Keywords</Cap><Tags items={i.keywords} /></div>
          <div className="sm:col-span-2"><Cap>Portfolio · Startups</Cap><Tags items={i.portfolio} /></div>
        </div>

        <div className="space-y-2 border-t border-border pt-4">
          <Cap>Decision makers</Cap>
          {d.people.length ? d.people.map((m, k) => (
            <div key={k} className="flex items-center gap-3 text-[13px]">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-[11.5px] font-semibold text-muted-foreground">{initials(m.name)}</span>
              <div className="min-w-0 flex-1"><div className="truncate">{m.name}</div><div className="truncate text-[12px] text-muted-foreground">{m.role}</div></div>
              <div className="shrink-0 text-right text-[12px] text-muted-foreground"><div>{m.email}</div><div>{m.phone}</div></div>
            </div>
          )) : <Empty icon={<Users className="h-4 w-4" />} label="Add decision maker" onClick={edit} />}
        </div>
        <div className="space-y-2">
          <Cap>Proof of funds</Cap>
          {d.pof.path
            ? <div className="flex items-center gap-2 text-[13px]"><FileCheck2 className="h-4 w-4 text-emerald-600" />{d.pof.verified_at ? "Verified by PitchSnack" : "Uploaded · awaiting Admin check"}</div>
            : <Empty icon={<FileCheck2 className="h-4 w-4" />} label="Add proof of funds" onClick={edit} />}
        </div>
      </div>

      {canSubmit && (
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
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
      )}
    </div>
  );
}
