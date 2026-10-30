import { EditInfoPopup } from "@/components/common/edit-info-popup";
import { BuyerInvestorEdit, BuyerInvestorForm, type Data } from "@/components/my-business/buyer-investor-edit";
import { useInvestor } from "@/hooks/use-investor";

export function InvestorEditPopup({ id, onClose, initialView }: { id: string; onClose: () => void; initialView?: "public" | "private" }) {
  const { data } = useInvestor(id);
  return <EditInfoPopup open subtitle={`${data?.investor_name ?? ""} · ${initialView === "public" ? "Listing view" : "Exclusive view"}`} companyName={data?.investor_name ?? ""} onClosed={onClose} phoneTabs>
    <BuyerInvestorEdit id={id} directory initialView={initialView} />
  </EditInfoPopup>;
}
export function InvestorAddPopup({onClose,onCreated}:{onClose:()=>void;onCreated:(id:string)=>void}) {
 const data = {investor:{id:"",investor_name:"",media:[],keywords:[],investment_focus:[],preferred_stages:[],preferred_industries:[],portfolio:[],portfolio_extra:[],portfolio_links:[],acts_for_types:[],wizard:{}},buyer:{relation:null,status:"draft",description:"",deal_types:[],ref_no:""},account:{name:"",title:""},people:[],verification:{status:"none",note:null},extra:true} as unknown as Data;
 return <EditInfoPopup open title="Add investor" creating="investor" subtitle="Not created yet · Exclusive view" companyName="" onClosed={onClose} phoneTabs><BuyerInvestorForm data={data} onCreated={onCreated} /></EditInfoPopup>;
}
