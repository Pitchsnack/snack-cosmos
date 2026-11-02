import {describe,it,expect} from 'vitest';
import {REPORT_MIN_WIDTH} from '../src/components/reports/report-scroll';

describe('report sideways scroll',()=>{
 it('keeps every report body at least 1040px wide so the layout never squeezes',()=>{
  expect(REPORT_MIN_WIDTH).toBe(1040);
 });
});
