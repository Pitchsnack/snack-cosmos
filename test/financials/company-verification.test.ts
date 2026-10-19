import {describe,it,expect} from 'vitest';
import {verificationNdaValid,verificationDue,verificationTotals,verificationResult,type VerificationCheck} from '../../src/lib/company-verification';
describe('Company verification business rules',()=>{
 it('adds 7% VAT to THB 3,000, totalling THB 3,210',()=>{expect(verificationTotals(3000,7)).toEqual({amount:3000,vat:210,total:3210});});
 it('promises two business days, skipping the weekend in Bangkok',()=>{expect(verificationDue('2026-10-16T10:00:00Z',2)).toBe('2026-10-20T10:00:00.000Z');});
 it('free rechecks use one business day',()=>{expect(verificationDue('2026-10-16T10:00:00Z',1)).toBe('2026-10-19T10:00:00.000Z');});
 it('rejects a revoked NDA despite a future expiry',()=>{expect(verificationNdaValid({status:'revoked',nda_approved_at:'2026-10-01',nda_expires_at:'2027-10-01'},Date.parse('2026-10-18'))).toBe(false);});
 it('rejects an expired NDA at its expiry instant',()=>{expect(verificationNdaValid({status:'active',nda_approved_at:'2026-10-01',nda_expires_at:'2026-10-18'},Date.parse('2026-10-18'))).toBe(false);});
 it('rejects a report without approved NDA',()=>{expect(verificationNdaValid({status:'active',nda_approved_at:null},Date.parse('2026-10-18'))).toBe(false);});
 it('accepts an approved, unexpired NDA',()=>{expect(verificationNdaValid({status:'active',nda_approved_at:'2026-10-01',nda_expires_at:'2027-10-01'},Date.parse('2026-10-18'))).toBe(true);});
 it('certifies only all six matching checks',()=>{const checks:VerificationCheck[]=Array.from({length:6},(_,i)=>({key:i+1,result:'match',detail:null,source:null}));expect(verificationResult(checks)).toBe('certified');expect(verificationResult(checks.slice(0,5))).toBe('checking');});
 it('one mismatch needs a fix',()=>{const checks:VerificationCheck[]=Array.from({length:6},(_,i)=>({key:i+1,result:i===1?'mismatch':'match',detail:null,source:null}));expect(verificationResult(checks)).toBe('needs_fix');});
 it('duplicate checks cannot certify a company',()=>{const checks:VerificationCheck[]=Array.from({length:6},()=>({key:1,result:'match',detail:null,source:null}));expect(verificationResult(checks)).toBe('checking');});
 it('withdrawn NDA cannot expose the report',()=>{expect(verificationNdaValid({status:'withdrawn',nda_approved_at:'2026-10-01',nda_expires_at:'2027-10-01'},Date.parse('2026-10-18'))).toBe(false);});
});