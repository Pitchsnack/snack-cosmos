import { Link, useRouterState } from "@tanstack/react-router";
import { Target } from "lucide-react";
import { RailTip } from "@/components/marketplace/rail-tip";
import { useBw } from "./bw-card";

/** First Marketplace menu row, above DISCOVER, in every persona. */
export function BusinessesWantedRow({ collapsed }: { collapsed?: boolean }) {
  const { c } = useBw();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const label = c("Businesses Wanted", "ธุรกิจที่ผู้ซื้อต้องการ");
  const active = path.startsWith("/marketplace/businesses-wanted");
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
