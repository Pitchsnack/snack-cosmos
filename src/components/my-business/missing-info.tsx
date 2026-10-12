import type { ReactNode } from "react";
import { Check, CircleAlert, Image as ImageIcon, ImagePlus, TriangleAlert } from "lucide-react";
import { useTr } from "@/components/common/edit-info-popup";
import { cn } from "@/lib/utils";

/**
 * Seller › My Company only: missing logo/photos alert, empty logo tile, three
 * photo spaces and the red "missing value" text. Buyers never see these.
 */

export function MissingText({ children, small, className }: { children: ReactNode; small?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-[7px] font-medium text-[#DC2626] dark:text-[#F87171]", className)}>
      <CircleAlert aria-hidden className={cn("shrink-0", small ? "h-[14px] w-[14px]" : "h-[15px] w-[15px]")} strokeWidth={2.2} />
      <span>{children}</span>
    </span>
  );
}

export function LogoPhotoAlert({ hasLogo, hasPhoto, onAdd, className }: { hasLogo: boolean; hasPhoto: boolean; onAdd: () => void; className?: string }) {
  const tr = useTr();
  if (hasLogo && hasPhoto) return null;
  const miss = !hasLogo && !hasPhoto ? tr("Missing: your logo and at least one photo", "ยังขาด: โลโก้และรูปภาพอย่างน้อย 1 รูป")
    : !hasLogo ? tr("Missing: your logo", "ยังขาด: โลโก้") : tr("Missing: at least one photo", "ยังขาด: รูปภาพอย่างน้อย 1 รูป");
  const btn = (
    <button type="button" onClick={onAdd}
      className="inline-flex h-[38px] shrink-0 items-center justify-center gap-2 rounded-[9px] bg-[#F6A823] px-[14px] text-[14px] font-semibold text-[#0E162F] hover:bg-[#E9971A]">
      <ImagePlus className="h-4 w-4" />{tr("Add logo and photos", "เพิ่มโลโก้และรูปภาพ")}
    </button>
  );
  const points = [
    tr("Create a logo and good-quality business photos to help buyers to understand and remember your company.", "สร้างโลโก้และรูปภาพธุรกิจคุณภาพดี เพื่อช่วยให้ผู้ซื้อเข้าใจและจดจำบริษัทของท่านได้"),
    tr("Make a stronger first impression.", "สร้างความประทับใจแรกที่ดียิ่งขึ้น"),
    tr("Help your profile get noticed. Some investors may skip listings without images when reviewing many opportunities.", "ช่วยให้โปรไฟล์ของท่านเป็นที่สังเกต นักลงทุนบางรายอาจข้ามรายการที่ไม่มีรูปภาพเมื่อพิจารณาหลายโอกาสพร้อมกัน"),
  ];
  return (
    <div role="status" className={cn("rounded-[12px] border border-[#F3D49B] bg-[#FFF7E8] px-[18px] py-4 dark:border-[rgba(246,168,35,0.35)] dark:bg-[rgba(246,168,35,0.10)]", className)}>
      <div className="flex items-start gap-[14px]">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#FDEBC8]">
          <ImagePlus className="h-5 w-5 text-[#B45309]" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15.5px] font-semibold text-[#151A28] dark:text-[#F3F4F6]">{tr("Add your logo and photos to attract buyers", "เพิ่มโลโก้และรูปภาพเพื่อดึงดูดผู้ซื้อ")}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-[#B91C1C] dark:text-[#F87171]">
            <TriangleAlert aria-hidden className="h-[14px] w-[14px] shrink-0" />{miss}
          </div>
        </div>
        <div className="max-sm:hidden">{btn}</div>
      </div>
      <ul className="mt-[10px] space-y-[6px] pl-[54px] max-sm:pl-0">
        {points.map((p) => (
          <li key={p} className="flex gap-2 text-[13px] leading-[1.45] text-[#4B5563] dark:text-[#C5CAD6]">
            <Check aria-hidden className="mt-[2px] h-[15px] w-[15px] shrink-0 text-[#15803D] dark:text-[#4ADE80]" strokeWidth={2.6} />{p}
          </li>
        ))}
      </ul>
      <div className="mt-3 hidden max-sm:block [&>button]:w-full">{btn}</div>
    </div>
  );
}

const dashed = "border-[1.5px] border-dashed border-[#C5CBD3] bg-[#F8F9FB] hover:border-[#8A90A0] hover:bg-[#F3F4F6] dark:border-[#3A4256] dark:bg-[#1B2132] dark:hover:border-[#8A90A0]";

export function EmptyLogoTile({ onClick }: { onClick: () => void }) {
  const tr = useTr();
  return (
    <button type="button" aria-label={tr("Add your logo", "เพิ่มโลโก้ของท่าน")} onClick={onClick}
      className={cn("flex h-full w-full items-center justify-center gap-[7px] rounded-[10px]", dashed)}>
      <ImagePlus className="h-4 w-4 text-[#7C8496]" />
      <span className="text-[13px] font-semibold text-[#8A4B06] dark:text-[#F6A823]">{tr("Add logo", "เพิ่มโลโก้")}</span>
    </button>
  );
}

export function MediaSpaces({ photos, onAdd, edit }: { photos: string[]; onAdd: () => void; edit?: ReactNode }) {
  const tr = useTr();
  const n = Math.min(photos.length, 3);
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {tr("Media", "สื่อ")}
          <span className="rounded-full bg-[#F1F2F5] px-2 py-[2px] text-[11.5px] font-semibold normal-case tracking-normal text-[#4B5563] dark:bg-muted dark:text-muted-foreground">
            {tr(`${n} of 3 photos`, `รูปภาพ ${n} จาก 3`)}
          </span>
        </h3>
        {edit}
      </div>
      <div className="grid grid-cols-3 gap-[14px]">
        {[0, 1, 2].map((i) => photos[i] ? (
          <img key={i} src={photos[i]} alt="" className="h-[158px] w-full rounded-[12px] border border-[#E6E8EC] object-cover max-sm:h-[110px] dark:border-border" />
        ) : (
          <button key={i} type="button" aria-label={tr(`Add photo ${i + 1}`, `เพิ่มรูปภาพที่ ${i + 1}`)} onClick={onAdd}
            className={cn("flex h-[158px] w-full flex-col items-center justify-center rounded-[12px] px-2 text-center max-sm:h-[110px]", dashed)}>
            <span className="grid h-11 w-11 place-items-center rounded-full bg-[#ECEEF2] max-sm:bg-transparent dark:bg-[#252C3F]">
              <ImageIcon className="h-[22px] w-[22px] text-[#7C8496]" />
            </span>
            <span className="mt-[7px] text-[14px] font-semibold text-[#374151] dark:text-[#E5E7EB]">{tr("No photo yet", "ยังไม่มีรูปภาพ")}</span>
            <span className="text-[12px] text-[#6A7181] max-sm:hidden dark:text-[#9AA2B5]">{tr(`Photo ${i + 1} of 3`, `รูปภาพที่ ${i + 1} จาก 3`)}</span>
            <span className="mt-1.5 text-[13px] font-semibold text-[#8A4B06] max-sm:hidden dark:text-[#F6A823]">{tr("+ Add photo", "+ เพิ่มรูปภาพ")}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
