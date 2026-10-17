import { describe, expect, it } from 'vitest';
import { canShare, canRequestPlan, nextSidebarPlan, invitationEmailMatches, COMPLETION_FEE_MINIMUM_THB } from '../../src/lib/sidebar-plans';
import type { PlanRecord } from '../../src/lib/plan-editor';
const current={id:'entry',role:'seller',status:'live',sort:1} as PlanRecord;
const next={id:'promo',role:'seller',status:'live',sort:2} as PlanRecord;
describe('Sidebar sharing rules',()=>{
 it('allows seller buyer advisor, never admin',()=>{expect(['seller','buyer','advisor'].map(canShare)).toEqual([true,true,true]);expect(canShare('admin')).toBe(false)});
 it('uses next live same-role plan and none above the top',()=>{expect(nextSidebarPlan([current,{...next,status:'draft'},{...next,id:'buyer',role:'buyer'}, {...next,id:'pro',sort:3}],current)?.id).toBe('pro');expect(nextSidebarPlan([current,next],next)).toBeNull()});
 it('rejects current hidden and other-role requests',()=>{expect(canRequestPlan('seller',current,next)).toBe(true);expect(canRequestPlan('seller',current,current)).toBe(false);expect(canRequestPlan('seller',current,{...next,status:'hidden'})).toBe(false);expect(canRequestPlan('buyer',null,next)).toBe(false);expect(canRequestPlan('admin',null,next)).toBe(false)});
 it('binds claims to normalized invited email',()=>{expect(invitationEmailMatches('Person@Example.com',' person@example.com ')).toBe(true);expect(invitationEmailMatches('person@example.com','other@example.com')).toBe(false)});
 it('keeps seller minimum THB 350000',()=>{expect(COMPLETION_FEE_MINIMUM_THB).toBe(350000)});
});
