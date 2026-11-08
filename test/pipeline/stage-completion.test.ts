import {describe,it,expect} from 'vitest';
import {optionalStageComplete,paymentConfirmationPending} from '../../src/lib/pipeline-report-state';
import {currentStep} from '../../src/lib/pipeline-state';
import type {PipelineRow} from '../../src/lib/pipeline.functions';
import type {DealWorkflow} from '../../src/lib/loi-workflow';
const w=(values:Partial<DealWorkflow>):DealWorkflow=>({choices:{},receipts:{},payment:{},...values});
const p=(workflow:DealWorkflow,accepted:string|null='2026-11-08')=>({ndaApprovedAt:'2026-11-08',loiAcceptedAt:accepted,paymentAt:null,workflow} as PipelineRow);
describe('Side-specific completed stages',()=>{
 it('Not needed completes only the side choosing it',()=>{const d=p(w({choices:{buyer:{valuation:{value:'none',at:'2026-11-08',locked:true}}}}));expect(optionalStageComplete(d,false,'valuation')).toBe(true);expect(optionalStageComplete(d,true,'valuation')).toBe(false);});
 it('choices do not complete stages before LOI acceptance',()=>expect(optionalStageComplete(p(w({choices:{buyer:{legal:{value:'none',at:null,locked:true}}}}),null),false,'legal')).toBe(false));
 it('a receipt completes only its side valuation',()=>{const d=p(w({receipts:{seller:{at:'2026-11-08',fileName:null}}}));expect(optionalStageComplete(d,true,'valuation')).toBe(true);expect(optionalStageComplete(d,false,'valuation')).toBe(false);});
 it('Legal needs own selected lawyer and bilateral SPA signature',()=>{const workflow=w({choices:{buyer:{legal:{value:'own',at:null,locked:true}}},spaDraftedAt:'2026-11-08'});expect(optionalStageComplete(p(workflow),false,'legal')).toBe(false);workflow.spaSignedAt='2026-11-08';expect(optionalStageComplete(p(workflow),false,'legal')).toBe(true);expect(optionalStageComplete(p(workflow),true,'legal')).toBe(false);});
 it('Not needed completes Legal without SPA',()=>expect(optionalStageComplete(p(w({choices:{seller:{legal:{value:'none',at:null,locked:true}}}})),true,'legal')).toBe(true));
 it('both payment confirmations keep Deal Support current at step 4',()=>expect(currentStep(p(w({payment:{buyer:'2026-11-08',seller:'2026-11-08'}})))).toBe(3));
 it('payment pulses only for the confirmed side until actual completion',()=>{const d=p(w({payment:{buyer:'2026-11-08'}}));expect(paymentConfirmationPending(d,false)).toBe(true);expect(paymentConfirmationPending(d,true)).toBe(false);d.paymentAt='2026-11-08';expect(paymentConfirmationPending(d,false)).toBe(false);});
 it('payment confirmation never pulses before acceptance',()=>expect(paymentConfirmationPending(p(w({payment:{buyer:'2026-11-08'}}),null),false)).toBe(false));
});