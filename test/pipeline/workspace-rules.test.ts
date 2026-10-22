import {describe,it,expect} from 'vitest';
import {pipelineCounts,pipelineStep,waitingDays,pipelineOpen} from '../../src/lib/pipeline-pages';
import {waitState} from '../../src/lib/pipeline-state';
import type {PipelineRow} from '../../src/lib/pipeline.functions';
const row=(extra:Partial<PipelineRow>={}):PipelineRow=>({id:'request-1',status:'active',ndaRequestedAt:'2026-10-01T00:00:00Z',ndaApprovedAt:null,updatedAt:'2026-10-01T00:00:00Z',reportSharedAt:null,loiAcceptedAt:null,contactAt:null,legalAt:null,spaAt:null,paymentAt:null,...extra} as PipelineRow);
describe('Pipeline workspace rules',()=>{
 it('pending NDA requests are step one',()=>expect(pipelineStep(row())).toBe(0));
 it('pending NDAs wait on the seller not the buyer',()=>{expect(waitState(row(),true).onYou).toBe(true);expect(waitState(row(),false).onYou).toBe(false);});
 it('All deals includes pending NDAs',()=>expect(pipelineCounts([row()],[],false).all).toBe(1));
 it('ended deals leave open counts and starred watchlist',()=>expect(pipelineCounts([row({status:'ended'})],['request-1'],true)).toEqual({all:0,watch:0,you:0,history:1}));
 it('a star survives approval using the same request ID',()=>{expect(pipelineCounts([row({ndaApprovedAt:'2026-10-02'})],['request-1'],false).watch).toBe(1);});
 it('another user without the star has no watched deal',()=>expect(pipelineCounts([row()],[],false).watch).toBe(0));
 it('the 14-day wait is measured in whole days',()=>expect(waitingDays(row(),Date.parse('2026-10-15T00:00:00Z'))).toBe(14));
 it('completed steps stay within the seven step boxes',()=>expect(pipelineStep(row({ndaApprovedAt:'x',reportSharedAt:'x',loiAcceptedAt:'x',contactAt:'x',legalAt:'x',spaAt:'x',paymentAt:'x'}))).toBe(6));
 it('declined and withdrawn requests leave All deals',()=>{expect(pipelineOpen(row({status:'declined'}))).toBe(false);expect(pipelineOpen(row({status:'withdrawn'}))).toBe(false);});
});
