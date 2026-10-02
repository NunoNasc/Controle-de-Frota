import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import {prisma as db} from '../src/lib/prisma';
import {getVehicleTimeline} from '../src/lib/vehicle-timeline';
import {vehicleTabs} from '../src/lib/vehicle-record';
async function main(){
 const original=JSON.stringify(await db.vehicle.findMany({orderBy:{id:'asc'}})),tag=`QA-${crypto.randomUUID()}`,base='http://127.0.0.1:3000';
 const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(60000);await page.emulateMedia({reducedMotion:'reduce'});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));let vehicleId:string|undefined;
 try{
  const v=await db.vehicle.create({data:{plate:'ZZZ3Z33',model:tag,category:'Caminhão',year:2020,mileage:50000}});vehicleId=v.id;
  const c=await db.checklist.create({data:{vehicleId,driverName:'Motorista QA',mileage:50000,result:'ISSUE',hasProblem:true,submissionKey:tag,answers:{create:{item:'Vazamento',itemLabel:'Vazamento identificado',answer:'ISSUE',problemType:'Óleo'}}}});
  const sc=await db.purchaseRequisition.create({data:{number:tag,description:'SC de validação'}});
  const p=await db.purchaseOrder.create({data:{vehicleId,number:tag,description:'Compra de validação',amount:100,amountKnown:true,requisitionId:sc.id}});
  const i=await db.incident.create({data:{vehicleId,title:'Vazamento QA',description:tag,checklistId:c.id,purchaseOrderId:p.id}});
  const m=await db.maintenance.create({data:{vehicleId,title:'Manutenção QA',type:'Corretiva',cost:100,costKnown:true,incidentId:i.id,purchaseOrderId:p.id}});
  await db.maintenanceEvent.create({data:{maintenanceId:m.id,actor:'Analista QA',note:'Início do serviço',before:{stage:'SCHEDULED'},after:{stage:'IN_SERVICE'}}});
  await db.tire.create({data:{vehicleId,serial:tag,brand:'Marca QA',position:'Dianteiro',treadMm:8,status:'Em uso'}});
  await db.document.create({data:{vehicleId,title:'Documento QA',expiresAt:new Date('2030-01-01'),fileUrl:'javascript:alert(1)'}});
  await db.preventivePlan.create({data:{vehicleId,nextMileage:55000}});
  const timeline=await getVehicleTimeline(vehicleId,1,100);
  for(const kind of ['Cadastro','Checklist','Problema','Ocorrência','Manutenção','Compra','SC','Pneu','Documento'])assert.ok(timeline.rows.some(e=>e.kind===kind),kind);
  assert.ok(timeline.rows.some(e=>e.title==='Manutenção iniciada'));
  assert.ok(timeline.rows.some(e=>e.href===`/compras?q=${encodeURIComponent(tag)}`));
  assert.equal((await getVehicleTimeline('missing',1,100)).total,0);
  const first=await getVehicleTimeline(vehicleId,1,3),second=await getVehicleTimeline(vehicleId,2,3);assert.equal(first.total,timeline.total);assert.equal(first.rows.length,3);assert.ok(!first.rows.some(e=>second.rows.some(x=>x.id===e.id)));
  for(const alias of [v.plate,v.plate.toLowerCase(),v.id]){const r=await page.goto(`${base}/frota/${alias}`);assert.equal(r?.status(),200);await expect(page.getByRole('heading',{name:v.plate,exact:true})).toBeVisible();}
  for(const [tab,label] of Object.entries(vehicleTabs)){await page.getByRole('navigation',{name:'Abas da ficha do veículo'}).getByRole('link',{name:new RegExp(label,'i')}).click();await expect(page).toHaveURL(new RegExp(`tab=${tab}$`));await expect(page.locator('nav[aria-label="Abas da ficha do veículo"] [aria-current="page"]')).toContainText(label.toUpperCase());}
  await page.goto(`${base}/frota/${v.plate}?tab=documentos`);await expect(page.getByText('Arquivo não disponível',{exact:true})).toBeVisible();
  await page.goto(`${base}/frota/${v.plate}?tab=abastecimentos`);await page.getByText('Registrar abastecimento',{exact:true}).click();await page.getByLabel('Combustível / insumo',{exact:true}).selectOption('DIESEL');await page.getByLabel('KM no abastecimento',{exact:true}).fill('49000');await page.getByLabel('Litros',{exact:true}).fill('40');await page.getByLabel('Valor total (R$)',{exact:true}).fill('200');await page.getByLabel('Seu nome',{exact:true}).fill('Analista QA');await page.getByLabel('Sua matrícula / identificação',{exact:true}).fill(tag);await page.getByRole('button',{name:'Salvar abastecimento'}).click();await expect(page.getByRole('status').filter({hasText:'Abastecimento registrado.'})).toBeVisible({timeout:60000});
  const fuel=await db.fuelRecord.findFirstOrThrow({where:{vehicleId}});assert.equal(Number(fuel.amount),200);assert.equal((await db.vehicle.findUniqueOrThrow({where:{id:vehicleId}})).mileage,50000);await assert.rejects(db.fuelRecord.update({where:{id:fuel.id},data:{amount:999}}));
  const data={vehicleId,submissionKey:fuel.submissionKey,fueledAt:fuel.fueledAt.toISOString(),mileage:49000,fuelType:'DIESEL',liters:40,amount:200,station:'',notes:'',operatorName:'Analista QA',operatorId:tag};const send=(body:object,origin=base)=>page.request.post(`${base}/api/admin/fuel`,{headers:{origin},data:body});assert.equal((await send(data)).status(),201);assert.equal(await db.fuelRecord.count({where:{vehicleId}}),1);assert.equal((await send({...data,liters:-1})).status(),400);assert.equal((await send({...data,fueledAt:'2099-01-01T00:00:00Z'})).status(),400);assert.equal((await send(data,'https://invalid.example')).status(),403);
  assert.ok((await getVehicleTimeline(vehicleId,1,100)).rows.some(e=>e.kind==='Abastecimento'));
  await mkdir('test-results',{recursive:true});
  for(const tab of ['resumo','custos','historico','abastecimentos']){await page.goto(`${base}/frota/${v.plate}?tab=${tab}`);if(tab==='custos'){await expect(page.getByText('R$ 200,00',{exact:true})).toBeVisible();await expect(page.getByText('R$ 400,00',{exact:true})).toHaveCount(0);}for(const width of [1440,768,390]){await page.setViewportSize({width,height:1000});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`test-results/vehicle-${tab}-${width}.png`,fullPage:true,caret:'initial'});}}
  // Next streams this route: notFound may return HTTP 200 after headers were sent.
  await page.goto(`${base}/frota/INEXISTENTE`);await expect(page.getByRole('heading',{name:'Página não encontrada'})).toBeVisible();assert.equal((await page.goto(`${base}/frota/qto-6479`))?.status(),200);assert.deepEqual(errors,[]);
  console.log('PASS: ficha por placa/ID, dez abas, timeline e paginação, isolamento, custos, abastecimento UI/API, imutabilidade, links seguros e 3 tamanhos de tela.');
 }finally{await browser.close();if(vehicleId)await db.$transaction(async tx=>{
  await tx.alertEvent.deleteMany({where:{alert:{vehicleId}}});await tx.alert.deleteMany({where:{vehicleId}});await tx.fuelRecord.deleteMany({where:{vehicleId}});await tx.document.deleteMany({where:{vehicleId}});await tx.tire.deleteMany({where:{vehicleId}});await tx.preventivePlan.deleteMany({where:{vehicleId}});await tx.maintenanceEvent.deleteMany({where:{maintenance:{vehicleId}}});await tx.maintenance.deleteMany({where:{vehicleId}});await tx.incidentEvent.deleteMany({where:{incident:{vehicleId}}});await tx.incident.deleteMany({where:{vehicleId}});await tx.checklist.deleteMany({where:{vehicleId}});await tx.purchaseEvent.deleteMany({where:{purchase:{vehicleId}}});await tx.purchaseOrder.deleteMany({where:{vehicleId}});await tx.purchaseRequisition.deleteMany({where:{number:tag}});await tx.vehicle.delete({where:{id:vehicleId}});
 });assert.equal(JSON.stringify(await db.vehicle.findMany({orderBy:{id:'asc'}})),original,'Frota existente preservada');await db.$disconnect();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
