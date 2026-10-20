import {describe,it,expect} from 'vitest';
import {REPORT_KEYS,buyerReportState,accessibleCount,hubNdaActive,hubIsNew,HUB_LAUNCH,sellerHubRoleAllowed,valuationCanGenerate,type HubState} from '../../src/lib/reports-hub';
import catalog from '../../src/config/report-catalog.json';
describe('Seven-report hub rules',()=>{
 it('has the seven required report types in order',()=>expect(REPORT_KEYS).toEqual(['verification','shareholders','statements','valuation','pnl','risk','credit']));
 it('allows Control Admin to read seller reports',()=>expect(sellerHubRoleAllowed('admin')).toBe(true));
 it('allows sellers but not buyers or advisors in the seller report view',()=>{expect(sellerHubRoleAllowed('seller')).toBe(true);expect(sellerHubRoleAllowed('buyer')).toBe(false);expect(sellerHubRoleAllowed('advisor')).toBe(false);});
 it('does not generate valuation without valuation inputs',()=>expect(valuationCanGenerate({})).toBe(false));
 it('prices Shareholders at THB 1500',()=>expect(catalog.prices.shareholders).toBe(1500));
 it('free sharing precedes plan and purchased access',()=>expect(buyerReportState({shared:true,yours:true,asked:false,ready:true,inPlan:true})).toBe('shared'));
 it('counts Shared, Yours and In plan only',()=>{const states:HubState[]=['shared','yours','plan','buy','on_order','asked'];expect(accessibleCount(states.map(buyerState=>({buyerState})))).toBe(3);});
 it('unprepared reports cannot count as In plan',()=>expect(buyerReportState({shared:false,yours:false,asked:false,ready:false,inPlan:true})).toBe('on_order'));
 it('revoked NDA ends shared access',()=>expect(hubNdaActive({status:'revoked',nda_approved_at:'2026-10-01',nda_expires_at:'2027-10-01'},Date.parse('2026-10-20'))).toBe(false));
 it('expired NDA cannot open the pop-up',()=>expect(hubNdaActive({status:'active',nda_approved_at:'2026-10-01',nda_expires_at:'2026-10-20'},Date.parse('2026-10-20'))).toBe(false));
 it('NEW ends after 30 days',()=>{expect(hubIsNew(Date.parse(HUB_LAUNCH)+29*86400000)).toBe(true);expect(hubIsNew(Date.parse(HUB_LAUNCH)+30*86400000)).toBe(false);});
});