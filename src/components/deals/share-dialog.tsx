import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Share2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { createShare, listEligibleShareTenants } from "@/lib/deal-shares.functions";
import { useHasSession } from "@/hooks/use-has-session";

interface ShareDialogProps {
  dealId: string;
  dealName: string;
  trigger?: React.ReactNode;
}

export function ShareDialog({ dealId, dealName, trigger }: ShareDialogProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const qc = useQueryClient();
  const listFn = useServerFn(listEligibleShareTenants);
  const createFn = useServerFn(createShare);

  const enabled = useHasSession() && open;
  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ["share-eligible-tenants", dealId],
    queryFn: () => listFn({ data: { dealId } }),
    enabled,
  });

  const mutation = useMutation({
    mutationFn: () => createFn({ data: {
      dealId,
      targetTenantIds: selected,
      shareReason: reason.trim() || undefined,
    } }),
    onSuccess: () => {
      toast.success("Deal shared");
      qc.invalidateQueries({ queryKey: ["shared-deals"] });
      setOpen(false);
      setSelected([]);
      setReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggle(id: string) {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" className="gap-2">
            <Share2 className="h-4 w-4" /> Share
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share "{dealName}"</DialogTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Sharing grants visibility only. Ownership and origin tenant remain unchanged.
          </p>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Recipient tenants</Label>
            <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-border bg-card">
              {isLoading ? (
                <div className="p-4 text-sm text-muted-foreground">Loading tenants…</div>
              ) : tenants.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No eligible tenants.</div>
              ) : (
                tenants.map((t) => (
                  <label key={t.id} className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 last:border-0 hover:bg-muted/30">
                    <Checkbox checked={selected.includes(t.id)} onCheckedChange={() => toggle(t.id)} />
                    <div className="flex-1 text-sm">
                      <div>{t.tenant_name}</div>
                      <div className="text-xs text-muted-foreground">{t.tenant_code}</div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
          <div>
            <Label htmlFor="share-reason" className="text-xs">Reason (optional)</Label>
            <Textarea id="share-reason" value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you sharing this deal?" className="mt-2" rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={selected.length === 0 || mutation.isPending}
          >
            {mutation.isPending ? "Sharing…" : `Share with ${selected.length || 0}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
