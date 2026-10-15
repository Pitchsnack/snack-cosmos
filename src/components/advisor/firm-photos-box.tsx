import { tr } from "@/i18n/language";

type Photo = { slot: number; url: string | null };

/** Photos · {n} on a firm's full profile. Owners and Admin get Edit / Add photos; others don't see it while empty. */
export function FirmPhotosBox({ photos, canEdit, onEdit }: { photos: Photo[] | undefined; canEdit: boolean; onEdit?: () => void }) {
  const list = (photos ?? []).filter((p) => p.url).sort((a, b) => a.slot - b.slot).slice(0, 3);
  if (!list.length && !canEdit) return null;
  return (
    <div className="rounded-[12px] border border-[#E5E7EB] bg-card p-4 dark:border-border">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-[.08em] text-[#6B7280]">{tr("Photos")} · {list.length}</div>
        {canEdit && list.length > 0 && <button type="button" onClick={onEdit} className="text-[13px] font-semibold text-[#0F766E] hover:underline">{tr("Edit")}</button>}
      </div>
      {list.length ? (
        <div className="grid gap-2.5 max-[599px]:gap-1.5" style={{ gridTemplateColumns: `repeat(${list.length}, minmax(0, 1fr))` }}>
          {list.map((p) => <img key={p.slot} src={p.url!} alt="" className="aspect-[4/3] w-full rounded-[10px] object-cover" />)}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13.5px] text-[#6B7280]">{tr("No photos yet.")}</p>
          <button type="button" onClick={onEdit} className="text-[13px] font-semibold text-[#0F766E] hover:underline">{tr("Add photos")}</button>
        </div>
      )}
    </div>
  );
}
