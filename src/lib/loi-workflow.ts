export type DealSide = "seller" | "buyer";
export type LoiChanges = {amount:number;days:number;conditions:string;note:string;side:DealSide;at:string};
export type LoiConsent = {by:string;side:DealSide;at:string;text:string;read:boolean;revision?:number;revised?:boolean};
export type StageChoice = {value:"pitchsnack"|"own"|"none"|null;at:string|null;locked:boolean};
export type DealWorkflow = {supportName?:string|null;supportAt?:string|null;choices:Partial<Record<DealSide,Partial<Record<"valuation"|"legal",StageChoice>>>>;receipts:Partial<Record<DealSide,{at:string;fileName:string|null}>>;spaDraftedAt?:string|null;spaSignedAt?:string|null;payment:Partial<Record<DealSide,string|null>>};
export function loiTurn(p:{loiFrom?:DealSide;loiSentAt:string|null;loiAcceptedAt:string|null;loiChangesRequestedAt:string|null},side:DealSide){
 if(!p.loiSentAt||p.loiAcceptedAt)return "none";
 const sender=(p.loiFrom??"buyer")===side;
 return p.loiChangesRequestedAt?(sender?"revised":"waiting"):(sender?"waiting":"review");
}