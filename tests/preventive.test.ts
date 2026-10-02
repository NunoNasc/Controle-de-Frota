import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preventiveState,nextPreventiveMileage,preventiveSchema} from '../src/lib/preventive';
import {buildDashboard,defaultFilters} from '../src/lib/dashboard-domain';
const now=new Date('2026-09-29T12:00:00Z');
const plan={nextMileage:50000,dueAt:null,toleranceKm:500,toleranceDays:2,upcomingKm:1500,upcomingDays:7};
test('quatro estados, limites inclusivos e tolerância configurável por KM',()=>{
 assert.equal(preventiveState(plan,48000,now).status,'CURRENT');
 assert.equal(preventiveState(plan,48500,now).status,'UPCOMING');
 assert.equal(preventiveState(plan,48750,now).remainingKm,1250);
 assert.equal(preventiveState(plan,50000,now).status,'ATTENTION');
 assert.equal(preventiveState(plan,50499,now).status,'ATTENTION');
 assert.equal(preventiveState(plan,50500,now).status,'OVERDUE');
 assert.equal(preventiveState({...plan,toleranceKm:0},50000,now).status,'OVERDUE');
 assert.equal(preventiveState(plan,null,now).status,'UNKNOWN');
});
test('datas usam calendário da Bahia, inclusive data prevista, e o pior critério prevalece',()=>{
 assert.equal(preventiveState({...plan,dueAt:'2026-09-29T03:00:00Z'},48000,now).status,'ATTENTION');
 assert.equal(preventiveState({...plan,dueAt:'2026-09-28T03:00:00Z'},48000,now).status,'ATTENTION');
 assert.equal(preventiveState({...plan,dueAt:'2026-09-27T03:00:00Z'},48000,now).status,'OVERDUE');
 assert.equal(preventiveState({...plan,dueAt:'2026-10-10T03:00:00Z'},50500,now).status,'OVERDUE');
 assert.equal(preventiveState({...plan,dueAt:'2026-09-29T03:00:00Z',toleranceDays:0},null,new Date('2026-09-30T02:59:59Z')).status,'ATTENTION');
 assert.equal(preventiveState({...plan,dueAt:'2026-09-29T03:00:00Z',toleranceDays:0},null,new Date('2026-09-30T03:00:00Z')).status,'OVERDUE');
});
test('próximo KM calculado não usa valor manual quando última preventiva é conhecida',()=>{
 assert.equal(nextPreventiveMileage(40000,10000,999),50000);assert.equal(nextPreventiveMileage(null,10000,50000),50000);
 assert.equal(preventiveSchema.safeParse({intervalKm:0}).success,false);
});
test('dashboard incorpora plano, não duplica alerta e respeita tolerância',()=>{
 const input={vehicles:[{id:'v',plate:'QTO6479',code:null,model:'Veículo',active:true,status:'UNKNOWN' as const,availability:'UNKNOWN',mileage:50500,costCenterId:null,costCenterName:null}],incidents:[],alerts:[{id:'a',vehicleId:'v',preventivePlanId:'p',title:'Preventiva vencida',priority:'HIGH' as const,status:'OPEN' as const,createdAt:now}],checklists:[],preventives:[],maintenance:[],documents:[],plans:[{...plan,id:'p',vehicleId:'v'}]};
 const d=buildDashboard(input,defaultFilters,now);assert.equal(d.counts.vencidas,1);assert.equal(d.actions.length,1);assert.equal(d.planIndicators.OVERDUE,1);
 const upcoming=buildDashboard({...input,vehicles:[{...input.vehicles[0],mileage:48750}],alerts:[]},defaultFilters,now);assert.equal(upcoming.views.proximas.length,1);assert.match(upcoming.views.proximas[0].detail,/1.250 km/);assert.equal(upcoming.actions.length,0);
});
