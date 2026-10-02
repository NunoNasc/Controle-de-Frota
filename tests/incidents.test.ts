import test from 'node:test';
import assert from 'node:assert/strict';
import {incidentUpdateSchema,validateIncidentTransition,decodeIncidentAttachment,incidentStages,openTime} from '../src/lib/incidents';
const raw={revision:0,operatorName:'Operador Teste',operatorId:'QA',stage:'NEW',priority:'MEDIUM',responsibleId:null,dueAt:null,supplierId:null,requisitionId:null,purchaseOrderId:null,maintenanceIds:[]};
const previous={priority:'MEDIUM',stage:'NEW',openedAt:new Date('2026-01-01T10:00:00Z')};
test('13 status suportados e identificação obrigatória',()=>{
 assert.equal(Object.keys(incidentStages).length,13);
 for(const stage of Object.keys(incidentStages))assert.equal(incidentUpdateSchema.safeParse({...raw,stage}).success,true);
 assert.equal(incidentUpdateSchema.safeParse({...raw,operatorName:''}).success,false);
 assert.equal(incidentUpdateSchema.safeParse({...raw,operatorId:''}).success,false);
 assert.equal(incidentUpdateSchema.safeParse({...raw,stage:'OPEN'}).success,false);
});
test('criticidade exige justificativa, encerramento exige solução e reabertura exige motivo',()=>{
 assert.throws(()=>validateIncidentTransition(previous,incidentUpdateSchema.parse({...raw,priority:'LOW'})),/criticidade/);
 assert.doesNotThrow(()=>validateIncidentTransition(previous,incidentUpdateSchema.parse({...raw,priority:'LOW',justification:'Inspeção confirmou falha estética.'})));
 for(const stage of ['RELEASED','DONE','REJECTED','VOID'])assert.throws(()=>validateIncidentTransition(previous,incidentUpdateSchema.parse({...raw,stage})),/solução/);
 assert.throws(()=>validateIncidentTransition({...previous,stage:'DONE'},incidentUpdateSchema.parse(raw)),/reabrir/);
 assert.throws(()=>validateIncidentTransition(previous,incidentUpdateSchema.parse({...raw,dueAt:'2025-01-01T10:00:00Z'})),/prazo/);
});
test('anexo rejeita conteúdo disfarçado e tamanho excessivo',()=>{
 assert.throws(()=>decodeIncidentAttachment({mimeType:'application/pdf',base64:Buffer.from('<script>alert(1)</script>').toString('base64')}),/Anexo/);
 assert.throws(()=>decodeIncidentAttachment({mimeType:'application/pdf',base64:Buffer.concat([Buffer.from('%PDF-'),Buffer.alloc(5*1024*1024)]).toString('base64')}),/Anexo/);
 assert.equal(decodeIncidentAttachment({mimeType:'application/pdf',base64:Buffer.from('%PDF-1.4\n%%EOF').toString('base64')}).length,14);
});
test('tempo aberto para de contar no encerramento',()=>{
 assert.equal(openTime('2026-01-01T00:00:00Z','2026-01-02T02:00:00Z',Date.now()),'1 d 2 h');
 assert.equal(openTime('2026-01-01T00:00:00Z',null,new Date('2026-01-01T00:03:00Z').getTime()),'3 min');
});
