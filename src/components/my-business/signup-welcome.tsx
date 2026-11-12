import { setupText } from "@/i18n/language";
import { useEffect, useRef, useState } from "react";
import { R } from "@/components/login/signup-reg-copy";
import { WelcomeDialog } from "@/components/login/signup-reg-parts";
import { useNavigate } from "@tanstack/react-router";
import { StepBar, type StepItem } from "@/components/common/step-bar";
import { useTranslation } from "@/i18n/language";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Check, Flag, X } from "lucide-react";
import { dismissWelcome, getSignupState } from "@/lib/signup.functions";
import { ensureMySellerDraft, getSellerSetup } from "@/lib/seller-setup.functions";
import { SELLER_STEPS, emptyDraft, sellerShown, sellerValid, sellerAnswered, sellerQuestionKeys, isMissed, firstUnanswered, STEP_SHORT, STEP_FULL, stepIdx, type SellerDraft } from "@/lib/seller-wizard";
import { buyerSkips, shownSteps } from "@/lib/buyer-wizard";
import { WIZARD_QS, advisorSkips } from "@/lib/advisor-firm";
import { SELLER_OPTS, BUYER_OPTS, BUYER_REL_OPTS, ADVISOR_OPTS } from "@/components/login/signup-copy";
import { typeLabel } from "@/lib/investor-bands";

const ADVISOR_SEC: Record<string, string> = {
  type: "About the firm", name: "About the firm", web: "About the firm", services: "Services and fees",
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
  const { language } = useTranslation();
  const lang: "en" | "th" = language === "th" ? "th" : "en";
  const navigate = useNavigate();
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const seenSent = useRef(false);
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
  // The welcome lines and pop-up show on the first visit only: marked seen as soon as they show.
  useEffect(() => {
    if (!mine || mine.welcome_seen_at || seenSent.current) return;
    seenSent.current = true; setShowWelcome(true); setWelcomeOpen(true);
    void dismiss().catch(() => {});
  }, [mine, dismiss]);
  const { data: setup } = useQuery({
    queryKey: ["seller-setup", sellerId], enabled: !!sellerId, queryFn: () => fetchSetup({ data: { id: sellerId! } }), retry: false,
  });

  // Create business profile opens the wizard of the profile made at sign-up, never via the banner.
  const openSignupWizard = () => {
    const pid = mine?.profile_id;
    if (!pid) return;
    if (role === "seller") void navigate({ to: "/my-startups/setup/$id", params: { id: pid } });
    else if (role === "buyer") void navigate({ to: "/buyer/company/$id/setup", params: { id: pid } });
    else void navigate({ to: "/advisor/company/$id/setup", params: { id: pid } });
  };
  if (!mine) return null;
  const c = mine.company;
  const draft: SellerDraft | null = setup ? { ...emptyDraft(), highlights:setup.highlights,highlightsTh:setup.highlightsTh, shortDescription:setup.shortDescription,longDescription:setup.longDescription,productTags:setup.productTags,marketTags:setup.marketTags,shortDescriptionTh:setup.shortDescriptionTh,longDescriptionTh:setup.longDescriptionTh,productTagsTh:setup.productTagsTh,marketTagsTh:setup.marketTagsTh,founders:setup.founders, role: setup.role, name: setup.name, reg: setup.reg, web: setup.web, year: setup.year, city: setup.city,
    rev: setup.rev, size: setup.size, sector: setup.sector, licences: setup.licences as SellerDraft["licences"], iso: setup.iso, hasLogo: !!setup.media.logoPath, photos: setup.media.slots.length, deal: setup.listing.deal, stays: setup.listing.stays, months: setup.listing.months, price: setup.listing.price, listingName: setup.listing.name, nameOk: setup.listing.name ? true : undefined } : null;
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
    const sx = data?.sector ? ["sectors"] : [];
    const fs = individual ? ["role", "name", "web", ...sx] : [...(bRel ? ["role"] : []), "type", "name", "web", "year", "size", ...sx];
    const rel = bRel as "individual" | "corporate" | "agent" | null;
    const sk = buyerSkips(fs, { role: rel, type: bTypes[0] ?? "", web: c?.website ?? "", year: c?.year ?? "", name: c?.name ?? "", actsFor: rel === "agent" ? bTypes : [], sectors: data?.sector ? ["x"] : [] });
    sections = group(shownSteps(rel, sk).filter((s) => s.id !== "review").map((s) => s.sec));
  } else {
    const sk = advisorSkips(["type", "web", ...(data?.sector ? ["sectors"] : [])], { type: mine.first_answer, web: c?.website ?? "", year: "", team: "", agnostic: !!data?.sector });
    sections = group(WIZARD_QS.filter((q) => !sk.has(q)).map((q) => ADVISOR_SEC[q]!));
  }
  const N = sections.reduce((s, x) => s + x[1], 0);
  const mins = role === "advisor" ? 4 : 3;

  return (
    <div className="mb-4 space-y-4">
      {showWelcome && (
        <div className="sr">
          <p className="sr-mc">{R.mcA[lang].replace("{name}", mine.first_name || "")}<br />{R.wB[lang]}</p>
          <WelcomeDialog open={welcomeOpen} lang={lang} name={mine.first_name || ""}
            onClose={() => setWelcomeOpen(false)}
            onCreate={() => { setWelcomeOpen(false); openSignupWizard(); }} />
        </div>
      )}

      {showBoxes && c && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-[#E9EBF0] bg-card p-4 dark:border-border">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[#6B7280]">{setupText("Saved when you signed up")}</p>
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
                  <span className="w-28 text-[12.5px] text-[#6B7280]">{setupText(l ?? "")}</span><span className="text-sm font-semibold">{v}</span>
                </li>
              ))}
              <li className="flex items-center gap-2.5">
                {hasWeb ? <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-[#E3F3EA] text-[#1E7A4C]"><Check className="h-3.5 w-3.5" /></span>
                  : <span className="grid h-[22px] w-[22px] place-items-center"><span className="h-2 w-2 rounded-full bg-muted-foreground/40" /></span>}
                <span className="w-28 text-[12.5px] text-[#6B7280]">{setupText("Website")}</span>
                {hasWeb ? <span className="text-sm font-semibold">{c.website}</span> : <span className="text-sm text-muted-foreground">{setupText("Not added yet. Setup will ask for it.")}</span>}
              </li>
              {data?.sector && (
                <li className="flex items-center gap-2.5">
                  <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-[#E3F3EA] text-[#1E7A4C]"><Check className="h-3.5 w-3.5" /></span>
                  <span className="w-28 text-[12.5px] text-[#6B7280]">{data.sector.label}</span><span className="text-sm font-semibold">{data.sector.text}</span>
                </li>
              )}
            </ul>
            <p className="mt-3 text-[12.5px] text-[#6B7280]">{setupText("Setup won't ask for these again. You can change them when you review your answers.")}</p>
          </div>
          <div className="rounded-xl border border-[#E9EBF0] bg-card p-4 dark:border-border">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[#6B7280]">{setupText("What setup will ask")}</p>
            <ul className="space-y-2">
              {sections.map(([s, n], i) => (
                <li key={s} className="flex items-center gap-2.5 text-sm">
                  <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-[#EFF6FF] text-xs font-semibold text-[#2563EB]">{i + 1}</span>
                  <span className="flex-1">{setupText(s)}</span><span className="text-muted-foreground">{setupText(n === 1 ? "1 question" : `${n} questions`)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t pt-3 text-sm font-semibold">{N}{setupText("questions · about")} {mins}{setupText("minutes")}</p>
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
  const th = useTranslation().language === "th";
  const L = (en: string, t: string) => (th ? t : en);
  const navigate = useNavigate();
  const draft: SellerDraft = { ...emptyDraft(), highlights:setup.highlights,highlightsTh:setup.highlightsTh, shortDescription:setup.shortDescription,longDescription:setup.longDescription,productTags:setup.productTags,marketTags:setup.marketTags,shortDescriptionTh:setup.shortDescriptionTh,longDescriptionTh:setup.longDescriptionTh,productTagsTh:setup.productTagsTh,marketTagsTh:setup.marketTagsTh,founders:setup.founders, role: setup.role, name: setup.name, reg: setup.reg, web: setup.web, year: setup.year, city: setup.city,
    rev: setup.rev, size: setup.size, sector: setup.sector, licences: setup.licences as SellerDraft["licences"], iso: setup.iso, addr: setup.addr, reached: setup.reached, hasLogo: !!setup.media.logoPath, photos: setup.media.slots.length, deal: setup.listing.deal, stays: setup.listing.stays, months: setup.listing.months, price: setup.listing.price, listingName: setup.listing.name, nameOk: setup.listing.name ? true : undefined };
  // Optional questions count as answered once passed.
  const keys = sellerQuestionKeys(draft, setup.fromSignup);
  const ok = sellerAnswered(draft);
  const sellerN = keys.length, sellerDone = keys.filter((k) => ok[k]).length;
  const open = (k: string) => void navigate({ to: "/my-startups/setup/$id", params: { id: setup.id }, search: { step: k } });
  const items: StepItem[] = keys.map((k) => {
    const state: StepItem["state"] = ok[k] ? "done" : isMissed(k, draft) ? "missed" : "todo";
    const tip = state === "done" ? L("Answered · click to change", "ตอบแล้ว · กดเพื่อแก้ไข") : state === "missed" ? L("Not answered · click to answer", "ยังไม่ได้ตอบ · กดเพื่อตอบ") : L("Not reached yet · click to go there", "ยังไม่ถึงขั้นนี้ · กดเพื่อไปที่ขั้นนี้");
    return { key: k, label: L(...STEP_SHORT[k]), full: L(...STEP_FULL[k]), state, tip };
  });
  const missed = keys.filter((k) => isMissed(k, draft));
  const ri = stepIdx(setup.reached);
  const lineTo = Math.max(0, keys.filter((k) => stepIdx(k) <= ri).length - 1 + (setup.reached === "review" ? 1 : 0));
  const next = firstUnanswered(draft, setup.fromSignup);
  return (
    <div data-tour-banner data-tour-n={sellerN} data-tour-m={3} className="flex flex-col gap-4 rounded-[14px] border border-[#D6E7FC] bg-[#F4F9FF] px-[18px] py-4 dark:border-[#2B4763] dark:bg-[#16283A] md:grid md:grid-cols-[40px_minmax(0,1fr)_auto] md:gap-x-4 md:gap-y-0">
      <span className="hidden h-10 w-10 place-items-center rounded-lg bg-white md:col-start-1 md:row-start-1 md:grid"><Flag className="h-5 w-5 text-[#2563EB]" /></span>
      <div className="min-w-0 md:col-start-2 md:row-start-1">
        <p className="text-[14.5px] font-bold">{setupText(sellerDone ? "Finish setting up your business profile" : "Set up your business profile")}</p>
        <p className="text-[13px] text-muted-foreground">
          {setupText(sellerDone >= sellerN ? `All ${sellerN} questions are answered. Check your profile and save it.` : `Buyers can't find your business yet. Answer ${sellerN} short questions. It takes about 3 minutes and saves as you go.`)}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1.5 max-[599px]:order-last max-[599px]:w-full md:col-start-3 md:row-start-1">
        <button type="button" data-tour-btn data-setup-start onClick={() => open(next)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#1E3E56] px-4 text-sm font-semibold text-white hover:opacity-90 max-[599px]:w-full">
          {setupText(sellerDone ? "Continue setup" : "Create business profile")} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      {/* The step bar runs from the text's left edge to the button's right edge. */}
      <div className="mt-0 md:col-start-2 md:col-end-4 md:row-start-2 md:mt-4">
        <StepBar missedIcon variant="banner" steps={items} lineTo={lineTo} onPick={open} label={L("Setup questions", "คำถามตั้งค่า")}
          stepWord={(n) => L(`Step ${n}`, `ขั้นที่ ${n}`)} missedWord={L("Not answered", "ยังไม่ได้ตอบ")} />
      </div>
      {sellerDone > 0 && (
        <div className="md:col-start-2 md:col-end-4 md:row-start-3">
          <p className="mt-3.5 text-[13.5px] font-semibold text-[#374151] dark:text-[#C9D5F0]">
            {L(`${sellerDone} of ${sellerN} answered`, `ตอบแล้ว ${sellerDone} จาก ${sellerN} ข้อ`)}
          </p>
          {missed.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-bold text-[#B91C1C] dark:text-red-400">{L("Not answered:", "ยังไม่ได้ตอบ:")}</span>
              {missed.map((k) => (
                <button key={k} type="button" onClick={() => open(k)} aria-label={L(...STEP_FULL[k])}
                  className="inline-flex h-[30px] items-center whitespace-nowrap rounded-full border border-[#FECACA] bg-[#FEF2F2] px-3 text-[13px] font-semibold text-[#B91C1C] outline-none hover:bg-[#FEE2E2] focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/70">
                  {L(...STEP_SHORT[k])}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
