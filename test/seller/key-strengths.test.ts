import {describe,expect,it} from 'vitest';
import {emptyDraft,websiteFieldsAnswered,isMissed} from '../../src/lib/seller-wizard';
import {displayedStrengths,fillEmptyStrengths,strengthCount,strengthRows,wizardStrengthIdeas,prefillStrengthRows} from '../../src/lib/seller-strengths';
import {mergeWebsiteEnrich} from '../../src/lib/seller-website-enrich';
const d=()=>({...emptyDraft(),name:'Test business',sector:'Packaging',year:'2006',shortDescription:'Packaging products',longDescription:'Packaging for food brands',productTags:['Flexible packaging'],marketTags:['Food brands','ASEAN']});
describe('seller Website key strengths',()=>{
 it('requires exactly the first three rows, not the optional fourth',()=>{
  expect(websiteFieldsAnswered({...d(),highlights:['One','Two','','Four']})).toBe(false);
  expect(websiteFieldsAnswered({...d(),highlights:['One','Two','Three','']})).toBe(true);
 });
 it('rejects whitespace-only strengths',()=>expect(websiteFieldsAnswered({...d(),highlights:['One','Two','  ','Four']})).toBe(false));
 it('counts either language per row and does not copy fallback text',()=>{
  const mixed={...d(),highlights:['English','','English three',''],highlightsTh:['','ไทย','','']};
  expect(strengthCount(mixed,true)).toBe(3);
  expect(displayedStrengths(mixed,true)).toEqual(['English','ไทย','English three','']);
  expect(fillEmptyStrengths(mixed,['New'],true).rows).toEqual(['','ไทย','','']);
 });
 it('marks in-progress Website without strengths as unanswered',()=>expect(isMissed('web',{...d(),reached:'review'})).toBe(true));
 it('enforces the existing 200-character limit',()=>{
  expect(websiteFieldsAnswered({...d(),highlights:['x'.repeat(200),'Two','Three']})).toBe(true);
  expect(websiteFieldsAnswered({...d(),highlights:['x'.repeat(201),'Two','Three']})).toBe(false);
 });
 it('Suggest fills only the empty third row and keeps row four',()=>{
  const result=fillEmptyStrengths({highlights:['One','Two','','Four']},['one','TWO','Three'],false);
  expect(result.rows).toEqual(['One','Two','Three','Four']); expect(result.first).toBe(2);
 });
 it('Suggest avoids repeated ideas ignoring case',()=>expect(fillEmptyStrengths({},['One','ONE','Two','Three'],false).rows).toEqual(['One','Two','Three','']));
 it('Auto Enrich fills three strengths and marks them Auto-filled',()=>{
  const result=mergeWebsiteEnrich(d(),{productTags:['Flexible packaging'],marketTags:['Food brands']},{},false);
  expect(result.patch.highlights?.filter(Boolean)).toHaveLength(3);expect(result.marks.highlights).toBe(true);
 });
 it('Auto Enrich keeps all seller rows after typing or Suggest',()=>expect(mergeWebsiteEnrich({...d(),highlights:['Own','','','Optional']},{productTags:['New']},{highlights:false},false).patch).not.toHaveProperty('highlights'));
 it('Auto Enrich replaces auto-filled first three but preserves optional row four',()=>{
  const result=mergeWebsiteEnrich({...d(),highlights:['Old','Old 2','Old 3','Optional']},{productTags:['New']},{highlights:true},false);
  expect(result.patch.highlights?.[0]).not.toBe('Old');expect(result.patch.highlights?.[3]).toBe('Optional');
 });
 it('nothing found does not fill strengths',()=>expect(mergeWebsiteEnrich(d(),{}, {},false).patch).not.toHaveProperty('highlights'));
 it('Suggest writes native Thai templates with translated known tags',()=>{
  expect(wizardStrengthIdeas(d(),true)).toEqual(['ดำเนินธุรกิจตั้งแต่ทศวรรษ 2000','สินค้าและบริการ ได้แก่ บรรจุภัณฑ์ชนิดอ่อนตัว','ให้บริการตลาดและกลุ่มลูกค้า ได้แก่ แบรนด์อาหาร และ อาเซียน']);
 });
 it('Auto Enrich stores Thai suggestions only in Thai rows',()=>{
  const result=mergeWebsiteEnrich(d(),{productTags:['Flexible packaging'],marketTags:['Food brands']},{},true);
  expect(result.patch.highlightsTh?.[0]).toBe('ดำเนินธุรกิจตั้งแต่ทศวรรษ 2000');expect(result.patch).not.toHaveProperty('highlights');
 });
 it('normalizes exactly four rows without dropping empty positions',()=>expect(strengthRows(['One','','Three'])).toEqual(['One','','Three','']));
 it('opening Listing Identity keeps Thai strengths and the optional fourth untouched',()=>expect(prefillStrengthRows(['','','',''],['หนึ่ง','สอง','สาม',''],['One','Two','Three'])).toEqual(['','','','']));
});