import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CircleCheck, Filter, Lock, LockOpen, RefreshCw, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AttachmentCard } from "@/components/startups/attachment-card";
import { EMPTY_SLOT, uploadPending, type EntityMediaState } from "@/components/media/entity-media-editor";
import { createStartupMediaUploadUrl, updateStartup } from "@/lib/startups.functions";
import { checkListingName } from "@/lib/hidden-profiles.functions";
import { DEAL_TYPES, HANDOVER_MONTHS } from "@/lib/hidden-profile";
import { DEAL_HINTS, listingNameIdeas, type SellerDraft } from "@/lib/seller-wizard";
import { bandInText, bandOf, fmtThb, thbWords, thbWordsTh } from "@/lib/asking-price";
import { cn } from "@/lib/utils";

type L = (en: string, th: string) => string;
type Set = (p: Partial<SellerDraft>) => void;

export type WizardMedia = {
  startupId: string; tenantId: string;
  initial: { logoPath: string | null; logoUrl: string | null; slots: { slot: number; path: string; url: string | null }[] };
  facts: { name: string; web: string };
};

const OPT = "flex w-full items-center gap-3 rounded-[12px] border bg-white px-4 text-left text-[16px] transition-colors dark:bg-card";
const radio = (on: boolean, blue = false) =>
  cn("h-[18px] w-[18px] shrink-0 rounded-full bg-white dark:bg-card", on ? (blue ? "border-[5px] border-[#2563EB]" : "border-[5px] border-[#1E2A4A] dark:border-[#8CA3D8]") : "border-[1.5px] border-[#B8BEC9]");
const optCls = (on: boolean, blue = false) =>
  cn(OPT, on ? (blue ? "border-[1.5px] border-[#2563EB] bg-[#EFF6FF] font-semibold dark:bg-[#16283A]" : "border-[1.5px] border-[#1E2A4A] bg-[#F3F5F9] font-semibold dark:border-[#8CA3D8] dark:bg-muted") : "border-[#DCDFE5] hover:border-[#C5CBD8] dark:border-border");

/** Arrow keys move between a radio group's options. */
function arrows(e: React.KeyboardEvent<HTMLDivElement>) {
  if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
  const b = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]"));
  const i = b.indexOf(document.activeElement as HTMLButtonElement);
  if (i < 0) return;
  e.preventDefault();
  const n = b[(i + (e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : b.length - 1)) % b.length];
  n?.focus(); n?.click();
}

/* ── Logo and photos ── */
function toState(m: WizardMedia["initial"]): EntityMediaState {
  const slots: EntityMediaState["slots"] = [{ ...EMPTY_SLOT }, { ...EMPTY_SLOT }, { ...EMPTY_SLOT }];
  for (const s of m.slots) if (s.slot >= 1 && s.slot <= 3) slots[s.slot - 1] = { pendingFile: null, persistedPath: s.path, signedUrl: s.url };
  return { logo: { pendingFile: null, persistedPath: m.logoPath, signedUrl: m.logoUrl }, slots } as EntityMediaState;
}
export function PhotosQ({ media, d, set, L, sectorLine }: { media: WizardMedia; d: SellerDraft; set: Set; L: L; sectorLine: string }) {
  const [m, setM] = useState<EntityMediaState>(() => toState(media.initial));
  const upUrl = useServerFn(createStartupMediaUploadUrl);
  const save = useServerFn(updateStartup);
  const busy = useRef(false);
  const onChange = async (next: EntityMediaState) => {
    setM(next);
    if (busy.current) return;
    busy.current = true;
    try {
      // Each change is saved as it finishes: the same logo and photos the Attachment card shows.
      const { logoPath, media: list } = await uploadPending(next, ({ kind, ext }) => upUrl({ data: { tenantId: media.tenantId, startupId: media.startupId, kind, ext } }), supabase.storage.from("startup-media"));
      await save({ data: { id: media.startupId, logoPath, media: list } as never });
      const kept: EntityMediaState = {
        logo: { ...next.logo, pendingFile: null, persistedPath: logoPath, signedUrl: next.logo.pendingFile ? URL.createObjectURL(next.logo.pendingFile) : next.logo.signedUrl },
        slots: next.slots.map((s, i) => {
          const p = list.find((x) => x.slot === i + 1)?.image_path ?? null;
          return { pendingFile: null, persistedPath: p, signedUrl: p ? (s.pendingFile ? URL.createObjectURL(s.pendingFile) : s.signedUrl) : null };
        }) as EntityMediaState["slots"],
      };
      setM(kept);
      set({ hasLogo: !!logoPath, photos: list.length });
    } catch (e) { toast.error((e as Error).message); }
    finally { busy.current = false; }
  };
  const ok = !!d.hasLogo && (d.photos ?? 0) > 0;
  const dot = (on: boolean, label: string) => (
    <span className={cn("flex items-center gap-2 font-semibold", on ? "text-[#15803D]" : "text-[#6B7280]")}>
      <span className={cn("grid h-4 w-4 place-items-center rounded-full", on ? "bg-[#15803D]" : "border-[1.5px] border-[#C9CED8] bg-white")}>{on && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.2} />}</span>{label}
    </span>
  );
  return (
    <div>
      <AttachmentCard value={m} onChange={(x) => void onChange(x)} name={media.facts.name} sectorLine={sectorLine} />
      {ok ? (
        <p className="mt-[18px] flex items-center gap-1.5 text-[13.5px] font-semibold text-[#15803D]"><CircleCheck className="h-4 w-4" />{L("Your logo and photos are added. You can change them later in My Company.", "เพิ่มโลโก้และรูปภาพแล้ว ท่านเปลี่ยนได้ภายหลังที่บริษัทของฉัน")}</p>
      ) : (
        <>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
            {dot(!!d.hasLogo, L("Logo", "โลโก้"))}{dot((d.photos ?? 0) > 0, L("At least 1 photo", "รูปภาพอย่างน้อย 1 รูป"))}
            <span className="text-[#6B7280]">{L("Both are needed to continue.", "ต้องมีทั้งสองอย่างจึงจะไปต่อได้")}</span>
          </div>
          <div className="mt-[22px] rounded-[12px] border border-[#D6E7FC] bg-[#F4F9FF] px-[18px] py-4 dark:border-border dark:bg-[#16283A]">
            <p className="text-[14.5px] font-bold">{L("Why add them", "ทำไมต้องเพิ่ม")}</p>
            <ul className="mt-2.5 space-y-1.5">
              {[L("Create a logo and good-quality business photos to help buyers to understand and remember your company.", "สร้างโลโก้และรูปภาพกิจการคุณภาพดี เพื่อช่วยให้ผู้ซื้อเข้าใจและจดจำบริษัทของท่าน"),
                L("Make a stronger first impression.", "สร้างความประทับใจแรกที่ดีกว่า"),
                L("Help your profile get noticed. Some investors may skip listings without images when reviewing many opportunities.", "ช่วยให้โปรไฟล์ของท่านโดดเด่น นักลงทุนบางรายอาจข้ามประกาศที่ไม่มีรูปภาพเมื่อพิจารณาหลายโอกาส")].map((x) => (
                <li key={x} className="flex items-start gap-2 text-[14px] text-[#434A5C] dark:text-muted-foreground"><Check className="mt-[3px] h-3.5 w-3.5 shrink-0 text-[#15803D]" strokeWidth={2.8} />{x}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Deal type ── */
export function DealQ({ d, pick, L }: { d: SellerDraft; pick: (p: Partial<SellerDraft>) => void; L: L }) {
  return (
    <div role="radiogroup" aria-label={L("Deal type", "รูปแบบดีล")} className="grid gap-2.5" onKeyDown={arrows}>
      {DEAL_TYPES.map((t) => {
        const on = d.deal === t;
        return (
          <button key={t} type="button" role="radio" aria-checked={on} tabIndex={on || (!d.deal && t === DEAL_TYPES[0]) ? 0 : -1}
            onClick={() => pick({ deal: t })} className={cn(optCls(on), "min-h-[66px] gap-3.5 py-2.5")}>
            <span className={radio(on)} />
            <span><span className={cn("block", on && "font-semibold")}>{L(t, ({ "Full acquisition": "เข้าซื้อกิจการทั้งหมด", "Majority stake (above 51%)": "หุ้นส่วนใหญ่ (มากกว่า 51%)", "Minority stake (below 49%)": "หุ้นส่วนน้อย (น้อยกว่า 49%)" } as Record<string, string>)[t] ?? t)}</span>
              <span className="block text-[13.5px] font-normal text-[#6B7280]">{L(...DEAL_HINTS[t]!)}</span></span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Owner handover ── */
export function HandoverQ({ d, set, L }: { d: SellerDraft; set: Set; L: L }) {
  const pickYN = (v: "yes" | "no") => set(v === "yes" ? { stays: "yes", months: d.months ?? 6 } : { stays: "no" });
  return (
    <div>
      <div role="radiogroup" aria-label={L("Owner handover", "การส่งมอบงานของเจ้าของ")} className="grid grid-cols-2 gap-2.5" onKeyDown={arrows}>
        {(["yes", "no"] as const).map((v) => {
          const on = d.stays === v;
          return (
            <button key={v} type="button" role="radio" aria-checked={on} tabIndex={on || (!d.stays && v === "yes") ? 0 : -1} onClick={() => pickYN(v)} className={cn(optCls(on, true), "h-[50px]")}>
              <span className={radio(on, true)} />{v === "yes" ? L("Yes", "ใช่") : L("No", "ไม่")}
            </button>
          );
        })}
      </div>
      {d.stays === "yes" && (
        <div className="mt-5">
          <p id="sw-months" className="text-[14px] font-semibold">{L("For how long after the sale?", "นานเท่าใดหลังการขาย")}</p>
          <div role="radiogroup" aria-labelledby="sw-months" className="mt-2 flex flex-wrap gap-2" onKeyDown={arrows}>
            {HANDOVER_MONTHS.map((n) => {
              const on = (d.months ?? 6) === n;
              return (
                <button key={n} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} onClick={() => set({ months: n })}
                  className={cn("h-9 rounded-full border px-3.5 text-[14px] font-semibold", on ? "border-[#2563EB] bg-[#2563EB] text-white" : "border-[#DCDFE5] bg-white text-[#374151] dark:border-border dark:bg-card dark:text-foreground")}>
                  {L(`${n} month${n === 1 ? "" : "s"}`, `${n} เดือน`)}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {d.stays === "no" && <p className="mt-3.5 text-[14px] text-[#6B7280]">{L("The owner leaves at completion.", "เจ้าของออกเมื่อการขายเสร็จสิ้น")}</p>}
    </div>
  );
}

/* ── Asking price (Estimate) ── */
export function PriceQ({ d, set, L, th }: { d: SellerDraft; set: Set; L: L; th: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const v = d.price ?? null;
  const band = bandOf(v);
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const caret = el.selectionStart ?? el.value.length;
    const digitsBefore = el.value.slice(0, caret).replace(/\D/g, "").replace(/^0+/, "").length;
    const digits = el.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 12);
    set({ price: digits ? Number(digits) : null });
    // Keep the caret after the digit just typed or deleted.
    requestAnimationFrame(() => {
      const s = ref.current; if (!s) return;
      let seen = 0, pos = s.value.length;
      if (digitsBefore === 0) pos = s.value.search(/\d/) < 0 ? s.value.length : s.value.search(/\d/);
      else for (let i = 0; i < s.value.length; i++) { if (/\d/.test(s.value[i]!)) seen++; if (seen === digitsBefore) { pos = i + 1; break; } }
      s.setSelectionRange(pos, pos);
    });
  };
  return (
    <div>
      <label htmlFor="sw-price" className="mb-1.5 block text-[14px] font-semibold">{L("Asking price (Estimate)", "ราคาที่ต้องการ (ประมาณการ)")} <span className="text-[#DC2626]">*</span></label>
      <input id="sw-price" ref={ref} autoFocus inputMode="numeric" aria-required="true" aria-describedby={v ? "sw-price-words" : undefined} autoComplete="off"
        value={v ? fmtThb(v) : ""} onChange={onChange} placeholder="e.g. 120,000,000"
        className="h-[50px] w-full rounded-[10px] border border-[#d1d5db] bg-white px-3.5 text-[15.5px] tabular-nums outline-none focus:border-[#1e2a4a] focus:shadow-[0_0_0_3px_#e3e8f2] dark:border-border dark:bg-card" />
      {v ? <p id="sw-price-words" className="mt-1.5 text-[13px] text-[#6B7280]">{th ? thbWordsTh(v) : thbWords(v)}</p> : null}
      {band && v ? (
        <div role="group" aria-label={L("What buyers see", "สิ่งที่ผู้ซื้อเห็น")} className="mt-5 overflow-hidden rounded-[12px] border border-[#E9EBF0] dark:border-border">
          <div className="border-b border-[#E9EBF0] bg-[#F8F9FB] px-4 py-2.5 text-[13px] font-bold text-[#374151] dark:border-border dark:bg-muted dark:text-foreground">{L("What buyers see", "สิ่งที่ผู้ซื้อเห็น")}</div>
          <div className="grid grid-cols-2 divide-x divide-[#E9EBF0] dark:divide-border max-[599px]:grid-cols-1 max-[599px]:divide-x-0 max-[599px]:divide-y">
            <div className="px-4 py-3.5">
              <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#6B7280]"><Lock className="h-[13px] w-[13px]" />{L("Before the NDA", "ก่อน NDA")}</p>
              <p className="mt-1 text-[18px] font-bold">{th ? band.th : band.label}</p>
              <p className="mt-0.5 text-[12.5px] text-[#6B7280]">{L("A price range, set from your price", "ช่วงราคา ตามราคาของท่าน")}</p>
            </div>
            <div className="px-4 py-3.5">
              <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#6B7280]"><LockOpen className="h-[13px] w-[13px]" />{L("After you approve their NDA", "หลังท่านอนุมัติ NDA")}</p>
              <p className="mt-1 text-[18px] font-bold tabular-nums">{fmtThb(v)}</p>
              <p className="mt-0.5 text-[12.5px] text-[#6B7280]">{L("Your estimated price", "ราคาประมาณการของท่าน")}</p>
            </div>
          </div>
          <div className="flex items-center gap-[7px] border-t border-[#D6E7FC] bg-[#F4F9FF] px-4 py-2.5 text-[13px] text-[#434A5C] dark:border-border dark:bg-[#16283A] dark:text-muted-foreground">
            <Filter className="h-3.5 w-3.5 shrink-0 text-[#2563EB]" />
            {th ? <span>ผู้ซื้อที่กรองช่วง <b className="font-semibold text-foreground">{band.th}</b> จะพบประกาศของท่าน</span>
              : <span>Buyers who filter by <b className="font-semibold text-[#151A28] dark:text-foreground">{bandInText(band.label)}</b> find your listing.</span>}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ── Listing name ── */
export function NameQ({ d, set, L, startupId, companyName, website }: { d: SellerDraft; set: Set; L: L; startupId: string | null; companyName: string; website: string }) {
  const check = useServerFn(checkListingName);
  const shown = useRef(new Set<string>());
  const [seed, setSeed] = useState(0);
  const ideas = useMemo(() => {
    const out = listingNameIdeas(shown.current, Math.random());
    out.forEach((n) => shown.current.add(n.toLowerCase()));
    return out;
  }, [seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const saved = useRef(d.listingName && d.nameOk ? d.listingName : "");
  const [kept, setKept] = useState<string | null>(null);
  const [own, setOwn] = useState(false);
  const [state, setState] = useState<"idle" | "checking" | "available" | "taken" | "identity">("idle");
  const fieldRef = useRef<HTMLInputElement>(null);
  const list = [...new Set([saved.current, kept, ...ideas].filter((x): x is string => !!x))];
  const picked = !own && list.includes(d.listingName ?? "") ? d.listingName : null;
  const identity = (n: string) => {
    const low = n.toLowerCase();
    const terms = [companyName, website.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[./]/)[0] ?? ""]
      .flatMap((t) => [t.trim(), ...t.split(/\s+/).filter((w) => w.length >= 4 && !/^(co|company|ltd|limited|public|group|thailand)\.?,?$/i.test(w))])
      .filter((t) => t.length >= 3);
    return terms.some((t) => low.includes(t.toLowerCase()));
  };
  const verify = (n: string, then?: (ok: boolean) => void) => {
    if (!n.trim()) { setState("idle"); set({ nameOk: false }); return; }
    if (identity(n)) { setState("identity"); set({ nameOk: false }); return; }
    if (!startupId) { setState("available"); set({ nameOk: true }); then?.(true); return; }
    setState("checking");
    check({ data: { name: n, startupId } }).then((r) => {
      setState(r.available ? "available" : "taken"); set({ nameOk: r.available }); then?.(r.available);
    }).catch(() => setState("idle"));
  };
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  const choose = (n: string) => { setOwn(false); set({ listingName: n, nameOk: undefined }); verify(n); };
  const more = () => { if (picked && ideas.includes(picked)) setKept(picked); setSeed((s) => s + 1); };
  const err = own && (state === "taken" || state === "identity");
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[#5F6676]"><Sparkles className="h-3.5 w-3.5 text-[#6D28D9]" />{L("Suggested names", "ชื่อที่แนะนำ")}</span>
        <button type="button" onClick={more} className="flex h-[30px] items-center gap-1.5 rounded-md px-1.5 text-[13px] font-semibold text-[#6D28D9] hover:bg-[#F7F3FF] dark:hover:bg-muted"><RefreshCw className="h-[13px] w-[13px]" />{L("More ideas", "แนะนำเพิ่ม")}</button>
      </div>
      <div role="radiogroup" aria-label={L("Listing name", "ชื่อประกาศ")} className="mt-2.5 grid gap-2.5" onKeyDown={arrows}>
        {list.map((n) => {
          const on = picked === n;
          return (
            <button key={n} type="button" role="radio" aria-checked={on} tabIndex={on || (!picked && n === list[0]) ? 0 : -1} onClick={() => choose(n)} className={cn(optCls(on), "min-h-[50px] py-2.5")}>
              <span className={radio(on)} /><span className="break-words">{n}</span>
            </button>
          );
        })}
        <button type="button" role="radio" aria-checked={own} tabIndex={own ? 0 : -1}
          onClick={() => { setOwn(true); set({ listingName: "", nameOk: false }); setState("idle"); window.setTimeout(() => fieldRef.current?.focus(), 20); }}
          className={cn(optCls(own), "h-[50px]")}>
          <span className={radio(own)} />{L("Type my own name", "พิมพ์ชื่อเอง")}
        </button>
      </div>
      {own && (
        <div className="mt-3.5">
          <label htmlFor="sw-lname" className="mb-1.5 block text-[14px] font-semibold">{L("Your listing name", "ชื่อประกาศของท่าน")}</label>
          <div className="relative">
            <input id="sw-lname" ref={fieldRef} maxLength={80} value={d.listingName ?? ""} placeholder={L("Type a listing name", "พิมพ์ชื่อประกาศ")}
              aria-invalid={err || undefined} aria-describedby="sw-lname-note"
              onChange={(e) => {
                const n = e.target.value; set({ listingName: n, nameOk: false }); setState("idle");
                if (timer.current) window.clearTimeout(timer.current);
                timer.current = window.setTimeout(() => verify(n), 300);
              }}
              className={cn("h-[50px] w-full rounded-[10px] border bg-white px-3.5 pr-[120px] text-[15.5px] outline-none focus:shadow-[0_0_0_3px_#e3e8f2] dark:bg-card", err ? "border-[#DC2626]" : "border-[#d1d5db] focus:border-[#1e2a4a] dark:border-border")} />
            {state === "available" && <span className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 text-[13px] font-semibold text-[#15803D]"><CircleCheck className="h-[15px] w-[15px]" />{L("Available", "ใช้ได้")}</span>}
          </div>
          {state === "taken" ? (
            <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-[#B42318]">{L(`“${d.listingName}” is already used by another listing. Pick a suggestion, or try another name.`, `“${d.listingName}” มีประกาศอื่นใช้แล้ว เลือกชื่อที่แนะนำ หรือลองชื่ออื่น`)}</p>
          ) : state === "identity" ? (
            <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-[#B42318]">{L("This name looks like your real company name or website. Buyers mustn't be able to tell who you are.", "ชื่อนี้คล้ายชื่อบริษัทหรือเว็บไซต์จริงของท่าน ผู้ซื้อต้องไม่สามารถระบุตัวท่านได้")}</p>
          ) : (
            <p id="sw-lname-note" className="mt-1.5 text-[13px] text-[#6B7280]">{L("Don't use your real company name.", "อย่าใช้ชื่อบริษัทจริงของท่าน")}</p>
          )}
        </div>
      )}
      {!own && picked && state === "taken" && (
        <p role="alert" className="mt-2 text-[12.5px] font-medium text-[#B42318]">{L(`“${picked}” is already used by another listing. Pick a suggestion, or try another name.`, `“${picked}” มีประกาศอื่นใช้แล้ว เลือกชื่อที่แนะนำ หรือลองชื่ออื่น`)}</p>
      )}
    </div>
  );
}
