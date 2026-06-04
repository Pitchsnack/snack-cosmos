import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useImportTargets } from "@/hooks/use-global-directory";
import { gateway, type ImportEntity } from "@/lib/api-gateway/client";

interface Props {
  entity: ImportEntity;
  sourceGlobalId: string;
  sourceName: string;
  originTenantName: string | null;
  trigger?: React.ReactNode;
}

export function ImportFromGlobalDialog({
  entity,
  sourceGlobalId,
  sourceName,
  originTenantName,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false);
  const [targetTenantId, setTargetTenantId] = useState<string>("");
  const [note, setNote] = useState("");
  const { data: targets = [], isLoading } = useImportTargets();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      gateway.import.fromGlobal({
        entity,
        sourceGlobalId,
        targetTenantId,
        note: note.trim() || undefined,
      }),
    onSuccess: (res) => {
      toast.success("Import requested", { description: res.message });
      qc.invalidateQueries({ queryKey: ["audit"] });
      setOpen(false);
      setNote("");
      setTargetTenantId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const eligible = targets.filter((t) => true);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Import
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import "{sourceName}" into a tenant</DialogTitle>
          <DialogDescription className="text-xs">
            The external Import Engine will create an{" "}
            <strong>independent tenant record</strong> linked via{" "}
            <code>source_global_id</code>. Global edits never flow into the
            tenant copy, and tenant edits never flow back to Global.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Source ({entity})</span>
              <span className="font-medium">{sourceName}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-muted-foreground">Origin tenant</span>
              <span>{originTenantName ?? "—"}</span>
            </div>
            <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>source_global_id</span>
              <span>{sourceGlobalId.slice(0, 8)}…</span>
            </div>
          </div>

          <div>
            <Label htmlFor="target-tenant" className="text-xs">
              Target tenant
            </Label>
            <Select value={targetTenantId} onValueChange={setTargetTenantId}>
              <SelectTrigger id="target-tenant" className="mt-2">
                <SelectValue
                  placeholder={isLoading ? "Loading tenants…" : "Select tenant…"}
                />
              </SelectTrigger>
              <SelectContent>
                {eligible.map((t) => (
                  <SelectItem key={t.tenantId} value={t.tenantId}>
                    {t.tenantName}{" "}
                    <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                      {t.tenantCode}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="import-note" className="text-xs">
              Note (optional)
            </Label>
            <Textarea
              id="import-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why is this record being imported?"
              className="mt-2"
            />
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <strong>Note —</strong> this UI calls a stub gateway today. The
            External Import Engine (PRD 8 Stream B) will perform the cross-
            database copy and is the only component allowed to write to the
            tenant database.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!targetTenantId || mutation.isPending}
            className="gap-2"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Request import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
