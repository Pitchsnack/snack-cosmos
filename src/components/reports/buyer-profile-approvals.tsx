import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { decideBuyerProfile } from "@/lib/approvals.functions";
import { descriptionLeaks } from "@/lib/investor-bands";

type Row = { id: string; user_id: string; ref_no: string | null; investor_id: string | null; approval_status: string; submitted_at: string | null; description: string | null; investor_name: string | null; investor_type: string | null };

/** Admin › Approvals › Buyers: investor profiles waiting to go live in Browse investors. */
export function BuyerProfileApprovals({ rows, names }: { rows: Row[]; names: Record<string, string> }) {
  const qc = useQueryClient();
  const fn = useServerFn(decideBuyerProfile);
  const [ask, setAsk] = useState<null | { id: string; action: "request_changes" | "decline" }>(null);
  const [note, setNote] = useState("");
  const decide = useMutation({
    mutationFn: (v: { id: string; action: "approve" | "request_changes" | "decline"; note?: string }) => fn({ data: v }),
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ["approvals"] }); toast.success(v.action === "approve" ? "Profile approved and live in Browse investors" : "Decision sent"); setAsk(null); setNote(""); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Investor profiles to publish ({rows.filter((r) => r.approval_status === "in_review").length})</h2>
      <div className="overflow-x-auto rounded-[14px] border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr>{["Investor", "Type", "Public description", "Submitted", "Status", ""].map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No investor profiles waiting.</td></tr>}
            {rows.map((r) => {
              const leaks = descriptionLeaks(r.description ?? "", r.investor_name ?? "", "");
              const open = r.approval_status === "in_review";
              return (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="p-3">
                    <div className="font-semibold">{r.investor_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{[r.ref_no, names[r.user_id]].filter(Boolean).join(" · ")}</div>
                    {r.investor_id && <Link to="/investors/$id" params={{ id: r.investor_id }} className="text-xs text-primary hover:underline">Open in Investors Directory</Link>}
                  </td>
                  <td className="p-3">{r.investor_type ?? "—"}</td>
                  <td className="max-w-[320px] p-3">
                    <div className="line-clamp-3">{r.description || <span className="text-muted-foreground">None</span>}</div>
                    <div className={leaks.length ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{leaks.length ? `Identity check: ${leaks.join(", ")}` : "Identity check passed"}</div>
                  </td>
                  <td className="p-3">{r.submitted_at ? new Date(r.submitted_at).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "—"}</td>
                  <td className="p-3">{open ? "In review" : "Changes requested"}</td>
                  <td className="p-3">
                    {open && (
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setAsk({ id: r.id, action: "decline" })}>Decline</Button>
                        <Button size="sm" variant="outline" onClick={() => setAsk({ id: r.id, action: "request_changes" })}>Request changes</Button>
                        <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, action: "approve" })}>Approve &amp; publish</Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {ask && (
        <Dialog open onOpenChange={(o) => !o && setAsk(null)}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogTitle>{ask.action === "decline" ? "Decline investor profile" : "Request changes"}</DialogTitle>
            <DialogDescription>The buyer gets this note.</DialogDescription>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAsk(null)}>Cancel</Button>
              <Button disabled={!note.trim() || decide.isPending} onClick={() => decide.mutate({ ...ask, note: note.trim() })}>Send</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
