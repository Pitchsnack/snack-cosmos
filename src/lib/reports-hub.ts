import {computeValuation,readFilingInputs,DEFAULT_DISCOUNTS} from './valuation';
import {normalise} from './valuation-adjustments';
import type { StartupFinancials } from './financials.functions';
import type { VerificationState } from './company-verification';

export const REPORT_KEYS = ['verification','shareholders','statements','valuation','pnl','risk','credit'] as const;
export type HubKey = typeof REPORT_KEYS[number];
export type HubMode = 'buyer' | 'seller' | 'admin';
export type HubState = 'shared' | 'yours' | 'plan' | 'buy' | 'on_order' | 'asked';
export const HUB_LAUNCH = '2026-10-20T01:02:00Z';
export const hubIsNew = (now = Date.now()) => now >= Date.parse(HUB_LAUNCH) && now < Date.parse(HUB_LAUNCH) + 30 * 86400000;
export const HUB_NAMES: Record<HubKey,string> = {verification:'Company verification',shareholders:'Shareholders',statements:'Financial statements',valuation:'Company valuation',pnl:'P&L analysis',risk:'Company risk',credit:'Credit risk'};
export const HUB_THAI: Record<HubKey,string> = {verification:'ตรวจสอบบริษัท',shareholders:'ผู้ถือหุ้น',statements:'งบการเงิน',valuation:'มูลค่าบริษัท',pnl:'วิเคราะห์กำไรขาดทุน',risk:'ความเสี่ยงบริษัท',credit:'ความเสี่ยงเครดิต'};
export function sellerHubRoleAllowed(role:string|null){return role==='seller'||role==='admin';}
export function buyerReportState(o: {shared:boolean;yours:boolean;asked:boolean;ready:boolean;inPlan:boolean}): HubState {
  if(o.shared)return 'shared'; if(o.yours)return 'yours'; if(o.asked)return 'asked'; if(!o.ready)return 'on_order'; return o.inPlan?'plan':'buy';
}
export const accessibleCount = (rows: {buyerState:HubState}[]) => rows.filter(r=>['shared','yours','plan'].includes(r.buyerState)).length;
export function hubNdaActive(p:{status:string;nda_approved_at:string|null;nda_expires_at:string|null},now=Date.now()) {
  return !!p.nda_approved_at && !['declined','withdrawn','revoked','ended'].includes(p.status) && Date.parse(p.nda_expires_at ?? new Date(Date.parse(p.nda_approved_at)+730*86400000).toISOString()) > now;
}
export type Audience = {pipelineId:string;buyerId:string;name:string;sub:string;ref:string|null;contact:string|null;state:'shared'|'yours'|'asked';at:string;openedAt:string|null;allowDownload:boolean};
export type HubRow = {key:HubKey;planKey:string;years:number;name:string;status:'ready'|'in_progress'|'not_ordered';generatedAt:string|null;authorisedAt:string|null;readyBy:string|null;orderId:string|null;paidAt:string|null;price:number|null;paidAmount:number|null;buyerState:HubState;openedAt:string|null;askedAt:string|null;declinedAt:string|null;inPlan:boolean;left:number|null;total:number|null;included:boolean;audience:Audience[];allowDownload:boolean;freePeriod?:boolean;freeUntil?:string|null;orderAmount?:number|null;priceType?:string};
export type HubData = {mode:HubMode;companyId:string;pipelineId:string|null;company:string;companyTh:string|null;code:string|null;ref:string|null;registration:string|null;sector:string|null;province:string|null;companyStatus:string|null;fiscalYear:number|null;owner:string|null;runBy:string|null;buyer: {id:string;name:string;sub:string;ref:string|null;contact:string|null}|null;ndaAt:string|null;step:number;stepName:string;rows:HubRow[];count:number;waiting:number;fresh:boolean};
export type ShareholderContent = {capital:number|null;shares:number|null;par:number|null;fullyPaid:boolean|null;thaiPct:number|null;ultimateOwner:string|null;ultimatePct:number|null;holders:{name:string;registration:string|null;role:string|null;type:string;nationality:string;shares:number|null;pct:number}[];chains:{description:string;effective:string}[];notes:{title:string;text:string}[];sources:string[];filedOn:string|null;checkedOn:string|null};
export type HubContent = {financials?:StartupFinancials;valuation?:HubValuation;verification?:VerificationState;shareholders?:ShareholderContent;credit?:{title:string;text:string}[]};
export type HubValuation = {match:import('./peer-comparables').PeerMatchResult;peerSet:import('./peer-comparables').PeerSetDetail;selection:import('./startup-peers.functions').StartupPeerSelection;adjustments:import('./valuation-adjustments.functions').ValuationAdjustmentsPayload};

export function valuationCanGenerate(content:HubContent):boolean {
 const f=content.financials,v=content.valuation;if(!f||!v||!f.years.length)return false;
 const peers=v.selection.basis==='chosen'&&v.selection.peers.length?v.selection.peers:v.peerSet.peers;
 const inputs=readFilingInputs(f.years.at(-1),f.income,f.position,f.cashFlow,f.ratios);
 const n=normalise(v.adjustments.adjustments,v.adjustments.settings,inputs.netProfit,inputs.revenue);
 const result=computeValuation(inputs,peers,DEFAULT_DISCOUNTS,n.applied?{netProfit:n.normalisedNetProfit,revenue:n.normalisedRevenue,applied:true}:undefined);
 return result.methods.some(m=>m.status==='usable'||m.status==='low confidence');
}
