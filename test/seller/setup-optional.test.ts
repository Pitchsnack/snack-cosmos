import { describe, expect, it } from "vitest";
import { emptyDraft, sellerAnswered, sellerValid, isMissed, firstUnanswered } from "../../src/lib/seller-wizard";
describe("seller website and optional licence completion",()=>{
 it("a URL alone never completes descriptions",()=>expect(sellerAnswered({...emptyDraft(),web:"www.example.com",reached:"review"}).web).toBe(false));
 it("no website completes with both descriptions and one product tag",()=>expect(sellerAnswered({...emptyDraft(),shortDescription:"A business",longDescription:"Business operations",productTags:["Services"]}).web).toBe(true));
 it("passing Website without its fields remains missing",()=>expect(isMissed("web",{...emptyDraft(),reached:"founded"})).toBe(true));
 it("passing Licences still completes without selections",()=>expect(sellerAnswered({...emptyDraft(),reached:"photos"}).lic).toBe(true));
 it("picked licences complete before passage",()=>expect(sellerValid({...emptyDraft(),iso:["ISO 9001"]}).lic).toBe(true));
 it("resume opens required Website rather than skipping it",()=>expect(firstUnanswered({...emptyDraft(),role:"owner",name:"Test",reg:"0105561001778",addr:{street:"1",unit:"",district:"Bangkok",province:"Bangkok",postal:"10110"},sector:"Packaging",reached:"review"})).toBe("web"));
});
