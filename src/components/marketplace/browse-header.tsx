import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, ChevronDown, Info, Lock, Search, Target, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PlanBadge } from "@/components/plan-badge";
import { usePlanStrip } from "@/components/marketplace/plan-strip";
import { myBrowseMatches, myDismissedHints, setDismissedHint } from "@/lib/match.functions";
import { useHasSession } from "@/hooks/use-has-session";
import { useTranslation } from "@/i18n/language";
import { cn } from "@/lib/utils";

export type BrowseRole = "seller" | "buyer" | "advisor";
const useTh = () => useTranslation().language === "th";
const pick = (th: boolean, en: string, t: string) => (th ? t : en);

/* ── Plan pill + pop-over (replaces the plan box) ───────────────────────────── */

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null);

function PlanPopoverBody() {
  const { data } = usePlanStrip();
  if (!data?.plan) return <p className="text-[13px] text-muted-foreground">No plan yet</p>;
  const p = data.plan;
  const yr = p.termMonths === 12 ? "this year" : "this term";
  const what = data.role === "seller" ? "Contact requests" : data.role === "buyer" ? "NDA requests" : "Contact requests";
  const per = p.termMonths === 12 ? "yr" : `${p.termMonths} mo`;
  const price = p.priceType === "free" ? `Free · renews every ${p.termMonths} months`
    : [p.priceType === "on_request" ? "Price on request" : `${(p.priceThb ?? 0).toLocaleString()} THB / ${per}`, data.termEnd && `renews ${fmtDate(data.termEnd)}`, p.completionFeePct != null && `${p.completionFeePct}% completion fee`].filter(Boolean).join(" · ");
  const sellerNoSend = data.role === "seller" && p.requestsMode === "none";
  const left = typeof data.left === "number" ? data.left : 0;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <PlanBadge name={p.name} style={p.badgeStyle} ended={data.ended} />
        <span className="text-[13.5px] text-muted-foreground">{price}</span>
      </div>
      {p.requestsMode === "number" && data.total != null && (
        <div>
          <div className="flex justify-between text-[12.5px]"><span className="text-muted-foreground">{what} {yr}</span><b className="font-semibold tabular-nums">{left} of {data.total} left</b></div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[var(--r-acc)]" style={{ width: `${Math.min(100, (left / Math.max(1, data.total)) * 100)}%` }} /></div>
        </div>
      )}
      {data.left === "unlimited" && <div className="text-[12.5px]"><span className="text-muted-foreground">{what} · </span><b>Unlimited</b></div>}
      {p.requestsMode === "bundles" && <div className="text-[12.5px]"><span className="text-muted-foreground">{what} · </span><b>{left} left from bundles</b></div>}
      <ul className="space-y-1.5 text-[13px]">
        {p.features.map((f) => (
          <li key={f.label} className={cn("flex items-center gap-1.5", f.on ? "font-semibold text-[#15803D]" : "text-muted-foreground")}>
            {f.on ? <Check className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}{f.label}{!f.on && f.needs ? ` · ${f.needs}` : ""}
          </li>
        ))}
      </ul>
      <div className="border-t border-border pt-3 text-[12.5px] text-muted-foreground">
        {sellerNoSend ? "Buyers can still find you and ask for an NDA. Sending your own contact requests needs Professional."
          : data.role === "seller" ? "Each request you send to an investor uses one. Requests buyers send you are free."
          : data.role === "buyer" ? "Each NDA request you send uses one."
          : "Each request you send to a seller or buyer uses one. Enquiries sent to you are free."}
      </div>
      <Link to="/preferences" hash="subscription" className="inline-flex h-[34px] items-center rounded-[9px] border border-border bg-card px-3 text-[13.5px] font-semibold hover:bg-muted">
        {p.requestsMode === "bundles" ? "Buy a bundle" : "Compare plans"}
      </Link>
    </div>
  );
}

export function PlanPill() {
  const { data } = usePlanStrip();
  const [open, setOpen] = useState(false);
  const t = useRef<number | null>(null);
  const id = useId();
  if (!data || data.role === "admin" || !data.role) return null;
  const enter = () => { if (t.current) clearTimeout(t.current); setOpen(true); };
  const leave = () => { t.current = window.setTimeout(() => setOpen(false), 120); };
  const name = data.plan?.name ?? "No plan";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-describedby={id} onMouseEnter={enter} onMouseLeave={leave} onFocus={enter}
          className="inline-flex h-7 items-center gap-1.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--r-ring)]">
          {data.plan ? <PlanBadge name={name} style={data.plan.badgeStyle} ended={data.ended} /> : <span className="text-[13px] font-semibold text-muted-foreground">{name}</span>}
          <Info className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent id={id} role="tooltip" align="start" sideOffset={8} collisionPadding={16}
        onMouseEnter={enter} onMouseLeave={leave} onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-[360px] max-w-[calc(100vw-32px)] rounded-[14px] p-[14px_16px_16px] shadow-[0_18px_40px_-16px_rgba(10,20,40,.4)]">
        <PlanPopoverBody />
      </PopoverContent>
    </Popover>
  );
}

/** The amber "plan ended" bar stays on the page, above the info strip. */
export function PlanEndedBar() {
  const { data } = usePlanStrip();
  if (!data?.ended || data.role === "admin") return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-[#FCD34D] bg-[#FEF3C7] px-[14px] py-[10px] text-[13.5px] text-[#92400E]">
      <AlertTriangle className="h-4 w-4" />
      <span>Your {data.plan?.name} plan ended{data.termEnd ? ` on ${fmtDate(data.termEnd)}` : ""}. Requests are paused until you renew.</span>
      <Link to="/preferences" hash="subscription" className="ml-auto font-semibold underline">Renew plan</Link>
    </div>
  );
}

/* ── Filter pill (single choice) ────────────────────────────────────────────── */

export function FilterPill({ label, value, options, onChange, allValue = "all" }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; allValue?: string;
}) {
  const [open, setOpen] = useState(false);
  const on = value !== allValue && value !== "";
  const cur = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-haspopup="listbox" aria-expanded={open} className={pillCls(on, open)}>
          <span className="truncate">{on ? cur?.label ?? value : label}</span><ChevronDown className="h-3.5 w-3.5 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} collisionPadding={16} className="max-h-[min(420px,calc(100vh-150px))] w-[260px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-[12px] p-1.5 shadow-lg">
        <div role="listbox">
          {[{ value: allValue, label }, ...options.filter((o) => o.value !== allValue)].map((o) => (
            <button key={o.value || "any"} type="button" role="option" aria-selected={o.value === value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              className="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-[13px] hover:bg-muted">
              <Check className={cn("h-3.5 w-3.5 shrink-0", o.value === value ? "opacity-100" : "opacity-0")} />{o.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const pillCls = (on: boolean, open?: boolean) => cn(
  "inline-flex h-9 max-w-[240px] items-center gap-2 whitespace-nowrap rounded-full border px-3 text-[13.5px] transition-colors",
  on ? "border-[var(--r-acc)] bg-[var(--r-soft)] font-semibold text-[var(--r-ink)]" : "border-border bg-card text-foreground hover:bg-muted",
  open && "ring-[3px] ring-[var(--r-ring)]",
);

/* ── The header ─────────────────────────────────────────────────────────────── */

export function BrowseHeader({ role, eyebrow, title, subtitle, toggle, q, setQ, placeholder, lead, filters, hasFilters, onClear, count }: {
  role: BrowseRole; eyebrow: ReactNode; title: string; subtitle?: ReactNode; toggle?: ReactNode;
  q: string; setQ: (v: string) => void; placeholder: string; lead?: ReactNode; filters?: ReactNode;
  hasFilters: boolean; onClear: () => void; count: string;
}) {
  const th = useTh();
  return (
    <div className={cn("browse-head shrink-0", `role-${role}`)}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">{eyebrow}</div>
      <div className={cn("mt-1 flex flex-wrap justify-between gap-4", subtitle ? "items-end" : "items-center")}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            <PlanPill />
          </div>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {toggle}
      </div>
      <div className="relative mt-5">
        <Search className="pointer-events-none absolute left-[14px] top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder}
          className="h-11 w-full rounded-[10px] border border-border bg-card pl-10 pr-3 text-[15px] outline-none placeholder:text-muted-foreground focus:border-[var(--r-acc)] focus:ring-[3px] focus:ring-[var(--r-ring)]" />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {lead}
        {filters}
        {hasFilters && (
          <button type="button" onClick={onClear} className="px-1 text-[13px] font-semibold text-muted-foreground underline">{pick(th, "Clear filters", "ล้างตัวกรอง")}</button>
        )}
        <span className="w-full text-[13px] text-muted-foreground sm:ml-auto sm:w-auto">{count}</span>
      </div>
    </div>
  );
}

/* ── Glossary term (NDA) ───────────────────────────────────────────────────── */

const GLOSSARY = {
  nda: {
    word: "NDA",
    title: ["NDA (Non-Disclosure Agreement)", "NDA (ข้อตกลงไม่เปิดเผยข้อมูล)"],
    text: ["A confidentiality agreement that protects private business information before it is shared.", "ข้อตกลงการรักษาความลับที่ช่วยปกป้องข้อมูลทางธุรกิจที่เป็นส่วนตัวก่อนมีการเปิดเผยข้อมูล"],
  },
} as const;

export function GlossaryTerm({ term }: { term: keyof typeof GLOSSARY }) {
  const th = useTh();
  const g = GLOSSARY[term];
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-block">
      <span tabIndex={0} aria-describedby={id} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
        className="cursor-help font-semibold italic text-[#2563EB] underline decoration-dotted underline-offset-[3px] outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/40">
        {g.word}
      </span>
      <span id={id} role="tooltip"
        className={cn("pointer-events-none absolute bottom-[calc(100%+8px)] left-[-12px] z-50 w-[280px] max-w-[calc(100vw-32px)] rounded-[10px] bg-[#151A28] px-3 py-2.5 text-[12.5px] font-normal not-italic leading-[1.5] text-[#E5E7EB] shadow-lg transition-opacity duration-150",
          open ? "opacity-100" : "opacity-0")}>
        <b className="block font-semibold text-white">{g.title[th ? 1 : 0]}</b>{g.text[th ? 1 : 0]}
        <span aria-hidden="true" className="absolute left-[18px] top-full border-[6px] border-transparent border-t-[#151A28]" />
      </span>
    </span>
  );
}

/* ── Info strip with × (closed for the user, on every device) ──────────────── */

export const HIDDEN_STRIP = "hidden_profiles_strip";

export function useDismissedHints() {
  const fn = useServerFn(myDismissedHints);
  const set = useServerFn(setDismissedHint);
  const qc = useQueryClient();
  const enabled = useHasSession();
  const { data, isSuccess } = useQuery({ queryKey: ["dismissed-hints"], queryFn: () => fn(), staleTime: 300_000, enabled });
  return {
    ready: isSuccess,
    has: (h: string) => (data ?? []).includes(h),
    dismiss: async (h: string) => { qc.setQueryData<string[]>(["dismissed-hints"], (p = []) => [...p, h]); await set({ data: { hint: h } }); },
    reset: async () => { qc.setQueryData<string[]>(["dismissed-hints"], []); await set({ data: { hint: null } }); },
  };
}

export function NdaInfoStrip({ role }: { role: BrowseRole }) {
  const th = useTh();
  const hints = useDismissedHints();
  if (!hints.ready || hints.has(HIDDEN_STRIP)) return null;
  const nda = <GlossaryTerm term="nda" />;
  const text = role === "seller"
    ? (th ? <>อนุมัติ {nda} เพื่อดูข้อมูลของนักลงทุน</> : <>Approve the {nda} to reveal investor details.</>)
    : role === "buyer"
      ? (th ? <>ขอ {nda} เพื่อดูข้อมูลของกิจการ</> : <>Request an {nda} to reveal business details.</>)
      : (th ? <>เมื่อ {nda} ของลูกค้าได้รับอนุมัติ ท่านจะเห็นชื่อและรายละเอียด</> : <>Your client's approved {nda} reveals names and details.</>);
  const close = pick(th, "Close", "ปิด");
  return (
    <div className="mt-[18px] flex shrink-0 items-start gap-2 rounded-[10px] border border-[#F3D49A] bg-[#FFF8EA] py-1.5 pl-3 pr-1.5 text-[13px] text-[#7A5310] dark:border-border dark:bg-muted/60 dark:text-muted-foreground">
      <Lock className="mt-[7px] h-3.5 w-3.5 shrink-0" />
      <p className="min-w-0 flex-1 py-[5px]">{text}</p>
      <button type="button" aria-label={close} title={close} onClick={() => void hints.dismiss(HIDDEN_STRIP)}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] hover:bg-[#7A5310]/10">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** "Show the tips I closed" link for Settings. */
export function ShowClosedTipsLink() {
  const th = useTh();
  const hints = useDismissedHints();
  const [done, setDone] = useState(false);
  useEffect(() => { if (done) { const t = setTimeout(() => setDone(false), 2500); return () => clearTimeout(t); } }, [done]);
  return (
    <button type="button" onClick={async () => { await hints.reset(); setDone(true); }} className="text-[13px] font-semibold text-[#2563EB] hover:underline">
      {done ? pick(th, "Tips are back on.", "แสดงคำแนะนำอีกครั้งแล้ว") : pick(th, "Show the tips I closed", "แสดงคำแนะนำที่ปิดไว้อีกครั้ง")}
    </button>
  );
}

/* ── Match tags ─────────────────────────────────────────────────────────────── */

export function useBrowseMatches() {
  const fn = useServerFn(myBrowseMatches);
  const enabled = useHasSession();
  const { data } = useQuery({ queryKey: ["browse-matches"], queryFn: () => fn(), staleTime: 60_000, enabled });
  return data?.matches ?? {};
}

const CRIT_TH: Record<string, string> = { sector: "หมวดธุรกิจ", "deal type": "ประเภทดีล" };
const joinCrit = (c: string[], th: boolean) => {
  const l = th ? c.map((x) => CRIT_TH[x] ?? x) : c;
  return l.length < 2 ? l.join("") : th ? l.join(" และ ") : `${l.slice(0, -1).join(", ")} and ${l[l.length - 1]}`;
};

export function MatchTag({ side }: { side: "seller" | "buyer" }) {
  const th = useTh();
  return (
    <span className="inline-flex h-6 w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#BBF7D0] bg-[#ECFDF3] px-2.5 text-[12px] font-semibold text-[#15803D]">
      <Target className="h-3.5 w-3.5" />
      {side === "seller" ? pick(th, "Looking for companies like yours", "กำลังมองหากิจการแบบของท่าน") : pick(th, "Matches your mandate", "ตรงกับเงื่อนไขการลงทุนของท่าน")}
    </span>
  );
}

export function MatchBox({ side, criteria }: { side: "seller" | "buyer"; criteria: string[] }) {
  const th = useTh();
  const c = joinCrit(criteria, th);
  return (
    <div className="space-y-1.5 rounded-[10px] border border-[#D1FADF] bg-[#F6FEF9] px-3 py-2.5 dark:border-border dark:bg-muted/50">
      <MatchTag side={side} />
      <p className="text-[12.5px] text-[#166534] dark:text-foreground">
        {side === "seller" ? pick(th, `Their mandate fits your business: ${c}.`, `เงื่อนไขการลงทุนตรงกับกิจการของท่าน: ${c}`) : pick(th, `This business fits your mandate: ${c}.`, `กิจการนี้ตรงกับเงื่อนไขการลงทุนของท่าน: ${c}`)}
      </p>
    </div>
  );
}
