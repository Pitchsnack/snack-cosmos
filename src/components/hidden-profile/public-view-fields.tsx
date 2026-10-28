import { Lock } from "lucide-react";
import { bandOf, bandInText, fmtThb, thbWords, thbWordsTh } from "@/lib/asking-price";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Check, ChevronDown, CircleCheck, Eye, Info, Plus, RefreshCw, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EditSec } from "@/components/common/edit-section";
import { TabHead, useTr } from "@/components/common/edit-info-popup";
import { SectorArt } from "@/components/hidden-profile/bits";
import {
  DEAL_TYPES, HANDOVER_MONTHS, HIDDEN_FIELD_LABEL, identityTerms, pickDraft, runIdentityCheck, suggestCodeName,
  type EntryFacts, type HiddenDraft, type HiddenProfileRow, type HiddenTextField,
} from "@/lib/hidden-profile";
import {
  revenueBand, suggestBusinessDescription, suggestCodeNames, suggestCustomersSummary, suggestHeadline, suggestHighlights, type ListingSource,
} from "@/lib/public-listing";
import { checkListingName } from "@/lib/hidden-profiles.functions";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-session-context";

/**
 * Edit information › Listing view: Listing Identity and Deal Terms, as two tabs
 * of Edit my startup. State lives in usePublicDraft so the one Save stores it.
 */

export type PublicTab = "identity" | "deal";
/** Old tab keys still in links or remembered tabs. */
export const normalizePublicTab = (t: string | undefined) => (t === "description" ? "identity" : t);

const DEAL_TH: Record<string, string> = {
  "Full acquisition": "ซื้อกิจการทั้งหมด",
  "Majority stake (above 51%)": "ถือหุ้นข้างมาก (มากกว่า 51%)",
  "Minority stake (below 49%)": "ถือหุ้นส่วนน้อย (น้อยกว่า 49%)",
};

type NameState = "idle" | "checking" | "available" | "taken";

export function usePublicDraft(row: HiddenProfileRow | null, facts: EntryFacts | undefined, source: ListingSource | undefined) {
  // Only Admin sets or changes a listing name; sellers see it read-only (or the ref).
  const canName = usePermissions().isControl;
  const base = useMemo(() => ({ ...pickDraft(row ?? {}), suggested_listing_name: ((row as any)?.suggested_listing_name ?? "") as string }) as HiddenDraft & { suggested_listing_name: string }, [row?.id, row?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps
  const [d, setD] = useState<HiddenDraft & { suggested_listing_name: string }>(base);
  const [baseline, setBaseline] = useState(() => JSON.stringify(base));
  useEffect(() => { setD(base); setBaseline(JSON.stringify(base)); }, [base]);
  const opts = useMemo(() => ({ guard: facts ? identityTerms(facts) : [] }), [facts]);
  const [seed, setSeed] = useState(0);
  const codeIdeas = useMemo(() => {
    const base = source ? suggestCodeNames(source, opts) : [];
    const pool = [...base];
    for (let i = 0; pool.length < 4 + seed * 4 && i < 40; i++) { const n = suggestCodeName(); if (!pool.includes(n)) pool.push(n); }
    return seed === 0 ? pool.slice(0, 4) : pool.slice(-4);
  }, [source, opts, seed]);
  const headlineIdea = useMemo(() => (source ? suggestHeadline(source, opts) : ""), [source, opts]);
  const descIdea = useMemo(() => (source ? suggestBusinessDescription(source, opts) : ""), [source, opts]);
  const highlightIdeas = useMemo(() => (source ? suggestHighlights(source, opts).filter(Boolean) : []), [source, opts]);
  const customersIdea = useMemo(() => (source ? suggestCustomersSummary(source, opts) : ""), [source, opts]);

  // First open: empty public fields start from the generated draft, as before.
  const prefilled = useRef<string | null>(null);
  useEffect(() => {
    if (!row || prefilled.current === row.id || !source) return;
    if (!headlineIdea && !descIdea && !highlightIdeas.length && !codeIdeas.length) return;
    prefilled.current = row.id;
    setD((p) => {
      const next = {
        ...p,
        code_name: p.code_name,
        headline: p.headline.trim() ? p.headline : headlineIdea,
        description: p.description.trim() ? p.description : descIdea,
        highlights: p.highlights.map((h, i) => (h.trim() ? h : (highlightIdeas[i] ?? h))),
        customers_summary: p.customers_summary.trim() ? p.customers_summary : customersIdea,
      };
      setBaseline(JSON.stringify(next));
      return next;
    });
  }, [row, source, headlineIdea, descIdea, highlightIdeas, codeIdeas, customersIdea]);

  const fillAll = () => setD((p) => ({
    ...p,
    code_name: canName ? (p.code_name.trim() || (codeIdeas[0] ?? suggestCodeName())) : p.code_name,
    headline: headlineIdea || p.headline,
    description: descIdea || p.description,
    highlights: p.highlights.map((h, i) => highlightIdeas[i] ?? h),
    customers_summary: customersIdea || p.customers_summary,
  }));

  // Listing name availability: checked on the server 300ms after typing stops.
  const check = useServerFn(checkListingName);
  const [nameState, setNameState] = useState<NameState>("idle");
  const savedName = (row?.code_name ?? "").trim().toLowerCase();
  useEffect(() => {
    const name = d.code_name.trim();
    if (!row || !name) { setNameState("idle"); return; }
    if (name.toLowerCase() === savedName) { setNameState("available"); return; }
    setNameState("checking");
    let live = true;
    const t = setTimeout(() => {
      check({ data: { name, startupId: row.startup_id } })
        .then((r) => { if (live) setNameState(r.available ? "available" : "taken"); })
        .catch(() => { if (live) setNameState("idle"); });
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [d.code_name, row?.startup_id, savedName]); // eslint-disable-line react-hooks/exhaustive-deps

  const findings = useMemo(() => (facts ? runIdentityCheck(d, facts) : []), [d, facts]);
  const counts: Record<PublicTab, number> = {
    identity: (d.headline.trim() ? 0 : 1) + (d.description.trim() ? 0 : 1) + (d.highlights.slice(0, 3).every((h) => h.trim()) ? 0 : 1),
    deal: ((DEAL_TYPES as readonly string[]).includes(d.deal_type ?? "") ? 0 : 1) + (d.owner_stays ? 0 : 1),
  };
  const dirty = !!row && JSON.stringify(d) !== baseline;
  const changedFromRow = !!row && JSON.stringify(pickDraft(row)) !== JSON.stringify(d);
  // The seller's headline doubles as their suggested headline; the name suggestion is its own field.
  const payload = { ...d, highlights: d.highlights.map((h) => h.trim()), handover_months: d.owner_stays === "yes" ? (d.handover_months ?? 6) : null, suggested_listing_name: (d.suggested_listing_name ?? "").trim() || null, suggested_headline: d.headline.trim() || null };
  return {
    d, setD, ideas: { codeIdeas, headlineIdea, descIdea, highlightIdeas, customersIdea }, moreNames: () => setSeed((s) => s + 1),
    fillAll, findings, counts, dirty, changedFromRow, payload, nameState, nameTaken: canName && nameState === "taken", canName,
  };
}
export type PublicDraftState = ReturnType<typeof usePublicDraft>;

const LABEL = "text-[14px] font-semibold text-[#151A28] dark:text-foreground";
const MISSING = "text-[#DC2626] dark:text-red-400";
const BOX = "h-[42px] rounded-[9px] border-[#D7DCE3] px-[13px] text-[15px] placeholder:text-[#9CA3AF] focus-visible:border-[#2563EB] focus-visible:ring-0 focus-visible:shadow-[0_0_0_3px_rgba(37,99,235,0.15)] dark:border-input";
const AREA = "rounded-[9px] border-[#D7DCE3] px-[13px] py-[10px] text-[15px] leading-[1.5] placeholder:text-[#9CA3AF] focus-visible:border-[#2563EB] focus-visible:ring-0 focus-visible:shadow-[0_0_0_3px_rgba(37,99,235,0.15)] dark:border-input";
const MISS_BOX = "border-[#F87171]";

function SuggestLink({ onClick }: { onClick: () => void }) {
  const tr = useTr();
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#6D28D9] hover:underline dark:text-violet-300">
      <Sparkles className="h-[14px] w-[14px]" />{tr("Suggest", "แนะนำ")}
    </button>
  );
}

function FieldRow({ label, missing, right, suggest, children, htmlFor, after }: {
  label: ReactNode; missing?: boolean; right?: ReactNode; suggest?: () => void; children: ReactNode; htmlFor?: string; after?: ReactNode;
}) {
  const tr = useTr();
  return (
    <div>
      <div className="mb-[6px] flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex items-center">
          <label htmlFor={htmlFor} className={cn(LABEL, missing && MISSING)}>{label}</label>
          {after}
          {missing && <span className="ml-1 text-[12.5px] font-medium text-[#DC2626]">{tr("· Missing", "· ยังขาด")}</span>}
        </div>
        <div className="flex items-center gap-3">
          {right != null && <span className="text-[12px] tabular-nums text-[#6A7181]">{right}</span>}
          {suggest && <SuggestLink onClick={suggest} />}
        </div>
      </div>
      {children}
    </div>
  );
}

function IdentityMsg({ pd }: { pd: PublicDraftState }) {
  if (!pd.findings.length) return null;
  const fields = [...new Set(pd.findings.map((f) => f.field))];
  return (
    <p className="mb-3 flex items-start gap-1.5 text-[14px] text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      Identity check: {pd.findings.length} detail{pd.findings.length === 1 ? "" : "s"} could name the company ({fields.map((k) => HIDDEN_FIELD_LABEL[k as HiddenTextField]).join(", ")})
    </p>
  );
}

function FlagMsg({ pd, k }: { pd: PublicDraftState; k: HiddenTextField }) {
  const hits = pd.findings.filter((f) => f.field === k);
  if (!hits.length) return null;
  return <p className="mt-1 text-[11.5px] text-destructive">Could name the company: {hits.map((f) => `"${f.term}" (${f.reason.toLowerCase()})`).join(", ")}</p>;
}

export function PublicViewTab({ tab, pd, sector, pickedImage, section, source, refNo }: {
  tab: PublicTab; pd: PublicDraftState; sector: string | null;
  /** The listing's saved public image (cover rule). */
  pickedImage: string | null | undefined;
  section?: string; source?: ListingSource; refNo?: string;
}) {
  const tr = useTr();
  const { d, setD, ideas } = pd;
  const set = <K extends keyof HiddenDraft>(k: K, v: HiddenDraft[K]) => setD((p) => ({ ...p, [k]: v }));
  const flag = (k: HiddenTextField) => (pd.findings.some((f) => f.field === k) ? "border-destructive" : "");

  if (tab === "identity") {
    const fill = (
      <TooltipProvider><Tooltip><TooltipTrigger asChild>
        <button type="button" onClick={pd.fillAll} className="inline-flex h-9 items-center gap-2 rounded-[9px] border border-[#DCDFE5] bg-background px-[13px] text-[13.5px] font-medium hover:bg-muted dark:border-border">
          <Sparkles className="h-[15px] w-[15px]" />{tr("Auto-fill this tab", "กรอกแท็บนี้อัตโนมัติ")}
        </button>
      </TooltipTrigger><TooltipContent>{tr("Fills in every field on this tab for you. You can change anything afterwards.", "กรอกทุกช่องในแท็บนี้ให้ท่าน ท่านแก้ไขได้ภายหลัง")}</TooltipContent></Tooltip></TooltipProvider>
    );
    const hlMissing = !d.highlights.slice(0, 3).every((h) => h.trim());
    return (
      <div>
        <IdentityMsg pd={pd} />
        <TabHead title={tr("Marketplace listing name", "ชื่อประกาศใน Marketplace")}>{fill}</TabHead>
        <div className="mt-4 grid grid-cols-[260px_minmax(0,1fr)] items-start gap-7 max-sm:grid-cols-1 max-sm:gap-4">
          <BuyerPreview d={d} sector={sector} pickedImage={pickedImage} source={source} refNo={refNo} />
          <div className="min-w-0 space-y-[22px]">
            <EditSec id="codename" tone="seller" active={section === "codename"}>
              {pd.canName ? <ListingNameField pd={pd} refNo={refNo} /> : <SuggestedNameField pd={pd} refNo={refNo} />}
            </EditSec>
            <EditSec id="headline" tone="seller" active={section === "headline"}>
              <FieldRow label={tr("Headline", "หัวข้อประกาศ")} htmlFor="hp-headline" missing={!d.headline.trim()} right={`${d.headline.length}/120`} suggest={ideas.headlineIdea ? () => set("headline", ideas.headlineIdea) : undefined}>
                <Input id="hp-headline" maxLength={120} value={d.headline} placeholder={ideas.headlineIdea} onChange={(e) => set("headline", e.target.value)} className={cn(BOX, !d.headline.trim() && MISS_BOX, flag("headline"))} />
              </FieldRow>
              <FlagMsg pd={pd} k="headline" />
            </EditSec>
            <EditSec id="description" tone="seller" active={section === "description"}>
              <FieldRow label={tr("Description", "คำอธิบาย")} htmlFor="hp-description" missing={!d.description.trim()} right={`${d.description.length}/420`} suggest={ideas.descIdea ? () => set("description", ideas.descIdea) : undefined}>
                <Textarea id="hp-description" maxLength={420} value={d.description} placeholder={ideas.descIdea} onChange={(e) => set("description", e.target.value)} className={cn(AREA, "h-[112px] min-h-[112px] resize-y", !d.description.trim() && MISS_BOX, flag("description"))} />
              </FieldRow>
              <FlagMsg pd={pd} k="description" />
            </EditSec>
            <EditSec id="highlights" tone="seller" active={section === "highlights"}>
              <FieldRow label={tr("Highlights", "จุดเด่น")} missing={hlMissing} right={tr("3 required", "ต้องมี 3 ข้อ")}
                suggest={ideas.highlightIdeas.length ? () => set("highlights", d.highlights.map((h, i) => ideas.highlightIdeas[i] ?? h)) : undefined}>
                <div role="group" aria-label="Highlights" className="overflow-hidden rounded-[10px] border border-[#D7DCE3] bg-background focus-within:border-[#2563EB] focus-within:shadow-[0_0_0_3px_rgba(37,99,235,0.15)] dark:border-input">
                  {d.highlights.map((h, i) => {
                    const filled = !!h.trim();
                    const req = i < 3;
                    const name = req ? tr(`Highlight ${i + 1}`, `จุดเด่นข้อที่ ${i + 1}`) : tr("Highlight 4 (optional)", "จุดเด่นข้อที่ 4 (ไม่บังคับ)");
                    return (
                      <div key={i} className="flex min-h-12 items-center gap-3 border-t border-[#EEF0F3] px-[14px] first:border-t-0 focus-within:bg-[#FAFBFC] dark:border-border dark:focus-within:bg-muted/40">
                        {filled ? (
                          <span aria-hidden className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-[#E8F6EE]"><Check className="h-[13px] w-[13px] text-[#15803D]" strokeWidth={2.6} /></span>
                        ) : (
                          <span aria-hidden className={cn("grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border text-[11px] font-semibold", req ? "border-[#F87171] text-[#DC2626]" : "border-[#DCDFE5] text-[#6A7181]")}>{i + 1}</span>
                        )}
                        <input aria-label={name} value={h} placeholder={name}
                          onChange={(e) => set("highlights", d.highlights.map((x, j) => (j === i ? e.target.value : x)))}
                          className="h-11 min-w-0 flex-1 border-0 bg-transparent text-[15px] outline-none placeholder:text-[#9CA3AF]" />
                      </div>
                    );
                  })}
                </div>
              </FieldRow>
              <FlagMsg pd={pd} k="highlights" />
            </EditSec>
            <EditSec id="customers" tone="seller" active={section === "customers"}>
              <FieldRow label={tr("Customer profile (do not mention names)", "ลักษณะลูกค้า (ห้ามระบุชื่อ)")} htmlFor="hp-customers_summary" right={tr("Optional", "ไม่บังคับ")} suggest={ideas.customersIdea ? () => set("customers_summary", ideas.customersIdea) : undefined}>
                <Textarea id="hp-customers_summary" value={d.customers_summary} placeholder={ideas.customersIdea} onChange={(e) => set("customers_summary", e.target.value)} className={cn(AREA, "h-20 min-h-20 resize-y", flag("customers_summary"))} />
              </FieldRow>
              <FlagMsg pd={pd} k="customers_summary" />
            </EditSec>
          </div>
        </div>
      </div>
    );
  }

  // Deal terms
  const dealOk = (DEAL_TYPES as readonly string[]).includes(d.deal_type ?? "");
  return (
    <div>
      <IdentityMsg pd={pd} />
      <TabHead title={tr("Deal Info", "ข้อมูลดีล")} />
      <EditSec id="deal" tone="seller" active={section === "deal" || section === "terms"}>
        <div className="space-y-[22px]">
        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <AskingPrice d={d} set={set} />
          <FieldRow label={tr("Deal type", "รูปแบบดีล")} htmlFor="hp-deal-type" missing={!dealOk}>
            <div className="relative">
              <select id="hp-deal-type" value={dealOk ? d.deal_type! : ""} onChange={(e) => set("deal_type", e.target.value || null)}
                className={cn(BOX, "w-full appearance-none border bg-background pr-10 outline-none", !dealOk && cn(MISS_BOX, "text-[#8A90A0]"))}>
                <option value="" disabled>{tr("Choose a deal type…", "เลือกรูปแบบดีล…")}</option>
                {DEAL_TYPES.map((c) => <option key={c} value={c} className="text-foreground">{tr(c, DEAL_TH[c] ?? c)}</option>)}
              </select>
              <ChevronDown aria-hidden className="pointer-events-none absolute right-[13px] top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#6A7181]" />
            </div>
          </FieldRow>
        </div>
        <OwnerHandover d={d} set={set} />
        <FieldRow label={tr("Reason for sale", "เหตุผลที่ขาย")} htmlFor="hp-reason" right={tr("Optional", "ไม่บังคับ")}>
          <Textarea id="hp-reason" value={d.reason ?? ""} onChange={(e) => set("reason", e.target.value || null)} className={cn(AREA, "h-24 min-h-24 resize-y", flag("reason"))} />
        </FieldRow>
        <FlagMsg pd={pd} k="reason" />
        </div>
      </EditSec>
    </div>
  );
}

type Setter = <K extends keyof HiddenDraft>(k: K, v: HiddenDraft[K]) => void;

function AskingPrice({ d, set }: { d: HiddenDraft; set: Setter }) {
  const tr = useTr();
  const v = d.asking_price_thb ?? null;
  const band = bandOf(v);
  const missing = !(v && v > 0);
  return (
    <div>
      <label htmlFor="hp-asking" className={cn(LABEL, "mb-[6px] block", missing && "text-[#DC2626]")}>
        {tr("Asking price (Estimate)", "ราคาที่ต้องการ (ประมาณการ)")}{missing && <span> · {tr("Missing", "ยังไม่ได้กรอก")}</span>}
      </label>
      <Input id="hp-asking" data-edit-focus inputMode="numeric" autoComplete="off"
        value={v ? fmtThb(v) : ""}
        placeholder={tr("e.g. 120,000,000", "เช่น 120,000,000")}
        onChange={(e) => { const digits = e.target.value.replace(/\D/g, "").slice(0, 13); set("asking_price_thb", digits ? Number(digits) : null); }}
        className={cn(BOX, "h-[42px] text-[15px]", missing && "border-[#F87171]")} />
      {v ? <p className="mt-[6px] text-[12.5px] text-[#6B7280] dark:text-muted-foreground">{tr(thbWords(v), thbWordsTh(v))}</p> : null}
      {band && (
        <p className="mt-1 flex items-center gap-1 text-[12.5px] text-[#6B7280] dark:text-muted-foreground">
          <Lock className="h-[13px] w-[13px]" aria-hidden />
          {tr(`Buyers see ${bandInText(band.label)} until you approve their NDA.`, `ผู้ซื้อจะเห็น ${band.th} จนกว่าคุณจะอนุมัติ NDA`)}
        </p>
      )}
    </div>
  );
}

function OwnerHandover({ d, set }: { d: HiddenDraft; set: Setter }) {
  const tr = useTr();
  const qid = useId();
  const groupRef = useRef<HTMLDivElement>(null);
  const pick = (v: "yes" | "no") => {
    set("owner_stays", v);
    if (v === "yes" && d.handover_months == null) set("handover_months", 6);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const next = d.owner_stays === "yes" ? "no" : "yes";
    pick(next);
    requestAnimationFrame(() => groupRef.current?.querySelector<HTMLElement>(`[data-v="${next}"]`)?.focus());
  };
  const btn = (v: "yes" | "no", label: string) => {
    const on = d.owner_stays === v;
    const focusable = on || (!d.owner_stays && v === "yes");
    return (
      <button type="button" role="radio" aria-checked={on} data-v={v} tabIndex={focusable ? 0 : -1} onClick={() => pick(v)} onKeyDown={onKey}
        className={cn("h-[34px] min-w-[72px] rounded-[7px] border border-transparent px-4 text-[14px] font-semibold text-[#4B5563] dark:text-muted-foreground",
          on && "border-[#2563EB] bg-[#2563EB] text-white shadow-[0_1px_2px_rgba(37,99,235,0.3)] dark:text-white")}>{label}</button>
    );
  };
  const missing = !d.owner_stays;
  return (
    <div>
      <div className="mb-[6px] flex items-center">
        <span className={cn(LABEL, missing && MISSING)}>{tr("Owner handover", "การส่งมอบงานโดยเจ้าของ")}</span>
        {missing && <span className="ml-1 text-[12.5px] font-medium text-[#DC2626]">{tr("· Missing", "· ยังขาด")}</span>}
      </div>
      <p id={qid} className="mb-2 text-[12.5px] text-[#6A7181] dark:text-muted-foreground">{tr("Will the owner stay on after the sale to hand over the business?", "เจ้าของจะอยู่ช่วยส่งมอบกิจการหลังการขายหรือไม่")}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div ref={groupRef} role="radiogroup" aria-label={tr("Owner handover", "การส่งมอบงานโดยเจ้าของ")} aria-describedby={qid}
          className={cn("inline-flex gap-1 rounded-[10px] border bg-[#F1F2F5] p-1 dark:bg-muted", missing ? "border-[#F87171]" : "border-transparent")}>
          {btn("yes", tr("Yes", "ใช่"))}{btn("no", tr("No", "ไม่ใช่"))}
        </div>
        {d.owner_stays === "yes" && (
          <div className="flex items-center gap-[10px]">
            <span className="text-[14px] text-[#374151] dark:text-foreground">{tr("for", "เป็นเวลา")}</span>
            <div className="relative w-40">
              <select aria-label={tr("Handover months", "จำนวนเดือน")} value={d.handover_months ?? 6} onChange={(e) => set("handover_months", Number(e.target.value))}
                className={cn(BOX, "w-full appearance-none border bg-background pr-10 outline-none")}>
                {HANDOVER_MONTHS.map((m) => <option key={m} value={m}>{m === 1 ? tr("1 month", "1 เดือน") : tr(`${m} months`, `${m} เดือน`)}</option>)}
              </select>
              <ChevronDown aria-hidden className="pointer-events-none absolute right-[13px] top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#6A7181]" />
            </div>
            <span className="text-[13px] text-[#6A7181]">{tr("after the sale", "หลังการขาย")}</span>
          </div>
        )}
        {d.owner_stays === "no" && <span className="text-[13px] text-[#6A7181]">{tr("The owner leaves at completion.", "เจ้าของออกจากกิจการเมื่อการขายเสร็จสิ้น")}</span>}
      </div>
    </div>
  );
}

/** Sellers: the name PitchSnack set, or the ref until there is one. */
function ListingNameRow({ name, refNo }: { name: string; refNo?: string }) {
  const tr = useTr();
  const ref = refNo || "—";
  return (
    <div>
      <div className={LABEL}>{tr("Listing name", "ชื่อประกาศ")}</div>
      <div className="mt-[6px] text-[15px] font-semibold text-[#151A28] dark:text-foreground">{name || ref}</div>
      {!name && <p className="mt-1 text-[12.5px] text-[#6B7280] dark:text-muted-foreground">{tr(`PitchSnack names your listing. Until then, buyers see ${ref}.`, `PitchSnack จะตั้งชื่อประกาศให้ท่าน ระหว่างนี้ผู้ซื้อจะเห็น ${ref}`)}</p>}
    </div>
  );
}

/** Sellers suggest a listing name; Admin may adjust it before publishing. */
function SuggestedNameField({ pd, refNo }: { pd: PublicDraftState; refNo?: string }) {
  const tr = useTr();
  const { d, setD } = pd;
  const published = d.code_name.trim();
  const val = d.suggested_listing_name ?? "";
  return (
    <div className="space-y-4">
      {published ? <ListingNameRow name={published} refNo={refNo} /> : null}
      <FieldRow label={tr("Listing name — your suggestion", "ชื่อประกาศ — ข้อเสนอของท่าน")} htmlFor="hp-suggested-name" right={`${val.length}/120`}>
        <Input id="hp-suggested-name" maxLength={120} value={val} placeholder={refNo || ""}
          onChange={(e) => setD((p) => ({ ...p, suggested_listing_name: e.target.value }))} className={BOX} />
        <p className="mt-1 text-[12.5px] text-[#6B7280] dark:text-muted-foreground">{tr("PitchSnack may adjust it to reduce duplication and make your listing easier to distinguish.", "PitchSnack อาจปรับชื่อเพื่อลดความซ้ำและทำให้ประกาศของท่านโดดเด่นขึ้น")}</p>
      </FieldRow>
    </div>
  );
}

function ListingNameField({ pd, refNo }: { pd: PublicDraftState; refNo?: string }) {
  const tr = useTr();
  const { d, setD, ideas } = pd;
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const tipId = useId();
  const errId = useId();
  const name = d.code_name.trim();
  const taken = pd.nameTaken;
  const empty = !name;
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const pick = (n: string) => { setD((p) => ({ ...p, code_name: n })); setOpen(false); input.current?.focus(); };
  const tipText = tr("A private name buyers see instead of your real company name. It must be unique in the Marketplace.", "ชื่อที่ผู้ซื้อเห็นแทนชื่อจริงของบริษัทท่าน และต้องไม่ซ้ำกับประกาศอื่นใน Marketplace");
  const border = taken ? "border-[#DC2626] focus-visible:border-[#DC2626] focus-visible:shadow-[0_0_0_3px_rgba(220,38,38,0.12)]"
    : open ? "border-[#6D28D9] shadow-[0_0_0_3px_rgba(109,40,217,0.14)] focus-visible:border-[#6D28D9] focus-visible:shadow-[0_0_0_3px_rgba(109,40,217,0.14)]"
    : "";
  return (
    <div ref={wrap} className="relative">
      <div className="mb-[6px] flex items-center">
        <label htmlFor="hp-code_name" onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)} onClick={() => setOpen(true)}
          className={cn(LABEL, taken && MISSING)}>{tr("Listing name", "ชื่อประกาศ")}</label>
        <span className="relative ml-[2px] inline-flex">
          <button type="button" aria-label={tr("What is a listing name?", "ชื่อประกาศคืออะไร")} aria-describedby={tipId}
            onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)} onFocus={() => setTip(true)} onBlur={() => setTip(false)} onClick={() => setTip((t) => !t)}
            className="grid h-[26px] w-[26px] place-items-center rounded-full text-[#6A7181] max-sm:h-8 max-sm:w-8">
            <Info className="h-[15px] w-[15px]" strokeWidth={2} />
          </button>
          <span id={tipId} role="tooltip" className={cn("pointer-events-none absolute left-[calc(100%+8px)] top-1/2 z-50 w-[300px] -translate-y-1/2 rounded-lg bg-[#151A28] px-3 py-2 text-[13px] leading-[1.45] text-white shadow-[0_8px_20px_rgba(16,24,40,0.18)] max-sm:left-0 max-sm:top-[calc(100%+8px)] max-sm:w-[min(300px,86vw)] max-sm:translate-y-0",
            tip ? "block" : "sr-only")}>
            <span aria-hidden className="absolute -left-[6px] top-1/2 h-0 w-0 -translate-y-1/2 border-y-[6px] border-r-[6px] border-y-transparent border-r-[#151A28] max-sm:left-3 max-sm:-top-[6px] max-sm:translate-y-0 max-sm:border-x-[6px] max-sm:border-b-[6px] max-sm:border-r-transparent max-sm:border-x-transparent max-sm:border-b-[#151A28] max-sm:border-y-0" />
            {tipText}
          </span>
        </span>
  
      </div>
      <div className="relative">
        <Input id="hp-code_name" ref={input} value={d.code_name} placeholder={tr("Type a name or pick a suggestion", "พิมพ์ชื่อ หรือเลือกจากชื่อที่แนะนำ")}
          aria-describedby={cn(tipId, taken && errId)} aria-invalid={taken || undefined} aria-expanded={open} aria-haspopup="listbox"
          onMouseDown={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); requestAnimationFrame(() => wrap.current?.querySelector<HTMLElement>("[data-name-opt]")?.focus()); } if (e.key === "Escape") setOpen(false); }}
          onChange={(e) => setD((p) => ({ ...p, code_name: e.target.value }))}
          className={cn(BOX, "pr-[136px]", border)} />
        <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-3">
          {pd.nameState === "available" && !empty && <span className="flex items-center gap-[5px] text-[13px] font-semibold text-[#15803D]"><CircleCheck className="h-[15px] w-[15px]" strokeWidth={2} />{tr("Available", "ใช้ได้")}</span>}
          <ChevronDown className={cn("h-[18px] w-[18px] transition-transform", open ? "rotate-180 text-[#6D28D9]" : "text-[#6A7181]")} strokeWidth={2} />
        </span>
      </div>
      {empty && !taken && <p className="mt-[6px] text-[12.5px] text-[#6B7280] dark:text-muted-foreground">{tr(`No listing name yet. Buyers will see ${refNo || "the ref"}.`, `ยังไม่มีชื่อประกาศ ผู้ซื้อจะเห็น ${refNo || "เลขอ้างอิง"}`)}</p>}
      {taken && (
        <p id={errId} role="alert" className="mt-[6px] text-[12.5px] font-medium text-[#B42318]">
          {tr(`“${name}” is already used by another listing. Click the field to pick a suggestion, or try another name.`, `“${name}” มีประกาศอื่นใช้แล้ว คลิกที่ช่องเพื่อเลือกชื่อที่แนะนำ หรือลองชื่ออื่น`)}
        </p>
      )}
      {open && (
        <div role="listbox" aria-label={tr("Suggested names", "ชื่อที่แนะนำ")}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setOpen(false); input.current?.focus(); return; }
            if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
            e.preventDefault();
            const opts = [...(wrap.current?.querySelectorAll<HTMLElement>("[data-name-opt]") ?? [])];
            const i = opts.indexOf(document.activeElement as HTMLElement);
            opts[(i + (e.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length]?.focus();
          }}
          className="absolute inset-x-0 top-[calc(100%+6px)] z-40 rounded-[10px] border border-[#E6E8EC] bg-background p-[6px] shadow-[0_12px_28px_rgba(16,24,40,0.14)] dark:border-border">
          <div className="flex items-center justify-between pb-[6px] pl-[10px] pr-[6px] pt-1">
            <span className="flex items-center gap-[6px] text-[12.5px] font-semibold text-[#5F6676]"><Sparkles className="h-[14px] w-[14px] text-[#6D28D9]" />{tr("Suggested names", "ชื่อที่แนะนำ")}</span>
            <button type="button" onClick={pd.moreNames} className="flex h-7 items-center gap-1 rounded-md px-2 text-[12.5px] font-semibold text-[#6D28D9] hover:bg-[#F7F3FF] dark:hover:bg-muted">
              <RefreshCw className="h-[13px] w-[13px]" />{tr("More ideas", "แนะนำเพิ่ม")}
            </button>
          </div>
          {ideas.codeIdeas.map((n) => {
            const cur = n.trim().toLowerCase() === name.toLowerCase();
            return (
              <button key={n} type="button" role="option" aria-selected={cur} data-name-opt onClick={() => pick(n)}
                className={cn("flex h-[38px] w-full items-center gap-[10px] rounded-[7px] px-[10px] text-left text-[14px] font-medium text-[#374151] outline-none hover:bg-[#F7F3FF] focus:bg-[#F7F3FF] max-sm:h-[42px] dark:text-foreground dark:hover:bg-muted dark:focus:bg-muted",
                  cur && "bg-[#F3EEFF] font-semibold text-[#151A28] dark:bg-muted")}>
                {cur ? <Check className="h-[15px] w-[15px] text-[#6D28D9]" /> : <Plus className="h-[15px] w-[15px] text-[#6D28D9]" />}
                <span className="flex-1 truncate">{n}</span>
                {cur && <span className="text-[12px] text-[#6A7181]">{tr("In use", "ใช้อยู่")}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BuyerPreview({ d, sector, pickedImage, source, refNo }: { d: HiddenDraft; sector: string | null; pickedImage: string | null | undefined; source?: ListingSource; refNo?: string }) {
  const tr = useTr();
  const name = d.code_name.trim();
  const head = d.headline.trim();
  const city = source?.city || source?.headquarters || "";
  const products = (d.product_tags ?? source?.product_tags ?? []).slice(0, 3).join(", ");
  const markets = (d.market_tags ?? source?.market_tags ?? []).slice(0, 3).join(", ");
  const rev = revenueBand(source?.last_year_revenue) ?? "—";
  const caption = <div className="mb-2 flex items-center gap-[6px] text-[12.5px] font-semibold text-[#4338CA]"><Eye className="h-[14px] w-[14px]" strokeWidth={2} />{tr("Buyer preview", "ตัวอย่างที่ผู้ซื้อเห็น")}</div>;
  const nameEl = <div className={cn("text-[14px] font-bold text-[#151A28] dark:text-foreground", !name && "font-semibold text-[#8A90A0]")}>{name || refNo || tr("Your listing name", "ชื่อประกาศของท่าน")}</div>;
  const headEl = (cls: string) => <div className={cn("text-[12px] text-[#4B5563] dark:text-muted-foreground", cls, !head && "font-semibold text-[#8A90A0]")}>{head || tr("Your headline", "หัวข้อประกาศของท่าน")}</div>;
  return (
    <div aria-hidden className="pointer-events-none sm:sticky sm:top-4">
      {caption}
      <div className="overflow-hidden rounded-xl border border-[#F6C77A] bg-background max-sm:hidden">
        <SectorArt sector={sector} imageId={pickedImage ?? null} className="h-[140px] w-full [&_img]:object-cover" />
        <div className="px-3 pb-[14px] pt-3">
          {nameEl}
          <div className="mt-1 truncate text-[11.5px] text-[#6A7181]">{[refNo, sector, city].filter(Boolean).join(" · ")}</div>
          {headEl("mt-2")}
          <div className="mt-3 space-y-2 text-[11.5px]">
            <div className="flex justify-between"><span className="text-[#6A7181]">{tr("Revenue", "รายได้")}</span><span className="font-medium">{rev}</span></div>
            <div><div className="text-[10.5px] font-bold uppercase tracking-wide text-[#6A7181]">{tr("Products & services", "สินค้าและบริการ")}</div><div>{products || "—"}</div></div>
            <div><div className="text-[10.5px] font-bold uppercase tracking-wide text-[#6A7181]">{tr("Markets", "ตลาด")}</div><div>{markets || "—"}</div></div>
          </div>
        </div>
      </div>
      <div className="hidden items-center gap-3 rounded-xl border border-[#F6C77A] bg-background p-[10px] max-sm:flex">
        <SectorArt sector={sector} imageId={pickedImage ?? null} className="h-[50px] w-[88px] shrink-0 rounded-lg" />
        <div className="min-w-0">{nameEl}{headEl("mt-[2px] truncate")}</div>
      </div>
    </div>
  );
}
