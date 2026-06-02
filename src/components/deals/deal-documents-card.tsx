import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Trash2, Plus } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { addDealDocument, removeDealDocument } from "@/lib/deal-documents.functions";
import { usePermissions } from "@/hooks/use-session-context";

type Doc = { id: string; file_name: string; file_url: string; document_type: string | null; created_at: string };

export function DealDocumentsCard({ dealId, documents }: { dealId: string; documents: Doc[] }) {
  const { isControl, has } = usePermissions();
  const canManage = isControl || has("deals.write");
  const qc = useQueryClient();
  const remove = useServerFn(removeDealDocument);

  const removeM = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Document removed");
      qc.invalidateQueries({ queryKey: ["deal", dealId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-lg border border-border bg-card shadow-card">
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="text-sm font-semibold">Documents</div>
        {canManage && <AddDocumentDialog dealId={dealId} />}
      </div>
      {documents.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">No documents attached.</div>
      ) : (
        <div className="divide-y divide-border">
          {documents.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <a href={d.file_url} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium hover:underline">{d.file_name}</a>
                  <div className="text-xs text-muted-foreground">{d.document_type || "Document"} · {new Date(d.created_at).toLocaleDateString()}</div>
                </div>
              </div>
              {canManage && (
                <Button size="icon" variant="ghost" onClick={() => removeM.mutate(d.id)} disabled={removeM.isPending}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddDocumentDialog({ dealId }: { dealId: string }) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [documentType, setDocumentType] = useState("");
  const qc = useQueryClient();
  const add = useServerFn(addDealDocument);

  const m = useMutation({
    mutationFn: () => add({ data: { dealId, fileName, fileUrl, documentType: documentType || null } }),
    onSuccess: () => {
      toast.success("Document added");
      qc.invalidateQueries({ queryKey: ["deal", dealId] });
      setOpen(false);
      setFileName(""); setFileUrl(""); setDocumentType("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Plus className="mr-1.5 h-3.5 w-3.5" /> Add</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Attach document</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide">File name</Label>
            <Input value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="Term sheet v2.pdf" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide">File URL</Label>
            <Input type="url" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide">Document type</Label>
            <Input value={documentType} onChange={(e) => setDocumentType(e.target.value)} placeholder="Term Sheet, NDA, Pitch Deck…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!fileName || !fileUrl || m.isPending} onClick={() => m.mutate()} className="bg-accent text-accent-foreground hover:bg-accent/90">
            {m.isPending ? "Saving…" : "Add document"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
