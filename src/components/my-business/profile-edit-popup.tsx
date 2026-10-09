import { useNavigate, useSearch } from "@tanstack/react-router";
import { EditInfoPopup, leaveEditUrl, markEditPushed, useTr } from "@/components/common/edit-info-popup";
import { BuyerInvestorEdit, BUYER_INVESTOR_KEY } from "@/components/my-business/buyer-investor-edit";
import { AdvisorFirmEdit } from "@/components/advisor/advisor-firm-edit";
import { useMyAdvisorFirms } from "@/components/advisor/advisor-my-company";
import { useQuery } from "@tanstack/react-query";
import type { EditSection } from "@/lib/advisor-firm";

type S = { edit?: "profile"; section?: string; firm?: string; from?: "public" | "private"; add?: "1" };

/** Buyer / Advisor › My Company: Edit profile opens in the pop-up (?edit=profile). */
export function useOpenProfileEdit() {
  const navigate = useNavigate();
  return (o: { section?: string; firm?: string; from?: "public" | "private"; add?: boolean } = {}) => {
    markEditPushed();
    void navigate({ to: "/marketplace/my-company", search: { edit: "profile", ...(o.section ? { section: o.section } : {}), ...(o.firm ? { firm: o.firm } : {}), ...(o.from ? { from: o.from } : {}), ...(o.add ? { add: "1" } : {}) } as never });
  };
}

export function ProfileEditPopup({ advisor }: { advisor: boolean }) {
  const s = useSearch({ strict: false }) as S;
  const navigate = useNavigate();
  const tr = useTr();
  const firms = useMyAdvisorFirms();
  const buyer = useQuery<{ investor?: { investor_name?: string | null } }>({ queryKey: BUYER_INVESTOR_KEY, enabled: false });
  if (s.edit !== "profile") return null;
  const firm = advisor ? (firms.data?.find((f) => f.id === s.firm) ?? firms.data?.[0]) : undefined;
  const name = advisor ? firm?.name ?? "" : buyer.data?.investor?.investor_name ?? "";
  const subtitle = advisor ? name || tr("Firm profile", "โปรไฟล์บริษัท")
    : `${name || tr("Your company", "บริษัทของท่าน")} · ${s.from === "private" ? tr("Private view", "มุมมองส่วนตัว") : tr("Public view", "มุมมองสาธารณะ")}`;
  const close = () => leaveEditUrl(() => void navigate({ to: "/marketplace/my-company", search: {} as never, replace: true }));
  return (
    <EditInfoPopup open subtitle={subtitle} companyName={name} onClosed={close}>
      {advisor
        ? (firm ? <AdvisorFirmEdit firmId={firm.id} section={s.section as EditSection | undefined} /> : null)
        : <BuyerInvestorEdit section={s.section} add={!!s.add} />}
    </EditInfoPopup>
  );
}
