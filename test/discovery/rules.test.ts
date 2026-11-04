import {describe,it,expect} from 'vitest';
import {discoveryRecent,discoveryRangeMatches,discoveryOrderOpen,validPending,discoveryFigures} from '../../src/lib/discovery';
import type {DiscoveryData} from '../../src/lib/discovery';
describe('public Discovery rules',()=>{
 const now=Date.parse('2026-11-04T15:00:00Z');
 it('NEW includes less than 7 days and excludes future dates',()=>{expect(discoveryRecent('2026-10-29T15:00:00Z',now)).toBe(true);expect(discoveryRecent('2026-10-28T15:00:00Z',now)).toBe(false);expect(discoveryRecent('2026-11-05T15:00:00Z',now)).toBe(false);});
 it('only posted orders before their Bangkok closing day are open',()=>{expect(discoveryOrderOpen({status:'posted',closesOn:'2026-11-05'},now)).toBe(true);expect(discoveryOrderOpen({status:'posted',closesOn:'2026-11-04'},now)).toBe(false);expect(discoveryOrderOpen({status:'draft',closesOn:null},now)).toBe(false);});
 it('ranges match by overlap, not exact label',()=>{expect(discoveryRangeMatches('฿50M – 250M','฿100M – 250M')).toBe(true);expect(discoveryRangeMatches('Under ฿50M','฿50M – 100M')).toBe(false);});
 it('session actions require valid action, item and share email',()=>{const p={action:'share',tab:'sale',id:'id',ref:'PS-1',name:'Name',sector:'Sector',meta:'Meta',token:'token',email:'friend@example.com'};expect(validPending(p)).toBe(true);expect(validPending({...p,email:'bad'})).toBe(false);expect(validPending({...p,action:'admin'})).toBe(false);expect(validPending({...p,id:undefined})).toBe(false);});
 it('whole-list figures count only open orders and distinct buyer countries',()=>{const data={orders:[{status:'posted',closesOn:null,country:'Thailand',kind:'sealed',postedAt:'2026-11-03'},{status:'posted',closesOn:null,country:'Thailand',kind:'advertisement',postedAt:'2026-10-01'},{status:'closed',closesOn:null,country:'Vietnam',kind:'sealed',postedAt:'2026-11-03'}],listings:[]} as unknown as DiscoveryData;expect(discoveryFigures(data,'wanted',now)).toEqual([2,1,1,1]);});
});
