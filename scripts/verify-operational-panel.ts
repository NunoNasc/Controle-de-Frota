import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {prisma as db} from '../src/lib/prisma';
import {getOperationalPanel} from '../src/lib/operational-panel';
async function main(){
 const before=JSON.stringify(await db.vehicle.findMany({orderBy:{id:'asc'}}));let vehicleId:string|undefined;
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const baseline=await getOperationalPanel();
  const v=await db.vehicle.create({data:{plate:'ZZZ3Z33',model:'Teste do painel',year:2020,category:'QA',mileage:100,status:'STOPPED',availability:'UNAVAILABLE'}});vehicleId=v.id;
  for(let i=0;i<6;i++)await db.incident.create({data:{vehicleId,title:`Falha crítica de teste ${i+1}`,description:'QA temporário',priority:'CRITICAL',openedAt:new Date(Date.now()-(6-i)*3600000)}});
  await db.maintenance.create({data:{vehicleId,title:'Manutenção de teste',type:'Corretiva',stage:'IN_SERVICE'}});
  await db.preventivePlan.create({data:{vehicleId,nextMileage:50}});
  const check=()=>db.checklist.create({data:{vehicleId:v.id,driverName:'QA',mileage:100,result:'ISSUE',hasProblem:true,submissionKey:crypto.randomUUID()}});
  await check();
  const data=await getOperationalPanel();assert.equal(data.stopped,baseline.stopped+1);assert.equal(data.criticalCount,baseline.criticalCount+6);assert.equal(data.unassignedCount,baseline.unassignedCount+6);assert.equal(data.maintenance,baseline.maintenance+1);assert.equal(data.checklists,baseline.checklists+1);assert.equal(data.overdue,baseline.overdue+1);assert.equal(data.critical.length,4);
  const history=await db.alertEvent.count({where:{alert:{vehicleId}}});await getOperationalPanel();assert.equal(await db.alertEvent.count({where:{alert:{vehicleId}}}),history);
  const page=await browser.newPage({viewport:{width:1920,height:1080}});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install();await page.goto('http://127.0.0.1:3000/painel');await expect(page.getByRole('heading',{name:'Painel Operacional',exact:true})).toBeVisible({timeout:45000});await expect(page.locator('.sidebar')).toHaveCount(0);await expect(page.locator('[data-tv="ALERTAS CRÍTICOS"]')).toHaveText(String(data.criticalCount));await expect(page.locator('.tv-critical-queue')).toBeVisible();
  const api=await page.request.get('http://127.0.0.1:3000/api/admin/operational-panel');assert.equal(api.status(),200);assert.match(api.headers()['cache-control'],/no-store/);assert.ok(!(await api.text()).includes('qrToken'));
  const clock=await page.locator('.tv-clock strong').innerText();await page.clock.fastForward(2000);await expect(page.locator('.tv-clock strong')).not.toHaveText(clock);
  let fail=true,calls=0;await page.route('**/api/admin/operational-panel',route=>{calls++;return fail?route.fulfill({status:503,contentType:'application/json',body:'{}'}):route.continue();});
  const last=await page.locator('.tv-freshness time').getAttribute('datetime');await page.getByRole('button',{name:'Atualizar',exact:true}).click();await expect(page.locator('.tv-stale')).toBeVisible();assert.equal(await page.locator('.tv-freshness time').getAttribute('datetime'),last);await expect(page.locator('[data-tv="ALERTAS CRÍTICOS"]')).toHaveText(String(data.criticalCount));
  fail=false;await check();const countBefore=calls;await page.clock.fastForward(31000);await expect(page.locator('[data-tv="CHECKLISTS COM PROBLEMA"]')).toHaveText(String(data.checklists+1),{timeout:15000});assert.ok(calls>countBefore);await expect(page.locator('.tv-stale')).toHaveCount(0);
  await page.getByRole('button',{name:'Tela cheia',exact:true}).click();await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(true);await page.getByRole('button',{name:'Sair da tela cheia'}).click();await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(false);
  await mkdir('test-results',{recursive:true});for(const [width,height] of [[1920,1080],[1366,768],[768,1024],[390,844]]){await page.setViewportSize({width,height});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`test-results/operational-panel-${width}.png`,fullPage:true});if(width>=1366){const size=await page.evaluate(()=>({height:document.documentElement.scrollHeight,viewport:innerHeight}));assert.ok(size.height<=size.viewport,`Painel precisa caber na TV: ${JSON.stringify(size)}`);}await page.screenshot({path:`test-results/operational-panel-${width}.png`,fullPage:true});}
  await page.getByRole('link',{name:'Voltar à gestão'}).click();await expect(page).toHaveURL('http://127.0.0.1:3000/',{timeout:45000});assert.deepEqual(errors,[]);
  console.log('PASS: sete indicadores reais, limite de filas, relógio, polling, erro/recuperação, timestamp, tela cheia, 4 tamanhos e navegação.');
 }finally{
  await browser.close();
  if(vehicleId)await db.$transaction(async tx=>{const where={vehicleId};await tx.alertEvent.deleteMany({where:{alert:where}});await tx.alert.deleteMany({where});await tx.maintenanceEvent.deleteMany({where:{maintenance:where}});await tx.maintenance.deleteMany({where});await tx.incidentEvent.deleteMany({where:{incident:where}});await tx.incident.deleteMany({where});await tx.checklist.deleteMany({where});await tx.preventivePlanEvent.deleteMany({where:{plan:where}});await tx.preventivePlan.deleteMany({where});await tx.vehicle.delete({where:{id:vehicleId}});});
  assert.equal(JSON.stringify(await db.vehicle.findMany({orderBy:{id:'asc'}})),before);await db.$disconnect();
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
