import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, CircleCheck, Clock, ExternalLink, FileCheck2, Pencil, Send, ShieldCheck, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DECISION_REASONS, decideOneStep, listOneStepApprovals, markReviewCheck } from "@/lib/approvals-one-step.functions";
import type { OneStepItem, OneStepKind, ReviewRow } from "@/lib/one-step.server";
import { cn } from "@/lib/utils";
import { DbdStorePanel } from "./dbd-store-panel";

/**
 * Admin › Approvals: the one-step review. One decision verifies the company
 * and publishes the listing/profile together, for sellers, buyers and advisors.
 */

const KEY = ["one-step-approvals"];
const fmtD = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
const waiting = (iso?: string | null) => {
  if (!iso) return "";
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  return h < 24 ? `${h}h waiting` : `${Math.floor(h / 24)}d waiting`;
};

const RESULT_TONE: Record<ReviewRow["result"], string> = {
  match: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  differs: "bg-red-500/15 text-red-700 dark:text-red-400",
  by_hand: "bg-amber-500/15 text-amber-800 dark:text-amber-400",
  not_needed: "bg-muted text-muted-foreground",
  not_given: "bg-muted text-muted-foreground",
};
const RESULT_LABEL: Record<ReviewRow["result"], string> = {
  match: "Match", differs: "Differs", by_hand: "Check by hand", not_needed: "Not needed", not_given: "Not given",
};

export function useOneStepApprovals() {
  const fn = useServerFn(listOneStepApprovals);
  return useQuery({ queryKey: KEY, queryFn: () => fn(), staleTime: 15_000 });
}

export function OneStepApprovals({ kind, openId, onOpen }: { kind: OneStepKind; openId?: string; onOpen?: (id: string | undefined) => void }) {
  const { data, isLoading, error } = useOneStepApprovals();
  const items = (data?.[kind === "seller" ? "sellers" : kind === "buyer" ? "buyers" : "advisors"] ?? []) as OneStepItem[];
  const [sel, setSel] = useState<string | null>(openId ?? null);
  useEffect(() => { if (openId !== undefined) setSel(openId ?? null); }, [openId]);
  const current = items.find((i) => i.id === sel) ?? null;
  const pick = (id: string | null) => { setSel(id); onOpen?.(id ?? undefined); };

  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!items.length) return <p className="rounded-[12px] border border-border bg-card p-8 text-center text-sm text-muted-foreground">Nothing waiting here.</p>;

  return (
    <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className="space-y-2.5">
        {items.map((i) => (
          <button key={i.id} type="button" onClick={() => pick(i.id)}
            className={cn("w-full rounded-[12px] border bg-card p-3.5 text-left transition-colors", sel === i.id ? "border-[#F6A823] shadow-sm" : "border-border hover:border-[#CBD2DC]")}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">{i.ref}</span>
              {i.chip === "sent_back"
                ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10.5px] font-bold text-amber-800 dark:text-amber-400"><TriangleAlert className="h-3 w-3" />Sent back</span>
                : <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10.5px] font-bold text-blue-700 dark:text-blue-400"><Clock className="h-3 w-3" />{waiting(i.submittedAt)}</span>}
            </div>
            <div className="mt-1 truncate text-[14.5px] font-semibold">{i.name}</div>
            <div className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{[i.type, i.place].filter(Boolean).join(" · ") || "—"}</div>
            {i.person && <div className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{i.person}</div>}
          </button>
        ))}
      </div>
      <div className="min-w-0 lg:self-start">
        {current ? <ReviewPanel key={current.id} item={current} onDone={() => pick(null)} /> : (
          <div className="grid place-items-center rounded-[14px] border border-dashed border-border bg-card/50 p-16 text-center text-sm text-muted-foreground">
            Choose a {kind === "seller" ? "listing" : kind === "buyer" ? "buyer" : "firm"} on the left to review it.
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewPanel({ item, onDone }: { item: OneStepItem; onDone: () => void }) {
  const qc = useQueryClient();
  const decide = useServerFn(decideOneStep);
  const mark = useServerFn(markReviewCheck);
  const [name, setName] = useState(item.publishedName ?? item.suggestedName ?? "");
  const [headline, setHeadline] = useState(item.publishedHeadline ?? item.suggestedHeadline ?? "");
  const [dialog, setDialog] = useState<"request_changes" | "decline" | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const r = item.review;

  const act = useMutation({
    mutationFn: (v: { action: "approve" | "request_changes" | "decline"; reasons?: string[]; note?: string }) =>
      decide({ data: { kind: item.kind, id: item.id, action: v.action, publishedName: name, publishedHeadline: headline, reasons: v.reasons, note: v.note } }),
    onSuccess: (_d, v) => {
      toast.success(v.action === "approve" ? "Verified and published." : v.action === "request_changes" ? "Sent back for changes." : "Declined.");
      setDialog(null); setReasons([]); setNote("");
      void qc.invalidateQueries({ queryKey: KEY });
      void qc.invalidateQueries({ queryKey: ["approvals"] });
      onDone();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const check = useMutation({
    mutationFn: (row: string) => mark({ data: { kind: item.kind, id: item.id, row } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
    onError: (e) => toast.error((e as Error).message),
  });

  const nameDiff = (item.suggestedName ?? "").trim() !== name.trim();
  const headDiff = (item.suggestedHeadline ?? "").trim() !== headline.trim();
  const byHandOpen = r.verification.filter((v) => v.result === "by_hand" && !v.checked).length;

  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-sm">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">
            {item.ref} · {item.kind === "seller" ? "Seller listing" : item.kind === "buyer" ? "Buyer profile" : "Advisor firm"}
          </div>
          <h2 className="mt-0.5 truncate text-[19px] font-semibold">{item.name}</h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Submitted {fmtD(item.submittedAt)}{item.person ? ` by ${item.person}` : ""}{item.sentBackAt ? ` · sent back ${fmtD(item.sentBackAt)}` : ""}
          </p>
        </div>
        {byHandOpen > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11.5px] font-bold text-amber-800 dark:text-amber-400"><TriangleAlert className="h-3.5 w-3.5" />{byHandOpen} to check by hand</span>}
      </div>

      <div className="space-y-6 px-5 py-5">
        {/* 1 · listing name & headline */}
        <section>
          <h3 className="mb-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.07em] text-muted-foreground"><Pencil className="h-3.5 w-3.5" />Listing name and headline · what goes live</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[12.5px] font-semibold" htmlFor="os-name">Listing name</label>
              <Input id="os-name" maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
              {nameDiff && item.suggestedName && <p className="mt-1 text-[12px] text-muted-foreground">Suggested: “{item.suggestedName}”</p>}
            </div>
            <div>
              <label className="mb-1 block text-[12.5px] font-semibold" htmlFor="os-head">Headline</label>
              <Input id="os-head" maxLength={300} value={headline} onChange={(e) => setHeadline(e.target.value)} />
              {headDiff && item.suggestedHeadline && <p className="mt-1 text-[12px] text-muted-foreground">Suggested: “{item.suggestedHeadline}”</p>}
            </div>
          </div>
        </section>

        {/* 2 · listing view */}
        <section>
          <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.07em] text-muted-foreground">Listing view · what {item.kind === "seller" ? "buyers" : item.kind === "buyer" ? "sellers" : "sellers and buyers"} will see</h3>
          <div className="overflow-hidden rounded-[10px] border border-border">
            {r.listingRows.map(([l, v], i) => (
              <div key={l} className={cn("grid grid-cols-[160px_minmax(0,1fr)] gap-3 px-3.5 py-2 text-[13px] max-sm:grid-cols-1 max-sm:gap-0.5", i > 0 && "border-t border-border")}>
                <span className="text-muted-foreground">{l}</span>
                <span className="min-w-0 break-words font-medium">{v || <span className="font-normal text-muted-foreground">Not added</span>}</span>
              </div>
            ))}
            {r.identityApplies && (
              <div className="grid grid-cols-[160px_minmax(0,1fr)] gap-3 border-t border-border px-3.5 py-2 text-[13px] max-sm:grid-cols-1 max-sm:gap-0.5">
                <span className="text-muted-foreground">Identity check</span>
                <span className="font-medium">
                  {r.identityWords.length
                    ? <span className="inline-flex items-center gap-1.5 text-amber-800 dark:text-amber-400"><TriangleAlert className="h-3.5 w-3.5" />Mentions {r.identityWords.join(", ")}</span>
                    : <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400"><Check className="h-3.5 w-3.5" />Clean</span>}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* 3 · what PitchSnack checks */}
        <section>
          <h3 className="mb-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.07em] text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" />What PitchSnack checks</h3>
          <div className="overflow-hidden rounded-[10px] border border-border">
            {r.exclusiveRows.map((row, i) => (
              <div key={row.label} className={cn("grid grid-cols-[160px_minmax(0,1fr)] gap-3 px-3.5 py-2 text-[13px] max-sm:grid-cols-1 max-sm:gap-0.5", i > 0 && "border-t border-border")}>
                <span className="text-muted-foreground">{row.label}</span>
                <span className="min-w-0 break-words font-medium">
                  {row.value || <span className="font-normal text-muted-foreground">Not added</span>}
                  {row.note && <span className="mt-0.5 block text-[12px] font-normal text-muted-foreground">{row.note}</span>}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 4 · verification rows */}
        {!!r.verification.length && (
          <section>
            {!r.individual && <DbdStorePanel reg={r.dbd?.registrationNo ?? null} initial={r.dbd} onChanged={() => void qc.invalidateQueries({ queryKey: KEY })} />}
            <h3 className="mb-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.07em] text-muted-foreground"><FileCheck2 className="h-3.5 w-3.5" />Registration check{r.registrationNo ? ` · ${r.registrationNo}` : ""}</h3>
            <div className="overflow-hidden rounded-[10px] border border-border">
              {r.verification.map((v, i) => (
                <div key={v.key} className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3.5 py-2.5 text-[13px]", i > 0 && "border-t border-border")}>
                  <span className="w-[150px] shrink-0 font-medium">{v.label}</span>
                  <span className="min-w-0 flex-1">
                    {v.from != null && <span className="mr-3">Given: <b className="font-semibold">{v.from}</b></span>}
                    {v.found != null && <span className="text-muted-foreground">Found: {v.found}</span>}
                    {v.source && <span className="ml-2 text-[11.5px] text-muted-foreground">({v.source})</span>}
                    {v.resultLabel && <span className="ml-2 text-[12px] font-semibold">{v.resultLabel}</span>}
                  </span>
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold", RESULT_TONE[v.result])}>
                    {v.result === "match" && <Check className="h-3 w-3" />}{v.result === "differs" && <X className="h-3 w-3" />}{RESULT_LABEL[v.result]}
                  </span>
                  {v.link && <a href={v.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1D4ED8] hover:underline">Open <ExternalLink className="h-3 w-3" /></a>}
                  {v.result === "by_hand" && !v.checked && (
                    <button type="button" disabled={check.isPending} onClick={() => check.mutate(v.key)}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold hover:bg-muted">
                      <CircleCheck className="h-3 w-3" />Mark checked
                    </button>
                  )}
                  {v.result === "by_hand" && v.checked && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400"><Check className="h-3 w-3" />Checked</span>}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* decision bar */}
      <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-border bg-muted/30 px-5 py-3.5">
        <Button variant="outline" size="sm" className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40" disabled={act.isPending} onClick={() => { setReasons([]); setNote(""); setDialog("decline"); }}>Decline</Button>
        <Button variant="outline" size="sm" className="border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/40" disabled={act.isPending} onClick={() => { setReasons([]); setNote(""); setDialog("request_changes"); }}>Ask for changes</Button>
        <Button size="sm" className="bg-[#166534] text-white hover:bg-[#14532D]" disabled={act.isPending || !name.trim() || !headline.trim()}
          onClick={() => act.mutate({ action: "approve" })}>
          <ShieldCheck className="mr-1.5 h-4 w-4" />Verify and publish
        </Button>
      </div>

      {/* reasons dialog */}
      <Dialog open={!!dialog} onOpenChange={(v) => !v && setDialog(null)}>
        <DialogContent className="max-w-[480px]" aria-label={dialog === "decline" ? "Decline" : "Ask for changes"}>
          <DialogTitle>{dialog === "decline" ? "Decline this registration" : "Ask for changes"}</DialogTitle>
          <p className="text-[13px] text-muted-foreground">
            {dialog === "decline"
              ? `${item.name} stays unpublished. Tell ${item.person ?? "them"} why.`
              : `${item.name} stays unpublished until ${item.person ?? "the user"} fixes these.`}
          </p>
          <div className="ap-opts mt-1">
            {DECISION_REASONS.map((reason) => (
              <label key={reason}>
                <input type="checkbox" checked={reasons.includes(reason)}
                  onChange={(e) => setReasons((p) => (e.target.checked ? [...p, reason] : p.filter((x) => x !== reason)))} />
                {reason === "Another reason" ? "Another reason (say it in the note)" : reason}
              </label>
            ))}
          </div>
          <Textarea rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder={reasons.includes("Another reason") ? "Say what the other reason is…" : "A note for the user (optional)"} />
          <div className="flex justify-end gap-2.5">
            <Button variant="outline" size="sm" onClick={() => setDialog(null)}>Cancel</Button>
            <Button size="sm" className={dialog === "decline" ? "bg-[#B91C1C] text-white hover:bg-[#991B1B]" : "bg-[#1E2A4A] text-white hover:bg-[#101d43]"}
              disabled={act.isPending || !reasons.length}
              onClick={() => act.mutate({ action: dialog!, reasons, note: note.trim() || undefined })}>
              <Send className="mr-1.5 h-4 w-4" />{dialog === "decline" ? "Decline" : "Send back"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
