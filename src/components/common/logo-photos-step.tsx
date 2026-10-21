import { useRef, useState } from "react";
import { Check, CircleCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AttachmentCard } from "@/components/startups/attachment-card";
import { EMPTY_SLOT, uploadPending, type EntityMediaState, type UploadFn } from "@/components/media/entity-media-editor";
import { cn } from "@/lib/utils";

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
export function LogoPhotosStep({ initial, getUrl, persist, onCount, name, sectorLine, note, why, L }: {
  initial: StepMedia;
  getUrl: UploadFn;
  persist: (logoPath: string | null, media: { slot: 1 | 2 | 3; image_path: string }[]) => Promise<unknown>;
  onCount: (hasLogo: boolean, photos: number) => void;
  name: string; sectorLine: string; note: React.ReactNode; why: string[]; L: L;
}) {
  const [m, setM] = useState<EntityMediaState>(() => toState(initial));
  const [count, setCount] = useState({ logo: !!initial.logoPath, photos: initial.slots.length });
  const busy = useRef(false);
  const onChange = async (next: EntityMediaState) => {
    setM(next);
    if (busy.current) return;
    busy.current = true;
    try {
      const { logoPath, media: list } = await uploadPending(next, getUrl, supabase.storage.from("startup-media"));
      await persist(logoPath, list);
      setM({
        logo: { ...next.logo, pendingFile: null, persistedPath: logoPath, signedUrl: next.logo.pendingFile ? URL.createObjectURL(next.logo.pendingFile) : next.logo.signedUrl },
        slots: next.slots.map((s, i) => {
          const p = list.find((x) => x.slot === i + 1)?.image_path ?? null;
          return { ...s, pendingFile: null, persistedPath: p, signedUrl: p ? (s.pendingFile ? URL.createObjectURL(s.pendingFile) : s.signedUrl) : null };
        }) as EntityMediaState["slots"],
      });
      setCount({ logo: !!logoPath, photos: list.length });
      onCount(!!logoPath, list.length);
    } catch (e) { toast.error((e as Error).message); }
    finally { busy.current = false; }
  };
  const ok = count.logo && count.photos > 0;
  const dot = (on: boolean, label: string) => (
    <span className={cn("flex items-center gap-2 font-semibold", on ? "text-[#15803D]" : "text-[#6B7280]")}>
      <span className={cn("grid h-4 w-4 place-items-center rounded-full", on ? "bg-[#15803D]" : "border-[1.5px] border-[#C9CED8] bg-white")}>{on && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.2} />}</span>{label}
    </span>
  );
  return (
    <div>
      <div className="max-[599px]:[&_.attachment-card]:p-[14px]">
        <AttachmentCard value={m} onChange={(x) => void onChange(x)} name={name} sectorLine={sectorLine} intro={null} />
      </div>
      <p className="mt-2.5 flex items-start gap-1.5 text-[13px] text-[#6B7280] dark:text-muted-foreground">{note}</p>
      {ok ? (
        <p className="mt-[18px] flex items-center gap-1.5 text-[13.5px] font-semibold text-[#15803D]"><CircleCheck className="h-4 w-4" />{L("Your logo and photos are added. You can change them later in My Company.", "เพิ่มโลโก้และรูปภาพแล้ว ท่านเปลี่ยนได้ภายหลังที่บริษัทของฉัน")}</p>
      ) : (
        <>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
            {dot(count.logo, L("Logo", "โลโก้"))}{dot(count.photos > 0, L("At least 1 photo", "รูปภาพอย่างน้อย 1 รูป"))}
            <span className="text-[#6B7280]">{L("Both are needed to continue.", "ต้องมีทั้งสองอย่างจึงจะไปต่อได้")}</span>
          </div>
          <div className="mt-[22px] rounded-[12px] border border-[#D6E7FC] bg-[#F4F9FF] px-[18px] py-4 dark:border-border dark:bg-[#16283A]">
            <p className="text-[14.5px] font-bold">{L("Why add them", "ทำไมต้องเพิ่ม")}</p>
            <ul className="mt-2.5 space-y-1.5">
              {why.map((x) => (
                <li key={x} className="flex items-start gap-2 text-[14px] text-[#434A5C] dark:text-muted-foreground"><Check className="mt-[3px] h-3.5 w-3.5 shrink-0 text-[#15803D]" strokeWidth={2.8} />{x}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
