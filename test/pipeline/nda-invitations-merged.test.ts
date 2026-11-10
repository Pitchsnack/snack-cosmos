import {describe,it,expect} from 'vitest';
import {ndaBucket,ndaStep,ndaWaitingDays,sortNdas,type NdaRow} from '../../src/lib/nda-invitation-state';
const row=(extra:Partial<NdaRow>={}):NdaRow=>({id:'r',listingId:'l',origin:'sent',status:'waiting',name:'Code',sentAt:'2026-10-01T02:00:00Z',ndaAt:'2026-10-02T02:00:00Z',viewedAt:null,...extra} as NdaRow);
describe('Merged NDA rules',()=>{
 for(const status of ['new','viewed'] as const)it(`${status} waits on the buyer`,()=>{expect(ndaBucket(row({status}),false)).toBe('you');expect(ndaBucket(row({status}),true)).toBe('response');});
 it('signed requests wait on the seller',()=>{expect(ndaBucket(row(),true)).toBe('you');expect(ndaBucket(row(),false)).toBe('response');});
 for(const status of ['approved','declined','not_interested','withdrawn','closed'] as const)it(`${status} belongs to Completed for both parties`,()=>{expect(ndaBucket(row({status}),true)).toBe('completed');expect(ndaBucket(row({status}),false)).toBe('completed');});
 it('standalone request starts at step 3',()=>expect(ndaStep(row())).toBe(3));
 it('viewed seller withdrawal stops at step 2',()=>expect(ndaStep(row({status:'withdrawn',withdrawnSide:'seller',viewedAt:'2026-10-02',ndaAt:null}))).toBe(2));
 it('buyer withdrawal stops at step 3',()=>expect(ndaStep(row({status:'withdrawn',withdrawnSide:'buyer'}))).toBe(3));
 it('bilateral signature completes four bars',()=>expect(ndaStep(row({status:'approved'}))).toBe(4));
 it('waiting uses the current turn and Bangkok calendar days',()=>expect(ndaWaitingDays(row(),Date.parse('2026-10-16T02:00:00Z'))).toBe(14));
 it('default wait sort puts longest first and reverses',()=>{const a=row({id:'a',ndaAt:'2026-10-01'}),b=row({id:'b',ndaAt:'2026-10-03'});expect(sortNdas([b,a],{key:'waiting',reverse:false}).map(r=>r.id)).toEqual(['a','b']);expect(sortNdas([b,a],{key:'waiting',reverse:true}).map(r=>r.id)).toEqual(['b','a']);});
 it('completed wait sort falls back to newest start date',()=>{expect(sortNdas([row({id:'old',sentAt:'2026-10-01'}),row({id:'new',sentAt:'2026-10-05'})],{key:'waiting',reverse:false},true).map(r=>r.id)).toEqual(['new','old']);});
});