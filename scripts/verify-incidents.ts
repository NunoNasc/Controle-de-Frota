import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import {PrismaClient} from '@prisma/client';
import {processChecklistCriticality} from '../src/lib/process-checklist-criticality';
import type {InspectionItem} from '../src/lib/driver-inspection';
import {incidentStages} from '../src/lib/incidents';

async function main(){
 const db=new PrismaClient();const base='http://127.0.0.1:3000';const tag=`QA-${crypto.randomUUID()}`;
 const originalFleet=JSON.stringify(await db.vehicle.findMany({orderBy:{id:'asc'}}));
 const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(45000);await page.emulateMedia({reducedMotion:"reduce"});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});let vehicleId:string|undefined;let supplierId:string|undefined;let requisitionId:string|undefined;let orderId:string|undefined;let staffId:string|undefined;
 try{
  const vehicle=await db.vehicle.create({data:{plate:tag,model:'Validação de ocorrências',year:2020,category:'Teste',status:'AVAILABLE',availability:'AVAILABLE'}});vehicleId=vehicle.id;
  const rule:InspectionItem={id:tag,label:'Freio',help:'',group:'Freios',category:'BRAKES',priority:'CRITICAL',problems:['Sem funcionamento'],requiresPhoto:false,generatesIncident:true,blocksVehicle:true,allowsNotApplicable:false};
  const checklist=await db.$transaction(async tx=>{
   const c=await tx.checklist.create({data:{vehicleId:vehicle.id,driverName:'Motorista de teste',mileage:10,submissionKey:tag,configVersion:'a'.repeat(64),result:'ISSUE',hasProblem:true,answers:{create:{item:tag,itemLabel:'Freio',categoryLabel:'Freios',answer:'ISSUE',priority:'CRITICAL',problemType:'Sem funcionamento',notes:'Resposta preservada',generatesIncident:true}}},include:{answers:true}});
   await processChecklistCriticality(tx,c,vehicle,[rule]);return c;
  });
  let incident=await db.incident.findFirstOrThrow({where:{checklistId:checklist.id}});
  assert.match(incident.publicNumber,/^OC-\d{4}-\d{6,}$/);assert.equal(incident.stage,'NEW');
  assert.deepEqual((await db.incidentEvent.findMany({where:{incidentId:incident.id},select:{kind:true}})).map(e=>e.kind).sort(),['CHECKLIST','CREATED','DETECTED']);
  const answerBefore=JSON.stringify(await db.checklistAnswer.findUniqueOrThrow({where:{id:checklist.answers[0].id}}));
  // Counter serialization, annual boundary in Bahia, and isolated audit actor.
  const parallel=await Promise.all(Array.from({length:5},(_,n)=>db.incident.create({data:{vehicleId:vehicle.id,title:`${tag}-${n}`,description:'Validação de concorrência',openedAt:new Date('2098-07-01T12:00:00Z')}})));
  assert.equal(new Set(parallel.map(i=>i.publicNumber)).size,5);assert.ok(parallel.every(i=>i.publicNumber.startsWith('OC-2098-')));
  const boundary=await db.incident.create({data:{vehicleId:vehicle.id,title:tag,description:'Virada do ano',openedAt:new Date('2099-01-01T01:00:00Z')}});assert.match(boundary.publicNumber,/^OC-2098-/);
  supplierId=(await db.supplier.create({data:{name:tag,taxId:tag,specialty:'Teste',phone:'000'}})).id;
  requisitionId=(await db.purchaseRequisition.create({data:{number:tag,description:'Teste'}})).id;
  orderId=(await db.purchaseOrder.create({data:{number:tag,description:'Teste',amount:1,vehicleId,supplierId,requisitionId}})).id;
  const maintenance=await db.maintenance.create({data:{vehicleId,title:tag,type:'Corretiva',scheduledAt:new Date(),serviceOrder:tag}});
  const payload=(extra:Record<string,unknown>={})=>({revision:incident.revision,operatorName:'Analista de teste',operatorId:tag,stage:incident.stage,priority:incident.priority,responsibleId:incident.responsibleId,dueAt:null,supplierId:incident.supplierId,requisitionId:incident.requisitionId,purchaseOrderId:incident.purchaseOrderId,maintenanceIds:[],solution:incident.solution??'',...extra});
  const patch=(data:object,origin=base)=>page.request.patch(`${base}/api/admin/incidents/${incident.id}`,{headers:{origin},data});
  assert.equal((await patch(payload({comment:'Teste'}),'https://invalid.example')).status(),403);
  assert.equal((await patch(payload({operatorId:''}))).status(),400);
  assert.equal((await patch(payload({priority:'LOW'}))).status(),400);
  assert.equal((await patch(payload({stage:'DONE'}))).status(),400);
  assert.equal((await patch(payload({supplierId:'missing'}))).status(),400);
  const pdf=Buffer.from('%PDF-1.4\n%%EOF');
  const first=await patch(payload({stage:'ANALYSIS',priority:'HIGH',justification:'Inspeção confirmou falha parcial.',newResponsible:{name:'Responsável QA',employeeId:tag},supplierId,requisitionId,purchaseOrderId:orderId,maintenanceIds:[maintenance.id],comment:'Encaminhado para análise técnica.',dueAt:new Date(Date.now()+86400000).toISOString(),attachment:{fileName:'evidencia.pdf',mimeType:'application/pdf',base64:pdf.toString('base64')}}));
  assert.equal(first.status(),200,await first.text());
  assert.equal((await patch(payload({comment:'Gravação desatualizada'}))).status(),409);
  incident=await db.incident.findUniqueOrThrow({where:{id:incident.id}});staffId=incident.responsibleId!;
  assert.equal(incident.status,'IN_PROGRESS');assert.equal(incident.revision,1);
  assert.equal((await db.maintenance.findUniqueOrThrow({where:{id:maintenance.id}})).incidentId,incident.id);
  const firstEvents=await db.incidentEvent.findMany({where:{incidentId:incident.id},orderBy:{id:'asc'}});const beforeHistory=JSON.stringify(firstEvents); assert.ok(firstEvents.filter(e=>e.kind==="UPDATED").every(e=>e.createdAt>=incident.openedAt),"Audit timestamps must be UTC");
  assert.ok(firstEvents.filter(e=>e.kind==='UPDATED').every(e=>e.actor.includes(tag)));
  const attachment=await db.incidentAttachment.findFirstOrThrow({where:{incidentId:incident.id}});
  const download=await page.request.get(`${base}/api/admin/incident-attachments/${attachment.id}`);assert.equal(download.status(),200);assert.deepEqual(await download.body(),pdf);assert.equal(download.headers()['x-content-type-options'],'nosniff');
  await assert.rejects(db.incidentEvent.update({where:{id:firstEvents[0].id},data:{note:'Sobrescrita'}}),/append-only/);
  await page.goto(`${base}/ocorrencias?q=${encodeURIComponent(incident.publicNumber)}`);await expect(page.getByRole('link',{name:incident.publicNumber,exact:true})).toBeVisible({timeout:45000});await page.getByRole('link',{name:'Atender →',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Timeline da ocorrência'})).toBeVisible({timeout:45000});await expect(page.getByText('Encaminhado para análise técnica.',{exact:true})).toBeVisible({timeout:45000});
  await mkdir('test-results',{recursive:true});
  for(const width of [1440,768,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:`test-results/incidents-detail-${width}.png`,fullPage:true,caret:'initial'}); const overflow=await page.evaluate(()=>Array.from(document.querySelectorAll("body *")).filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width,text:e.textContent?.slice(0,80)})).slice(0,15)); assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Overflow ${width}: ${JSON.stringify(overflow)}`);await page.screenshot({path:`test-results/incidents-detail-${width}.png`,fullPage:true,caret:'initial'});}
  // Save through the real form; the changed revision remounts with fresh data.
  await page.getByLabel('Seu nome',{exact:true}).fill('Analista interface');await page.getByLabel('Sua matrícula / identificação').fill(tag);
  await page.getByLabel('Adicionar comentário').fill('Comentário registrado pelo navegador.');await page.getByRole('button',{name:'Salvar atendimento'}).click();
  await expect(page.getByText('Comentário registrado pelo navegador.',{exact:true})).toBeVisible({timeout:45000});
  incident=await db.incident.findUniqueOrThrow({where:{id:incident.id}});
  // Exercise every status; each closed status must close the corresponding alert.
  for(const stage of Object.keys(incidentStages)){
   if(stage===incident.stage)continue;
   const r=await patch(payload({stage,justification:'Mudança validada no teste integrado.',solution:'Reparo e verificação registrados.',maintenanceIds:[maintenance.id]}));assert.equal(r.status(),200,await r.text());
   incident=await db.incident.findUniqueOrThrow({where:{id:incident.id}});
   const closed=['RELEASED','DONE','REJECTED','VOID'].includes(stage);assert.equal(!!incident.resolvedAt,closed);
   // Alert attendance is independent; terminal incident stages close it by an audited rule.
   const linkedAlert=await db.alert.findFirstOrThrow({where:{evaluation:{incidentId:incident.id}}});
   assert.equal(linkedAlert.status,closed?'COMPLETED':'OPEN');
   assert.equal(linkedAlert.stage,closed?'RULE_CLOSED':'NEW');
  }
  assert.equal(JSON.stringify(await db.incidentEvent.findMany({where:{id:{in:firstEvents.map(e=>e.id)}},orderBy:{id:'asc'}})),beforeHistory);
  assert.equal(JSON.stringify(await db.checklistAnswer.findUniqueOrThrow({where:{id:checklist.answers[0].id}})),answerBefore);
  assert.equal((await db.vehicle.findUniqueOrThrow({where:{id:vehicleId}})).status,'STOPPED','Encerrar ocorrência não pode liberar veículo sem avaliar outros bloqueios');
  const concurrent=await Promise.all([patch(payload({comment:'Atendimento simultâneo A',maintenanceIds:[maintenance.id]})),patch(payload({comment:'Atendimento simultâneo B',maintenanceIds:[maintenance.id]}))]);assert.deepEqual(concurrent.map(r=>r.status()).sort(),[200,409]);
  await page.goto(`${base}/ocorrencias?q=${encodeURIComponent(incident.publicNumber)}`);
  for(const width of [1440,768,390]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`test-results/incidents-list-${width}.png`,fullPage:true,caret:'initial'});}
  assert.deepEqual(errors,[]);console.log('PASS: numeração concorrente/anual, 13 status, identificação, justificativa, encerramento/reabertura, vínculos, anexo/download, histórico imutável, resposta original, conflitos, formulário, navegação e responsividade.');
 }finally{
  await browser.close();
  if(vehicleId)await db.$transaction(async tx=>{
   await tx.alertEvent.deleteMany({where:{alert:{vehicleId}}});await tx.alert.deleteMany({where:{vehicleId}});await tx.restrictionEvidence.deleteMany({where:{event:{restriction:{vehicleId}}}});await tx.restrictionEvent.deleteMany({where:{restriction:{vehicleId}}});await tx.vehicleRestriction.deleteMany({where:{vehicleId}});await tx.checklistEvaluation.deleteMany({where:{answer:{checklist:{vehicleId}}}});await tx.checklistAnswer.deleteMany({where:{checklist:{vehicleId}}});
   await tx.incidentAttachment.deleteMany({where:{incident:{vehicleId}}});await tx.incidentEvent.deleteMany({where:{incident:{vehicleId}}});await tx.maintenanceEvent.deleteMany({where:{maintenance:{vehicleId}}});await tx.maintenance.deleteMany({where:{vehicleId}});await tx.incident.deleteMany({where:{vehicleId}});await tx.mileageReading.deleteMany({where:{vehicleId}});await tx.checklist.deleteMany({where:{vehicleId}});
   if(orderId){await tx.purchaseEvent.deleteMany({where:{purchaseId:orderId}});await tx.purchaseOrder.delete({where:{id:orderId}});}if(requisitionId)await tx.purchaseRequisition.delete({where:{id:requisitionId}});if(supplierId)await tx.supplier.delete({where:{id:supplierId}});if(staffId)await tx.staffMember.delete({where:{id:staffId}});
   await tx.vehicle.delete({where:{id:vehicleId}});
  });
  assert.equal(JSON.stringify(await db.vehicle.findMany({orderBy:{id:'asc'}})),originalFleet,'Frota original preservada');await db.$disconnect();
 }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
