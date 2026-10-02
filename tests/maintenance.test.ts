import {test} from 'node:test';
import assert from 'node:assert/strict';
import {maintenanceAlertState,elapsedLabel,validateMaintenance,maintenanceSchema,type MaintenanceClock} from '../src/lib/maintenance';
const now=new Date('2026-09-29T12:00:00Z');
const ago=(hours:number)=>new Date(now.getTime()-hours*3600000);
const clock:MaintenanceClock={stage:'REQUESTED',stageChangedAt:ago(48),scheduledAt:null,expectedAt:null,unavailableFrom:null,unavailableUntil:null,alertAfterHours:48,criticalAfterHours:120};
test('alertas respeitam limites exatos e programação futura',()=>{
 assert.equal(maintenanceAlertState({...clock,stageChangedAt:ago(47.99)},now),null);
 assert.equal(maintenanceAlertState(clock,now)?.priority,'MEDIUM');
 assert.equal(maintenanceAlertState({...clock,stageChangedAt:ago(120)},now)?.priority,'CRITICAL');
 assert.equal(maintenanceAlertState({...clock,stage:'SCHEDULED',scheduledAt:ago(-24)},now),null);
 assert.equal(maintenanceAlertState({...clock,stageChangedAt:now,expectedAt:ago(1)},now)?.priority,'HIGH');
 assert.equal(maintenanceAlertState({...clock,stage:'DONE'},now),null);
});
test('indisponibilidade tem relógio próprio e encerramento congela período',()=>{
 assert.equal(elapsedLabel(null,null,now),'Não registrada');
 assert.equal(elapsedLabel(ago(50),ago(1),now),'2 d 1 h');
 assert.equal(maintenanceAlertState({...clock,stageChangedAt:now,unavailableFrom:ago(120)},now)?.priority,'CRITICAL');
 assert.equal(maintenanceAlertState({...clock,stageChangedAt:now,unavailableFrom:ago(120),unavailableUntil:ago(1)},now),null);
});
test('entrada, responsável, solução e datas são obrigatórios conforme etapa',()=>{
 const input=maintenanceSchema.parse({submissionKey:crypto.randomUUID(),operatorName:'Analista',operatorId:'QA',vehicleId:'vehicle',kind:'PREDICTIVE',stage:'REQUESTED',title:'Inspeção técnica',serviceOrder:null,incidentId:null,requisitionId:null,purchaseOrderId:null,supplierId:null,responsibleId:null,budget:null,approvedAmount:null,cost:null,mileage:null,enteredAt:null,scheduledAt:null,expectedAt:null,unavailableFrom:null,completedAt:null,alertAfterHours:48,criticalAfterHours:120});
 assert.doesNotThrow(()=>validateMaintenance(input,now));
 assert.throws(()=>validateMaintenance({...input,stage:'SCHEDULED'},now),/programação/);
 assert.throws(()=>validateMaintenance({...input,stage:'IN_SERVICE'},now),/entrada/);
 assert.throws(()=>validateMaintenance({...input,enteredAt:ago(2).toISOString(),stage:'IN_SERVICE'},now),/responsável/);
 assert.throws(()=>validateMaintenance({...input,unavailableFrom:ago(1).toISOString()},now),/entrada/);
 assert.throws(()=>validateMaintenance({...input,stage:'DONE',enteredAt:ago(2).toISOString(),responsibleId:'staff'},now),/solução/);
 assert.throws(()=>validateMaintenance({...input,enteredAt:ago(-1).toISOString()},now),/futuro/);
 assert.equal(maintenanceSchema.safeParse({...input,cost:1.123}).success,false);
});
