import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Image, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { useSectorImages } from "@/hooks/use-sector-images";
import { saveBuyOrderCover } from "@/lib/buy-order-cover.functions";
import { prepareSectorPicture } from "@/lib/media/prepare-sector-picture";
import type { BuyOrderCover } from "@/lib/buy-order-cover";
import type { BoCard } from "@/lib/buy-orders.functions";
import { useBw, useSectorName } from "./bw-card";
import { cn } from "@/lib/utils";

export function BuyOrderPicture({ card, onSaved }: { card: BoCard; onSaved: (cover: BuyOrderCover) => void }) {
  const { c } = useBw();
  const sectorName = useSectorName();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const close = () => { setOpen(false); setTimeout(() => trigger.current?.focus(), 100); };
  const cover = card.cover;
  const line = cover?.source === "upload" ? c(`Uploaded for this buy order: ${cover.name}`, `อัปโหลดสำหรับประกาศรับซื้อนี้: ${cover.name}`)
    : cover?.source === "sector" ? c(`Sector picture: ${cover.name}`, `รูปภาพกลุ่มอุตสาหกรรม: ${cover.name}`)
    : c(`Drawn cover: no pictures for ${sectorName(card.sector)} yet.`, `ปกพื้นฐาน: ยังไม่มีรูปภาพของ ${sectorName(card.sector)}`);
  return <>
    <Button ref={trigger} variant="outline" className="mt-3 h-9 w-full" onClick={() => setOpen(true)}><Image />{c("Change picture", "เปลี่ยนรูปภาพ")}</Button>
    <p title={line} className="mt-1.5 truncate text-xs text-muted-foreground">{line}</p>
    {open && <PictureDialog card={card} onSaved={onSaved} onClose={close} returnFocus={() => requestAnimationFrame(() => trigger.current?.focus())} />}
  </>;
}

function PictureDialog({ card, onClose, onSaved, returnFocus }: { card: BoCard; onClose: () => void; onSaved: (cover: BuyOrderCover) => void; returnFocus: () => void }) {
  const { c } = useBw(); const sectorName = useSectorName();
  const images = useSectorImages(); const qc = useQueryClient(); const save = useServerFn(saveBuyOrderCover);
  const own = (images.data ?? []).filter((i) => i.sector_key === card.sector);
  const originalPick = card.cover?.imageId ?? own[0]?.id ?? null;
  const [pick, setPick] = useState<string | null>(originalPick);
  const [useUpload, setUseUpload] = useState(card.cover?.source === "upload");
  const [upload, setUpload] = useState<(NonNullable<Awaited<ReturnType<typeof prepareSectorPicture>>> & { fileName: string }) | null>(null);
  const [removed, setRemoved] = useState(false);
  const [busy, setBusy] = useState(false); const [preparing, setPreparing] = useState(false); const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!pick && own[0]) setPick(own[0].id); }, [own[0]?.id]);
  useEffect(() => () => { if (upload) URL.revokeObjectURL(upload.previewUrl); }, [upload]);
  const rule = c("JPG, PNG or WebP, landscape, at least 1200 × 675 px, up to 5 MB.", "JPG, PNG หรือ WebP แนวนอน อย่างน้อย 1200 × 675 px ไม่เกิน 5 MB");
  const chooseFile = async (file: File) => {
    setPreparing(true); setError("");
    try {
      const p = await prepareSectorPicture(file, true);
      if (!p) { setError(c(`${file.name} wasn’t added. Use a ${rule}`, `${file.name} ไม่ได้ถูกเพิ่ม ใช้ไฟล์ ${rule}`)); return; }
      setUpload({ ...p, fileName: file.name }); setUseUpload(true); setRemoved(false);
    } catch { setError(c(`${file.name} wasn’t added. Use a ${rule}`, `${file.name} ไม่ได้ถูกเพิ่ม ใช้ไฟล์ ${rule}`)); }
    finally { setPreparing(false); }
  };
  const go = async () => {
    setBusy(true); setError("");
    try {
      const result = await save({ data: { id: card.id, imageId: useUpload ? null : pick, keepUpload: useUpload && !upload, upload: useUpload && upload ? { fileName: upload.fileName, base64: upload.base64, originalBase64: upload.originalBase64 ?? "" } : null } });
      onSaved(result.cover); await qc.invalidateQueries({ queryKey: ["buy-orders"] }); onClose();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const uploadUrl = upload?.previewUrl ?? (!removed && card.cover?.source === "upload" ? card.cover.url : null);
  const check = <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" /></span>;
  return <Dialog open onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="max-h-[calc(100dvh-32px)] max-w-[560px] overflow-y-auto" onCloseAutoFocus={(e) => { e.preventDefault(); returnFocus(); }}>
      <DialogTitle>{c("Picture for this buy order", "รูปภาพสำหรับประกาศรับซื้อนี้")}</DialogTitle>
      <DialogDescription>{c("Sellers and buyers see it on the card’s cover. Use pictures without company names, logos, signs or people’s faces.", "ผู้ขายและผู้ซื้อจะเห็นรูปนี้บนปกของการ์ด ใช้รูปที่ไม่มีชื่อบริษัท โลโก้ ป้าย หรือใบหน้าของบุคคล")}</DialogDescription>
      <div><p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{c(`${sectorName(card.sector)} pictures`, `รูปภาพของ ${sectorName(card.sector)}`)}</p>
        {images.isPending ? <p className="text-sm text-muted-foreground">{c("Loading…", "กำลังโหลด…")}</p> : images.error ? <p role="alert" className="text-sm text-destructive">{c("Pictures could not be loaded. Please try again.", "โหลดรูปภาพไม่ได้ กรุณาลองอีกครั้ง")}</p> : !own.length ? <div className="text-sm text-muted-foreground"><p>{c(`No pictures for ${sectorName(card.sector)} yet. Add them in Sector images.`, `ยังไม่มีรูปภาพของ ${sectorName(card.sector)} เพิ่มได้ในหน้ารูปภาพกลุ่มอุตสาหกรรม`)}</p><Link className="mt-2 inline-block text-primary underline" to="/startups/sector-images" search={{ sector: card.sector }}>{c("Manage sector images →", "จัดการรูปภาพกลุ่มอุตสาหกรรม →")}</Link></div> :
          <div className="grid grid-cols-3 gap-2">{own.map((i) => <div key={i.id} className="min-w-0"><Button variant="unstyled" aria-label={i.file_name} aria-pressed={!useUpload && pick === i.id} className={cn("relative block aspect-video w-full overflow-hidden rounded-lg", !useUpload && pick === i.id && "ring-2 ring-primary")} onClick={() => { setPick(i.id); setUseUpload(false); }}>{i.url && <img src={i.url} alt="" className="h-full w-full object-cover" />}{!useUpload && pick === i.id && check}</Button><p className="mt-1 truncate text-xs text-muted-foreground" title={i.file_name}>{i.file_name}</p></div>)}</div>}
      </div>
      <div><p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{c("Or upload one for this buy order only", "หรืออัปโหลดรูปสำหรับประกาศรับซื้อนี้เท่านั้น")}</p>
        <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={preparing || busy} onClick={() => input.current?.click()}><Upload />{c("Upload picture", "อัปโหลดรูปภาพ")}</Button><p className="min-w-[180px] flex-1 text-xs text-muted-foreground">{rule}</p></div>
        <input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file) void chooseFile(file); e.target.value = ""; }} />
        {uploadUrl && <div className="relative mt-3 w-[160px]"><Button variant="unstyled" aria-pressed={useUpload} aria-label={c("Uploaded for this buy order", "อัปโหลดสำหรับประกาศรับซื้อนี้")} onClick={() => setUseUpload(true)} className={cn("relative block aspect-video w-full overflow-hidden rounded-lg", useUpload && "ring-2 ring-primary")}><img src={uploadUrl} alt="" className="h-full w-full object-cover" />{useUpload && check}</Button><Button variant="secondary" size="icon" title={c("Remove", "ลบ")} aria-label={c("Remove", "ลบ")} className="absolute left-1 top-1 h-6 w-6" onClick={() => { setUpload(null); setRemoved(true); setUseUpload(false); setPick(originalPick ?? own[0]?.id ?? null); }}><X className="h-3 w-3" /></Button><p className="mt-1 text-xs text-muted-foreground">{c("Uploaded for this buy order", "อัปโหลดสำหรับประกาศรับซื้อนี้")}</p></div>}
        {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>{c("Cancel", "ยกเลิก")}</Button><Button disabled={busy || preparing || images.isPending || !!images.error} onClick={go}>{c("Save", "บันทึก")}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}