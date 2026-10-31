import {describe,it,expect} from 'bun:test';
import {freePeriod,reportAmount,reportQuarter,reportErrors,type ReportDraft} from '../../src/lib/report-pricing';
const p:ReportDraft={report_key:'statements',price_type:'paid',price_thb:10000,free_until:null,free_for_sellers:true,free_for_buyers:true,updated_at:'',updated_by:null,allowances:{},noEnd:false};
describe('report price rules',()=>{
 it('Professional seller has two free statements then 10,000 plus 7% VAT',()=>{expect([2,1,0].map(left=>reportAmount(p,'seller',left))).toEqual([{amount:0,method:'Plan'},{amount:0,method:'Plan'},{amount:10700,method:'Manual'}]);});
 it('Investor buyer has two free risk reports then 12,000 plus VAT',()=>{expect(reportAmount({...p,report_key:'risk',price_thb:12000},'buyer',0)).toEqual({amount:12840,method:'Manual'});});
 it('verification costs 4,900 plus 7% VAT',()=>{expect(reportAmount({...p,report_key:'verification',price_thb:4900},'seller',0).amount).toBe(5243);});
 it('free period outranks and does not consume a plan report',()=>{expect(reportAmount({...p,price_type:'free',free_until:'2026-11-30'},'buyer',2,'2026-11-30')).toEqual({amount:0,method:'Free period'});});
 it('free period includes its Bangkok last day and expires the next day',()=>{const f={...p,price_type:'free' as const,free_until:'2026-11-30'};expect(freePeriod(f,'seller','2026-11-30')).toBe(true);expect(freePeriod(f,'seller','2026-12-01')).toBe(false);});
 it('free period is role scoped',()=>{expect(freePeriod({...p,price_type:'free',free_for_buyers:false},'buyer')).toBe(false);});
 it('credit is on request after plan allowance is exhausted',()=>{expect(reportAmount({...p,price_type:'on_request',price_thb:null},'buyer',0).amount).toBe(null);expect(reportAmount({...p,price_type:'on_request',price_thb:null},'buyer',1).method).toBe('Plan');});
 it('quarters are anchored to term start, with month-end clamping',()=>{expect(reportQuarter('2026-01-31T05:00:00Z',new Date('2026-07-31T05:00:00Z'))).toEqual({start:'2026-07-31T05:00:00.000Z',end:'2026-10-31T05:00:00.000Z'});});
 it('quarter before anniversary does not roll early',()=>{expect(reportQuarter('2026-01-31T05:00:00Z',new Date('2026-04-30T04:59:59Z'))).start).toBe('2026-01-31T05:00:00.000Z');});
 it('allowance numbers stay within 0–20',()=>{expect(reportErrors({...p,allowances:{a:21}}).allowances).toBeDefined();expect(reportErrors({...p,allowances:{a:0,b:20}})).toEqual({});});
});