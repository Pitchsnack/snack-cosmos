import { useRef, useState } from "react";
import { Check, CircleCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AttachmentCard } from "@/components/startups/attachment-card";
import { EMPTY_SLOT, uploadPending, type EntityMediaState, type UploadFn } from "@/components/media/entity-media-editor";
import { LatestChangeQueue } from "@/lib/media/latest-change-queue";
import { cn } from "@/lib/utils";
import type { ExampleSet } from "@/components/media/example-photos";

type L = (en: string, th: string) => string;
export type StepMedia = { logoPath: string | null; logoUrl: string | null; slots: { slot: number; path: string; url: string | null }[] };

function toState(m: StepMedia): EntityMediaState {
  const slots: EntityMediaState["slots"] = [{ ...EMPTY_SLOT }, { ...EMPTY_SLOT }, { ...EMPTY_SLOT }];
  for (const s of m.slots) if (s.slot >= 1 && s.slot <= 3) slots[s.slot - 1] = { ...EMPTY_SLOT, persistedPath: s.path, signedUrl: s.url };
  return { logo: { ...EMPTY_SLOT, persistedPath: m.logoPath, signedUrl: m.logoUrl }, slots } as EntityMediaState;
}

/**
 * The seller wizard's Logo and photos step for any profile: the Attachment card,
 * a note line, the checklist and Why add them. Each change uploads and saves as it finishes.
 */
export function LogoPhotosStep({ initial, getUrl, persist, onCount, name, sectorLine, note, L, wideAdd = false, examples = "firm" }: {
  initial: StepMedia;
  getUrl: UploadFn;
  persist: (logoPath: string | null, media: { slot: 1 | 2 | 3; image_path: string }[]) => Promise<unknown>;
  onCount: (hasLogo: boolean, photos: number) => void;
  name: string; sectorLine: string; note?: React.ReactNode; why?: string[]; L: L; wideAdd?: boolean; examples?: ExampleSet;
}) {
  const [m, setM] = useState<EntityMediaState>(() => toState(initial));
  const [count, setCount] = useState({ logo: !!initial.logoPath, photos: initial.slots.length });
  const handlers = useRef({ getUrl, persist, onCount });
  handlers.current = { getUrl, persist, onCount };
  const queue = useRef<LatestChangeQueue<EntityMediaState> | null>(null);
  if (!queue.current) {
    queue.current = new LatestChangeQueue(async (next, isLatest) => {
      const current = handlers.current;
      const { logoPath, media: list } = await uploadPending(next, current.getUrl, supabase.storage.from("startup-media"));
      await current.persist(logoPath, list);
      if (!isLatest()) return;
      setM({
        logo: { ...next.logo, pendingFile: null, persistedPath: logoPath, signedUrl: next.logo.pendingFile ? URL.createObjectURL(next.logo.pendingFile) : next.logo.signedUrl },
        slots: next.slots.map((s, i) => {
          const p = list.find((x) => x.slot === i + 1)?.image_path ?? null;
          return { ...s, pendingFile: null, persistedPath: p, signedUrl: p ? (s.pendingFile ? URL.createObjectURL(s.pendingFile) : s.signedUrl) : null };
        }) as EntityMediaState["slots"],
      });
      setCount({ logo: !!logoPath, photos: list.length });
      current.onCount(!!logoPath, list.length);
    }, (e) => toast.error((e as Error).message));
  }
  const onChange = (next: EntityMediaState) => {
    setM(next);
    queue.current?.push(next);
  };
  const ok = count.logo && count.photos > 0;
  const photosOnly = wideAdd && count.logo;
  return (
    <div>
      <AttachmentCard value={m} onChange={(x) => void onChange(x)} name={name} sectorLine={sectorLine} intro={null} showGuidance={false} photosOnly={photosOnly}
        photoGuide examples={examples}
        footer={<>
          {note && <p className="mt-2.5 flex items-start gap-1.5 text-[13px] text-[#6B7280] dark:text-muted-foreground">{note}</p>}
          <StepDone ok={ok} L={L} items={[...(photosOnly ? [] : [[count.logo, L("Logo", "โลโก้")] as [boolean, string]]), [count.photos > 0, L("At least 1 photo", "รูปภาพอย่างน้อย 1 รูป")]]} />
        </>} />
    </div>
  );
}

/** Under the drop box: the checklist until done, then the one done line. */
export function StepDone({ ok, items, L }: { ok: boolean; items: [boolean, string][]; L: L }) {
  if (ok) return <p className="mt-[14px] flex items-center gap-1.5 text-[13.5px] font-semibold text-[#15803D]"><CircleCheck className="h-4 w-4" />{L("Your logo and photos are added. You can change them later in My Company.", "เพิ่มโลโก้และรูปภาพแล้ว ท่านเปลี่ยนได้ภายหลังใน My Company")}</p>;
  return (
    <div className="mt-[14px] flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
      {items.map(([on, label]) => (
        <span key={label} className={cn("flex items-center gap-2 font-semibold", on ? "text-[#15803D]" : "text-[#6B7280]")}>
          <span className={cn("grid h-4 w-4 place-items-center rounded-full", on ? "bg-[#15803D]" : "border-[1.5px] border-[#C9CED8] bg-white")}>{on && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.2} />}</span>{label}
        </span>
      ))}
    </div>
  );
}
