import {describe,expect,it} from 'vitest';
import {showPipelineReviewAlert} from '../../src/components/pipeline/review-alert-host';

describe('shared Pipeline review alert access',()=>{
 it('shows for a seller throughout the signed-in app',()=>{expect(showPipelineReviewAlert(false,'seller','seller')).toBe(true);});
 it('shows for a buyer throughout the signed-in app',()=>{expect(showPipelineReviewAlert(false,'buyer','buyer')).toBe(true);});
 it('shows for Control in a seller or buyer Marketplace view',()=>{expect(showPipelineReviewAlert(true,null,'seller')).toBe(true);expect(showPipelineReviewAlert(true,null,'buyer')).toBe(true);});
 it('stays out of the Admin area for Control',()=>{expect(showPipelineReviewAlert(false,null,'seller')).toBe(false);expect(showPipelineReviewAlert(false,null,'buyer')).toBe(false);});
 it('never shows for advisors',()=>{expect(showPipelineReviewAlert(true,'advisor','advisor')).toBe(false);expect(showPipelineReviewAlert(true,null,'advisor')).toBe(false);});
});
