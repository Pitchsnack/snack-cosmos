import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { AlarmClock, AlertTriangle, Check, KeyRound, Lock } from "lucide-react";
import { dateEn } from "@/lib/access-codes";
import { getMyPlanStrip, type PlanStrip as Strip } from "@/lib/plan.functions";
import type { ClosedTeaser } from "@/lib/hidden-profiles.functions";
import { PlanBadge } from "@/components/plan-badge";
import { Button } from "@/components/ui/button";
import { useHasSession } from "@/hooks/use-has-session";

export function usePlanStrip() {
  const fn = useServerFn(getMyPlanStrip);
  const enabled = useHasSession();
  return useQuery<Strip>({ queryKey: ["plan-strip"], queryFn: () => fn(), staleTime: 30_000, enabled });
}

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;

function priceLine(p: NonNullable<Strip["plan"]>, termEnd: string | null) {
  if (p.priceType === "free") return `Free · renews every ${p.termMonths} months`;
  const per = p.termMonths === 12 ? "yr" : `${p.termMonths} mo`;
  const head = p.priceType === "on_request" ? "Price on request" : `${(p.priceThb ?? 0).toLocaleString()} THB / ${per}`;
  const parts = [head];
  if (termEnd) parts.push(`renews ${fmtDate(termEnd)}`);
  if (p.completionFeePct != null) parts.push(`${p.completionFeePct}% completion fee`);
  return parts.join(" · ");
}

export const LOCK_STYLE = "border-[#F3D9A6] bg-[#FFF4E0] text-[#8A5A06]";

/** Plan strip on the Browse pages: badge, price line, ✓ / 🔒 chips, what's left this term. */
export function PlanStrip() {
  const { data } = usePlanStrip();
  if (!data || data.role === "admin" || !data.role) return null;
  const p = data.plan;
  const what = data.role === "seller" ? "contact requests" : data.role === "buyer" ? "NDA requests" : "requests";
  const sellerNoSend = data.role === "seller" && p?.requestsMode === "none";
  const yr = p?.termMonths === 12 ? "this year" : "this term";
  const left =
    data.left === "unlimited" ? `Unlimited ${what}` :
    data.left === null ? `No ${what} on this plan` :
    p?.requestsMode === "bundles" ? `${data.left} ${what} left from bundles` :
    `${data.left} of ${data.total ?? data.left} ${what} left ${yr}`;
  return (
    <div className="space-y-2">
      {data.ended && (
        <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-[#FCD34D] bg-[#FEF3C7] px-[14px] py-[10px] text-[13.5px] text-[#92400E]">
          <AlertTriangle className="h-4 w-4" />
          <span>Your {p?.name} plan ended{data.termEnd ? ` on ${fmtDate(data.termEnd)}` : ""}. Requests are paused until you renew.</span>
          <Link to="/preferences" hash="subscription" className="ml-auto font-semibold underline">Renew plan</Link>
        </div>
      )}
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[12px] border px-4 py-3 shadow-card ${data.free ? "border-[#D6E7FC] bg-[#F9FBFF]" : "border-border bg-card"}`}>
        {p ? <PlanBadge name={p.name} style={p.badgeStyle} ended={data.ended} /> : <span className="text-[13px] font-semibold text-muted-foreground">No plan yet</span>}
        {p && data.free ? (
          data.free.daysLeft <= 14
            ? <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#8A5A06]"><AlarmClock className="h-3.5 w-3.5 text-[#B7791F]" />Free with your invitation · ends {data.free.daysLeft === 0 ? "today" : `${dateEn(data.free.lastDay)} · ${data.free.daysLeft === 1 ? "1 day" : `${data.free.daysLeft} days`} left`}</span>
            : <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1E3A5F]"><KeyRound className="h-3.5 w-3.5 text-[#2563EB]" />Free with your invitation · until {dateEn(data.free.lastDay)}</span>
        ) : p && <span className="text-[13px] text-muted-foreground">{priceLine(p, data.termEnd)}</span>}
        <div className="flex flex-wrap gap-1.5">
          {(p?.features ?? []).map((f) => (
            <span key={f.label} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-semibold ${f.on ? "border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]" : LOCK_STYLE}`}>
              {f.on ? <Check className="h-3 w-3" /> : <Lock className="h-3 w-3" />}{f.label}{f.needs ? ` · ${f.needs}` : ""}
            </span>
          ))}
        </div>
        {sellerNoSend ? (
          <span className="ml-auto max-w-[420px] text-[13px] text-muted-foreground">Buyers can still find you and ask for an NDA. Sending your own contact requests needs Professional.</span>
        ) : (
          p?.requestsMode === "number" && data.total != null ? (
            <div className={`request-counter request-counter-${data.role}`} data-testid="request-counter">
              <div className="flex items-center justify-between gap-4 text-[13px]">
                <span>{data.role === "buyer" ? "NDA requests" : "Contact requests"} {yr}</span>
                <strong className="shrink-0 tabular-nums">{typeof data.left === "number" ? data.left : 0} of {data.total} left</strong>
              </div>
              <progress aria-label={`${what} remaining`} max={Math.max(1, data.total)} value={typeof data.left === "number" ? data.left : 0} />
              <p>{data.role === "seller" ? "Each request you send to an investor uses one. Requests buyers send you are free." : data.role === "buyer" ? "Each NDA request you send uses one." : "Each request you send to a seller or buyer uses one. Enquiries sent to you are free."}</p>
            </div>
          ) : <span className="ml-auto text-[13px] font-semibold">{left}</span>
        )}
        <Link to="/preferences" hash="subscription" className={sellerNoSend ? "inline-flex h-[32px] items-center rounded-md border border-border px-3 text-[13px] font-semibold hover:bg-muted" : "text-[13px] font-semibold text-accent hover:underline"}>{p?.requestsMode === "bundles" ? "Buy a bundle" : "Compare plans"}</Link>
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

/** A listing above the plan's price range: four safe fields only. Only the star is live. */
export function ClosedListingCard({ c, star }: { c: ClosedTeaser; star?: React.ReactNode }) {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-[14px] border border-dashed border-border bg-card">
      {star && <div className="absolute right-3 top-3 z-10">{star}</div>}
      <div className="flex h-[120px] flex-col items-center justify-center gap-1.5 text-muted-foreground" style={{ backgroundImage: "repeating-linear-gradient(135deg, var(--muted) 0 10px, var(--background) 10px 20px)" }}>
        <Lock className="h-5 w-5" />
        <span className="text-[12.5px] font-semibold">{c.sector ?? "Business"}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className={`w-fit rounded-full border px-2 py-0.5 text-[11.5px] font-semibold ${LOCK_STYLE}`}>{c.priceBand}</span>
        <div className="text-[13px] font-semibold">{[c.sector, c.region, c.refNo].filter(Boolean).join(" · ")}</div>
        <div className="h-2.5 w-4/5 rounded bg-muted" />
        <div className="h-2.5 w-3/5 rounded bg-muted" />
        <p className="text-[12.5px] text-muted-foreground">Opens on the {c.needPlan} plan. Your plan covers businesses selling for under THB {c.capM}m.</p>
        <Link to="/preferences" hash="subscription" className="mt-auto inline-flex h-[32px] w-fit items-center rounded-md border border-border px-3 text-[13px] font-semibold hover:bg-muted">See plans</Link>
      </div>
    </div>
  );
}
