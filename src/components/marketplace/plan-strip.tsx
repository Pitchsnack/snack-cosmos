import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Check, Lock } from "lucide-react";
import { getMyPlanStrip, type PlanStrip as Strip } from "@/lib/plan.functions";
import { myContactState, sendContactRequest } from "@/lib/contact-requests.functions";
import type { ClosedTeaser } from "@/lib/hidden-profiles.functions";
import { PlanBadge } from "@/components/plan-badge";
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[12px] border border-border bg-card px-4 py-3 shadow-card">
        {p ? <PlanBadge name={p.name} style={p.badgeStyle} ended={data.ended} /> : <span className="text-[13px] font-semibold text-muted-foreground">No plan yet</span>}
        {p && <span className="text-[13px] text-muted-foreground">{priceLine(p, data.termEnd)}</span>}
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
          <span className="ml-auto text-[13px] font-semibold">{left}</span>
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

/** Seller: send this investor a contact request. Locked on plans without contact requests. */
export function ContactRequestButton({ investorId }: { investorId: string }) {
  const { data: strip } = usePlanStrip();
  const qc = useQueryClient();
  const send = useServerFn(sendContactRequest);
  const stateFn = useServerFn(myContactState);
  const { data: st } = useQuery({ queryKey: ["contact-requests"], queryFn: () => stateFn() });
  const [busy, setBusy] = useState(false);
  const planLock = requestLock(strip);
  const lock = planLock ?? (st && !st.hasListing ? "Add your business first" : null);
  const goPlans = { label: "See plans", onClick: () => { window.location.href = "/preferences#subscription"; } };
  if (st?.sent.includes(investorId)) return <span className="inline-flex h-[34px] items-center rounded-md border px-3 text-sm font-medium text-muted-foreground">Contact requested</span>;
  return (
    <button
      type="button"
      aria-disabled={!!lock || undefined}
      title={lock ?? "Send a contact request"}
      disabled={busy}
      onClick={async (e) => {
        e.stopPropagation();
        if (planLock) {
          toast(planLock === "Professional plan" ? "Sending contact requests needs Professional. On Entry, investors can still contact you." : planLock, { action: goPlans });
          return;
        }
        if (lock) { toast(lock, { action: { label: "My Company", onClick: () => { window.location.href = "/my-startups"; } } }); return; }
        setBusy(true);
        try {
          const r = await send({ data: { investorId } });
          const yr = r.termMonths === 12 ? "this year" : "this term";
          const leftTxt = r.left === "unlimited" ? "" : r.left == null ? "" : ` ${r.left} left ${yr}.`;
          toast.success(`Request sent. ${r.label} will see your anonymous listing.${leftTxt}`);
        }
        catch (err) { toast.error((err as Error).message); }
        finally { setBusy(false); qc.invalidateQueries({ queryKey: ["plan-strip"] }); qc.invalidateQueries({ queryKey: ["contact-requests"] }); }
      }}
      className={`inline-flex h-[34px] items-center gap-1.5 rounded-md px-3 text-sm font-medium ${lock ? `cursor-pointer border border-dashed ${LOCK_STYLE}` : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
    >
      {lock && <Lock className="h-3.5 w-3.5" />}{lock === "Professional plan" ? "Professional plan" : lock === "Add your business first" ? "Add your business first" : "Request contact"}
    </button>
  );
}
