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
import { decideBuyer, getBuyerReview } from "@/lib/approvals.functions";

export const Route = createFileRoute("/_authenticated/approvals/buyers/$id")({
  head: () => ({
    meta: [
      { title: "Buyer review — Pitchsnack Admin" },
      { name: "description", content: "Verify a buyer's company, work email and LinkedIn before they can request NDAs." },
    ],
  }),
  component: BuyerReview,
});

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
const CHECKLIST = ["Company exists and is active", "Work email belongs to the company", "LinkedIn matches the person", "Mandate is plausible"];

function BuyerReview() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fn = useServerFn(getBuyerReview);
  const decideFn = useServerFn(decideBuyer);
  const { data, isLoading, error } = useQuery({ queryKey: ["approvals", "buyer", id], queryFn: () => fn({ data: { id } }) });
  const decide = useMutation({
    mutationFn: (v: { action: "verify" | "more_info" | "decline"; note?: string }) => decideFn({ data: { id, ...v } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["approvals"] }); toast.success("Decision sent"); navigate({ to: "/approvals", search: { tab: "buyers" } }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const [ask, setAsk] = useState<null | "more_info" | "decline">(null);
  const [note, setNote] = useState("");
  const [checks, setChecks] = useState<string[]>([]);
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error || !data) return <p className="text-sm text-destructive">{(error as Error)?.message ?? "Not found"}</p>;
  const { bv, profile, user, events, names } = data as any;
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email || "Buyer";
  const initials = name.split(" ").map((x: string) => x[0]).join("").slice(0, 2).toUpperCase();
  const open = bv.status === "pending" || bv.status === "more_info";
  const row = (k: string, v: React.ReactNode) => (
    <div key={k} className="flex gap-3 border-t border-border py-2 text-[13px]"><span className="w-[130px] shrink-0 text-muted-foreground">{k}</span><span className="min-w-0 break-words">{v || "—"}</span></div>
  );
  return (
    <div className="space-y-5" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <Link to="/approvals" search={{ tab: "buyers" }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Approvals</Link>
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-[14px] border border-border bg-card p-5">
        <div className="flex items-center gap-3.5">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-accent text-lg font-bold text-accent-foreground">{initials}</div>
          <div>
            <h1 className="text-2xl font-bold">{name}</h1>
            <p className="text-sm text-muted-foreground">{[profile?.title, bv.company_name, bv.buyer_type, `submitted ${fmt(bv.submitted_at)}`].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={!open} onClick={() => setAsk("decline")}>Decline</Button>
          <Button variant="outline" size="sm" disabled={!open} onClick={() => setAsk("more_info")}>Request more info</Button>
          <Button size="sm" disabled={!open || decide.isPending} onClick={() => decide.mutate({ action: "verify" })} className="bg-emerald-600 text-white hover:bg-emerald-700"><Check className="mr-1.5 h-4 w-4" />Verify buyer</Button>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-5">
          <div className="rounded-[14px] border border-border bg-card p-4">
            <div className="mb-1 text-[13px] font-bold">Buyer profile</div>
            {row("Name · title", [name, profile?.title].filter(Boolean).join(" · "))}
            {row("Company", bv.company_name)}
            {row("Type", bv.buyer_type)}
            {row("Location", profile?.location)}
            {row("Website", bv.website)}
            {row("LinkedIn", bv.linkedin)}
            {row("Work email", bv.work_email)}
            {row("Phone", profile?.phone)}
          </div>
          <div className="rounded-[14px] border border-border bg-card p-4">
            <div className="mb-1 text-[13px] font-bold">Activity</div>
            {events.map((e: any) => row(fmt(e.created_at), `${e.action.replace("_", " ")} by ${names[e.actor_id] ?? "buyer"}${e.note ? ` — ${e.note}` : ""}`))}
          </div>
        </div>
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-[14px] border border-border bg-card p-4">
            <div className="mb-1 text-[13px] font-bold">Verification checks</div>
            {row("Company registration", bv.registration_no ? `${bv.registration_no} · check against DBD` : "Not provided")}
            {row("Work email domain", bv.email_domain_match == null ? "No website to compare" : bv.email_domain_match
              ? <span className="text-emerald-700">Matches the website</span>
              : <span className="inline-flex items-center gap-1 text-amber-700"><AlertTriangle className="h-3.5 w-3.5" />Domain differs from the website</span>)}
            {row("LinkedIn", bv.linkedin ? "Provided" : "Not provided")}
            {row("Documents", bv.documents?.length ? `${bv.documents.length} file(s)` : "None")}
          </div>
          <div className="rounded-[14px] border border-border bg-card p-4">
            <div className="mb-2 text-[13px] font-bold">Reviewer checklist</div>
            {CHECKLIST.map((c) => (
              <label key={c} className="flex items-center gap-2 py-1 text-[13px]">
                <Checkbox checked={checks.includes(c)} onCheckedChange={(x) => setChecks((p) => (x ? [...p, c] : p.filter((y) => y !== c)))} />{c}
              </label>
            ))}
          </div>
          <div className="rounded-[14px] border border-border bg-muted p-4 text-[13px]">
            <div className="mb-1 font-bold">What verification unlocks</div>
            Requesting NDAs from sellers and the "Verified buyer" chip. NDA approvals stay with each seller.
          </div>
        </div>
      </div>
      {ask && (
        <Dialog open onOpenChange={(o) => !o && setAsk(null)}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogTitle>{ask === "decline" ? "Decline buyer" : "Request more info"}</DialogTitle>
            <DialogDescription>The buyer gets this note.</DialogDescription>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAsk(null)}>Cancel</Button>
              <Button disabled={!note.trim() || decide.isPending} onClick={() => decide.mutate({ action: ask, note: note.trim() })}>Send</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
