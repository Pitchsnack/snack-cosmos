import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { AlarmClock, Clock, X } from "lucide-react";
import { usePlanStrip } from "@/components/marketplace/plan-strip";
import { freePlanSeen } from "@/lib/plan.functions";
import { dateEn } from "@/lib/access-codes";

const WILL = {
  seller: "you go back to Entry, free: buyers can still find you, but you can’t send contact requests.",
  buyer: "you’ll have no plan, as a new buyer does, so NDA requests need a plan again.",
  advisor: "you’ll have no plan, as a new advisor does, so contact requests need a plan again.",
} as const;
const BROWSE = { seller: "/marketplace/browse", buyer: "/marketplace/browse", advisor: "/marketplace/browse" } as const;

const bar = "mb-4 flex flex-wrap items-start gap-3 rounded-[12px] border border-[#F1C98A] bg-[#FFF6E6] px-4 py-3 text-[13px] leading-[1.55] text-[#7A4A05]";

/** The 14-day reminder bar, and the one-time notice after a free plan ends (shown on Settings › Subscription). */
export function FreePlanBars() {
  const { data } = usePlanStrip();
  const loc = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const seen = useServerFn(freePlanSeen);
  const [hidden, setHidden] = useState(false);
  const [endShown, setEndShown] = useState<null | { plan: string; lastDay: string }>(null);
  const marked = useRef(false);
  const role = data?.role === "seller" || data?.role === "buyer" || data?.role === "advisor" ? data.role : null;
  const onSettings = loc.pathname === "/preferences";

  // First visit after the end: land on Settings › Subscription once, and count it as seen as soon as it shows.
  useEffect(() => {
    if (!role || !data?.freeEnded || marked.current) return;
    if (!onSettings) { navigate({ to: "/preferences", hash: "subscription" }); return; }
    marked.current = true;
    setEndShown(data.freeEnded);
    void seen({ data: { what: "end_seen" } }).then(() => qc.invalidateQueries({ queryKey: ["plan-strip"] }));
  }, [role, data?.freeEnded, onSettings]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!role || !data) return null;

  if (endShown && onSettings) {
    const t = role === "seller"
      ? <>You’re on <b>Entry</b> now, free: buyers can still find you, but you can’t send contact requests. Your listing, profile, favourites and messages are kept. Choose a plan to carry on.</>
      : role === "buyer"
        ? <>You have <b>no plan</b> now, as a new buyer does, so NDA requests need a plan. Your profile, favourites and conversations are kept. Choose a plan to carry on.</>
        : <>You have <b>no plan</b> now, as a new advisor does, so contact requests need a plan. Your firm profile, favourites and conversations are kept. Choose a plan to carry on.</>;
    return (
      <div className={bar} role="status">
        <Clock className="mt-[1px] size-[18px] shrink-0 text-[#B7791F]" />
        <p className="m-0 min-w-0 flex-1"><b>Your free {endShown.plan} plan ended on {dateEn(endShown.lastDay)}.</b> {t}</p>
        <button type="button" onClick={() => { setEndShown(null); navigate({ to: BROWSE[role] }); }}
          className="h-9 shrink-0 rounded-[9px] border border-[#CDD2DB] bg-white px-3.5 text-[13.5px] font-semibold text-[#151A28]">
          {role === "seller" ? "Continue with Entry" : "Decide later"}
        </button>
      </div>
    );
  }

  const f = data.free;
  if (!f || f.daysLeft > 14 || f.daysLeft < 0 || f.hiddenToday || hidden) return null;
  const plan = data.plan?.name ?? "";
  return (
    <div className={bar} role="status">
      <AlarmClock className="mt-[1px] size-[18px] shrink-0 text-[#B7791F]" />
      <p className="m-0 min-w-0 flex-1">
        <b>{f.daysLeft === 0 ? `Your free ${plan} plan ends today.` : `Your free ${plan} plan ends on ${dateEn(f.lastDay)}, in ${f.daysLeft === 1 ? "1 day" : `${f.daysLeft} days`}.`}</b>{" "}
        Choose a plan to keep it. If you don’t, {WILL[role]} Nothing is deleted.
      </p>
      <button type="button" onClick={() => navigate({ to: "/preferences", hash: "subscription" })}
        className="h-9 shrink-0 rounded-[9px] bg-[#192957] px-3.5 text-[13.5px] font-semibold text-white">Choose a plan</button>
      <button type="button" aria-label="Hide until tomorrow" title="Hide until tomorrow"
        onClick={() => { setHidden(true); void seen({ data: { what: "hide_bar" } }); }}
        className="grid size-[34px] shrink-0 place-items-center rounded-[9px] text-[#7A4A05] hover:bg-[#FCEBD0]"><X className="size-4" /></button>
    </div>
  );
}
