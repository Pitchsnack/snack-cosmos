import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addDraftBusiness } from "@/lib/seller-setup.functions";
import { useSessionContext } from "@/hooks/use-session-context";
import { useTranslation } from "@/i18n/language";

/** + Add My Business: makes the Draft on the server, then opens the seller wizard on it. One Draft per click. */
export function AddBusinessButton({ label = "Add My Business", size }: { label?: string; size?: "sm" }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const add = useServerFn(addDraftBusiness);
  const { data: session } = useSessionContext();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const go = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      const { id } = await add({ data: { tenantId: session?.activeWorkspace?.tenantId ?? null } });
      await navigate({ to: "/my-startups/setup/$id", params: { id } });
    } catch (e) { toast((e as Error).message); }
    finally { lock.current = false; setBusy(false); }
  };
  return (
    <Button size={size} disabled={busy} aria-busy={busy} onClick={() => void go()} className="bg-accent text-accent-foreground hover:bg-accent/90">
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} {t(label)}
    </Button>
  );
}
