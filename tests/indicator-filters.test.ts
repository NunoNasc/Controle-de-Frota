import test from 'node:test';
import assert from 'node:assert/strict';
import {indicatorFilters,durationHours,percent} from '../src/lib/indicator-filters';
const now=new Date('2026-10-01T02:00:00Z');
test('período respeita calendário Bahia e fim inclusivo sem avançar além de agora',()=>{
 const f=indicatorFilters({},now);assert.equal(f.to,'2026-09-30');assert.equal(f.from,'2026-09-01');assert.equal(f.end.toISOString(),now.toISOString());
 const day=indicatorFilters({from:'2026-09-10',to:'2026-09-10'},now);assert.equal(day.start.toISOString(),'2026-09-10T03:00:00.000Z');assert.equal(day.end.toISOString(),'2026-09-11T03:00:00.000Z');
});
test('datas impossíveis, invertidas e futuras não viram outro período silenciosamente',()=>{
 for(const params of [{from:'2026-02-30'},{from:'2026-09-20',to:'2026-09-10'},{to:'2026-10-01'}])assert.equal(indicatorFilters(params,now).valid,false);
 assert.equal(percent(null),'Sem base');assert.equal(durationHours(null),'Sem base');assert.equal(durationHours(0),'0 min');
});
