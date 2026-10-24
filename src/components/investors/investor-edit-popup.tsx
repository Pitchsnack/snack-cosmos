import { EditInfoPopup } from "@/components/common/edit-info-popup";
import { BuyerInvestorEdit } from "@/components/my-business/buyer-investor-edit";
import { useInvestor } from "@/hooks/use-investor";

export function InvestorEditPopup({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useInvestor(id);
  return <EditInfoPopup open subtitle={`${data?.investor_name ?? ""} · Private view`} companyName={data?.investor_name ?? ""} onClosed={onClose} phoneTabs>
    <BuyerInvestorEdit id={id} directory />
  </EditInfoPopup>;
}