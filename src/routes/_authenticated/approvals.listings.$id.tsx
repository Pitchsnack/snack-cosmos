import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PublicListingCard } from "@/components/hidden-profile/public-listing-card";
import { SectorArt } from "@/components/hidden-profile/bits";
import { assignApproval, decideListing, getListingReview } from "@/lib/approvals.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/approvals/listings/$id")({
  head: () => ({
    meta: [
      { title: "Listing review — Pitchsnack Admin" },
      { name: "description", content: "Review a seller's Public and Private view before publishing it to the Marketplace." },
    ],
  }),
  component: ListingReview,
});

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const REASONS = ["Contains a name", "Unverifiable claim", "Wrong sector/tags", "Fact doesn't match Private view", "Other"];
const FIELDS = ["Headline", "Description", "Products & services", "Markets", "Facts", "Private view"];
const CHECKLIST = ["No identity leak", "Headline accurate", "Sector & tags right", "Revenue band matches", "No unverifiable claims"];
const STATUS: Record<string, string> = { in_review: "Waiting", changes_requested: "Changes requested", live: "Live", live_edits_pending: "Live · edits pending", rejected: "Rejected", draft: "Draft", unpublished: "Unpublished" };

function ListingReview() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fn = useServerFn(getListingReview);
  const decideFn = useServerFn(decideListing);
  const assignFn = useServerFn(assignApproval);
  const { data, isLoading, error } = useQuery({ queryKey: ["approvals", "listing", id], queryFn: () => fn({ data: { id } }) });
  const done = () => { qc.invalidateQueries({ queryKey: ["approvals"] }); };
  const decide = useMutation({
    mutationFn: (v: { id: string; action: "approve" | "request_changes" | "reject"; note?: string; reasons?: string[]; fields?: string[] }) => decideFn({ data: v }),
    onSuccess: (_r, v) => { done(); toast.success(v.action === "approve" ? "Approved and live" : v.action === "reject" ? "Rejected" : "Sent to seller"); navigate({ to: "/approvals" }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const assign = useMutation({ mutationFn: () => assignFn({ data: { kind: "listing", id } }), onSuccess: () => { done(); toast.success("Assigned to you"); } });
  const [changes, setChanges] = useState(false);
  const [reject, setReject] = useState(false);
  const [checks, setChecks] = useState<string[]>([]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error || !data) return <p className="text-sm text-destructive">{(error as Error)?.message ?? "Not found"}</p>;
  const { hp, snapshot, listing, changed, events, names } = data as any;
  const v = snapshot.private ?? {};
  const flags: string[] = snapshot.identity_flags ?? [];
  const cross: [string, string, string][] = [
    ["Company", v.registered_name || v.startup_name || "—", "Hidden"],
    ["Website", v.website_url || "—", "Hidden"],
    ["Revenue FY25", v.last_year_revenue || "—", listing.revenueBand || "—"],
    ["Founded", v.year_founded ? String(v.year_founded) : "—", v.year_founded ? `${Math.floor(v.year_founded / 10) * 10}s` : "—"],
    ["Employees", v.company_size || "—", listing.employeesBand ?? v.company_size ?? "—"],
    ["Location", v.headquarters || v.city || "—", snapshot.public?.region || "Province only"],
    ["Certifications", [...(v.regulatory_licenses ?? []), ...(v.iso_standards ?? [])].join(", ") || "—", "Same"],
  ];
  const decidable = hp.approval_status === "in_review";

  return (
    <div className="space-y-5" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <Link to="/approvals" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Approvals</Link>
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-[14px] border border-border bg-card p-5">
        <div className="flex min-w-0 items-center gap-3.5">
          <SectorArt art={hp.cover_art ?? v.sector} className="h-14 w-16 shrink-0 rounded-[10px]" />
          <div className="min-w-0">
            <div className="flex items-center gap-2"><h1 className="truncate text-2xl font-bold">{hp.code_name}</h1><Pill s={STATUS[hp.approval_status] ?? hp.approval_status} /></div>
            <p className="text-sm text-muted-foreground">
              {v.startup_name} · {hp.ref_no} · submitted {fmt(hp.submitted_at)} by {names[hp.submitted_by] ?? "seller"} (owner) · Public + Private view · version {hp.version}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => assign.mutate()} disabled={hp.assignee_id === undefined}>{hp.assignee_id ? `Assigned: ${names[hp.assignee_id] ?? "—"}` : "Assign to me"}</Button>
          <Button variant="outline" size="sm" disabled={!decidable} onClick={() => setReject(true)}>Reject</Button>
          <Button variant="outline" size="sm" disabled={!decidable} onClick={() => setChanges(true)}>Request changes</Button>
          <Button size="sm" disabled={!decidable || decide.isPending} onClick={() => decide.mutate({ id, action: "approve" })} className="bg-emerald-600 text-white hover:bg-emerald-700"><Check className="mr-1.5 h-4 w-4" />Approve & publish</Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-5">
          <div className="rounded-[14px] bg-muted p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">What buyers will see</span>
              <Pill s={STATUS[hp.approval_status] ?? hp.approval_status} />
            </div>
            <PublicListingCard l={listing} />
            {changed.length > 0 && (
              <p className="mt-3 rounded-md bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-900 dark:text-amber-200">Changed since the previous version: {changed.join(", ")}</p>
            )}
          </div>
          <div className="rounded-[14px] border border-border bg-card p-4">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Activity</div>
            {events.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
            {events.map((e: any) => (
              <div key={e.id} className="flex justify-between gap-3 border-t border-border py-2 text-[13px]">
                <span><b>{e.action.replace("_", " ")}</b>{e.version ? ` · v${e.version}` : ""} by {names[e.actor_id] ?? "—"}{e.note ? ` — ${e.note}` : ""}</span>
                <span className="shrink-0 text-muted-foreground">{fmt(e.created_at)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-[14px] border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] font-bold">Private view (submitted together)</span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-700">{cross.length} of {cross.length} match</span>
            </div>
            {cross.map(([k, a, b]) => (
              <div key={k} className="grid grid-cols-[100px_1fr_auto] items-start gap-2 border-t border-border py-2 text-[12.5px]">
                <span className="text-muted-foreground">{k}</span>
                <span className="min-w-0 break-words">{a} <span className="text-muted-foreground">→</span> <b>{b}</b></span>
                <Check className="h-4 w-4 text-emerald-600" />
              </div>
            ))}
            <Link to="/startups/$id" params={{ id: hp.startup_id }} className="mt-2 inline-block text-[12.5px] font-semibold text-primary hover:underline">Open Private view in Startups Directory →</Link>
          </div>
          <div className="rounded-[14px] border border-border bg-card p-4">
            <div className="mb-1 text-[13px] font-bold">Identity check</div>
            {flags.length === 0 ? (
              <p className="flex items-center gap-1.5 text-[12.5px] text-emerald-700"><Check className="h-4 w-4" />Clean · scanned for the company name, website, email and people's names</p>
            ) : (
              <p className="flex items-start gap-1.5 text-[12.5px] text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4" />{flags.length} flag(s): {flags.join(", ")}</p>
            )}
          </div>
          <div className="rounded-[14px] border border-border bg-card p-4">
            <div className="mb-2 text-[13px] font-bold">Reviewer checklist</div>
            {CHECKLIST.map((c) => (
              <label key={c} className="flex items-center gap-2 py-1 text-[13px]">
                <Checkbox checked={checks.includes(c)} onCheckedChange={(x) => setChecks((p) => (x ? [...p, c] : p.filter((y) => y !== c)))} />{c}
              </label>
            ))}
          </div>
        </div>
      </div>

      {changes && <RequestChangesDialog onClose={() => setChanges(false)} pending={decide.isPending} onSend={(r, f, note) => decide.mutate({ id, action: "request_changes", reasons: r, fields: f, note })} />}
      {reject && <RejectDialog onClose={() => setReject(false)} pending={decide.isPending} onSend={(note) => decide.mutate({ id, action: "reject", note })} />}
    </div>
  );
}

function Pill({ s }: { s: string }) {
  const tone = /Changes|edits/.test(s) ? "bg-amber-500/15 text-amber-800" : /^Live/.test(s) ? "bg-emerald-500/15 text-emerald-700" : /Reject/.test(s) ? "bg-red-500/15 text-red-700" : "bg-blue-500/15 text-blue-700";
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", tone)}>{s}</span>;
}

function RequestChangesDialog({ onClose, onSend, pending }: { onClose: () => void; onSend: (r: string[], f: string[], note: string) => void; pending: boolean }) {
  const [r, setR] = useState<string[]>([]);
  const [f, setF] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const toggle = (arr: string[], set: (v: string[]) => void, x: string) => set(arr.includes(x) ? arr.filter((y) => y !== x) : [...arr, x]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogTitle>Request changes</DialogTitle>
        <DialogDescription>Both views go back to the seller. The resubmission returns as a new version with what changed highlighted.</DialogDescription>
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Reasons</div>
            {REASONS.map((x) => <label key={x} className="flex items-center gap-2 py-1 text-sm"><Checkbox checked={r.includes(x)} onCheckedChange={() => toggle(r, setR, x)} />{x}</label>)}
          </div>
          <div>
            <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Fields to fix</div>
            <div className="flex flex-wrap gap-1.5">
              {FIELDS.map((x) => (
                <button key={x} type="button" onClick={() => toggle(f, setF, x)} className={cn("rounded-full border px-2.5 py-1 text-[12px] font-semibold", f.includes(x) ? "border-foreground bg-foreground text-background" : "border-border")}>{x}</button>
              ))}
            </div>
          </div>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to the seller" rows={3} maxLength={2000} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={pending || (!r.length && !note.trim())} onClick={() => onSend(r, f, note.trim())}>Send to seller</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({ onClose, onSend, pending }: { onClose: () => void; onSend: (note: string) => void; pending: boolean }) {
  const [note, setNote] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogTitle>Reject listing</DialogTitle>
        <DialogDescription>The listing stays a Draft. Tell the seller why.</DialogDescription>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason" rows={3} maxLength={2000} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={pending || !note.trim()} onClick={() => onSend(note.trim())}>Reject</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
