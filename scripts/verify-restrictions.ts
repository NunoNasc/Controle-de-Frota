import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {PrismaClient} from '@prisma/client';
import {chromium,expect} from '@playwright/test';
import {processChecklistCriticality} from '../src/lib/process-checklist-criticality';
import type {InspectionItem} from '../src/lib/driver-inspection';
import {restrictionPolicyKey} from '../src/lib/restrictions';
import {getVehicleTimeline} from '../src/lib/vehicle-timeline';
async function main(){
 const db=new PrismaClient();const base='http://127.0.0.1:3000';const tag=`QA-${crypto.randomUUID()}`;
 const before=JSON.stringify(await db.vehicle.findMany({orderBy:{id:'asc'}}));const originalPolicy=await db.setting.findUniqueOrThrow({where:{key:restrictionPolicyKey}});
 const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(45000);await page.emulateMedia({reducedMotion:'reduce'});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});let vehicleId:string|undefined;
 try{
  await db.setting.update({where:{key:restrictionPolicyKey},data:{value:{initialState:'AWAITING_ASSESSMENT',releaseEvidenceRequired:true}}});
  const vehicle=await db.vehicle.create({data:{plate:'ZZZ7Z77',model:'Validação de restrições',category:'Teste',year:2020,status:'AVAILABLE',availability:'AVAILABLE'}});vehicleId=vehicle.id;
  const rules:InspectionItem[]=[true,false].map((generatesIncident,n)=>({id:`${tag}-${n}`,label:n?'Direção':'Freio',help:'',group:'Teste',category:'SAFETY',priority:'CRITICAL',problems:['Falha'],requiresPhoto:false,generatesIncident,blocksVehicle:true,allowsNotApplicable:false}));
  const create=()=>db.$transaction(async tx=>{const c=await tx.checklist.create({data:{vehicleId:vehicle.id,driverName:'Motorista QA',mileage:10,submissionKey:crypto.randomUUID(),configVersion:'a'.repeat(64),result:'ISSUE',hasProblem:true,answers:{create:rules.map(r=>({item:r.id,itemLabel:r.label,answer:'ISSUE',priority:r.priority,problemType:'Falha',notes:'Original preservado'}))}},include:{answers:true}});await processChecklistCriticality(tx,c,await tx.vehicle.findUniqueOrThrow({where:{id:vehicle.id}}),rules);return c;});
  const checklist=await create();let restrictions=await db.vehicleRestriction.findMany({where:{vehicleId},orderBy:{reason:'asc'}});assert.equal(restrictions.length,2);assert.ok(restrictions.every(r=>r.state==='AWAITING_ASSESSMENT'&&r.releaseEvidenceRequired));
  const originals=JSON.stringify(await db.checklistAnswer.findMany({where:{checklistId:checklist.id},orderBy:{id:'asc'}}));
  await db.vehicle.update({where:{id:vehicle.id},data:{status:'AVAILABLE',availability:'AVAILABLE',operationalStatus:'CLEAR'}});
  assert.equal((await db.vehicle.findUniqueOrThrow({where:{id:vehicle.id}})).status,'STOPPED');
  assert.equal((await db.vehicle.findUniqueOrThrow({where:{id:vehicle.id}})).operationalStatus,'AWAITING_ASSESSMENT');
  await page.goto(`${base}/frota/${vehicle.id}`);await expect(page.getByText('VEÍCULO COM RESTRIÇÃO OPERACIONAL',{exact:true})).toBeVisible({timeout:45000});
  await mkdir('test-results',{recursive:true});
  for(const width of [1440,768,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:`test-results/restrictions-${width}.png`,fullPage:true,caret:'initial'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Overflow ${width}`);}
  await page.goto(`${base}/checklist/${vehicle.qrToken}`);await expect(page.getByText('VEÍCULO COM RESTRIÇÃO OPERACIONAL',{exact:true})).toBeVisible({timeout:45000});assert.equal(await page.getByRole('navigation').count(),0);
  const first=restrictions.find(r=>r.incidentId)!;const second=restrictions.find(r=>!r.incidentId)!;
  const data=(revision:number,extra:object={})=>({operatorName:'Avaliador QA',operatorId:tag,revision,decision:'BLOCKED',notes:'Avaliação técnica de teste',...extra});
  const patch=(id:string,payload:object,origin=base)=>page.request.patch(`${base}/api/admin/restrictions/${id}`,{headers:{origin},data:payload});
  assert.equal((await patch(first.id,data(0),'https://invalid.example')).status(),403);
  for(const payload of [data(0,{operatorId:''}),data(0,{notes:''}),data(0,{decision:'RELEASED'}),data(0,{decision:'RELEASED',solution:'Reparo concluído'})])assert.equal((await patch(first.id,payload)).status(),400);
  const blocked=await patch(first.id,data(0));assert.equal(blocked.status(),200,await blocked.text());
  assert.equal((await db.vehicle.findUniqueOrThrow({where:{id:vehicle.id}})).operationalStatus,'BLOCKED');
  await db.incident.update({where:{id:first.incidentId!},data:{stage:'DONE',solution:'Ocorrência encerrada para validação'}});
  assert.equal((await db.vehicle.findUniqueOrThrow({where:{id:vehicle.id}})).operationalStatus,'BLOCKED');
  const oldEvents=await db.restrictionEvent.findMany({where:{restrictionId:first.id},orderBy:{id:'asc'}});
  await assert.rejects(db.restrictionEvent.update({where:{id:oldEvents[0].id},data:{notes:'Substituição indevida'}}),/append-only/);
  const pdf={fileName:'liberacao.pdf',mimeType:'application/pdf',base64:Buffer.from('%PDF-1.4\n%%EOF').toString('base64')};
  const release=await patch(first.id,data(1,{decision:'RELEASED',solution:'Reparo técnico aplicado',attachment:pdf,postReleaseStatus:'AVAILABLE'}));assert.equal(release.status(),200,await release.text());
  assert.equal((await db.vehicle.findUniqueOrThrow({where:{id:vehicle.id}})).operationalStatus,'AWAITING_ASSESSMENT');
  assert.equal((await db.vehicle.findUniqueOrThrow({where:{id:vehicle.id}})).availability,'UNAVAILABLE');
  const released=await db.vehicleRestriction.findUniqueOrThrow({where:{id:first.id}});assert.ok(released.releasedAt&&released.releasedAt>=released.detectedAt);
  assert.equal((await patch(first.id,data(2))).status(),400);
  assert.equal(JSON.stringify(await db.restrictionEvent.findMany({where:{id:{in:oldEvents.map(e=>e.id)}},orderBy:{id:'asc'}})),JSON.stringify(oldEvents));
  const file=await db.restrictionEvidence.findFirstOrThrow({where:{event:{restrictionId:first.id}}});const download=await page.request.get(`${base}/api/admin/restriction-evidence/${file.id}`);assert.equal(download.status(),200);assert.equal((await download.body()).toString(),'%PDF-1.4\n%%EOF');
  const maintenance=await db.maintenance.create({data:{vehicleId,title:tag,type:'Corretiva',scheduledAt:new Date()}});
  assert.equal((await patch(second.id,data(0,{decision:'RELEASED',solution:'Reparo concluído',attachment:pdf,postReleaseStatus:'AVAILABLE'}))).status(),400);
  // Real release form with mandatory evidence; keeps vehicle in maintenance.
  await page.goto(`${base}/frota/${vehicle.id}`);const form=page.locator('form').filter({has:page.getByRole('heading',{name:'Avaliar restrição',exact:true})});
  await form.getByLabel('Responsável pela avaliação / liberação').fill('Avaliador interface');await form.getByLabel('Matrícula / identificação').fill(tag);await form.getByLabel('Decisão').selectOption('RELEASED');await form.getByLabel('Solução aplicada').fill('Componente reparado e testado.');await form.getByLabel('Observação da avaliação').fill('Avaliação técnica registrada.');await form.getByLabel('Situação após a última liberação').selectOption('MAINTENANCE');await form.locator('input[type=file]').setInputFiles({name:'liberacao.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n%%EOF')});await form.getByRole('button',{name:'Registrar liberação',exact:true}).click();
  await expect(page.getByText('VEÍCULO COM RESTRIÇÃO OPERACIONAL',{exact:true})).toHaveCount(0,{timeout:45000});
  assert.equal((await db.vehicle.findUniqueOrThrow({where:{id:vehicle.id}})).status,'MAINTENANCE');
  const partialHistory=await getVehicleTimeline(vehicle.id,1,100);
  assert.ok(partialHistory.rows.some(e=>e.title==='Restrição liberada'));
  assert.equal(partialHistory.rows.some(e=>e.title==='Veículo liberado'),false);
  await db.maintenance.update({where:{id:maintenance.id},data:{status:'COMPLETED',completedAt:new Date()}});
  await db.$transaction(tx=>processChecklistCriticality(tx,checklist,vehicle,rules));assert.equal(await db.vehicleRestriction.count({where:{vehicleId}}),2);assert.equal((await db.vehicle.findUniqueOrThrow({where:{id:vehicle.id}})).operationalStatus,'CLEAR');
  const policy=await db.setting.findUniqueOrThrow({where:{key:restrictionPolicyKey}});
  const updatedPolicy=await page.request.put(`${base}/api/admin/restriction-policy`,{headers:{origin:base},data:{operatorName:'Administrador QA',operatorId:tag,updatedAt:policy.updatedAt.toISOString(),policy:{initialState:'BLOCKED',releaseEvidenceRequired:false}}});assert.equal(updatedPolicy.status(),200);
  assert.equal((await db.vehicleRestriction.findUniqueOrThrow({where:{id:first.id}})).releaseEvidenceRequired,true);
  const nextChecklist=await create();restrictions=await db.vehicleRestriction.findMany({where:{vehicleId,state:{not:'RELEASED'}}});assert.equal(restrictions.length,2);assert.ok(restrictions.every(r=>r.state==='BLOCKED'&&!r.releaseEvidenceRequired));
  const simultaneous=await Promise.all(restrictions.map(r=>patch(r.id,data(0,{decision:'RELEASED',solution:'Correção e teste concluídos',postReleaseStatus:'AVAILABLE'}))));assert.deepEqual(simultaneous.map(r=>r.status()).sort(),[200,409]);
  const pending=await db.vehicleRestriction.findFirstOrThrow({where:{vehicleId,state:{not:'RELEASED'}}});assert.equal((await patch(pending.id,data(pending.revision,{decision:'RELEASED',solution:'Correção e teste concluídos',postReleaseStatus:'AVAILABLE'}))).status(),200);
  const finalVehicle=await db.vehicle.findUniqueOrThrow({where:{id:vehicle.id}});assert.equal(finalVehicle.operationalStatus,'CLEAR');assert.equal(finalVehicle.status,'AVAILABLE');
  assert.equal((await getVehicleTimeline(vehicle.id,1,100)).rows.filter(e=>e.title==='Veículo liberado').length,1);
  await db.$transaction(tx=>processChecklistCriticality(tx,nextChecklist,finalVehicle,rules));assert.equal((await db.vehicle.findUniqueOrThrow({where:{id:vehicle.id}})).status,'AVAILABLE');
  assert.equal(JSON.stringify(await db.checklistAnswer.findMany({where:{checklistId:checklist.id},orderBy:{id:'asc'}})),originals);
  await page.goto(`${base}/configuracoes/restricoes`);await expect(page.getByRole('heading',{name:'Bloqueios e liberações',exact:true})).toBeVisible({timeout:45000});assert.deepEqual(errors,[]);
  console.log('PASS: bloqueio automático com/sem ocorrência, dois estados, aviso móvel sem menu, múltiplas restrições, avaliação, liberação obrigatória, evidência/download, manutenção, concorrência, configuração, histórico e respostas preservados, reprocessamento idempotente e 1440/768/390.');
 }finally{
  await browser.close();
  await db.$transaction(async tx=>{
   if(vehicleId){await tx.restrictionEvidence.deleteMany({where:{event:{restriction:{vehicleId}}}});await tx.restrictionEvent.deleteMany({where:{restriction:{vehicleId}}});await tx.vehicleRestriction.deleteMany({where:{vehicleId}});await tx.alertEvent.deleteMany({where:{alert:{vehicleId}}});await tx.alert.deleteMany({where:{vehicleId}});await tx.checklistEvaluation.deleteMany({where:{answer:{checklist:{vehicleId}}}});await tx.checklistAnswer.deleteMany({where:{checklist:{vehicleId}}});await tx.incidentEvent.deleteMany({where:{incident:{vehicleId}}});await tx.maintenanceEvent.deleteMany({where:{maintenance:{vehicleId}}});await tx.maintenance.deleteMany({where:{vehicleId}});await tx.incident.deleteMany({where:{vehicleId}});await tx.mileageReading.deleteMany({where:{vehicleId}});await tx.checklist.deleteMany({where:{vehicleId}});await tx.vehicle.delete({where:{id:vehicleId}});}
   await tx.restrictionPolicyEvent.deleteMany({where:{actor:{contains:tag}}});await tx.setting.update({where:{key:restrictionPolicyKey},data:{value:originalPolicy.value!,updatedAt:originalPolicy.updatedAt}});
  });
  assert.equal(JSON.stringify(await db.vehicle.findMany({orderBy:{id:'asc'}})),before);await db.$disconnect();
 }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
