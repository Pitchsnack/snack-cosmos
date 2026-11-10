import type {BuyerInvitation, SellerInvitation} from './invitations.functions';
export type NdaRow = BuyerInvitation | SellerInvitation;
export type NdaBucket = 'you' | 'response' | 'completed';
export type NdaSort = {key:'name'|'date'|'waiting'; reverse:boolean};
export function ndaBucket(r:Pick<NdaRow,'status'>,seller:boolean):NdaBucket {
 if(r.status==='new'||r.status==='viewed') return seller?'response':'you';
 if(r.status==='waiting') return seller?'you':'response';
 return 'completed';
}
export function ndaStartedWithInvitation(r:NdaRow){return r.origin===('listingId' in r?'received':'sent');}
export function ndaWaitingSince(r:NdaRow){return r.status==='waiting'?r.ndaAt??r.sentAt:r.status==='viewed'?r.viewedAt??r.sentAt:r.sentAt;}
const bangkokDay=(s:string|number)=>Math.floor((new Date(s).getTime()+7*3600000)/86400000);
export function ndaWaitingDays(r:NdaRow,now=Date.now()){return Math.max(0,bangkokDay(now)-bangkokDay(ndaWaitingSince(r)));}
export function ndaStep(r:NdaRow){return r.status==='approved'||r.status==='closed'?4:r.status==='declined'||r.withdrawnSide==='buyer'||r.status==='waiting'?3:r.status==='not_interested'||r.viewedAt?2:1;}
export function ndaName(r:NdaRow){return 'listingId' in r?r.status==='approved'?r.companyName??r.name:r.name:r.status==='approved'?r.investorName??r.investor?.codeName??'Investor':r.investor?.codeName??'Investor';}
export function sortNdas(rows:NdaRow[],sort:NdaSort,completed=false){const key=completed&&sort.key==='waiting'?'date':sort.key;return rows.slice().sort((a,b)=>{const diff=key==='name'?ndaName(a).localeCompare(ndaName(b)):key==='date'?Date.parse(b.sentAt)-Date.parse(a.sentAt):Date.parse(ndaWaitingSince(a))-Date.parse(ndaWaitingSince(b));return sort.reverse?-diff:diff;});}