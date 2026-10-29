import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, Briefcase, CircleHelp, GitBranch, Handshake, Inbox, Lock, Search, Sparkles, Users, X, type LucideIcon } from "lucide-react";
import { useSessionContext } from "@/hooks/use-session-context";
import { useTranslation } from "@/i18n/language";
import { TH_TOUR } from "@/i18n/th-tour";
import { markWelcomeTourSeen, type SessionContextDTO } from "@/lib/session-context.functions";
import { marketplaceMenu, type MenuItem } from "@/components/marketplace/marketplace-frame";
import { isReportOrdered } from "@/components/my-business/locked-report-page";
import { usePlanStrip } from "@/components/marketplace/plan-strip";
import { cn } from "@/lib/utils";

type Role = "seller" | "buyer" | "advisor";

/* ------------------------------ open state ------------------------------- */
type Open = { mode: "welcome" | "tour"; fromWelcome: boolean; returnTo: HTMLElement | null; step: number };
let state: Open | null = null;
const subs = new Set<() => void>();
const set = (s: Open | null) => { state = s; subs.forEach((f) => f()); };
const useOpen = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state, () => null);
/** True while the welcome or the tour is open. */
export const useTourIsOpen = () => !!useOpen();
/** The ? button: the tour from step 1, on this page, without the welcome. */
export function startTour(returnTo: HTMLElement | null) { set({ mode: "tour", fromWelcome: false, returnTo, step: 0 }); }
export function useTourEligible() {
  const { data } = useSessionContext();
  const r = data?.user?.accountRole;
  return r === "seller" || r === "buyer" || r === "advisor" ? (r as Role) : null;
}

/* --------------------------------- copy ---------------------------------- */
const TINT: Record<Role, string> = {
  seller: "bg-[#FEF3DE] text-[#B45309] dark:bg-[rgba(246,168,35,.16)] dark:text-[#F6A823]",
  buyer: "bg-[#EEF0FF] text-[#4338CA] dark:bg-[rgba(129,140,248,.18)] dark:text-[#A5B4FC]",
  advisor: "bg-[#E0F5F2] text-[#0F766E] dark:bg-[rgba(45,212,191,.16)] dark:text-[#5EEAD4]",
};
const EYEBROW: Record<Role, string> = {
  seller: "text-[#8A4B06] dark:text-[#F6A823]",
  buyer: "text-[#4338CA] dark:text-[#A5B4FC]",
  advisor: "text-[#0F766E] dark:text-[#5EEAD4]",
};
const ROWS: Record<Role, [LucideIcon, string][]> = {
  seller: [[Users, "Find investors and invite them to view your listing"], [Briefcase, "Find advisers, valuers and lawyers to help you sell"], [GitBranch, "Run each deal step by step, from NDA to payment"], [Lock, "Stay anonymous until you approve a buyer's NDA"]],
  buyer: [[Search, "Find businesses for sale that match your mandate"], [Briefcase, "Find advisers, valuers and lawyers to help you buy"], [GitBranch, "Run each deal step by step, from NDA to payment"], [Lock, "Keep your firm's name hidden until a seller approves your NDA"]],
  advisor: [[Users, "Find sellers and buyers for your clients"], [Handshake, "Join your clients' deals and follow each step"], [Inbox, "Answer enquiries from sellers and buyers, and send proposals"]],
};
const SEC_TITLE: Record<Role, Record<string, string>> = {
  seller: { discover: "Find investors and advisors", workspace: "Run your sale", tools: "Reports buyers trust", account: "Your settings" },
  buyer: { discover: "Find businesses and advisors", workspace: "Run your deals", tools: "Reports buyers trust", account: "Your settings" },
  advisor: { discover: "Find sellers and buyers", workspace: "Work on your clients' deals", tools: "Reports buyers trust", account: "Your settings" },
};
const SEC_EYEBROW: Record<string, string> = { discover: "Discover", workspace: "My Workspace", tools: "Tools", account: "Account" };
const LINES: Record<Role, Record<string, string>> = {
  seller: {
    "Browse investors": "Investors looking for businesses like yours. Connect invites one to view your listing; your name stays hidden.",
    "Browse advisors": "Advisers, valuers, lawyers and accountants. Asking a firm for help is free on every plan.",
    Favourites: "Investors you starred, kept in one place.",
    Invitations: "Buyers you invited with Connect, and the NDA requests they send you to approve.",
    "My Company": "Your business profile. Buyers see an anonymous version until you approve their NDA.",
    Pipeline: "Buyers you invited, NDA requests to approve, and each deal's steps from NDA to payment.",
    Contacts: "Buyers whose NDA you approved, and your advisors, with their contact details.",
    Messages: "Talk with buyers after an NDA and with advisors you contacted, and ask the Help desk anything.",
    "My Financials": "A verified financial report, prepared by PitchSnack from your DBD filings.",
    "Company Valuation": "An estimate of what your business is worth, built on that report.",
    "Company Risk": "How a buyer will read your cash and debt.",
    "My Profile": "Your details, and the contact card buyers see after an NDA.",
    Notifications: "Turn email alerts on or off. The bell at the top lists every alert.",
  },
  buyer: {
    "Browse listings": "Businesses for sale, shown without their names until the seller approves your NDA.",
    "Browse advisors": "Advisers, valuers, lawyers and accountants. Asking a firm for help is free on every plan.",
    Favourites: "Listings you starred or requested an NDA for, in one place.",
    Invitations: "Sellers who invited you to view their business. Open one to see it and decide.",
    "My Company": "Your investor profile. Sellers see your type and ranges, not your name, until they approve your NDA.",
    Pipeline: "Sellers who invited you, your NDA requests, and each deal's steps from NDA to payment.",
    Contacts: "Sellers who approved your NDA, and your advisors, with their contact details.",
    Messages: "Talk with sellers after an NDA and with advisors you contacted, and ask the Help desk anything.",
    "My Profile": "Your details, and the contact card sellers see after an NDA.",
    Notifications: "Turn email alerts on or off. The bell at the top lists every alert.",
  },
  advisor: {
    "Browse marketplace": "Every live seller and buyer in one list, shown without their names.",
    "Browse prospects": "Every live seller and buyer in one list, shown without their names.",
    Favourites: "Sellers and buyers you starred, kept in one place.",
    "My Company": "Your firm's profile in Browse advisors. Sellers and buyers see all of it, apart from your full address.",
    "My Pipeline": "Your clients' invitations, and the deals you joined, step by step.",
    Pipeline: "Your clients' invitations, and the deals you joined, step by step.",
    Messages: "Enquiries from sellers and buyers, chats on your clients' deals, and the Help desk.",
    "My Profile": "Your details, and the contact card sellers and buyers see.",
  },
};
const START_TITLE: Record<Role, string> = { seller: "Set up your business profile", buyer: "Set up your investor profile", advisor: "Set up your firm profile" };
const START_TEXT: Record<Role, string> = {
  seller: "Answer {N} short questions, in about {m} minutes, then check your listing and submit it. Once PitchSnack approves it, buyers can find your business.",
  buyer: "Answer {N} short questions, in about {m} minutes. Then publish your profile so sellers can find you in Browse investors.",
  advisor: "Answer {N} short questions, in about {m} minutes. Then publish your profile so sellers and buyers can find you in Browse advisors.",
};
const TABS: Record<Role, string> = {
  seller: "The Buyer and Advisor tabs are for other kinds of accounts, so they're greyed out.",
  buyer: "The Seller and Advisor tabs are for other kinds of accounts, so they're greyed out.",
  advisor: "The Seller and Buyer tabs are for other kinds of accounts, so they're greyed out.",
};
const TOAST = "You can take the tour again from the ? button at the top.";

function fill(s: string, v: Record<string, string | number>) { return s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? "")); }
function fmtDay(day: string, th: boolean) {
  const d = new Date(`${day.slice(0, 10)}T12:00:00Z`);
  return d.toLocaleDateString(th ? "th-TH" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).replace(/ /g, "\u00a0");
}

/* --------------------------------- steps --------------------------------- */
type Step =
  | { kind: "account" }
  | { kind: "section"; key: string; items: MenuItem[] }
  | { kind: "start" };

const DRAWER_Q = "(max-width: 960px)";
const isDrawer = () => typeof window !== "undefined" && window.matchMedia(DRAWER_Q).matches;
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const visible = (el: Element | null) => !!el && (el as HTMLElement).getClientRects().length > 0;
const pick = (sel: string) => Array.from(document.querySelectorAll(sel)).find(visible) as HTMLElement | undefined;
const findBanner = () => pick("[data-tour-banner]");
const setMenu = (active: boolean, open: boolean) => window.dispatchEvent(new CustomEvent("ps-tour-menu", { detail: { active, open } }));
const pageTitle = () => {
  const h = pick("main h1") ?? pick("main h2");
  if (h && !h.hasAttribute("tabindex")) h.setAttribute("tabindex", "-1");
  return h;
};

/* --------------------------------- host ---------------------------------- */
export function WelcomeTourHost() {
  const role = useTourEligible();
  const { data } = useSessionContext();
  const open = useOpen();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const markFn = useServerFn(markWelcomeTourSeen);
  const seenAt = data?.user?.welcomeTourSeenAt ?? null;
  const onMyCompany = path === "/my-startups" || path === "/marketplace/my-company";

  const mark = useCallback(() => {
    const at = new Date().toISOString();
    qc.setQueryData<SessionContextDTO>(["session-context"], (d) => (d?.user ? { ...d, user: { ...d.user, welcomeTourSeenAt: d.user.welcomeTourSeenAt ?? at } } : d));
    void markFn().catch(() => {});
  }, [qc, markFn]);

  // First visit to My Company: open the welcome once the page's content is there.
  const tried = useRef(false);
  useEffect(() => {
    if (!role || !data?.user || seenAt || !onMyCompany || state || tried.current) return;
    let n = 0, found = 0;
    const id = window.setInterval(() => {
      n++;
      const ready = !!findBanner() || (!!pick("main h1, main h2") && !document.querySelector("[data-page-loading], .animate-pulse"));
      if (ready) found++;
      if (found >= 2 || n > 40) {
        window.clearInterval(id);
        if (!state && ready) { tried.current = true; set({ mode: "welcome", fromWelcome: true, returnTo: null, step: 0 }); }
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [role, data?.user, seenAt, onMyCompany]);

  // Leaving the page closes it, as Skip does.
  const lastPath = useRef(path);
  useEffect(() => {
    if (lastPath.current !== path && state) close("skip");
    lastPath.current = path;
  });

  const close = useCallback((how: "skip" | "finish" | "banner") => {
    const s = state;
    if (!s) return;
    set(null);
    if (s.mode === "tour") setMenu(false, false);
    if (s.fromWelcome) mark();
    if (s.fromWelcome && how !== "banner") toast(tr0(TOAST), { icon: <CircleHelp className="h-[17px] w-[17px] text-[#F6A823]" /> });
    if (how !== "banner") window.setTimeout(() => (s.returnTo && document.contains(s.returnTo) ? s.returnTo : pageTitle())?.focus({ preventScroll: true }), 30);
  }, [mark]);

  if (!role || !open || typeof document === "undefined") return null;
  return createPortal(
    <Layer>
      {open.mode === "welcome"
        ? <Welcome role={role} firstName={data?.user?.firstName ?? ""} individual={(data?.user?.buyerType ?? "") === "Individual Investor"}
            onSkip={() => close("skip")} onStart={() => set({ ...open, mode: "tour", step: 0 })} />
        : <Tour role={role} open={open} onClose={close} />}
    </Layer>,
    document.body,
  );
}

// Toast text in the current language (outside the render tree).
function tr0(s: string) { return typeof document !== "undefined" && document.documentElement.lang === "th" ? TH_TOUR[s] ?? s : s; }

/** Makes the rest of the page inert while the welcome or the tour is open. */
function Layer({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    toast.dismiss();
    const mine = ref.current;
    const others = Array.from(document.body.children).filter((el) => el !== mine && !(el as HTMLElement).inert) as HTMLElement[];
    others.forEach((el) => { el.inert = true; });
    const obs = new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => {
      if (n instanceof HTMLElement && n !== mine && !n.hasAttribute("data-sonner-toaster")) { n.inert = true; others.push(n); }
    })));
    obs.observe(document.body, { childList: true });
    return () => { obs.disconnect(); others.forEach((el) => { el.inert = false; }); };
  }, []);
  return <div ref={ref} data-welcome-tour className="relative z-[200]">{children}</div>;
}

function useT() {
  const { language, t } = useTranslation();
  const th = language === "th";
  return { th, T: (s: string) => (th ? TH_TOUR[s] ?? t(s) : s), t };
}

/** Tab stays inside the dialog. */
function trapTab(e: React.KeyboardEvent, box: HTMLElement | null) {
  if (e.key !== "Tab" || !box) return;
  const f = Array.from(box.querySelectorAll<HTMLElement>("button, [href], [tabindex]:not([tabindex='-1'])")).filter((x) => !x.hasAttribute("disabled") && visible(x));
  if (!f.length) return;
  const first = f[0]!, last = f[f.length - 1]!;
  const a = document.activeElement;
  if (e.shiftKey && (a === first || !box.contains(a) || a === box.querySelector("[data-tour-title]"))) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
}

/* -------------------------------- welcome -------------------------------- */
function Welcome({ role, firstName, individual, onSkip, onStart }: { role: Role; firstName: string; individual: boolean; onSkip: () => void; onStart: () => void }) {
  const { th, T } = useT();
  const box = useRef<HTMLDivElement>(null);
  const go = useRef<HTMLButtonElement>(null);
  useEffect(() => { go.current?.focus(); }, []);
  const rows = ROWS[role].map(([I, s], i): [LucideIcon, string] => (role === "buyer" && i === 3 && individual ? [I, "Keep your name hidden until a seller approves your NDA"] : [I, s]));
  const title = firstName ? fill(T("Welcome to PitchSnack, {name}"), { name: firstName }) : T("Welcome to PitchSnack");
  return (
    <>
      <div aria-hidden className="fixed inset-0 bg-[rgba(15,23,42,.55)] dark:bg-[rgba(0,0,0,.6)]" />
      <div className="fixed inset-0 grid place-items-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onSkip(); }} onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); onSkip(); return; } trapTab(e, box.current); }}>
        <div ref={box} role="dialog" aria-modal="true" aria-labelledby="wt-title" aria-describedby="wt-lead"
          className="relative max-h-[calc(100dvh-32px)] w-[min(520px,100%)] overflow-y-auto rounded-[18px] bg-white px-7 pb-6 pt-7 text-[#151A28] shadow-[0_30px_70px_rgba(15,23,42,.32)] max-[600px]:px-5 max-[600px]:pb-5 max-[600px]:pt-[22px] dark:border dark:border-[#323A4D] dark:bg-[#1E2433] dark:text-[#F3F4F6]">
          <div className={cn("grid h-[52px] w-[52px] place-items-center rounded-[14px]", TINT[role])}><Sparkles className="h-[26px] w-[26px]" /></div>
          <h2 id="wt-title" className={cn("mt-[18px] pr-7 font-bold max-[600px]:mt-4 max-[600px]:text-[23px]", th ? "text-[25px] leading-[1.4]" : "text-[26px] leading-[1.25] tracking-[-0.01em]")}
            style={{ fontFamily: th ? "'Noto Sans Thai', sans-serif" : "'Space Grotesk', system-ui, sans-serif" }}>{title}</h2>
          <p id="wt-lead" className="mt-2 text-[15px] leading-[1.55] text-[#434A5C] dark:text-[#C5CAD6]">{T(`This is your ${role} workspace. Here you can:`)}</p>
          <ul className="mt-4 space-y-2.5">
            {rows.map(([I, s]) => (
              <li key={s} className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[#F4F5F8] text-[#4B5263] dark:bg-[#2A3142] dark:text-[#C5CAD6]"><I className="h-[18px] w-[18px]" /></span>
                <span className="text-[14.5px] font-medium leading-[1.4] text-[#151A28] dark:text-[#F3F4F6]">{T(s)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-[22px] border-t border-[#EEF0F3] pt-[18px] text-[14px] text-[#434A5C] dark:border-[#323A4D] dark:text-[#C5CAD6]">{T("Take a one-minute tour to see what each menu is for.")}</div>
          <div className="mt-4 flex justify-end gap-2.5 max-[600px]:flex-col-reverse">
            <button type="button" onClick={onSkip}
              className="inline-flex h-[42px] items-center justify-center rounded-[10px] border border-[#DCDFE5] bg-white px-[18px] text-[14.5px] font-semibold text-[#151A28] hover:bg-[#F6F7F9] max-[600px]:h-[46px] max-[600px]:w-full dark:border-[#3A4256] dark:bg-transparent dark:text-[#F3F4F6] dark:hover:bg-white/[.06]">
              {T("Skip for now")}
            </button>
            <button ref={go} type="button" onClick={onStart}
              className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[10px] border border-[#1E2A4A] bg-[#1E2A4A] px-[18px] text-[14.5px] font-semibold text-white hover:bg-[#26355C] max-[600px]:h-[46px] max-[600px]:w-full dark:border-[#F3F4F6] dark:bg-[#F3F4F6] dark:text-[#151A28] dark:hover:bg-white">
              {T("Show me around")} <ArrowRight className="h-[15px] w-[15px]" strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------------------------------- tour --------------------------------- */
type Geo = {
  spot: { x: number; y: number; w: number; h: number; r: number } | null;
  card: { left: number; top: number; width: number; maxH?: number; docked: boolean };
  arrow: { side: "left" | "top" | "bottom"; at: number } | null;
  btn: DOMRect | null;
};

function Tour({ role, open, onClose }: { role: Role; open: Open; onClose: (how: "skip" | "finish" | "banner") => void }) {
  const { th, T, t } = useT();
  const plan = usePlanStrip().data;
  const card = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [moved, setMoved] = useState(false);
  const [drawer, setDrawer] = useState(isDrawer);

  // Steps from the role's own menu; Start here only while the banner is on the page.
  const steps = useMemo<Step[]>(() => {
    const m = marketplaceMenu(role);
    const secs: Step[] = (["discover", "workspace", "tools", "account"] as const)
      .filter((k) => m[k].length > 0).map((k) => ({ kind: "section", key: k, items: m[k] }));
    return [{ kind: "account" }, ...secs, ...(findBanner() ? [{ kind: "start" } as Step] : [])];
  }, [role]);
  const i = Math.min(open.step, steps.length - 1);
  const step = steps[i]!;
  const last = i === steps.length - 1;
  const go = (n: number) => { if (n >= 0 && n < steps.length) { set({ ...open, step: n }); setMoved(true); } };

  // Open (or unfold) the menu for menu steps.
  useEffect(() => { setMenu(true, step.kind !== "start"); }, [step.kind]);
  useEffect(() => {
    const mq = window.matchMedia(DRAWER_Q);
    const f = () => setDrawer(mq.matches);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);

  const target = useCallback((): HTMLElement | undefined => {
    if (step.kind === "account") return pick("[data-tour='account']");
    if (step.kind === "section") return pick(`[data-tour-sec='${step.key}']`);
    return findBanner();
  }, [step]);

  // Room to scroll on phones, then bring the part into view.
  useEffect(() => {
    const pads: [HTMLElement, string][] = [];
    const t0 = window.setTimeout(() => {
      const el = target();
      const h = (card.current?.offsetHeight ?? 260) + 24;
      if (drawer) {
        const host = step.kind === "start" ? pick("main") : pick("[data-tour-drawer] nav");
        if (host) { pads.push([host, host.style.paddingBottom]); host.style.paddingBottom = `${h}px`; }
      }
      if (el) {
        el.style.scrollMarginTop = drawer ? (step.kind === "start" ? "70px" : "12px") : step.kind === "start" ? "12px" : "8px";
        el.style.scrollMarginBottom = step.kind === "start" ? "12px" : "8px";
        el.scrollIntoView({ block: drawer ? "start" : "nearest", behavior: "auto" });
      }
    }, drawer ? 60 : 0);
    titleRef.current?.focus({ preventScroll: true });
    return () => { window.clearTimeout(t0); pads.forEach(([el, v]) => { el.style.paddingBottom = v; }); };
  }, [i, drawer, target, step.kind]);
  useEffect(() => () => { const n = pick("main"); if (n) n.style.paddingBottom = ""; }, []);

  // Follow the part on every frame (resize, scroll, menu animation, fonts).
  useEffect(() => {
    let raf = 0, prev = "";
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = target();
      const vw = window.innerWidth, vh = window.innerHeight;
      const ch = card.current?.offsetHeight ?? 240;
      const width = Math.min(step.kind === "start" ? 380 : 360, vw - 24);
      let g: Geo;
      if (!el) {
        g = { spot: null, card: { left: (vw - width) / 2, top: Math.max(12, (vh - ch) / 2), width, docked: false }, arrow: null, btn: null };
      } else {
        const r = el.getBoundingClientRect();
        const spot = { x: r.left - 6, y: r.top - 6, w: r.width + 12, h: r.height + 12, r: step.kind === "start" ? 18 : 14 };
        const btnEl = step.kind === "start" ? (el.querySelector("[data-tour-btn]") as HTMLElement | null) : null;
        const btn = btnEl && visible(btnEl) ? btnEl.getBoundingClientRect() : null;
        if (drawer && step.kind !== "start") {
          const w = Math.min(520, vw - 24);
          g = { spot, card: { left: (vw - w) / 2, top: 0, width: w, docked: true, maxH: Math.max(220, vh - 24 - 80) }, arrow: null, btn };
        } else if (step.kind === "start") {
          const b = btn ?? r;
          const stacked = btn ? btn.top > r.top + r.height / 2 && btn.left - r.left < 40 : false;
          let left = stacked ? r.left : r.right - width;
          left = Math.max(12, Math.min(left, vw - width - 12));
          const below = r.bottom + 20, above = r.top - 20 - ch;
          let top: number, arrow: Geo["arrow"];
          const ax = Math.max(14, Math.min(b.left + b.width / 2 - left, width - 14));
          if (below + ch <= vh - 12) { top = below; arrow = { side: "top", at: ax }; }
          else if (above >= 12) { top = above; arrow = { side: "bottom", at: ax }; }
          else { top = vh - ch - 12; arrow = null; }
          g = { spot, card: { left: drawer ? (vw - Math.min(520, vw - 24)) / 2 : left, top, width: drawer ? Math.min(520, vw - 24) : width, docked: drawer, maxH: drawer ? Math.max(220, vh - 24 - 80) : undefined }, arrow: drawer ? null : arrow, btn };
        } else {
          const mid = r.top + r.height / 2;
          const left = Math.min(r.right + 20, vw - width - 12);
          const top = Math.max(12, Math.min(mid - 48, vh - ch - 12));
          g = { spot, card: { left, top, width, docked: false }, arrow: { side: "left", at: Math.max(14, Math.min(mid - top, ch - 14)) }, btn: null };
        }
      }
      const k = JSON.stringify(g);
      if (k !== prev) { prev = k; setGeo(g); }
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [target, drawer, step.kind]);

  // Keys: arrows move, Escape skips.
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onClose("skip"); return; }
    if (e.key === "ArrowRight" && !last) { e.preventDefault(); go(i + 1); return; }
    if (e.key === "ArrowLeft" && i > 0) { e.preventDefault(); go(i - 1); return; }
    trapTab(e, card.current);
  };
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.key === "Escape") e.preventDefault(); };
    document.addEventListener("keydown", f);
    return () => document.removeEventListener("keydown", f);
  }, [onClose]);

  // Card content.
  const eyebrow = step.kind === "account" ? T("Your account") : step.kind === "start" ? T("Start here") : t(SEC_EYEBROW[step.key]!);
  const banner = step.kind === "start" ? findBanner() : undefined;
  const bannerBtn = banner?.querySelector("[data-tour-btn]") as HTMLElement | null | undefined;
  const continuing = !!bannerBtn && /continue/i.test(bannerBtn.textContent ?? "");
  const title = step.kind === "account" ? T(`You're signed in as ${role === "advisor" ? "an advisor" : `a ${role}`}`)
    : step.kind === "start" ? T(START_TITLE[role]) : T(SEC_TITLE[role][step.key]!);
  let para: string | null = null;
  if (step.kind === "account") {
    const parts: string[] = [];
    if (plan?.free && plan.plan) parts.push(fill(T("Your plan is {plan}, free with your invitation until {date}."), { plan: plan.plan.name, date: fmtDay(plan.free.lastDay, th) }));
    else if (plan?.plan && !plan.ended) parts.push(fill(T("Your plan is {plan}."), { plan: plan.plan.name }));
    else if (role === "buyer") parts.push(T("You don't have a plan yet, so NDA requests need one."));
    else if (role === "advisor") parts.push(T("You don't have a plan yet, so contact requests need one."));
    parts.push(T(TABS[role]));
    para = parts.join(" ");
  } else if (step.kind === "start") {
    para = fill(T(START_TEXT[role]), { N: banner?.dataset.tourN ?? "7", m: banner?.dataset.tourM ?? "3" });
  }
  const anyLock = step.kind === "section" && step.items.some((it) => it.lock && !isReportOrdered(it.lock));
  const bannerGo = () => { onClose("banner"); window.setTimeout(() => bannerBtn?.click(), 0); };

  const sp = geo?.spot;
  const c = geo?.card;
  const btnBase = cn("inline-flex items-center justify-center gap-1.5 rounded-[9px] px-3.5 text-[13.5px] font-semibold", drawer ? "h-10" : "h-9");
  const ghost = cn(btnBase, "border border-[#DCDFE5] bg-white text-[#151A28] hover:bg-[#F6F7F9] dark:border-[#3A4256] dark:bg-transparent dark:text-[#F3F4F6] dark:hover:bg-white/[.06]");
  const navy = cn(btnBase, "border border-[#1E2A4A] bg-[#1E2A4A] text-white hover:bg-[#26355C] dark:border-[#F3F4F6] dark:bg-[#F3F4F6] dark:text-[#151A28] dark:hover:bg-white");
  const nw = th ? "[&_*]:break-words [word-break:keep-all]" : "";

  return (
    <>
      {sp ? (
        <div aria-hidden className={cn("pointer-events-none fixed shadow-[0_0_0_2px_#F6A823,0_0_0_200vmax_rgba(15,23,42,.55)] dark:shadow-[0_0_0_2px_#F6A823,0_0_0_200vmax_rgba(0,0,0,.6)]", moved && !reduced() && "transition-all duration-[220ms] ease-in-out")}
          style={{ left: sp.x, top: sp.y, width: sp.w, height: sp.h, borderRadius: sp.r }} />
      ) : <div aria-hidden className="fixed inset-0 bg-[rgba(15,23,42,.55)] dark:bg-[rgba(0,0,0,.6)]" />}
      {geo?.btn && step.kind === "start" && (
        <button type="button" aria-hidden tabIndex={-1} onClick={bannerGo} className="fixed cursor-pointer bg-transparent"
          style={{ left: geo.btn.left, top: geo.btn.top, width: geo.btn.width, height: geo.btn.height }} />
      )}
      <div ref={card} role="dialog" aria-modal="true" aria-labelledby="wt-step-title" aria-describedby="wt-step-body" onKeyDown={onKey}
        className={cn("fixed flex flex-col gap-2.5 bg-white px-5 pb-4 pt-[18px] text-[#151A28] dark:border dark:border-[#323A4D] dark:bg-[#1E2433] dark:text-[#F3F4F6]", nw,
          c?.docked ? "bottom-3 rounded-[16px] shadow-[0_-8px_40px_rgba(15,23,42,.30)]" : "rounded-[14px] shadow-[0_18px_48px_rgba(15,23,42,.28),0_2px_6px_rgba(15,23,42,.10)]",
          !geo && "invisible")}
        style={c ? { left: c.left, top: c.docked ? undefined : c.top, width: c.width, maxWidth: "calc(100% - 24px)", maxHeight: c.maxH ?? "calc(100dvh - 24px)" } : undefined}>
        {geo?.arrow && (
          <span aria-hidden className="absolute h-[14px] w-[14px] rotate-45 rounded-[2px] bg-white dark:bg-[#1E2433]"
            style={geo.arrow.side === "left" ? { left: -7, top: geo.arrow.at - 7 } : geo.arrow.side === "top" ? { top: -7, left: geo.arrow.at - 7 } : { bottom: -7, left: geo.arrow.at - 7 }} />
        )}
        <div className="relative flex items-center justify-between gap-3">
          <span className={cn("font-bold", th ? "text-[12px]" : "text-[11px] uppercase tracking-[.07em]", EYEBROW[role])}>{eyebrow}</span>
          <span className="text-[12px] text-[#6A7181] dark:text-[#A3ABBD]">{fill(T("{n} of {N}"), { n: i + 1, N: steps.length })}</span>
        </div>
        <h3 id="wt-step-title" data-tour-title ref={titleRef} tabIndex={-1} className="relative text-[17px] font-bold leading-snug outline-none">{title}</h3>
        <div id="wt-step-body" tabIndex={c?.docked ? 0 : -1} className="relative min-h-0 overflow-y-auto outline-none">
          {para && <p className={cn("text-[13.5px] text-[#434A5C] dark:text-[#C5CAD6]", th ? "leading-[1.6]" : "leading-[1.5]")}>{para}</p>}
          {step.kind === "section" && (
            <ul className="space-y-2.5">
              {step.items.map((it) => {
                const line = LINES[role][it.label];
                const locked = !!it.lock && !isReportOrdered(it.lock);
                return (
                  <li key={it.to} className="flex gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[#F4F5F8] text-[#4B5263] dark:bg-[#2A3142] dark:text-[#C5CAD6]"><it.icon className="h-4 w-4" /></span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-[14px] font-semibold">{t(it.label)}{locked && <Lock className="h-[13px] w-[13px] text-[#B7791F]" strokeWidth={2.4} />}</span>
                      {line && <span className={cn("mt-px block text-[13px] text-[#4B5263] dark:text-[#C5CAD6]", th ? "leading-[1.55]" : "leading-[1.45]")}>{T(line)}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {anyLock && (
          <div className="relative flex gap-2 rounded-[10px] border border-[#F6E0B5] bg-[#FFF8EC] px-[11px] py-[9px] text-[12.5px] leading-[1.45] text-[#7A4A05] dark:border-[rgba(246,168,35,.35)] dark:bg-[rgba(246,168,35,.10)] dark:text-[#F3C98B]">
            <Lock className="mt-0.5 h-[13px] w-[13px] shrink-0" /><span>{T("The padlock means it isn't ordered yet. Open it to see what's inside and the price.")}</span>
          </div>
        )}
        <div className="relative mt-1 flex items-center gap-2 border-t border-[#EEF0F3] pt-3 dark:border-[#323A4D]">
          {last && i > 0 && <button type="button" className={ghost} onClick={() => go(i - 1)}>{T("Back")}</button>}
          <div className="ml-auto flex gap-2">
            {!last && i > 0 && <button type="button" className={ghost} onClick={() => go(i - 1)}>{T("Back")}</button>}
            {!last && <button type="button" className={navy} onClick={() => go(i + 1)}>{T("Next")} <ArrowRight className="h-[15px] w-[15px]" strokeWidth={2.2} /></button>}
            {last && step.kind === "start" && (
              <>
                <button type="button" className={ghost} onClick={() => onClose("finish")}>{T("Finish")}</button>
                <button type="button" className={navy} onClick={bannerGo}>{T(continuing ? "Continue setup" : "Start setup")} <ArrowRight className="h-[15px] w-[15px]" strokeWidth={2.2} /></button>
              </>
            )}
            {last && step.kind !== "start" && <button type="button" className={navy} onClick={() => onClose("finish")}>{T("Finish")}</button>}
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------- ? button -------------------------------- */
export function TakeTourButton({ tone = "light" }: { tone?: "light" | "dark" }) {
  const role = useTourEligible();
  const { T } = useT();
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (!role || /\/setup(\/|$)/.test(path)) return null;
  const label = T("Take the tour");
  return (
    <span className="group relative inline-flex">
      <button type="button" aria-label={label} onClick={(e) => startTour(e.currentTarget)}
        className={cn("grid h-[38px] w-[38px] place-items-center rounded-[10px]",
          tone === "dark" ? "text-[#e0e4eb] hover:bg-white/10" : "text-[#3F4556] hover:bg-[#ECEEF2] dark:text-muted-foreground dark:hover:bg-accent dark:hover:text-foreground")}>
        <CircleHelp className="h-5 w-5" />
      </button>
      <span role="tooltip" className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-50 hidden -translate-x-1/2 whitespace-nowrap rounded-[8px] bg-[#151A28] px-2.5 py-1.5 text-[12.5px] font-semibold text-white group-hover:block group-has-[:focus-visible]:block">
        <span aria-hidden className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-[#151A28]" />
        {label}
      </span>
    </span>
  );
}
