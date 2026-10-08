import { Crown } from "lucide-react";

/** The plan badge: colours come from the plan's badge_style (plans table). */
const STYLES: Record<string, { bg: string; bd: string; fg: string; crown?: string; noCrown?: boolean }> = {
  entry: { bg: "#FFEDD5", bd: "#FDCB9A", fg: "#C2410C", noCrown: true },
  blue: { bg: "#1E40AF", bd: "#1E40AF", fg: "#FFFFFF" },
  navy_gold: { bg: "#1E3E56", bd: "#1E3E56", fg: "#FFFFFF", crown: "#F6C453" },
  sky: { bg: "#E3F1FC", bd: "#CFE5F8", fg: "#1668B0" },
  royal: { bg: "#E2EAFB", bd: "#BCCDF2", fg: "#1E45A8" },
  deepnavy_gold: { bg: "#14295A", bd: "#14295A", fg: "#FFFFFF", crown: "#F6C453" },
  lightteal: { bg: "#E0F5F2", bd: "#CFEAE5", fg: "#0F766E" },
  teal_gold: { bg: "#0F766E", bd: "#0F766E", fg: "#FFFFFF", crown: "#F6C453" },
  ended: { bg: "#F3F4F6", bd: "#E5E7EB", fg: "#6B7280", noCrown: true },
};

export function PlanBadge({ name, style, ended }: { name: string; style: string; ended?: boolean }) {
  const s = STYLES[ended ? "ended" : style] ?? STYLES.sky;
  return (
    <span
      className="inline-flex h-5 shrink-0 items-center gap-[5px] rounded-full border px-2 text-[10.5px] font-bold"
      style={{ background: s.bg, borderColor: s.bd, color: s.fg }}
    >
      {!s.noCrown && <Crown className="h-[11px] w-[11px]" strokeWidth={2.4} style={{ color: s.crown ?? s.fg }} />}
      {ended ? `${name} · ended` : name}
    </span>
  );
}
