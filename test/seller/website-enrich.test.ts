import {describe,expect,it} from 'vitest';
import {emptyDraft} from '../../src/lib/seller-wizard';
import {mergeWebsiteEnrich} from '../../src/lib/seller-website-enrich';
describe('Website enrichment preservation',()=>{
 it('fills empty fields and records Auto-filled marks',()=>{const r=mergeWebsiteEnrich(emptyDraft(),{shortDescription:'Read text',productTags:['Packaging']},{},false);expect(r.patch.shortDescription).toBe('Read text');expect(r.marks.shortDescription).toBe(true);});
 it('keeps all four manually entered fields',()=>{const d={...emptyDraft(),shortDescription:'Own short',longDescription:'Own long',productTags:['Own product'],marketTags:['Own market']};const r=mergeWebsiteEnrich(d,{shortDescription:'New',longDescription:'New',productTags:['New'],marketTags:['New']},{},false);for(const key of ['shortDescription','longDescription','productTags','marketTags'])expect(r.patch).not.toHaveProperty(key);});
 it('replaces fields still marked Auto-filled',()=>expect(mergeWebsiteEnrich({...emptyDraft(),shortDescription:'Old'},{shortDescription:'New'},{shortDescription:true},false).patch.shortDescription).toBe('New'));
 it('keeps manually entered other-language text',()=>expect(mergeWebsiteEnrich({...emptyDraft(),shortDescriptionTh:'ข้อความเดิม'},{shortDescription:'New'},{},false).patch).not.toHaveProperty('shortDescription'));
 it('limits tags to five and removes case-insensitive duplicates',()=>expect(mergeWebsiteEnrich(emptyDraft(),{productTags:['A','a','B','C','D','E','F']},{},false).patch.productTags).toEqual(['A','B','C','D','E']));
});
