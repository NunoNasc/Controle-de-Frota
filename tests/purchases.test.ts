import {test} from 'node:test';
import assert from 'node:assert/strict';
import {purchaseAge,purchaseStalled,purchaseSchema,validatePurchase} from '../src/lib/purchases';
const now=new Date('2026-09-30T12:00:00Z');
test('destaque usa períodos completos e não sinaliza status encerrados',()=>{
 const p={stage:'WAITING_SUPPLIER',stageChangedAt:new Date(now.getTime()-5*86400000),staleAfterDays:5};
 assert.equal(purchaseAge(p.stageChangedAt,now),5);assert.equal(purchaseStalled(p,now),true);
 assert.equal(purchaseStalled({...p,stageChangedAt:new Date(p.stageChangedAt.getTime()+1)},now),false);
 for(const stage of ['REJECTED','FINISHED','CANCELED'])assert.equal(purchaseStalled({...p,stage},now),false);
 assert.equal(purchaseAge(new Date(now.getTime()+1000),now),0);
});
const input=()=>purchaseSchema.parse({submissionKey:crypto.randomUUID(),stage:'PENDING',orderNumber:null,scNumber:null,description:'Peças para manutenção',vehicleId:null,equipmentId:null,supplierId:null,requesterId:'staff',responsibleId:null,amount:null,requestedAt:now.toISOString(),staleAfterDays:5,notes:'',incidentIds:[],maintenanceIds:[],operatorName:'Analista',operatorId:'QA',note:'Solicitação inicial'});
test('solicitação sem pedido é válida; geração exige número, fornecedor e valor',()=>{
 const p=input();assert.doesNotThrow(()=>validatePurchase(p,now));
 assert.throws(()=>validatePurchase({...p,stage:'ORDERED'},now),/número/);
 assert.doesNotThrow(()=>validatePurchase({...p,stage:'ORDERED',orderNumber:'PC-1',supplierId:'supplier',amount:0},now));
 assert.equal(purchaseSchema.safeParse({...p,amount:10.001}).success,false);
 assert.throws(()=>validatePurchase({...p,requesterId:null},now),/solicitante/);
});
test('datas futuras e vínculos incoerentes são rejeitados',()=>{
 const p=input();assert.throws(()=>validatePurchase({...p,requestedAt:'2026-10-01T00:00:00Z'},now),/futura/);
 assert.throws(()=>validatePurchase({...p,vehicleId:'v',equipmentId:'e'},now),/ambos/);
 assert.throws(()=>validatePurchase({...p,incidentIds:['i']},now),/veículo/);
 assert.throws(()=>validatePurchase({...p,vehicleId:'v',incidentIds:['i','i']},now),/duplicados/);
});
