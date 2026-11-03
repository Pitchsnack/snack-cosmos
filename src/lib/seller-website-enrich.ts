import type { SellerDraft } from './seller-wizard';
import { strengthCount, strengthRows, wizardStrengthIdeas } from './seller-strengths';
export type WebsiteField = 'shortDescription' | 'longDescription' | 'productTags' | 'marketTags' | 'highlights';
export type AutoMarks = Partial<Record<WebsiteField, boolean>>;
export function mergeWebsiteEnrich(d:SellerDraft,r:Record<string,unknown>,marks:AutoMarks,th:boolean) {
 const patch:Partial<SellerDraft>={enrichResult:r};const filledMarks:AutoMarks={};
 for(const key of ['shortDescription','longDescription','productTags','marketTags'] as WebsiteField[]) {
  const target=th ? `${key}Th`:key;const opposite=th ? key:`${key}Th`;
  const current=(d as unknown as Record<string,unknown>)[target];const other=(d as unknown as Record<string,unknown>)[opposite];
  const filled=(v:unknown)=>Array.isArray(v) ? v.length>0 : typeof v==='string' && !!v.trim();
  const found=r[key];
  if((!filled(current) && !filled(other) || marks[key]) && filled(found)) {
   (patch as Record<string,unknown>)[target]=Array.isArray(found) ? found.filter((x):x is string=>typeof x==='string').map(x=>x.trim().slice(0,50)).filter(Boolean).filter((x,i,arr)=>arr.findIndex(t=>t.toLowerCase()===x.toLowerCase())===i).slice(0,5):found;
   filledMarks[key]=true;
  }
 }
 const foundBusiness = ['shortDescription','longDescription','productTags','marketTags'].some(key => {
  const v = r[key]; return Array.isArray(v) ? v.length > 0 : typeof v === 'string' && !!v.trim();
 });
 if (foundBusiness && (strengthCount(d) === 0 || marks.highlights)) {
  const ideas = wizardStrengthIdeas({...d,...patch}, th);
  if (ideas.length >= 3) {
   const rows = strengthRows(th ? d.highlightsTh : d.highlights);
   patch[th ? 'highlightsTh' : 'highlights'] = [...ideas.slice(0,3), rows[3] ?? ''];
   filledMarks.highlights = true;
  }
 }
 return {patch,marks:filledMarks};
}
