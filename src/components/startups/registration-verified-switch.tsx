import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { getRegistrationVerified, setRegistrationVerified } from "@/lib/plan.functions";
import { useSessionContext } from "@/hooks/use-session-context";

/** Admin only: once on, the listing card and listing page show "Certified". */
export function RegistrationVerifiedSwitch({ startupId }: { startupId: string }) {
  const { data: ctx } = useSessionContext();
  const isAdmin = ctx?.user?.accountRole === "admin" || (ctx?.roles ?? []).includes("CONTROL");
  const get = useServerFn(getRegistrationVerified);
  const set = useServerFn(setRegistrationVerified);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["reg-verified", startupId], queryFn: () => get({ data: { startupId } }), enabled: isAdmin });
  if (!isAdmin) return null;
  const on = !!data?.at;
  return (
    <label className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium">
      <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
      Registration verified
      <Switch checked={on} onCheckedChange={async (v) => {
        try {
          await set({ data: { startupId, on: v } });
          qc.invalidateQueries({ queryKey: ["reg-verified", startupId] });
          qc.invalidateQueries({ queryKey: ["marketplace-teasers"] });
          toast.success(v ? "Registration verified. The listing now shows Certified." : "Registration verified turned off.");
        } catch (e) { toast.error((e as Error).message); }
      }} />
      {on && <span className="text-muted-foreground">since {new Date(data!.at!).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>}
    </label>
  );
}
