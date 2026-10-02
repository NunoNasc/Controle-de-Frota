import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {PrismaClient} from '@prisma/client';
import {chromium,expect} from '@playwright/test';
async function main(){
 const db=new PrismaClient(),base='http://127.0.0.1:3000',tag=`QA-${crypto.randomUUID()}`;
 const original=JSON.stringify(await db.vehicle.findMany({orderBy:{id:'asc'}}));
 const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(45000);await page.emulateMedia({reducedMotion:'reduce'});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));let vehicleId:string|undefined,staffId:string|undefined;
 try{
  const v=await db.vehicle.create({data:{plate:'ZZZ6Z66',model:'Teste temporário manutenção',category:'Teste',year:2020,status:'AVAILABLE',availability:'AVAILABLE'}});vehicleId=v.id;
  const staff=await db.staffMember.create({data:{name:'Responsável QA',employeeId:tag}});staffId=staff.id;
  const incident=await db.incident.create({data:{vehicleId,title:tag,description:'Teste temporário'}});
  await page.goto(`${base}/manutencoes/nova?vehicle=${vehicleId}`);
  await page.getByLabel('Problema / serviço',{exact:true}).fill(tag);
  await page.getByLabel('Tipo',{exact:true}).selectOption('PREVENTIVE');
  await page.getByLabel('Ocorrência relacionada',{exact:true}).selectOption(incident.id);
  await page.getByLabel('Seu nome',{exact:true}).fill('Analista QA');await page.getByLabel('Sua matrícula / identificação',{exact:true}).fill(tag);
  await page.getByRole('button',{name:'Solicitar manutenção',exact:true}).click();
  await expect(page).toHaveURL(/\/manutencoes\/(?!nova)[^/]+$/,{timeout:45000});
  const initial=await db.maintenance.findFirstOrThrow({where:{vehicleId,title:tag}});
  assert.equal(initial.kind,'PREVENTIVE');assert.equal(initial.stage,'REQUESTED');assert.equal(initial.unavailableFrom,null);
  assert.equal((await db.vehicle.findUniqueOrThrow({where:{id:vehicleId}})).status,'AVAILABLE');
  const start=new Date(Date.now()-50*3600000).toISOString();
  let data={id:initial.id,revision:initial.revision,submissionKey:initial.submissionKey!,operatorName:'Analista QA',operatorId:tag,vehicleId,kind:'CORRECTIVE',stage:'ANALYSIS',title:tag,description:'Atendimento de teste',serviceOrder:tag,incidentId:incident.id,requisitionId:null,purchaseOrderId:null,supplierId:null,responsibleId:staff.id,budget:100,approvedAmount:90,cost:null,mileage:100,enteredAt:start,scheduledAt:null as string|null,expectedAt:null,unavailableFrom:start,completedAt:null,solution:'',note:'Registro de teste',alertAfterHours:48,criticalAfterHours:120};
  const post=(body:object,origin=base)=>page.request.post(`${base}/api/admin/maintenance`,{headers:{origin},data:body});
  assert.equal((await post(data,'https://invalid.example')).status(),403);
  let response=await post(data);assert.equal(response.status(),200,await response.text());data.revision=(await response.json()).revision;
  assert.equal((await post({...data,revision:0})).status(),409);
  assert.equal((await db.vehicle.findUniqueOrThrow({where:{id:vehicleId}})).status,'MAINTENANCE');
  assert.equal((await db.alert.findUniqueOrThrow({where:{maintenanceId:initial.id}})).priority,'MEDIUM');
  await db.vehicle.update({where:{id:vehicleId},data:{status:'AVAILABLE',availability:'AVAILABLE'}});
  assert.equal((await db.vehicle.findUniqueOrThrow({where:{id:vehicleId}})).availability,'UNAVAILABLE');
  await mkdir('test-results',{recursive:true});
  for(const view of ['table','kanban']){await page.goto(`${base}/manutencoes?q=${tag}&view=${view}`);await expect(page.getByRole('heading',{name:'Manutenções',exact:true})).toBeVisible();for(const width of [1440,768,390]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${view} overflow ${width}`);await page.screenshot({path:`test-results/maintenance-${view}-${width}.png`,fullPage:true,caret:'initial'});}}
  await page.goto(`${base}/manutencoes/${initial.id}`);await expect(page.getByText('Histórico da manutenção',{exact:true})).toBeVisible();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'detail mobile overflow');
  const restriction=await db.vehicleRestriction.create({data:{vehicleId,incidentId:incident.id,reason:'Teste de preservação de bloqueio',state:'BLOCKED',releaseEvidenceRequired:false}});
  for(const stage of ['AWAITING_QUOTE','AWAITING_APPROVAL','AWAITING_PART','SCHEDULED','IN_SERVICE','TESTING','DONE']){
   data={...data,stage,kind:stage==='TESTING'?'PREDICTIVE':data.kind,scheduledAt:stage==='SCHEDULED'?new Date().toISOString():data.scheduledAt,solution:stage==='DONE'?'Reparo e teste registrados':''};
   response=await post(data);assert.equal(response.status(),200,await response.text());data.revision=(await response.json()).revision;
  }
  const done=await db.maintenance.findUniqueOrThrow({where:{id:initial.id}});assert.equal(done.status,'COMPLETED');assert.ok(done.unavailableUntil);assert.equal(done.unavailableFrom?.toISOString(),start);
  assert.equal((await db.alert.findUniqueOrThrow({where:{maintenanceId:initial.id}})).status,'COMPLETED');
  assert.equal((await db.vehicle.findUniqueOrThrow({where:{id:vehicleId}})).status,'STOPPED');assert.equal((await db.vehicleRestriction.findUniqueOrThrow({where:{id:restriction.id}})).state,'BLOCKED');
  assert.equal((await post(data)).status(),400);
  const events=await db.maintenanceEvent.findMany({where:{maintenanceId:initial.id},orderBy:{createdAt:'asc'}});assert.equal(events.length,9);assert.ok(events.every(e=>e.actor.includes(tag)));assert.equal((events[0].after as {stage:string}).stage,'REQUESTED');
  await assert.rejects(db.maintenanceEvent.update({where:{id:events[0].id},data:{note:'Não deve sobrescrever'}}));
  const {id:_id,revision:_revision,...creation}=data;void _id;void _revision;
  const replayData={...creation,submissionKey:crypto.randomUUID(),serviceOrder:null,stage:'REQUESTED',unavailableFrom:null,enteredAt:null,solution:'',kind:'PREDICTIVE'};
  const a=await post(replayData),b=await post(replayData);assert.equal(a.status(),201);assert.equal((await a.json()).id,(await b.json()).id);
  const old=await db.maintenance.create({data:{vehicleId,title:`${tag}-atrasada`,type:'Corretiva',stageChangedAt:new Date(Date.now()-121*3600000)}});
  await page.goto(`${base}/alertas`);await expect(page.getByRole('heading',{name:'Central de Alertas',exact:true})).toBeVisible();assert.equal((await db.alert.findUniqueOrThrow({where:{maintenanceId:old.id}})).priority,'CRITICAL');
  await db.maintenance.update({where:{id:old.id},data:{status:'COMPLETED'}});assert.equal((await db.maintenance.findUniqueOrThrow({where:{id:old.id}})).stage,'DONE');
  assert.deepEqual(errors,[]);console.log('OK: cadastro UI, 9 etapas, 3 tipos, alertas, indisponibilidade, restrições, concorrência, idempotência, histórico e 3 larguras.');
 }finally{
  await browser.close();
  if(vehicleId)await db.$transaction(async tx=>{
   await tx.alertEvent.deleteMany({where:{alert:{vehicleId}}});await tx.alert.deleteMany({where:{vehicleId}});await tx.restrictionEvent.deleteMany({where:{restriction:{vehicleId}}});await tx.vehicleRestriction.deleteMany({where:{vehicleId}});await tx.maintenanceEvent.deleteMany({where:{maintenance:{vehicleId}}});await tx.maintenance.deleteMany({where:{vehicleId}});await tx.incidentEvent.deleteMany({where:{incident:{vehicleId}}});await tx.incident.deleteMany({where:{vehicleId}});await tx.vehicle.delete({where:{id:vehicleId}});if(staffId)await tx.staffMember.delete({where:{id:staffId}});
  });
  assert.equal(JSON.stringify(await db.vehicle.findMany({orderBy:{id:'asc'}})),original,'Frota original preservada');await db.$disconnect();
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
