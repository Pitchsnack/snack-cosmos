import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Check, Flag, X } from "lucide-react";
import { dismissWelcome, getSignupState } from "@/lib/signup.functions";
import { answeredFlags, emptyDraft, firstOpenStep, loadDraft, saveDraft, type SellerDraft } from "@/lib/seller-wizard";
import { SELLER_OPTS, BUYER_OPTS, ADVISOR_OPTS } from "@/components/login/signup-copy";

/**
 * My Company after sign-up: welcome line, the seller's setup banner, the
 * "look first" link and the two boxes (what sign-up saved / what setup asks).
 * Renders nothing for accounts that didn't come through sign-up.
 */
export function SignupWelcome({ role, userId, setupDone }: { role: "seller" | "buyer" | "advisor"; userId?: string; setupDone?: boolean }) {
  const fetchState = useServerFn(getSignupState);
  const dismiss = useServerFn(dismissWelcome);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["signup-state"], queryFn: () => fetchState(), staleTime: 60_000 });
  const [draft, setDraft] = useState<SellerDraft | null>(null);
  const a = data?.answers;
  const mine = a && a.done_at && a.role === role ? a : null;

  // Seller: the business Draft lives with the seller wizard; seed it once from sign-up.
  useEffect(() => {
    if (!mine || role !== "seller" || !userId || !mine.company) return;
    const seedKey = `ps.sellerDraft.seeded.${userId}`;
    let d = loadDraft(userId);
    if (!d && !localStorage.getItem(seedKey)) {
      const c = mine.company;
      d = { ...emptyDraft(), role: mine.first_answer as SellerDraft["role"], name: c.name, web: c.website ?? "", year: c.year ?? "",
        size: c.size === "500+" ? "More than 500" : c.size };
      d.step = firstOpenStep(d);
      saveDraft(userId, d);
      localStorage.setItem(seedKey, "1");
    }
    setDraft(d);
    const on = () => setDraft(loadDraft(userId));
    window.addEventListener("ps-seller-draft", on);
    return () => window.removeEventListener("ps-seller-draft", on);
  }, [mine, role, userId]);

  if (!mine) return null;
  const c = mine.company;
  const showBoxes = role === "seller" ? !!draft : !setupDone;
  const opts = role === "seller" ? SELLER_OPTS : role === "buyer" ? BUYER_OPTS : ADVISOR_OPTS;
  const ansLabel = opts.find((o) => o.v === mine.first_answer)?.t.en ?? mine.first_answer;
  const individual = role === "buyer" && mine.first_answer === "Individual Investor";
  const hasWeb = !!c?.website;
  const sizeLabel = c?.size ? (role === "advisor" ? `${c.size} people` : c.size === "500+" ? "More than 500" : c.size.replace("-", "–")) : null;

  // What the wizard still asks (from the wizards' own question lists, minus sign-up answers).
  const sections: [string, number][] =
    role === "seller" ? [["About the company", hasWeb ? 2 : 3], ["Financial & business profile", 2], ["Licences and standards", 1]]
    : role === "advisor" ? [["About the firm", hasWeb ? 2 : 3], ["Services and fees", 1], ["Your work", 2], ["Contact", 1], ["Your card", 2]]
    : individual ? [["About the firm", hasWeb ? 1 : 2], ["Fund & ticket", 1], ["Buying requirement", 3], ["Public profile", 1]]
    : [["About you", 1], ["About the firm", hasWeb ? 2 : 3], ["Fund & ticket", 2], ["Buying requirement", 3], ["Public profile", 1]];
  const N = sections.reduce((s, x) => s + x[1], 0);
  const mins = role === "advisor" ? 4 : 3;
  const look = role === "seller" ? { to: "/marketplace/browse", label: "Look at investors first" }
    : role === "buyer" ? { to: "/marketplace/browse", label: "Look at listings first" } : { to: "/marketplace/browse", label: "Look at the marketplace first" };
  const sellerQs = hasWeb ? [1, 4, 5, 7, 8] : [1, 2, 4, 5, 7, 8];
  const sellerN = sellerQs.length;
  const sellerDone = draft ? sellerQs.filter((i) => answeredFlags(draft)[i]).length : 0;

  return (
    <div className="mb-4 space-y-4">
      {!mine.welcome_seen_at && (
        <div className="flex items-center gap-2 rounded-xl bg-[#ECFDF3] py-[9px] pl-3.5 pr-2 text-sm font-semibold text-[#15803D] dark:bg-[#183326] dark:text-[#6FD08C]">
          <Check className="h-[17px] w-[17px]" />
          <span className="flex-1">Welcome, {mine.first_name || "there"}. Start your setup below, or look around first.</span>
          <button aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-black/5"
            onClick={async () => { qc.setQueryData(["signup-state"], { ...data, answers: { ...mine, welcome_seen_at: new Date().toISOString() } }); await dismiss(); }}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {role === "seller" && draft && (
        <div className="flex flex-wrap items-center gap-4 rounded-[14px] border border-[#D6E7FC] bg-[#F4F9FF] px-[18px] py-4 dark:border-[#2B4763] dark:bg-[#16283A]">
          <span className="hidden h-10 w-10 place-items-center rounded-lg bg-white md:grid"><Flag className="h-5 w-5 text-[#2563EB]" /></span>
          <div className="min-w-[240px] flex-1">
            <p className="text-[14.5px] font-bold">{sellerDone ? "Finish setting up your business profile" : "Set up your business profile"}</p>
            <p className="text-[13px] text-muted-foreground">
              {sellerDone >= sellerN ? `All ${sellerN} questions are answered. Check your profile and save it.` : `Buyers can't find your business yet. Answer ${sellerN} short questions. It takes about 3 minutes and saves as you go.`}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="h-1.5 w-[180px] overflow-hidden rounded-full border border-[#D6E7FC] bg-white"><span className="block h-full bg-[#60A5FA]" style={{ width: `${(sellerDone / sellerN) * 100}%` }} /></span>
              <span className="text-xs font-semibold text-[#2563EB] dark:text-[#8CBFF0]">{sellerDone} of {sellerN} answered</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Link to="/my-startups/new" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1E3E56] px-4 text-sm font-semibold text-white hover:opacity-90">
              {sellerDone ? "Continue setup" : "Start setup"} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to={look.to as never} className="text-[12.5px] font-semibold text-primary hover:underline">{look.label}</Link>
          </div>
        </div>
      )}
      {role !== "seller" && showBoxes && (
        <div className="text-right"><Link to={look.to as never} className="text-[12.5px] font-semibold text-primary hover:underline">{look.label}</Link></div>
      )}

      {showBoxes && c && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-[#E9EBF0] bg-card p-4 dark:border-border">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[#6B7280]">Saved when you signed up</p>
            <ul className="space-y-2">
              {[
                [role === "seller" ? "You are" : role === "buyer" ? "Investor type" : "Firm type", ansLabel],
                [role === "seller" ? "Company name" : "Firm name", c.name],
                ...(individual ? [] : [["Year founded", c.year], ["Company size", sizeLabel]]),
              ].map(([l, v]) => (
                <li key={l} className="flex items-center gap-2.5">
                  <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-[#E3F3EA] text-[#1E7A4C]"><Check className="h-3.5 w-3.5" /></span>
                  <span className="w-28 text-[12.5px] text-[#6B7280]">{l}</span><span className="text-sm font-semibold">{v}</span>
                </li>
              ))}
              <li className="flex items-center gap-2.5">
                {hasWeb ? <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-[#E3F3EA] text-[#1E7A4C]"><Check className="h-3.5 w-3.5" /></span>
                  : <span className="grid h-[22px] w-[22px] place-items-center"><span className="h-2 w-2 rounded-full bg-muted-foreground/40" /></span>}
                <span className="w-28 text-[12.5px] text-[#6B7280]">Website</span>
                {hasWeb ? <span className="text-sm font-semibold">{c.website}</span> : <span className="text-sm text-muted-foreground">Not added yet. Setup will ask for it.</span>}
              </li>
            </ul>
            <p className="mt-3 text-[12.5px] text-[#6B7280]">Setup won't ask for these again. You can change them when you review your answers.</p>
          </div>
          <div className="rounded-xl border border-[#E9EBF0] bg-card p-4 dark:border-border">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[#6B7280]">What setup will ask</p>
            <ul className="space-y-2">
              {sections.map(([s, n], i) => (
                <li key={s} className="flex items-center gap-2.5 text-sm">
                  <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-[#EFF6FF] text-xs font-semibold text-[#2563EB]">{i + 1}</span>
                  <span className="flex-1">{s}</span><span className="text-muted-foreground">{n === 1 ? "1 question" : `${n} questions`}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t pt-3 text-sm font-semibold">{N} questions · about {mins} minutes</p>
            {role === "buyer" && !individual && <p className="text-[12.5px] text-muted-foreground">One fewer if you act on behalf of the buyer.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
