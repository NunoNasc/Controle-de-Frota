import {chromium,expect} from '@playwright/test';
import {PrismaClient} from '@prisma/client';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {getVehicleInspection} from '../src/lib/checklist-config';
import {seedChecklistConfig} from '../prisma/seed-checklist-config';
async function main(){
 const db=new PrismaClient();const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(20000);page.on('dialog',d=>d.accept());
 const base='http://127.0.0.1:3000';const qa=`QA-${crypto.randomUUID()}`;const name=`Item ${qa}`;let vehicleId:string|undefined;let itemId:string|undefined;
 const before=JSON.stringify(await db.vehicle.findMany({orderBy:{id:'asc'}}));const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  const vehicle=await db.vehicle.create({data:{plate:'ZZZ8Z88',model:'Validação configurável',category:'Caminhão',profile:qa,year:2020}});vehicleId=vehicle.id;
  assert.equal(await db.checklistCategory.count(),10);assert.equal(await db.checklistItemConfig.count(),40);
  await page.goto(`${base}/configuracoes`);await page.getByRole('link',{name:'Configurar itens do checklist'}).click();await page.waitForURL('**/configuracoes/checklist');
  await page.getByLabel('Nome do item',{exact:true}).fill(name);await page.getByLabel('Orientação ao motorista').fill('Confira este item de validação.');await page.getByLabel('Tipos de problema',{exact:false}).fill('Falha\nOutro');
  await page.getByLabel('Exige foto',{exact:true}).uncheck();await page.getByLabel('Gera ocorrência',{exact:true}).uncheck();await page.getByLabel('Criticidade',{exact:true}).selectOption('LOW');
  await page.getByLabel('Todos os tipos, inclusive novos').uncheck();await page.getByLabel(qa,{exact:true}).check();await page.getByRole('button',{name:'Salvar item',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Configuração salva');
  let item=await db.checklistItemConfig.findFirstOrThrow({where:{label:name}});itemId=item.id;
  assert.deepEqual(item.vehicleTypes,[qa]);assert.equal(item.requiresPhoto,false);assert.equal(item.generatesIncident,false);
  const real=await db.vehicle.findUniqueOrThrow({where:{plate:'QTO6479'}});assert.ok(!(await getVehicleInspection(db,real)).items.some(i=>i.id===itemId));
  let config=await getVehicleInspection(db,vehicle);assert.equal(config.items.length,41);
  await page.setViewportSize({width:390,height:844});await page.goto(`${base}/checklist/${vehicle.qrToken}`);await page.getByLabel('Matrícula ou identificação').fill('QA');await page.getByLabel('Quilometragem atual').fill('100');await page.getByRole('button',{name:'Iniciar checklist'}).click();
  for(const definition of config.items){if(definition.id===itemId)break;await page.getByRole('button',{name:'OK',exact:true}).click();}
  await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();await page.getByRole('button',{name:'PROBLEMA',exact:true}).click();await page.getByRole('button',{name:'Falha',exact:true}).click();await expect(page.getByRole('button',{name:'Próximo item',exact:true})).toBeEnabled();await expect(page.getByText('Foto opcional do problema.',{exact:false})).toBeVisible();
  const payload=(version=config.version,photo?:string)=>({driverIdentification:'QA',mileage:100,submissionKey:crypto.randomUUID(),configVersion:version,answers:config.items.map(i=>({item:i.id,answer:i.id===itemId?'ISSUE':'OK',...(i.id===itemId?{problemType:'Falha',...(photo?{photo}:{})}:{})}))});
  const post=(data:object)=>page.request.post(`${base}/api/checklist/${vehicle.qrToken}`,{headers:{origin:base},data});
  const firstResponse=await post(payload());assert.equal(firstResponse.status(),201);const firstId=(await firstResponse.json()).id;
  assert.equal(await db.incident.count({where:{vehicleId}}),0);assert.equal((await db.vehicle.findUniqueOrThrow({where:{id:vehicleId}})).status,'UNKNOWN');
  assert.equal(await db.alert.count({where:{vehicleId,priority:'LOW'}}),1,'Problema sem ocorrência também deve gerar alerta');
  const saved=await db.checklistAnswer.findFirstOrThrow({where:{checklistId:firstId,configItemId:itemId}});assert.equal(saved.requiresPhoto,false);assert.equal(saved.incidentRule,false);assert.equal(saved.itemLabel,name);
  const oldVersion=config.version;
  await page.goto(`${base}/configuracoes/checklist`);await page.getByRole('button',{name:`Editar ${name}`,exact:true}).click();await page.getByLabel('Nome do item',{exact:true}).fill(`${name} revisado`);await page.getByLabel('Exige foto',{exact:true}).check();await page.getByLabel('Gera ocorrência',{exact:true}).check();await page.getByLabel('Bloqueia veículo',{exact:true}).check();await page.getByLabel('Criticidade',{exact:true}).selectOption('HIGH');await page.getByRole('button',{name:'Salvar item',exact:true}).click();await expect(page.getByRole('status')).toContainText('Configuração salva');
  assert.equal((await post(payload(oldVersion))).status(),409);
  config=await getVehicleInspection(db,vehicle);assert.equal((await post(payload())).status(),400);
  const jpeg=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=10;c.height=10;return c.toDataURL('image/jpeg');});
  const response=await post(payload(config.version,jpeg));assert.equal(response.status(),201);const secondId=(await response.json()).id;
  assert.equal(await db.incident.count({where:{vehicleId}}),1);assert.equal((await db.vehicle.findUniqueOrThrow({where:{id:vehicleId}})).status,'STOPPED');
  const incident=await db.incident.findFirstOrThrow({where:{checklistId:secondId}});assert.equal(incident.priority,'HIGH');assert.equal(incident.vehicleBlocked,true);
  const historical=await db.checklistAnswer.findUniqueOrThrow({where:{id:saved.id}});assert.equal(historical.itemLabel,name);assert.equal(historical.requiresPhoto,false);assert.equal(historical.priority,'LOW');
  await page.goto(`${base}/checklists/${firstId}`);await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
  await page.goto(`${base}/configuracoes/checklist`);await page.getByRole('button',{name:`Desativar ${name} revisado`,exact:true}).click();await expect(page.getByRole('status')).toContainText('Configuração salva');assert.ok(!(await getVehicleInspection(db,vehicle)).items.some(i=>i.id===itemId));
  await page.getByLabel('Filtrar atividade').selectOption('inactive');await page.getByRole('button',{name:`Ativar ${name} revisado`,exact:true}).click();await expect(page.getByRole('status')).toContainText('Configuração salva');assert.ok((await getVehicleInspection(db,vehicle)).items.some(i=>i.id===itemId));
  item=await db.checklistItemConfig.findUniqueOrThrow({where:{id:itemId}});const snapshot=JSON.stringify(item);await seedChecklistConfig(db);assert.equal(JSON.stringify(await db.checklistItemConfig.findUniqueOrThrow({where:{id:itemId}})),snapshot);
  const editResponse=await page.request.post(`${base}/api/admin/checklist-items`,{headers:{origin:base},data:{...item,updatedAt:'2000-01-01T00:00:00.000Z'}});assert.equal(editResponse.status(),409);
  const foreign=await page.request.post(`${base}/api/admin/checklist-items`,{headers:{origin:'https://invalid.example'},data:item});assert.equal(foreign.status(),403);
  await mkdir('test-results',{recursive:true});
  for(const width of [1440,768,390]){await page.setViewportSize({width,height:1000});await page.goto(`${base}/configuracoes/checklist`);await page.getByRole('heading',{name:'Itens e regras do checklist'}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow admin ${width}`);}
  assert.deepEqual(errors,[]);console.log('PASS: criação/edição/desativação/reativação administrativa, filtro por tipo, foto opcional/obrigatória, ocorrência/bloqueio/criticidade configurados, versão obsoleta rejeitada, histórico e seed preservados, origem e conflito de edição, responsividade.');
 }finally{
  if(vehicleId)await db.$transaction(async tx=>{await tx.alertEvent.deleteMany({where:{alert:{vehicleId}}});await tx.alert.deleteMany({where:{vehicleId}});await tx.restrictionEvidence.deleteMany({where:{event:{restriction:{vehicleId}}}});await tx.restrictionEvent.deleteMany({where:{restriction:{vehicleId}}});await tx.vehicleRestriction.deleteMany({where:{vehicleId}});await tx.checklistEvaluation.deleteMany({where:{answer:{checklist:{vehicleId}}}});await tx.evidence.deleteMany({where:{checklistAnswer:{checklist:{vehicleId}}}});await tx.checklistAnswer.deleteMany({where:{checklist:{vehicleId}}});await tx.incidentAttachment.deleteMany({where:{incident:{vehicleId}}});await tx.incidentEvent.deleteMany({where:{incident:{vehicleId}}});await tx.incident.deleteMany({where:{vehicleId}});await tx.mileageReading.deleteMany({where:{vehicleId}});await tx.checklist.deleteMany({where:{vehicleId}});await tx.alertEvent.deleteMany({where:{alert:{vehicleId}}});await tx.alert.deleteMany({where:{vehicleId}});await tx.vehicle.delete({where:{id:vehicleId}});});
  if(itemId)await db.checklistItemConfig.delete({where:{id:itemId}});else await db.checklistItemConfig.deleteMany({where:{label:name}});
  assert.equal(JSON.stringify(await db.vehicle.findMany({orderBy:{id:'asc'}})),before,'Frota real alterada');await browser.close();await db.$disconnect();
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
