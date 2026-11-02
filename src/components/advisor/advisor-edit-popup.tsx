import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FirmEditForm } from "@/components/advisor/advisor-firm-edit";
import { EditInfoPopup } from "@/components/common/edit-info-popup";
import { Skeleton } from "@/components/ui/skeleton";
import { getAdvisorFirmForAdmin } from "@/lib/advisor-firm.functions";
import type { EditSection } from "@/lib/advisor-firm";

/** ⋮ › Edit: the shared Edit information pop-up, saving through Admin's existing advisor save (Directory and Approvals). */
export function AdvisorEditPopup({ id, section, onClose }: { id: string; section?: EditSection; onClose: () => void }) {
  const fn = useServerFn(getAdvisorFirmForAdmin);
  const { data } = useQuery({ queryKey: ["advisor-admin-edit", id], queryFn: () => fn({ data: { id } }) });
  return (
    <EditInfoPopup open subtitle={data?.name ?? ""} companyName={data?.name || "Advisor firm"} onClosed={onClose}>
      {data ? <FirmEditForm firm={data} section={section} onDone={onClose} /> : <Skeleton className="h-[500px]" />}
    </EditInfoPopup>
  );
}
