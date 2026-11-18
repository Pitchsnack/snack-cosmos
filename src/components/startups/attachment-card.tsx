import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { Check, Plus, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { validateImageFile } from "@/lib/media/image-validation";
import { EMPTY_SLOT, type EntityMediaState, type SlotState } from "@/components/media/entity-media-editor";
import { ExamplePhoto, EXAMPLES, type ExampleSet } from "@/components/media/example-photos";
import { useTr } from "@/components/common/edit-info-popup";
import { cn } from "@/lib/utils";
import { LogoDropLabel } from "@/components/login/signup-reg-parts";
import { useTranslation } from "@/i18n/language";

/**
 * Edit information › Images & Logo › Attachment and the setup wizards' Logo and photos step:
 * the card buyers see after an NDA, where the logo and up to 3 photos go straight in.
 * Empty photo spaces show drawn examples (placeholders only); a drop box under the card and a
 * step-wide drag highlight show that files can be dropped. File checks are unchanged.
 */

function usePreview(slot: SlotState) {
  const blob = useMemo(() => (slot.pendingFile ? URL.createObjectURL(slot.pendingFile) : null), [slot.pendingFile]);
  useEffect(() => () => { if (blob) URL.revokeObjectURL(blob); }, [blob]);
  return blob ?? slot.signedUrl;
}
const filled = (s: SlotState) => !!(s.pendingFile || s.signedUrl || s.persistedPath);
const hasFiles = (e: { dataTransfer: DataTransfer | null }) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files");

export function attachmentMissing(m: EntityMediaState) {
  return (filled(m.logo) ? 0 : 1) + (m.slots.some(filled) ? 0 : 1);
}

/** Drop on a space to add or replace its photo; extra files fill the remaining empty spaces. */
export function placePhotos(slots: EntityMediaState["slots"], files: File[], at?: number): EntityMediaState["slots"] {
  const next = [...slots] as EntityMediaState["slots"];
  const order = [0, 1, 2];
  if (at !== undefined) order.splice(order.indexOf(at), 1), order.unshift(at);
  let k = 0;
  for (const i of order) {
    if (k >= files.length) break;
    if (filled(next[i]!) && i !== at) continue;
    next[i] = { ...EMPTY_SLOT, pendingFile: files[k++]! };
  }
  return next;
}

export function AttachmentCard({ value, onChange, name, sectorLine, intro, showGuidance = true, photosOnly = false, examples = "seller", photoGuide = false, footer }: {
  value: EntityMediaState; onChange: (m: EntityMediaState) => void; name: string; sectorLine: string;
  /** Text above the card; null hides it. Defaults to the seller wording. */
  intro?: string | null;
  /** Edit information's "Why add them" column (wizards use photoGuide instead). */
  showGuidance?: boolean;
  /** @deprecated Every mode now shows the three spaces and the drop box. */
  wideAdd?: boolean;
  /** A sign-up logo is already present: this step asks only for photos. */
  photosOnly?: boolean;
  /** Which drawn examples fill empty spaces: seller (factory/office/products) or firm (office/team/work). */
  examples?: ExampleSet;
  /** Setup wizards: "What makes a good photo" on the right. */
  photoGuide?: boolean;
  /** Under the drop box (wizards: checklist or done line). */
  footer?: ReactNode;
}) {
  const tr = useTr();
  const hasLogo = filled(value.logo);
  const photos = value.slots.filter(filled).length;
  const ex = EXAMPLES[examples];
  const [dragging, setDragging] = useState(false);
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };

  const takeAll = (list: FileList | File[] | null | undefined) => {
    const ok: File[] = [];
    for (const f of Array.from(list ?? [])) {
      const v = validateImageFile(f);
      if (!v.valid) toast.error(v.error ?? "Invalid file"); else ok.push(f);
    }
    return ok;
  };
  const addPhotos = (list: FileList | File[] | null | undefined, at?: number) => {
    const files = takeAll(list);
    if (!files.length) return;
    const { value: v, onChange: change } = latest.current;
    change({ ...v, slots: placePhotos(v.slots, files, at) });
  };
  const setLogo = (f: File | null) => onChange({ ...value, logo: f ? { ...EMPTY_SLOT, pendingFile: f } : { ...EMPTY_SLOT } });
  const removePhoto = (i: number) => {
    // The photos after it move up.
    const kept = value.slots.filter((s, j) => j !== i && filled(s));
    const slots = [kept[0] ?? EMPTY_SLOT, kept[1] ?? EMPTY_SLOT, kept[2] ?? EMPTY_SLOT] as EntityMediaState["slots"];
    onChange({ ...value, slots });
  };

  // While a file is dragged anywhere over the page: highlight; a drop outside a space fills the first empty one.
  const room = photos < 3;
  useEffect(() => {
    if (!room) { setDragging(false); return; }
    let depth = 0;
    const enter = (e: globalThis.DragEvent) => { if (!hasFiles(e)) return; depth++; setDragging(true); };
    const leave = (e: globalThis.DragEvent) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) setDragging(false); };
    const over = (e: globalThis.DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const drop = (e: globalThis.DragEvent) => {
      depth = 0; setDragging(false);
      if (!hasFiles(e) || e.defaultPrevented) return;
      e.preventDefault();
      addPhotos(e.dataTransfer?.files);
    };
    const end = () => { depth = 0; setDragging(false); };
    window.addEventListener("dragenter", enter); window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over); window.addEventListener("drop", drop); window.addEventListener("dragend", end);
    return () => {
      window.removeEventListener("dragenter", enter); window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over); window.removeEventListener("drop", drop); window.removeEventListener("dragend", end);
    };
  }, [room]); // eslint-disable-line react-hooks/exhaustive-deps

  const miss = !photosOnly && !hasLogo && !photos ? tr("⚠ Missing: add your logo and at least one photo", "⚠ ยังขาด: เพิ่มโลโก้และรูปภาพอย่างน้อย 1 รูป")
    : !photosOnly && !hasLogo ? tr("⚠ Missing: add your logo", "⚠ ยังขาด: เพิ่มโลโก้ของท่าน")
    : !photos ? tr("⚠ Missing: add at least one photo", "⚠ ยังขาด: เพิ่มรูปภาพอย่างน้อย 1 รูป") : null;
  const introText = intro === undefined
    ? tr("Your logo and at least 1 photo (up to 3). Buyers see them after you approve their NDA.", "โลโก้และรูปภาพอย่างน้อย 1 รูป (ไม่เกิน 3 รูป) ผู้ซื้อจะเห็นหลังจากท่านอนุมัติ NDA")
    : intro;

  return (
    <div>
      {introText && (
        <p className="mb-[18px] max-w-[72ch] text-[13.5px] leading-[1.5] text-[#6A7181] dark:text-muted-foreground">{introText}</p>
      )}
      <div className="flex gap-8 max-[820px]:flex-col max-[820px]:gap-[22px]">
        <div className="min-w-0 flex-1">
          <div data-dragging={dragging || undefined} className={cn("rounded-[14px] border border-[#E6E8EC] bg-card p-[18px] transition-colors max-sm:p-[14px] dark:border-border",
            dragging && "border-[#2563EB] bg-[#F4F8FF] shadow-[0_0_0_4px_rgba(37,99,235,.14)] dark:border-[#2563EB] dark:bg-[#16283A]")}>
            <div className="flex items-center gap-[14px]">
              {!photosOnly && <LogoSpace slot={value.logo} label={tr("Add your logo", "เพิ่มโลโก้ของท่าน")} removeLabel={tr("Remove the logo", "ลบโลโก้")}
                onFile={(f) => { const ok = takeAll(f ? [f] : []); if (ok[0]) setLogo(ok[0]); }} onRemove={() => setLogo(null)} />}
              <div className="min-w-0">
                <div className="truncate text-[16px] font-bold text-[#151A28] dark:text-foreground">{name.trim() || tr("Your company", "บริษัทของท่าน")}</div>
                {sectorLine && <div className="mt-[2px] truncate text-[13px] text-[#6A7181] dark:text-muted-foreground">{sectorLine}</div>}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-[10px] max-sm:gap-2">
              {value.slots.map((s, i) => (
                <PhotoSpace key={i} slot={s} n={i + 1} example={ex[i]!} dragging={dragging}
                  removeLabel={tr(`Remove photo ${i + 1}`, `ลบรูปภาพที่ ${i + 1}`)}
                  onFiles={(files) => addPhotos(files, i)} onRemove={() => removePhoto(i)} />
              ))}
            </div>
          </div>
          {room && <DropBox photos={photos} dragging={dragging} onFiles={(f) => addPhotos(f)} />}
          {miss && !footer && <p className="mt-[10px] text-[12.5px] text-[#DC2626]">{miss}</p>}
          {footer}
        </div>
        {photoGuide ? <PhotoGuide set={examples} /> : showGuidance && <div className="w-[248px] shrink-0 max-[820px]:w-full">
          <div className="text-[13.5px] font-semibold text-[#151A28] dark:text-foreground">{tr("Why add them", "ทำไมควรเพิ่ม")}</div>
          <p className="mt-[10px] text-[13px] leading-[1.5] text-[#4B5563] dark:text-muted-foreground">{tr("Help buyers understand and remember your business more easily:", "ช่วยให้ผู้ซื้อเข้าใจและจดจำธุรกิจของคุณได้ง่ายขึ้น")}</p>
          <ul className="mt-2 space-y-2">
            {[
              tr("Makes a good first impression", "สร้างความประทับใจแรกที่ดี"),
              tr("Makes your profile look more trustworthy", "ทำให้โปรไฟล์ดูน่าเชื่อถือยิ่งขึ้น"),
              tr("Some investors may skip profiles without photos", "นักลงทุนบางรายอาจข้ามโปรไฟล์ที่ไม่มีรูปภาพ"),
            ].map((t) => <li key={t} className="flex gap-2 text-[13px] leading-[1.5] text-[#4B5563] dark:text-muted-foreground"><Tick />{t}</li>)}
          </ul>
        </div>}
      </div>
    </div>
  );
}

function Tick() {
  return <Check aria-hidden className="mt-[2px] h-[15px] w-[15px] shrink-0 text-[#15803D]" strokeWidth={2.6} />;
}

function PhotoGuide({ set }: { set: ExampleSet }) {
  const tr = useTr();
  const ex = EXAMPLES[set];
  const firm = set === "firm";
  const rows: [boolean, string][] = [
    [true, firm ? tr("Your office or meeting rooms", "สำนักงานหรือห้องประชุมของท่าน") : tr("Your premises: factory, office, shop or warehouse", "สถานที่ เช่น โรงงาน สำนักงาน ร้าน หรือคลังสินค้า")],
    [true, firm ? tr("Your team at work", "ทีมงานขณะทำงาน") : tr("Your team at work, or your machines and equipment", "ทีมงานขณะทำงาน หรือเครื่องจักรและอุปกรณ์")],
    [true, firm ? tr("Your work, clearly lit", "ผลงานของท่านที่ถ่ายชัดและมีแสงเพียงพอ") : tr("Your products, clearly lit", "สินค้าที่ถ่ายชัดและมีแสงเพียงพอ")],
    [false, tr("Avoid screenshots, documents and slides", "หลีกเลี่ยงภาพหน้าจอ เอกสาร หรือสไลด์")],
  ];
  return (
    <aside className="w-[260px] shrink-0 self-start rounded-[14px] border border-[#E6E8EC] bg-card p-4 max-[820px]:w-full dark:border-border">
      <div className="text-[14px] font-bold text-[#151A28] dark:text-foreground">{tr("What makes a good photo", "รูปภาพที่ดีควรเป็นแบบไหน")}</div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {ex.map((e) => (
          <figure key={e.kind} className="m-0">
            <ExamplePhoto kind={e.kind} className="aspect-[10/7] w-full rounded-[8px]" />
            <figcaption className="mt-1 text-center text-[11.5px] text-[#6A7181] dark:text-muted-foreground">{tr(e.en, e.th)}</figcaption>
          </figure>
        ))}
      </div>
      <ul className="mt-3 space-y-2">
        {rows.map(([good, t]) => (
          <li key={t} className="flex gap-2 text-[13px] leading-[1.45] text-[#434A5C] dark:text-muted-foreground">
            {good ? <Check aria-hidden className="mt-[2px] h-[15px] w-[15px] shrink-0 text-[#15803D]" strokeWidth={2.8} /> : <X aria-hidden className="mt-[2px] h-[15px] w-[15px] shrink-0 text-[#DC2626]" strokeWidth={2.8} />}
            <span><span className="sr-only">{good ? tr("Good: ", "ดี: ") : tr("Avoid: ", "หลีกเลี่ยง: ")}</span>{t}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function DropBox({ photos, dragging, onFiles }: { photos: number; dragging: boolean; onFiles: (f: FileList | null) => void }) {
  const tr = useTr();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div onDragOver={(e) => { if (hasFiles(e)) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
      className={cn("mt-[14px] flex flex-col items-center rounded-[14px] border-2 border-dashed border-[#AEB8C9] bg-[#FAFBFD] p-5 text-center transition-colors dark:border-border dark:bg-muted/40",
        dragging && "border-solid border-[#2563EB] bg-[#EEF4FF] dark:border-[#2563EB] dark:bg-[#16283A]")}>
      <span aria-hidden className="grid h-10 w-10 place-items-center rounded-[10px] bg-[#E8F0FE] text-[#2563EB]"><Upload className="h-5 w-5" /></span>
      <p className="mt-2.5 text-[16px] font-semibold text-[#151A28] dark:text-foreground">{dragging ? tr("Drop to upload", "วางไฟล์เพื่ออัปโหลด") : tr("Drag and drop your photos here", "ลากและวางรูปภาพที่นี่")}</p>
      <p className="mt-1 text-[13px] text-[#6A7181] dark:text-muted-foreground">{tr("or", "หรือ")}</p>
      <button type="button" onClick={() => input.current?.click()}
        className="mt-1.5 rounded-[8px] border border-[#C9CED8] bg-card px-4 py-1.5 text-[13.5px] font-semibold text-[#151A28] hover:bg-[#F3F4F6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] dark:border-border dark:text-foreground dark:hover:bg-muted">
        {tr("Choose files", "เลือกไฟล์")}
      </button>
      <p className="mt-2.5 text-[12.5px] text-[#6A7181] dark:text-muted-foreground">{tr(`JPG, PNG, GIF, SVG or WebP · ${photos} of 3 photos added`, `JPG, PNG, GIF, SVG หรือ WebP · เพิ่มแล้ว ${photos} จาก 3 รูป`)}</p>
      <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
    </div>
  );
}

function PhotoSpace({ slot, n, example, dragging, removeLabel, onFiles, onRemove }: {
  slot: SlotState; n: number; example: (typeof EXAMPLES)["seller"][number]; dragging: boolean; removeLabel: string;
  onFiles: (f: FileList | null) => void; onRemove: () => void;
}) {
  const tr = useTr();
  const input = useRef<HTMLInputElement>(null);
  const src = usePreview(slot);
  const [over, setOver] = useState(false);
  useEffect(() => { if (!dragging) setOver(false); }, [dragging]);
  if (src) {
    return (
      <div data-photo-slot={n}
        onDragEnter={(e) => { if (!hasFiles(e)) return; e.preventDefault(); setOver(true); }}
        onDragOver={(e) => { if (!hasFiles(e)) return; e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOver(false); onFiles(e.dataTransfer.files); }}
        className={cn("relative aspect-[10/7] w-full overflow-hidden rounded-[10px] border-2 border-transparent transition-colors", over && "border-[#2563EB] bg-[#EEF4FF]")}>
        <img src={src} alt="" className="h-full w-full rounded-[8px] border border-[#E6E8EC] object-cover dark:border-border" />
        {over && <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-[#2563EB] px-2.5 py-1 text-[12px] font-semibold text-white">{tr("Drop to replace", "วางเพื่อเปลี่ยนรูป")}</span>}
        <button type="button" aria-label={removeLabel} onClick={onRemove}
          className="absolute right-1.5 top-1.5 grid h-[26px] w-[26px] place-items-center rounded-full bg-[rgba(21,26,40,0.72)] text-white">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }
  const exLabel = tr(`e.g. ${example.en}`, `ตัวอย่าง: ${example.th}`);
  return (
    <>
      <button type="button" data-photo-slot={n} aria-label={tr(`Add photo ${n}`, `เพิ่มรูปภาพที่ ${n}`)} onClick={() => input.current?.click()}
        onDragOver={(e) => { if (!hasFiles(e)) return; e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); onFiles(e.dataTransfer.files); }}
        className={cn("group relative aspect-[10/7] w-full overflow-hidden rounded-[10px] border-[1.5px] border-dashed border-[#CBD1DA] bg-[#F3F5F8] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] dark:border-border dark:bg-muted",
          over && "border-2 border-solid border-[#2563EB]")}>
        <ExamplePhoto kind={example.kind} className="absolute inset-0 h-full w-full opacity-[.38] transition-opacity group-hover:opacity-50" />
        {over ? (
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-[#2563EB] px-2.5 py-1 text-[12px] font-semibold text-white">{tr("Drop to upload", "วางไฟล์เพื่ออัปโหลด")}</span>
        ) : (<>
          <span aria-hidden className="absolute left-1/2 top-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-[#151A28] shadow-[0_2px_6px_rgba(16,24,40,.18)]"><Plus className="h-4 w-4" strokeWidth={2.6} /></span>
          <span aria-hidden className="absolute bottom-1.5 left-1/2 max-w-[calc(100%-8px)] -translate-x-1/2 truncate rounded-full bg-white px-2 py-[2px] text-[11.5px] font-medium text-[#434A5C] max-sm:text-[10.5px]">
            {exLabel}{dragging && tr(" · drop here", " · วางที่นี่")}
          </span>
        </>)}
      </button>
      <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
    </>
  );
}

function LogoSpace({ slot, label, removeLabel, onFile, onRemove }: {
  slot: SlotState; label: string; removeLabel: string; onFile: (f: File | undefined) => void; onRemove: () => void;
}) {
  const { language } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const src = usePreview(slot);
  const [over, setOver] = useState(false);
  const box = "h-[120px] w-[120px] shrink-0 rounded-[12px]";
  if (src) {
    return (
      <div className={cn("relative", box)}>
        <img src={src} alt="" className="h-full w-full rounded-[12px] border border-[#E6E8EC] object-cover dark:border-border" />
        <button type="button" aria-label={removeLabel} onClick={onRemove}
          className="absolute -right-2 -top-2 grid h-[22px] w-[22px] place-items-center rounded-full bg-[rgba(21,26,40,0.72)] text-white">
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }
  return (
    <>
      <button type="button" aria-label={label} onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e: DragEvent) => { e.preventDefault(); setOver(false); onFile(e.dataTransfer.files?.[0]); }}
        className={cn(box, "group flex flex-col items-center justify-center gap-1 border-[1.5px] border-dashed border-[#CBD1DA] bg-card text-[#6A7181] outline-none hover:border-[#8A90A0] hover:bg-[#FAFAFB] hover:text-[#4B5563] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4338CA] dark:border-border dark:hover:bg-muted",
          over && "border-[#8A90A0] bg-[#FAFAFB]")}>
        <LogoDropLabel lang={language} />
      </button>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
    </>
  );
}
