import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { planPrice, type PlanRecord } from "@/lib/plan-editor";
import { listPlans } from "@/lib/users.functions";
import { PlanBadge } from "@/components/plan-badge";
import { usePlanStrip } from "@/components/marketplace/plan-strip";

/** Settings › Subscription: your plan and the plans for your role (values from the plans table). */
export function SubscriptionSection() {
  const { data: strip } = usePlanStrip();
  const fn = useServerFn(listPlans);
  const { data: plans = [] } = useQuery({ queryKey: ["plans"], queryFn: () => fn() });
  useEffect(() => {
    if (window.location.hash === "#subscription") document.getElementById("subscription")?.scrollIntoView({ behavior: "smooth" });
  }, []);
  const role = strip?.role;
  const mine = (plans as any[]).filter((p) => p.status === "live" && (role === "admin" || p.role === role));
  const price = (p: any) => planPrice(p as PlanRecord);
  const req = (p: any) => (p.requests_mode === "none" ? null : p.requests_mode === "number" ? `${p.requests_n} requests per term` : p.requests_mode === "bundles" ? "Requests by bundle" : "Unlimited requests");
  return (
    <Card id="subscription" className="scroll-mt-24 space-y-4 p-6">
      <div>
        <h2 className="text-lg font-semibold">Subscription</h2>
        <p className="text-sm text-muted-foreground">
          {strip?.plan ? <>You are on <strong>{strip.plan.name}</strong>{strip.ended ? " (ended)" : strip.termEnd ? ` until ${new Date(strip.termEnd).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}.</> : "You have no plan yet."}
          {" "}To change, renew or buy a bundle, contact PitchSnack — online payment isn't open yet.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {mine.map((p) => (
          <div key={p.id} className={`space-y-2 rounded-[12px] border p-4 ${strip?.plan?.key === p.key && p.role === role ? "border-accent" : "border-border"}`}>
            <PlanBadge name={p.name} style={p.badge_style} />
            <div className="text-[15px] font-semibold">{price(p)} <span className="text-[12px] font-normal text-muted-foreground">· {p.term_months} months</span></div>
            <ul className="space-y-1 text-[12.5px]">
              {[
                [p.value_cap_thb_m == null ? "Any deal size" : `Deals up to ฿${p.value_cap_thb_m}M`, true],
                [req(p) ?? "No requests", !!req(p)],
                ...(p.completion_fee_pct != null ? [[`${p.completion_fee_pct}% completion fee`, true]] : []),
                ...(p.role === "seller" ? [["Data room", p.has_data_room]] : []),
                ...(p.role === "buyer" ? [["Shortlists & screening", p.has_shortlists]] : []),
              ].map(([l, on]) => (
                <li key={l as string} className={`flex items-center gap-1.5 ${on ? "" : "text-muted-foreground"}`}>{on ? <Check className="h-3 w-3" /> : <Lock className="h-3 w-3" />}{l as string}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}
