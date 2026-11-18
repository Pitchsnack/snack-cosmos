import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { finishAddYes } from "@/lib/add-company-finish";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addDraftBusiness } from "@/lib/seller-setup.functions";
import { applyAddCheck } from "@/lib/add-company-check.functions";
import { AddCompanyCheck, type AddCheckYes } from "@/components/setup/add-company-check";
import { useSessionContext } from "@/hooks/use-session-context";
import { useTranslation } from "@/i18n/language";

/** + Add My Business: makes the Draft on the server, then opens the seller wizard on it. One Draft per click. */
export function AddBusinessButton({ label = "Add My Business", size }: { label?: string; size?: "sm" }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const add = useServerFn(addDraftBusiness);
  const { data: session } = useSessionContext();
  const apply = useServerFn(applyAddCheck);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const lock = useRef(false);
  // The business is made only after "Yes, this is my company".
  const onYes = async (y: AddCheckYes) => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      await finishAddYes("seller", {
        create: () => add({ data: { tenantId: session?.activeWorkspace?.tenantId ?? null } }),
        apply: (id) => apply({ data: { attemptId: y.attemptId, kind: "seller", profileId: id, session: y.session, answers: y.answers } }),
        refresh: (key) => qc.invalidateQueries({ queryKey: [...key] }),
        close: () => setOpen(false),
        go: (to, search) => navigate({ to: to as "/my-startups", search: search as never }),
      });
    } finally { lock.current = false; setBusy(false); }
  };
  return (
    <>
    {open && <AddCompanyCheck kind="seller" open={open} onClose={() => setOpen(false)} onYes={onYes} />}
    <Button size={size} disabled={busy} aria-busy={busy} onClick={() => setOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} {t(label)}
    </Button>
    </>
  );
}
