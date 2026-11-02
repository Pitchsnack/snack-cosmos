import { useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tr, useTranslation } from "@/i18n/language";

type Photo = { slot: number; url: string | null };

export function FirmPhotosBox({ photos, firm, canEdit, onEdit }: { photos: Photo[] | undefined; firm: string; canEdit: boolean; onEdit?: () => void }) {
  const { language } = useTranslation();
  const list = (photos ?? []).filter((p): p is Photo & { url: string } => Boolean(p.url)).sort((a, b) => a.slot - b.slot).slice(0, 3);
  const [index, setIndex] = useState<number | null>(null);
  const origin = useRef<HTMLButtonElement | null>(null);
  const close = useRef<HTMLButtonElement | null>(null);
  const thai = language === "th";
  const step = (delta: number) => setIndex(i => i === null ? null : (i + delta + list.length) % list.length);
  const photo = index === null ? undefined : list[index];
  if (!list.length && !canEdit) return null;
  return <section className="advisor-photos">
    {canEdit && <div className="advisor-caption"><span>{tr("Photos")} · {list.length}</span>{list.length > 0 && <Button variant="unstyled" className="advisor-text-action" onClick={onEdit}>{tr("Edit")}</Button>}</div>}
    {list.length ? <div className="advisor-thumbnails">{list.map((p, i) => <Button key={p.slot} variant="unstyled" className="advisor-thumbnail" aria-label={thai ? `เปิดรูปที่ ${i + 1} จาก ${list.length}` : `Open photo ${i + 1} of ${list.length}`} onClick={e => { origin.current = e.currentTarget; setIndex(i); }}>
      <img src={p.url} alt="" loading="lazy" />
    </Button>)}</div> : <div className="flex items-center justify-between gap-3"><p className="text-[13px] text-muted-foreground">{tr("No photos yet.")}</p><Button variant="unstyled" className="advisor-text-action" onClick={onEdit}>{tr("Add photos")}</Button></div>}
    <DialogPrimitive.Root open={Boolean(photo)} onOpenChange={open => { if (!open) setIndex(null); }}>
      {photo && <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="advisor-photo-shade" />
        <DialogPrimitive.Content className="advisor-photo-viewer" aria-describedby={undefined}
          onOpenAutoFocus={e => { e.preventDefault(); close.current?.focus(); }}
          onCloseAutoFocus={e => { e.preventDefault(); origin.current?.focus(); }}
          onPointerDown={e => { if (e.target === e.currentTarget) setIndex(null); }}
          onKeyDown={e => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); step(e.key === "ArrowLeft" ? -1 : 1); } }}>
          <DialogPrimitive.Title className="sr-only">{thai ? "รูปภาพ" : "Photos"}</DialogPrimitive.Title>
          <Button variant="unstyled" ref={close} className="advisor-photo-control advisor-photo-close" aria-label={tr("Close")} onClick={() => setIndex(null)}><X size={20} /></Button>
          {list.length > 1 && <><Button variant="unstyled" className="advisor-photo-control advisor-photo-prev" aria-label={thai ? "รูปก่อนหน้า" : "Previous photo"} onClick={() => step(-1)}><ChevronLeft size={22} /></Button><Button variant="unstyled" className="advisor-photo-control advisor-photo-next" aria-label={thai ? "รูปถัดไป" : "Next photo"} onClick={() => step(1)}><ChevronRight size={22} /></Button></>}
          <figure><img src={photo.url} alt={`${firm}, ${thai ? "รูปที่" : "photo"} ${(index ?? 0) + 1}`} /><figcaption>{(index ?? 0) + 1} {thai ? "จาก" : "of"} {list.length}</figcaption></figure>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>}
    </DialogPrimitive.Root>
  </section>;
}
