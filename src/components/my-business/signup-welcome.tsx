import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Check, Flag, X } from "lucide-react";
import { dismissWelcome, getSignupState } from "@/lib/signup.functions";
import { ensureMySellerDraft, getSellerSetup } from "@/lib/seller-setup.functions";
import { SELLER_STEPS, emptyDraft, sellerProgress, sellerShown, type SellerDraft } from "@/lib/seller-wizard";
import { buyerSkips, shownSteps } from "@/lib/buyer-wizard";
import { WIZARD_QS, advisorSkips } from "@/lib/advisor-firm";
import { SELLER_OPTS, BUYER_OPTS, BUYER_REL_OPTS, ADVISOR_OPTS } from "@/components/login/signup-copy";
import { typeLabel } from "@/lib/investor-bands";

const ADVISOR_SEC: Record<string, string> = {
  type: "About the firm", loc: "About the firm", name: "About the firm", web: "About the firm", services: "Services and fees",
  deal: "Your work", team: "Your work", sectors: "Your work", contact: "Contact", logo: "Your card", desc: "Your card",
};
const group = (secs: string[]): [string, number][] => {
  const out: [string, number][] = [];
  for (const s of secs) { const last = out[out.length - 1]; if (last && last[0] === s) last[1]++; else out.push([s, 1]); }
  return out;
};

/**
 * My Company after sign-up: welcome line, the seller's setup banner and the
 * two boxes (what sign-up saved / what setup asks). Counts come from the
 * wizards' own skip rules. Renders nothing for accounts that didn't sign up.
 */
export function SignupWelcome({ role, setupDone }: { role: "seller" | "buyer" | "advisor"; userId?: string; setupDone?: boolean }) {
  const fetchState = useServerFn(getSignupState);
  const dismiss = useServerFn(dismissWelcome);
  const ensureDraft = useServerFn(ensureMySellerDraft);
  const fetchSetup = useServerFn(getSellerSetup);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["signup-state"], queryFn: () => fetchState(), staleTime: 60_000 });
  const a = data?.answers;
  const mine = a && a.done_at && a.role === role ? a : null;
  const sellerId = role === "seller" ? mine?.profile_id ?? null : null;

  // Sellers who signed up before Drafts were made at sign-up get theirs now.
  const asked = useRef(false);
  useEffect(() => {
    if (!mine || role !== "seller" || mine.profile_id || asked.current) return;
    asked.current = true;
    ensureDraft().then((r) => { if (r.id) { void qc.invalidateQueries({ queryKey: ["signup-state"] }); void qc.invalidateQueries(); } }).catch(() => {});
  }, [mine, role, ensureDraft, qc]);
  const { data: setup } = useQuery({
    queryKey: ["seller-setup", sellerId], enabled: !!sellerId, queryFn: () => fetchSetup({ data: { id: sellerId! } }), retry: false,
  });

  if (!mine) return null;
  const c = mine.company;
  const draft: SellerDraft | null = setup ? { ...emptyDraft(), role: setup.role, name: setup.name, reg: setup.reg, web: setup.web, year: setup.year, city: setup.city,
    rev: setup.rev, size: setup.size, sector: setup.sector, licences: setup.licences as SellerDraft["licences"], iso: setup.iso } : null;
  const sellerOpen = role === "seller" && !!setup && !setup.setupDoneAt;
  const showBoxes = role === "seller" ? sellerOpen : !setupDone;
  const opts = role === "seller" ? SELLER_OPTS : role === "buyer" ? BUYER_OPTS : ADVISOR_OPTS;
  // Buyers: step 2 is who they are; older sign-ups stored the investor type instead.
  const bRel = role === "buyer" ? (mine.buyer_relation ?? (mine.first_answer === "Individual Investor" ? "individual" : null)) : null;
  const bTypes = role === "buyer" ? (mine.buyer_relation ? mine.investor_types ?? [] : [mine.first_answer]) : [];
  const ansLabel = role === "buyer" && mine.buyer_relation
    ? BUYER_REL_OPTS.find((o) => o.v === mine.buyer_relation)?.t.en ?? mine.first_answer
    : opts.find((o) => o.v === mine.first_answer)?.t.en ?? mine.first_answer;
  const individual = role === "buyer" && bRel === "individual";
  const hasWeb = !!c?.website;
  const sizeLabel = c?.size ? (role === "advisor" ? `${c.size} people` : c.size === "500+" ? "More than 500" : c.size.replace("-", "–")) : null;

  // What the wizard still asks, from the wizards' own skip rules.
  let sections: [string, number][];
  if (role === "seller") {
    const d = draft ?? { ...emptyDraft(), role: mine.first_answer as SellerDraft["role"], name: c?.name ?? "", web: c?.website ?? "", year: c?.year ?? "", size: c?.size ?? null };
    sections = group(sellerShown(d, setup?.fromSignup ?? ["role", "name", "web", "year", "size"]).map((i) => SELLER_STEPS[i]!.sec));
  } else if (role === "buyer") {
    const fs = individual ? ["role", "name", "web"] : [...(bRel ? ["role"] : []), "type", "name", "web", "year", "size"];
    const rel = bRel as "individual" | "corporate" | "agent" | null;
    const sk = buyerSkips(fs, { role: rel, type: bTypes[0] ?? "", web: c?.website ?? "", year: c?.year ?? "", name: c?.name ?? "", actsFor: rel === "agent" ? bTypes : [] });
    sections = group(shownSteps(rel, sk).filter((s) => s.id !== "review").map((s) => s.sec));
  } else {
    const sk = advisorSkips(["type", "web"], { type: mine.first_answer, web: c?.website ?? "", year: "", team: "" });
    sections = group(WIZARD_QS.filter((q) => !sk.has(q)).map((q) => ADVISOR_SEC[q]!));
  }
  const N = sections.reduce((s, x) => s + x[1], 0);
  const mins = role === "advisor" ? 4 : 3;

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

      {showBoxes && c && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-[#E9EBF0] bg-card p-4 dark:border-border">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[#6B7280]">Saved when you signed up</p>
            <ul className="space-y-2">
              {[
                [role === "seller" ? "You are" : role === "buyer" ? (mine.buyer_relation ? "You are" : "Investor type") : "Firm type", ansLabel],
                ...(role === "buyer" && mine.buyer_relation === "corporate" && bTypes[0] ? [["Investor type", typeLabel(bTypes[0])]] : []),
                ...(role === "buyer" && mine.buyer_relation === "agent" && bTypes.length ? [["Acts for", bTypes.map(typeLabel).join(", ")]] : []),
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
          </div>
        </div>
      )}
    </div>
  );
}

/** Seller setup banner, shown inside the My Company panel while the business setup isn't done. */
export function useSellerSetup(id: string | null | undefined) {
  const fetchSetup = useServerFn(getSellerSetup);
  return useQuery({ queryKey: ["seller-setup", id], enabled: !!id, queryFn: () => fetchSetup({ data: { id: id! } }), retry: false, staleTime: 30_000 });
}

export function SellerSetupBanner({ setup }: { setup: Awaited<ReturnType<typeof getSellerSetup>> }) {
  const draft: SellerDraft = { ...emptyDraft(), role: setup.role, name: setup.name, reg: setup.reg, web: setup.web, year: setup.year, city: setup.city,
    rev: setup.rev, size: setup.size, sector: setup.sector, licences: setup.licences as SellerDraft["licences"], iso: setup.iso };
  const prog = sellerProgress(draft, setup.fromSignup);
  const sellerN = prog.N, sellerDone = prog.n;
  return (
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
        <Link to="/my-startups/setup/$id" params={{ id: setup.id }} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1E3E56] px-4 text-sm font-semibold text-white hover:opacity-90">
          {sellerDone ? "Continue setup" : "Start setup"} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
