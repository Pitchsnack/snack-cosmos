import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Check, Lock } from "lucide-react";
import { getMyPlanStrip, type PlanStrip as Strip } from "@/lib/plan.functions";
import { PlanBadge } from "@/components/plan-badge";
import { useHasSession } from "@/hooks/use-has-session";

export function usePlanStrip() {
  const fn = useServerFn(getMyPlanStrip);
  const enabled = useHasSession();
  return useQuery<Strip>({ queryKey: ["plan-strip"], queryFn: () => fn(), staleTime: 30_000, enabled });
}

function priceLine(p: NonNullable<Strip["plan"]>) {
  const price = p.priceType === "free" ? "Free" : p.priceType === "on_request" ? "Price on request" : `฿${(p.priceThb ?? 0).toLocaleString()}`;
  const parts = [`${price} · ${p.termMonths} months`];
  if (p.completionFeePct != null) parts.push(`${p.completionFeePct}% completion fee`);
  parts.push(p.valueCapM == null ? "Any deal size" : `Deals up to ฿${p.valueCapM}M`);
  return parts.join(" · ");
}

/** Plan strip on the Browse pages: badge, price line, ✓ / 🔒 chips, what's left this term. */
export function PlanStrip() {
  const { data } = usePlanStrip();
  if (!data || data.role === "admin" || !data.role) return null;
  const p = data.plan;
  const what = data.role === "seller" ? "contact requests" : data.role === "buyer" ? "NDA requests" : "requests";
  const left =
    data.left === "unlimited" ? `Unlimited ${what}` :
    data.left === null ? `No ${what} on this plan` :
    p?.requestsMode === "bundles" ? `${data.left} ${what} left from bundles` :
    `${data.left} of ${data.total ?? data.left} ${what} left this term`;
  return (
    <div className="space-y-2">
      {data.ended && (
        <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-[#FCD34D] bg-[#FEF3C7] px-[14px] py-[10px] text-[13.5px] text-[#92400E]">
          <AlertTriangle className="h-4 w-4" />
          <span>Your {p?.name} plan ended{data.termEnd ? ` on ${new Date(data.termEnd).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}. Requests are paused until you renew.</span>
          <Link to="/preferences" hash="subscription" className="ml-auto font-semibold underline">Renew plan</Link>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[12px] border border-border bg-card px-4 py-3 shadow-card">
        {p ? <PlanBadge name={p.name} style={p.badgeStyle} ended={data.ended} /> : <span className="text-[13px] font-semibold text-muted-foreground">No plan yet</span>}
        {p && <span className="text-[13px] text-muted-foreground">{priceLine(p)}</span>}
        <div className="flex flex-wrap gap-1.5">
          {(p?.features ?? []).map((f) => (
            <span key={f.label} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-semibold ${f.on ? "border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]" : "border-border bg-muted text-muted-foreground"}`}>
              {f.on ? <Check className="h-3 w-3" /> : <Lock className="h-3 w-3" />}{f.label}
            </span>
          ))}
        </div>
        <span className="ml-auto text-[13px] font-semibold">{left}</span>
        <Link to="/preferences" hash="subscription" className="text-[13px] font-semibold text-accent hover:underline">{p?.requestsMode === "bundles" ? "Buy a bundle" : "Compare plans"}</Link>
      </div>
    </div>
  );
}

/** Why a request button is locked, or null when it can be used. */
export function requestLock(s: Strip | undefined): string | null {
  if (!s || s.role === "admin") return null;
  if (!s.plan) return "Choose a plan to send requests";
  if (s.ended) return "Renew to request";
  if (s.left === null) return `${s.role === "seller" ? "Professional" : s.role === "buyer" ? "Investor" : "Pro"} plan`;
  if (s.left !== "unlimited" && s.left <= 0) return s.plan.requestsMode === "bundles" ? "Buy a bundle" : "No requests left";
  return null;
}

/** A listing above the plan's price range. Only the star is live. */
export function ClosedListingCard({ needPlan, star }: { needPlan: string; star?: React.ReactNode }) {
  return (
    <div className="relative flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-border bg-muted/60 p-6 text-center">
      {star && <div className="absolute right-3 top-3">{star}</div>}
      <Lock className="h-6 w-6 text-muted-foreground" />
      <div className="text-sm font-semibold">Above your plan's price range</div>
      <p className="max-w-[260px] text-[12.5px] text-muted-foreground">This business is listed above what your plan covers. Its details open on the {needPlan} plan.</p>
      <Link to="/preferences" hash="subscription" className="text-[13px] font-semibold text-accent hover:underline">See plans</Link>
    </div>
  );
}
