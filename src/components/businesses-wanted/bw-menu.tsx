import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Target } from "lucide-react";
import { usePersona } from "@/hooks/use-marketplace";
import { useSessionContext } from "@/hooks/use-session-context";
import { newBuyOrderCount } from "@/lib/buy-orders.functions";
import { RailTip } from "@/components/marketplace/rail-tip";
import { useBw } from "./bw-card";

/** First Marketplace menu row, above DISCOVER, in every persona. */
export function BusinessesWantedRow({ collapsed }: { collapsed?: boolean }) {
  const { c } = useBw();
  const { persona } = usePersona();
  const { data } = useSessionContext();
  const role = data?.user?.accountRole ?? null;
  const path = useRouterState({ select: (s) => s.location.pathname });
  const fn = useServerFn(newBuyOrderCount);
  const q = useQuery({ queryKey: ["buy-orders-new", persona, data?.user?.id], queryFn: () => fn({ data: { persona } }), enabled: !!role, staleTime: 60_000 });
  const label = c("Businesses Wanted", "ธุรกิจที่ผู้ซื้อต้องการ");
  const active = path.startsWith("/marketplace/businesses-wanted");
  const n = q.data?.n ?? 0;
  if (collapsed)
    return (
      <div className="mb-1">
        <RailTip label={label}>
          <Link to="/marketplace/businesses-wanted" aria-label={label} className={`relative flex items-center justify-center rounded-lg px-2 py-2.5 transition-colors ${active ? "bg-[var(--role-accent)] text-[var(--role-on)]" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"}`}>
            <Target className="h-[18px] w-[18px]" />
          </Link>
        </RailTip>
      </div>
    );
  return (
    <Link to="/marketplace/businesses-wanted" className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${active ? "bg-[var(--role-accent)] text-[var(--role-on)] font-medium" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"}`}>
      <Target className="h-[18px] w-[18px] shrink-0" />
      <span className="min-w-0">{label}</span>
      <span className="hub-new ml-auto" style={active ? { color: "currentColor", borderColor: "currentColor" } : undefined}>{c("NEW", "ใหม่")}</span>
    </Link>
  );
}
