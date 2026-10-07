import { useEffect, useMemo, useRef, useState } from "react";
import { SignupWelcome } from "@/components/my-business/signup-welcome";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Building2, Check, ChevronDown, ExternalLink, FileText, Info, LayoutList, MapPin, MoreVertical, Navigation, Pencil,
  Flag, Loader2, Plus, RefreshCw, Search, ShieldCheck, Star, X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ViewToggle, type ViewMode } from "@/components/shared/view-toggle";
import { useHasSession } from "@/hooks/use-has-session";
import { Group, Ring, Row } from "@/components/my-business/my-business-profiles";
import { StatusPill } from "@/components/marketplace/buyer-browse-card";
import { FirmCard, FirmLogo, ServiceChip, Stars, VerifiedAdvisorChip } from "@/components/advisor/advisor-firm-card";
import { createAdvisorDraft, getMapsEmbedKey, listMyAdvisorFirms, saveAdvisorServices, setAdvisorFirmStatus } from "@/lib/advisor-firm.functions";
import {
  ADVISOR_SERVICES, SERVICE_COLS, firmChecklist, fullAddress, mapQuery, mergeServiceOrder, reviewStats, serviceOf, setupProgress, advisorSkipsFor,
  type AdvisorFirm, type EditSection,
} from "@/lib/advisor-firm";
import { cn } from "@/lib/utils";

export const ADVISOR_FIRMS_KEY = ["advisor-firms", "mine"] as const;

export function useMyAdvisorFirms() {
  const fn = useServerFn(listMyAdvisorFirms);
  const enabled = useHasSession();
  return useQuery({ queryKey: ADVISOR_FIRMS_KEY, queryFn: () => fn(), enabled, staleTime: 30_000 });
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
const fmtMonth = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "");

function useOpenEdit() {
  const navigate = useNavigate();
  return (firm: string | null, section?: EditSection) =>
    navigate({ to: "/marketplace/my-company/edit", search: { ...(firm ? { firm } : { new: "1" }), ...(section ? { section } : {}) } as never });
}

/* ------------------------------- Page ------------------------------------ */

function useAddFirm() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const create = useServerFn(createAdvisorDraft);
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { id } = await create();
      await qc.invalidateQueries({ queryKey: ADVISOR_FIRMS_KEY });
      await navigate({ to: "/advisor/company/$id/setup", params: { id } });
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return { add, busy };
}

export function AdvisorMyCompany({ initialOpen }: { initialOpen?: string } = {}) {
  const { data, isLoading, refetch, isFetching } = useMyAdvisorFirms();
  const { add, busy: adding } = useAddFirm();
  const [mode, setMode] = useState<"profiles" | ViewMode>("profiles");
  const [q, setQ] = useState("");
  const [svc, setSvc] = useState("all");
  const [status, setStatus] = useState("all");
  const [sector, setSector] = useState("all");
  const [hq, setHq] = useState("all");
  const [sort, setSort] = useState<"updated" | "name">("updated");
  const [savedOnly, setSavedOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(initialOpen ?? null);

  const firms = data ?? [];
  const sectors = useMemo(() => [...new Set(firms.flatMap((f) => f.sectors))].sort(), [firms]);
  const hqs = useMemo(() => [...new Set(firms.map((f) => f.city).filter(Boolean) as string[])].sort(), [firms]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return firms
      .filter((f) => !t || [f.name, f.city, f.country, f.firmType, ...f.services].some((x) => x?.toLowerCase().includes(t)))
      .filter((f) => svc === "all" || f.services.includes(svc))
      .filter((f) => status === "all" || f.status === status)
      .filter((f) => sector === "all" || f.sectors.includes(sector))
      .filter((f) => hq === "all" || f.city === hq)
      .filter(() => !savedOnly)
      .sort((a, b) => (sort === "name" ? (a.name || "~").localeCompare(b.name || "~") : b.updatedAt.localeCompare(a.updatedAt)));
  }, [firms, q, svc, status, sector, hq, sort, savedOnly]);
  const open = list.find((f) => f.id === openId) ?? list[0] ?? null;

  return (
    <div className="space-y-5">
      <SignupWelcome role="advisor" setupDone={!!open?.setupDoneAt} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">My Company</h1>
          <p className="mt-1 text-sm text-muted-foreground">{firms.length} firm profile{firms.length === 1 ? "" : "s"} you own or manage</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className={cn("h-9 gap-1.5", savedOnly && "border-accent text-accent")} onClick={() => setSavedOnly((v) => !v)} aria-pressed={savedOnly} title="Saved">
            <Star className="h-4 w-4" /> 0
          </Button>
          <button
            type="button"
            onClick={() => setMode("profiles")}
            aria-pressed={mode === "profiles"}
            className={cn("inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold",
              mode === "profiles" ? "border-[#1E2A4A] bg-[#1E2A4A] text-white" : "border-input bg-background text-muted-foreground hover:text-foreground")}
          >
            <LayoutList className="h-3.5 w-3.5" /> Profiles
          </button>
          <ViewToggle value={mode === "profiles" ? ("none" as ViewMode) : mode} onChange={(v) => setMode(v)} />
          <Button onClick={add} disabled={adding} className="h-9 bg-accent text-accent-foreground hover:bg-accent/90">
            {adding ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />} Add Firm Profile
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search my firm profiles by name, service, city…" className="h-9 pl-9" />
        </div>
        <FilterSelect value={svc} onChange={setSvc} all="All services" options={ADVISOR_SERVICES.map((s) => s.name)} />
        <FilterSelect value={status} onChange={setStatus} all="All statuses" options={["draft", "live", "paused"]} labels={{ draft: "Draft", live: "Live", paused: "Paused" }} />
        <FilterSelect value={sector} onChange={setSector} all="Sector" options={sectors} />
        <FilterSelect value={hq} onChange={setHq} all="HQ" options={hqs} />
        <Select value={sort} onValueChange={(v) => setSort(v as "updated" | "name")}>
          <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Recently updated</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]"><Skeleton className="h-[420px]" /><Skeleton className="h-[620px]" /></div>
      ) : firms.length === 0 ? (
        <div className="rounded-[14px] border-2 border-dashed border-border p-10 text-center">
          <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <div className="mt-3 text-[16px] font-semibold">No firm profile yet</div>
          <p className="mt-1 text-sm text-muted-foreground">Add your firm so sellers and buyers can see your services, fees and team.</p>
          <Button onClick={add} disabled={adding} className="mt-4 bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="mr-1.5 h-4 w-4" /> Add Firm Profile</Button>
        </div>
      ) : list.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No firm profiles match these filters.</p>
      ) : mode === "profiles" || mode === "split" ? (
        <div className={cn("grid items-start gap-5", mode === "profiles" ? "lg:grid-cols-[320px_1fr]" : "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]")}>
          <div className="space-y-4">
            {list.map((f) => <FirmCard key={f.id} f={f} selected={open?.id === f.id} onClick={() => setOpenId(f.id)} />)}
          </div>
          {open && <FirmPanel f={open} />}
        </div>
      ) : mode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((f) => <FirmCard key={f.id} f={f} onClick={() => { setOpenId(f.id); setMode("profiles"); }} />)}
        </div>
      ) : (
        <div className="divide-y divide-border rounded-[14px] border border-border bg-card">
          {list.map((f) => (
            <button key={f.id} type="button" onClick={() => { setOpenId(f.id); setMode("profiles"); }} className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-muted/40">
              <FirmLogo f={f} size={40} radius={10} ring={false} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{f.name || "New firm profile"}</div>
                <div className="text-[13px] text-muted-foreground">{f.refNo} · {f.firmType}{f.city ? ` · ${f.city}` : ""}</div>
              </div>
              <div className="hidden flex-wrap gap-1.5 md:flex">{f.services.slice(0, 3).map((s) => <ServiceChip key={s} name={s} />)}</div>
              <StatusPill status={f.status} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterSelect({ value, onChange, all, options, labels }: { value: string; onChange: (v: string) => void; all: string; options: string[]; labels?: Record<string, string> }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-auto min-w-[8rem]"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{all}</SelectItem>
        {options.map((o) => <SelectItem key={o} value={o}>{labels?.[o] ?? o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/* ------------------------------ Checklist --------------------------------- */

function ChecklistPill({ f, onItem }: { f: AdvisorFirm; onItem: (s: EditSection) => void }) {
  const items = firmChecklist(f);
  const doneN = items.filter((i) => i.done).length;
  const pct = Math.round((doneN / items.length) * 100);
  const full = pct >= 100;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", click); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", click); document.removeEventListener("keydown", key); };
  }, [open]);
  const todo = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);
  return (
    <div ref={ref} className="relative shrink-0">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className={cn("inline-flex h-9 items-center gap-2 rounded-full border pl-1.5 pr-3 text-[13px] font-bold",
          full ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-profile-line bg-profile-soft text-profile")}>
        {full ? <span className="grid h-[26px] w-[26px] place-items-center rounded-full bg-emerald-600 text-primary-foreground"><Check className="h-3.5 w-3.5" /></span> : <Ring pct={pct} size={26} stroke={4} />}
        {pct}% <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[340px] max-w-[calc(100vw-2rem)] rounded-[14px] border border-border bg-card p-4 text-left shadow-xl">
          <div className="flex items-center justify-between text-[14px] font-bold"><span>Profile setup</span><span className="text-profile">{pct}%</span></div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", full ? "bg-emerald-600" : "bg-profile")} style={{ width: `${pct}%` }} /></div>
          {!full && <p className="mt-1.5 text-[12px] text-muted-foreground">{todo.length} item{todo.length === 1 ? "" : "s"} left before you can publish</p>}
          {todo.length > 0 && (
            <Group title="To do">
              {todo.map((i) => <Row key={i.key} label={i.label} link="Add →" circle="solid" onClick={() => { setOpen(false); onItem(i.section); }} />)}
            </Group>
          )}
          {done.length > 0 && (
            <Group title="Done">
              {done.map((i) => (
                <button key={i.key} type="button" onClick={() => { setOpen(false); onItem(i.section); }} className="flex w-full items-center gap-2 py-1 text-left text-[12.5px] text-muted-foreground">
                  <Check className="h-4 w-4 text-emerald-600" />{i.label}
                </button>
              ))}
            </Group>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------- Panel ----------------------------------- */

function Box({ title, action, onAction, children }: { title: string; action: string; onAction: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] border border-[#E5E7EB] bg-card p-4 dark:border-border">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-[.08em] text-[#6B7280]">{title}</div>
        <button type="button" onClick={onAction} className="text-[13px] font-semibold text-[#0F766E] hover:underline">{action}</button>
      </div>
      {children}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#F0F1F3] py-2 text-[13.5px] last:border-0 dark:border-border">
      <span className="shrink-0 text-[#6A7181]">{label}</span>
      <span className="min-w-0 text-right font-semibold text-[#111827] dark:text-foreground">{children || <span className="font-normal text-[#6F7B88]">Not set</span>}</span>
    </div>
  );
}

function RowTile({ icon, title, sub, right }: { icon: React.ReactNode; title: string; sub?: string | null; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-[#F0F1F3] py-2.5 last:border-0 dark:border-border">
      {icon}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold">{title}</div>
        {sub && <div className="truncate text-[12.5px] text-[#6A7181]">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export function FirmPanel({ f }: { f: AdvisorFirm }) {
  const qc = useQueryClient();
  const openEdit = useOpenEdit();
  const setStatusFn = useServerFn(setAdvisorFirmStatus);
  const [svcOpen, setSvcOpen] = useState(false);
  const [addrOpen, setAddrOpen] = useState(false);
  const svcBtn = useRef<HTMLButtonElement>(null);
  const addrBtn = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const checklist = firmChecklist(f);
  const complete = checklist.every((i) => i.done);
  const pending = f.credentials.filter((c) => c.status === "pending");
  const addr = fullAddress(f);
  const cols = SERVICE_COLS[f.services.length] ?? 2;
  const edit = (s: EditSection) => openEdit(f.id, s);
  const navigate = useNavigate();
  const inSetup = !f.setupDoneAt;
  const openSetup = () => navigate({ to: "/advisor/company/$id/setup", params: { id: f.id } });

  async function changeStatus(status: "live" | "paused") {
    setBusy(true);
    try {
      await setStatusFn({ data: { id: f.id, status } });
      await qc.invalidateQueries({ queryKey: ADVISOR_FIRMS_KEY });
      toast.success(status === "paused" ? "Listing paused. Your profile is hidden from Browse advisors." : f.status === "paused" ? "Your profile is live in Browse advisors again." : "Your profile is live in Browse advisors.");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  const statusLine = f.status === "live" ? "Live · in Browse advisors" : f.status === "draft" ? "Draft · not published" : "Paused · hidden from Browse advisors";

  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-card">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-4 border-b border-border p-5">
        <FirmLogo f={f} ring={false} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-5 items-center rounded-[6px] bg-[#E0F5F2] px-2 text-[10.5px] font-bold uppercase tracking-[.06em] text-[#0F766E]">Open to sellers and buyers</span>
            {f.verifiedAt && <VerifiedAdvisorChip small />}
          </div>
          <h2 className="mt-1 text-[21px] font-bold leading-tight">{f.name || "New firm profile"}</h2>
          <div className="text-[13px] text-[#6A7181]">{[f.refNo, f.firmType, f.city].filter(Boolean).join(" · ")}</div>
        </div>
        {!inSetup && <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => edit("firm")}><Pencil className="h-4 w-4" /> Edit profile</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-9 w-9 p-0" aria-label="More"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {f.status === "live"
                ? <DropdownMenuItem onClick={() => changeStatus("paused")}>Pause listing</DropdownMenuItem>
                : <DropdownMenuItem disabled={!complete} onClick={() => changeStatus("live")}>Publish</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
          <ChecklistPill f={f} onItem={edit} />
        </div>}
      </div>

      {inSetup ? (
        <div className="space-y-5 p-5">
          <SetupBanner f={f} onOpen={openSetup} />
          <div className="rounded-[14px] bg-[#EEF0F4] p-3.5 dark:bg-muted/50">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[.08em] text-[#6B7280]">Your card in Browse advisors</span>
              <StatusPill status="draft">Draft · not published</StatusPill>
            </div>
            <FirmCard f={f} wide />
          </div>
        </div>
      ) : <>

      <div className="space-y-5 p-5">
        <div className="flex gap-2.5 rounded-[12px] bg-[#F3F4F6] p-3.5 text-[13.5px] dark:bg-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p>Everything on your profile is <strong>open to sellers and buyers</strong> in Browse advisors, so they can compare firms and choose one: your services and fees, team and contacts, licences and documents.</p>
        </div>

        <div className="rounded-[14px] bg-[#EEF0F4] p-3.5 dark:bg-muted/50">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[.08em] text-[#6B7280]">Your card in Browse advisors</span>
            <StatusPill status={f.status}>{statusLine}</StatusPill>
          </div>
          <FirmCard f={f} wide />
        </div>

        <p className="text-[13px] text-[#4B5563] dark:text-muted-foreground">
          {f.verifiedAt ? (
            <>
              <strong className="text-[#15803D]">✓ Verified by PitchSnack on {fmtDate(f.verifiedAt)}.</strong>{" "}
              {pending.length > 0 && <>{pending.map((c) => c.name).join(", ")} {pending.length > 1 ? "are" : "is"} still waiting for a check. </>}
              A change to your licences or legal name goes back to Admin for a check.
            </>
          ) : "PitchSnack hasn't verified your firm yet. Admin checks your licences and documents."}
        </p>

        {/* Services and fees */}
        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-[.08em] text-[#6B7280]">Services and fees · {f.services.length}</div>
            <Button ref={svcBtn} variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setSvcOpen(true)}><Pencil className="h-3.5 w-3.5" /> Edit services</Button>
          </div>
          {f.services.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No services yet.</p>
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {f.services.map((s) => {
                const def = serviceOf(s);
                const fee = f.fees[s];
                return (
                  <div key={s} className="flex flex-col rounded-[12px] border border-[#CFEAE5] bg-[#F2FAF8] px-3.5 py-3 dark:bg-muted/40">
                    <div className="grid h-[34px] w-[34px] place-items-center rounded-[9px] border border-[#CFEAE5] bg-white text-[#0F766E]"><def.icon className="h-4 w-4" /></div>
                    <div className="mt-2 text-[14px] font-semibold">{s}</div>
                    <div className="text-[12.5px] text-[#6A7181]">{def.line}</div>
                    <div className="mt-auto pt-2.5">
                      <div className="border-t border-[#D3ECE7] pt-2">
                        <div className="text-[10.5px] font-bold uppercase text-[#6A7181]">Fee</div>
                        {fee ? <div className="text-[13px] font-semibold text-[#111827] dark:text-foreground">{fee}</div> : (
                          <div className="text-[13px]"><span className="text-[#6F7B88]">Not set yet</span> · <button type="button" onClick={() => edit("services")} className="font-semibold text-[#0F766E] hover:underline">Add a fee</button></div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="grid gap-3.5 md:grid-cols-2">
          <Box title="Company" action="Edit" onAction={() => edit("company")}>
            <Fact label="Founded">{f.yearFounded ? String(f.yearFounded) : null}</Fact>
            <Fact label="Legal name">{f.legalName}</Fact>
            <Fact label="Thai name">{f.thaiName}</Fact>
            <Fact label="Registration no.">{f.registrationNo}</Fact>
            <Fact label="Address">
              {addr ? (
                <button ref={addrBtn} type="button" onClick={() => setAddrOpen(true)} className="inline text-left font-semibold text-[#0F766E] underline decoration-[#9ED8CF] underline-offset-2 hover:decoration-[#0F766E]">
                  <MapPin className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />{addr}
                </button>
              ) : null}
            </Fact>
            <Fact label="Website">{f.website}</Fact>
            <Fact label="Email">{f.email}</Fact>
            <Fact label="Phone">{f.phone}</Fact>
          </Box>
          <Box title={`Team · ${f.team.length}`} action="Edit" onAction={() => edit("team")}>
            {f.team.length === 0 ? <p className="py-2 text-[13px] text-muted-foreground">No one added yet.</p> : f.team.map((t, i) => (
              <RowTile key={t.id ?? i}
                icon={<span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#E0F5F2] text-[12px] font-bold text-[#0F766E]">{t.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>}
                title={t.name} sub={[t.role, t.email].filter(Boolean).join(" · ")} />
            ))}
          </Box>
          <Box title="Licences and credentials" action="Edit" onAction={() => edit("credentials")}>
            {f.credentials.length === 0 ? <p className="py-2 text-[13px] text-muted-foreground">No licences or credentials yet. Admin checks each one you add.</p> : f.credentials.map((c, i) => (
              <RowTile key={c.id ?? i}
                icon={<span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-[#F3F4F6] text-muted-foreground"><ShieldCheck className="h-4 w-4" /></span>}
                title={c.name} sub={c.note || (c.status === "pending" ? "Waiting for a check by PitchSnack" : null)}
                right={c.status === "verified"
                  ? <span className="shrink-0 rounded-full border border-[#BBF7D0] bg-[#ECFDF3] px-2 py-0.5 text-[11.5px] font-semibold text-[#15803D]">✓ Verified</span>
                  : <span className="shrink-0 rounded-full border border-[#F3D9A6] bg-[#FFF4E0] px-2 py-0.5 text-[11.5px] font-semibold text-[#8A5A06]">Pending check</span>} />
            ))}
          </Box>
          <Box title="Documents" action="Upload" onAction={() => edit("documents")}>
            {f.documents.length === 0 ? <p className="py-2 text-[13px] text-muted-foreground">No documents yet. Upload your company certificate and licences.</p> : f.documents.map((d, i) => (
              <RowTile key={d.id ?? i}
                icon={<span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-[#F3F4F6] text-muted-foreground"><FileText className="h-4 w-4" /></span>}
                title={d.name}
                sub={[d.type, d.checkedAt ? `checked ${fmtDate(d.checkedAt)}` : d.validUntil ? `valid until ${fmtMonth(d.validUntil)}` : null].filter(Boolean).join(" · ")}
                right={d.checkedAt ? <span className="shrink-0 rounded-full border border-[#BBF7D0] bg-[#ECFDF3] px-2 py-0.5 text-[11.5px] font-semibold text-[#15803D]">✓ Checked</span> : undefined} />
            ))}
          </Box>
        </div>

        <ClientFeedback f={f} />
      </div>
      </>}

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/30 px-5 py-3.5 text-[13.5px]">
        {inSetup ? (
          <>
            <span>Draft · not visible in Browse advisors</span>
            <Button size="sm" onClick={openSetup} className="bg-[#1E2A4A] text-white hover:bg-[#1E2A4A]/90">Finish setup to publish</Button>
          </>
        ) : f.status === "live" ? (
          <>
            <span>Live in Browse advisors since {fmtDate(f.liveSince)}</span>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => changeStatus("paused")}>Pause listing</Button>
          </>
        ) : f.status === "draft" ? (
          <>
            <span>Publish your profile so sellers and buyers can find you in Browse advisors.{!complete && <> <span className="text-muted-foreground">Finish the checklist first.</span></>}</span>
            <Button size="sm" disabled={busy || !complete} title={complete ? undefined : "Complete the checklist first"} onClick={() => changeStatus("live")} className="bg-[#1E2A4A] text-white hover:bg-[#1E2A4A]/90">Publish</Button>
          </>
        ) : (
          <>
            <span>Paused. Sellers and buyers can't see your profile.</span>
            <Button variant="outline" size="sm" disabled={busy || !complete} onClick={() => changeStatus("live")}>Make live again</Button>
          </>
        )}
      </div>

      <ServicesDialog f={f} open={svcOpen} onOpenChange={(o) => { setSvcOpen(o); if (!o) setTimeout(() => svcBtn.current?.focus(), 0); }} />
      <AddressDialog f={f} open={addrOpen} onOpenChange={(o) => { setAddrOpen(o); if (!o) setTimeout(() => addrBtn.current?.focus(), 0); }} />
    </div>
  );
}

function SetupBanner({ f, onOpen }: { f: AdvisorFirm; onOpen: () => void }) {
  const { n, N } = setupProgress(f.setupAnswered, advisorSkipsFor(f));
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[14px] border border-[#B9E6DF] bg-[#EFFAF8] px-[18px] py-4 dark:border-[#1F5A52] dark:bg-[#10302C]">
      <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-white text-[#0F766E] min-[860px]:grid dark:bg-background dark:text-[#5EEAD4]"><Flag className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-bold text-[#151A28] dark:text-foreground">{n === 0 ? "Set up your firm profile" : "Finish setting up your firm profile"}</div>
        <p className="mt-0.5 text-[13px] text-[#434A5C] dark:text-muted-foreground">
          {n >= N ? `All ${N} questions are answered. Check your profile and save it, then publish it to Browse advisors.` : `Sellers and buyers can't find this firm yet. Answer ${N} short questions. It takes about 4 minutes and saves as you go.`}
        </p>
        <div className="mt-2 flex items-center gap-2.5">
          <div className="h-1.5 w-[180px] overflow-hidden rounded-full border border-[#B9E6DF] bg-white dark:border-[#1F5A52] dark:bg-background"><div className="h-full bg-[#0F766E] dark:bg-[#5EEAD4]" style={{ width: `${n * 10}%` }} /></div>
          <span className="text-[12px] font-semibold text-[#0F766E] dark:text-[#5EEAD4]">{n} of 10 answered</span>
        </div>
      </div>
      <Button onClick={onOpen} className="bg-[#1E2A4A] text-white hover:bg-[#1E2A4A]/90 max-[860px]:w-full">{n === 0 ? "Start setup →" : "Continue setup →"}</Button>
    </div>
  );
}

/* --------------------------- Edit services -------------------------------- */

export function ServiceTiles({ picked, onToggle }: { picked: string[]; onToggle: (s: string) => void }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {ADVISOR_SERVICES.map((s, i) => {
        const on = picked.includes(s.name);
        return (
          <label key={s.name} className={cn("flex cursor-pointer items-start gap-3 rounded-[12px] border p-3 transition-colors",
            on ? "border-[#0F766E] bg-[#F4FBFA] shadow-[inset_0_0_0_1px_#0F766E] dark:bg-muted/40" : "border-border hover:bg-muted/30")}>
            <input type="checkbox" checked={on} onChange={() => onToggle(s.name)} data-first={i === 0 || undefined} className="mt-2 h-[18px] w-[18px] shrink-0 accent-[#0F766E]" />
            <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] bg-[#E0F5F2] text-[#0F766E]"><s.icon className="h-4 w-4" /></span>
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold">{s.name}</span>
              <span className="block text-[12.5px] text-[#6A7181]">{s.line}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

function ServicesDialog({ f, open, onOpenChange }: { f: AdvisorFirm; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const save = useServerFn(saveAdvisorServices);
  const [picked, setPicked] = useState<string[]>(f.services);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setPicked(f.services); }, [open, f.services]);
  const toggle = (s: string) => setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  async function submit() {
    setBusy(true);
    try {
      await save({ data: { id: f.id, services: mergeServiceOrder(f.services, picked) } });
      await qc.invalidateQueries({ queryKey: ADVISOR_FIRMS_KEY });
      toast.success("Services saved.");
      onOpenChange(false);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-[8vh] max-h-[84vh] max-w-[720px] translate-y-0 gap-0 overflow-hidden p-0"
        onOpenAutoFocus={(e) => { e.preventDefault(); (document.querySelector("[data-first]") as HTMLElement | null)?.focus(); }}
      >
        <div className="border-b border-border p-5 pr-12">
          <DialogTitle className="text-[18px]">Your services</DialogTitle>
          <DialogDescription className="mt-1 text-[13.5px]">Pick what {f.name} offers. Sellers and buyers filter Browse advisors by these, and see each one with its fee on your profile.</DialogDescription>
        </div>
        <div className="max-h-[56vh] overflow-y-auto p-5"><ServiceTiles picked={picked} onToggle={toggle} /></div>
        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3.5">
          {picked.length ? <span className="text-[13.5px] font-semibold text-[#0F766E]">{picked.length} selected</span> : <span className="text-[13.5px] font-semibold text-[#B45309]">Pick at least one service.</span>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={!picked.length || busy} onClick={submit} className="bg-[#1E2A4A] text-white hover:bg-[#1E2A4A]/90">Save services</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------- Address box -------------------------------- */

function AddressDialog({ f, open, onOpenChange }: { f: AdvisorFirm; open: boolean; onOpenChange: (o: boolean) => void }) {
  const keyFn = useServerFn(getMapsEmbedKey);
  const { data } = useQuery({ queryKey: ["maps-embed-key"], queryFn: () => keyFn(), enabled: open, staleTime: Infinity });
  const q = encodeURIComponent(mapQuery(f));
  const site = f.website ? (/^https?:\/\//i.test(f.website) ? f.website : `https://${f.website}`) : null;
  const closeRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px] gap-0 p-0 [&>button.absolute]:hidden" onOpenAutoFocus={(e) => { e.preventDefault(); closeRef.current?.focus(); }}>
        <div className="flex items-center gap-3 border-b border-border p-5">
          <FirmLogo f={f} size={40} radius={10} ring={false} />
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-[17px]">{f.name}</DialogTitle>
            <DialogDescription className="text-[13px]">Address and contact</DialogDescription>
          </div>
          <button ref={closeRef} type="button" onClick={() => onOpenChange(false)} aria-label="Close" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 p-5">
          <div className="rounded-[12px] border border-border px-4 py-1">
            <Fact label="Company name">{f.legalName}</Fact>
            <Fact label="Address">{fullAddress(f)}</Fact>
            <Fact label="Website">{site ? <a href={site} target="_blank" rel="noopener noreferrer" className="text-[#0F766E] hover:underline">{f.website}</a> : null}</Fact>
            <Fact label="Phone">{f.phone ? <a href={`tel:${f.phone.replace(/\s+/g, "")}`} className="hover:underline">{f.phone}</a> : null}</Fact>
          </div>
          {data?.key && (
            <iframe
              title={`Map of ${f.name}`}
              loading="lazy"
              className="aspect-[52/22] w-full rounded-[10px] border border-[#DCE0E5]"
              src={`https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(data.key)}&q=${q}`}
            />
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" asChild><a href={`https://www.google.com/maps/dir/?api=1&destination=${q}`} target="_blank" rel="noopener noreferrer"><Navigation className="mr-1.5 h-4 w-4" /> Directions</a></Button>
            <Button asChild className="bg-[#1E2A4A] text-white hover:bg-[#1E2A4A]/90"><a href={`https://www.google.com/maps/search/?api=1&query=${q}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1.5 h-4 w-4" /> Open in Google Maps</a></Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------- Client feedback ----------------------------- */

function ClientFeedback({ f }: { f: AdvisorFirm }) {
  const [all, setAll] = useState(false);
  const { n, avg, counts } = reviewStats(f.reviews);
  const shown = all ? f.reviews : f.reviews.slice(0, 3);
  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-[.08em] text-[#6B7280]">Client feedback</div>
        {n > 3 && <button type="button" onClick={() => setAll((v) => !v)} className="text-[13px] font-semibold text-[#0F766E] hover:underline">{all ? "Show the latest 3" : `Show all ${n} reviews`}</button>}
      </div>
      {n === 0 ? (
        <p className="text-[13.5px] text-muted-foreground"><strong className="text-foreground">No reviews yet.</strong> Sellers and buyers who engage you through PitchSnack can rate you once the work is done.</p>
      ) : (
        <>
          <div className="grid gap-7 rounded-[12px] border border-[#F3E4C2] bg-[#FFFBF2] px-5 py-4 sm:grid-cols-[220px_1fr] dark:bg-muted/30">
            <div>
              <div><span className="text-[34px] font-bold">{avg.toFixed(1)}</span> <span className="text-[14px] text-[#6A7181]">out of 5</span></div>
              <Stars value={avg} size={20} gap={4} />
              <div className="mt-1 text-[12.5px] text-[#6A7181]">{n} review{n === 1 ? "" : "s"} from PitchSnack clients</div>
            </div>
            <div className="space-y-1.5">
              {[5, 4, 3, 2, 1].map((lvl) => (
                <div key={lvl} className="flex items-center gap-2 text-[12.5px]">
                  <span className="w-7 shrink-0">{lvl} <span className="text-[#F59E0B]">★</span></span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#EFE8D8]"><div className="h-full rounded-full bg-[#F59E0B]" style={{ width: `${(counts[lvl - 1] / n) * 100}%` }} /></div>
                  <span className="w-6 shrink-0 text-right">{counts[lvl - 1]}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-2">
            {shown.map((r) => (
              <div key={r.id} className="border-b border-[#F0F1F3] py-3 dark:border-border">
                <div className="flex items-center gap-2">
                  <Stars value={r.stars} />
                  <span className="text-[12.5px] text-[#6A7181]">{fmtMonth(r.at)}</span>
                  {r.service && <span className="ml-auto"><ServiceChip name={r.service} /></span>}
                </div>
                {r.comment && <p className="mt-1.5 text-[14px] text-[#1F2937] dark:text-foreground">“{r.comment}”</p>}
                <div className="mt-1 text-[12.5px] text-[#6A7181]">
                  {r.role === "seller" ? "Seller" : "Buyer"}{r.detail ? ` · ${r.detail}` : ""} <span className="ml-2 font-semibold text-[#15803D]">✓ PitchSnack client</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[12.5px] text-[#6A7181]">Only sellers and buyers who engaged you through PitchSnack can rate you, once the work is done. Reviews show the client's role and sector, never their name, and you can't edit them.</p>
        </>
      )}
    </section>
  );
}
