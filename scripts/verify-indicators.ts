import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {prisma as db} from '../src/lib/prisma';
import {getIndicators} from '../src/lib/indicators';
import {indicatorFilters} from '../src/lib/indicator-filters';
async function main(){
 const before=JSON.stringify(await db.vehicle.findMany({orderBy:{id:'asc'}}));const ids:string[]=[];let centerId:string|undefined;
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const d=(day:number,hour=3)=>new Date(`2026-09-${String(day).padStart(2,'0')}T${String(hour).padStart(2,'0')}:00:00Z`);
 try{
  const center=await db.costCenter.create({data:{code:`QA-IND-${crypto.randomUUID()}`,name:'Indicadores temporários'}});centerId=center.id;
  for(const plate of ['ZZZ2Z21','ZZZ2Z22']){const v=await db.vehicle.create({data:{plate,model:'Teste indicadores',category:'QA',profile:'QA-IND',year:2020,mileage:200,status:'AVAILABLE',availability:'AVAILABLE',costCenterId:center.id}});ids.push(v.id);}
  const incident=await db.incident.create({data:{vehicleId:ids[0],title:'Pneu   furado',description:'QA',category:'TIRES',priority:'CRITICAL',stage:'DONE',openedAt:d(10),resolvedAt:d(12)}});
  await db.incident.create({data:{vehicleId:ids[0],title:'pneu furado',description:'QA',category:'TIRES',openedAt:d(11)}});
  await db.incident.create({data:{vehicleId:ids[0],title:'Histórico anterior',description:'QA',stage:'DONE',openedAt:d(9),resolvedAt:d(10)}});
  await db.incident.create({data:{vehicleId:ids[0],title:'Cancelada',description:'QA',stage:'VOID',openedAt:d(11)}});
  const checklist=await db.checklist.create({data:{vehicleId:ids[0],driverName:'QA',mileage:200,result:'ISSUE',submittedAt:d(10),submissionKey:crypto.randomUUID(),answers:{create:[{item:'a',answer:'OK'},{item:'b',answer:'ISSUE',incidentId:incident.id},{item:'c',answer:'NOT_APPLICABLE'}]}}});
  await db.checklist.create({data:{vehicleId:ids[0],driverName:'QA',mileage:200,result:'ISSUE',submittedAt:d(11),submissionKey:crypto.randomUUID(),answers:{create:[{item:'a',answer:'OK'},{item:'b',answer:'OK'},{item:'c',answer:'ISSUE'}]}}});
  await db.checklist.create({data:{vehicleId:ids[0],driverName:'QA',mileage:200,result:'OK',status:'DRAFT',submittedAt:d(11),submissionKey:crypto.randomUUID()}});
  await db.checklist.create({data:{vehicleId:ids[0],driverName:'QA',mileage:200,result:'OK',submittedAt:d(10,2),submissionKey:crypto.randomUUID()}});
  await db.maintenance.create({data:{vehicleId:ids[0],title:'QA1',type:'Preventiva',kind:'PREVENTIVE',stage:'DONE',costKnown:true,cost:100.25,completedAt:d(11),unavailableFrom:d(10)}});
  await db.maintenance.create({data:{vehicleId:ids[0],title:'QA2',type:'Corretiva',kind:'CORRECTIVE',stage:'DONE',costKnown:true,cost:200.50,completedAt:d(12),unavailableFrom:d(10,15)}});
  await db.maintenance.create({data:{vehicleId:ids[0],title:'QA3',type:'Preventiva',kind:'PREVENTIVE',stage:'DONE',completedAt:d(12)}});
  await db.maintenance.create({data:{vehicleId:ids[0],title:'Fora do período',type:'Corretiva',stage:'DONE',costKnown:true,cost:999,completedAt:d(9)}});
  await db.vehicleRestriction.create({data:{vehicleId:ids[1],reason:'QA',detectedAt:d(11),releaseEvidenceRequired:false}});
  const plan=await db.preventivePlan.create({data:{vehicleId:ids[0],nextMileage:100,dueAt:d(20)}});
  const old={nextMileage:100,dueAt:d(12).toISOString(),lastAt:d(1).toISOString(),lastMileage:0};
  const completed={lastMileage:99,lastAt:d(11).toISOString()};
  await db.preventivePlanEvent.create({data:{planId:plan.id,actor:'QA',note:'Inicial',after:old}});
  for(let i=0;i<2;i++)await db.preventivePlanEvent.create({data:{planId:plan.id,actor:'QA',note:'Mesmo ciclo',before:old,after:completed}});
  await db.preventivePlanEvent.create({data:{planId:plan.id,actor:'QA',note:'Atrasada',before:{...old,nextMileage:200},after:{lastMileage:201,lastAt:d(12).toISOString()}}});
  await db.preventive.create({data:{vehicleId:ids[1],title:'Antiga pendente',dueAt:d(9),dueMileage:1000}});
  const f=indicatorFilters({from:'2026-09-10',to:'2026-09-12',costCenter:center.id},new Date('2026-10-01T12:00:00Z'));
  const report=await getIndicators(f);
  assert.equal(report.fleet.total,2);assert.equal(report.fleet.available,1);assert.equal(report.fleet.stopped,1);assert.equal(report.fleet.availability,50);assert.equal(report.fleet.overdue,2);
  assert.equal(report.incidents.total,2);assert.equal(report.incidents.critical,1);assert.equal(report.incidents.repeated,1);assert.equal(report.incidents.solutionHours,36);
  assert.equal(report.checks.total,2);assert.equal(report.checks.conformity,60);assert.equal(report.checks.applicable,5);
  assert.equal(report.downtime.episodes,2);assert.equal(report.downtime.hours,48);
  assert.equal(report.costs.total,300.75);assert.equal(report.costs.unknown,1);assert.equal(report.costKinds.find(c=>c.kind==='PREVENTIVE')?.cost,100.25);
  assert.equal(report.preventive.onTime,1);assert.equal(report.preventive.late,1);assert.equal(report.preventive.rate,50);
  assert.equal(report.vehicles[0].problems,3);assert.equal(report.recurrence[0].repeats,1);
  assert.equal((await getIndicators({...f,vehicle:ids[1]})).incidents.total,0);
  assert.equal((await getIndicators({...f,type:'outro'})).fleet.total,0);
  assert.equal((await getIndicators({...f,costCenter:'unassigned'})).vehicles.some(v=>ids.includes(v.id)),false);
  assert.equal((await getIndicators({...f,vehicle:"' OR 1=1 --"})).vehicles.length,0);
  await db.preventivePlan.update({where:{id:plan.id},data:{nextMileage:1000,dueAt:new Date('2026-10-01T03:00:00Z')}});
  assert.equal((await getIndicators(f)).fleet.overdue,1,'Data de hoje não está vencida');
  assert.equal((await getIndicators({...f,now:new Date('2026-10-02T03:00:00Z')})).fleet.overdue,2,'Vence após meia-noite da Bahia');
  await db.vehicle.update({where:{id:ids[0]},data:{status:'UNKNOWN',availability:'UNKNOWN'}});
  assert.equal((await getIndicators(f)).fleet.availability,null,'Cadastro incompleto não produz taxa enganosa');
  const page=await browser.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const query=new URLSearchParams({from:f.from,to:f.to,costCenter:center.id});await page.goto(`http://127.0.0.1:3000/indicadores?${query}`);
  await expect(page.getByRole('heading',{name:'Indicadores',exact:true})).toBeVisible();await expect(page.locator('[data-metric="Conformidade dos checklists"]')).toHaveText('60%');
  await page.getByLabel('Veículo',{exact:true}).selectOption(ids[1]);await page.getByRole('button',{name:'Aplicar filtros'}).click();await expect(page.locator('[data-metric="Checklists realizados"]')).toHaveText('0');
  await page.getByLabel('Veículo',{exact:true}).selectOption('');await page.getByLabel('Tipo de veículo').selectOption('QA-IND');await page.getByRole('button',{name:'Aplicar filtros'}).click();await expect(page.locator('[data-metric="Checklists realizados"]')).toHaveText('2');
  await mkdir('test-results',{recursive:true});for(const width of [1440,768,390]){await page.setViewportSize({width,height:950});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`test-results/indicators-${width}.png`,fullPage:true});}
  await page.getByRole('link',{name:'ZZZ2Z21',exact:true}).first().click();await expect(page).toHaveURL(new RegExp(`/frota/${ids[0]}`),{timeout:45000});
  await page.goto('http://127.0.0.1:3000/indicadores?from=2026-02-30');await expect(page.locator('.page [role=alert]')).toContainText('Informe datas válidas');assert.deepEqual(errors,[]);
  assert.ok(checklist.id);console.log('PASS: agregações SQL, sobreposição, custos, reincidência, prazo, filtros, datas, injeção, navegação e 3 larguras.');
 }finally{
  await browser.close();
  if(ids.length)await db.$transaction(async tx=>{
   const where={vehicleId:{in:ids}};
   await tx.alertEvent.deleteMany({where:{alert:where}});await tx.alert.deleteMany({where});
   await tx.checklistAnswer.deleteMany({where:{checklist:where}});await tx.checklist.deleteMany({where});
   await tx.restrictionEvent.deleteMany({where:{restriction:where}});await tx.vehicleRestriction.deleteMany({where});
   await tx.maintenanceEvent.deleteMany({where:{maintenance:where}});await tx.maintenance.deleteMany({where});
   await tx.incidentEvent.deleteMany({where:{incident:where}});await tx.incident.deleteMany({where});
   await tx.preventivePlanEvent.deleteMany({where:{plan:where}});await tx.preventivePlan.deleteMany({where});await tx.preventive.deleteMany({where});
   await tx.vehicle.deleteMany({where:{id:{in:ids}}});
  });
  if(centerId)await db.costCenter.delete({where:{id:centerId}});
  assert.equal(JSON.stringify(await db.vehicle.findMany({orderBy:{id:'asc'}})),before,'Frota real preservada');await db.$disconnect();
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
