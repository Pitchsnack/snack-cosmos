import {describe,it,expect} from 'vitest';
import {hubNdaActive} from '../../src/lib/reports-hub';
describe('Pipeline full profile NDA boundary',()=>{
  const now=Date.parse('2026-10-26T05:06:00Z');
  it('Step 1 does not unlock private fields',()=>expect(hubNdaActive({status:'requested',nda_approved_at:null,nda_expires_at:'2028-10-25T00:00:00Z'},now)).toBe(false));
  it('approved valid NDA unlocks the counterpart profile',()=>expect(hubNdaActive({status:'approved',nda_approved_at:'2026-10-23T00:00:00Z',nda_expires_at:'2028-10-22T00:00:00Z'},now)).toBe(true));
  it('stored expiry blocks access at its exact end',()=>expect(hubNdaActive({status:'approved',nda_approved_at:'2024-10-26T00:00:00Z',nda_expires_at:'2026-10-26T05:06:00Z'},now)).toBe(false));
  it('ended deal cannot reuse its formerly approved NDA',()=>expect(hubNdaActive({status:'ended',nda_approved_at:'2026-10-23T00:00:00Z',nda_expires_at:'2028-10-22T00:00:00Z'},now)).toBe(false));
});