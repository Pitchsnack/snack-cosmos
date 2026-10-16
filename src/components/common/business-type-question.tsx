/**
 * The setup wizards' sector question: 16 business-type tiles, kind chips for
 * Manufacturing / Construction, the result box, and the SET picker under Other.
 * Seller = one (radio group); buyer / advisor = up to 5 types (toggle buttons).
 */
import { useRef, useState, type KeyboardEvent } from "react";
import {
  Bed, Briefcase, Building2, Car, Check, CircleAlert, CircleEllipsis, CookingPot, Factory, GraduationCap, HardHat,
  Laptop, Package, ShoppingBag, Sprout, Stethoscope, TriangleAlert, Truck, Utensils, type LucideIcon,
} from "lucide-react";
import { SetSectorPicker } from "@/components/common/set-sector-picker";
import { useTranslation, tr } from "@/i18n/language";
import { sectorGroupOf } from "@/lib/sectors";
import {
  BIZ_TYPES, KINDS, hasKinds, pickSector, pickTags, type SectorPick, type SectorPicks, type TypeKey,
} from "@/lib/business-types";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  utensils: Utensils, bed: Bed, factory: Factory, "shopping-bag": ShoppingBag, package: Package, "hard-hat": HardHat,
  sprout: Sprout, "cooking-pot": CookingPot, truck: Truck, stethoscope: Stethoscope, briefcase: Briefcase, laptop: Laptop,
  "building-2": Building2, "graduation-cap": GraduationCap, car: Car, "circle-ellipsis": CircleEllipsis,
};

const ring = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]";
const tileCls = (on: boolean) => cn("flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-[12px] px-2 py-3 text-center", ring,
  on ? "border-[1.5px] border-[#1E2A4A] bg-[#F3F5F9] text-[#1E2A4A] dark:border-[#4A5CA6] dark:bg-[#1B2238] dark:text-[#C9D5F0]"
    : "border border-[#DCDFE5] bg-white text-[#374151] hover:bg-[#F6F7F9] dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-muted");
const chipCls = (on: boolean) => cn("inline-flex h-[38px] items-center gap-1.5 rounded-full px-[14px] text-[14px]", ring,
  on ? "border-[1.5px] border-[#1E2A4A] bg-[#F3F5F9] font-semibold text-[#1E2A4A] dark:border-[#4A5CA6] dark:bg-[#1B2238] dark:text-[#C9D5F0]"
    : "border border-[#DCDFE5] bg-white text-[#151A28] hover:bg-[#F6F7F9] dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-muted");
const boxCls = "mt-[22px] rounded-[12px] border border-[#D6E7FC] bg-[#F4F9FF] px-4 py-[14px] dark:border-[#2B4763] dark:bg-[#16283A]";
const linkCls = "text-[13.5px] font-semibold text-[#1E2A4A] underline underline-offset-2 dark:text-[#C9D5F0]";

function useL() {
  const { language } = useTranslation();
  return (en: string, th: string) => (language === "th" ? th : en);
}

function Tile({ t, on, ...rest }: { t: (typeof BIZ_TYPES)[number]; on: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const L = useL();
  const Icon = ICONS[t.icon]!;
  return (
    <button type="button" {...rest} className={tileCls(on)}>
      <Icon aria-hidden className="h-6 w-6" strokeWidth={1.8} />
      <span className={cn("text-[13.5px] leading-[1.3]", on ? "font-semibold" : "font-medium")}>{L(t.label, t.th)}</span>
    </button>
  );
}

function Err({ m }: { m: string | null }) {
  if (!m) return null;
  return <p className="mt-2 flex items-center gap-1.5 text-[13px] text-[#B42318]"><CircleAlert className="h-[15px] w-[15px]" />{m}</p>;
}

/** Arrow keys move and pick inside a radio group of buttons. */
function radioKeys(e: KeyboardEvent, i: number, n: number, pick: (j: number) => void, root: HTMLElement | null) {
  const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
  if (!d) return;
  e.preventDefault();
  const j = (i + d + n) % n;
  pick(j);
  root?.querySelectorAll<HTMLElement>("[role=radio]")[j]?.focus();
}

/* ================================ Seller ================================ */

export function SellerTypeQuestion({ pick, sector, onChange, error }: {
  pick: SectorPick | null; sector: string | null; onChange: (pick: SectorPick | null, sector: string | null) => void; error?: string | null;
}) {
  const L = useL();
  const given = pickSector(pick);
  // All sectors is open for Other, or when the saved sector isn't what the pick gives.
  const [all, setAll] = useState(() => !!pick && (pick.type === "other" || (!!sector && given !== sector)) || (!pick && !!sector));
  const effPick: SectorPick | null = pick ?? (sector ? { type: "other" } : null);
  const tilesRef = useRef<HTMLDivElement>(null);
  const kindsRef = useRef<HTMLDivElement>(null);
  const kinds = effPick && hasKinds(effPick.type) ? KINDS[effPick.type] : null;

  const pickType = (t: TypeKey) => {
    const p: SectorPick = { type: t };
    setAll(t === "other");
    onChange(p, pickSector(p));
  };
  const pickKind = (k: string) => { const p = { ...effPick!, kind: k }; onChange(p, pickSector(p)); };
  const tIdx = Math.max(0, BIZ_TYPES.findIndex((t) => t.key === effPick?.type));

  return (
    <div>
      <div ref={tilesRef} role="radiogroup" aria-label={L("What your business does", "ธุรกิจของท่านทำอะไร")} className="grid grid-cols-4 gap-[10px] max-[599px]:grid-cols-2">
        {BIZ_TYPES.map((t, i) => {
          const on = effPick?.type === t.key;
          return <Tile key={t.key} t={t} on={on} role="radio" aria-checked={on} tabIndex={i === tIdx ? 0 : -1}
            onClick={() => pickType(t.key)} onKeyDown={(e) => radioKeys(e, i, BIZ_TYPES.length, (j) => pickType(BIZ_TYPES[j]!.key), tilesRef.current)} />;
        })}
      </div>
      <Err m={error ?? null} />

      {kinds && !all && (
        <div className="mt-[22px]">
          <div className="text-[15px] font-semibold text-[#151A28] dark:text-foreground">
            {effPick!.type === "manufacturing" ? L("What do you make?", "ท่านผลิตอะไร?") : L("What kind of construction business?", "ธุรกิจก่อสร้างประเภทใด?")}
          </div>
          <div ref={kindsRef} role="radiogroup" className="mt-[10px] flex flex-wrap gap-2">
            {kinds.map((k, i) => {
              const on = effPick!.kind === k.key;
              const ki = Math.max(0, kinds.findIndex((x) => x.key === effPick!.kind));
              return (
                <button key={k.key} type="button" role="radio" aria-checked={on} tabIndex={i === ki ? 0 : -1} className={chipCls(on)}
                  onClick={() => pickKind(k.key)} onKeyDown={(e) => radioKeys(e, i, kinds.length, (j) => pickKind(kinds[j]!.key), kindsRef.current)}>
                  {on && <Check aria-hidden className="h-[13px] w-[13px]" strokeWidth={3} />}{L(k.label, k.th)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {all && (
        <div className="mt-[22px]">
          <div className="mb-[10px] flex items-center justify-between gap-3">
            <span className="text-[15px] font-semibold text-[#151A28] dark:text-foreground">{L("Pick from all sectors", "เลือกจากทุกกลุ่มอุตสาหกรรม")}</span>
            {effPick?.type !== "other" && (
              <button type="button" className={linkCls} onClick={() => { setAll(false); onChange(effPick, pickSector(effPick)); }}>
                {L("Back to the short list", "กลับไปที่รายการสั้น")}
              </button>
            )}
          </div>
          <SetSectorPicker mode="single" focusOnMount value={sector ? [sector] : []} onChange={(v) => onChange(effPick, v[0] ?? null)} />
        </div>
      )}

      {sector && (
        <div role="status" className="btq-box mt-[22px] overflow-hidden rounded-[12px] border border-[#D6E7FC] bg-[#F4F9FF] dark:border-[#2B4763] dark:bg-[#16283A]">
          <div className="flex items-start gap-3 px-4 py-[14px]">
            <span className="btq-ok grid h-5 w-5 flex-none place-items-center rounded-full bg-[#15803D] text-white"><Check className="h-3 w-3" strokeWidth={3.2} /></span>
            <div className="min-w-0 space-y-1">
              <div className="btq-title text-[13px] font-semibold text-[#434A5C] dark:text-muted-foreground">{L("Industry Sector", "ธุรกิจของท่านอยู่ในกลุ่มอุตสาหกรรม")}</div>
              <div className="btq-sector text-[14px] font-bold text-[#151A28] dark:text-foreground">
                {tr(sectorGroupOf(sector) ?? "")} <span className="inline-block">({tr(sector)})</span>
              </div>
            </div>
          </div>
          {!all && (
            <button type="button" onClick={() => setAll(true)}
              className="btq-row flex min-h-[46px] w-full items-center justify-between gap-3 rounded-b-[11px] border-t border-[#D6E7FC] bg-white px-4 text-left text-[13.5px] font-semibold text-[#1E2A4A] outline-none hover:bg-[#F6F7F9] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#2563EB] dark:border-[#2B4763] dark:bg-card dark:text-[#C9D5F0] dark:hover:bg-muted">
              {L("Not right? Pick from all sectors", "ไม่ตรง? เลือกจากทุกกลุ่มอุตสาหกรรม")}
              <ChevronRight aria-hidden className="h-[18px] w-[18px] flex-none" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================ Buyer / advisor ============================ */

export type ManyWords = {
  agnosticLine: string; note?: string; above: string; kindsNone: string; boxTitle: string; boxLast: string;
};

export function buyerWords(L: (en: string, th: string) => string): ManyWords {
  return {
    agnosticLine: L("We look at every industry", "เราพิจารณาทุกอุตสาหกรรม"),
    note: L("Sellers may avoid sector-agnostic investors because there's no clear focus. Picking up to 5 types of business helps the right sellers find you.",
      "ผู้ขายอาจหลีกเลี่ยงนักลงทุนที่ไม่จำกัดกลุ่มอุตสาหกรรม เพราะไม่มีจุดเน้นที่ชัดเจน การเลือกประเภทธุรกิจได้สูงสุด 5 ประเภทช่วยให้ผู้ขายที่ใช่พบท่าน"),
    above: L("Or pick the types of business you invest in", "หรือเลือกประเภทธุรกิจที่ท่านลงทุน"),
    kindsNone: L("Optional. With none picked, we match you with every kind.", "ไม่บังคับ หากไม่เลือก เราจะจับคู่ท่านกับทุกประเภท"),
    boxTitle: L("Sectors we'll match you with", "กลุ่มอุตสาหกรรมที่เราจะจับคู่ให้ท่าน"),
    boxLast: L("From the Stock Exchange of Thailand's list. Sellers in these sectors see you as a match.", "ตามรายชื่อของตลาดหลักทรัพย์แห่งประเทศไทย ผู้ขายในกลุ่มเหล่านี้จะเห็นท่านเป็นคู่ที่เหมาะสม"),
  };
}
export function advisorWords(L: (en: string, th: string) => string): ManyWords {
  return {
    agnosticLine: L("We work across every industry", "เราทำงานในทุกอุตสาหกรรม"),
    above: L("Or pick the types of business you know best", "หรือเลือกประเภทธุรกิจที่ท่านเชี่ยวชาญ"),
    kindsNone: L("Optional. With none picked, your card shows every kind.", "ไม่บังคับ หากไม่เลือก การ์ดของท่านจะแสดงทุกประเภท"),
    boxTitle: L("Sectors on your card", "กลุ่มอุตสาหกรรมบนการ์ดของท่าน"),
    boxLast: L("From the Stock Exchange of Thailand's list, the same sectors sellers pick for their business.", "ตามรายชื่อของตลาดหลักทรัพย์แห่งประเทศไทย เป็นกลุ่มเดียวกับที่ผู้ขายเลือกให้ธุรกิจของตน"),
  };
}
export { useL };

/** Continue's rule for buyer / advisor: null = valid. */
export function manyError(picks: SectorPicks, agnostic: boolean, L: (en: string, th: string) => string): string | null {
  if (agnostic) return null;
  if (!picks.types.length) return L("Pick at least one type of business, or Sector agnostic.", "เลือกประเภทธุรกิจอย่างน้อย 1 ประเภท หรือไม่จำกัดกลุ่มอุตสาหกรรม");
  if (picks.types.includes("other") && !picks.other.length) return L("Tick at least one sector under Other.", "เลือกอย่างน้อย 1 กลุ่มอุตสาหกรรมใต้ อื่น ๆ");
  return null;
}

export function ManyTypeQuestion({ picks, agnostic, onChange, words, error, max = 5 }: {
  picks: SectorPicks; agnostic: boolean; onChange: (picks: SectorPicks, agnostic: boolean) => void; words: ManyWords; error?: string | null; max?: number;
}) {
  const L = useL();
  const n = picks.types.length;
  const toggleType = (t: TypeKey) => {
    if (picks.types.includes(t)) {
      const kinds = { ...picks.kinds };
      if (hasKinds(t)) delete kinds[t];
      onChange({ types: picks.types.filter((x) => x !== t), kinds, other: t === "other" ? [] : picks.other }, false);
      return;
    }
    if (n >= max) return;
    onChange({ ...picks, types: [...picks.types, t] }, false);
  };
  const toggleKind = (t: "manufacturing" | "construction", k: string) => {
    const cur = picks.kinds[t] ?? [];
    onChange({ ...picks, kinds: { ...picks.kinds, [t]: cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k] } }, false);
  };
  const tags = pickTags(picks);

  return (
    <div>
      <button type="button" aria-pressed={agnostic} onClick={() => onChange(agnostic ? picks : { types: [], kinds: {}, other: [] }, !agnostic)}
        className={cn("flex min-h-[54px] w-full items-center gap-3 rounded-[12px] px-4 py-2 text-left", ring,
          agnostic ? "border-[1.5px] border-[#1E2A4A] bg-[#F3F5F9] dark:border-[#4A5CA6] dark:bg-[#1B2238]" : "border border-[#DCDFE5] bg-white dark:border-border dark:bg-card")}>
        <span className={cn("grid h-[18px] w-[18px] flex-none place-items-center rounded-[5px] text-white",
          agnostic ? "bg-[#1E2A4A] dark:bg-[#4A5CA6]" : "border-[1.5px] border-[#B8BEC9] dark:border-[#3A4158]")}>{agnostic && <Check className="h-3 w-3" strokeWidth={3} />}</span>
        <span>
          <span className={cn("block text-[16px] text-[#151A28] dark:text-foreground", agnostic ? "font-semibold" : "font-medium")}>{tr("Sector agnostic")}</span>
          <span className="text-[13px] text-[#6B7280] dark:text-muted-foreground">{words.agnosticLine}</span>
        </span>
      </button>
      {agnostic && words.note && (
        <p className="mt-[10px] flex items-start gap-2 rounded-[10px] border border-[#F3D9A6] bg-[#FFF4E0] px-3 py-[10px] text-[13px] text-[#8A5A06] dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <TriangleAlert className="mt-0.5 h-[15px] w-[15px] flex-none" />{words.note}
        </p>
      )}

      <div className="mt-[18px] text-[13px] font-semibold text-[#6B7280] dark:text-muted-foreground">{words.above}</div>
      <div role="group" aria-label={L("Types of business", "ประเภทธุรกิจ")} className="mt-[10px] grid grid-cols-4 gap-[10px] max-[599px]:grid-cols-2">
        {BIZ_TYPES.map((t) => <Tile key={t.key} t={t} on={picks.types.includes(t.key)} aria-pressed={picks.types.includes(t.key)} onClick={() => toggleType(t.key)} />)}
      </div>
      <p className={cn("mt-[10px] text-[13px]", !agnostic && n >= max ? "text-[#B45309]" : "text-[#6B7280] dark:text-muted-foreground")}>
        {agnostic ? L("Sector agnostic: every industry.", "ไม่จำกัดกลุ่มอุตสาหกรรม: ทุกอุตสาหกรรม")
          : n >= max ? L(`${max} of ${max} picked. Untick one to pick another.`, `เลือกแล้ว ${max} จาก ${max} ยกเลิกหนึ่งรายการเพื่อเลือกรายการอื่น`)
          : L(`${n} of ${max} picked`, `เลือกแล้ว ${n} จาก ${max}`)}
      </p>
      <Err m={error ?? null} />

      {picks.types.filter(hasKinds).map((t) => {
        const ks = picks.kinds[t] ?? [];
        return (
          <div key={t} className="mt-5">
            <div className="text-[15px] font-semibold text-[#151A28] dark:text-foreground">
              {t === "manufacturing" ? L("Which kinds of manufacturing?", "การผลิตประเภทใดบ้าง?") : L("Which kinds of construction business?", "ธุรกิจก่อสร้างประเภทใดบ้าง?")}
            </div>
            <div className="mt-[2px] text-[13px] text-[#6B7280] dark:text-muted-foreground">{ks.length ? L("Pick all that apply.", "เลือกทั้งหมดที่ตรงกัน") : words.kindsNone}</div>
            <div className="mt-[10px] flex flex-wrap gap-2">
              {KINDS[t].map((k) => {
                const on = ks.includes(k.key);
                return <button key={k.key} type="button" aria-pressed={on} className={chipCls(on)} onClick={() => toggleKind(t, k.key)}>
                  {on && <Check aria-hidden className="h-[13px] w-[13px]" strokeWidth={3} />}{L(k.label, k.th)}
                </button>;
              })}
            </div>
          </div>
        );
      })}

      {picks.types.includes("other") && (
        <div className="mt-5">
          <div className="mb-[10px] text-[15px] font-semibold text-[#151A28] dark:text-foreground">{L("Pick from all sectors", "เลือกจากทุกกลุ่มอุตสาหกรรม")}</div>
          <div className="[&>div>div:last-child]:hidden">
            <SetSectorPicker mode="multi" max={999} value={picks.other} onChange={(v) => onChange({ ...picks, other: v }, false)} />
          </div>
        </div>
      )}

      {(agnostic || tags.length > 0) && (
        <div role="status" className={boxCls}>
          <div className="text-[13px] font-semibold text-[#434A5C] dark:text-muted-foreground">{words.boxTitle}</div>
          {agnostic ? <div className="mt-1 text-[16px] font-bold text-[#151A28] dark:text-foreground">{L("Every sector", "ทุกกลุ่มอุตสาหกรรม")}</div> : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t.label} className="inline-flex min-h-7 items-center rounded-full border border-[#D6E7FC] bg-white px-[10px] py-[3px] text-[13px] font-semibold leading-[1.35] text-[#151A28] dark:border-[#2B4763] dark:bg-card dark:text-foreground">
                  {t.broad ? (t.broad === "manufacturing" ? L(`All manufacturing · ${t.sectors.length} sectors`, `การผลิตทั้งหมด · ${t.sectors.length} กลุ่ม`) : L(`All construction · ${t.sectors.length} sectors`, `ก่อสร้างทั้งหมด · ${t.sectors.length} กลุ่ม`))
                    : `${tr(sectorGroupOf(t.sectors[0]) ?? "")} › ${tr(t.sectors[0]!)}`}
                </span>
              ))}
            </div>
          )}
          {!agnostic && <p className="mt-2 text-[13px] text-[#6B7280] dark:text-muted-foreground">{words.boxLast}</p>}
        </div>
      )}
    </div>
  );
}
