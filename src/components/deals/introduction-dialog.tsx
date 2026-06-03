import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Handshake } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { requestIntroduction } from "@/lib/deal-introductions.functions";

interface IntroductionDialogProps {
  dealId: string;
  dealName: string;
  trigger?: React.ReactNode;
}

export function IntroductionDialog({ dealId, dealName, trigger }: IntroductionDialogProps) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const fn = useServerFn(requestIntroduction);
  const m = useMutation({
    mutationFn: () => fn({ data: { dealId } }),
    onSuccess: () => {
      toast.success("Introduction requested");
      qc.invalidateQueries({ queryKey: ["deal-introductions", dealId] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" className="gap-2">
            <Handshake className="h-4 w-4" /> Request introduction
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request introduction</DialogTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Notify the owning agent of "{dealName}" that you'd like an introduction to the startup and investor.
          </p>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending ? "Requesting…" : "Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
