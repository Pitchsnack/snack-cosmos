import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { validateImageFile } from "@/lib/media/image-validation";
import { EMPTY_SLOT, type EntityMediaState, type SlotState } from "@/components/media/entity-media-editor";
import { useTr } from "@/components/common/edit-info-popup";
import { cn } from "@/lib/utils";

/**
 * Edit information › Images & Logo › Attachment: the card buyers see after an
 * NDA, where the logo and up to 3 photos go straight in. Same file checks as
 * the drop zones; files upload on Save, as before.
 */

function usePreview(slot: SlotState) {
  const blob = useMemo(() => (slot.pendingFile ? URL.createObjectURL(slot.pendingFile) : null), [slot.pendingFile]);
  useEffect(() => () => { if (blob) URL.revokeObjectURL(blob); }, [blob]);
  return blob ?? slot.signedUrl;
}
const filled = (s: SlotState) => !!(s.pendingFile || s.signedUrl || s.persistedPath);

export function attachmentMissing(m: EntityMediaState) {
  return (filled(m.logo) ? 0 : 1) + (m.slots.some(filled) ? 0 : 1);
}

export function AttachmentCard({ value, onChange, name, sectorLine }: {
  value: EntityMediaState; onChange: (m: EntityMediaState) => void; name: string; sectorLine: string;
}) {
  const tr = useTr();
  const hasLogo = filled(value.logo);
  const photos = value.slots.filter(filled).length;
  const take = (f: File | undefined | null) => {
    if (!f) return null;
    const v = validateImageFile(f);
    if (!v.valid) { toast.error(v.error ?? "Invalid file"); return null; }
    return f;
  };
  const setLogo = (f: File | null) => onChange({ ...value, logo: f ? { ...EMPTY_SLOT, pendingFile: f } : { ...EMPTY_SLOT } });
  const addPhoto = (f: File) => {
    const i = value.slots.findIndex((s) => !filled(s));
    if (i < 0) return;
    const slots = [...value.slots] as EntityMediaState["slots"];
    slots[i] = { ...EMPTY_SLOT, pendingFile: f };
    onChange({ ...value, slots });
  };
  const removePhoto = (i: number) => {
    // The photos after it move up.
    const kept = value.slots.filter((s, j) => j !== i && filled(s));
    const slots = [kept[0] ?? EMPTY_SLOT, kept[1] ?? EMPTY_SLOT, kept[2] ?? EMPTY_SLOT] as EntityMediaState["slots"];
    onChange({ ...value, slots });
  };
  const miss = !hasLogo && !photos ? tr("⚠ Missing: add your logo and at least one photo", "⚠ ยังขาด: เพิ่มโลโก้และรูปภาพอย่างน้อย 1 รูป")
    : !hasLogo ? tr("⚠ Missing: add your logo", "⚠ ยังขาด: เพิ่มโลโก้ของท่าน")
    : !photos ? tr("⚠ Missing: add at least one photo", "⚠ ยังขาด: เพิ่มรูปภาพอย่างน้อย 1 รูป") : null;

  return (
    <div>
      <p className="mb-[18px] max-w-[72ch] text-[13.5px] leading-[1.5] text-[#6A7181] dark:text-muted-foreground">
        {tr("Your logo and up to 3 photos of the premises, the team or the products. Buyers see them like this after you approve their NDA.",
          "โลโก้และรูปภาพของกิจการได้สูงสุด 3 รูป เช่น สถานที่ ทีมงาน หรือสินค้า ผู้ซื้อจะเห็นแบบนี้หลังจากท่านอนุมัติ NDA")}
      </p>
      <div className="flex gap-8 max-[800px]:flex-col max-[800px]:gap-[22px]">
        <div className="min-w-0 flex-1">
          <div className="rounded-[14px] border border-[#E6E8EC] bg-card p-[18px] max-sm:p-[14px] dark:border-border">
            <div className="flex items-center gap-[14px]">
              <Space kind="logo" slot={value.logo} label={tr("Add your logo", "เพิ่มโลโก้ของท่าน")} removeLabel={tr("Remove the logo", "ลบโลโก้")}
                onFile={(f) => { const ok = take(f); if (ok) setLogo(ok); }} onRemove={() => setLogo(null)} />
              <div className="min-w-0">
                <div className="truncate text-[16px] font-bold text-[#151A28] dark:text-foreground">{name.trim() || tr("Your company", "บริษัทของท่าน")}</div>
                {sectorLine && <div className="mt-[2px] truncate text-[13px] text-[#6A7181] dark:text-muted-foreground">{sectorLine}</div>}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-[10px] max-sm:gap-2">
              {value.slots.map((s, i) => (
                <Space key={i} kind="photo" slot={s} label={tr(`Add photo ${i + 1}`, `เพิ่มรูปภาพที่ ${i + 1}`)} removeLabel={tr(`Remove photo ${i + 1}`, `ลบรูปภาพที่ ${i + 1}`)}
                  onFile={(f) => { const ok = take(f); if (ok) addPhoto(ok); }} onRemove={() => removePhoto(i)} />
              ))}
            </div>
          </div>
          {miss && <p className="mt-[10px] text-[12.5px] text-[#DC2626]">{miss}</p>}
        </div>
        <div className="w-[248px] shrink-0 max-[800px]:w-full">
          {hasLogo && photos > 0 ? (
            <p className="flex gap-2 text-[13px] leading-[1.5] text-[#4B5563] dark:text-muted-foreground"><Tick />{tr("Your logo and photos are in. Buyers see them in your Private view.", "เพิ่มโลโก้และรูปภาพแล้ว ผู้ซื้อจะเห็นในมุมมองส่วนตัวของท่าน")}</p>
          ) : (
            <>
              <div className="text-[13.5px] font-semibold text-[#151A28] dark:text-foreground">{tr("Why add them", "ทำไมควรเพิ่ม")}</div>
              <ul className="mt-[10px] space-y-2">
                {[
                  tr("Create a logo and good-quality business photos to help buyers to understand and remember your company.", "สร้างโลโก้และรูปภาพธุรกิจคุณภาพดี เพื่อช่วยให้ผู้ซื้อเข้าใจและจดจำบริษัทของท่านได้"),
                  tr("Make a stronger first impression.", "สร้างความประทับใจแรกที่ดียิ่งขึ้น"),
                  tr("Help your profile get noticed. Some investors may skip listings without images when reviewing many opportunities.", "ช่วยให้โปรไฟล์ของท่านเป็นที่สังเกต นักลงทุนบางรายอาจข้ามรายการที่ไม่มีรูปภาพเมื่อพิจารณาหลายโอกาสพร้อมกัน"),
                ].map((t) => <li key={t} className="flex gap-2 text-[13px] leading-[1.5] text-[#4B5563] dark:text-muted-foreground"><Tick />{t}</li>)}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Tick() {
  return <Check aria-hidden className="mt-[2px] h-[15px] w-[15px] shrink-0 text-[#15803D]" strokeWidth={2.6} />;
}

function Space({ kind, slot, label, removeLabel, onFile, onRemove }: {
  kind: "logo" | "photo"; slot: SlotState; label: string; removeLabel: string; onFile: (f: File | undefined) => void; onRemove: () => void;
}) {
  const tr = useTr();
  const input = useRef<HTMLInputElement>(null);
  const src = usePreview(slot);
  const [over, setOver] = useState(false);
  const drop = (e: DragEvent) => { e.preventDefault(); setOver(false); onFile(e.dataTransfer.files?.[0]); };
  const box = kind === "logo" ? "h-16 w-16 shrink-0 rounded-[12px]" : "aspect-[10/7] w-full rounded-[10px]";
  if (src) {
    return (
      <div className={cn("relative", box)}>
        <img src={src} alt="" className={cn("h-full w-full border border-[#E6E8EC] object-cover dark:border-border", kind === "logo" ? "rounded-[12px]" : "rounded-[10px]")} />
        <button type="button" aria-label={removeLabel} onClick={onRemove}
          className={cn("absolute grid place-items-center rounded-full bg-[rgba(21,26,40,0.72)] text-white",
            kind === "logo" ? "-right-2 -top-2 h-[22px] w-[22px]" : "right-1.5 top-1.5 h-[26px] w-[26px]")}>
          <X className={kind === "logo" ? "h-3 w-3" : "h-3.5 w-3.5"} />
        </button>
      </div>
    );
  }
  return (
    <>
      <button type="button" aria-label={label} onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}
        className={cn(box, "group flex flex-col items-center justify-center gap-1 border-[1.5px] border-dashed border-[#CBD1DA] bg-card text-[#6A7181] outline-none hover:border-[#8A90A0] hover:bg-[#FAFAFB] hover:text-[#4B5563] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4338CA] dark:border-border dark:hover:bg-muted",
          over && "border-[#8A90A0] bg-[#FAFAFB]")}>
        <Plus className={kind === "logo" ? "h-4 w-4" : "h-[18px] w-[18px]"} />
        <span className={kind === "logo" ? "text-[11px]" : "text-[12.5px] max-sm:hidden"}>{kind === "logo" ? tr("Logo", "โลโก้") : tr("Add photo", "เพิ่มรูปภาพ")}</span>
      </button>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
    </>
  );
}
