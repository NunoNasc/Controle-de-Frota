import {chromium,expect} from '@playwright/test';
import {PrismaClient} from '@prisma/client';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {getVehicleInspection} from '../src/lib/checklist-config';

async function main(){
 const db=new PrismaClient();const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844}});page.on('dialog',dialog=>dialog.accept());
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const base='http://127.0.0.1:3000';let vehicleId:string|undefined;
 const before=JSON.stringify(await db.vehicle.findMany({orderBy:{id:'asc'}}));
 try{
  await mkdir('test-results',{recursive:true});
  const vehicle=await db.vehicle.create({data:{plate:'ZZZ9Z99',model:'Veículo temporário de validação',year:2020,category:'Caminhão',code:`TEST-${crypto.randomUUID()}`,mileage:100}});vehicleId=vehicle.id;
  const config=await getVehicleInspection(db,vehicle);const inspectionItems=config.items;
  await page.goto(`${base}/checklist/${vehicle.qrToken}`);
  await expect(page.locator('.sidebar')).toHaveCount(0);
  await expect(page.getByText(`Prefixo ${vehicle.code}`)).toBeVisible();
  await page.getByRole('button',{name:'Iniciar checklist'}).click();
  await expect(page.getByLabel('Matrícula ou identificação')).toBeVisible();
  await page.getByLabel('Matrícula ou identificação').fill('TEST-CONDUTOR');await page.getByLabel('Quilometragem atual').fill('99');
  await expect(page.getByText(/KM menor que o último registro/)).toBeVisible();
  await page.getByRole('button',{name:'Iniciar checklist'}).click();
  await expect(page.getByText('Confira o hodômetro e marque a confirmação da quilometragem.')).toBeVisible();
  await page.getByLabel('Quilometragem atual').fill('10000');
  await expect(page.getByText(/Aumento de 9.900 km/)).toBeVisible();
  await page.getByLabel('Conferi o hodômetro e confirmo este KM').check();
  await page.getByLabel('Quilometragem atual').fill('10001');
  await expect(page.getByLabel('Conferi o hodômetro e confirmo este KM')).not.toBeChecked();
  await page.getByLabel('Quilometragem atual').fill('101');await page.getByRole('button',{name:'Iniciar checklist'}).click();
  for(const item of inspectionItems){await expect(page.getByRole('heading',{name:item.label,exact:true})).toBeVisible();await page.getByRole('button',{name:'OK',exact:true}).click();}
  await expect(page.getByRole('heading',{name:'Resumo do checklist'})).toBeVisible();
  await expect(page.locator('.dc-result')).toHaveText(`${inspectionItems.length} OK · 0 com problema`);
  await page.getByRole('button',{name:'Enviar checklist',exact:true}).click();await expect(page.getByRole('heading',{name:'Checklist enviado!'})).toBeVisible();
  const first=await db.checklist.findFirstOrThrow({where:{vehicleId},include:{answers:true}});assert.equal(first.answers.length,inspectionItems.length);assert.equal(first.driverIdentification,'TEST-CONDUTOR');assert.equal(first.hasProblem,false);assert.equal(await db.incident.count({where:{vehicleId}}),0);
  await expect(page.locator('time')).toHaveAttribute('datetime',first.submittedAt.toISOString());
  // Existing opaque QR URLs remain valid.
  await page.goto(`${base}/checklist/${vehicle.qrToken}`);await page.getByLabel('Matrícula ou identificação').fill('TEST-CONDUTOR');await page.getByLabel('Quilometragem atual').fill('102');await page.getByRole('button',{name:'Iniciar checklist'}).click();
  const jpeg=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=320;c.height=240;const x=c.getContext('2d')!;x.fillStyle='#cb633e';x.fillRect(0,0,320,240);return c.toDataURL('image/jpeg');});
  for(const item of inspectionItems){
   await expect(page.getByRole('heading',{name:item.label,exact:true})).toBeVisible();
   if(item.id==='config-tires-1' || item.id==='config-brakes-1'){
    await page.getByRole('button',{name:'PROBLEMA',exact:true}).click();
    await expect(page.getByRole('button',{name:'Próximo item',exact:true})).toBeDisabled();
    await page.getByRole('button',{name:item.problems[0],exact:true}).click();
    await expect(page.getByRole('button',{name:'Próximo item',exact:true})).toBeDisabled();
    await page.locator('input[type=file]').setInputFiles({name:'inspection.jpg',mimeType:'image/jpeg',buffer:Buffer.from(jpeg.split(',')[1],'base64')});
    await expect(page.getByRole('button',{name:'Próximo item',exact:true})).toBeEnabled();
    if(item.id==='config-tires-1')await page.screenshot({path:'test-results/driver-problem-mobile.png',fullPage:true});
    await page.getByRole('button',{name:'Próximo item',exact:true}).click();
   }else await page.getByRole('button',{name:'OK',exact:true}).click();
  }
  await page.screenshot({path:'test-results/driver-summary-mobile.png',fullPage:true});
  // Editing preserves other answers and clearing an issue removes its photo/type.
  await page.getByRole('button',{name:'Editar Dianteiro esquerdo',exact:true}).click();await page.getByRole('button',{name:'OK',exact:true}).click();
  await expect(page.locator('.dc-result')).toHaveText(`${inspectionItems.length-1} OK · 1 com problema`);
  let fail=true;await page.route('**/api/checklist/**',route=>{if(fail){fail=false;return route.abort('failed');}return route.continue();});
  await page.getByRole('button',{name:'Enviar checklist',exact:true}).click();await expect(page.locator('.dc-error')).toBeVisible();
  await page.getByRole('button',{name:'Tentar enviar novamente'}).click();await expect(page.getByRole('heading',{name:'Checklist enviado!'})).toBeVisible();
  const saved=await db.checklist.findFirstOrThrow({where:{vehicleId,hasProblem:true},include:{answers:{include:{photos:true}}}});
  assert.equal(saved.answers.filter(a=>a.answer==='ISSUE').length,1);const brake=saved.answers.find(a=>a.item==='config-brakes-1')!;assert.equal(brake.problemType,'Baixa eficiência');assert.equal(brake.notes,'');assert.equal(brake.photos.length,1);assert.ok(brake.photos[0].content?.length);
  assert.equal((await db.vehicle.findUniqueOrThrow({where:{id:vehicleId}})).status,'STOPPED');assert.equal(await db.incident.count({where:{vehicleId}}),1);
  await page.goto(`${base}/checklists/${saved.id}`);await expect(page.getByText('Baixa eficiência',{exact:true})).toBeVisible();await expect(page.locator('img[alt="Funcionamento: Baixa eficiência"]')).toHaveCount(1);
  await page.getByRole('link',{name:'Ver avaliação, alerta e ocorrência',exact:true}).click();
  await page.waitForURL('**/alertas/*',{timeout:30000});
  await expect(page.getByRole('heading',{name:'Rastreabilidade do checklist'})).toBeVisible({timeout:30000});
  await expect(page.getByText('Resposta original preservada.',{exact:false})).toBeVisible();
  await expect(page.getByText('PROBLEMA',{exact:true})).toBeVisible();
  await page.screenshot({path:'test-results/criticality-trace-mobile.png',fullPage:true});
  await page.getByRole('link',{name:/Ocorrência OC-/}).click();await page.waitForURL('**/ocorrencias/*',{timeout:30000});await expect(page.getByRole('heading',{name:'Rastreabilidade do checklist'})).toBeVisible({timeout:30000});
  const payload={driverIdentification:'TEST-CONDUTOR',mileage:102,configVersion:config.version,submissionKey:saved.submissionKey,answers:inspectionItems.map(i=>i.id==='config-brakes-1'?{item:i.id,answer:'ISSUE',problemType:'Baixa eficiência',photo:jpeg}:{item:i.id,answer:'OK'})};
  const send=(data:object,origin=base)=>page.request.post(`${base}/api/checklist/${vehicle.qrToken}`,{headers:{origin},data});
  assert.equal((await send(payload)).status(),201);assert.equal(await db.checklist.count({where:{vehicleId}}),2);
  assert.equal((await send({...payload,submissionKey:crypto.randomUUID(),driverIdentification:''})).status(),400);
  assert.equal((await send({...payload,submissionKey:crypto.randomUUID(),answers:payload.answers.map(a=>a.answer==='ISSUE'?{...a,photo:undefined}:a)})).status(),400);
  assert.equal((await send(payload,'https://invalid.example')).status(),403);
  for(const mileage of [-1,1.5,null,'',10000,1])assert.equal((await send({...payload,submissionKey:crypto.randomUUID(),mileage})).status(),400);
  assert.equal(await db.checklist.count({where:{vehicleId}}),2);
  assert.equal((await send({...payload,submissionKey:crypto.randomUUID(),mileage:10000,mileageConfirmedAgainst:101})).status(),400);
  assert.equal((await send({...payload,submissionKey:crypto.randomUUID(),mileage:1,mileageConfirmedAgainst:102})).status(),201);assert.equal((await db.vehicle.findUniqueOrThrow({where:{id:vehicleId}})).mileage,102);assert.equal(await db.mileageReading.count({where:{vehicleId,accepted:false}}),1);
  // Revalidate against a newer reading without discarding the driver's answers.
  await page.goto(`${base}/checklist/${vehicle.qrToken}`);
  await page.getByLabel('Matrícula ou identificação').fill('TEST-CONDUTOR');
  await page.getByLabel('Quilometragem atual').fill('12000');
  await page.getByLabel('Conferi o hodômetro e confirmo este KM').check();
  await page.getByRole('button',{name:'Iniciar checklist'}).click();
  for(const item of inspectionItems){await expect(page.getByRole('heading',{name:item.label,exact:true})).toBeVisible();await page.getByRole('button',{name:'OK',exact:true}).click();}
  await db.vehicle.update({where:{id:vehicleId},data:{mileage:103}});
  await page.getByRole('button',{name:'Enviar checklist',exact:true}).click();
  await expect(page.getByText(/suas respostas foram mantidas/)).toBeVisible();
  await expect(page.getByLabel('Conferi o hodômetro e confirmo este KM')).not.toBeChecked();
  await page.screenshot({path:'test-results/driver-mileage-confirmation.png',fullPage:true});
  await page.getByLabel('Conferi o hodômetro e confirmo este KM').check();
  await page.getByRole('button',{name:'Voltar ao resumo',exact:true}).click();
  await expect(page.locator('.dc-result')).toHaveText(`${inspectionItems.length} OK · 0 com problema`);
  await page.getByRole('button',{name:'Enviar checklist',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Checklist enviado!'})).toBeVisible();
  assert.equal((await db.vehicle.findUniqueOrThrow({where:{id:vehicleId}})).mileage,12000);
  assert.equal(await db.checklist.count({where:{vehicleId}}),4);
  for(const width of [390,768,1440]){
   await page.setViewportSize({width,height:900});await page.goto(`${base}/checklist/${vehicle.qrToken}`);await expect(page.getByText(vehicle.plate,{exact:true})).toBeVisible();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(width===390)await page.screenshot({path:'test-results/driver-start-mobile.png',fullPage:true});
  }
  assert.equal((await page.request.get(`${base}/checklist/ZZZ0000`)).status(),404);
  assert.deepEqual(errors,[]);
  console.log('PASS: itens dinâmicos OK, problema/foto obrigatórios, edição, resumo, erro de rede/reenvio, persistência/foto administrativa, bloqueio crítico, idempotência, validação API, QR antigo/placa e telas 390/768/1440.');
 }finally{
  if(vehicleId)await db.$transaction(async tx=>{
   await tx.alertEvent.deleteMany({where:{alert:{vehicleId}}});await tx.alert.deleteMany({where:{vehicleId}});await tx.restrictionEvidence.deleteMany({where:{event:{restriction:{vehicleId}}}});await tx.restrictionEvent.deleteMany({where:{restriction:{vehicleId}}});await tx.vehicleRestriction.deleteMany({where:{vehicleId}});await tx.checklistEvaluation.deleteMany({where:{answer:{checklist:{vehicleId}}}});await tx.evidence.deleteMany({where:{checklistAnswer:{checklist:{vehicleId}}}});
   await tx.checklistAnswer.deleteMany({where:{checklist:{vehicleId}}});await tx.incidentAttachment.deleteMany({where:{incident:{vehicleId}}});await tx.incidentEvent.deleteMany({where:{incident:{vehicleId}}});await tx.incident.deleteMany({where:{vehicleId}});await tx.mileageReading.deleteMany({where:{vehicleId}});await tx.checklist.deleteMany({where:{vehicleId}});await tx.alertEvent.deleteMany({where:{alert:{vehicleId}}});await tx.alert.deleteMany({where:{vehicleId}});await tx.vehicle.delete({where:{id:vehicleId}});
  });
  const after=JSON.stringify(await db.vehicle.findMany({orderBy:{id:'asc'}}));assert.equal(after,before,'A frota real deve permanecer intacta.');
  await browser.close();await db.$disconnect();
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
