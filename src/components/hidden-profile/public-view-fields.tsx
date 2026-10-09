import { useEffect, useMemo, useRef, useState, type ReactNode, type KeyboardEvent } from "react";
import { AlertTriangle, Check, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EditSec } from "@/components/common/edit-section";
import { TabHead, useTr } from "@/components/common/edit-info-popup";
import { SectorPicker } from "@/components/startups/sector-fields";
import { useSectorImages, resolveCover } from "@/hooks/use-sector-images";
import { SectorArt } from "@/components/hidden-profile/bits";
import {
  DEAL_TYPES, HIDDEN_FIELD_LABEL, OPEN_TO, identityTerms, pickDraft, runIdentityCheck, suggestCodeName,
  type EntryFacts, type HiddenDraft, type HiddenProfileRow, type HiddenTextField,
} from "@/lib/hidden-profile";
import {
  suggestBusinessDescription, suggestCodeNames, suggestCustomersSummary, suggestHeadline, suggestHighlights, type ListingSource,
} from "@/lib/public-listing";
import { cn } from "@/lib/utils";

/**
 * Edit information › Public view: what Edit public view held (Anonymous
 * identity, Public description, Deal terms), as three tabs of Edit my startup.
 * State lives in usePublicDraft so the one Save of the form stores it.
 */

export type PublicTab = "identity" | "description" | "deal";

export function usePublicDraft(row: HiddenProfileRow | null, facts: EntryFacts | undefined, source: ListingSource | undefined) {
  const base = useMemo(() => pickDraft(row ?? {}), [row?.id, row?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps
  const [d, setD] = useState<HiddenDraft>(base);
  useEffect(() => setD(base), [base]);
  // Generated text never names the company; the City (province) stands in for the old Region.
  const opts = useMemo(() => ({ guard: facts ? identityTerms(facts) : [] }), [facts]);
  const codeIdeas = useMemo(() => (source ? suggestCodeNames(source, opts) : []), [source, opts]);
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
    setD((p) => ({
      ...p,
      code_name: p.code_name.trim() ? p.code_name : (codeIdeas[0] ?? p.code_name),
      headline: p.headline.trim() ? p.headline : headlineIdea,
      description: p.description.trim() ? p.description : descIdea,
      highlights: p.highlights.map((h, i) => (h.trim() ? h : (highlightIdeas[i] ?? h))),
      customers_summary: p.customers_summary.trim() ? p.customers_summary : customersIdea,
    }));
  }, [row, source, headlineIdea, descIdea, highlightIdeas, codeIdeas, customersIdea]);

  const fillAll = () => setD((p) => ({
    ...p,
    code_name: p.code_name.trim() || (codeIdeas[0] ?? suggestCodeName()),
    headline: headlineIdea || p.headline,
    description: descIdea || p.description,
    highlights: p.highlights.map((h, i) => highlightIdeas[i] ?? h),
    customers_summary: customersIdea || p.customers_summary,
  }));

  const findings = useMemo(() => (facts ? runIdentityCheck(d, facts) : []), [d, facts]);
  const counts: Record<PublicTab, number> = {
    identity: d.code_name.trim() ? 0 : 1,
    description: (d.headline.trim() ? 0 : 1) + (d.description.trim() ? 0 : 1) + (d.highlights.slice(0, 3).every((h) => h.trim()) ? 0 : 1),
    deal: d.stake_pct != null && !!d.deal_type ? 0 : 1,
  };
  // Pristine until the seller changes something (the first-open prefill counts as a change only once saved).
  const [baseline, setBaseline] = useState("");
  useEffect(() => { if (!baseline || prefilled.current) setBaseline(JSON.stringify(d)); }, [base, prefilled.current]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = !!row && !!baseline && JSON.stringify(d) !== baseline;
  const changedFromRow = !!row && JSON.stringify(pickDraft(row)) !== JSON.stringify(d);
  const payload = { ...d, highlights: d.highlights.map((h) => h.trim()) };
  return { d, setD, ideas: { codeIdeas, headlineIdea, descIdea, highlightIdeas, customersIdea }, fillAll, findings, counts, dirty, changedFromRow, payload };
}
export type PublicDraftState = ReturnType<typeof usePublicDraft>;

const LABEL = "text-[14px] font-semibold text-[#151A28] dark:text-foreground";
const HINT = "mt-[2px] text-[12px] text-[#6A7181] dark:text-muted-foreground";

function SuggestLink({ onClick }: { onClick: () => void }) {
  const tr = useTr();
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-[5px] text-[13.5px] font-semibold text-[#6D28D9] hover:underline dark:text-violet-300">
      <Sparkles className="h-[15px] w-[15px]" />{tr("Suggest", "แนะนำ")}
    </button>
  );
}

function FieldRow({ label, missing, count, suggest, extra, children, htmlFor }: {
  label: string; missing?: boolean; count?: ReactNode; suggest?: () => void; extra?: ReactNode; children: ReactNode; htmlFor?: string;
}) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-[14px] gap-y-1">
        <label htmlFor={htmlFor} className={cn(LABEL, missing && "text-[#DC2626] dark:text-red-400")}>{label}</label>
        <div className="flex items-center gap-[14px]">
          {extra}
          {count != null && <span className="text-[12.5px] tabular-nums text-[#8A90A0]">{count}</span>}
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

export function PublicViewTab({ tab, pd, sector, onSector, pickedImage, onPickImage, section }: {
  tab: PublicTab; pd: PublicDraftState; sector: string | null; onSector: (v: string | null) => void;
  /** Picked public image (undefined = the listing's saved pick). */
  pickedImage: string | null | undefined; onPickImage: (id: string | null) => void;
  section?: string;
}) {
  const tr = useTr();
  const { d, setD, ideas } = pd;
  const set = <K extends keyof HiddenDraft>(k: K, v: HiddenDraft[K]) => setD((p) => ({ ...p, [k]: v }));
  const flag = (k: HiddenTextField) => (pd.findings.some((f) => f.field === k) ? "border-destructive focus-visible:ring-destructive" : "");
  const fill = <Button type="button" variant="outline" size="sm" onClick={pd.fillAll}><Sparkles className="mr-1.5 h-3.5 w-3.5" />Auto-fill all</Button>;
  const [codeIdx, setCodeIdx] = useState(0);
  const nextCode = () => {
    if (!ideas.codeIdeas.length) return set("code_name", suggestCodeName());
    set("code_name", ideas.codeIdeas[codeIdx % ideas.codeIdeas.length]);
    setCodeIdx((i) => i + 1);
  };

  if (tab === "identity") return (
    <div>
      <IdentityMsg pd={pd} />
      <TabHead title={tr("Marketplace listing name", "ชื่อประกาศใน Marketplace")}>{fill}</TabHead>
      <div className="space-y-6">
        <EditSec id="codename" tone="seller" active={section === "codename"}>
          <FieldRow label="Code name (unique in the Marketplace)" htmlFor="hp-code_name" missing={!d.code_name.trim()} suggest={nextCode}>
            <Input id="hp-code_name" value={d.code_name} onChange={(e) => set("code_name", e.target.value)} className={cn("h-[42px]", flag("code_name"))} />
          </FieldRow>
          {ideas.codeIdeas.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ideas.codeIdeas.map((c) => (
                <button key={c} type="button" onClick={() => set("code_name", c)} className="rounded-full border border-border px-2.5 py-0.5 text-[12px] hover:bg-muted">{c}</button>
              ))}
            </div>
          )}
          <FlagMsg pd={pd} k="code_name" />
        </EditSec>
        <div className="!mt-5">
          <div className={LABEL}>{tr("Sector", "หมวดธุรกิจ")}</div>
          <p className={cn(HINT, "mb-2")}>{tr("Shown on your listing. It also sets the pictures below.", "แสดงบนประกาศของท่าน และใช้กำหนดภาพด้านล่างด้วย")}</p>
          <SectorPicker value={sector} onChange={onSector} />
        </div>
        <EditSec id="image" tone="seller" active={section === "image"} className="!mt-[18px]">
          <SectorPictures sector={sector} picked={pickedImage} onPick={onPickImage} />
        </EditSec>
      </div>
    </div>
  );

  if (tab === "description") return (
    <div>
      <IdentityMsg pd={pd} />
      <TabHead title={tr("Listing Info", "ข้อมูลประกาศ")}>{fill}</TabHead>
      <div className="space-y-6">
        <EditSec id="headline" tone="seller" active={section === "headline"}>
          <FieldRow label="Headline" htmlFor="hp-headline" missing={!d.headline.trim()} count={`${d.headline.length}/120`} suggest={ideas.headlineIdea ? () => set("headline", ideas.headlineIdea) : undefined}>
            <Input id="hp-headline" maxLength={120} value={d.headline} placeholder={ideas.headlineIdea} onChange={(e) => set("headline", e.target.value)} className={cn("h-[42px]", flag("headline"))} />
          </FieldRow>
          {ideas.headlineIdea && d.headline.trim() !== ideas.headlineIdea && (
            <button type="button" onClick={() => set("headline", ideas.headlineIdea)} className="mt-2 inline-flex items-start gap-1 text-left text-[12px] font-semibold text-profile"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />Use: {ideas.headlineIdea}</button>
          )}
          <FlagMsg pd={pd} k="headline" />
        </EditSec>
        <EditSec id="description" tone="seller" active={section === "description"}>
          <FieldRow label="Description" htmlFor="hp-description" missing={!d.description.trim()} count={`${d.description.length}/420`} suggest={ideas.descIdea ? () => set("description", ideas.descIdea) : undefined}>
            <Textarea id="hp-description" maxLength={420} value={d.description} placeholder={ideas.descIdea} onChange={(e) => set("description", e.target.value)} className={cn("h-[112px] min-h-[112px] resize-y", flag("description"))} />
          </FieldRow>
          <FlagMsg pd={pd} k="description" />
        </EditSec>
        <EditSec id="highlights" tone="seller" active={section === "highlights"}>
          <FieldRow label="Highlights" missing={!d.highlights.slice(0, 3).every((h) => h.trim())}
            extra={<span className="text-[12.5px] text-[#8A90A0]">{tr("3 required", "ต้องมี 3 ข้อ")}</span>}
            suggest={ideas.highlightIdeas.length ? () => set("highlights", d.highlights.map((h, i) => ideas.highlightIdeas[i] ?? h)) : undefined}>
            <div role="group" aria-label="Highlights" className={cn("overflow-hidden rounded-[10px] border border-[#D7DCE3] bg-background focus-within:border-ring dark:border-input", flag("highlights"))}>
              {d.highlights.map((h, i) => {
                const filled = !!h.trim();
                const req = i < 3;
                const name = req ? tr(`Highlight ${i + 1}`, `จุดเด่นข้อที่ ${i + 1}`) : tr("Highlight 4 (optional)", "จุดเด่นข้อที่ 4 (ไม่บังคับ)");
                return (
                  <div key={i} className="flex min-h-12 items-center gap-3 border-t border-[#EEF0F3] px-[14px] first:border-t-0 focus-within:bg-[#FAFBFC] dark:border-border dark:focus-within:bg-muted/40">
                    {filled ? (
                      <span aria-hidden className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-[#E8F6EE]"><Check className="h-[13px] w-[13px] text-[#15803D]" strokeWidth={2.6} /></span>
                    ) : (
                      <span aria-hidden className={cn("grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border text-[11.5px] font-semibold", req ? "border-[#F87171] text-[#DC2626]" : "border-[#DCDFE5] text-[#8A90A0]")}>{i + 1}</span>
                    )}
                    <input aria-label={name} value={h} placeholder={name}
                      onChange={(e) => set("highlights", d.highlights.map((x, j) => (j === i ? e.target.value : x)))}
                      className="h-11 min-w-0 flex-1 border-0 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground" />
                  </div>
                );
              })}
            </div>
          </FieldRow>
          <FlagMsg pd={pd} k="highlights" />
        </EditSec>
        <EditSec id="customers" tone="seller" active={section === "customers"}>
          <FieldRow label="Customers, described without names" htmlFor="hp-customers_summary" suggest={ideas.customersIdea ? () => set("customers_summary", ideas.customersIdea) : undefined}>
            <Textarea id="hp-customers_summary" value={d.customers_summary} placeholder={ideas.customersIdea} onChange={(e) => set("customers_summary", e.target.value)} className={cn("h-[112px] min-h-[112px] resize-y", flag("customers_summary"))} />
          </FieldRow>
          <FlagMsg pd={pd} k="customers_summary" />
        </EditSec>
      </div>
    </div>
  );

  // Deal terms: every deal term is edited here, once.
  return (
    <div>
      <IdentityMsg pd={pd} />
      <TabHead title={tr("Deal Info", "ข้อมูลดีล")}>{fill}</TabHead>
      <EditSec id="deal" tone="seller" active={section === "deal" || section === "terms"} className="space-y-6">
        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <div>
            <label htmlFor="hp-asking" className={cn(LABEL, "mb-2 block")}>Asking price (฿M)</label>
            <Input id="hp-asking" data-edit-focus type="number" min={0} disabled={d.asking_price == null} value={d.asking_price ?? ""} onChange={(e) => set("asking_price", e.target.value === "" ? 0 : Number(e.target.value))} className="h-[42px]" />
            <label className="mt-1.5 flex items-center gap-1.5 text-[13px]">
              <input type="checkbox" checked={d.asking_price == null} onChange={(e) => set("asking_price", e.target.checked ? null : 0)} /> Price on request
            </label>
          </div>
          <div>
            <label htmlFor="hp-stake" className={cn(LABEL, "mb-2 block", d.stake_pct == null && "text-[#DC2626]")}>Stake %</label>
            <Input id="hp-stake" type="number" min={1} max={100} value={d.stake_pct ?? ""} onChange={(e) => set("stake_pct", e.target.value === "" ? null : Number(e.target.value))} className="h-[42px]" />
          </div>
        </div>
        <div>
          <div className={cn(LABEL, "mb-2", !d.deal_type && "text-[#DC2626]")}>Deal type</div>
          <Select value={d.deal_type ?? ""} onValueChange={(v) => set("deal_type", v)}>
            <SelectTrigger className="h-[42px]"><SelectValue placeholder="Pick a deal type" /></SelectTrigger>
            <SelectContent>{DEAL_TYPES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {(["structure", "reason", "handover", "process"] as const).map((k) => (
          <div key={k}>
            <label htmlFor={`hp-${k}`} className={cn(LABEL, "mb-2 block")}>{HIDDEN_FIELD_LABEL[k]}</label>
            <Textarea id={`hp-${k}`} rows={2} value={d[k] ?? ""} onChange={(e) => set(k, e.target.value || null)} className={flag(k)} />
            <FlagMsg pd={pd} k={k} />
          </div>
        ))}
        <div>
          <div className={cn(LABEL, "mb-2")}>Open to</div>
          <div className="flex flex-wrap gap-4 text-[14px]">
            {OPEN_TO.map((o) => (
              <label key={o} className="flex items-center gap-1.5">
                <input type="checkbox" checked={d.open_to.includes(o)} onChange={(e) => set("open_to", e.target.checked ? [...d.open_to, o] : d.open_to.filter((x) => x !== o))} /> {o}
              </label>
            ))}
          </div>
        </div>
        <div>
          <div className={cn(LABEL, "mb-2")}>Who approves NDA requests</div>
          <Select value={d.nda_approver} onValueChange={(v) => set("nda_approver", v as "seller" | "admin")}>
            <SelectTrigger className="h-[42px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin, for the seller</SelectItem>
              <SelectItem value="seller">The seller</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </EditSec>
    </div>
  );
}

/** Sector image: the sector's pictures to pick from (a radiogroup). */
function SectorPictures({ sector, picked, onPick }: { sector: string | null; picked: string | null | undefined; onPick: (id: string | null) => void }) {
  const tr = useTr();
  const { data: all } = useSectorImages();
  const imgs = useMemo(() => (sector ? (all ?? []).filter((i) => i.sector_key === sector) : []), [all, sector]);
  const current = resolveCover(all, sector, picked ?? null);
  const labelId = "sector-image-label";
  const move = (e: KeyboardEvent, i: number) => {
    const n = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!n || !imgs.length) return;
    e.preventDefault();
    const next = imgs[(i + n + imgs.length) % imgs.length];
    onPick(next.id);
    const group = e.currentTarget.parentElement;
    requestAnimationFrame(() => group?.querySelector<HTMLElement>(`[data-img="${next.id}"]`)?.focus());
  };
  const tile = "relative h-[112px] w-[200px] overflow-hidden rounded-[10px] ring-1 ring-[rgba(16,24,40,0.08)] max-sm:h-auto max-sm:w-full max-sm:aspect-video";
  const tick = <span aria-hidden className="absolute right-2 top-2 grid h-[22px] w-[22px] place-items-center rounded-full bg-[#151A28] ring-2 ring-white"><Check className="h-[14px] w-[14px] text-white" strokeWidth={3} /></span>;
  return (
    <div>
      <div id={labelId} className={LABEL}>{tr("Sector image (never the company's photos)", "ภาพประจำหมวดธุรกิจ (ไม่ใช่รูปภาพของบริษัท)")}</div>
      <p className={cn(HINT, "mb-2")}>
        {!sector ? tr("Pick your sector above to see its pictures.", "เลือกหมวดธุรกิจด้านบน เพื่อดูภาพของหมวดนั้น")
          : imgs.length ? tr(`Pictures for ${sector}, shown on your listing before an NDA.`, `ภาพสำหรับหมวด ${sector} แสดงบนประกาศของท่านก่อนลงนาม NDA`)
          : tr(`No pictures for ${sector} yet, so your listing shows the default cover.`, `ยังไม่มีภาพสำหรับหมวด ${sector} ประกาศของท่านจึงแสดงภาพปกมาตรฐาน`)}
      </p>
      {sector && (imgs.length ? (
        <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-3 max-sm:grid max-sm:grid-cols-2 max-sm:gap-2">
          {imgs.map((img, i) => {
            const on = current?.id === img.id;
            return (
              <button key={img.id} type="button" role="radio" aria-checked={on} data-img={img.id} tabIndex={on ? 0 : -1}
                aria-label={tr(`Picture ${i + 1} of ${imgs.length}`, `ภาพที่ ${i + 1} จาก ${imgs.length}`)}
                onClick={() => onPick(img.id)} onKeyDown={(e) => move(e, i)}
                className={cn(tile, "outline-none focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_#4338CA]",
                  on ? "shadow-[0_0_0_2px_#fff,0_0_0_4px_#151A28]" : "hover:shadow-[0_0_0_2px_#fff,0_0_0_4px_#CBD1DA]")}>
                {img.url && <img src={img.url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                {on && tick}
              </button>
            );
          })}
        </div>
      ) : (
        <div role="radiogroup" aria-labelledby={labelId}>
          <div role="radio" aria-checked tabIndex={0} aria-label={tr("Picture 1 of 1", "ภาพที่ 1 จาก 1")} className={cn(tile, "shadow-[0_0_0_2px_#fff,0_0_0_4px_#151A28]")}>
            <SectorArt art={sector} sector={sector} plain className="h-full w-full" />
            {tick}
          </div>
        </div>
      ))}
    </div>
  );
}
