import { describe, it, expect } from 'vitest';
import { planErrors, planDiff, planPrice, type PlanRecord } from '../../src/lib/plan-editor';
const plan = {id:'test',role:'buyer',name:'Investor',status:'live',price_type:'paid',price_thb:45000,term_months:12,requests_mode:'number',requests_n:30,card_text:{en:{badge:'',intent:'',points:[]},th:{badge:'',intent:'',points:[]}},reports:[{report_key:'risk',mode:'number',per_term:2}]} as unknown as PlanRecord;
describe('Plan editor',()=>{
 it('formats paid, free and on-request prices',()=>{expect(planPrice(plan)).toBe('45,000 THB / yr');expect(planPrice({...plan,price_type:'free'})).toBe('Free');expect(planPrice({...plan,price_type:'on_request'})).toBe('On request');});
 it('rejects zero prices and fractional counts',()=>{expect(planErrors({...plan,price_thb:0}).price_thb).toBeTruthy();expect(planErrors({...plan,requests_n:2.5}).requests_n).toBeTruthy();expect(planErrors({...plan,reports:[{report_key:'risk',mode:'number',per_term:0}]}).risk).toBeTruthy();});
 it('shows exact report and request changes',()=>{expect(planDiff(plan,{...plan,reports:[{report_key:'risk',mode:'number',per_term:5}]})).toEqual([{key:'risk',label:'Company risk report',old:'2 a year',new:'5 a year'}]);expect(planDiff(plan,{...plan,requests_n:25})[0].new).toBe(25);});
 it('accepts valid plans and reports language-only changes',()=>{expect(planErrors(plan)).toEqual({});expect(planDiff(plan,{...plan,card_text:{...plan.card_text,en:{badge:'New',intent:'',points:[]}}})[0].key).toBe('card_text.en');});
});
