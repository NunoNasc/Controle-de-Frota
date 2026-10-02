import {PrismaClient,Prisma} from '@prisma/client';
import assert from 'node:assert/strict';
import type {InspectionItem} from '../src/lib/driver-inspection';
import {processChecklistCriticality} from '../src/lib/process-checklist-criticality';
const db=new PrismaClient();const rollback=new Error('ROLLBACK_TEST');
async function main(){
 try{await db.$transaction(async tx=>{
  const vehicle=await tx.vehicle.create({data:{plate:`QA${crypto.randomUUID()}`,model:'Teste transacional',category:'Teste',year:2020,status:'AVAILABLE',availability:'AVAILABLE'}});
  const rules:InspectionItem[]=[];
  for(const priority of ['LOW','MEDIUM','HIGH','CRITICAL'] as const)for(const generatesIncident of [false,true])for(const blocksVehicle of [false,true])rules.push({id:`${priority}-${generatesIncident}-${blocksVehicle}`,label:`Item ${priority}`,help:'',group:'Teste',category:'OTHER',priority,problems:['Problema configurado'],requiresPhoto:false,generatesIncident,blocksVehicle,allowsNotApplicable:false});
  const record=await tx.checklist.create({data:{vehicleId:vehicle.id,driverName:'Validação transacional',mileage:0,submissionKey:crypto.randomUUID(),configVersion:'a'.repeat(64),result:'ISSUE',hasProblem:true,answers:{create:rules.map(r=>({item:r.id,itemLabel:r.label,categoryLabel:r.group,answer:'ISSUE',problemType:r.problems[0],notes:'Texto original preservado',priority:r.priority,incidentRule:r.generatesIncident,generatesIncident:r.generatesIncident,blocksVehicle:r.blocksVehicle}))}},include:{answers:true}});
  await processChecklistCriticality(tx,record,vehicle,rules);
  const evaluations=await tx.checklistEvaluation.findMany({where:{answer:{checklistId:record.id}},include:{answer:true,incident:true,alert:true}});
  assert.equal(evaluations.length,16);assert.equal(evaluations.filter(e=>e.incident).length,8);
  for(const e of evaluations){const r=rules.find(r=>r.id===e.answer.item)!;assert.equal(e.priority,r.priority);assert.equal(e.incident?.priority??r.priority,r.priority);assert.equal(e.alert?.priority,r.priority);assert.equal(e.createsIncident,r.generatesIncident);assert.equal(!!e.incident,r.generatesIncident);assert.equal(e.blocksVehicle,r.blocksVehicle);assert.equal(e.vehicleStatusBefore,'AVAILABLE');assert.equal(e.vehicleStatusAfter,'STOPPED');assert.equal(e.answer.notes,'Texto original preservado');assert.equal(e.answer.answer,'ISSUE');assert.equal(e.answer.incidentId,e.incidentId);assert.equal(e.alert?.createdAt.getTime(),e.evaluatedAt.getTime());if(e.incident)assert.equal(e.incident.openedAt.getTime(),e.evaluatedAt.getTime());}
  assert.equal((await tx.vehicle.findUniqueOrThrow({where:{id:vehicle.id}})).status,'STOPPED');
  // Reprocessing never duplicates records; direct availability edits cannot bypass active restrictions.
  await tx.vehicle.update({where:{id:vehicle.id},data:{status:'AVAILABLE',availability:'AVAILABLE'}});
  await processChecklistCriticality(tx,record,vehicle,rules);
  assert.equal(await tx.checklistEvaluation.count({where:{answer:{checklistId:record.id}}}),16);assert.equal(await tx.incident.count({where:{checklistId:record.id}}),8);assert.equal(await tx.alert.count({where:{vehicleId:vehicle.id}}),16);assert.equal((await tx.vehicle.findUniqueOrThrow({where:{id:vehicle.id}})).status,'STOPPED');
  const plain=await tx.checklist.create({data:{vehicleId:vehicle.id,driverName:'Teste OK',mileage:0,submissionKey:crypto.randomUUID(),configVersion:'a'.repeat(64),result:'OK',answers:{create:rules.slice(0,1).map(r=>({item:r.id,answer:'OK'}))}},include:{answers:true}});
  await processChecklistCriticality(tx,plain,vehicle,rules);assert.equal(await tx.checklistEvaluation.count({where:{answer:{checklistId:plain.id}}}),0);
  await assert.rejects(tx.checklistAnswer.delete({where:{id:record.answers[0].id}}),e=>e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2003'||e instanceof Error&&e.message.includes('ChecklistEvaluation_answerId_fkey')&&e.message.includes('violates RESTRICT'));
  throw rollback;
 },{timeout:30000});}catch(e){if(e!==rollback)throw e;}
 console.log('PASS: 16 combinações de criticidade/ocorrência/bloqueio, alertas inclusive sem ocorrência, rastreabilidade, timestamps, respostas preservadas, reprocessamento idempotente e OK sem efeitos. Tudo revertido.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>db.$disconnect());
