import {describe,it,expect} from 'vitest';
import {loiTurn} from '../../src/lib/loi-workflow';
import {currentStep,waitState,STEPS} from '../../src/lib/pipeline-state';
import {thaiAmount,letterClauses} from '../../src/lib/loi-document';
import type {PipelineRow} from '../../src/lib/pipeline.functions';
const row=(extra:Partial<PipelineRow>={})=>({ndaApprovedAt:'2026-11-05',loiSentAt:null,loiAcceptedAt:null,loiChangesRequestedAt:null,paymentAt:null,reportSharedAt:'2026-11-05',...extra} as PipelineRow);
describe('Either-side LOI rules',()=>{
 it('neither side waits when no letter has been sent',()=>{expect(waitState(row(),true).onYou).toBe(false);expect(waitState(row(),false).onYou).toBe(false);});
 it('only buyer reviews a seller letter',()=>{const p=row({loiFrom:'seller',loiSentAt:'2026-11-05'});expect(loiTurn(p,'buyer')).toBe('review');expect(loiTurn(p,'seller')).toBe('waiting');});
 it('legacy letters are buyer-origin',()=>{const p=row({loiSentAt:'2026-11-05'});expect(loiTurn(p,'seller')).toBe('review');expect(loiTurn(p,'buyer')).toBe('waiting');});
 it('changes move the turn back to the sender',()=>{const p=row({loiFrom:'seller',loiSentAt:'2026-11-05',loiChangesRequestedAt:'2026-11-06'});expect(loiTurn(p,'seller')).toBe('revised');expect(loiTurn(p,'buyer')).toBe('waiting');});
 it('accepted letter advances to Step 4 Deal Support',()=>{expect(currentStep(row({loiAcceptedAt:'2026-11-06'}))).toBe(3);expect(STEPS[3]).toBe('Deal Support');});
 it('both sides must independently confirm payment readiness',()=>{const p=row({loiAcceptedAt:'2026-11-06',workflow:{choices:{},receipts:{},payment:{buyer:'2026-11-06'}}});expect(waitState(p,true).onYou).toBe(true);expect(waitState(p,false).onYou).toBe(false);});
 it('both confirmations reach Payment without completing payment',()=>{const p=row({loiAcceptedAt:'2026-11-06',workflow:{choices:{},receipts:{},payment:{buyer:'2026-11-06',seller:'2026-11-06'}}});expect(currentStep(p)).toBe(6);expect(p.paymentAt).toBe(null);});
 it('seller document keeps all eight clauses and authored conditions',()=>{const clauses=letterClauses({amount:2234234,days:60,conditions:'Authored condition',from:'seller',ref:'PS-1005'},true);expect(clauses).toHaveLength(8);expect(clauses[0].text).toContain('ผู้ขายเสนอขาย');expect(clauses[3].text).toBe('Authored condition');});
 it('Thai amount is real numeric conversion',()=>{expect(thaiAmount(21)).toBe('ยี่สิบเอ็ดบาทถ้วน');expect(thaiAmount(1000001)).toBe('หนึ่งล้านหนึ่งบาทถ้วน');});
});